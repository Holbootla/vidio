import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { SearchView } from "@/features/discovery/search-view";
import { PROFILE_ID } from "@/test/fixtures/browse";
import messages from "@/messages/en.json";

function renderSearch() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <SearchView profileId={PROFILE_ID} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("SearchView", () => {
  it("blocks empty queries client-side", async () => {
    renderSearch();
    expect(screen.getByText(/Enter a search term/i)).toBeInTheDocument();
    expect(screen.queryByText(/Searching/i)).not.toBeInTheDocument();
  });

  it("shows results for a valid query", async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByLabelText("Search query"), "bunny");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Big Buck Bunny/i })).toBeVisible(),
    );
  });
});
