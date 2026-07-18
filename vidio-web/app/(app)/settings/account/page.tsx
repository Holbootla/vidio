"use client";

import { useProfileContext } from "@/components/providers/ProfileProvider";
import { AccountView } from "@/features/settings/account-view";
import { QueryLoadingState } from "@/components/ui/query-status";

export default function AccountSettingsPage() {
  const { profile } = useProfileContext();

  if (!profile) {
    return <QueryLoadingState label="Loading profile…" />;
  }

  return <AccountView profileName={profile.name} />;
}
