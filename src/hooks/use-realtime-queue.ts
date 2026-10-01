"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

/**
 * Subscribe to every INSERT/UPDATE/DELETE on this room's queue rows.
 * `onChange` also runs right after (re)connecting so missed events are
 * picked up with a fresh fetch.
 */
export function useRealtimeQueue(
  roomId: string | undefined,
  onChange: () => void,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!roomId) return;
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`queue-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue", filter: `room_id=eq.${roomId}` },
        () => onChangeRef.current(),
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("connected");
          onChangeRef.current();
        } else {
          setStatus(state === "CLOSED" ? "connecting" : "disconnected");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return status;
}
