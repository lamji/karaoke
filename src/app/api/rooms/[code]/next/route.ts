import {
  advanceQueue,
  ApiError,
  handleError,
  readJson,
  requireHost,
  UUID_PATTERN,
} from "@/lib/api";

type NextBody = { currentId: string | null; reason: "ENDED" | "ERROR" };

/**
 * Called by the TV screen (which holds the host token) when a video ends or
 * fails, or with currentId = null to start the first song when idle.
 * The database function makes this safe against double calls and races.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/next">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);
    const body = await readJson<NextBody>(request);

    const currentId = body.currentId ?? null;
    const validId = typeof currentId === "string" && UUID_PATTERN.test(currentId);
    if (currentId !== null && !validId) {
      throw new ApiError(400, "Invalid song.");
    }
    const endStatus = body.reason === "ERROR" ? "ERROR" : "FINISHED";

    const playing = await advanceQueue(room.id, currentId, endStatus);
    return Response.json({ playing });
  } catch (error) {
    return handleError(error);
  }
}
