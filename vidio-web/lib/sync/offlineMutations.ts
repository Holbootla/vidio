import { buildMediaKey } from "@/lib/media/keys";
import type {
  AddLibraryRequest,
  LibraryEntry,
  PlaybackProgress,
  Profile,
  ProfilePreferences,
  ProgressRequest,
} from "@/lib/api/schemas";
import { isBrowserOnline } from "@/lib/sync/online";
import { enqueueOfflineMutation, type OfflineMutationPayload } from "@/lib/sync/offlineQueue";

export function shouldUseOfflineQueue(): boolean {
  return !isBrowserOnline();
}

export async function queueLibraryAdd(
  profileId: string,
  payload: AddLibraryRequest,
): Promise<void> {
  await enqueueOfflineMutation(profileId, { type: "library_add", body: payload });
}

export async function queueLibraryRemove(profileId: string, mediaKey: string): Promise<void> {
  await enqueueOfflineMutation(profileId, { type: "library_remove", mediaKey });
}

export async function queueProgress(profileId: string, payload: ProgressRequest): Promise<void> {
  await enqueueOfflineMutation(profileId, { type: "progress", body: payload });
}

export async function queuePreferences(
  profileId: string,
  payload: ProfilePreferences,
): Promise<void> {
  await enqueueOfflineMutation(profileId, { type: "preferences", body: payload });
}

export function offlineLibraryEntry(
  profileId: string,
  payload: AddLibraryRequest,
): LibraryEntry | null {
  const keyResult = buildMediaKey(payload.content_type, payload.manifest_id, payload.content_id);
  if (!keyResult.ok) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    profile_id: profileId,
    media_key: keyResult.key,
    media_type: payload.content_type,
    name: payload.name,
    poster: payload.poster ?? null,
    meta_snapshot: payload.meta_snapshot ?? null,
    removed: false,
    added_at: now,
    updated_at: now,
  };
}

export function offlinePlaybackProgress(
  profileId: string,
  payload: ProgressRequest,
  previous?: PlaybackProgress,
): PlaybackProgress | null {
  const keyResult = buildMediaKey(payload.content_type, payload.manifest_id, payload.video_id);
  if (!keyResult.ok) {
    return null;
  }
  const mediaKeyResult = buildMediaKey(payload.content_type, payload.manifest_id, payload.media_id);
  const now = new Date().toISOString();
  return {
    profile_id: profileId,
    video_key: keyResult.key,
    media_key: mediaKeyResult.ok ? mediaKeyResult.key : keyResult.key,
    position_secs: payload.position_secs,
    duration_secs: payload.duration_secs,
    watched: payload.watched ?? false,
    revision: (previous?.revision ?? 0) + 1,
    last_device_id: payload.device_id ?? null,
    updated_at: now,
  };
}

export function offlineProfileAfterPreferences(
  profile: Profile,
  preferences: ProfilePreferences,
): Profile {
  return {
    ...profile,
    preferences,
    updated_at: new Date().toISOString(),
    version: profile.version + 1,
  };
}

export type { OfflineMutationPayload };
