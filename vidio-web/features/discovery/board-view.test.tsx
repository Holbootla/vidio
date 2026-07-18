import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { BoardView } from "@/features/discovery/board-view";
import { PROFILE_ID } from "@/test/fixtures/browse";
import messages from "@/messages/en.json";

function renderBoard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <BoardView profileId={PROFILE_ID} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("BoardView", () => {
  it("renders catalog rows and warnings", async () => {
    renderBoard();
    await waitFor(() => expect(screen.getByText("Popular Movies")).toBeInTheDocument());
    expect(screen.getByText(/Catalog fetch was slow/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Big Buck Bunny/i }).length).toBeGreaterThan(0);
  });
});
