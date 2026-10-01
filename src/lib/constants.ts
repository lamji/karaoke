/** Max songs a single guest can have waiting in the queue. */
export const MAX_QUEUED_PER_GUEST = 3;

/** Reject a song that is already playing or waiting in the queue. */
export const PREVENT_DUPLICATES_IN_QUEUE = true;

export const MAX_NICKNAME_LENGTH = 30;
export const MAX_SEARCH_QUERY_LENGTH = 100;
export const MAX_ROOM_NAME_LENGTH = 50;

/** Searches allowed per IP per minute (per server instance). */
export const SEARCH_RATE_LIMIT_PER_MINUTE = 20;

export const SEARCH_DEBOUNCE_MS = 500;

export const ROOM_CODE_LENGTH = 6;
