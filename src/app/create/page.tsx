"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { saveHostToken } from "@/hooks/use-session";
import { MAX_ROOM_NAME_LENGTH } from "@/lib/constants";

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const room = await apiRequest<{ code: string; hostToken: string }>("/api/rooms", {
        method: "POST",
        body: { name },
      });
      saveHostToken(room.code, room.hostToken);
      router.push(`/room/${room.code}/tv`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <span className="text-5xl">🎤</span>
        <h1 className="mt-3 text-3xl font-bold">Create a room</h1>
        <p className="mt-2 text-muted-foreground">
          Open this on the TV or laptop that will play the videos.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="room-name">Room name (optional)</Label>
          <Input
            id="room-name"
            placeholder="Karaoke Night"
            value={name}
            maxLength={MAX_ROOM_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            className="h-12 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 text-base" disabled={creating}>
          {creating && <Loader2Icon className="animate-spin" />}
          {creating ? "Creating room..." : "Create Karaoke Room"}
        </Button>
      </form>
    </main>
  );
}
