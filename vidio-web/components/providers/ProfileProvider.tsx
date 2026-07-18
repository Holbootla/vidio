"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/lib/api/schemas";
import { useAuthStore } from "@/lib/auth/store";

interface ProfileContextValue {
  profile: Profile | null;
  profileId: string | null;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  profileId: null,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileId: profile?.id ?? null,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  return useContext(ProfileContext);
}
