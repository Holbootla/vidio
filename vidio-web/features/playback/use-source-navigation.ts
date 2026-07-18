"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { MediaProvenance } from "@/lib/media/provenance";
import { buildWatchHrefFromMediaProvenance } from "@/lib/player/watch-href";
import { openExternalStream, type ProcessedSource } from "@/lib/player/source-selection";

export function useSourceNavigation(
  contentType: string,
  videoId: string,
  mediaId: string,
  provenance?: MediaProvenance | null,
) {
  const router = useRouter();

  return useCallback(
    (source: ProcessedSource) => {
      if (source.disabled || !source.playable) {
        return;
      }

      if (source.playable === "external") {
        const url = source.resolved.stream.externalUrl;
        if (url) {
          openExternalStream(url);
        }
        return;
      }

      const href = buildWatchHrefFromMediaProvenance(
        contentType,
        videoId,
        mediaId,
        provenance,
        source.resolved.installation_id,
      );
      if (!href) {
        return;
      }
      router.push(href);
    },
    [contentType, mediaId, provenance, router, videoId],
  );
}
