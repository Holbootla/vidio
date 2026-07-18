import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { EpisodePicker } from "@/features/detail/episode-picker";
import { seriesMeta } from "@/test/fixtures/browse";
import messages from "@/messages/en.json";

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("EpisodePicker", () => {
  it("renders series videos", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EpisodePicker videos={seriesMeta.videos} />);

    expect(screen.getByRole("heading", { name: "Episodes" })).toBeInTheDocument();
    expect(screen.getByText("Winter Is Coming")).toBeInTheDocument();
    expect(screen.getByText("The Kingsroad")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /The Kingsroad/i }));
    expect(screen.getByRole("button", { name: /The Kingsroad/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
