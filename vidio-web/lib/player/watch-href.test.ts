import { describe, expect, it } from "vitest";
import {
  appendProvenanceToWatchHref,
  buildWatchHref,
  parseWatchSearchParams,
} from "@/lib/player/watch-href";
import { watchProvenanceFixture } from "@/test/fixtures/playback";

describe("watch href helpers", () => {
  it("builds watch href with provenance query params", () => {
    const href = buildWatchHref("movie", "tt1254207", watchProvenanceFixture);
    expect(href).toContain("/watch/movie/tt1254207");
    expect(href).toContain("manifest_id=org.stremio.cinemeta");
  });

  it("parses watch search params", () => {
    const params = new URLSearchParams("media_id=tt1254207&manifest_id=org.stremio.cinemeta");
    expect(parseWatchSearchParams(params)).toEqual({
      mediaId: "tt1254207",
      manifestId: "org.stremio.cinemeta",
      installationId: undefined,
    });
  });

  it("appends provenance to watch href", () => {
    const href = appendProvenanceToWatchHref("/watch/movie/tt1", {
      manifestId: "org.stremio.cinemeta",
      installationId: "abc",
    });
    expect(href).toContain("manifest_id=org.stremio.cinemeta");
    expect(href).toContain("installation_id=abc");
  });
});
