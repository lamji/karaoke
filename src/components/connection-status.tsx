import { cn } from "@/lib/utils";
import type { RealtimeStatus } from "@/hooks/use-realtime-queue";

const LABELS: Record<RealtimeStatus, string> = {
  connecting: "Connecting...",
  connected: "Connected",
  disconnected: "Reconnecting...",
};

export function ConnectionStatus({ status }: { status: RealtimeStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-2 rounded-full",
          status === "connected" && "bg-emerald-400",
          status === "connecting" && "animate-pulse bg-amber-400",
          status === "disconnected" && "animate-pulse bg-red-400",
        )}
      />
      {LABELS[status]}
    </span>
  );
}
