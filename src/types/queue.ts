export type QueueStatus =
  | "QUEUED"
  | "PLAYING"
  | "FINISHED"
  | "SKIPPED"
  | "ERROR"
  | "REMOVED";

export type QueueItem = {
  id: string;
  room_id: string;
  youtube_video_id: string;
  title: string;
  channel_title: string;
  thumbnail: string;
  requested_by: string;
  guest_id: string | null;
  position: number;
  status: QueueStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};
