-- Karaoke MVP schema for Supabase.
-- Run this whole file once in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Karaoke Night',
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'CLOSED')),
  is_locked boolean not null default false,
  requests_enabled boolean not null default true,
  -- Host commands for the TV screen (the TV owns the actual player).
  playback_state text not null default 'PLAYING'
    check (playback_state in ('PLAYING', 'PAUSED')),
  replay_nonce integer not null default 0,
  -- SHA-256 of the host token. The raw token only lives on the host device.
  host_token_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  -- SHA-256 of the guest token. The raw token only lives on the guest phone.
  guest_token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists guests_room_id_idx on public.guests (room_id);

create table if not exists public.queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel_title text not null default '',
  thumbnail text not null default '',
  requested_by text not null,
  -- Public guest id (not the secret token) so clients can spot their songs.
  guest_id uuid references public.guests (id) on delete set null,
  position integer not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'PLAYING', 'FINISHED', 'SKIPPED', 'ERROR', 'REMOVED')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists queue_room_status_idx
  on public.queue (room_id, status, position);

-- At most one PLAYING song per room.
create unique index if not exists queue_one_playing_per_room
  on public.queue (room_id) where status = 'PLAYING';

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone may read, nobody may write from the browser.
-- All writes go through Next.js API routes using the service-role key.
-- ---------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.guests enable row level security;
alter table public.queue enable row level security;

drop policy if exists "rooms are readable" on public.rooms;
create policy "rooms are readable" on public.rooms
  for select to anon, authenticated using (true);

drop policy if exists "guests are readable" on public.guests;
create policy "guests are readable" on public.guests
  for select to anon, authenticated using (true);

drop policy if exists "queue is readable" on public.queue;
create policy "queue is readable" on public.queue
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- RPC: advance the queue atomically.
--
-- p_current_id = null      -> only start the next song if nothing is playing.
-- p_current_id = <song id> -> end that song (if it is still the one playing)
--                             with p_end_status, then start the next song.
-- Returns the song that is PLAYING afterwards (zero rows when idle).
-- ---------------------------------------------------------------------------

create or replace function public.advance_queue(
  p_room_id uuid,
  p_current_id uuid,
  p_end_status text default 'FINISHED'
)
returns setof public.queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.queue;
  v_next public.queue;
begin
  if p_end_status not in ('FINISHED', 'SKIPPED', 'ERROR') then
    raise exception 'invalid end status %', p_end_status;
  end if;

  -- Serialize all queue advances for this room.
  perform 1 from public.rooms where id = p_room_id for update;

  select * into v_current
  from public.queue
  where room_id = p_room_id and status = 'PLAYING'
  limit 1;

  if v_current.id is not null then
    -- Someone else already advanced (e.g. host skip raced the TV "ended").
    if p_current_id is null or v_current.id <> p_current_id then
      return next v_current;
      return;
    end if;

    update public.queue
    set status = p_end_status, finished_at = now()
    where id = v_current.id;
  end if;

  select * into v_next
  from public.queue
  where room_id = p_room_id and status = 'QUEUED'
  order by position, created_at
  limit 1;

  if v_next.id is null then
    return;
  end if;

  update public.queue
  set status = 'PLAYING', started_at = now()
  where id = v_next.id
  returning * into v_next;

  update public.rooms set playback_state = 'PLAYING' where id = p_room_id;

  return next v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: reorder queued songs in one statement.
-- ---------------------------------------------------------------------------

create or replace function public.reorder_queue(p_room_id uuid, p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.queue q
  set position = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where q.id = o.id
    and q.room_id = p_room_id
    and q.status = 'QUEUED';
$$;

revoke all on function public.advance_queue(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reorder_queue(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.advance_queue(uuid, uuid, text) to service_role;
grant execute on function public.reorder_queue(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast changes on these tables.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'queue'
  ) then
    alter publication supabase_realtime add table public.queue;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'guests'
  ) then
    alter publication supabase_realtime add table public.guests;
  end if;
end;
$$;
