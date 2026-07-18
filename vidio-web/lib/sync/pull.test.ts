import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as cursorModule from "@/lib/sync/cursor";
import { pullSyncFeed } from "@/lib/sync/pull";
import { applySyncChange } from "@/lib/sync/applyChange";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { librarySyncChange, progressSyncChange, syncPage } from "@/test/fixtures/sync";
import { server } from "@/test/server";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

describe("pullSyncFeed", () => {
  it("paginates until has_more is false", async () => {
    await cursorModule.setSyncCursor(PROFILE_ID, 0);
    const requests: string[] = [];

    server.use(
      http.get(`${profileBase}/sync`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);
        const after = Number(url.searchParams.get("after") ?? "0");
        if (after === 0) {
          return HttpResponse.json(syncPage([librarySyncChange], 50, true));
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
    expect(await cursorModule.getSyncCursor(PROFILE_ID)).toBe(3);
  });

  it("persists last change sequence on intermediate pages, not latest_sequence", async () => {
    await cursorModule.setSyncCursor(PROFILE_ID, 0);
    const setSpy = vi.spyOn(cursorModule, "setSyncCursor");

    server.use(
      http.get(`${profileBase}/sync`, ({ request }) => {
        const url = new URL(request.url);
        const after = Number(url.searchParams.get("after") ?? "0");
        if (after === 0) {
          return HttpResponse.json(syncPage([librarySyncChange], 50, true));
        }
        return HttpResponse.json(syncPage([progressSyncChange], 3, false));
      }),
    );

    const queryClient = new QueryClient();
    await pullSyncFeed({
      profileId: PROFILE_ID,
      after: 0,
      applyChange: (change) => applySyncChange(change, { profileId: PROFILE_ID, queryClient }),
    });

    expect(setSpy).toHaveBeenNthCalledWith(1, PROFILE_ID, 1);
    expect(setSpy).toHaveBeenNthCalledWith(2, PROFILE_ID, 3);
    setSpy.mockRestore();
  });

  it("leaves cursor at last applied sequence when a later page fails", async () => {
    await cursorModule.setSyncCursor(PROFILE_ID, 0);

    server.use(
      http.get(`${profileBase}/sync`, ({ request }) => {
        const url = new URL(request.url);
        const after = Number(url.searchParams.get("after") ?? "0");
        if (after === 0) {
          return HttpResponse.json(syncPage([librarySyncChange], 50, true));
        }
        return HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
            detail: "sync failed",
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );

    const queryClient = new QueryClient();
    await expect(
      pullSyncFeed({
        profileId: PROFILE_ID,
        after: 0,
        applyChange: (change) => applySyncChange(change, { profileId: PROFILE_ID, queryClient }),
      }),
    ).rejects.toThrow();

    expect(await cursorModule.getSyncCursor(PROFILE_ID)).toBe(1);
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
