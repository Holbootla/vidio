import { describe, expect, it } from "vitest";
import {
  buildClearRefreshCookie,
  buildRefreshCookie,
  parseSetCookieHeader,
  refreshMaxAgeSeconds,
} from "@/lib/auth/cookies";
import { REFRESH_COOKIE_NAME } from "@/lib/auth/constants";

describe("refresh cookie helpers", () => {
  it("builds an httpOnly refresh cookie", () => {
    const cookie = buildRefreshCookie("secret-token", {
      maxAgeSeconds: 3600,
      secure: false,
    });

    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=secret-token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).not.toContain("Secure");
  });

  it("clears the refresh cookie", () => {
    const cookie = buildClearRefreshCookie(false);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=`);
  });

  it("parses Set-Cookie header pairs", () => {
    const parsed = parseSetCookieHeader("vidio_refresh_token=abc123; HttpOnly; Path=/api/auth");
    expect(parsed).toEqual({ name: "vidio_refresh_token", value: "abc123" });
  });

  it("computes refresh max age from RFC3339 timestamp", () => {
    const future = new Date(Date.now() + 5_000).toISOString();
    expect(refreshMaxAgeSeconds(future)).toBeGreaterThan(0);
    expect(refreshMaxAgeSeconds("invalid")).toBe(0);
  });
});
