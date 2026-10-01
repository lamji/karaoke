"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SongThumbnail } from "@/components/song-thumbnail";
import { apiRequest, errorMessage, RequestError } from "@/lib/api-client";
import { MAX_SEARCH_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import type { YouTubeResult } from "@/types/youtube";

type SearchSongProps = {
  code: string;
  guestToken: string;
  requestsEnabled: boolean;
  /** Called when the server says the guest session is no longer valid. */
  onSessionExpired: () => void;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: YouTubeResult[] }
  | { status: "error"; message: string };

export function SearchSong({
  code,
  guestToken,
  requestsEnabled,
  onSessionExpired,
}: SearchSongProps) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [added, setAdded] = useState<{ videoId: string; position: number } | null>(null);
  const latestSearch = useRef(0);

  // Debounced YouTube search.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      const searchId = ++latestSearch.current;
      setSearch({ status: "loading" });
      try {
        const url = `/api/youtube/search?q=${encodeURIComponent(trimmed)}`;
        const data = await apiRequest<{ results: YouTubeResult[] }>(url);
        if (searchId === latestSearch.current) {
          setSearch({ status: "done", results: data.results });
        }
      } catch (error) {
        if (searchId === latestSearch.current) {
          setSearch({ status: "error", message: errorMessage(error) });
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      latestSearch.current++;
      setSearch({ status: "idle" });
    }
  }

  async function addSong(result: YouTubeResult) {
    setAddingId(result.videoId);
    try {
      const data = await apiRequest<{ position: number }>(`/api/rooms/${code}/queue`, {
        method: "POST",
        body: { videoId: result.videoId },
        guestToken,
      });
      setAdded({ videoId: result.videoId, position: data.position });
      toast.success(`Added to queue · Position #${data.position}`);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) onSessionExpired();
      toast.error(errorMessage(error));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          placeholder="Search a song..."
          value={query}
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          onChange={(event) => handleQueryChange(event.target.value)}
          className="h-12 pl-10 text-base"
          autoComplete="off"
        />
      </div>

      {!requestsEnabled && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
          Song requests are paused by the host.
        </p>
      )}

      {search.status === "idle" && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Search for a song. We&apos;ll find karaoke versions on YouTube.
        </p>
      )}

      {search.status === "loading" && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Searching YouTube...
        </p>
      )}

      {search.status === "error" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {search.message}
        </p>
      )}

      {search.status === "done" && search.results.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No karaoke videos found. Try another title or artist.
        </p>
      )}

      {search.status === "done" && search.results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {search.results.map((result) => {
            const wasAdded = added?.videoId === result.videoId;
            const isAdding = addingId === result.videoId;

            return (
              <li key={result.videoId} className="flex gap-3 rounded-lg border p-2">
                <SongThumbnail src={result.thumbnail} className="w-28" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                      {result.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {result.channelTitle}
                    </p>
                  </div>
                  {wasAdded ? (
                    <p className="text-xs font-medium text-emerald-400">
                      <CheckIcon className="inline size-3.5" /> Added to queue · Position #
                      {added.position}
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      className="self-start"
                      disabled={!requestsEnabled || addingId !== null}
                      onClick={() => addSong(result)}
                    >
                      {isAdding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                      {isAdding ? "Adding song..." : "Add to Queue"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
