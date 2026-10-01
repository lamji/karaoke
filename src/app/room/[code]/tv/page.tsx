"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PauseIcon, PlayIcon, SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CenteredMessage } from "@/components/centered-message";
import { ConnectionStatus } from "@/components/connection-status";
import { KaraokePlayer } from "@/components/karaoke-player";
import { QrCode } from "@/components/qr-code";
import { QueueList } from "@/components/queue-list";
import { useQueue } from "@/hooks/use-queue";
import { useRoom } from "@/hooks/use-room";
import { captureHostTokenFromHash, useHostToken } from "@/hooks/use-session";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { getAppUrl } from "@/lib/utils";
import type { Room } from "@/types/room";

const MAX_UPCOMING_ON_TV = 6;

export default function TvPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { room, loading, notFound } = useRoom(code);
  const hostToken = useHostToken(code);

  useEffect(() => captureHostTokenFromHash(code), [code]);

  if (loading || hostToken === undefined) {
    return <CenteredMessage icon="🎤" title="Connecting..." spinner />;
  }
  if (notFound || !room) {
    return <CenteredMessage icon="🔍" title="Room not found" text={`No room with code ${code}.`} />;
  }
  if (room.status === "CLOSED") {
    return <CenteredMessage icon="👋" title="This room has closed" />;
  }

  return <TvScreen room={room} hostToken={hostToken} />;
}

type NextReason = "ENDED" | "ERROR";

function TvScreen({ room, hostToken }: { room: Room; hostToken: string | null }) {
  const { current, upcoming, status } = useQueue(room.id);
  const [started, setStarted] = useState(false);
  const advancingRef = useRef(false);
  const guestUrl = `${getAppUrl()}/room/${room.code}`;

  // The TV is the only client that advances the queue during normal playback.
  const advance = useCallback(
    async (currentId: string | null, reason: NextReason) => {
      if (!hostToken || advancingRef.current) return;
      advancingRef.current = true;
      try {
        await apiRequest(`/api/rooms/${room.code}/next`, {
          method: "POST",
          body: { currentId, reason },
          hostToken,
        });
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        advancingRef.current = false;
      }
    },
    [hostToken, room.code],
  );

  // Nothing playing but songs are waiting: start the first one.
  const hasUpcoming = upcoming.length > 0;
  useEffect(() => {
    if (started && !current && hasUpcoming) advance(null, "ENDED");
  }, [started, current, hasUpcoming, advance]);

  const currentId = current?.id ?? null;
  const handleEnded = useCallback(() => {
    if (currentId) advance(currentId, "ENDED");
  }, [advance, currentId]);

  const handleError = useCallback(() => {
    if (!currentId) return;
    toast.error("This video can't be played here. Skipping to the next song.");
    advance(currentId, "ERROR");
  }, [advance, currentId]);

  const visibleUpcoming = upcoming.slice(0, MAX_UPCOMING_ON_TV);
  const hiddenCount = upcoming.length - visibleUpcoming.length;

  return (
    <div className="flex h-dvh flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <header className="flex items-center gap-6">
        <span className="text-4xl">🎤</span>
        <div className="min-w-0 flex-1">
          {current ? (
            <>
              <p className="truncate text-2xl font-bold">{current.title}</p>
              <p className="truncate text-lg text-muted-foreground">
                Requested by <span className="text-foreground">{current.requested_by}</span>
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold">Waiting for song requests...</p>
          )}
        </div>
        <ConnectionStatus status={status} />
        <p className="shrink-0 text-2xl font-bold tracking-wider">
          ROOM <span className="font-mono text-primary">{room.code}</span>
        </p>
        {hostToken && (
          <Link
            href={`/room/${room.code}/host`}
            target="_blank"
            aria-label="Open host controls"
            className="text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontalIcon className="size-6" />
          </Link>
        )}
      </header>

      {!hostToken && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-amber-200">
          View-only screen: open the TV link from the host controls to play songs here.
        </p>
      )}

      {/* The player gets all the space; the side panel is a narrow column. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:[container-type:size]">
        <div className="relative w-full lg:w-[min(calc(100cqw_-_300px_-_1rem),calc(100cqh*16/9))] lg:flex-none">
          {started ? (
            <KaraokePlayer
              songId={current?.id ?? null}
              videoId={current?.youtube_video_id ?? null}
              paused={room.playback_state === "PAUSED"}
              replayNonce={room.replay_nonce}
              onEnded={handleEnded}
              onError={handleError}
            />
          ) : (
            <StartOverlay onStart={() => setStarted(true)} canPlay={!!hostToken} />
          )}
          {started && current && room.playback_state === "PAUSED" && (
            <div className="pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xl font-semibold">
              <PauseIcon className="size-5" /> Paused
            </div>
          )}
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col items-center gap-4 lg:min-w-[300px] lg:flex-1">
          <QrCode url={guestUrl} size={200} />
          <section className="min-h-0 w-full flex-1 overflow-hidden">
            <h2 className="mb-3 text-base font-semibold tracking-widest text-primary uppercase">
              Up next
            </h2>
            <QueueList items={visibleUpcoming} size="tv" emptyText="Scan to add a song!" />
            {hiddenCount > 0 && (
              <p className="mt-3 text-lg text-muted-foreground">+{hiddenCount} more</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function StartOverlay({ onStart, canPlay }: { onStart: () => void; canPlay: boolean }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-6 rounded-2xl bg-black text-center">
      <span className="text-7xl">🎤</span>
      <p className="max-w-md text-xl text-white/70">
        Browsers need one click before videos can play with sound.
      </p>
      <Button size="lg" className="h-14 px-8 text-xl" onClick={onStart}>
        <PlayIcon className="size-6" />
        {canPlay ? "Start Karaoke" : "Start watching"}
      </Button>
    </div>
  );
}
