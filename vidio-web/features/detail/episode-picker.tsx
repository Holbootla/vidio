"use client";

import { useMemo, useState } from "react";
import { PosterImage } from "@/components/media/poster-image";
import type { Video } from "@/lib/api/schemas";
import type { MediaProvenance } from "@/lib/media/provenance";
import { cn } from "@/lib/utils/cn";

interface EpisodePickerProps {
  videos: Video[];
  selectedId?: string | null;
  onSelect?: (video: Video) => void;
  contentType?: string;
  mediaId?: string;
  provenance?: MediaProvenance | null;
  preferredQualities?: string[];
}

function episodeLabel(video: Video): string {
  if (video.title) {
    return video.title;
  }
  if (video.season != null && video.episode != null) {
    return `S${video.season} E${video.episode}`;
  }
  return video.id;
}

export function EpisodePicker({ videos, selectedId, onSelect }: EpisodePickerProps) {
  const [internalId, setInternalId] = useState<string | null>(videos[0]?.id ?? null);
  const activeId = selectedId ?? internalId;

  const seasons = useMemo(() => {
    const grouped = new Map<number, Video[]>();
    for (const video of videos) {
      const season = video.season ?? 0;
      const list = grouped.get(season) ?? [];
      list.push(video);
      grouped.set(season, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [videos]);

  if (videos.length === 0) {
    return null;
  }

  const select = (video: Video) => {
    setInternalId(video.id);
    onSelect?.(video);
  };

  return (
    <section aria-labelledby="episodes-heading" className="space-y-4">
      <h2 id="episodes-heading" className="text-xl font-semibold">
        Episodes
      </h2>
      <div className="space-y-6">
        {seasons.map(([season, seasonVideos]) => (
          <div key={season} className="space-y-2">
            {season > 0 ? (
              <h3 className="text-sm font-medium text-muted-foreground">Season {season}</h3>
            ) : null}
            <ul role="list" className="divide-y divide-border rounded-xl border border-border">
              {seasonVideos.map((video) => {
                const selected = video.id === activeId;
                return (
                  <li key={video.id}>
                    <button
                      type="button"
                      onClick={() => select(video)}
                      aria-pressed={selected}
                      className={cn(
                        "flex w-full items-start gap-4 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        selected ? "bg-accent" : "hover:bg-muted/60",
                      )}
                    >
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                        <PosterImage src={video.thumbnail} alt="" sizes="112px" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium">{episodeLabel(video)}</p>
                        {video.released ? (
                          <p className="text-xs text-muted-foreground">{video.released}</p>
                        ) : null}
                        {video.overview ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {video.overview}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
