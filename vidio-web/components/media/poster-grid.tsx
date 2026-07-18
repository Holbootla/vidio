"use client";

import { useEffect, useRef, useState } from "react";
import { PosterCard } from "@/components/media/poster-card";
import { useGridArrowNavigation } from "@/lib/hooks/use-grid-arrow-navigation";
import type { MediaProvenance } from "@/lib/media/provenance";
import type { MetaPreview } from "@/lib/api/schemas";

interface PosterGridProps {
  items: MetaPreview[];
  profileId: string;
  provenance?: MediaProvenance | null;
  ariaLabel: string;
}

function useResponsiveColumns(): number {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    function updateColumns() {
      const width = window.innerWidth;
      if (width >= 1280) {
        setColumns(6);
      } else if (width >= 1024) {
        setColumns(5);
      } else if (width >= 768) {
        setColumns(4);
      } else if (width >= 640) {
        setColumns(3);
      } else {
        setColumns(2);
      }
    }

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  return columns;
}

export function PosterGrid({ items, profileId, provenance, ariaLabel }: PosterGridProps) {
  const gridRef = useRef<HTMLUListElement>(null);
  const columns = useResponsiveColumns();
  useGridArrowNavigation(gridRef, { columns });

  return (
    <ul
      ref={gridRef}
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
