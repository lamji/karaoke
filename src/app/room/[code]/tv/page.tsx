"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CenteredMessage } from "@/components/centered-message";
import { ConnectionStatus } from "@/components/connection-status";
import { KaraokePlayer } from "@/components/karaoke-player";
import { NowPlaying } from "@/components/now-playing";
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
    <div className="flex h-dvh flex-col gap-6 overflow-hidden p-6 lg:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-wider">🎤 KARAOKE</h1>
        <div className="flex items-center gap-6">
          <ConnectionStatus status={status} />
          <p className="text-3xl font-bold tracking-wider">
            ROOM <span className="font-mono text-primary">{room.code}</span>
          </p>
        </div>
      </header>

      {!hostToken && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-amber-200">
          View-only screen: open the TV link from the host controls to play songs here.
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col gap-6">
          {/* Keep the 16:9 player short enough to leave room for "Now playing". */}
          <div className="relative w-full lg:max-w-[calc((100dvh_-_16rem)*16/9)]">
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
          <NowPlaying song={current} size="tv" />
        </div>

        <aside className="flex min-h-0 flex-col gap-6">
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
            <QrCode url={guestUrl} size={128} />
            <div className="min-w-0">
              <p className="text-xl font-bold">Scan to sing!</p>
              <p className="mt-1 text-sm break-all text-muted-foreground">{guestUrl}</p>
            </div>
          </div>

          <section className="min-h-0 flex-1 overflow-hidden">
            <h2 className="mb-4 text-lg font-semibold tracking-widest text-primary uppercase">
              Up next
            </h2>
            <QueueList items={visibleUpcoming} size="tv" emptyText="Add a song from your phone!" />
            {hiddenCount > 0 && (
              <p className="mt-4 text-xl text-muted-foreground">+{hiddenCount} more</p>
            )}
          </section>

          {hostToken && (
            <Link
              href={`/room/${room.code}/host`}
              target="_blank"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Open host controls
            </Link>
          )}
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
