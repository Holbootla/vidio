"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProfilePreferences } from "@/lib/api/schemas";
import { useAuthStore } from "@/lib/auth/store";
import { fetchPreferences, updatePreferences } from "@/features/settings/api";
import {
  offlineProfileAfterPreferences,
  queuePreferences,
  shouldUseOfflineQueue,
} from "@/lib/sync/offlineMutations";

function invalidateStreamQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  profileId: string,
) {
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "streams" &&
      query.queryKey[1] === profileId,
  });
}

function invalidateDiscovery(queryClient: ReturnType<typeof useQueryClient>, profileId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.home(profileId) });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "search" &&
      query.queryKey[1] === profileId,
  });
}

export function usePreferencesQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.preferences(profileId ?? ""),
    queryFn: () => fetchPreferences(profileId!),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });
}

export function useUpdatePreferencesMutation(profileId: string | null) {
  const queryClient = useQueryClient();
  const setProfile = useAuthStore((state) => state.setProfile);
  const previousHideP2p = useAuthStore((state) => state.profile?.preferences.hide_p2p_streams);

  return useMutation({
    mutationFn: async (preferences: ProfilePreferences) => {
      if (!profileId) {
        throw new Error("Profile is required");
      }
      if (shouldUseOfflineQueue()) {
        await queuePreferences(profileId, preferences);
        const profile = useAuthStore.getState().profile;
        if (!profile) {
          throw new Error("Profile is required");
        }
        return offlineProfileAfterPreferences(profile, preferences);
      }
      return updatePreferences(profileId, preferences);
    },
    onSuccess: (profile, preferences) => {
      if (!profileId) {
        return;
      }
      setProfile(profile);
      queryClient.setQueryData(queryKeys.preferences(profileId), preferences);
      invalidateDiscovery(queryClient, profileId);
      if (previousHideP2p !== preferences.hide_p2p_streams) {
        invalidateStreamQueries(queryClient, profileId);
      }
    },
  });
}
