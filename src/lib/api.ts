import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QueueItem } from "@/types/queue";

/** Error with an HTTP status and a message that is safe to show users. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

type RoomRow = {
  id: string;
  code: string;
  status: string;
  is_locked: boolean;
  requests_enabled: boolean;
  host_token_hash: string;
};

/** Load an active room by code or throw a friendly 404. */
export async function getRoom(rawCode: string): Promise<RoomRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("rooms")
    .select("id,code,status,is_locked,requests_enabled,host_token_hash")
    .eq("code", normalizeCode(rawCode))
    .maybeSingle<RoomRow>();

  if (error) throw error;
  if (!data) throw new ApiError(404, "Room not found. Check the room code.");
  if (data.status !== "ACTIVE") throw new ApiError(410, "This room has closed.");
  return data;
}

/** Load the room and make sure the request carries its host token. */
export async function requireHost(request: Request, code: string): Promise<RoomRow> {
  const room = await getRoom(code);
  const token = request.headers.get("x-host-token");
  if (!token || !sameHash(hashToken(token), room.host_token_hash)) {
    throw new ApiError(403, "Only the host can do that.");
  }
  return room;
}

type GuestRow = { id: string; nickname: string };

/** Find the guest that owns the x-guest-token header in this room. */
export async function requireGuest(request: Request, roomId: string): Promise<GuestRow> {
  const token = request.headers.get("x-guest-token");
  if (!token) throw new ApiError(401, "Please join the room first.");

  const { data, error } = await getSupabaseAdmin()
    .from("guests")
    .select("id,nickname")
    .eq("room_id", roomId)
    .eq("guest_token_hash", hashToken(token))
    .maybeSingle<GuestRow>();

  if (error) throw error;
  if (!data) throw new ApiError(401, "Your session expired. Please join the room again.");
  return data;
}

export async function getPlayingSong(roomId: string): Promise<QueueItem | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("queue")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "PLAYING")
    .maybeSingle<QueueItem>();

  if (error) throw error;
  return data;
}

type EndStatus = "FINISHED" | "SKIPPED" | "ERROR";

/**
 * Atomically end `currentId` (if still playing) and start the next song.
 * Pass `currentId = null` to only start a song when nothing is playing.
 */
export async function advanceQueue(
  roomId: string,
  currentId: string | null,
  endStatus: EndStatus,
): Promise<QueueItem | null> {
  const { data, error } = await getSupabaseAdmin().rpc("advance_queue", {
    p_room_id: roomId,
    p_current_id: currentId,
    p_end_status: endStatus,
  });

  if (error) throw error;
  const rows = (data ?? []) as QueueItem[];
  return rows[0] ?? null;
}

export async function updateRoom(roomId: string, values: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin().from("rooms").update(values).eq("id", roomId);
  if (error) throw error;
}
