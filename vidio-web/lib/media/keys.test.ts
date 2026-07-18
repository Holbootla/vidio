import { describe, expect, it } from "vitest";
import { buildMediaKey, classifyContentId, resolveManifestIdForLibrary } from "@/lib/media/keys";

describe("media keys", () => {
  it("classifies imdb and kitsu ids", () => {
    expect(classifyContentId("tt1254207")).toBe("imdb");
    expect(classifyContentId("kitsu:anime:1")).toBe("kitsu");
    expect(classifyContentId("custom-id")).toBe("addon");
  });

  it("builds canonical imdb media keys", () => {
    const result = buildMediaKey("movie", "ignored", "tt1254207");
    expect(result).toEqual({ ok: true, key: "movie:imdb:tt1254207" });
  });

  it("requires manifest id for addon scoped ids", () => {
    const result = buildMediaKey("series", "", "custom-id");
    expect(result.ok).toBe(false);
  });

  it("allows library manifest resolution for imdb without provenance", () => {
    const result = resolveManifestIdForLibrary("tt1254207");
    expect(result).toEqual({ ok: true, manifestId: "shared" });
  });

  it("blocks addon scoped library adds without provenance", () => {
    const result = resolveManifestIdForLibrary("custom-id");
    expect(result.ok).toBe(false);
  });
});
