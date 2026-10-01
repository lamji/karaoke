# 🎤 Karaoke

A small karaoke web app. The TV or laptop plays YouTube karaoke videos, and
guests use their phones as remotes to search for songs and add them to a
shared queue.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui ·
Supabase (Postgres + Realtime) · YouTube Data API v3 · YouTube IFrame Player API.
It is one Next.js app. There is no custom backend and no WebSocket server.

```text
Phone ──► Next.js API routes ──► YouTube Data API (search)
Phone ──► Next.js API routes ──► Supabase ──► Realtime ──► TV / host / phones
TV    ──► YouTube IFrame Player API (playback)
```

## Routes

| Route                 | Who          | What                                        |
| --------------------- | ------------ | ------------------------------------------- |
| `/`                   | everyone     | Landing page                                |
| `/create`             | host         | Create a room, then go to the TV screen     |
| `/join`               | guest        | Enter a room code                           |
| `/room/[code]`        | guest        | Phone remote: Search / Queue / Me           |
| `/room/[code]/tv`     | host's TV    | Player, room code, QR code, now playing, up next |
| `/room/[code]/host`   | host         | Play/pause/skip/replay, reorder, lock, requests |

## Setup

### 1. Create a Supabase project

1. Go to <https://supabase.com>, create a project and wait for it to finish.
2. Open **Project Settings → API Keys** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_...`) → `SUPABASE_SECRET_KEY`

   Older projects with legacy keys can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` instead; both names are supported.

### 2. Run the SQL schema

Open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql)
and click **Run**. It creates:

- `rooms`, `guests` and `queue` tables
- RLS policies: anyone can **read**; nobody can write from the browser
- `advance_queue()` and `reorder_queue()` functions (service role only)
- Realtime publication for `rooms`, `queue` and `guests`

The script is safe to run again.

### 3. Check Realtime is on

The schema adds the tables to the `supabase_realtime` publication. To
double-check, open **Database → Publications → supabase_realtime** and make sure
`rooms`, `queue` and `guests` are switched on. (Older dashboards show this under
**Database → Replication**.)

### 4. Create a YouTube API key

1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Optional but recommended: restrict the key to the YouTube Data API v3.

The default quota is 10,000 units per day. One search costs 100 units and
adding a song costs 1 unit (the server double-checks the video), so you get
roughly 100 searches per day. Identical searches are cached in memory for 10
minutes.

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...     # server only, never NEXT_PUBLIC_
YOUTUBE_API_KEY=AIza...               # server only, never NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=                  # e.g. https://my-karaoke.vercel.app
```

`NEXT_PUBLIC_APP_URL` is used in the QR code. Leave it empty to use whatever
address the TV browser is on.

### 6. Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

**Testing with real phones on your Wi-Fi:** open the TV screen with your
computer's LAN address (for example `http://192.168.1.20:3000`), not
`localhost`, so the QR code points somewhere your phone can reach. Next.js may
ask you to allow that origin; if so, add it to `allowedDevOrigins` in
`next.config.ts`.

### 7. Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel: **Add New → Project** and import the repo (framework: Next.js).
3. Add the five environment variables from step 5. Set `NEXT_PUBLIC_APP_URL`
   to your Vercel URL.
4. Deploy.

No extra servers are needed. Supabase Realtime does the live updates.

## How it works

- **Creating a room** generates a 6-character code and a private host token.
  The token is saved in `localStorage` on the host's device, and only its
  SHA-256 hash is stored in the database. Host actions send it in the
  `x-host-token` header. The room code alone gives no host rights.
- **Joining** needs only a nickname (max 30 characters). The server returns a
  guest id and a private guest token, which are kept in `localStorage`. Queue
  rows store the public `guest_id`, never the token, so a guest's "remove"
  rights can't be read from the public queue.
- **Search** goes through `GET /api/youtube/search?q=`. The server adds
  "karaoke", calls `search.list` (`type=video`, `videoEmbeddable=true`,
  `maxResults=10`) and returns `{ videoId, title, channelTitle, thumbnail }`.
  The API key never reaches the browser.
- **Adding a song** sends only the video id. The server checks that requests
  are on, that the song isn't already queued or playing, and that the guest has
  fewer than 3 songs waiting. It then looks the video up on YouTube and inserts
  the row. Limits are in [`src/lib/constants.ts`](src/lib/constants.ts).
- **Realtime.** Every screen subscribes to `queue` changes for its room, plus
  `rooms` updates, and re-fetches when anything changes. It also re-fetches
  after reconnecting and when a phone tab becomes visible again.
- **Playback ownership.** Only the TV plays video. When a video ends or fails,
  the TV calls `POST /api/rooms/[code]/next` with the id of the song that just
  ended. The `advance_queue` function locks the room row, ends that song only if
  it is still the one playing, and starts the next `QUEUED` song by position.
  That makes double calls and skip-vs-ended races harmless.
- **Host play/pause/replay** update `rooms.playback_state` / `replay_nonce`.
  The TV sees the room update and controls its player. **Skip** advances the
  queue on the server, and the TV loads the new song. Any joined guest can
  also tap **Next** on their phone (after a confirmation dialog); they send the
  id of the song they saw, so double taps never skip two songs.
- **Removing songs** is a soft delete (`status = 'REMOVED'`), so every client
  gets a normal Realtime UPDATE event.

### Opening the TV on a different device

The host token lives in the browser that created the room. To use another
device as the TV, open **Host controls → TV link (private)** and open that link
on the TV. It carries the token in the URL hash, which is saved and then removed
from the address bar.

### Browser autoplay

Browsers block videos with sound until someone interacts with the page, so the
TV screen shows a **Start Karaoke** button. Click it once; after that, songs
play automatically.

## API routes

| Method & path                         | Auth          | Purpose                          |
| ------------------------------------- | ------------- | -------------------------------- |
| `POST /api/rooms`                     | none          | Create room → `{ code, hostToken }` |
| `GET /api/rooms/[code]`               | none          | Check that a room exists         |
| `PATCH /api/rooms/[code]`             | host          | Lock/unlock, enable/disable requests |
| `POST /api/rooms/[code]/join`         | none          | Join with a nickname (rejected if locked) |
| `GET /api/youtube/search?q=`          | none          | Rate-limited YouTube search      |
| `POST /api/rooms/[code]/queue`        | guest         | Add song `{ videoId }`           |
| `PATCH /api/rooms/[code]/queue`       | host          | Reorder `{ ids }`                |
| `DELETE /api/rooms/[code]/queue`      | host          | Clear waiting songs              |
| `DELETE /api/rooms/[code]/queue/[id]` | host or owner | Remove a waiting song            |
| `POST /api/rooms/[code]/next`         | host (TV)     | Song ended/failed → next song    |
| `POST /api/rooms/[code]/skip`         | host or guest | Skip current song (guests send `{ currentId }`) |
| `POST /api/rooms/[code]/pause`        | host          | Pause on TV                      |
| `POST /api/rooms/[code]/play`         | host          | Resume on TV                     |
| `POST /api/rooms/[code]/replay`       | host          | Restart current song             |

Normal reads (room, queue) go straight from the browser to Supabase with the
publishable key. RLS makes them read-only.

## Notes and limits

- The search rate limit (20/min per IP) is in memory, so on Vercel it applies
  per server instance. That is enough to stop one phone from using up the quota.
- Playback uses the official embedded player only: no scraping, downloading or
  stream extraction. Ads and Premium behave as YouTube decides.
- Locking a room stops **new** guests from joining. Guests who already joined
  can keep requesting songs unless requests are disabled.
