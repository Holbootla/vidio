"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { addLibraryItem, fetchLibrary, removeLibraryItem } from "@/features/library/api";
import type { AddLibraryRequest, LibraryEntry } from "@/lib/api/schemas";
import { buildMediaKey } from "@/lib/media/keys";
import {
  offlineLibraryEntry,
  queueLibraryAdd,
  queueLibraryRemove,
  shouldUseOfflineQueue,
} from "@/lib/sync/offlineMutations";

export function useLibraryQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.library(profileId ?? ""),
    queryFn: () => fetchLibrary(profileId!),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
}

function optimisticEntry(profileId: string, request: AddLibraryRequest): LibraryEntry | null {
  return offlineLibraryEntry(profileId, request);
}

export function useAddToLibraryMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddLibraryRequest) => {
      if (!profileId) {
        throw new Error("Profile is required");
      }
      if (shouldUseOfflineQueue()) {
        await queueLibraryAdd(profileId, payload);
        const entry = offlineLibraryEntry(profileId, payload);
        if (!entry) {
          throw new Error("Unable to build library entry");
        }
        return entry;
      }
      return addLibraryItem(profileId, payload);
    },
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
    onSettled: (_data, _error, _payload) => {
      if (!profileId || shouldUseOfflineQueue()) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.library(profileId) });
    },
  });
}

export function useRemoveFromLibraryMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaKey: string) => {
      if (!profileId) {
        throw new Error("Profile is required");
      }
      if (shouldUseOfflineQueue()) {
        await queueLibraryRemove(profileId, mediaKey);
        return;
      }
      return removeLibraryItem(profileId, mediaKey);
    },
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
      if (!profileId || shouldUseOfflineQueue()) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.library(profileId) });
    },
  });
}

export function isInLibrary(entries: LibraryEntry[] | undefined, mediaKey: string | null): boolean {
  if (!entries || !mediaKey) {
    return false;
  }
  return entries.some((entry) => entry.media_key === mediaKey && !entry.removed);
}

export function libraryMediaKeyFromRequest(request: AddLibraryRequest): string | null {
  const keyResult = buildMediaKey(request.content_type, request.manifest_id, request.content_id);
  return keyResult.ok ? keyResult.key : null;
}
