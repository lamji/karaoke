import { handleError, requireHost, updateRoom } from "@/lib/api";

/** Host only: ask the TV to resume playback. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/play">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);
    await updateRoom(room.id, { playback_state: "PLAYING" });
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
