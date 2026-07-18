import { z } from "zod";

const rfc3339 = z.string().datetime({ offset: true });
const uuid = z.uuid();

export const problemJsonSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
});

export type ProblemJson = z.infer<typeof problemJsonSchema>;

export const userStatusSchema = z.enum(["pending_verification", "active", "disabled"]);

export const userDtoSchema = z.object({
  id: uuid,
  email: z.string().email(),
  status: userStatusSchema,
  created_at: rfc3339,
});

export type UserDto = z.infer<typeof userDtoSchema>;

export const profilePreferencesSchema = z.object({
  locale: z.string(),
  subtitle_languages: z.array(z.string()),
  audio_languages: z.array(z.string()),
  preferred_qualities: z.array(z.string()),
  hide_p2p_streams: z.boolean(),
});

export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;

export const profileSchema = z.object({
  id: uuid,
  user_id: uuid,
  name: z.string(),
  is_default: z.boolean(),
  preferences: profilePreferencesSchema,
  version: z.number().int().nonnegative(),
  created_at: rfc3339,
  updated_at: rfc3339,
});

export type Profile = z.infer<typeof profileSchema>;

export const authResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  access_expires_at: rfc3339,
  refresh_token: z.string(),
  refresh_expires_at: rfc3339,
  profile: profileSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const registerResponseSchema = z.object({
  user: userDtoSchema,
  profile: profileSchema,
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device: z
    .object({
      platform: z.string().optional(),
      display_name: z.string().optional(),
      app_version: z.string().optional(),
    })
    .optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  profile_name: z.string().min(1).max(60).optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const clientAuthSessionSchema = z.object({
  access_token: z.string(),
  access_expires_at: rfc3339,
  profile: profileSchema,
  user: userDtoSchema.optional(),
});

export type ClientAuthSession = z.infer<typeof clientAuthSessionSchema>;

export const metaPreviewSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  poster: z.string().optional(),
  posterShape: z.string().optional(),
  description: z.string().optional(),
  releaseInfo: z.string().optional(),
  imdbRating: z.string().optional(),
  genres: z.array(z.string()).default([]),
});

export type MetaPreview = z.infer<typeof metaPreviewSchema>;

export const videoSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  released: z.string().optional(),
  season: z.number().int().optional(),
  episode: z.number().int().optional(),
  thumbnail: z.string().optional(),
  overview: z.string().optional(),
});

export type Video = z.infer<typeof videoSchema>;

export const metaSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  poster: z.string().optional(),
  background: z.string().optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  releaseInfo: z.string().optional(),
  runtime: z.string().optional(),
  imdbRating: z.string().optional(),
  genres: z.array(z.string()).default([]),
  videos: z.array(videoSchema).default([]),
});

export type Meta = z.infer<typeof metaSchema>;

export const addonWarningSchema = z.object({
  installation_id: uuid,
  addon_name: z.string(),
  message: z.string(),
});

export type AddonWarning = z.infer<typeof addonWarningSchema>;

export const catalogRowSchema = z.object({
  installation_id: uuid,
  addon_name: z.string(),
  catalog_id: z.string(),
  content_type: z.string(),
  title: z.string(),
  items: z.array(metaPreviewSchema),
});

export type CatalogRow = z.infer<typeof catalogRowSchema>;

export const discoveryResponseSchema = z.object({
  rows: z.array(catalogRowSchema),
  warnings: z.array(addonWarningSchema),
});

export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;

export const playbackProgressSchema = z.object({
  profile_id: uuid,
  video_key: z.string(),
  media_key: z.string(),
  position_secs: z.number(),
  duration_secs: z.number(),
  watched: z.boolean(),
  revision: z.number().int().nonnegative(),
  last_device_id: uuid.nullable().optional(),
  updated_at: rfc3339,
});

export type PlaybackProgress = z.infer<typeof playbackProgressSchema>;

export const progressRequestSchema = z.object({
  content_type: z.string(),
  video_id: z.string(),
  media_id: z.string(),
  manifest_id: z.string(),
  position_secs: z.number(),
  duration_secs: z.number(),
  watched: z.boolean().optional(),
  device_id: uuid.optional(),
});

export type ProgressRequest = z.infer<typeof progressRequestSchema>;

export const libraryEntrySchema = z.object({
  profile_id: uuid,
  media_key: z.string(),
  media_type: z.string(),
  name: z.string(),
  poster: z.string().nullable().optional(),
  meta_snapshot: z.string().nullable().optional(),
  removed: z.boolean(),
  added_at: rfc3339,
  updated_at: rfc3339,
});

export type LibraryEntry = z.infer<typeof libraryEntrySchema>;

export const addLibraryRequestSchema = z.object({
  content_type: z.string(),
  content_id: z.string(),
  manifest_id: z.string(),
  name: z.string(),
  poster: z.string().optional(),
  meta_snapshot: z.string().optional(),
});

export type AddLibraryRequest = z.infer<typeof addLibraryRequestSchema>;

export const addonCapabilitiesSchema = z.object({
  resources: z.array(z.string()),
  types: z.array(z.string()),
  id_prefixes: z.array(z.string()),
});

export const addonDtoSchema = z.object({
  id: uuid,
  manifest_id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  priority: z.number().int(),
  capabilities: addonCapabilitiesSchema,
  installed_at: rfc3339,
  updated_at: rfc3339,
});

export type AddonDto = z.infer<typeof addonDtoSchema>;

export const subtitleSchema = z.object({
  id: z.string(),
  url: z.string(),
  lang: z.string(),
});

export type Subtitle = z.infer<typeof subtitleSchema>;

export const streamBehaviorHintsSchema = z.object({
  notWebReady: z.boolean().optional(),
  bingeGroup: z.string().optional(),
  countryWhitelist: z.array(z.string()).default([]),
  proxyHeaders: z
    .object({
      request: z.record(z.string(), z.string()).optional(),
      response: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  videoHash: z.string().optional(),
  videoSize: z.number().int().optional(),
  filename: z.string().optional(),
});

export type StreamBehaviorHints = z.infer<typeof streamBehaviorHintsSchema>;

export const streamSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  ytId: z.string().optional(),
  infoHash: z.string().optional(),
  fileIdx: z.number().int().optional(),
  externalUrl: z.string().optional(),
  sources: z.array(z.string()).default([]),
  subtitles: z.array(subtitleSchema).default([]),
  behaviorHints: streamBehaviorHintsSchema.optional(),
});

export type Stream = z.infer<typeof streamSchema>;

export const streamKindSchema = z.enum(["url", "youtube", "torrent", "external", "unknown"]);

export type StreamKind = z.infer<typeof streamKindSchema>;

export const resolvedStreamSchema = z.object({
  installation_id: uuid,
  addon_name: z.string(),
  kind: streamKindSchema,
  is_web_ready: z.boolean(),
  supported: z.boolean(),
  stream: streamSchema,
});

export type ResolvedStream = z.infer<typeof resolvedStreamSchema>;

export const streamResolutionSchema = z.object({
  streams: z.array(resolvedStreamSchema),
  warnings: z.array(addonWarningSchema),
});

export type StreamResolution = z.infer<typeof streamResolutionSchema>;

export const resolvedSubtitleSchema = z.object({
  installation_id: uuid,
  addon_name: z.string(),
  subtitle: subtitleSchema,
});

export type ResolvedSubtitle = z.infer<typeof resolvedSubtitleSchema>;

export const subtitleResolutionSchema = z.object({
  subtitles: z.array(resolvedSubtitleSchema),
  warnings: z.array(addonWarningSchema),
});

export type SubtitleResolution = z.infer<typeof subtitleResolutionSchema>;

export const libraryEntriesSchema = z.array(libraryEntrySchema);
export const playbackProgressListSchema = z.array(playbackProgressSchema);
export const addonListSchema = z.array(addonDtoSchema);
