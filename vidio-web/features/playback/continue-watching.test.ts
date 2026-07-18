import { describe, expect, it } from "vitest";
import { enrichContinueWatchingItem } from "@/features/playback/continue-watching";
import { continueWatchingFixture } from "@/test/fixtures/playback";
import { libraryEntries } from "@/test/fixtures/browse";

describe("continue watching enrichment", () => {
  it("joins library metadata and builds watch/detail links", () => {
    const enriched = enrichContinueWatchingItem(continueWatchingFixture[0]!, libraryEntries, null);
    expect(enriched?.title).toBe("Big Buck Bunny");
    expect(enriched?.poster).toBe("https://example.com/bbb.jpg");
    expect(enriched?.watchHref).toContain("/watch/movie/tt1254207");
    expect(enriched?.detailHref).toContain("/detail/movie/tt1254207");
  });
});
