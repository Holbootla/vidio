import { describe, expect, it } from "vitest";
import {
  clearQueuedMutations,
  enqueueOfflineMutation,
  listQueuedMutations,
} from "@/lib/sync/offlineQueue";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { OTHER_PROFILE_ID } from "@/test/fixtures/sync";
import { defaultPreferences } from "@/test/fixtures/settings";

describe("offline queue", () => {
  it("enqueues in order per profile", async () => {
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_remove",
      mediaKey: "movie:imdb:tt1",
    });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "progress",
      body: {
        content_type: "movie",
        video_id: "tt1",
        media_id: "tt1",
        manifest_id: "org.stremio.cinemeta",
        position_secs: 10,
        duration_secs: 100,
      },
    });

    const queued = await listQueuedMutations(PROFILE_ID);
    expect(queued).toHaveLength(2);
    expect(queued[0]?.mutation.type).toBe("library_remove");
    expect(queued[1]?.mutation.type).toBe("progress");
    expect(await listQueuedMutations(OTHER_PROFILE_ID)).toHaveLength(0);
  });

  it("dedupes progress updates with last-write semantics", async () => {
    const body = {
      content_type: "movie",
      video_id: "tt1254207",
      media_id: "tt1254207",
      manifest_id: "org.stremio.cinemeta",
      position_secs: 10,
      duration_secs: 100,
    };
    await enqueueOfflineMutation(PROFILE_ID, { type: "progress", body });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "progress",
      body: { ...body, position_secs: 99 },
    });

    const queued = await listQueuedMutations(PROFILE_ID);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.mutation.type).toBe("progress");
    if (queued[0]?.mutation.type === "progress") {
      expect(queued[0].mutation.body.position_secs).toBe(99);
    }
  });

  it("cancels add/remove pairs for the same media key", async () => {
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
      type: "library_remove",
      mediaKey: "movie:imdb:tt1254207",
    });

    expect(await listQueuedMutations(PROFILE_ID)).toHaveLength(0);
  });

  it("replaces remove with add for the same media key", async () => {
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_remove",
      mediaKey: "movie:imdb:tt1254207",
    });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_add",
      body: {
        content_type: "movie",
        content_id: "tt1254207",
        manifest_id: "org.stremio.cinemeta",
        name: "Big Buck Bunny",
      },
    });

    const queued = await listQueuedMutations(PROFILE_ID);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.mutation.type).toBe("library_add");
  });

  it("dedupes preferences with last-write semantics", async () => {
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "preferences",
      body: defaultPreferences,
    });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "preferences",
      body: { ...defaultPreferences, locale: "de-DE" },
    });

    const queued = await listQueuedMutations(PROFILE_ID);
    expect(queued).toHaveLength(1);
    if (queued[0]?.mutation.type === "preferences") {
      expect(queued[0].mutation.body.locale).toBe("de-DE");
    }
  });

  it("isolates queues by profile", async () => {
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_remove",
      mediaKey: "movie:imdb:tt1",
    });
    await enqueueOfflineMutation(OTHER_PROFILE_ID, {
      type: "library_remove",
      mediaKey: "movie:imdb:tt2",
    });

    expect(await listQueuedMutations(PROFILE_ID)).toHaveLength(1);
    expect(await listQueuedMutations(OTHER_PROFILE_ID)).toHaveLength(1);
    await clearQueuedMutations(PROFILE_ID);
    expect(await listQueuedMutations(PROFILE_ID)).toHaveLength(0);
    expect(await listQueuedMutations(OTHER_PROFILE_ID)).toHaveLength(1);
  });
});
