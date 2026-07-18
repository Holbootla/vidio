"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useContinueWatchingQuery } from "@/features/discovery/hooks";
import type { PlaybackProgress } from "@/lib/api/schemas";

function progressLabel(entry: PlaybackProgress): string {
  const parts = entry.media_key.split(":");
  const tail = parts.slice(2).join(":") || entry.media_key;
  if (entry.watched) {
    return `Finished · ${tail}`;
  }
  if (entry.position_secs > 0 && entry.duration_secs > 0) {
    const pct = Math.round((entry.position_secs / entry.duration_secs) * 100);
    return `Resume at ${pct}% · ${tail}`;
  }
  return `Resume · ${tail}`;
}

interface ContinueWatchingRowProps {
  profileId: string;
}

export function ContinueWatchingRow({ profileId }: ContinueWatchingRowProps) {
  const { data, isLoading, isError } = useContinueWatchingQuery(profileId);

  return (
    <section aria-labelledby="continue-watching-heading" className="space-y-3">
      <h2 id="continue-watching-heading" className="text-lg font-semibold">
        Continue watching
      </h2>
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden" aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-56 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : null}
      {isError ? (
        <p className="text-sm text-muted-foreground" role="status">
          Continue watching is unavailable right now.
        </p>
      ) : null}
      {!isLoading && !isError && (!data || data.length === 0) ? (
        <p className="text-sm text-muted-foreground">
          Nothing in progress yet. Start watching a title to see it here.
        </p>
      ) : null}
      {data && data.length > 0 ? (
        <ul role="list" className="flex gap-3 overflow-x-auto pb-2" aria-label="Continue watching">
          {data.map((entry) => (
            <li key={entry.video_key} className="w-56 shrink-0">
              <div className="flex h-full flex-col justify-between rounded-xl border border-border bg-card p-4">
                <div className="space-y-1">
                  <p className="line-clamp-2 text-sm font-medium">{progressLabel(entry)}</p>
                  <p className="text-xs text-muted-foreground">{entry.media_key}</p>
                </div>
                <Link
                  href="#"
                  aria-disabled="true"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary opacity-60"
                  tabIndex={-1}
                  title="Playback arrives in Milestone 3"
                >
                  <Play className="h-4 w-4" aria-hidden />
                  Resume
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
