import { describe, expect, it } from "vitest";
import { findResumeEntry, getResumePosition } from "@/lib/player/resume";
import { continueWatchingFixture } from "@/test/fixtures/playback";
import { MANIFEST_ID } from "@/test/fixtures/browse";

describe("resume helpers", () => {
  it("finds an in-progress entry", () => {
    const entry = findResumeEntry(continueWatchingFixture, "movie", "tt1254207", MANIFEST_ID);
    expect(entry?.position_secs).toBe(600);
  });

  it("returns null for watched entries", () => {
    const watched = [{ ...continueWatchingFixture[0]!, watched: true }];
    expect(getResumePosition(watched, "movie", "tt1254207", MANIFEST_ID)).toBeNull();
  });

  it("returns resume seconds when available", () => {
    expect(getResumePosition(continueWatchingFixture, "movie", "tt1254207", MANIFEST_ID)).toBe(600);
  });
});
