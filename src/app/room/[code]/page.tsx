"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListMusicIcon, Loader2Icon, SearchIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CenteredMessage } from "@/components/centered-message";
import { ConnectionStatus } from "@/components/connection-status";
import { NowPlaying } from "@/components/now-playing";
import { QueueList } from "@/components/queue-list";
import { SearchSong } from "@/components/search-song";
import { SkipSongButton } from "@/components/skip-song-button";
import { useQueue } from "@/hooks/use-queue";
import { useRoom } from "@/hooks/use-room";
import { clearGuestSession, saveGuestSession, useGuestSession } from "@/hooks/use-session";
import { apiRequest, errorMessage, RequestError } from "@/lib/api-client";
import { MAX_NICKNAME_LENGTH, MAX_QUEUED_PER_GUEST } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { QueueItem } from "@/types/queue";
import type { GuestSession, Room } from "@/types/room";

export default function GuestRoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { room, loading, notFound } = useRoom(code);
  const session = useGuestSession(code);

  if (loading || session === undefined) {
    return <CenteredMessage icon="🎤" title="Connecting..." spinner />;
  }

  if (notFound || !room) {
    return (
      <CenteredMessage icon="🔍" title="Room not found" text="Check the code on the TV screen.">
        <Link href="/join" className={buttonVariants({ variant: "outline" })}>
          Try another code
        </Link>
      </CenteredMessage>
    );
  }

  if (room.status === "CLOSED") {
    return <CenteredMessage icon="👋" title="This room has closed" text="Thanks for singing!" />;
  }

  if (!session) return <JoinForm room={room} />;

  return <GuestRemote room={room} session={session} />;
}

function JoinForm({ room }: { room: Room }) {
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (room.is_locked) {
    return (
      <CenteredMessage
        icon="🔒"
        title="Room locked"
        text="The host has locked this room. Ask them to unlock it, then refresh."
      />
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) {
      setError("Please enter your name.");
      return;
    }

    setJoining(true);
    setError(null);
    try {
      const guest = await apiRequest<GuestSession>(`/api/rooms/${room.code}/join`, {
        method: "POST",
        body: { nickname: name },
      });
      saveGuestSession(room.code, guest);
    } catch (err) {
      setError(errorMessage(err));
      setJoining(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <span className="text-5xl">🎤</span>
        <h1 className="mt-3 text-2xl font-bold">{room.name}</h1>
        <p className="mt-1 font-mono text-sm tracking-widest text-muted-foreground">
          Room {room.code}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nickname">Your name</Label>
          <Input
            id="nickname"
            placeholder="Jick"
            value={nickname}
            maxLength={MAX_NICKNAME_LENGTH}
            autoComplete="nickname"
            onChange={(event) => setNickname(event.target.value)}
            className="h-12 text-base"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" size="lg" className="h-12 text-base" disabled={joining}>
          {joining && <Loader2Icon className="animate-spin" />}
          {joining ? "Joining room..." : "Join Room"}
        </Button>
      </form>
    </main>
  );
}

type Tab = "search" | "queue" | "me";

const TABS: { id: Tab; label: string; icon: typeof SearchIcon }[] = [
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "queue", label: "Queue", icon: ListMusicIcon },
  { id: "me", label: "Me", icon: UserIcon },
];

function GuestRemote({ room, session }: { room: Room; session: GuestSession }) {
  const [tab, setTab] = useState<Tab>("search");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { current, upcoming, loading, status } = useQueue(room.id);

  const mySongs = upcoming.filter((item) => item.guest_id === session.guestId);
  const isMyTurn = current?.guest_id === session.guestId;

  function leaveRoom() {
    clearGuestSession(room.code);
  }

  async function removeSong(item: QueueItem) {
    setRemovingId(item.id);
    try {
      await apiRequest(`/api/rooms/${room.code}/queue/${item.id}`, {
        method: "DELETE",
        guestToken: session.guestToken,
      });
      toast.success("Song removed");
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) leaveRoom();
      toast.error(errorMessage(error));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div>
          <p className="font-bold">🎤 Karaoke</p>
          <p className="font-mono text-xs tracking-widest text-muted-foreground">
            Room {room.code}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus status={status} />
          {current && (
            // Keyed by song so an open dialog closes when the song changes.
            <SkipSongButton
              key={current.id}
              code={room.code}
              guestToken={session.guestToken}
              song={current}
              onSessionExpired={leaveRoom}
            />
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {tab === "search" && (
          <SearchSong
            code={room.code}
            guestToken={session.guestToken}
            requestsEnabled={room.requests_enabled}
            onSessionExpired={leaveRoom}
          />
        )}

        {tab === "queue" && (
          <div className="flex flex-col gap-6">
            <NowPlaying song={current} isMine={isMyTurn} />
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">
                Up next
              </h2>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading queue...</p>
              ) : (
                <QueueList
                  items={upcoming}
                  currentGuestId={session.guestId}
                  onRemove={removeSong}
                  removingId={removingId}
                />
              )}
            </section>
          </div>
        )}

        {tab === "me" && (
          <div className="flex flex-col gap-6">
            <section className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Singing as</p>
              <p className="text-2xl font-bold">{session.nickname}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {mySongs.length} of {MAX_QUEUED_PER_GUEST} songs queued
              </p>
              {isMyTurn && <p className="mt-2 font-medium text-primary">🎶 You&apos;re up!</p>}
            </section>
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">
                My songs
              </h2>
              <QueueList
                items={mySongs}
                currentGuestId={session.guestId}
                onRemove={removeSong}
                removingId={removingId}
                emptyText="You haven't added any songs yet."
              />
            </section>
            <Button variant="outline" onClick={leaveRoom}>
              Leave room
            </Button>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                tab === id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
              {id === "queue" && upcoming.length > 0 && (
                <span className="sr-only">({upcoming.length} songs)</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
