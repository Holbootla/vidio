"use client";

import { create } from "zustand";
import type { ClientAuthSession, Profile } from "@/lib/api/schemas";

interface AuthState {
  accessToken: string | null;
  accessExpiresAt: string | null;
  profile: Profile | null;
  isBootstrapped: boolean;
  setSession: (session: ClientAuthSession) => void;
  clearSession: () => void;
  setBootstrapped: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accessExpiresAt: null,
  profile: null,
  isBootstrapped: false,
  setSession: (session) =>
    set({
      accessToken: session.access_token,
      accessExpiresAt: session.access_expires_at,
      profile: session.profile,
    }),
  clearSession: () =>
    set({
      accessToken: null,
      accessExpiresAt: null,
      profile: null,
    }),
  setBootstrapped: (value) => set({ isBootstrapped: value }),
}));

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export function getProfileId(): string | null {
  return useAuthStore.getState().profile?.id ?? null;
}

export function isAuthenticated(): boolean {
  return Boolean(useAuthStore.getState().accessToken);
}
