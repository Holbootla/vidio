"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { PosterImage } from "@/components/media/poster-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnrichedContinueWatching } from "@/features/playback/continue-watching";
import { useContinueWatchingQuery } from "@/features/discovery/hooks";
import { useLibraryQuery } from "@/features/library/hooks";

interface ContinueWatchingRowProps {
  profileId: string;
}

export function ContinueWatchingRow({ profileId }: ContinueWatchingRowProps) {
  const { data, isLoading, isError } = useContinueWatchingQuery(profileId);
  const libraryQuery = useLibraryQuery(profileId);
  const enriched = useEnrichedContinueWatching(profileId, data, libraryQuery.data);

  return (
    <section aria-labelledby="continue-watching-heading" className="space-y-3">
      <h2 id="continue-watching-heading" className="text-lg font-semibold">
        Continue watching
      </h2>
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden" aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-56 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : null}
      {isError ? (
        <p className="text-sm text-muted-foreground" role="status">
          Continue watching is unavailable right now.
        </p>
      ) : null}
      {!isLoading && !isError && enriched.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in progress yet. Start watching a title to see it here.
        </p>
      ) : null}
      {enriched.length > 0 ? (
        <ul role="list" className="flex gap-3 overflow-x-auto pb-2" aria-label="Continue watching">
          {enriched.map((item) => (
            <li key={item.progress.video_key} className="w-56 shrink-0">
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                <Link href={item.detailHref} className="relative block h-28 bg-muted">
                  <PosterImage src={item.poster} alt="" sizes="224px" />
                </Link>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div className="space-y-1">
                    <Link
                      href={item.detailHref}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.progressLabel}</p>
                  </div>
                  <Link
                    href={item.watchHref}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    Resume
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
