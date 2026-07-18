"use client";

import { AlertCircle } from "lucide-react";
import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { WatchView } from "@/features/playback/watch-view";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { QueryLoadingState } from "@/components/ui/query-status";
import { EmptyState } from "@/components/ui/empty-state";
import { parseWatchSearchParams } from "@/lib/player/watch-href";

interface WatchPageProps {
  params: Promise<{ type: string; videoId: string }>;
}

function WatchPageContent({ params }: WatchPageProps) {
  const { type, videoId } = use(params);
  const searchParams = useSearchParams();
  const { profileId } = useProfileContext();
  const provenance = parseWatchSearchParams(searchParams);

  if (!profileId) {
    return null;
  }

  if (!provenance) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Missing playback context"
        description="Open this title from the detail page so media and add-on provenance are preserved."
      />
    );
  }

  return (
    <WatchView
      contentType={decodeURIComponent(type)}
      videoId={decodeURIComponent(videoId)}
      provenance={provenance}
    />
  );
}

export default function WatchPage(props: WatchPageProps) {
  return (
    <Suspense fallback={<QueryLoadingState label="Loading player…" />}>
      <WatchPageContent {...props} />
    </Suspense>
  );
}
