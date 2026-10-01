import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ApiError, getRoom, handleError, hashToken, newToken, readJson } from "@/lib/api";
import { MAX_NICKNAME_LENGTH } from "@/lib/constants";

/** Guest joins with a nickname. Returns the guest id and private guest token. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  try {
    const { code } = await ctx.params;
    const room = await getRoom(code);
    if (room.is_locked) {
      throw new ApiError(423, "This room is locked. Ask the host to unlock it.");
    }

    const body = await readJson<{ nickname: string }>(request);
    const nickname = typeof body.nickname === "string"
      ? body.nickname.replace(/\s+/g, " ").trim()
      : "";
    if (!nickname) throw new ApiError(400, "Please enter your name.");
    if (nickname.length > MAX_NICKNAME_LENGTH) {
      throw new ApiError(400, `Name must be ${MAX_NICKNAME_LENGTH} characters or less.`);
    }

    const guestToken = newToken();
    const { data, error } = await getSupabaseAdmin()
      .from("guests")
      .insert({
        room_id: room.id,
        nickname,
        guest_token_hash: hashToken(guestToken),
      })
      .select("id")
      .single<{ id: string }>();

    if (error) throw error;
    return Response.json({ guestId: data.id, guestToken, nickname }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
