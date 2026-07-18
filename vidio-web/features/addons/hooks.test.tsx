import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReorderPayload,
  useAddonsQuery,
  useRemoveAddonMutation,
  useReorderAddonsMutation,
  useToggleAddonMutation,
} from "@/features/addons/hooks";
import { queryKeys } from "@/lib/api/query-keys";
import { INSTALLATION_ID_2, PROFILE_ID, addonListFixture } from "@/test/fixtures/settings";
import { server } from "@/test/server";
import { useAuthStore } from "@/lib/auth/store";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

function createWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("addon hooks", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: "access-token",
      accessExpiresAt: "2026-12-31T23:59:59Z",
      profile: null,
      isBootstrapped: true,
    });
  });

  it("builds reorder payload from addon list order", () => {
    const payload = buildReorderPayload(addonListFixture as never);
    expect(payload.order).toEqual(["33333333-3333-7333-8333-333333333333", INSTALLATION_ID_2]);
  });

  it("rolls back optimistic toggle on failure", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(queryKeys.addons(PROFILE_ID), addonListFixture);

    server.use(
      http.patch(`${profileBase}/addons/:installationId`, () =>
        HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
            detail: "toggle failed",
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useToggleAddonMutation(PROFILE_ID), {
      wrapper: createWrapper(client),
    });

    result.current.mutate({
      installationId: "33333333-3333-7333-8333-333333333333",
      enabled: false,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(queryKeys.addons(PROFILE_ID))).toEqual(addonListFixture);
  });

  it("rolls back optimistic reorder on failure", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(queryKeys.addons(PROFILE_ID), addonListFixture);

    server.use(
      http.post(`${profileBase}/addons/reorder`, () =>
        HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
            detail: "reorder failed",
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useReorderAddonsMutation(PROFILE_ID), {
      wrapper: createWrapper(client),
    });

    result.current.mutate({
      order: [INSTALLATION_ID_2, "33333333-3333-7333-8333-333333333333"],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(queryKeys.addons(PROFILE_ID))).toEqual(addonListFixture);
  });

  it("invalidates home after remove", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(
      () => ({
        addons: useAddonsQuery(PROFILE_ID),
        remove: useRemoveAddonMutation(PROFILE_ID),
      }),
      { wrapper: createWrapper(client) },
    );

    await waitFor(() => expect(result.current.addons.isSuccess).toBe(true));

    result.current.remove.mutate(INSTALLATION_ID_2);
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.home(PROFILE_ID) });
  });
});
