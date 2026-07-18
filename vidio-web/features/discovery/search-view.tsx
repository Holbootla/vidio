"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AddonWarnings } from "@/components/discovery/addon-warnings";
import { CatalogRowSection, buildManifestMap } from "@/components/media/catalog-row-section";
import { PosterGrid } from "@/components/media/poster-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { useAddonsQuery, useSearchQuery } from "@/features/discovery/hooks";
import { catalogRowProvenance } from "@/lib/media/provenance";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

interface SearchViewProps {
  profileId: string;
}

export function SearchView({ profileId }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const trimmed = debouncedQuery.trim();
  const blockedEmpty = query.trim().length === 0;
  const searchQuery = useSearchQuery(profileId, debouncedQuery);
  const addonsQuery = useAddonsQuery(profileId);
  const manifestMap = addonsQuery.data ? buildManifestMap(addonsQuery.data) : new Map();

  useEffect(() => {
    if (sessionStorage.getItem("vidio-focus-search") === "1") {
      sessionStorage.removeItem("vidio-focus-search");
      const input = document.getElementById("search-input");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground">
          Search across all enabled add-on catalogs. Press{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">/</kbd> from
          anywhere in the app to focus search.
        </p>
      </div>

      <div className="max-w-xl space-y-2">
        <label htmlFor="search-input" className="text-sm font-medium">
          Search query
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Movies, series, and more"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {blockedEmpty ? (
          <p className="text-sm text-muted-foreground">Enter a search term to see results.</p>
        ) : null}
      </div>

      {!blockedEmpty && searchQuery.isLoading ? <QueryLoadingState label="Searching…" /> : null}

      {!blockedEmpty && searchQuery.isError ? (
        <QueryErrorState
          title="Search failed"
          message={searchQuery.error instanceof Error ? searchQuery.error.message : undefined}
        />
      ) : null}

      {!blockedEmpty && searchQuery.data ? (
        <>
          <AddonWarnings warnings={searchQuery.data.warnings} />
          {searchQuery.data.rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results"
              description={`Nothing matched “${trimmed}”. Try a different query.`}
            />
          ) : searchQuery.data.rows.length === 1 ? (
            <PosterGrid
              items={searchQuery.data.rows[0]!.items}
              profileId={profileId}
              provenance={
                manifestMap.get(searchQuery.data.rows[0]!.installation_id)
                  ? catalogRowProvenance(
                      searchQuery.data.rows[0]!,
                      manifestMap.get(searchQuery.data.rows[0]!.installation_id)!,
                    )
                  : null
              }
              ariaLabel={`Search results for ${trimmed}`}
            />
          ) : (
            <div className="space-y-8">
              {searchQuery.data.rows.map((row) => (
                <CatalogRowSection
                  key={`${row.installation_id}:${row.catalog_id}`}
                  row={row}
                  profileId={profileId}
                  manifestId={manifestMap.get(row.installation_id)}
                  showViewAll={false}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
