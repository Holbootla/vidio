import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { AddonsView } from "@/features/addons/addons-view";
import {
  INSTALLATION_ID_2,
  PROFILE_ID,
  SECRET_TRANSPORT_URL,
  addonListFixture,
} from "@/test/fixtures/settings";
import { server } from "@/test/server";
import { useAuthStore } from "@/lib/auth/store";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;
let lastReorderPayload: { order: string[] } | null = null;

function renderAddons() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddonsView profileId={PROFILE_ID} />
    </QueryClientProvider>,
  );
}

describe("AddonsView", () => {
  beforeEach(() => {
    lastReorderPayload = null;
    useAuthStore.setState({
      accessToken: "access-token",
      accessExpiresAt: "2026-12-31T23:59:59Z",
      profile: null,
      isBootstrapped: true,
    });
    server.use(
      http.post(`${profileBase}/addons/reorder`, async ({ request }) => {
        lastReorderPayload = (await request.json()) as { order: string[] };
        const byId = new Map(addonListFixture.map((addon) => [addon.id, addon]));
        const reordered = lastReorderPayload.order
          .map((id, index) => {
            const addon = byId.get(id);
            return addon ? { ...addon, priority: index } : null;
          })
          .filter((addon) => addon !== null);
        return HttpResponse.json(reordered);
      }),
    );
  });

  it("lists installed add-ons", async () => {
    renderAddons();
    await waitFor(() => expect(screen.getByText("Cinemeta")).toBeInTheDocument());
    expect(screen.getByText("Example Streams")).toBeInTheDocument();
  });

  it("installs via HTTPS manifest URL and clears the secret field", async () => {
    const user = userEvent.setup();
    renderAddons();

    await user.type(screen.getByLabelText(/HTTPS manifest URL/i), SECRET_TRANSPORT_URL);
    await user.click(screen.getByRole("button", { name: /Install add-on/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Installed Add-on" })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/HTTPS manifest URL/i)).toHaveValue("");
    expect(screen.queryByText(SECRET_TRANSPORT_URL)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET_TRANSPORT_URL);
  });

  it("toggles enable state", async () => {
    const user = userEvent.setup();
    renderAddons();
    await waitFor(() => expect(screen.getByText("Cinemeta")).toBeInTheDocument());

    await user.click(screen.getByRole("switch", { name: /Disable Cinemeta/i }));

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /Enable Cinemeta/i })).toBeInTheDocument();
    });
  });

  it("refreshes an add-on", async () => {
    const user = userEvent.setup();
    renderAddons();
    await waitFor(() => expect(screen.getByText("Cinemeta")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Refresh Cinemeta/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Refreshed Cinemeta/i);
    });
  });

  it("confirms and removes an add-on with rollback on failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(`${profileBase}/addons/:installationId`, () =>
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

    renderAddons();
    await waitFor(() => expect(screen.getByText("Example Streams")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Remove Example Streams/i }));
    await user.click(screen.getByRole("button", { name: /^Remove$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/restored/i);
    });
    expect(screen.getByText("Example Streams")).toBeInTheDocument();
  });

  it("reorders via keyboard move buttons and sends full order payload", async () => {
    const user = userEvent.setup();
    renderAddons();
    await waitFor(() => expect(screen.getByText("Cinemeta")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Move Example Streams up/i }));

    await waitFor(() => {
      expect(lastReorderPayload).toEqual({
        order: [INSTALLATION_ID_2, "33333333-3333-7333-8333-333333333333"],
      });
    });
  });

  it("shows empty state when no add-ons are installed", async () => {
    server.use(http.get(`${profileBase}/addons`, () => HttpResponse.json([])));
    renderAddons();

    await waitFor(() => {
      expect(screen.getByText(/No add-ons installed/i)).toBeInTheDocument();
    });
  });

  it("does not render transport URLs in the list", async () => {
    renderAddons();
    await waitFor(() => expect(screen.getByText("Cinemeta")).toBeInTheDocument());
    const list = screen.getByRole("list", { name: /Installed add-ons/i });
    expect(within(list).queryByText(/transport/i)).not.toBeInTheDocument();
    expect(within(list).queryByText(/secret/i)).not.toBeInTheDocument();
  });
});
