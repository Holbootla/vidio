import { continueWatchingFixture } from "@/test/fixtures/playback";
import { libraryEntries, PROFILE_ID } from "@/test/fixtures/browse";
import { addonListFixture, defaultPreferences } from "@/test/fixtures/settings";
import type { SyncChange, SyncPage } from "@/lib/sync/schemas";

export const OTHER_PROFILE_ID = "99999999-9999-7999-8999-999999999999";

const libraryEntry = libraryEntries[0]!;
const progressEntry = continueWatchingFixture[0]!;
const addonEntry = addonListFixture[0]!;

export const librarySyncChange: SyncChange = {
  sequence: 1,
  profile_id: PROFILE_ID,
  kind: "library",
  key: libraryEntry.media_key,
  payload: libraryEntry,
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

export const progressSyncChange: SyncChange = {
  sequence: 3,
  profile_id: PROFILE_ID,
  kind: "progress",
  key: progressEntry.video_key,
  payload: progressEntry,
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

export const preferencesSyncChange: SyncChange = {
  sequence: 5,
  profile_id: PROFILE_ID,
  kind: "preferences",
  key: "preferences",
  payload: { ...defaultPreferences, locale: "fr-FR" },
  deleted: false,
  created_at: "2026-01-04T00:00:00Z",
};

export const addonSyncChange: SyncChange = {
  sequence: 6,
  profile_id: PROFILE_ID,
  kind: "addon",
  key: addonEntry.id,
  payload: addonEntry,
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
