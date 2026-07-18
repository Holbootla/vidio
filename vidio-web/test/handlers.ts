import { http, HttpResponse } from "msw";
import {
  PROFILE_ID,
  discoveryHome,
  discoverySearch,
  libraryEntries,
  movieMeta,
  seriesMeta,
} from "@/test/fixtures/browse";
import { addonListFixture, defaultPreferences } from "@/test/fixtures/settings";
import {
  continueWatchingFixture,
  progressResponseFixture,
  streamResolutionFixture,
  subtitleResolutionFixture,
} from "@/test/fixtures/playback";

const API_BASE = "http://localhost:8080";
const profileBase = `${API_BASE}/v1/profiles/${PROFILE_ID}`;

let mutableLibrary: Array<Record<string, unknown>> = [...libraryEntries];
let mutableAddons: Array<Record<string, unknown>> = [...addonListFixture];
let mutablePreferences: Record<string, unknown> = { ...defaultPreferences };

export const handlers = [
  http.get(`${API_BASE}/health`, () => HttpResponse.json({ status: "ok" })),
  http.post(`${API_BASE}/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password === "wrong") {
      return HttpResponse.json(
        {
          type: "/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Invalid credentials",
        },
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    if (!body.email.includes("@")) {
      return HttpResponse.json(
        {
          type: "/errors/validation",
          title: "Validation failed",
          status: 422,
          detail: "Invalid email",
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(authResponse());
  }),
  http.post(`${API_BASE}/v1/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refresh_token: string };
    if (body.refresh_token === "expired") {
      return HttpResponse.json(
        {
          type: "/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Refresh token expired",
        },
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(authResponse());
  }),
  http.post(`${API_BASE}/v1/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/v1/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string };
    return HttpResponse.json(
      {
        user: {
          id: "11111111-1111-7111-8111-111111111111",
          email: body.email,
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
        },
        profile: {
          id: "22222222-2222-7222-8222-222222222222",
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
      },
      { status: 201 },
    );
  }),
  http.get(`${API_BASE}/v1/me`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        {
          type: "/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
        },
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return HttpResponse.json({
      id: "11111111-1111-7111-8111-111111111111",
      email: "viewer@example.com",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
    });
  }),
  http.get(`${profileBase}/home`, () => HttpResponse.json(discoveryHome)),
  http.get(`${profileBase}/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (!q) {
      return HttpResponse.json(
        {
          type: "/errors/validation",
          title: "Validation failed",
          status: 422,
          detail: "q is required",
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(discoverySearch);
  }),
  http.get(`${profileBase}/meta/:contentType/:id`, ({ params }) => {
    if (params.id === "tt0944947") {
      return HttpResponse.json(seriesMeta);
    }
    return HttpResponse.json(movieMeta);
  }),
  http.get(`${profileBase}/continue-watching`, () => HttpResponse.json(continueWatchingFixture)),
  http.get(`${profileBase}/streams/:contentType/:videoId`, () =>
    HttpResponse.json(streamResolutionFixture),
  ),
  http.get(`${profileBase}/subtitles/:contentType/:id`, () =>
    HttpResponse.json(subtitleResolutionFixture),
  ),
  http.put(`${profileBase}/progress`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...progressResponseFixture,
      position_secs: body.position_secs ?? progressResponseFixture.position_secs,
      duration_secs: body.duration_secs ?? progressResponseFixture.duration_secs,
      watched: body.watched ?? progressResponseFixture.watched,
    });
  }),
  http.get(`${profileBase}/addons`, () => HttpResponse.json(mutableAddons)),
  http.post(`${profileBase}/addons`, async ({ request }) => {
    const body = (await request.json()) as { transport_url: string };
    if (body.transport_url === "fail-install") {
      return HttpResponse.json(
        {
          type: "/errors/validation",
          title: "Validation failed",
          status: 422,
          detail: "Invalid manifest",
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    const addon = {
      id: "55555555-5555-7555-8555-555555555555",
      manifest_id: "installed.example",
      name: "Installed Add-on",
      version: "1.0.0",
      enabled: true,
      priority: mutableAddons.length,
      capabilities: {
        resources: ["catalog"],
        types: ["movie"],
        id_prefixes: ["tt"],
      },
      installed_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-01-03T00:00:00Z",
      transport_url: body.transport_url,
    };
    const { transport_url: _secret, ...publicAddon } = addon;
    mutableAddons = [...mutableAddons, publicAddon];
    return HttpResponse.json(publicAddon, { status: 201 });
  }),
  http.patch(`${profileBase}/addons/:installationId`, async ({ params, request }) => {
    const body = (await request.json()) as { enabled?: boolean };
    const installationId = params.installationId as string;
    if (installationId === "fail-toggle") {
      return HttpResponse.json(
        {
          type: "/errors/internal",
          title: "Server error",
          status: 500,
          detail: "toggle failed",
        },
        { status: 500, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    let updated: Record<string, unknown> | null = null;
    mutableAddons = mutableAddons.map((addon) => {
      if (addon.id !== installationId) {
        return addon;
      }
      updated = {
        ...addon,
        enabled: body.enabled ?? addon.enabled,
        updated_at: "2026-01-04T00:00:00Z",
      };
      return updated;
    });
    if (!updated) {
      return HttpResponse.json(
        {
          type: "/errors/not-found",
          title: "Not found",
          status: 404,
        },
        { status: 404, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(updated);
  }),
  http.post(`${profileBase}/addons/:installationId/refresh`, ({ params }) => {
    const installationId = params.installationId as string;
    let updated: Record<string, unknown> | null = null;
    mutableAddons = mutableAddons.map((addon) => {
      if (addon.id !== installationId) {
        return addon;
      }
      updated = {
        ...addon,
        version: "1.0.1",
        updated_at: "2026-01-05T00:00:00Z",
      };
      return updated;
    });
    if (!updated) {
      return HttpResponse.json(
        {
          type: "/errors/not-found",
          title: "Not found",
          status: 404,
        },
        { status: 404, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(updated);
  }),
  http.delete(`${profileBase}/addons/:installationId`, ({ params }) => {
    const installationId = params.installationId as string;
    if (installationId === "fail-remove") {
      return HttpResponse.json(
        {
          type: "/errors/internal",
          title: "Server error",
          status: 500,
          detail: "remove failed",
        },
        { status: 500, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    mutableAddons = mutableAddons.filter((addon) => addon.id !== installationId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${profileBase}/addons/reorder`, async ({ request }) => {
    const body = (await request.json()) as { order: string[] };
    if (body.order.includes("fail-reorder")) {
      return HttpResponse.json(
        {
          type: "/errors/internal",
          title: "Server error",
          status: 500,
          detail: "reorder failed",
        },
        { status: 500, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    const byId = new Map(mutableAddons.map((addon) => [addon.id as string, addon]));
    const reordered: Array<Record<string, unknown>> = [];
    for (const [index, id] of body.order.entries()) {
      const addon = byId.get(id);
      if (addon) {
        reordered.push({ ...addon, priority: index });
      }
    }
    mutableAddons = reordered;
    return HttpResponse.json(mutableAddons);
  }),
  http.get(`${profileBase}/preferences`, () => HttpResponse.json(mutablePreferences)),
  http.put(`${profileBase}/preferences`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    mutablePreferences = { ...body };
    return HttpResponse.json({
      id: PROFILE_ID,
      user_id: "11111111-1111-7111-8111-111111111111",
      name: "Main",
      is_default: true,
      preferences: mutablePreferences,
      version: 2,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-06T00:00:00Z",
    });
  }),
  http.get(`${profileBase}/library`, () => HttpResponse.json(mutableLibrary)),
  http.post(`${profileBase}/library`, async ({ request }) => {
    const body = (await request.json()) as {
      content_type: string;
      content_id: string;
      manifest_id: string;
      name: string;
      poster?: string;
      meta_snapshot?: string;
    };
    const mediaKey = body.content_id.startsWith("tt")
      ? `${body.content_type}:imdb:${body.content_id}`
      : `${body.content_type}:addon:${body.manifest_id}:${body.content_id}`;
    const entry = {
      profile_id: PROFILE_ID,
      media_key: mediaKey,
      media_type: body.content_type,
      name: body.name,
      poster: body.poster ?? null,
      meta_snapshot: body.meta_snapshot ?? null,
      removed: false,
      added_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    mutableLibrary = [...mutableLibrary.filter((item) => item.media_key !== mediaKey), entry];
    return HttpResponse.json(entry, { status: 201 });
  }),
  http.delete(`${profileBase}/library/:mediaKey`, ({ params }) => {
    const mediaKey = decodeURIComponent(params.mediaKey as string);
    if (params.mediaKey === "fail-remove") {
      return HttpResponse.json(
        {
          type: "/errors/internal",
          title: "Server error",
          status: 500,
          detail: "remove failed",
        },
        { status: 500, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    mutableLibrary = mutableLibrary.filter((item) => item.media_key !== mediaKey);
    return new HttpResponse(null, { status: 204 });
  }),
];

function authResponse() {
  return {
    access_token: "access-token",
    token_type: "Bearer",
    access_expires_at: "2026-12-31T23:59:59Z",
    refresh_token: "refresh-token",
    refresh_expires_at: "2027-12-31T23:59:59Z",
    profile: {
      id: PROFILE_ID,
      user_id: "11111111-1111-7111-8111-111111111111",
      name: "Main",
      is_default: true,
      preferences: defaultPreferences,
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
}

export function resetTestState() {
  mutableLibrary = [...libraryEntries];
  mutableAddons = [...addonListFixture];
  mutablePreferences = { ...defaultPreferences };
}
