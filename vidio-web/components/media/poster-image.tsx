"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface PosterImageProps {
  src?: string | null;
  alt: string;
  decorative?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function PosterImage({
  src,
  alt,
  decorative = false,
  className,
  sizes = "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 20vw, 180px",
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
        aria-hidden={decorative || !alt}
        role={decorative || !alt ? undefined : "img"}
        aria-label={decorative || !alt ? undefined : alt}
      >
        <Film className="h-8 w-8 opacity-60" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={decorative ? "" : alt}
      fill
      unoptimized
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
