import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { LibraryView } from "@/features/library/library-view";
import { PROFILE_ID, libraryEntries } from "@/test/fixtures/browse";
import { server } from "@/test/server";
import messages from "@/messages/en.json";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

function renderLibrary() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <LibraryView profileId={PROFILE_ID} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("LibraryView", () => {
  it("rolls back optimistic remove on failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${profileBase}/library`, () => HttpResponse.json(libraryEntries)),
      http.delete(`${profileBase}/library/:mediaKey`, () =>
        HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
            detail: "remove failed",
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    renderLibrary();
    await waitFor(() => expect(screen.getByText("Big Buck Bunny")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Remove Big Buck Bunny/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/restored/i);
    });
    expect(screen.getByText("Big Buck Bunny")).toBeInTheDocument();
  });
});
