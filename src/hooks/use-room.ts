"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ROOM_COLUMNS, type Room } from "@/types/room";

type RoomState = {
  room: Room | null;
  loading: boolean;
  notFound: boolean;
};

async function fetchRoom(code: string) {
  const { data, error } = await getSupabaseBrowser()
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("code", code)
    .maybeSingle<Room>();

  return { room: data, failed: !!error };
}

/** Load a room by code and keep it in sync with Supabase Realtime. */
export function useRoom(rawCode: string) {
  const code = rawCode.toUpperCase();
  const [state, setState] = useState<RoomState>({
    room: null,
    loading: true,
    notFound: false,
  });

  const refresh = useCallback(() => {
    return fetchRoom(code).then((result) => {
      if (result.failed) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      setState({ room: result.room, loading: false, notFound: !result.room });
    });
  }, [code]);

  useEffect(() => {
    refresh();
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          const next = payload.new as Room;
          setState((prev) => (prev.room ? { ...prev, room: { ...prev.room, ...next } } : prev));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, refresh]);

  return { ...state, refresh };
}
