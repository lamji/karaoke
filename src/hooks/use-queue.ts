"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useRealtimeQueue } from "@/hooks/use-realtime-queue";
import type { QueueItem } from "@/types/queue";

async function fetchActiveQueue(roomId: string): Promise<QueueItem[] | null> {
  const { data, error } = await getSupabaseBrowser()
    .from("queue")
    .select("*")
    .eq("room_id", roomId)
    .in("status", ["QUEUED", "PLAYING"])
    .order("position")
    .order("created_at")
    .returns<QueueItem[]>();

  return error ? null : data;
}

/** Live queue for a room: the PLAYING song plus everything QUEUED. */
export function useQueue(roomId: string | undefined) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);

  const refresh = useCallback(() => {
    if (!roomId) return Promise.resolve();
    const requestId = ++latestRequest.current;

    return fetchActiveQueue(roomId).then((data) => {
      // Realtime can fire several refreshes at once; keep only the newest.
      if (requestId !== latestRequest.current) return;
      if (data) setItems(data);
      setLoading(false);
    });
  }, [roomId]);

  const status = useRealtimeQueue(roomId, refresh);

  // Phones suspend tabs; catch up when the page becomes visible again.
  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const current = items.find((item) => item.status === "PLAYING") ?? null;
  const upcoming = items.filter((item) => item.status === "QUEUED");

  return { current, upcoming, loading, status, refresh };
}
