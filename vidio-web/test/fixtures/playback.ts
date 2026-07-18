import { INSTALLATION_ID, MANIFEST_ID, PROFILE_ID, movieMeta } from "@/test/fixtures/browse";
import type {
  ResolvedStream,
  Stream,
  StreamResolution,
  SubtitleResolution,
} from "@/lib/api/schemas";

function stream(
  overrides: Omit<Stream, "sources" | "subtitles"> & Partial<Pick<Stream, "sources" | "subtitles">>,
): Stream {
  return {
    sources: [],
    subtitles: [],
    ...overrides,
  };
}

export const streamFixtures = {
  webReadyMp4: {
    installation_id: INSTALLATION_ID,
    addon_name: "Cinemeta",
    kind: "url" as const,
    is_web_ready: true,
    supported: true,
    stream: stream({
      title: "1080p",
      url: "https://example.com/video.mp4",
    }),
  },
  webReadyHls: {
    installation_id: INSTALLATION_ID,
    addon_name: "Cinemeta",
    kind: "url" as const,
    is_web_ready: true,
    supported: true,
    stream: stream({
      title: "720p HLS",
      url: "https://example.com/video.m3u8",
    }),
  },
  notWebReady: {
    installation_id: INSTALLATION_ID,
    addon_name: "Cinemeta",
    kind: "url" as const,
    is_web_ready: false,
    supported: true,
    stream: stream({
      title: "Proxied",
      url: "https://example.com/proxied.m3u8",
      behaviorHints: {
        notWebReady: true,
        countryWhitelist: [],
      },
    }),
  },
  torrent: {
    installation_id: INSTALLATION_ID,
    addon_name: "Torrent Add-on",
    kind: "torrent" as const,
    is_web_ready: false,
    supported: false,
    stream: stream({
      title: "1080p torrent",
      infoHash: "abc123",
      fileIdx: 0,
    }),
  },
  youtube: {
    installation_id: INSTALLATION_ID,
    addon_name: "YouTube",
    kind: "youtube" as const,
    is_web_ready: false,
    supported: true,
    stream: stream({
      title: "YouTube",
      ytId: "dQw4w9WgXcQ",
    }),
  },
  external: {
    installation_id: INSTALLATION_ID,
    addon_name: "External",
    kind: "external" as const,
    is_web_ready: false,
    supported: true,
    stream: stream({
      title: "Open elsewhere",
      externalUrl: "https://example.com/watch",
    }),
  },
  unknown: {
    installation_id: INSTALLATION_ID,
    addon_name: "Broken",
    kind: "unknown" as const,
    is_web_ready: false,
    supported: false,
    stream: stream({
      name: "Broken source",
    }),
  },
} satisfies Record<string, ResolvedStream>;

export const streamResolutionFixture: StreamResolution = {
  streams: [
    streamFixtures.webReadyMp4,
    streamFixtures.webReadyHls,
    streamFixtures.notWebReady,
    streamFixtures.torrent,
    streamFixtures.youtube,
    streamFixtures.external,
    streamFixtures.unknown,
  ],
  warnings: [],
};

export const subtitleResolutionFixture: SubtitleResolution = {
  subtitles: [
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      subtitle: {
        id: "eng",
        url: "https://example.com/subs-en.vtt",
        lang: "eng",
      },
    },
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      subtitle: {
        id: "spa",
        url: "https://example.com/subs-es.vtt",
        lang: "spa",
      },
    },
  ],
  warnings: [],
};

export const continueWatchingFixture = [
  {
    profile_id: PROFILE_ID,
    video_key: "movie:imdb:tt1254207",
    media_key: "movie:imdb:tt1254207",
    position_secs: 600,
    duration_secs: 3600,
    watched: false,
    revision: 2,
    last_device_id: null,
    updated_at: "2026-01-03T00:00:00Z",
  },
];

export const progressResponseFixture = {
  profile_id: PROFILE_ID,
  video_key: "movie:imdb:tt1254207",
  media_key: "movie:imdb:tt1254207",
  position_secs: 900,
  duration_secs: 3600,
  watched: false,
  revision: 3,
  last_device_id: null,
  updated_at: "2026-01-03T01:00:00Z",
};

export const watchProvenanceFixture = {
  mediaId: movieMeta.id,
  manifestId: MANIFEST_ID,
  installationId: INSTALLATION_ID,
};
