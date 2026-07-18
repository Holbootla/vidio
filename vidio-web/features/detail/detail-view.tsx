"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/ui/query-status";
import { Skeleton } from "@/components/ui/skeleton";
import { EpisodePicker } from "@/features/detail/episode-picker";
import { useMetaQuery } from "@/features/detail/hooks";
import { MetaHero } from "@/features/detail/meta-hero";
import { SourcesPanel } from "@/features/playback/sources-panel";
import { buildLibraryRequest } from "@/features/library/build-request";
import {
  isInLibrary,
  useAddToLibraryMutation,
  useLibraryQuery,
  useRemoveFromLibraryMutation,
} from "@/features/library/hooks";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { buildMediaKey, resolveManifestIdForLibrary } from "@/lib/media/keys";
import { parseProvenanceFromSearchParams } from "@/lib/media/provenance";
import type { Video } from "@/lib/api/schemas";

interface DetailViewProps {
  profileId: string;
  contentType: string;
  id: string;
  searchParams: Record<string, string | string[] | undefined>;
}

export function DetailView({ profileId, contentType, id, searchParams }: DetailViewProps) {
  const { profile } = useProfileContext();
  const provenance = parseProvenanceFromSearchParams(searchParams);
  const metaQuery = useMetaQuery(profileId, contentType, id);
  const libraryQuery = useLibraryQuery(profileId);
  const addMutation = useAddToLibraryMutation(profileId);
  const removeMutation = useRemoveFromLibraryMutation(profileId);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Video | null>(null);

  const mediaKey = useMemo(() => {
    if (!metaQuery.data) {
      return null;
    }
    const manifestResult = resolveManifestIdForLibrary(metaQuery.data.id, provenance?.manifestId);
    if (!manifestResult.ok) {
      return null;
    }
    const keyResult = buildMediaKey(
      metaQuery.data.type,
      manifestResult.manifestId,
      metaQuery.data.id,
    );
    return keyResult.ok ? keyResult.key : null;
  }, [metaQuery.data, provenance?.manifestId]);

  const inLibrary = isInLibrary(libraryQuery.data, mediaKey);
  const libraryRequestResult = useMemo(() => {
    if (!metaQuery.data) {
      return null;
    }
    return buildLibraryRequest(metaQuery.data, provenance);
  }, [metaQuery.data, provenance]);

  const libraryBlockedReason =
    libraryRequestResult && !libraryRequestResult.ok ? libraryRequestResult.reason : null;

  const activeVideoId = useMemo(() => {
    if (metaQuery.data?.videos.length) {
      return selectedEpisode?.id ?? metaQuery.data.videos[0]?.id ?? metaQuery.data.id;
    }
    return metaQuery.data?.id ?? id;
  }, [id, metaQuery.data, selectedEpisode?.id]);

  useEffect(() => {
    if (addMutation.isError) {
      setStatusMessage("Could not add to library. Changes were rolled back.");
    } else if (removeMutation.isError) {
      setStatusMessage("Could not remove from library. Changes were rolled back.");
    } else if (addMutation.isSuccess) {
      setStatusMessage("Added to your library.");
    } else if (removeMutation.isSuccess) {
      setStatusMessage("Removed from your library.");
    }
  }, [
    addMutation.isError,
    addMutation.isSuccess,
    removeMutation.isError,
    removeMutation.isSuccess,
  ]);

  const toggleLibrary = () => {
    if (!metaQuery.data) {
      return;
    }
    const requestResult = libraryRequestResult;
    if (!requestResult || !requestResult.ok) {
      setStatusMessage(requestResult?.reason ?? "Unable to update library.");
      return;
    }
    if (inLibrary && mediaKey) {
      removeMutation.mutate(mediaKey);
      return;
    }
    addMutation.mutate(requestResult.request);
  };

  const pending = addMutation.isPending || removeMutation.isPending;

  return (
    <div className="space-y-8">
      {metaQuery.isLoading ? (
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : null}

      {metaQuery.isError ? (
        <QueryErrorState
          title="Could not load details"
          message={metaQuery.error instanceof Error ? metaQuery.error.message : undefined}
        />
      ) : null}

      {metaQuery.data ? (
        <>
          <MetaHero meta={metaQuery.data} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={toggleLibrary}
              disabled={pending || Boolean(libraryBlockedReason)}
              aria-pressed={inLibrary}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : inLibrary ? (
                <BookmarkCheck className="h-4 w-4" aria-hidden />
              ) : (
                <Bookmark className="h-4 w-4" aria-hidden />
              )}
              {inLibrary ? "In library" : "Add to library"}
            </Button>
            {libraryBlockedReason ? (
              <p className="text-sm text-muted-foreground">{libraryBlockedReason}</p>
            ) : null}
          </div>
          {statusMessage ? (
            <p className="text-sm" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
          {metaQuery.data.videos.length > 0 ? (
            <EpisodePicker
              videos={metaQuery.data.videos}
              selectedId={selectedEpisode?.id}
              onSelect={setSelectedEpisode}
              contentType={metaQuery.data.type}
              mediaId={metaQuery.data.id}
              provenance={provenance}
              preferredQualities={profile?.preferences.preferred_qualities}
            />
          ) : (
            <SourcesPanel
              profileId={profileId}
              contentType={metaQuery.data.type}
              videoId={activeVideoId}
              mediaId={metaQuery.data.id}
              provenance={provenance}
              preferredQualities={profile?.preferences.preferred_qualities}
            />
          )}
          {metaQuery.data.videos.length > 0 ? (
            <SourcesPanel
              profileId={profileId}
              contentType={metaQuery.data.type}
              videoId={activeVideoId}
              mediaId={metaQuery.data.id}
              provenance={provenance}
              preferredQualities={profile?.preferences.preferred_qualities}
              heading="Episode sources"
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
