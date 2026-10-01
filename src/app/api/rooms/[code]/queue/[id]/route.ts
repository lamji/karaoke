import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  ApiError,
  getRoom,
  handleError,
  requireGuest,
  requireHost,
  UUID_PATTERN,
} from "@/lib/api";

type Ctx = RouteContext<"/api/rooms/[code]/queue/[id]">;

/**
 * Remove a waiting song. The host can remove any song; a guest can only
 * remove their own. Songs are soft-deleted (status REMOVED) so realtime
 * clients receive a normal UPDATE event.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { code, id } = await ctx.params;
    if (!UUID_PATTERN.test(id)) throw new ApiError(404, "Song not found.");

    const isHost = request.headers.has("x-host-token");
    const room = isHost ? await requireHost(request, code) : await getRoom(code);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("queue")
      .update({ status: "REMOVED", finished_at: new Date().toISOString() })
      .eq("id", id)
      .eq("room_id", room.id)
      .eq("status", "QUEUED");

    if (!isHost) {
      const guest = await requireGuest(request, room.id);
      query = query.eq("guest_id", guest.id);
    }

    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new ApiError(404, "That song can't be removed. It may already be playing.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
