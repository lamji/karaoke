import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  ApiError,
  getRoom,
  handleError,
  readJson,
  requireGuest,
  requireHost,
  UUID_PATTERN,
} from "@/lib/api";
import { getVideo, VIDEO_ID_PATTERN } from "@/lib/youtube";
import { MAX_QUEUED_PER_GUEST, PREVENT_DUPLICATES_IN_QUEUE } from "@/lib/constants";
import type { QueueItem } from "@/types/queue";

type ActiveRow = Pick<QueueItem, "youtube_video_id" | "guest_id" | "status" | "position">;

/** Guest adds a song. The browser only sends the YouTube video id. */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/queue">) {
  try {
    const { code } = await ctx.params;
    const room = await getRoom(code);
    if (!room.requests_enabled) {
      throw new ApiError(403, "Song requests are paused by the host.");
    }

    const guest = await requireGuest(request, room.id);
    const body = await readJson<{ videoId: string }>(request);
    const videoId = typeof body.videoId === "string" ? body.videoId : "";
    if (!VIDEO_ID_PATTERN.test(videoId)) throw new ApiError(400, "Invalid video.");

    const supabase = getSupabaseAdmin();
    const { data: activeRows, error: activeError } = await supabase
      .from("queue")
      .select("youtube_video_id,guest_id,status,position")
      .eq("room_id", room.id)
      .in("status", ["QUEUED", "PLAYING"])
      .returns<ActiveRow[]>();
    if (activeError) throw activeError;

    const active = activeRows ?? [];
    const queued = active.filter((row) => row.status === "QUEUED");
    const sameVideo = active.filter((row) => row.youtube_video_id === videoId);

    if (sameVideo.some((row) => row.guest_id === guest.id)) {
      throw new ApiError(409, "You already added this song.");
    }
    if (PREVENT_DUPLICATES_IN_QUEUE && sameVideo.length > 0) {
      throw new ApiError(409, "This song is already in the queue.");
    }

    const myQueuedCount = queued.filter((row) => row.guest_id === guest.id).length;
    if (myQueuedCount >= MAX_QUEUED_PER_GUEST) {
      throw new ApiError(
        429,
        `You can have up to ${MAX_QUEUED_PER_GUEST} songs waiting. ` +
          "Wait for one of yours to play.",
      );
    }

    const video = await getVideo(videoId);
    const lastPosition = Math.max(0, ...queued.map((row) => row.position));

    const { data: item, error } = await supabase
      .from("queue")
      .insert({
        room_id: room.id,
        youtube_video_id: video.videoId,
        title: video.title,
        channel_title: video.channelTitle,
        thumbnail: video.thumbnail,
        requested_by: guest.nickname,
        guest_id: guest.id,
        position: lastPosition + 1,
      })
      .select("*")
      .single<QueueItem>();
    if (error) throw error;

    return Response.json({ item, position: queued.length + 1 }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/** Host reorders queued songs. Body: { ids: string[] } in the new order. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/rooms/[code]/queue">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);
    const body = await readJson<{ ids: string[] }>(request);

    const ids = Array.isArray(body.ids) ? body.ids : [];
    const validIds = ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id));
    if (ids.length === 0 || !validIds) throw new ApiError(400, "Invalid queue order.");

    const { error } = await getSupabaseAdmin().rpc("reorder_queue", {
      p_room_id: room.id,
      p_ids: ids,
    });
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Host clears every song that is still waiting. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/rooms/[code]/queue">) {
  try {
    const { code } = await ctx.params;
    const room = await requireHost(request, code);

    const { error } = await getSupabaseAdmin()
      .from("queue")
      .update({ status: "REMOVED", finished_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("status", "QUEUED");
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
