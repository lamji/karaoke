"use client";

import { useEffect, useRef, useState } from "react";

type KaraokePlayerProps = {
  /** Queue item id; a new id always (re)loads the video, even if repeated. */
  songId: string | null;
  videoId: string | null;
  paused: boolean;
  /** Changing this number restarts the current video from the beginning. */
  replayNonce: number;
  onEnded: () => void;
  onError: (errorCode: number) => void;
};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Load the official YouTube IFrame Player API script once. */
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function KaraokePlayer({
  songId,
  videoId,
  paused,
  replayNonce,
  onEnded,
  onError,
}: KaraokePlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const loadedSongRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onEnded, onError });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onEnded, onError };
  }, [onEnded, onError]);

  // Create the player once. YouTube replaces the target element with an
  // iframe, so we give it a node React doesn't manage.
  useEffect(() => {
    let cancelled = false;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const target = document.createElement("div");
      wrapper.appendChild(target);

      playerRef.current = new YT.Player(target, {
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, controls: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) callbacksRef.current.onEnded();
          },
          onError: (event) => callbacksRef.current.onError(event.data),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      loadedSongRef.current = null;
      wrapper.replaceChildren();
      setReady(false);
    };
  }, []);

  // Load a new video when the current song changes.
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || loadedSongRef.current === songId) return;

    loadedSongRef.current = songId;
    if (songId && videoId) player.loadVideoById(videoId);
    else player.stopVideo();
  }, [ready, songId, videoId]);

  // Follow the host's play/pause commands.
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || !videoId) return;

    if (paused) player.pauseVideo();
    else if (player.getPlayerState() === YT.PlayerState.PAUSED) player.playVideo();
  }, [ready, paused, videoId]);

  // Restart the song when the host presses Replay.
  const lastReplayRef = useRef(replayNonce);
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || lastReplayRef.current === replayNonce) return;

    lastReplayRef.current = replayNonce;
    player.seekTo(0, true);
    player.playVideo();
  }, [ready, replayNonce]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <div ref={wrapperRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      {!videoId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black text-center">
          <span className="text-7xl">🎤</span>
          <p className="text-3xl font-semibold text-white/80">
            Waiting for song requests...
          </p>
        </div>
      )}
    </div>
  );
}
