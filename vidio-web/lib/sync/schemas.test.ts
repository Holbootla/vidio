import { describe, expect, it } from "vitest";
import {
  parseSyncChangePayload,
  syncAddonPayloadSchema,
  syncChangeSchema,
  syncLibraryPayloadSchema,
  syncPageSchema,
  syncPreferencesPayloadSchema,
  syncProgressPayloadSchema,
} from "@/lib/sync/schemas";
import {
  addonSyncChange,
  addonSyncPayload,
  librarySyncChange,
  librarySyncPayload,
  malformedLibraryChange,
  preferencesSyncChange,
  preferencesSyncPayload,
  progressSyncChange,
  progressSyncPayload,
  syncPage,
} from "@/test/fixtures/sync";

describe("sync schemas", () => {
  it("parses SyncPage and SyncChange", () => {
    const page = syncPage([librarySyncChange], 1, false);
    expect(syncPageSchema.parse(page)).toEqual(page);
    expect(syncChangeSchema.parse(librarySyncChange)).toEqual(librarySyncChange);
  });

  it("parses exact Rust partial wire payloads", () => {
    expect(syncLibraryPayloadSchema.parse(librarySyncPayload)).toEqual(librarySyncPayload);
    expect(syncProgressPayloadSchema.parse(progressSyncPayload)).toEqual(progressSyncPayload);
    expect(syncAddonPayloadSchema.parse(addonSyncPayload)).toEqual(addonSyncPayload);
    expect(syncPreferencesPayloadSchema.parse(preferencesSyncPayload)).toEqual(
      preferencesSyncPayload,
    );
  });

  it("parses kind-specific payloads safely", () => {
    expect(parseSyncChangePayload(librarySyncChange)).toEqual({
      kind: "library",
      payload: librarySyncPayload,
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
