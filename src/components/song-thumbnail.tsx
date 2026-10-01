import Image from "next/image";
import { cn } from "@/lib/utils";

/** 16:9 YouTube thumbnail with a plain fallback when missing. */
export function SongThumbnail({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn("relative aspect-video shrink-0 overflow-hidden rounded-md bg-muted", className)}>
      {src.startsWith("https://i.ytimg.com/") ? (
        <Image src={src} alt="" fill sizes="160px" className="object-cover" unoptimized />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-lg">🎵</span>
      )}
    </div>
  );
}
