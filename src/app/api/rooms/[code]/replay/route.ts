import { randomInt } from "node:crypto";
import { handleError, requireHost, updateRoom } from "@/lib/api";

/** Host only: restart the current song. The TV watches replay_nonce. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/replay">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);
    await updateRoom(room.id, {
      playback_state: "PLAYING",
      replay_nonce: randomInt(1, 2_000_000_000),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
