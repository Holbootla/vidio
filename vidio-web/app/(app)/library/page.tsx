"use client";

import { LibraryView } from "@/features/library/library-view";
import { useProfileContext } from "@/components/providers/ProfileProvider";

export default function LibraryPage() {
  const { profileId } = useProfileContext();
  if (!profileId) {
    return null;
  }
  return <LibraryView profileId={profileId} />;
}
