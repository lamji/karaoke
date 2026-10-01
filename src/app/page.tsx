import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="text-7xl">🎤</span>
        <h1 className="text-4xl font-bold tracking-tight">Karaoke</h1>
        <p className="text-muted-foreground">
          Put the big screen on the TV. Guests pick songs from their phones.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-12 text-base")}>
          Create Karaoke Room
        </Link>
        <Link
          href="/join"
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 text-base")}
        >
          Join Room
        </Link>
      </div>
    </main>
  );
}
