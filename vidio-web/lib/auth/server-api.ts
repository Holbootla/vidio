import {
  authResponseSchema,
  registerResponseSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
} from "@/lib/api/schemas";
import { errorFromResponse } from "@/lib/api/errors";
import { APP_VERSION } from "@/lib/auth/constants";

function apiBaseUrl(): string {
  const url = process.env.VIDIO_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("VIDIO_API_BASE_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

async function parseJson<T>(
  response: Response,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  if (!response.ok) {
    throw await errorFromResponse(response);
  }
  const json: unknown = await response.json();
  return schema.parse(json);
}

export async function serverLogin(body: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl()}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      ...body,
      device: {
        platform: "web",
        display_name: body.device?.display_name ?? "Vidio Web",
        app_version: APP_VERSION,
        ...body.device,
      },
    }),
    cache: "no-store",
  });

  return parseJson(response, authResponseSchema);
}

export async function serverRegister(body: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch(`${apiBaseUrl()}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return parseJson(response, registerResponseSchema);
}

export async function serverRefresh(refreshToken: string): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  return parseJson(response, authResponseSchema);
}

export async function serverLogout(refreshToken: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/v1/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok && response.status !== 204) {
    throw await errorFromResponse(response);
  }
}

export function toClientAuthSession(auth: AuthResponse, user?: RegisterResponse["user"]) {
  return {
    access_token: auth.access_token,
    access_expires_at: auth.access_expires_at,
    profile: auth.profile,
    ...(user ? { user } : {}),
  };
}
