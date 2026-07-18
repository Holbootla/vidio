"use client";

import { PosterCard } from "@/components/media/poster-card";
import type { MediaProvenance } from "@/lib/media/provenance";
import type { MetaPreview } from "@/lib/api/schemas";

interface PosterGridProps {
  items: MetaPreview[];
  profileId: string;
  provenance?: MediaProvenance | null;
  ariaLabel: string;
}

export function PosterGrid({ items, profileId, provenance, ariaLabel }: PosterGridProps) {
  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {items.map((item) => (
        <PosterCard
          key={item.id}
          item={item}
          provenance={provenance}
          profileId={profileId}
          layout="grid"
        />
      ))}
    </ul>
  );
}
