import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncProvider, SYNC_INTERVAL_MS } from "@/features/sync/SyncProvider";
import { useAuthStore } from "@/lib/auth/store";
import { enqueueOfflineMutation } from "@/lib/sync/offlineQueue";
import { PROFILE_ID } from "@/test/fixtures/browse";
import { syncPage } from "@/test/fixtures/sync";
import { server } from "@/test/server";

const profileBase = `http://localhost:8080/v1/profiles/${PROFILE_ID}`;

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
  useAuthStore.getState().setBootstrapped(true);
}

function renderProvider() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SyncProvider>
        <div>child</div>
      </SyncProvider>
    </QueryClientProvider>,
  );
}

describe("SyncProvider", () => {
  afterEach(() => {
    useAuthStore.getState().clearSession();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.restoreAllMocks();
  });

  it("announces offline queued status in a polite live region", async () => {
    seedAuth();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await enqueueOfflineMutation(PROFILE_ID, {
      type: "library_remove",
      mediaKey: "movie:imdb:tt1",
    });

    const { container } = renderProvider();
    await waitFor(() => {
      const live = container.querySelector('[role="status"][aria-live="polite"]');
      expect(live).toHaveTextContent(/Offline/i);
      expect(live).toHaveTextContent(/1 change/i);
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("triggers sync on online and visibilitychange without overlapping runs", async () => {
    seedAuth();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    let inFlight = 0;
    let maxInFlight = 0;
    let callCount = 0;

    server.use(
      http.get(`${profileBase}/sync`, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        callCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        return HttpResponse.json(syncPage([], 0, false));
      }),
    );

    renderProvider();
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(2));
    expect(maxInFlight).toBe(1);
  });

  it("uses a modest sync interval", () => {
    expect(SYNC_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});
