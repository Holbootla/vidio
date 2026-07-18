"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { DetailView } from "@/features/detail/detail-view";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { QueryLoadingState } from "@/components/ui/query-status";

interface DetailPageProps {
  params: Promise<{ type: string; id: string }>;
}

function DetailPageContent({ params }: DetailPageProps) {
  const { type, id } = use(params);
  const searchParams = useSearchParams();
  const { profileId } = useProfileContext();

  if (!profileId) {
    return null;
  }

  const resolvedSearchParams = Object.fromEntries(searchParams.entries());

  return (
    <DetailView
      profileId={profileId}
      contentType={decodeURIComponent(type)}
      id={decodeURIComponent(id)}
      searchParams={resolvedSearchParams}
    />
  );
}

export default function DetailPage(props: DetailPageProps) {
  return (
    <Suspense fallback={<QueryLoadingState label="Loading details…" />}>
      <DetailPageContent {...props} />
    </Suspense>
  );
}
