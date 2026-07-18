import { NextResponse } from "next/server";
import { clientAuthSessionSchema, registerRequestSchema } from "@/lib/api/schemas";
import { buildRefreshCookie, refreshMaxAgeSeconds } from "@/lib/auth/cookies";
import { problemResponse } from "@/lib/auth/bff-response";
import { serverLogin, serverRegister, toClientAuthSession } from "@/lib/auth/server-api";

export async function POST(request: Request) {
  try {
    const json: unknown = await request.json();
    const body = registerRequestSchema.parse(json);
    const registered = await serverRegister(body);
    const auth = await serverLogin({
      email: body.email,
      password: body.password,
    });
    const session = toClientAuthSession(auth, registered.user);

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
