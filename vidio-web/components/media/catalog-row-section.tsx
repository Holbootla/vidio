"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { PosterCard } from "@/components/media/poster-card";
import { catalogRowProvenance } from "@/lib/media/provenance";
import type { AddonDto, CatalogRow } from "@/lib/api/schemas";

interface CatalogRowSectionProps {
  row: CatalogRow;
  profileId: string;
  manifestId?: string;
  showViewAll?: boolean;
}

export function CatalogRowSection({
  row,
  profileId,
  manifestId,
  showViewAll = true,
}: CatalogRowSectionProps) {
  const provenance = manifestId ? catalogRowProvenance(row, manifestId) : null;
  const discoverHref = `/discover?row=${encodeURIComponent(`${row.installation_id}:${row.catalog_id}`)}`;

  return (
    <section aria-labelledby={`catalog-row-${row.catalog_id}`} className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`catalog-row-${row.catalog_id}`} className="truncate text-lg font-semibold">
            {row.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {row.addon_name} · {row.content_type}
          </p>
        </div>
        {showViewAll ? (
          <Link
            href={discoverHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        <ul role="list" className="flex gap-3 sm:gap-4" aria-label={`${row.title} titles`}>
          {row.items.map((item) => (
            <PosterCard
              key={`${row.catalog_id}-${item.id}`}
              item={item}
              provenance={provenance}
              profileId={profileId}
              layout="row"
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

export function buildManifestMap(addons: AddonDto[]): Map<string, string> {
  return new Map(addons.map((addon) => [addon.id, addon.manifest_id]));
}
