"use client";

import { Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AddonWarnings } from "@/components/discovery/addon-warnings";
import { PosterGrid } from "@/components/media/poster-grid";
import { buildManifestMap } from "@/components/media/catalog-row-section";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { useAddonsQuery, useHomeQuery } from "@/features/discovery/hooks";
import { catalogRowProvenance } from "@/lib/media/provenance";
import type { CatalogRow } from "@/lib/api/schemas";

function rowKey(row: CatalogRow): string {
  return `${row.installation_id}:${row.catalog_id}`;
}

interface DiscoverViewProps {
  profileId: string;
}

export function DiscoverView({ profileId }: DiscoverViewProps) {
  const searchParams = useSearchParams();
  const initialRow = searchParams.get("row");
  const homeQuery = useHomeQuery(profileId);
  const addonsQuery = useAddonsQuery(profileId);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialRow);

  const manifestMap = addonsQuery.data ? buildManifestMap(addonsQuery.data) : new Map();

  const selectedRow = useMemo(() => {
    if (!homeQuery.data || homeQuery.data.rows.length === 0) {
      return null;
    }
    const key = selectedKey ?? rowKey(homeQuery.data.rows[0]!);
    return homeQuery.data.rows.find((row) => rowKey(row) === key) ?? homeQuery.data.rows[0]!;
  }, [homeQuery.data, selectedKey]);

  const provenance =
    selectedRow && manifestMap.get(selectedRow.installation_id)
      ? catalogRowProvenance(selectedRow, manifestMap.get(selectedRow.installation_id)!)
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Discover</h1>
        <p className="max-w-2xl text-muted-foreground">
          Browse one catalog at a time from your home rows. Per-catalog APIs and genre filters are
          not available yet.
        </p>
      </div>

      {homeQuery.isLoading ? <QueryLoadingState label="Loading catalogs…" /> : null}
      {homeQuery.isError ? (
        <QueryErrorState
          title="Could not load catalogs"
          message={homeQuery.error instanceof Error ? homeQuery.error.message : undefined}
        />
      ) : null}

      {homeQuery.data ? (
        <>
          <AddonWarnings warnings={homeQuery.data.warnings} />
          {homeQuery.data.rows.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="No catalogs to browse"
              description="Your board has no catalog rows yet. Install add-ons and return to the board first."
            />
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="catalog-picker" className="text-sm font-medium">
                  Catalog
                </label>
                <select
                  id="catalog-picker"
                  value={selectedRow ? rowKey(selectedRow) : ""}
                  onChange={(event) => setSelectedKey(event.target.value)}
                  className="h-10 w-full max-w-xl rounded-lg border border-border bg-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  {homeQuery.data.rows.map((row) => (
                    <option key={rowKey(row)} value={rowKey(row)}>
                      {row.title} · {row.addon_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRow ? (
                <section aria-labelledby="discover-grid-heading" className="space-y-4">
                  <div>
                    <h2 id="discover-grid-heading" className="text-xl font-semibold">
                      {selectedRow.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedRow.items.length} titles · first page only
                    </p>
                  </div>
                  {selectedRow.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This catalog row is empty.</p>
                  ) : (
                    <PosterGrid
                      items={selectedRow.items}
                      profileId={profileId}
                      provenance={provenance}
                      ariaLabel={`${selectedRow.title} titles`}
                    />
                  )}
                </section>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
