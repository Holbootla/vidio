import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { PreferencesView } from "@/features/settings/preferences-view";
import { PROFILE_ID } from "@/test/fixtures/settings";
import { useAuthStore } from "@/lib/auth/store";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

function renderPreferences() {
  useAuthStore.setState({
    accessToken: "access-token",
    accessExpiresAt: "2026-12-31T23:59:59Z",
    profile: null,
    isBootstrapped: true,
  });

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <PreferencesView profileId={PROFILE_ID} />
    </QueryClientProvider>,
  );
}

describe("PreferencesView", () => {
  it("loads and saves preferences", async () => {
    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() => expect(screen.getByLabelText("Locale")).toHaveValue("en-US"));

    await user.clear(screen.getByLabelText("Locale"));
    await user.type(screen.getByLabelText("Locale"), "fr-FR");
    await user.click(screen.getByRole("button", { name: /Save preferences/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Preferences saved/i);
    });
    expect(screen.getByLabelText("Locale")).toHaveValue("fr-FR");
  });

  it("edits array fields with tag input", async () => {
    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() => expect(screen.getByLabelText("Subtitle languages")).toBeInTheDocument());

    const subtitleSection = screen.getByLabelText("Subtitle languages").closest("div")!;
    await user.type(screen.getByLabelText("Subtitle languages"), "fr");
    await user.click(within(subtitleSection).getByRole("button", { name: /^Add$/i }));

    expect(screen.getByText("fr")).toBeInTheDocument();
    expect(screen.getByLabelText("Subtitle languages")).toHaveValue("");
  });

  it("resets form from query parameter", async () => {
    searchParams.set("reset", "1");
    renderPreferences();

    await waitFor(() => expect(screen.getByLabelText("Locale")).toHaveValue("en-US"));

    await waitFor(() => {
      expect(screen.getAllByText("No values added yet.").length).toBeGreaterThan(0);
    });

    searchParams.delete("reset");
  });
});
