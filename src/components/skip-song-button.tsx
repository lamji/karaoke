"use client";

import { useState } from "react";
import { Loader2Icon, SkipForwardIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage, RequestError } from "@/lib/api-client";
import type { QueueItem } from "@/types/queue";

type SkipSongButtonProps = {
  code: string;
  guestToken: string;
  song: QueueItem;
  onSessionExpired: () => void;
};

/** Guest "Next" button. Asks for confirmation before skipping the song. */
export function SkipSongButton({ code, guestToken, song, onSessionExpired }: SkipSongButtonProps) {
  const [open, setOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);

  async function skip() {
    setSkipping(true);
    try {
      await apiRequest(`/api/rooms/${code}/skip`, {
        method: "POST",
        body: { currentId: song.id },
        guestToken,
      });
      toast.success("Skipped to the next song");
      setOpen(false);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) onSessionExpired();
      toast.error(errorMessage(error));
    } finally {
      setSkipping(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SkipForwardIcon />
        Next
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !skipping && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip this song?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{song.title}&rdquo; requested by {song.requested_by} will stop, and
              the next song in the queue will start.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={skipping}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={skipping} onClick={skip}>
              {skipping && <Loader2Icon className="animate-spin" />}
              {skipping ? "Skipping..." : "Skip song"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
