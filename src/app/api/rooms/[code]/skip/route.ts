import {
  advanceQueue,
  ApiError,
  getPlayingSong,
  getRoom,
  handleError,
  readJson,
  requireGuest,
  requireHost,
  UUID_PATTERN,
} from "@/lib/api";

/**
 * Skip the current song and start the next one.
 * Allowed for the host, or for any guest who joined the room.
 * Guests must send the id of the song they saw playing, so a double tap
 * (or two guests tapping at once) only ever skips that one song.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/skip">) {
  try {
    const { code } = await ctx.params;
    const isHost = request.headers.has("x-host-token");

    if (isHost) {
      const room = await requireHost(request, code);
      const current = await getPlayingSong(room.id);
      const playing = await advanceQueue(room.id, current?.id ?? null, "SKIPPED");
      return Response.json({ playing });
    }

    const room = await getRoom(code);
    await requireGuest(request, room.id);

    const body = await readJson<{ currentId: string }>(request);
    const currentId = typeof body.currentId === "string" ? body.currentId : "";
    if (!UUID_PATTERN.test(currentId)) throw new ApiError(400, "Nothing to skip.");

    const playing = await advanceQueue(room.id, currentId, "SKIPPED");
    return Response.json({ playing });
  } catch (error) {
    return handleError(error);
  }
}
