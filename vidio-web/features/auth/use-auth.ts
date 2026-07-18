"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clientAuthSessionSchema, userDtoSchema, profileSchema } from "@/lib/api/schemas";
import { queryKeys } from "@/lib/api/query-keys";
import { apiGet } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";
import type { LoginFormValues } from "@/features/auth/schemas";
import type { RegisterFormValues } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import { z } from "zod";

async function postAuth(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/problem+json")) {
      const json: unknown = await response.json();
      const problem = z
        .object({
          type: z.string(),
          title: z.string(),
          status: z.number(),
          detail: z.string().optional(),
        })
        .parse(json);
      throw new ApiError(problem);
    }
    throw new ApiError({
      type: "/errors/unknown",
      title: "Request failed",
      status: response.status,
      detail: response.statusText,
    });
  }

  const json: unknown = await response.json();
  return clientAuthSessionSchema.parse(json);
}

export function useLoginMutation() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LoginFormValues) => postAuth("/api/auth/login", values),
    onSuccess: (session) => {
      setSession(session);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      router.replace("/board");
    },
  });
}

export function useRegisterMutation() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: RegisterFormValues) =>
      postAuth("/api/auth/register", {
        email: values.email,
        password: values.password,
        profile_name: values.profile_name,
      }),
    onSuccess: (session) => {
      setSession(session);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      router.replace("/board");
    },
  });
}

export function useLogoutMutation() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
      router.replace("/login");
    },
  });
}

export function useMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me,
    enabled: enabled && Boolean(useAuthStore.getState().accessToken),
    queryFn: () => apiGet("/v1/me", userDtoSchema),
  });
}

export function useProfilesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profiles,
    enabled: enabled && Boolean(useAuthStore.getState().accessToken),
    queryFn: () => apiGet("/v1/profiles", z.array(profileSchema)),
  });
}

export function useDefaultProfile() {
  const authProfile = useAuthStore((state) => state.profile);
  const profilesQuery = useProfilesQuery();

  const defaultProfile = profilesQuery.data?.find((profile) => profile.is_default) ?? authProfile;

  return {
    profile: defaultProfile ?? authProfile,
    profileId: defaultProfile?.id ?? authProfile?.id ?? null,
    isLoading: profilesQuery.isLoading,
  };
}
