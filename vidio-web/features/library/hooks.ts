"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { addLibraryItem, fetchLibrary, removeLibraryItem } from "@/features/library/api";
import type { AddLibraryRequest, LibraryEntry } from "@/lib/api/schemas";
import { buildMediaKey } from "@/lib/media/keys";

export function useLibraryQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.library(profileId ?? ""),
    queryFn: () => fetchLibrary(profileId!),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
}

function optimisticEntry(profileId: string, request: AddLibraryRequest): LibraryEntry | null {
  const keyResult = buildMediaKey(request.content_type, request.manifest_id, request.content_id);
  if (!keyResult.ok) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    profile_id: profileId,
    media_key: keyResult.key,
    media_type: request.content_type,
    name: request.name,
    poster: request.poster ?? null,
    meta_snapshot: request.meta_snapshot ?? null,
    removed: false,
    added_at: now,
    updated_at: now,
  };
}

export function useAddToLibraryMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddLibraryRequest) => addLibraryItem(profileId!, payload),
    onMutate: async (payload) => {
      if (!profileId) {
        return;
      }
      const key = queryKeys.library(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LibraryEntry[]>(key);
      const entry = optimisticEntry(profileId, payload);
      if (entry) {
        queryClient.setQueryData<LibraryEntry[]>(key, (current = []) => {
          const without = current.filter((item) => item.media_key !== entry.media_key);
          return [...without, entry];
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (!profileId || !context?.previous) {
        return;
      }
      queryClient.setQueryData(queryKeys.library(profileId), context.previous);
    },
    onSettled: () => {
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.library(profileId) });
      }
    },
  });
}

export function useRemoveFromLibraryMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaKey: string) => removeLibraryItem(profileId!, mediaKey),
    onMutate: async (mediaKey) => {
      if (!profileId) {
        return;
      }
      const key = queryKeys.library(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LibraryEntry[]>(key);
      queryClient.setQueryData<LibraryEntry[]>(key, (current = []) =>
        current.filter((item) => item.media_key !== mediaKey),
      );
      return { previous };
    },
    onError: (_error, _mediaKey, context) => {
      if (!profileId || !context?.previous) {
        return;
      }
      queryClient.setQueryData(queryKeys.library(profileId), context.previous);
    },
    onSettled: () => {
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.library(profileId) });
      }
    },
  });
}

export function isInLibrary(entries: LibraryEntry[] | undefined, mediaKey: string | null): boolean {
  if (!entries || !mediaKey) {
    return false;
  }
  return entries.some((entry) => entry.media_key === mediaKey && !entry.removed);
}
