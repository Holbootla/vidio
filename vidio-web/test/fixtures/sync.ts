import { continueWatchingFixture } from "@/test/fixtures/playback";
import { libraryEntries, PROFILE_ID } from "@/test/fixtures/browse";
import { addonListFixture, defaultPreferences } from "@/test/fixtures/settings";
import type { SyncChange, SyncPage } from "@/lib/sync/schemas";

export const OTHER_PROFILE_ID = "99999999-9999-7999-8999-999999999999";

const libraryEntry = libraryEntries[0]!;
const progressEntry = continueWatchingFixture[0]!;
const addonEntry = addonListFixture[0]!;

export const librarySyncPayload = {
  media_key: libraryEntry.media_key,
  type: libraryEntry.media_type,
  name: libraryEntry.name,
  poster: libraryEntry.poster,
};

export const librarySyncChange: SyncChange = {
  sequence: 1,
  profile_id: PROFILE_ID,
  kind: "library",
  key: libraryEntry.media_key,
  payload: librarySyncPayload,
  deleted: false,
  created_at: "2026-01-02T00:00:00Z",
};

export const libraryDeleteChange: SyncChange = {
  sequence: 2,
  profile_id: PROFILE_ID,
  kind: "library",
  key: libraryEntry.media_key,
  payload: null,
  deleted: true,
  created_at: "2026-01-02T01:00:00Z",
};

export const progressSyncPayload = {
  video_key: progressEntry.video_key,
  media_key: progressEntry.media_key,
  position_secs: progressEntry.position_secs,
  duration_secs: progressEntry.duration_secs,
  watched: progressEntry.watched,
  revision: progressEntry.revision,
};

export const progressSyncChange: SyncChange = {
  sequence: 3,
  profile_id: PROFILE_ID,
  kind: "progress",
  key: progressEntry.video_key,
  payload: progressSyncPayload,
  deleted: false,
  created_at: "2026-01-03T00:00:00Z",
};

export const progressDeleteChange: SyncChange = {
  sequence: 4,
  profile_id: PROFILE_ID,
  kind: "progress",
  key: progressEntry.video_key,
  payload: null,
  deleted: true,
  created_at: "2026-01-03T01:00:00Z",
};

export const preferencesSyncPayload = {
  name: "Main",
  preferences: { ...defaultPreferences, locale: "fr-FR" },
  version: 2,
};

export const preferencesSyncChange: SyncChange = {
  sequence: 5,
  profile_id: PROFILE_ID,
  kind: "preferences",
  key: "profile",
  payload: preferencesSyncPayload,
  deleted: false,
  created_at: "2026-01-04T00:00:00Z",
};

export const addonSyncPayload = {
  id: addonEntry.id,
  manifest_id: addonEntry.manifest_id,
  name: addonEntry.name,
  version: addonEntry.version,
  enabled: addonEntry.enabled,
  priority: addonEntry.priority,
};

export const addonSyncChange: SyncChange = {
  sequence: 6,
  profile_id: PROFILE_ID,
  kind: "addon",
  key: addonEntry.id,
  payload: addonSyncPayload,
  deleted: false,
  created_at: "2026-01-05T00:00:00Z",
};

export const addonDeleteChange: SyncChange = {
  sequence: 7,
  profile_id: PROFILE_ID,
  kind: "addon",
  key: addonEntry.id,
  payload: null,
  deleted: true,
  created_at: "2026-01-05T01:00:00Z",
};

export const malformedLibraryChange: SyncChange = {
  sequence: 8,
  profile_id: PROFILE_ID,
  kind: "library",
  key: "movie:imdb:bad",
  payload: { invalid: true },
  deleted: false,
  created_at: "2026-01-06T00:00:00Z",
};

export function syncPage(
  changes: SyncChange[],
  latestSequence: number,
  hasMore: boolean,
): SyncPage {
  return {
    changes,
    latest_sequence: latestSequence,
    has_more: hasMore,
  };
}
