"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { AddonDto } from "@/lib/api/schemas";
import {
  fetchAddons,
  installAddon,
  patchAddon,
  refreshAddon,
  removeAddon,
  reorderAddons,
  sortAddonsByPriority,
  type InstallAddonRequest,
  type ReorderAddonsRequest,
} from "@/features/addons/api";

function invalidateDiscovery(queryClient: ReturnType<typeof useQueryClient>, profileId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.addons(profileId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.home(profileId) });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "search" &&
      query.queryKey[1] === profileId,
  });
}

export function useAddonsQuery(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.addons(profileId ?? ""),
    queryFn: () => fetchAddons(profileId!),
    enabled: Boolean(profileId),
    staleTime: 30_000,
    select: sortAddonsByPriority,
  });
}

export function useInstallAddonMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InstallAddonRequest) => installAddon(profileId!, payload),
    onSuccess: () => {
      if (profileId) {
        invalidateDiscovery(queryClient, profileId);
      }
    },
  });
}

export function useToggleAddonMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installationId, enabled }: { installationId: string; enabled: boolean }) =>
      patchAddon(profileId!, installationId, { enabled }),
    onMutate: async ({ installationId, enabled }) => {
      if (!profileId) {
        return;
      }
      const key = queryKeys.addons(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AddonDto[]>(key);
      queryClient.setQueryData<AddonDto[]>(key, (current = []) =>
        current.map((addon) => (addon.id === installationId ? { ...addon, enabled } : addon)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!profileId || !context?.previous) {
        return;
      }
      queryClient.setQueryData(queryKeys.addons(profileId), context.previous);
    },
    onSettled: () => {
      if (profileId) {
        invalidateDiscovery(queryClient, profileId);
      }
    },
  });
}

export function useRefreshAddonMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (installationId: string) => refreshAddon(profileId!, installationId),
    onSuccess: (updated) => {
      if (!profileId) {
        return;
      }
      queryClient.setQueryData<AddonDto[]>(queryKeys.addons(profileId), (current = []) =>
        current.map((addon) => (addon.id === updated.id ? updated : addon)),
      );
      invalidateDiscovery(queryClient, profileId);
    },
  });
}

export function useRemoveAddonMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (installationId: string) => removeAddon(profileId!, installationId),
    onMutate: async (installationId) => {
      if (!profileId) {
        return;
      }
      const key = queryKeys.addons(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AddonDto[]>(key);
      queryClient.setQueryData<AddonDto[]>(key, (current = []) =>
        current.filter((addon) => addon.id !== installationId),
      );
      return { previous };
    },
    onError: (_error, _installationId, context) => {
      if (!profileId || !context?.previous) {
        return;
      }
      queryClient.setQueryData(queryKeys.addons(profileId), context.previous);
    },
    onSettled: () => {
      if (profileId) {
        invalidateDiscovery(queryClient, profileId);
      }
    },
  });
}

export function useReorderAddonsMutation(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReorderAddonsRequest) => reorderAddons(profileId!, payload),
    onMutate: async (payload) => {
      if (!profileId) {
        return;
      }
      const key = queryKeys.addons(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AddonDto[]>(key);
      const byId = new Map((previous ?? []).map((addon) => [addon.id, addon]));
      const reordered = payload.order
        .map((id, index) => {
          const addon = byId.get(id);
          return addon ? { ...addon, priority: index } : null;
        })
        .filter((addon): addon is AddonDto => addon !== null);
      queryClient.setQueryData<AddonDto[]>(key, reordered);
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (!profileId || !context?.previous) {
        return;
      }
      queryClient.setQueryData(queryKeys.addons(profileId), context.previous);
    },
    onSettled: () => {
      if (profileId) {
        invalidateDiscovery(queryClient, profileId);
      }
    },
  });
}

export function buildReorderPayload(addons: AddonDto[]): ReorderAddonsRequest {
  return { order: addons.map((addon) => addon.id) };
}
