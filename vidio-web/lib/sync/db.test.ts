import { describe, expect, it } from "vitest";
import { isIndexedDbAvailable } from "@/lib/sync/db";

describe("sync db SSR safety", () => {
  it("reports IndexedDB availability only in browser contexts", () => {
    expect(isIndexedDbAvailable()).toBe(true);
  });
});
