import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAddToLibraryMutation } from "@/features/library/hooks";
import { useProgressMutation } from "@/features/playback/hooks";
import { useUpdatePreferencesMutation } from "@/features/settings/hooks";
import { useAuthStore } from "@/lib/auth/store";
import { countQueuedMutations } from "@/lib/sync/offlineQueue";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { defaultPreferences } from "@/test/fixtures/settings";
import { server } from "@/test/server";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("offline integrated mutations", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.restoreAllMocks();
  });

  it("queues library add offline and preserves optimistic cache", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const fetchSpy = vi.fn();
    server.use(
      http.get(`${profileBase}/library`, () => {
        fetchSpy();
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useAddToLibraryMutation(PROFILE_ID), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({
      content_type: "movie",
      content_id: "tt1254207",
      manifest_id: "org.stremio.cinemeta",
      name: "Big Buck Bunny",
    });

    await waitFor(async () => {
      expect(await countQueuedMutations(PROFILE_ID)).toBe(1);
    });
    expect(client.getQueryData(["library", PROFILE_ID])).toEqual([
      expect.objectContaining({ name: "Big Buck Bunny", removed: false }),
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("queues progress offline and updates continue watching cache", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useProgressMutation(PROFILE_ID), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({
      content_type: "movie",
      video_id: "tt1254207",
      media_id: "tt1254207",
      manifest_id: "org.stremio.cinemeta",
      position_secs: 120,
      duration_secs: 3600,
    });

    await waitFor(async () => {
      expect(await countQueuedMutations(PROFILE_ID)).toBe(1);
    });
    expect(client.getQueryData(["continueWatching", PROFILE_ID])).toEqual([
      expect.objectContaining({ position_secs: 120 }),
    ]);
  });

  it("queues preferences offline without network PUT", async () => {
    useAuthStore.getState().setSession({
      access_token: "token",
      access_expires_at: "2026-12-31T23:59:59Z",
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
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const putSpy = vi.fn();
    server.use(
      http.put(`${profileBase}/preferences`, () => {
        putSpy();
        return HttpResponse.json({});
      }),
    );

    const { result } = renderHook(() => useUpdatePreferencesMutation(PROFILE_ID), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({ ...defaultPreferences, locale: "es-ES" });

    await waitFor(async () => {
      expect(await countQueuedMutations(PROFILE_ID)).toBe(1);
    });
    expect(putSpy).not.toHaveBeenCalled();
    expect(client.getQueryData(["preferences", PROFILE_ID])).toEqual(
      expect.objectContaining({ locale: "es-ES" }),
    );
  });
});
