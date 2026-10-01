"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongThumbnail } from "@/components/song-thumbnail";
import { cn } from "@/lib/utils";
import type { QueueItem } from "@/types/queue";

type QueueListProps = {
  items: QueueItem[];
  /** Highlight songs from this guest and let them remove their own. */
  currentGuestId?: string | null;
  onRemove?: (item: QueueItem) => void;
  removingId?: string | null;
  size?: "default" | "tv";
  emptyText?: string;
};

export function QueueList({
  items,
  currentGuestId,
  onRemove,
  removingId,
  size = "default",
  emptyText = "No songs in the queue yet.",
}: QueueListProps) {
  const isTv = size === "tv";

  if (items.length === 0) {
    return (
      <p className={cn("text-muted-foreground", isTv ? "text-2xl" : "text-sm")}>
        {emptyText}
      </p>
    );
  }

  return (
    <ol className={cn("flex flex-col", isTv ? "gap-4" : "gap-2")}>
      {items.map((item, index) => {
        const isMine = !!currentGuestId && item.guest_id === currentGuestId;
        const canRemove = !!onRemove && isMine;

        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-lg",
              !isTv && "border p-2",
              !isTv && isMine && "border-primary/60 bg-primary/10",
            )}
          >
            <span
              className={cn(
                "w-6 shrink-0 text-center font-bold tabular-nums text-muted-foreground",
                isTv && "w-10 text-3xl",
              )}
            >
              {index + 1}
            </span>
            {!isTv && <SongThumbnail src={item.thumbnail} className="w-20" />}
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-medium", isTv ? "text-2xl" : "text-sm")}>
                {item.title}
              </p>
              <p className={cn("truncate text-muted-foreground", isTv ? "text-xl" : "text-xs")}>
                {item.requested_by}
                {isMine && " (you)"}
              </p>
            </div>
            {canRemove && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${item.title}`}
                disabled={removingId === item.id}
                onClick={() => onRemove(item)}
              >
                {removingId === item.id ? <Loader2Icon className="animate-spin" /> : <XIcon />}
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
