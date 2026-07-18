"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Library, Trash2 } from "lucide-react";
import { PosterImage } from "@/components/media/poster-image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-status";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemoveFromLibraryMutation, useLibraryQuery } from "@/features/library/hooks";
import { buildLibraryEntryHref } from "@/features/library/entry-href";
import { cn } from "@/lib/utils/cn";

const MEDIA_FILTERS = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
] as const;

type MediaFilter = (typeof MEDIA_FILTERS)[number]["value"];

interface LibraryViewProps {
  profileId: string;
}

export function LibraryView({ profileId }: LibraryViewProps) {
  const libraryQuery = useLibraryQuery(profileId);
  const removeMutation = useRemoveFromLibraryMutation(profileId);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const entries = libraryQuery.data ?? [];
    if (filter === "all") {
      return entries;
    }
    return entries.filter((entry) => entry.media_type === filter);
  }, [libraryQuery.data, filter]);

  const handleRemove = (mediaKey: string) => {
    setStatusMessage(null);
    removeMutation.mutate(mediaKey, {
      onError: () => setStatusMessage("Could not remove title. It was restored to your library."),
      onSuccess: () => setStatusMessage("Removed from your library."),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
        <p className="text-muted-foreground">Titles you saved for later.</p>
      </div>

      <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
        {MEDIA_FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {statusMessage ? (
        <p className="text-sm" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {libraryQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] rounded-xl" />
          ))}
        </div>
      ) : null}

      {libraryQuery.isError ? (
        <QueryErrorState
          title="Could not load library"
          message={libraryQuery.error instanceof Error ? libraryQuery.error.message : undefined}
        />
      ) : null}

      {!libraryQuery.isLoading && !libraryQuery.isError && filtered.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Your library is empty"
          description={
            filter === "all"
              ? "Save titles from detail pages to build your personal collection."
              : `No ${filter === "movie" ? "movies" : "series"} in your library yet.`
          }
        />
      ) : null}

      {filtered.length > 0 ? (
        <ul
          role="list"
          aria-label="Library titles"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {filtered.map((entry) => (
            <li key={entry.media_key} className="group space-y-2">
              <Link
                href={buildLibraryEntryHref(entry)}
                aria-label={entry.name}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted">
                  <PosterImage src={entry.poster} alt="" decorative />
                </div>
              </Link>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={buildLibraryEntryHref(entry)}
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {entry.name}
                  </Link>
                  <p className="text-xs capitalize text-muted-foreground">{entry.media_type}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Remove ${entry.name} from library`}
                  disabled={removeMutation.isPending}
                  onClick={() => handleRemove(entry.media_key)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
