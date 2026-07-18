import { describe, expect, it } from "vitest";
import { parseMediaKey, parseVideoKey } from "@/lib/media/parse-keys";

describe("parse media keys", () => {
  it("parses imdb movie keys", () => {
    expect(parseVideoKey("movie:imdb:tt1254207")).toEqual({
      contentType: "movie",
      namespace: "imdb",
      mediaId: "tt1254207",
      videoId: "tt1254207",
    });
  });

  it("parses episode keys with season markers", () => {
    expect(parseVideoKey("series:imdb:tt0944947:1:1")).toEqual({
      contentType: "series",
      namespace: "imdb",
      mediaId: "tt0944947:1:1",
      videoId: "tt0944947:1:1",
    });
  });

  it("parses addon scoped media keys", () => {
    expect(parseMediaKey("series:addon:org.addon:episode-1")).toEqual({
      contentType: "series",
      namespace: "addon",
      manifestId: "org.addon",
      mediaId: "episode-1",
    });
  });
});
