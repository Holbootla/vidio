import { describe, expect, it } from "vitest";
import { parseSyncChangePayload, syncChangeSchema, syncPageSchema } from "@/lib/sync/schemas";
import {
  addonSyncChange,
  librarySyncChange,
  malformedLibraryChange,
  preferencesSyncChange,
  progressSyncChange,
  syncPage,
} from "@/test/fixtures/sync";

describe("sync schemas", () => {
  it("parses SyncPage and SyncChange", () => {
    const page = syncPage([librarySyncChange], 1, false);
    expect(syncPageSchema.parse(page)).toEqual(page);
    expect(syncChangeSchema.parse(librarySyncChange)).toEqual(librarySyncChange);
  });

  it("parses kind-specific payloads safely", () => {
    expect(parseSyncChangePayload(librarySyncChange)).toEqual({
      kind: "library",
      payload: librarySyncChange.payload,
    });
    expect(parseSyncChangePayload(progressSyncChange)?.kind).toBe("progress");
    expect(parseSyncChangePayload(preferencesSyncChange)?.kind).toBe("preferences");
    expect(parseSyncChangePayload(addonSyncChange)?.kind).toBe("addon");
  });

  it("returns null payload for deleted changes", () => {
    expect(
      parseSyncChangePayload({
        ...librarySyncChange,
        deleted: true,
        payload: null,
      }),
    ).toEqual({ kind: "library", payload: null });
  });

  it("tolerates malformed payloads", () => {
    expect(parseSyncChangePayload(malformedLibraryChange)).toBeNull();
  });
});
