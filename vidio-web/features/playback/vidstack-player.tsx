"use client";

import { useCallback } from "react";
import {
  isDASHProvider,
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type PlayerSrc,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import Hls from "hls.js";
import dashjs from "dashjs";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { detectStreamMimeType } from "@/lib/player/source-selection";

interface VidstackPlayerProps {
  title: string;
  url: string;
  poster?: string;
  resumePosition?: number | null;
  textTracks?: Array<{ id: string; src: string; label: string; language: string }>;
  defaultTextTrackId?: string | null;
  onReady?: (player: MediaPlayerInstance) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPause?: (currentTime: number, duration: number) => void;
  onSeeked?: (currentTime: number, duration: number) => void;
  onEnded?: (duration: number) => void;
}

export function VidstackPlayer({
  title,
  url,
  poster,
  resumePosition,
  textTracks = [],
  defaultTextTrackId,
  onReady,
  onTimeUpdate,
  onPause,
  onSeeked,
  onEnded,
}: VidstackPlayerProps) {
  const src: PlayerSrc = (() => {
    const mimeType = detectStreamMimeType(url);
    if (mimeType === "application/x-mpegurl") {
      return { src: url, type: mimeType };
    }
    if (mimeType === "application/dash+xml") {
      return { src: url, type: mimeType };
    }
    return url;
  })();

  const handleProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.library = Hls;
      provider.config = {
        preferManagedMediaSource: false,
      };
    }
    if (isDASHProvider(provider)) {
      provider.library = dashjs;
    }
  }, []);

  return (
    <MediaPlayer
      className="aspect-video w-full overflow-hidden rounded-xl bg-black"
      title={title}
      src={src}
      poster={poster}
      playsInline
      onProviderChange={handleProviderChange}
      onCanPlay={(_detail, event) => {
        const player = event.target;
        if (resumePosition && resumePosition > 0 && player.currentTime < 1) {
          player.currentTime = resumePosition;
        }
        onReady?.(player);
      }}
      onTimeUpdate={(detail, event) => {
        onTimeUpdate?.(detail.currentTime, event.target.duration);
      }}
      onPause={(event) => {
        const player = event.target;
        onPause?.(player.currentTime, player.duration);
      }}
      onSeeked={(currentTime, event) => {
        onSeeked?.(currentTime, event.target.duration);
      }}
      onEnd={(event) => {
        onEnded?.(event.target.duration);
      }}
    >
      <MediaProvider>
        {textTracks.map((track) => (
          <track
            key={track.id}
            kind="subtitles"
            src={track.src}
            label={track.label}
            srcLang={track.language}
            default={track.id === defaultTextTrackId}
          />
        ))}
      </MediaProvider>
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
