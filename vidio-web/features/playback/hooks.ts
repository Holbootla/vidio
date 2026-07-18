"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { PlaybackProgress, ProgressRequest } from "@/lib/api/schemas";
import { buildMediaKey } from "@/lib/media/keys";
import { fetchStreams, fetchSubtitles, putProgress } from "@/features/playback/api";
import {
  offlinePlaybackProgress,
  queueProgress,
  shouldUseOfflineQueue,
} from "@/lib/sync/offlineMutations";

export function useStreamsQuery(
  profileId: string | null,
  contentType: string,
  videoId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.streams(profileId ?? "", contentType, videoId),
    queryFn: () => fetchStreams(profileId!, contentType, videoId),
    enabled: Boolean(profileId && contentType && videoId && enabled),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}

export function useSubtitlesQuery(
  profileId: string | null,
  contentType: string,
  id: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.subtitles(profileId ?? "", contentType, id),
    queryFn: () => fetchSubtitles(profileId!, contentType, id),
    enabled: Boolean(profileId && contentType && id && enabled),
    staleTime: 60_000,
  });
}

function upsertContinueWatching(
  entries: PlaybackProgress[] | undefined,
  progress: PlaybackProgress,
): PlaybackProgress[] {
  const current = entries ?? [];
  const without = current.filter((entry) => entry.video_key !== progress.video_key);
  if (progress.watched) {
    return without;
  }
  const next = [progress, ...without];
  return next.slice(0, 50);
}

export function useProgressMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProgressRequest) => {
      if (!profileId) {
        throw new Error("Profile is required");
      }
      if (shouldUseOfflineQueue()) {
        await queueProgress(profileId, payload);
        const cwKey = queryKeys.continueWatching(profileId);
        const previous = queryClient.getQueryData<PlaybackProgress[]>(cwKey)?.find((entry) => {
          const keyResult = buildMediaKey(
            payload.content_type,
            payload.manifest_id,
            payload.video_id,
          );
          return keyResult.ok && entry.video_key === keyResult.key;
        });
        const progress = offlinePlaybackProgress(profileId, payload, previous);
        if (!progress) {
          throw new Error("Unable to build progress entry");
        }
        return progress;
      }
      return putProgress(profileId, payload);
    },
    onSuccess: (progress) => {
      if (!profileId) {
        return;
      }
      const key = queryKeys.continueWatching(profileId);
      queryClient.setQueryData<PlaybackProgress[]>(key, (current) =>
        upsertContinueWatching(current, progress),
      );
    },
    onSettled: () => {
      if (!profileId || shouldUseOfflineQueue()) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.continueWatching(profileId) });
    },
  });
}

export function buildProgressRequest(input: {
  contentType: string;
  videoId: string;
  mediaId: string;
  manifestId: string;
  positionSecs: number;
  durationSecs: number;
  watched?: boolean;
}): ProgressRequest | null {
  const manifestId = input.manifestId.trim();
  if (!manifestId) {
    return null;
  }

  const keyResult = buildMediaKey(input.contentType, manifestId, input.videoId);
  if (!keyResult.ok) {
    return null;
  }

  return {
    content_type: input.contentType,
    video_id: input.videoId,
    media_id: input.mediaId,
    manifest_id: manifestId,
    position_secs: input.positionSecs,
    duration_secs: input.durationSecs,
    watched: input.watched,
  };
}
