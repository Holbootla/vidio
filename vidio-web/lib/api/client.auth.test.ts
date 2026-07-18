import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiGet } from "@/lib/api/client";
import { healthResponseSchema } from "@/lib/api/schemas";
import { userDtoSchema } from "@/lib/api/schemas";
import { useAuthStore } from "@/lib/auth/store";
import { server } from "@/test/server";

describe("api client auth retry", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: "stale-token",
      accessExpiresAt: "2026-01-01T00:00:00Z",
      profile: null,
      isBootstrapped: true,
    });
  });

  it("retries once after refreshing on 401", async () => {
    let meCalls = 0;

    server.use(
      http.get("http://localhost:8080/v1/me", ({ request }) => {
        meCalls += 1;
        const auth = request.headers.get("Authorization");
        if (auth === "Bearer stale-token") {
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
      http.post("*/api/auth/refresh", () =>
        HttpResponse.json({
          access_token: "fresh-token",
          access_expires_at: "2026-12-31T23:59:59Z",
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
        }),
      ),
    );

    const me = await apiGet("/v1/me", userDtoSchema);
    expect(me.email).toBe("viewer@example.com");
    expect(meCalls).toBe(2);
    expect(useAuthStore.getState().accessToken).toBe("fresh-token");
  });
});

describe("health endpoint", () => {
  it("returns ok from mock API", async () => {
    const health = await apiGet("/health", healthResponseSchema);
    expect(health.status).toBe("ok");
  });
});
