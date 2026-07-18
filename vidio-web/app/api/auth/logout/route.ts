import { NextResponse } from "next/server";
import { buildClearRefreshCookie, readRefreshTokenFromCookies } from "@/lib/auth/cookies";
import { serverLogout } from "@/lib/auth/server-api";

export async function POST() {
  const refreshToken = await readRefreshTokenFromCookies();

  if (refreshToken) {
    try {
      await serverLogout(refreshToken);
    } catch {
      // Best-effort server logout; always clear the cookie locally.
    }
  }

  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Set-Cookie", buildClearRefreshCookie());
  return response;
}
