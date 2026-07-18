import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:8080";

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
];

function authResponse() {
  return {
    access_token: "access-token",
    token_type: "Bearer",
    access_expires_at: "2026-12-31T23:59:59Z",
    refresh_token: "refresh-token",
    refresh_expires_at: "2027-12-31T23:59:59Z",
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
  };
}
