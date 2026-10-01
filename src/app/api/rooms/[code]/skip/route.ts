import { advanceQueue, getPlayingSong, handleError, requireHost } from "@/lib/api";

/** Host only: skip the current song and start the next one. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/skip">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);

    const current = await getPlayingSong(room.id);
    const playing = await advanceQueue(room.id, current?.id ?? null, "SKIPPED");
    return Response.json({ playing });
  } catch (error) {
    return handleError(error);
  }
}
