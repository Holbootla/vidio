import { apiGet, apiPut } from "@/lib/api/client";
import { profilePath } from "@/lib/api/profile-path";
import {
  playbackProgressSchema,
  progressRequestSchema,
  streamResolutionSchema,
  subtitleResolutionSchema,
  type ProgressRequest,
} from "@/lib/api/schemas";

export function fetchStreams(profileId: string, contentType: string, videoId: string) {
  return apiGet(
    profilePath(
      profileId,
      `/streams/${encodeURIComponent(contentType)}/${encodeURIComponent(videoId)}`,
    ),
    streamResolutionSchema,
  );
}

export function fetchSubtitles(profileId: string, contentType: string, id: string) {
  return apiGet(
    profilePath(
      profileId,
      `/subtitles/${encodeURIComponent(contentType)}/${encodeURIComponent(id)}`,
    ),
    subtitleResolutionSchema,
  );
}

export function putProgress(profileId: string, payload: ProgressRequest) {
  const body = progressRequestSchema.parse(payload);
  return apiPut(profilePath(profileId, "/progress"), body, playbackProgressSchema);
}
