import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { DiscoverView } from "@/features/discovery/discover-view";
import { PROFILE_ID, discoveryHome } from "@/test/fixtures/browse";
import { server } from "@/test/server";
import messages from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;
const catalogRequests: string[] = [];

function renderDiscover() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <DiscoverView profileId={PROFILE_ID} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("DiscoverView", () => {
  it("does not call a per-catalog endpoint", async () => {
    server.use(
      http.get(`${profileBase}/catalog/:catalogId`, () => {
        catalogRequests.push("catalog");
        return HttpResponse.json(discoveryHome);
      }),
    );

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText("Popular Movies")).toBeInTheDocument();
    });

    expect(catalogRequests).toHaveLength(0);
    expect(screen.getByText("Big Buck Bunny")).toBeInTheDocument();
  });

  it("switches catalogs from home rows only", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${profileBase}/home`, () =>
        HttpResponse.json({
          ...discoveryHome,
          rows: [
            discoveryHome.rows[0]!,
            {
              ...discoveryHome.rows[0]!,
              catalog_id: "series",
              title: "Popular Series",
              items: [
                {
                  id: "tt0944947",
                  type: "series",
                  name: "Game of Thrones",
                },
              ],
            },
          ],
        }),
      ),
    );

    renderDiscover();
    await waitFor(() => expect(screen.getByText("Big Buck Bunny")).toBeInTheDocument());

    await user.selectOptions(
      screen.getByLabelText("Catalog"),
      "33333333-3333-7333-8333-333333333333:series",
    );
    expect(screen.getByText("Game of Thrones")).toBeInTheDocument();
  });
});
