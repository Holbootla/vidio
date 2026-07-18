import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsNav } from "@/features/settings/settings-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/preferences",
}));

describe("SettingsNav", () => {
  it("marks the active settings section", () => {
    render(<SettingsNav />);
    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("navigation", { name: "Settings" })).toBeInTheDocument();
  });
});
