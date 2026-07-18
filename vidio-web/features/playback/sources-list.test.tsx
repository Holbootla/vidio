import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SourcesList } from "@/features/playback/sources-list";
import { groupAndSortSources } from "@/lib/player/source-selection";
import { streamResolutionFixture } from "@/test/fixtures/playback";

describe("SourcesList", () => {
  it("disables torrent sources with an explanation", async () => {
    const onSelect = vi.fn();
    const groups = groupAndSortSources(streamResolutionFixture.streams);
    render(
      <SourcesList
        groups={groups}
        selectedSourceId={null}
        onSelect={onSelect}
        name="test-sources"
      />,
    );

    const torrentLabel = screen.getByLabelText(/1080p torrent/i);
    expect(torrentLabel).toBeDisabled();

    const playable = screen.getByLabelText(/^1080p$/i);
    await userEvent.click(playable);
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0]?.[0]?.disabled).toBe(false);
  });
});
