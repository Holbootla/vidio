"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface PosterImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function PosterImage({
  src,
  alt,
  className,
  sizes = "(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 180px",
  priority = false,
}: PosterImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <Film className="h-8 w-8 opacity-60" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
