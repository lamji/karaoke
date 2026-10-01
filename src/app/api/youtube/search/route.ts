import type { NextRequest } from "next/server";
import { ApiError, handleError } from "@/lib/api";
import { searchYouTube } from "@/lib/youtube";
import { MAX_SEARCH_QUERY_LENGTH, SEARCH_RATE_LIMIT_PER_MINUTE } from "@/lib/constants";

const WINDOW_MS = 60_000;

// Simple per-IP fixed window. On Vercel this is per server instance, which
// is good enough to stop a single phone from burning the YouTube quota.
const hits = new Map<string, { windowStart: number; count: number }>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { windowStart: now, count: 1 });
    if (hits.size > 5000) hits.clear();
    return;
  }

  entry.count += 1;
  if (entry.count > SEARCH_RATE_LIMIT_PER_MINUTE) {
    throw new ApiError(429, "Too many searches. Please wait a moment.");
  }
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** GET /api/youtube/search?q=perfect -> YouTubeResult[] */
export async function GET(request: NextRequest) {
  try {
    const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (!query) throw new ApiError(400, "Type a song to search.");
    if (query.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new ApiError(400, `Search must be ${MAX_SEARCH_QUERY_LENGTH} characters or less.`);
    }

    checkRateLimit(clientIp(request));
    const results = await searchYouTube(query);
    return Response.json({ results });
  } catch (error) {
    return handleError(error);
  }
}
