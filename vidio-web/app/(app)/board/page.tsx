"use client";

import { BoardView } from "@/features/discovery/board-view";
import { useProfileContext } from "@/components/providers/ProfileProvider";

export default function BoardPage() {
  const { profileId } = useProfileContext();
  if (!profileId) {
    return null;
  }
  return <BoardView profileId={profileId} />;
}
