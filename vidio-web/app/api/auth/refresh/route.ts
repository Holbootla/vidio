import { NextResponse } from "next/server";
import { clientAuthSessionSchema } from "@/lib/api/schemas";
import {
  buildClearRefreshCookie,
  buildRefreshCookie,
  readRefreshTokenFromCookies,
  refreshMaxAgeSeconds,
} from "@/lib/auth/cookies";
import { problemResponse } from "@/lib/auth/bff-response";
import { serverRefresh, toClientAuthSession } from "@/lib/auth/server-api";

export async function POST() {
  try {
    const refreshToken = await readRefreshTokenFromCookies();
    if (!refreshToken) {
      return NextResponse.json(
        {
          type: "/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Refresh token cookie is missing",
        },
        { status: 401 },
      );
    }

    const auth = await serverRefresh(refreshToken);
    const session = toClientAuthSession(auth);
    const response = NextResponse.json(clientAuthSessionSchema.parse(session));
    response.headers.set(
      "Set-Cookie",
      buildRefreshCookie(auth.refresh_token, {
        maxAgeSeconds: refreshMaxAgeSeconds(auth.refresh_expires_at),
      }),
    );
    return response;
  } catch (error) {
    const response = problemResponse(error);
    response.headers.set("Set-Cookie", buildClearRefreshCookie());
    return response;
  }
}
