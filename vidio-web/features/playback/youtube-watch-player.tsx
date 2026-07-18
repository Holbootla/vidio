"use client";

import { useCallback } from "react";
import {
  isYouTubeProvider,
  MediaPlayer,
  MediaProvider,
  type MediaProviderAdapter,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

interface YouTubeWatchPlayerProps {
  title: string;
  ytId: string;
  poster?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPause?: (currentTime: number, duration: number) => void;
  onSeeked?: (currentTime: number, duration: number) => void;
  onEnded?: (duration: number) => void;
}

export function YouTubeWatchPlayer({
  title,
  ytId,
  poster,
  onTimeUpdate,
  onPause,
  onSeeked,
  onEnded,
}: YouTubeWatchPlayerProps) {
  const handleProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
    if (isYouTubeProvider(provider)) {
      provider.cookies = false;
    }
  }, []);

  return (
    <MediaPlayer
      className="aspect-video w-full overflow-hidden rounded-xl bg-black"
      title={title}
      src={{ src: ytId, type: "video/youtube" }}
      poster={poster}
      playsInline
      onProviderChange={handleProviderChange}
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
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
