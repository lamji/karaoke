import "server-only";
import type { YouTubeResult } from "@/types/youtube";
import { ApiError } from "@/lib/api";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

type Thumbnails = Record<string, { url: string } | undefined>;

type Snippet = {
  title: string;
  channelTitle: string;
  thumbnails: Thumbnails;
};

type SearchResponse = {
  items?: { id: { videoId?: string }; snippet: Snippet }[];
};

type VideosResponse = {
  items?: {
    id: string;
    snippet: Snippet;
    status: { embeddable: boolean; privacyStatus: string };
  }[];
};

// Small in-memory cache to save YouTube quota on repeated searches.
const searchCache = new Map<string, { at: number; results: YouTubeResult[] }>();

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new ApiError(
      500,
      "YouTube search is not configured: set YOUTUBE_API_KEY in .env.local.",
    );
  return key;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function pickThumbnail(thumbnails: Thumbnails): string {
  const best = thumbnails.medium ?? thumbnails.high ?? thumbnails.default;
  return best?.url ?? "";
}

function toResult(videoId: string, snippet: Snippet): YouTubeResult {
  return {
    videoId,
    title: decodeEntities(snippet.title),
    channelTitle: decodeEntities(snippet.channelTitle),
    thumbnail: pickThumbnail(snippet.thumbnails),
  };
}

async function callYouTube<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, key: getApiKey() });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path}?${query}`, { cache: "no-store" });
  } catch {
    throw new ApiError(502, "Could not reach YouTube. Please try again.");
  }

  if (res.ok) return (await res.json()) as T;

  const body = await res.json().catch(() => null);
  const reason: string | undefined = body?.error?.errors?.[0]?.reason;
  const quotaReasons = ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"];
  if (reason && quotaReasons.includes(reason)) {
    throw new ApiError(429, "YouTube search limit reached for today. Please try again later.");
  }
  console.error("YouTube API error", res.status, body);
  throw new ApiError(502, "YouTube search failed. Please try again.");
}

/** Search embeddable karaoke videos. "karaoke" is appended automatically. */
export async function searchYouTube(rawQuery: string): Promise<YouTubeResult[]> {
  const query = /\bkaraoke\b/i.test(rawQuery) ? rawQuery : `${rawQuery} karaoke`;
  const cacheKey = query.toLowerCase();

  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.results;

  const data = await callYouTube<SearchResponse>("search", {
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "10",
    q: query,
  });

  const results = (data.items ?? [])
    .filter((item) => item.id.videoId)
    .map((item) => toResult(item.id.videoId as string, item.snippet));

  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, { at: Date.now(), results });

  return results;
}

/**
 * Look up a single video so queue entries always carry real YouTube data
 * (the browser only sends a video id).
 */
export async function getVideo(videoId: string): Promise<YouTubeResult> {
  const data = await callYouTube<VideosResponse>("videos", {
    part: "snippet,status",
    id: videoId,
  });

  const video = data.items?.[0];
  const isPlayable =
    video && video.status.embeddable && video.status.privacyStatus !== "private";
  if (!isPlayable) {
    throw new ApiError(422, "This video is unavailable for karaoke. Try another one.");
  }

  return toResult(video.id, video.snippet);
}
