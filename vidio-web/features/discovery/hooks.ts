"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import {
  fetchAddons,
  fetchContinueWatching,
  fetchHome,
  fetchSearch,
} from "@/features/discovery/api";

export function useAddonsQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.addons(profileId ?? ""),
    queryFn: () => fetchAddons(profileId!),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });
}

export function useHomeQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.home(profileId ?? ""),
    queryFn: () => fetchHome(profileId!),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });
}

export function useSearchQuery(profileId: string | null, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(profileId ?? "", trimmed),
    queryFn: () => fetchSearch(profileId!, trimmed),
    enabled: Boolean(profileId) && trimmed.length > 0,
    staleTime: 30_000,
  });
}

export function useContinueWatchingQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.continueWatching(profileId ?? ""),
    queryFn: () => fetchContinueWatching(profileId!),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
}
