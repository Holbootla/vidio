import { describe, expect, it, vi } from "vitest";
import {
  getPlayableAction,
  getSourceDisableReason,
  groupAndSortSources,
  processSource,
  selectPlayableSource,
} from "@/lib/player/source-selection";
import { streamFixtures } from "@/test/fixtures/playback";

describe("source selection", () => {
  it("disables torrent, unknown, unsupported, and non-web-ready url sources", () => {
    expect(getSourceDisableReason(streamFixtures.torrent)).toMatch(/torrent/i);
    expect(getSourceDisableReason(streamFixtures.unknown)).toMatch(/unknown/i);
    expect(getSourceDisableReason(streamFixtures.notWebReady)).toMatch(/proxy/i);
    expect(getPlayableAction(streamFixtures.webReadyMp4)).toBe("vidstack");
    expect(getPlayableAction(streamFixtures.youtube)).toBe("youtube");
    expect(getPlayableAction(streamFixtures.external)).toBe("external");
    expect(getPlayableAction(streamFixtures.torrent)).toBeNull();
  });

  it("groups and sorts by preferred qualities", () => {
    const groups = groupAndSortSources(
      [streamFixtures.webReadyHls, streamFixtures.webReadyMp4],
      ["1080p", "720p"],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sources[0]?.qualityLabel).toBe("1080P");
  });

  it("selects first playable source honoring installation preference", () => {
    const selected = selectPlayableSource(
      [streamFixtures.torrent, streamFixtures.webReadyHls, streamFixtures.webReadyMp4],
      ["1080p"],
      streamFixtures.webReadyMp4.installation_id,
    );
    expect(selected?.playable).toBe("vidstack");
    expect(selected?.resolved.stream.url).toBe("https://example.com/video.mp4");
  });

  it("labels processed sources with disable metadata", () => {
    const torrent = processSource(streamFixtures.torrent, 0);
    expect(torrent.disabled).toBe(true);
    expect(torrent.disableReason).toMatch(/torrent/i);
    expect(torrent.playable).toBeNull();
  });
});

describe("openExternalStream", () => {
  it("opens only http(s) links safely", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { openExternalStream } = await import("@/lib/player/source-selection");
    openExternalStream("https://example.com/watch");
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/watch",
      "_blank",
      "noopener,noreferrer",
    );
    openExternalStream("javascript:alert(1)");
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });
});
