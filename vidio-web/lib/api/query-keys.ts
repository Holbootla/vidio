export const queryKeys = {
  me: ["me"] as const,
  profiles: ["profiles"] as const,
  profile: (profileId: string) => ["profiles", profileId] as const,
  addons: (profileId: string) => ["addons", profileId] as const,
  home: (profileId: string) => ["home", profileId] as const,
  search: (profileId: string, query: string) => ["search", profileId, query] as const,
  meta: (profileId: string, contentType: string, id: string) =>
    ["meta", profileId, contentType, id] as const,
  library: (profileId: string) => ["library", profileId] as const,
  continueWatching: (profileId: string) => ["continueWatching", profileId] as const,
  streams: (profileId: string, contentType: string, videoId: string) =>
    ["streams", profileId, contentType, videoId] as const,
  subtitles: (profileId: string, contentType: string, id: string) =>
    ["subtitles", profileId, contentType, id] as const,
  preferences: (profileId: string) => ["preferences", profileId] as const,
};
