import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { flushOfflineQueue, isPermanentFlushError, isRetryableFlushError } from "@/lib/sync/flush";
import { enqueueOfflineMutation } from "@/lib/sync/offlineQueue";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { server } from "@/test/server";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

describe("flushOfflineQueue", () => {
  it("flushes queued mutations in order", async () => {
    const order: string[] = [];
    server.use(
      http.post(`${profileBase}/library`, async () => {
        order.push("add");
        return HttpResponse.json(
          {
            profile_id: PROFILE_ID,
            media_key: "movie:imdb:tt1254207",
            media_type: "movie",
            name: "Big Buck Bunny",
            removed: false,
            added_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
          { status: 201 },
        );
      }),
      http.put(`${profileBase}/progress`, async () => {
        order.push("progress");
        return HttpResponse.json({
          profile_id: PROFILE_ID,
          video_key: "movie:imdb:tt1254207",
          media_key: "movie:imdb:tt1254207",
          position_secs: 10,
          duration_secs: 100,
          watched: false,
          revision: 1,
          updated_at: "2026-01-03T00:00:00Z",
        });
      }),
    );

    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_add",
      body: {
        content_type: "movie",
        content_id: "tt1254207",
        manifest_id: "org.stremio.cinemeta",
        name: "Big Buck Bunny",
      },
    });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "progress",
      body: {
        content_type: "movie",
        video_id: "tt1254207",
        media_id: "tt1254207",
        manifest_id: "org.stremio.cinemeta",
        position_secs: 10,
        duration_secs: 100,
      },
    });

    const result = await flushOfflineQueue(PROFILE_ID);
    expect(result.flushed).toBe(2);
    expect(result.halted).toBe(false);
    expect(order).toEqual(["add", "progress"]);
  });

  it("halts on retryable failures", async () => {
    server.use(
      http.post(`${profileBase}/library`, () =>
        HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
            detail: "temporary",
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
      http.put(`${profileBase}/progress`, () =>
        HttpResponse.json({
          profile_id: PROFILE_ID,
          video_key: "movie:imdb:tt2",
          media_key: "movie:imdb:tt2",
          position_secs: 1,
          duration_secs: 10,
          watched: false,
          revision: 1,
          updated_at: "2026-01-03T00:00:00Z",
        }),
      ),
    );

    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_add",
      body: {
        content_type: "movie",
        content_id: "tt1",
        manifest_id: "org.stremio.cinemeta",
        name: "One",
      },
    });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "progress",
      body: {
        content_type: "movie",
        video_id: "tt2",
        media_id: "tt2",
        manifest_id: "org.stremio.cinemeta",
        position_secs: 1,
        duration_secs: 10,
      },
    });

    const result = await flushOfflineQueue(PROFILE_ID);
    expect(result.flushed).toBe(0);
    expect(result.halted).toBe(true);
  });

  it("discards permanent RFC errors and continues", async () => {
    server.use(
      http.post(`${profileBase}/library`, () =>
        HttpResponse.json(
          {
            type: "/errors/validation",
            title: "Validation failed",
            status: 422,
            detail: "invalid",
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
      http.put(`${profileBase}/progress`, () =>
        HttpResponse.json({
          profile_id: PROFILE_ID,
          video_key: "movie:imdb:tt2",
          media_key: "movie:imdb:tt2",
          position_secs: 1,
          duration_secs: 10,
          watched: false,
          revision: 1,
          updated_at: "2026-01-03T00:00:00Z",
        }),
      ),
    );

    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_add",
      body: {
        content_type: "movie",
        content_id: "tt1",
        manifest_id: "org.stremio.cinemeta",
        name: "One",
      },
    });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "progress",
      body: {
        content_type: "movie",
        video_id: "tt2",
        media_id: "tt2",
        manifest_id: "org.stremio.cinemeta",
        position_secs: 1,
        duration_secs: 10,
      },
    });

    const result = await flushOfflineQueue(PROFILE_ID);
    expect(result.discarded).toHaveLength(1);
    expect(result.flushed).toBe(1);
    expect(result.halted).toBe(false);
  });
});

describe("flush error classification", () => {
  it("classifies permanent and retryable RFC errors", () => {
    expect(
      isPermanentFlushError(new ApiError({ type: "/errors/validation", title: "x", status: 422 })),
    ).toBe(true);
    expect(
      isPermanentFlushError(
        new ApiError({ type: "/errors/unauthorized", title: "x", status: 401 }),
      ),
    ).toBe(false);
    expect(
      isPermanentFlushError(new ApiError({ type: "/errors/forbidden", title: "x", status: 403 })),
    ).toBe(false);
    expect(
      isPermanentFlushError(new ApiError({ type: "/errors/internal", title: "x", status: 500 })),
    ).toBe(false);
    expect(
      isRetryableFlushError(
        new ApiError({ type: "/errors/unauthorized", title: "x", status: 401 }),
      ),
    ).toBe(true);
    expect(
      isRetryableFlushError(new ApiError({ type: "/errors/internal", title: "x", status: 500 })),
    ).toBe(true);
    expect(isRetryableFlushError(new TypeError("network"))).toBe(true);
  });
});

describe("flushOfflineQueue auth failures", () => {
  it("halts and retains queued mutations on 401", async () => {
    server.use(
      http.post(`${profileBase}/library`, () =>
        HttpResponse.json(
          {
            type: "/errors/unauthorized",
            title: "Unauthorized",
            status: 401,
            detail: "session expired",
          },
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_add",
      body: {
        content_type: "movie",
        content_id: "tt1",
        manifest_id: "org.stremio.cinemeta",
        name: "One",
      },
    });

    const result = await flushOfflineQueue(PROFILE_ID);
    expect(result.flushed).toBe(0);
    expect(result.discarded).toHaveLength(0);
    expect(result.halted).toBe(true);
  });
});
