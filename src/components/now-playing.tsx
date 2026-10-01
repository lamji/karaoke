import { cn } from "@/lib/utils";
import type { QueueItem } from "@/types/queue";

type NowPlayingProps = {
  song: QueueItem | null;
  isMine?: boolean;
};

export function NowPlaying({ song, isMine = false }: NowPlayingProps) {
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-widest text-primary uppercase">
        Now playing
      </h2>
      {song ? (
        <div className={cn("mt-2", isMine && "rounded-lg bg-primary/10 p-2")}>
          <p className="text-lg leading-tight font-bold">{song.title}</p>
          <p className="text-sm text-muted-foreground">
            Requested by <span className="text-foreground">{song.requested_by}</span>
            {isMine && " (you)"}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing playing yet.</p>
      )}
    </section>
  );
}
