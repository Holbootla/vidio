"use client";

import { SearchView } from "@/features/discovery/search-view";
import { useProfileContext } from "@/components/providers/ProfileProvider";

export default function SearchPage() {
  const { profileId } = useProfileContext();
  if (!profileId) {
    return null;
  }
  return <SearchView profileId={profileId} />;
}
