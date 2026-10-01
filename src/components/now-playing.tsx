import { cn } from "@/lib/utils";
import type { QueueItem } from "@/types/queue";

type NowPlayingProps = {
  song: QueueItem | null;
  size?: "default" | "tv";
  isMine?: boolean;
};

export function NowPlaying({ song, size = "default", isMine = false }: NowPlayingProps) {
  const isTv = size === "tv";

  return (
    <section>
      <h2
        className={cn(
          "font-semibold uppercase tracking-widest text-primary",
          isTv ? "text-lg" : "text-xs",
        )}
      >
        Now playing
      </h2>
      {song ? (
        <div className={cn("mt-2", isMine && !isTv && "rounded-lg bg-primary/10 p-2")}>
          <p
            className={cn("font-bold leading-tight", isTv ? "line-clamp-2 text-4xl" : "text-lg")}
          >
            {song.title}
          </p>
          <p className={cn("text-muted-foreground", isTv ? "mt-2 text-2xl" : "text-sm")}>
            Requested by <span className="text-foreground">{song.requested_by}</span>
            {isMine && " (you)"}
          </p>
        </div>
      ) : (
        <p className={cn("mt-2 text-muted-foreground", isTv ? "text-2xl" : "text-sm")}>
          Nothing playing yet.
        </p>
      )}
    </section>
  );
}
