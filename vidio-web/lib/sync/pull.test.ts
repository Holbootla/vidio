import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { getSyncCursor, setSyncCursor } from "@/lib/sync/cursor";
import { pullSyncFeed } from "@/lib/sync/pull";
import { applySyncChange } from "@/lib/sync/applyChange";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { librarySyncChange, progressSyncChange, syncPage } from "@/test/fixtures/sync";
import { server } from "@/test/server";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

describe("pullSyncFeed", () => {
  it("paginates until has_more is false and persists cursor per page", async () => {
    await setSyncCursor(PROFILE_ID, 0);
    const requests: string[] = [];

    server.use(
      http.get(`${profileBase}/sync`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);
        const after = Number(url.searchParams.get("after") ?? "0");
        if (after === 0) {
          return HttpResponse.json(syncPage([librarySyncChange], 2, true));
        }
        return HttpResponse.json(syncPage([progressSyncChange], 3, false));
      }),
    );

    const queryClient = new QueryClient();
    const result = await pullSyncFeed({
      profileId: PROFILE_ID,
      after: 0,
      applyChange: (change) => applySyncChange(change, { profileId: PROFILE_ID, queryClient }),
    });

    expect(requests).toEqual(["?after=0&limit=100", "?after=1&limit=100"]);
    expect(result.pageCount).toBe(2);
    expect(result.appliedCount).toBe(2);
    expect(result.finalCursor).toBe(3);
    expect(await getSyncCursor(PROFILE_ID)).toBe(3);
  });

  it("uses limit=100", async () => {
    server.use(
      http.get(`${profileBase}/sync`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("limit")).toBe("100");
        return HttpResponse.json(syncPage([], 0, false));
      }),
    );

    await pullSyncFeed({
      profileId: PROFILE_ID,
      after: 0,
      applyChange: () => ({ applied: false, skipped: false }),
    });
  });
});
