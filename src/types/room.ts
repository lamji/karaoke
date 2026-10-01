export type RoomStatus = "ACTIVE" | "CLOSED";
export type PlaybackState = "PLAYING" | "PAUSED";

export type Room = {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  is_locked: boolean;
  requests_enabled: boolean;
  playback_state: PlaybackState;
  replay_nonce: number;
  created_at: string;
};

/** Columns that are safe to select from the browser. */
export const ROOM_COLUMNS =
  "id,code,name,status,is_locked,requests_enabled,playback_state,replay_nonce,created_at";

export type Guest = {
  id: string;
  room_id: string;
  nickname: string;
  created_at: string;
};

/** Saved in localStorage on the guest's phone after joining. */
export type GuestSession = {
  guestId: string;
  guestToken: string;
  nickname: string;
};
