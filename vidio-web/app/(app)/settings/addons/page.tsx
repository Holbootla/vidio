"use client";

import { useProfileContext } from "@/components/providers/ProfileProvider";
import { AddonsView } from "@/features/addons/addons-view";
import { QueryLoadingState } from "@/components/ui/query-status";

export default function AddonsSettingsPage() {
  const { profileId } = useProfileContext();

  if (!profileId) {
    return <QueryLoadingState label="Loading profile…" />;
  }

  return <AddonsView profileId={profileId} />;
}
