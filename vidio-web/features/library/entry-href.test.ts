import { describe, expect, it } from "vitest";
import { buildLibraryEntryHref } from "@/features/library/entry-href";
import type { LibraryEntry } from "@/lib/api/schemas";
import { MANIFEST_ID, PROFILE_ID } from "@/test/fixtures/browse";

function entry(mediaKey: string, mediaType: string): LibraryEntry {
  return {
    profile_id: PROFILE_ID,
    media_key: mediaKey,
    media_type: mediaType,
    name: "Title",
    poster: null,
    meta_snapshot: null,
    removed: false,
    added_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("buildLibraryEntryHref", () => {
  it("keeps imdb route ids unchanged with shared manifest provenance", () => {
    const href = buildLibraryEntryHref(entry("movie:imdb:tt1254207", "movie"));
    expect(href).toBe("/detail/movie/tt1254207?manifest_id=shared");
  });

  it("restores kitsu prefix in route ids", () => {
    const href = buildLibraryEntryHref(entry("movie:kitsu:anime:42", "movie"));
    expect(href).toBe("/detail/movie/kitsu%3Aanime%3A42?manifest_id=shared");
  });

  it("uses raw addon id and carries manifest_id provenance", () => {
    const href = buildLibraryEntryHref(entry(`series:addon:${MANIFEST_ID}:episode-1`, "series"));
    expect(href).toBe(`/detail/series/episode-1?manifest_id=${encodeURIComponent(MANIFEST_ID)}`);
  });
});
