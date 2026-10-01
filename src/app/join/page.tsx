"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { ROOM_CODE_LENGTH } from "@/lib/constants";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room codes have ${ROOM_CODE_LENGTH} characters.`);
      return;
    }

    setChecking(true);
    setError(null);
    try {
      await apiRequest(`/api/rooms/${roomCode}`);
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(errorMessage(err));
      setChecking(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <span className="text-5xl">🎶</span>
        <h1 className="mt-3 text-3xl font-bold">Join a room</h1>
        <p className="mt-2 text-muted-foreground">Enter the code shown on the TV.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="room-code">Room Code</Label>
          <Input
            id="room-code"
            placeholder="K7P4Q2"
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            className="h-14 text-center font-mono text-2xl tracking-[0.4em] uppercase"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" size="lg" className="h-12 text-base" disabled={checking}>
          {checking && <Loader2Icon className="animate-spin" />}
          {checking ? "Finding room..." : "Join Room"}
        </Button>
      </form>
    </main>
  );
}
