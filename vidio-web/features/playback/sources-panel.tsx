"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { AddonWarnings } from "@/components/discovery/addon-warnings";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/ui/query-status";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreamsQuery } from "@/features/playback/hooks";
import { SourcesList } from "@/features/playback/sources-list";
import { useSourceNavigation } from "@/features/playback/use-source-navigation";
import type { MediaProvenance } from "@/lib/media/provenance";
import {
  groupAndSortSources,
  selectPlayableSource,
  type ProcessedSource,
} from "@/lib/player/source-selection";

interface SourcesPanelProps {
  profileId: string;
  contentType: string;
  videoId: string;
  mediaId: string;
  provenance?: MediaProvenance | null;
  preferredQualities?: string[];
  heading?: string;
}

export function SourcesPanel({
  profileId,
  contentType,
  videoId,
  mediaId,
  provenance,
  preferredQualities = [],
  heading = "Sources",
}: SourcesPanelProps) {
  const streamsQuery = useStreamsQuery(profileId, contentType, videoId);
  const navigateToSource = useSourceNavigation(contentType, videoId, mediaId, provenance);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const groups = useMemo(
    () => groupAndSortSources(streamsQuery.data?.streams ?? [], preferredQualities),
    [preferredQualities, streamsQuery.data?.streams],
  );

  const allSources = useMemo(() => groups.flatMap((group) => group.sources), [groups]);

  const selectedSource = useMemo(
    () => allSources.find((source) => source.id === selectedSourceId) ?? null,
    [allSources, selectedSourceId],
  );

  useEffect(() => {
    if (selectedSourceId || allSources.length === 0) {
      return;
    }
    const preferredInstallationId = provenance?.installationId;
    const defaultSource =
      selectPlayableSource(
        streamsQuery.data?.streams ?? [],
        preferredQualities,
        preferredInstallationId,
      ) ?? allSources[0];
    if (defaultSource) {
      setSelectedSourceId(defaultSource.id);
    }
  }, [
    allSources,
    preferredQualities,
    provenance?.installationId,
    selectedSourceId,
    streamsQuery.data?.streams,
  ]);

  const handleSelect = (source: ProcessedSource) => {
    if (source.disabled) {
      return;
    }
    setSelectedSourceId(source.id);
  };

  const handlePlay = () => {
    if (!selectedSource || selectedSource.disabled) {
      return;
    }
    navigateToSource(selectedSource);
  };

  return (
    <section aria-labelledby="sources-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sources-heading" className="text-xl font-semibold">
          {heading}
        </h2>
        <Button
          type="button"
          onClick={handlePlay}
          disabled={!selectedSource || selectedSource.disabled || streamsQuery.isLoading}
        >
          {streamsQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          Play selected source
        </Button>
      </div>

      {streamsQuery.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : null}

      {streamsQuery.isError ? (
        <QueryErrorState
          title="Could not load sources"
          message={streamsQuery.error instanceof Error ? streamsQuery.error.message : undefined}
        />
      ) : null}

      {!streamsQuery.isLoading && !streamsQuery.isError ? (
        <SourcesList groups={groups} selectedSourceId={selectedSourceId} onSelect={handleSelect} />
      ) : null}

      {streamsQuery.data?.warnings.length ? (
        <AddonWarnings warnings={streamsQuery.data.warnings} />
      ) : null}
    </section>
  );
}
