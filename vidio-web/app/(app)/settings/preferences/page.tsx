"use client";

import { Suspense } from "react";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { PreferencesView } from "@/features/settings/preferences-view";
import { QueryLoadingState } from "@/components/ui/query-status";

function PreferencesSettingsContent() {
  const { profileId } = useProfileContext();

  if (!profileId) {
    return <QueryLoadingState label="Loading profile…" />;
  }

  return <PreferencesView profileId={profileId} />;
}

export default function PreferencesSettingsPage() {
  return (
    <Suspense fallback={<QueryLoadingState label="Loading preferences…" />}>
      <PreferencesSettingsContent />
    </Suspense>
  );
}
