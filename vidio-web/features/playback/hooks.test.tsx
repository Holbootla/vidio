import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildProgressRequest,
  useProgressMutation,
  useStreamsQuery,
} from "@/features/playback/hooks";
import { fetchStreams } from "@/features/playback/api";
import { streamResolutionFixture } from "@/test/fixtures/playback";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { useAuthStore } from "@/lib/auth/store";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("playback hooks and api", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: "access-token",
      accessExpiresAt: "2026-12-31T23:59:59Z",
      profile: null,
      isBootstrapped: true,
    });
  });
  it("fetches streams via MSW", async () => {
    const data = await fetchStreams(PROFILE_ID, "movie", "tt1254207");
    expect(data.streams).toHaveLength(streamResolutionFixture.streams.length);
    expect(data.streams[0]?.kind).toBe("url");
  });

  it("builds valid progress payloads", () => {
    const payload = buildProgressRequest({
      contentType: "movie",
      videoId: "tt1254207",
      mediaId: "tt1254207",
      manifestId: "org.stremio.cinemeta",
      positionSecs: 120,
      durationSecs: 3600,
    });
    expect(payload).toEqual({
      content_type: "movie",
      video_id: "tt1254207",
      media_id: "tt1254207",
      manifest_id: "org.stremio.cinemeta",
      position_secs: 120,
      duration_secs: 3600,
      watched: undefined,
    });
  });

  it("updates continue watching optimistically after progress mutation", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useProgressMutation(PROFILE_ID), { wrapper });
    result.current.mutate({
      content_type: "movie",
      video_id: "tt1254207",
      media_id: "tt1254207",
      manifest_id: "org.stremio.cinemeta",
      position_secs: 900,
      duration_secs: 3600,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = client.getQueryData(["continueWatching", PROFILE_ID]);
    expect(Array.isArray(cached)).toBe(true);
    expect((cached as Array<{ position_secs: number }>)[0]?.position_secs).toBe(900);
  });

  it("removes watched progress from continue watching", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(["continueWatching", PROFILE_ID], [
      {
        profile_id: PROFILE_ID,
        video_key: "movie:imdb:tt1254207",
        media_key: "movie:imdb:tt1254207",
        position_secs: 900,
        duration_secs: 3600,
        watched: false,
        revision: 1,
        last_device_id: null,
        updated_at: "2026-01-03T00:00:00Z",
      },
    ]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useProgressMutation(PROFILE_ID), { wrapper });
    result.current.mutate({
      content_type: "movie",
      video_id: "tt1254207",
      media_id: "tt1254207",
      manifest_id: "org.stremio.cinemeta",
      position_secs: 3600,
      duration_secs: 3600,
      watched: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(["continueWatching", PROFILE_ID])).toEqual([]);
  });

  it("uses uncached stream query options", async () => {
    const { result } = renderHook(() => useStreamsQuery(PROFILE_ID, "movie", "tt1254207"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.streams.length).toBeGreaterThan(0);
  });
});
