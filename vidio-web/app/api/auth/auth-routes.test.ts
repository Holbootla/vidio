import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as refreshRoute } from "@/app/api/auth/refresh/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { REFRESH_COOKIE_NAME } from "@/lib/auth/constants";
import { server } from "@/test/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";

const mockedCookies = vi.mocked(cookies);

function mockRefreshCookie(value = "refresh-token") {
  mockedCookies.mockResolvedValue({
    get: (name: string) => (name === REFRESH_COOKIE_NAME ? { name, value } : undefined),
  } as never);
}

describe("BFF auth routes", () => {
  beforeEach(() => {
    mockedCookies.mockReset();
  });

  it("login sets refresh cookie and returns session json", async () => {
    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "viewer@example.com", password: "secret" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await loginRoute(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.access_token).toBe("access-token");
    expect(response.headers.get("set-cookie")).toContain(REFRESH_COOKIE_NAME);
  });

  it("register chains login and returns session json", async () => {
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "new@example.com",
        password: "password123",
        profile_name: "Main",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await registerRoute(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.user.email).toBe("new@example.com");
    expect(json.access_token).toBe("access-token");
  });

  it("refresh returns 401 when cookie is missing", async () => {
    mockedCookies.mockResolvedValue({
      get: () => undefined,
    } as never);

    const response = await refreshRoute();
    expect(response.status).toBe(401);
  });

  it("refresh rotates cookie when refresh token exists", async () => {
    mockRefreshCookie();

    const response = await refreshRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(REFRESH_COOKIE_NAME);
  });

  it("refresh clears cookie on 401 from upstream", async () => {
    mockRefreshCookie("expired");

    const response = await refreshRoute();
    expect(response.status).toBe(401);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("refresh preserves cookie on upstream 500", async () => {
    mockRefreshCookie();
    server.use(
      http.post("http://localhost:8080/v1/auth/refresh", () =>
        HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
            detail: "temporary",
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const response = await refreshRoute();
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refresh preserves cookie on malformed upstream json", async () => {
    mockRefreshCookie();
    server.use(
      http.post("http://localhost:8080/v1/auth/refresh", () =>
        HttpResponse.json({ unexpected: true }, { status: 200 }),
      ),
    );

    const response = await refreshRoute();
    expect(response.status).toBe(422);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("logout clears cookie with 204", async () => {
    mockRefreshCookie();

    const response = await logoutRoute();
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain(`${REFRESH_COOKIE_NAME}=`);
  });
});
