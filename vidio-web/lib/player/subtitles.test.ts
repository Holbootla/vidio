import { describe, expect, it } from "vitest";
import { sortSubtitlesByPreferences, buildSubtitleTrackId } from "@/lib/player/subtitles";
import { subtitleResolutionFixture } from "@/test/fixtures/playback";

describe("subtitles helpers", () => {
  it("orders subtitles by profile preference", () => {
    const sorted = sortSubtitlesByPreferences(subtitleResolutionFixture.subtitles, ["spa", "eng"]);
    expect(sorted[0]?.subtitle.lang).toBe("spa");
    expect(sorted[1]?.subtitle.lang).toBe("eng");
  });

  it("builds stable track ids", () => {
    const subtitle = subtitleResolutionFixture.subtitles[0]!;
    expect(buildSubtitleTrackId(subtitle, 0)).toBe(
      `${subtitle.installation_id}:${subtitle.subtitle.id}:0`,
    );
  });
});
