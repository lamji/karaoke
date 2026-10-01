"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipForwardIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CenteredMessage } from "@/components/centered-message";
import { ConnectionStatus } from "@/components/connection-status";
import { NowPlaying } from "@/components/now-playing";
import { QrCode } from "@/components/qr-code";
import { SortableQueue } from "@/components/sortable-queue";
import { useQueue } from "@/hooks/use-queue";
import { useRoom } from "@/hooks/use-room";
import { captureHostTokenFromHash, useHostToken } from "@/hooks/use-session";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { getAppUrl } from "@/lib/utils";
import type { QueueItem } from "@/types/queue";
import type { Room } from "@/types/room";

export default function HostPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { room, loading, notFound } = useRoom(code);
  const hostToken = useHostToken(code);

  useEffect(() => captureHostTokenFromHash(code), [code]);

  if (loading || hostToken === undefined) {
    return <CenteredMessage icon="🎛️" title="Connecting..." spinner />;
  }
  if (notFound || !room) {
    return <CenteredMessage icon="🔍" title="Room not found" text={`No room with code ${code}.`} />;
  }
  if (!hostToken) {
    return (
      <CenteredMessage
        icon="🔑"
        title="Host access required"
        text="Open host controls on the device that created the room, or use the host link."
      />
    );
  }

  return <HostController room={room} hostToken={hostToken} />;
}

type HostAction = "play" | "pause" | "skip" | "replay";

function HostController({ room, hostToken }: { room: Room; hostToken: string }) {
  const { current, upcoming, status, refresh } = useQueue(room.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const baseUrl = getAppUrl();
  const guestUrl = `${baseUrl}/room/${room.code}`;
  const tvUrl = `${baseUrl}/room/${room.code}/tv#host=${hostToken}`;
  const isPaused = room.playback_state === "PAUSED";

  // Show the dragged order right away while the server saves it.
  const orderedUpcoming = useMemo(() => {
    if (!pendingOrder) return upcoming;
    const rank = new Map(pendingOrder.map((id, index) => [id, index]));
    const fallback = pendingOrder.length;
    return [...upcoming].sort(
      (a, b) => (rank.get(a.id) ?? fallback) - (rank.get(b.id) ?? fallback),
    );
  }, [upcoming, pendingOrder]);

  async function run(label: string, task: () => Promise<unknown>) {
    setBusy(label);
    try {
      await task();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function playback(action: HostAction) {
    return run(action, () =>
      apiRequest(`/api/rooms/${room.code}/${action}`, { method: "POST", hostToken }),
    );
  }

  function updateRoom(values: { isLocked?: boolean; requestsEnabled?: boolean }) {
    return run("room", () =>
      apiRequest(`/api/rooms/${room.code}`, { method: "PATCH", body: values, hostToken }),
    );
  }

  async function reorder(items: QueueItem[]) {
    const ids = items.map((item) => item.id);
    setPendingOrder(ids);
    try {
      await apiRequest(`/api/rooms/${room.code}/queue`, {
        method: "PATCH",
        body: { ids },
        hostToken,
      });
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingOrder(null);
    }
  }

  async function removeSong(item: QueueItem) {
    setRemovingId(item.id);
    try {
      await apiRequest(`/api/rooms/${room.code}/queue/${item.id}`, {
        method: "DELETE",
        hostToken,
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemovingId(null);
    }
  }

  function clearQueue() {
    if (!window.confirm("Remove every song that is waiting in the queue?")) return;
    run("clear", () =>
      apiRequest(`/api/rooms/${room.code}/queue`, { method: "DELETE", hostToken }),
    );
  }

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🎛️ Host controls</h1>
          <p className="font-mono text-sm tracking-widest text-muted-foreground">
            {room.name} · Room {room.code}
          </p>
        </div>
        <ConnectionStatus status={status} />
      </header>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <NowPlaying song={current} />
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="lg"
            className="h-12"
            disabled={!current || busy !== null}
            onClick={() => playback(isPaused ? "play" : "pause")}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
            {isPaused ? "Play" : "Pause"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-12"
            disabled={(!current && upcoming.length === 0) || busy !== null}
            onClick={() => playback("skip")}
          >
            <SkipForwardIcon />
            Skip
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-12"
            disabled={!current || busy !== null}
            onClick={() => playback("replay")}
          >
            <RotateCcwIcon />
            Replay
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-primary uppercase">
            Up next · {upcoming.length}
          </h2>
          <Button
            variant="destructive"
            size="sm"
            disabled={upcoming.length === 0 || busy !== null}
            onClick={clearQueue}
          >
            Clear queue
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Drag the handle to reorder songs.</p>
        <SortableQueue
          items={orderedUpcoming}
          onReorder={reorder}
          onRemove={removeSong}
          removingId={removingId}
        />
      </section>

      <section className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Button
          variant={room.is_locked ? "default" : "outline"}
          disabled={busy !== null}
          onClick={() => updateRoom({ isLocked: !room.is_locked })}
        >
          {room.is_locked ? <LockOpenIcon /> : <LockIcon />}
          {room.is_locked ? "Unlock Room" : "Lock Room"}
        </Button>
        <Button
          variant={room.requests_enabled ? "outline" : "default"}
          disabled={busy !== null}
          onClick={() => updateRoom({ requestsEnabled: !room.requests_enabled })}
        >
          {room.requests_enabled ? "Disable Requests" : "Enable Requests"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {room.is_locked ? "Locked: new guests can't join." : "Open: anyone with the code can join."}{" "}
          {room.requests_enabled ? "Requests are on." : "Requests are paused."}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <QrCode url={guestUrl} size={120} />
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm break-all text-muted-foreground">{guestUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(guestUrl, "Guest link copied")}>
              <CopyIcon /> Guest link
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(tvUrl, "TV link copied")}>
              <CopyIcon /> TV link (private)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The TV link includes your host key. Only open it on your own TV or laptop.
          </p>
        </div>
      </section>
    </div>
  );
}
