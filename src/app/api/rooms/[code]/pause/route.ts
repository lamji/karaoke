import { handleError, requireHost, updateRoom } from "@/lib/api";

/** Host only: ask the TV to pause. The TV reacts to the room update. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/pause">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);
    await updateRoom(room.id, { playback_state: "PAUSED" });
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
