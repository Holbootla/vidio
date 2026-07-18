"use client";

import { LayoutGrid } from "lucide-react";
import { AddonWarnings } from "@/components/discovery/addon-warnings";
import { buildManifestMap, CatalogRowSection } from "@/components/media/catalog-row-section";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { Skeleton } from "@/components/ui/skeleton";
import { ContinueWatchingRow } from "@/features/discovery/continue-watching-row";
import { useAddonsQuery, useHomeQuery } from "@/features/discovery/hooks";

interface BoardViewProps {
  profileId: string;
}

export function BoardView({ profileId }: BoardViewProps) {
  const homeQuery = useHomeQuery(profileId);
  const addonsQuery = useAddonsQuery(profileId);
  const manifestMap = addonsQuery.data ? buildManifestMap(addonsQuery.data) : new Map();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Board</h1>
        <p className="text-muted-foreground">
          Catalog rows from your installed add-ons, plus continue watching.
        </p>
      </div>

      <ContinueWatchingRow profileId={profileId} />

      {homeQuery.isLoading ? (
        <div className="space-y-6" aria-hidden>
          <QueryLoadingState label="Loading catalog rows…" />
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <div className="flex gap-3">
                {Array.from({ length: 5 }).map((__, cardIndex) => (
                  <Skeleton key={cardIndex} className="h-64 w-40 shrink-0 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {homeQuery.isError ? (
        <QueryErrorState
          title="Could not load your board"
          message={homeQuery.error instanceof Error ? homeQuery.error.message : undefined}
        />
      ) : null}

      {homeQuery.data ? (
        <>
          <AddonWarnings warnings={homeQuery.data.warnings} />
          {homeQuery.data.rows.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="No catalog rows yet"
              description="Install and enable add-ons in settings to populate your board."
            />
          ) : (
            <div className="space-y-8">
              {homeQuery.data.rows.map((row) => (
                <CatalogRowSection
                  key={`${row.installation_id}:${row.catalog_id}`}
                  row={row}
                  profileId={profileId}
                  manifestId={manifestMap.get(row.installation_id)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
