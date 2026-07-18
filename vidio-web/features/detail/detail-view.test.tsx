import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { DetailView } from "@/features/detail/detail-view";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { INSTALLATION_ID, MANIFEST_ID, PROFILE_ID } from "@/test/fixtures/browse";
import { useAuthStore } from "@/lib/auth/store";
import messages from "@/messages/en.json";
import { server } from "@/test/server";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function seedAuth() {
  useAuthStore.getState().setSession({
    access_token: "access-token",
    access_expires_at: "2026-12-31T23:59:59Z",
    profile: {
      id: PROFILE_ID,
      user_id: "11111111-1111-7111-8111-111111111111",
      name: "Main",
      is_default: true,
      preferences: {
        locale: "en-US",
        subtitle_languages: [],
        audio_languages: [],
        preferred_qualities: [],
        hide_p2p_streams: false,
      },
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  });
}

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <ProfileProvider>
          <DetailView
            profileId={PROFILE_ID}
            contentType="movie"
            id="tt1254207"
            searchParams={{
              manifest_id: MANIFEST_ID,
              installation_id: INSTALLATION_ID,
            }}
          />
        </ProfileProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("DetailView library", () => {
  it("adds a title to the library", async () => {
    seedAuth();
    let library: unknown[] = [];
    server.use(
      http.get(`${profileBase}/library`, () => HttpResponse.json(library)),
      http.post(`${profileBase}/library`, async ({ request }) => {
        const body = (await request.json()) as {
          content_type: string;
          content_id: string;
          manifest_id: string;
          name: string;
        };
        const entry = {
          profile_id: PROFILE_ID,
          media_key: `movie:imdb:${body.content_id}`,
          media_type: body.content_type,
          name: body.name,
          poster: null,
          meta_snapshot: null,
          removed: false,
          added_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        };
        library = [entry];
        return HttpResponse.json(entry, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Big Buck Bunny" })).toBeVisible(),
    );
    await user.click(screen.getByRole("button", { name: "Add to library" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Added to your library/i);
      expect(screen.getByRole("button", { name: /In library/i })).toBeInTheDocument();
    });
  });
});
