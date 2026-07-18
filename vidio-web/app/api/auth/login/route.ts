import { NextResponse } from "next/server";
import { loginRequestSchema, clientAuthSessionSchema } from "@/lib/api/schemas";
import { buildRefreshCookie, refreshMaxAgeSeconds } from "@/lib/auth/cookies";
import { problemResponse } from "@/lib/auth/bff-response";
import { serverLogin, toClientAuthSession } from "@/lib/auth/server-api";

export async function POST(request: Request) {
  try {
    const json: unknown = await request.json();
    const body = loginRequestSchema.parse(json);
    const auth = await serverLogin(body);
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
    return problemResponse(error);
  }
}
