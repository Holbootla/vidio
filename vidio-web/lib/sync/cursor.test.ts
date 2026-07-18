import { describe, expect, it } from "vitest";
import { clearSyncCursor, getSyncCursor, setSyncCursor } from "@/lib/sync/cursor";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { OTHER_PROFILE_ID } from "@/test/fixtures/sync";

describe("sync cursor", () => {
  it("defaults to zero and persists per profile", async () => {
    expect(await getSyncCursor(PROFILE_ID)).toBe(0);
    await setSyncCursor(PROFILE_ID, 42);
    expect(await getSyncCursor(PROFILE_ID)).toBe(42);
    expect(await getSyncCursor(OTHER_PROFILE_ID)).toBe(0);
  });

  it("clears a profile cursor", async () => {
    await setSyncCursor(PROFILE_ID, 10);
    await clearSyncCursor(PROFILE_ID);
    expect(await getSyncCursor(PROFILE_ID)).toBe(0);
  });
});
