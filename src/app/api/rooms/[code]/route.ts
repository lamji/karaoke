import { getRoom, handleError, readJson, requireHost, updateRoom } from "@/lib/api";

/** Public room info (used to validate a code before joining). */
export async function GET(_request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  try {
    const { code } = await ctx.params;
    const room = await getRoom(code);
    return Response.json({
      code: room.code,
      isLocked: room.is_locked,
      requestsEnabled: room.requests_enabled,
    });
  } catch (error) {
    return handleError(error);
  }
}

type RoomSettings = { isLocked: boolean; requestsEnabled: boolean };

/** Host only: lock/unlock the room and enable/disable song requests. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);
    const body = await readJson<RoomSettings>(request);

    const values: Record<string, boolean> = {};
    if (typeof body.isLocked === "boolean") values.is_locked = body.isLocked;
    if (typeof body.requestsEnabled === "boolean") {
      values.requests_enabled = body.requestsEnabled;
    }

    if (Object.keys(values).length > 0) await updateRoom(room.id, values);
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
