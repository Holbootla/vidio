"use client";

import { Suspense } from "react";
import { DiscoverView } from "@/features/discovery/discover-view";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { QueryLoadingState } from "@/components/ui/query-status";

function DiscoverPageContent() {
  const { profileId } = useProfileContext();
  if (!profileId) {
    return null;
  }
  return <DiscoverView profileId={profileId} />;
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<QueryLoadingState label="Loading discover…" />}>
      <DiscoverPageContent />
    </Suspense>
  );
}
