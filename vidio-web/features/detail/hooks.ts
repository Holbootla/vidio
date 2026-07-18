"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { fetchMeta } from "@/features/library/api";

export function useMetaQuery(profileId: string | null, contentType: string, id: string) {
  return useQuery({
    queryKey: queryKeys.meta(profileId ?? "", contentType, id),
    queryFn: () => fetchMeta(profileId!, contentType, id),
    enabled: Boolean(profileId && contentType && id),
    staleTime: 10 * 60_000,
  });
}
