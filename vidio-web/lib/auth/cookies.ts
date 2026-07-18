import { cookies } from "next/headers";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "@/lib/auth/constants";

export interface RefreshCookieOptions {
  maxAgeSeconds: number;
  secure?: boolean;
}

export function buildRefreshCookie(refreshToken: string, options: RefreshCookieOptions): string {
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    "HttpOnly",
    `Path=${REFRESH_COOKIE_PATH}`,
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
  ];

  if (options.secure ?? process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function buildClearRefreshCookie(secure?: boolean): string {
  const parts = [
    `${REFRESH_COOKIE_NAME}=`,
    "HttpOnly",
    `Path=${REFRESH_COOKIE_PATH}`,
    "SameSite=Strict",
    "Max-Age=0",
  ];

  if (secure ?? process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export async function readRefreshTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

export function refreshMaxAgeSeconds(refreshExpiresAt: string): number {
  const expiresMs = Date.parse(refreshExpiresAt);
  if (Number.isNaN(expiresMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
}

export function parseSetCookieHeader(header: string): {
  name: string;
  value: string;
} | null {
  const [pair] = header.split(";");
  if (!pair) {
    return null;
  }
  const separator = pair.indexOf("=");
  if (separator === -1) {
    return null;
  }
  const name = pair.slice(0, separator).trim();
  const value = decodeURIComponent(pair.slice(separator + 1).trim());
  return { name, value };
}
