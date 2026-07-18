"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PosterImage } from "@/components/media/poster-image";
import { buildDetailHref, type MediaProvenance } from "@/lib/media/provenance";
import { queryKeys } from "@/lib/api/query-keys";
import { fetchMeta } from "@/features/detail/api";
import { cn } from "@/lib/utils/cn";
import type { MetaPreview } from "@/lib/api/schemas";

interface PosterCardProps {
  item: MetaPreview;
  provenance?: MediaProvenance | null;
  profileId: string;
  layout?: "row" | "grid";
  className?: string;
}

export function PosterCard({
  item,
  provenance,
  profileId,
  layout = "row",
  className,
}: PosterCardProps) {
  const queryClient = useQueryClient();
  const href = buildDetailHref(item.type, item.id, provenance);

  const prefetch = useCallback(() => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.meta(profileId, item.type, item.id),
      queryFn: () => fetchMeta(profileId, item.type, item.id),
      staleTime: 5 * 60_000,
    });
  }, [queryClient, profileId, item.type, item.id]);

  const widthClass = layout === "grid" ? "w-full" : "w-[140px] shrink-0 sm:w-[160px] md:w-[180px]";

  return (
    <li className={cn(widthClass, className)}>
      <Link
        href={href}
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onMouseEnter={prefetch}
        onFocus={prefetch}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-soft transition-transform duration-200 group-hover:scale-[1.02] group-focus-visible:scale-[1.02]">
          <PosterImage src={item.poster} alt="" />
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {item.name}
          </p>
          {item.releaseInfo ? (
            <p className="text-xs text-muted-foreground">{item.releaseInfo}</p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
