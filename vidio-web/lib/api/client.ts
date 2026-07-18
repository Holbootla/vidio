import { z } from "zod";
import { ApiError, errorFromResponse } from "@/lib/api/errors";
import { getAccessToken, useAuthStore } from "@/lib/auth/store";

function publicApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        useAuthStore.getState().clearSession();
        return false;
      }

      const json: unknown = await response.json();
      const session = z
        .object({
          access_token: z.string(),
          access_expires_at: z.string(),
          profile: z.object({ id: z.string() }).passthrough(),
        })
        .parse(json);

      useAuthStore.getState().setSession({
        access_token: session.access_token,
        access_expires_at: session.access_expires_at,
        profile: session.profile as never,
      });
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export interface ApiRequestOptions<T> {
  path: string;
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  schema: z.ZodType<T>;
  accessToken?: string | null;
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>({
  path,
  method = "GET",
  body,
  headers,
  schema,
  accessToken = getAccessToken(),
  retryOnUnauthorized = true,
}: ApiRequestOptions<T>): Promise<T> {
  const run = async (token: string | null | undefined): Promise<T> => {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    if (body !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
    }
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${publicApiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
    });

    if (!response.ok) {
      throw await errorFromResponse(response);
    }

    if (response.status === 204) {
      return schema.parse(undefined);
    }

    const json: unknown = await response.json();
    return schema.parse(json);
  };

  try {
    return await run(accessToken);
  } catch (error) {
    if (retryOnUnauthorized && error instanceof ApiError && error.isUnauthorized) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return run(getAccessToken());
      }
    }
    throw error;
  }
}

export function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return apiRequest({ path, schema });
}

export function apiPost<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  return apiRequest({ path, method: "POST", body: payload, schema });
}

export function apiPut<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  return apiRequest({ path, method: "PUT", body: payload, schema });
}

export function apiPatch<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  return apiRequest({ path, method: "PATCH", body: payload, schema });
}

export function apiDelete(path: string): Promise<void> {
  return apiRequest({
    path,
    method: "DELETE",
    schema: z.undefined(),
  });
}
