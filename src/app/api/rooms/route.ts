import { randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { handleError, hashToken, newToken, readJson } from "@/lib/api";
import { MAX_ROOM_NAME_LENGTH, ROOM_CODE_LENGTH } from "@/lib/constants";

// No 0/O or 1/I/L so codes are easy to read off a TV.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const UNIQUE_VIOLATION = "23505";

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Create a room. Returns the room code and the private host token. */
export async function POST(request: Request) {
  try {
    const body = await readJson<{ name: string }>(request);
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const name = rawName.slice(0, MAX_ROOM_NAME_LENGTH) || "Karaoke Night";

    const hostToken = newToken();
    const supabase = getSupabaseAdmin();

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const { error } = await supabase.from("rooms").insert({
        code,
        name,
        host_token_hash: hashToken(hostToken),
      });

      if (!error) return Response.json({ code, hostToken }, { status: 201 });
      if (error.code !== UNIQUE_VIOLATION) throw error;
    }

    throw new Error("Could not generate a unique room code");
  } catch (error) {
    return handleError(error);
  }
}
