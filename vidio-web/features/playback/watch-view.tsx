"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, HelpCircle } from "lucide-react";
import { AddonWarnings } from "@/components/discovery/addon-warnings";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { Skeleton } from "@/components/ui/skeleton";
import { useContinueWatchingQuery } from "@/features/discovery/hooks";
import { useAddonsQuery } from "@/features/discovery/hooks";
import { KeyboardHelp } from "@/features/playback/keyboard-help";
import {
  buildProgressRequest,
  useProgressMutation,
  useStreamsQuery,
  useSubtitlesQuery,
} from "@/features/playback/hooks";
import { SourcesList } from "@/features/playback/sources-list";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { buildDetailHref } from "@/lib/media/provenance";
import { resolveManifestIdForProgress } from "@/lib/media/parse-keys";
import { createProgressReporter, isNearCompletion } from "@/lib/player/progress-reporter";
import { getResumePosition } from "@/lib/player/resume";
import {
  groupAndSortSources,
  selectPlayableSource,
  type ProcessedSource,
} from "@/lib/player/source-selection";
import { usePlayerStore } from "@/lib/player/store";
import { buildSubtitleTrackId, sortSubtitlesByPreferences } from "@/lib/player/subtitles";
import type { WatchProvenance } from "@/lib/player/watch-href";

const VidstackPlayer = dynamic(
  () => import("@/features/playback/vidstack-player").then((module) => module.VidstackPlayer),
  {
    ssr: false,
    loading: () => <QueryLoadingState label="Loading player…" />,
  },
);

const YouTubeWatchPlayer = dynamic(
  () =>
    import("@/features/playback/youtube-watch-player").then((module) => module.YouTubeWatchPlayer),
  {
    ssr: false,
    loading: () => <QueryLoadingState label="Loading YouTube player…" />,
  },
);

interface WatchViewProps {
  contentType: string;
  videoId: string;
  provenance: WatchProvenance;
  title?: string;
  poster?: string;
}

export function WatchView({ contentType, videoId, provenance, title, poster }: WatchViewProps) {
  const { profile, profileId } = useProfileContext();
  const preferredQualities = profile?.preferences.preferred_qualities ?? [];
  const preferredSubtitleLanguages = profile?.preferences.subtitle_languages ?? [];
  const streamsQuery = useStreamsQuery(profileId, contentType, videoId);
  const subtitlesQuery = useSubtitlesQuery(profileId, contentType, videoId);
  const continueWatchingQuery = useContinueWatchingQuery(profileId);
  const addonsQuery = useAddonsQuery(profileId);
  const { mutate: reportProgress } = useProgressMutation(profileId);
  const showKeyboardHelp = usePlayerStore((state) => state.showKeyboardHelp);
  const setShowKeyboardHelp = usePlayerStore((state) => state.setShowKeyboardHelp);
  const textTrackId = usePlayerStore((state) => state.textTrackId);
  const setTextTrackId = usePlayerStore((state) => state.setTextTrackId);
  const resetPlayerStore = usePlayerStore((state) => state.reset);

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const snapshotRef = useRef({ position: 0, duration: 0 });
  const reporterRef = useRef(createProgressReporter({ onReport: () => undefined }));

  const groups = useMemo(
    () => groupAndSortSources(streamsQuery.data?.streams ?? [], preferredQualities),
    [preferredQualities, streamsQuery.data?.streams],
  );
  const allSources = useMemo(() => groups.flatMap((group) => group.sources), [groups]);

  const selectedSource = useMemo(
    () => allSources.find((source) => source.id === selectedSourceId) ?? null,
    [allSources, selectedSourceId],
  );

  useEffect(() => {
    resetPlayerStore();
    return () => {
      resetPlayerStore();
    };
  }, [contentType, resetPlayerStore, videoId]);

  useEffect(() => {
    if (selectedSourceId || allSources.length === 0) {
      return;
    }
    const defaultSource =
      selectPlayableSource(
        streamsQuery.data?.streams ?? [],
        preferredQualities,
        provenance.installationId,
      ) ?? allSources[0];
    if (defaultSource) {
      setSelectedSourceId(defaultSource.id);
    }
  }, [
    allSources,
    preferredQualities,
    provenance.installationId,
    selectedSourceId,
    streamsQuery.data?.streams,
  ]);

  const sortedSubtitles = useMemo(
    () =>
      sortSubtitlesByPreferences(subtitlesQuery.data?.subtitles ?? [], preferredSubtitleLanguages),
    [preferredSubtitleLanguages, subtitlesQuery.data?.subtitles],
  );

  const textTracks = useMemo(
    () =>
      sortedSubtitles.map((item, index) => ({
        id: buildSubtitleTrackId(item, index),
        src: item.subtitle.url,
        label: `${item.addon_name} · ${item.subtitle.lang}`,
        language: item.subtitle.lang,
      })),
    [sortedSubtitles],
  );

  useEffect(() => {
    if (textTrackId || textTracks.length === 0) {
      return;
    }
    setTextTrackId(textTracks[0]?.id ?? null);
  }, [setTextTrackId, textTrackId, textTracks]);

  const resumePosition = useMemo(
    () =>
      getResumePosition(continueWatchingQuery.data, contentType, videoId, provenance.manifestId),
    [continueWatchingQuery.data, contentType, provenance.manifestId, videoId],
  );

  const manifestId = useMemo(
    () =>
      resolveManifestIdForProgress(
        provenance.manifestId,
        selectedSource?.resolved.installation_id,
        addonsQuery.data,
      ),
    [addonsQuery.data, provenance.manifestId, selectedSource?.resolved.installation_id],
  );

  const sendProgress = useCallback(
    (position: number, duration: number, watched?: boolean) => {
      if (!profileId || !manifestId) {
        return;
      }
      const payload = buildProgressRequest({
        contentType,
        videoId,
        mediaId: provenance.mediaId,
        manifestId,
        positionSecs: position,
        durationSecs: duration,
        watched,
      });
      if (!payload) {
        return;
      }
      reportProgress(payload);
    },
    [contentType, manifestId, profileId, provenance.mediaId, reportProgress, videoId],
  );

  useEffect(() => {
    reporterRef.current = createProgressReporter({
      onReport: (snapshot, watched) => {
        sendProgress(snapshot.position, snapshot.duration, watched);
      },
    });
    reporterRef.current.start(() => snapshotRef.current);
    return () => {
      const { position, duration } = snapshotRef.current;
      if (duration > 0) {
        reporterRef.current.flush(
          { position, duration },
          isNearCompletion(position, duration) ? true : undefined,
        );
      }
      reporterRef.current.stop();
    };
  }, [sendProgress]);

  useEffect(() => {
    const flushOnHide = () => {
      const { position, duration } = snapshotRef.current;
      if (duration > 0) {
        reporterRef.current.flush(
          { position, duration },
          isNearCompletion(position, duration) ? true : undefined,
        );
      }
    };
    window.addEventListener("pagehide", flushOnHide);
    return () => window.removeEventListener("pagehide", flushOnHide);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setShowKeyboardHelp(!showKeyboardHelp);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setShowKeyboardHelp, showKeyboardHelp]);

  const updateSnapshot = (position: number, duration: number) => {
    snapshotRef.current = { position, duration };
  };

  const handleTimeUpdate = (position: number, duration: number) => {
    updateSnapshot(position, duration);
  };

  const handlePause = (position: number, duration: number) => {
    updateSnapshot(position, duration);
    reporterRef.current.flush({ position, duration });
  };

  const handleSeeked = (position: number, duration: number) => {
    updateSnapshot(position, duration);
    reporterRef.current.flush({ position, duration });
  };

  const handleEnded = (duration: number) => {
    const position = duration > 0 ? duration : snapshotRef.current.position;
    updateSnapshot(position, duration);
    reporterRef.current.flush({ position, duration }, true);
  };

  const handleSelectSource = (source: ProcessedSource) => {
    if (source.disabled) {
      return;
    }
    setSelectedSourceId(source.id);
  };

  const detailHref = buildDetailHref(contentType, provenance.mediaId, {
    manifestId: provenance.manifestId,
    installationId: provenance.installationId,
  });

  const displayTitle = title || videoId;
  const activeSource = selectedSource?.playable ? selectedSource : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={detailHref}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to details
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowKeyboardHelp(true)}
          aria-label="Show keyboard shortcuts"
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
          Shortcuts
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{displayTitle}</h1>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {activeSource
            ? `Playing from ${activeSource.resolved.addon_name}`
            : "Select a playable source to start watching"}
        </p>
      </div>

      {streamsQuery.isLoading ? (
        <Skeleton className="aspect-video w-full rounded-xl" aria-hidden />
      ) : null}

      {streamsQuery.isError ? (
        <QueryErrorState
          title="Could not load playback sources"
          message={streamsQuery.error instanceof Error ? streamsQuery.error.message : undefined}
        />
      ) : null}

      {!streamsQuery.isLoading && !streamsQuery.isError && allSources.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No sources available"
          description="Try another add-on or check back later."
        />
      ) : null}

      {activeSource?.playable === "vidstack" && activeSource.resolved.stream.url ? (
        <VidstackPlayer
          title={displayTitle}
          url={activeSource.resolved.stream.url}
          poster={poster}
          resumePosition={resumePosition}
          textTracks={textTracks}
          defaultTextTrackId={textTrackId}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onSeeked={handleSeeked}
          onEnded={handleEnded}
        />
      ) : null}

      {activeSource?.playable === "youtube" && activeSource.resolved.stream.ytId ? (
        <YouTubeWatchPlayer
          title={displayTitle}
          ytId={activeSource.resolved.stream.ytId}
          poster={poster}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onSeeked={handleSeeked}
          onEnded={handleEnded}
        />
      ) : null}

      {selectedSource && !selectedSource.playable ? (
        <p className="text-sm text-destructive" role="alert">
          {selectedSource.disableReason ?? "This source cannot be played in the browser."}
        </p>
      ) : null}

      {!streamsQuery.isLoading && !streamsQuery.isError && allSources.length > 0 ? (
        <section aria-labelledby="watch-sources-heading" className="space-y-3">
          <h2 id="watch-sources-heading" className="text-lg font-semibold">
            Sources
          </h2>
          <SourcesList
            groups={groups}
            selectedSourceId={selectedSourceId}
            onSelect={handleSelectSource}
            name="watch-sources"
          />
        </section>
      ) : null}

      {subtitlesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading subtitles…
        </p>
      ) : null}

      {textTracks.length > 0 ? (
        <section aria-labelledby="watch-subtitles-heading" className="space-y-2">
          <h2 id="watch-subtitles-heading" className="text-lg font-semibold">
            Subtitles
          </h2>
          <div role="radiogroup" aria-label="Subtitle tracks" className="space-y-2">
            {textTracks.map((track) => (
              <label
                key={track.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <input
                  type="radio"
                  name="subtitle-track"
                  value={track.id}
                  checked={textTrackId === track.id}
                  onChange={() => setTextTrackId(track.id)}
                />
                <span className="text-sm">{track.label}</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {streamsQuery.data?.warnings.length ? (
        <AddonWarnings warnings={streamsQuery.data.warnings} />
      ) : null}
      {subtitlesQuery.data?.warnings.length ? (
        <AddonWarnings warnings={subtitlesQuery.data.warnings} />
      ) : null}

      <KeyboardHelp open={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />
    </div>
  );
}
