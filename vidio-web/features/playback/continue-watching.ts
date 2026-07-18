"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { LibraryEntry, Meta, PlaybackProgress } from "@/lib/api/schemas";
import { buildDetailHref } from "@/lib/media/provenance";
import { manifestIdFromParsedKey, parseMediaKey, parseVideoKey } from "@/lib/media/parse-keys";
import { buildWatchHref } from "@/lib/player/watch-href";

export interface EnrichedContinueWatchingItem {
  progress: PlaybackProgress;
  title: string;
  poster?: string;
  contentType: string;
  videoId: string;
  mediaId: string;
  manifestId: string;
  watchHref: string;
  detailHref: string;
  progressLabel: string;
}

function parseMetaSnapshot(snapshot: string | null | undefined): Partial<Meta> | null {
  if (!snapshot) {
    return null;
  }
  try {
    return JSON.parse(snapshot) as Partial<Meta>;
  } catch {
    return null;
  }
}

function progressLabel(entry: PlaybackProgress): string {
  if (entry.watched) {
    return "Finished";
  }
  if (entry.position_secs > 0 && entry.duration_secs > 0) {
    const pct = Math.round((entry.position_secs / entry.duration_secs) * 100);
    return `Resume at ${pct}%`;
  }
  return "Resume";
}

export function enrichContinueWatchingItem(
  entry: PlaybackProgress,
  library: LibraryEntry[] | undefined,
  metaFromCache: Meta | null,
): EnrichedContinueWatchingItem | null {
  const videoParsed = parseVideoKey(entry.video_key);
  const mediaParsed = parseMediaKey(entry.media_key);
  if (!videoParsed || !mediaParsed) {
    return null;
  }

  const manifestId = manifestIdFromParsedKey(mediaParsed);
  const libraryEntry = library?.find((item) => item.media_key === entry.media_key);
  const snapshotMeta = parseMetaSnapshot(libraryEntry?.meta_snapshot);
  const title =
    libraryEntry?.name || metaFromCache?.name || snapshotMeta?.name || mediaParsed.mediaId;
  const poster = libraryEntry?.poster || metaFromCache?.poster || snapshotMeta?.poster || undefined;

  const watchHref = buildWatchHref(videoParsed.contentType, videoParsed.videoId, {
    mediaId: mediaParsed.mediaId,
    manifestId,
  });
  const detailHref = buildDetailHref(videoParsed.contentType, mediaParsed.mediaId, {
    manifestId,
  });

  return {
    progress: entry,
    title,
    poster,
    contentType: videoParsed.contentType,
    videoId: videoParsed.videoId,
    mediaId: mediaParsed.mediaId,
    manifestId,
    watchHref,
    detailHref,
    progressLabel: progressLabel(entry),
  };
}

export function useEnrichedContinueWatching(
  profileId: string | null,
  entries: PlaybackProgress[] | undefined,
  library: LibraryEntry[] | undefined,
): EnrichedContinueWatchingItem[] {
  const queryClient = useQueryClient();

  return useMemo(() => {
    if (!entries?.length) {
      return [];
    }

    return entries
      .map((entry) => {
        const mediaParsed = parseMediaKey(entry.media_key);
        const metaFromCache =
          profileId && mediaParsed
            ? (queryClient.getQueryData<Meta>(
                queryKeys.meta(profileId, mediaParsed.contentType, mediaParsed.mediaId),
              ) ?? null)
            : null;
        return enrichContinueWatchingItem(entry, library, metaFromCache);
      })
      .filter((item): item is EnrichedContinueWatchingItem => item !== null);
  }, [entries, library, profileId, queryClient]);
}
