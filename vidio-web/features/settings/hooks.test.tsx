import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesQuery, useUpdatePreferencesMutation } from "@/features/settings/hooks";
import { queryKeys } from "@/lib/api/query-keys";
import { defaultPreferences, PROFILE_ID } from "@/test/fixtures/settings";
import { useAuthStore } from "@/lib/auth/store";

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("settings hooks", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: "access-token",
      accessExpiresAt: "2026-12-31T23:59:59Z",
      profile: {
        id: PROFILE_ID,
        user_id: "11111111-1111-7111-8111-111111111111",
        name: "Main",
        is_default: true,
        preferences: defaultPreferences,
        version: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      isBootstrapped: true,
    });
  });

  it("loads preferences via MSW", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => usePreferencesQuery(PROFILE_ID), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(defaultPreferences);
  });

  it("invalidates stream queries when hide_p2p_streams changes", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePreferencesMutation(PROFILE_ID), {
      wrapper: createWrapper(client),
    });

    result.current.mutate({
      ...defaultPreferences,
      hide_p2p_streams: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });
    expect(client.getQueryData(queryKeys.preferences(PROFILE_ID))).toEqual({
      ...defaultPreferences,
      hide_p2p_streams: true,
    });
  });
});
