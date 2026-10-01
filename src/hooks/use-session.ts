"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { GuestSession } from "@/types/room";

const CHANGE_EVENT = "karaoke-session-change";

const hostKey = (code: string) => `karaoke:host:${code}`;
const guestKey = (code: string) => `karaoke:guest:${code}`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode); the session just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/** `undefined` while rendering on the server, then the stored string or null. */
function useStoredString(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => readStorage(key),
    () => undefined,
  );
}

export function saveHostToken(code: string, token: string) {
  writeStorage(hostKey(code), token);
}

export function saveGuestSession(code: string, session: GuestSession) {
  writeStorage(guestKey(code), JSON.stringify(session));
}

export function clearGuestSession(code: string) {
  writeStorage(guestKey(code), null);
}

/** Host token for this room; `undefined` until hydrated on the client. */
export function useHostToken(code: string): string | null | undefined {
  return useStoredString(hostKey(code));
}

/** Guest session for this room; `undefined` until hydrated on the client. */
export function useGuestSession(code: string): GuestSession | null | undefined {
  const raw = useStoredString(guestKey(code));
  return useMemo(() => {
    if (raw === undefined || raw === null) return raw;
    try {
      return JSON.parse(raw) as GuestSession;
    } catch {
      return null;
    }
  }, [raw]);
}

/**
 * Lets the host open the TV or host screen on another device with a link
 * like /room/ABC123/tv#host=TOKEN. The token is saved and removed from the URL.
 */
export function captureHostTokenFromHash(code: string) {
  const match = window.location.hash.match(/host=([A-Za-z0-9_-]+)/);
  if (!match) return;
  saveHostToken(code, match[1]);
  const cleanUrl = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", cleanUrl);
}
