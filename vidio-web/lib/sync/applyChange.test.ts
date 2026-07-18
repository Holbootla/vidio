import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { Profile } from "@/lib/api/schemas";
import { applySyncChange } from "@/lib/sync/applyChange";
import { addonListFixture, defaultPreferences } from "@/test/fixtures/settings";
import { libraryEntries, PROFILE_ID } from "@/test/fixtures/browse";
import { continueWatchingFixture } from "@/test/fixtures/playback";
import {
  addonDeleteChange,
  addonSyncChange,
  libraryDeleteChange,
  librarySyncChange,
  malformedLibraryChange,
  preferencesSyncChange,
  progressDeleteChange,
  progressSyncChange,
} from "@/test/fixtures/sync";
import { OTHER_PROFILE_ID } from "@/test/fixtures/sync";

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("applySyncChange", () => {
  it("upserts and deletes library entries without refetching", () => {
    const queryClient = createClient();
    const context = { profileId: PROFILE_ID, queryClient };

    applySyncChange(librarySyncChange, context);
    expect(queryClient.getQueryData(queryKeys.library(PROFILE_ID))).toEqual([libraryEntries[0]]);

    applySyncChange(libraryDeleteChange, context);
    expect(queryClient.getQueryData(queryKeys.library(PROFILE_ID))).toEqual([]);
  });

  it("upserts and deletes continue watching entries", () => {
    const queryClient = createClient();
    const context = { profileId: PROFILE_ID, queryClient };

    applySyncChange(progressSyncChange, context);
    expect(queryClient.getQueryData(queryKeys.continueWatching(PROFILE_ID))).toEqual(
      continueWatchingFixture,
    );

    applySyncChange(progressDeleteChange, context);
    expect(queryClient.getQueryData(queryKeys.continueWatching(PROFILE_ID))).toEqual([]);
  });

  it("replaces preferences and updates profile", () => {
    const queryClient = createClient();
    let profile: Profile = {
      id: PROFILE_ID,
      user_id: "11111111-1111-7111-8111-111111111111",
      name: "Main",
      is_default: true,
      preferences: defaultPreferences,
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    applySyncChange(preferencesSyncChange, {
      profileId: PROFILE_ID,
      queryClient,
      getProfile: () => profile,
      setProfile: (next) => {
        profile = next;
      },
    });

    expect(queryClient.getQueryData(queryKeys.preferences(PROFILE_ID))).toEqual(
      preferencesSyncChange.payload,
    );
    expect(profile.preferences.locale).toBe("fr-FR");
  });

  it("upserts and deletes addons", () => {
    const queryClient = createClient();
    const context = { profileId: PROFILE_ID, queryClient };

    applySyncChange(addonSyncChange, context);
    expect(queryClient.getQueryData(queryKeys.addons(PROFILE_ID))).toEqual([addonListFixture[0]]);

    applySyncChange(addonDeleteChange, context);
    expect(queryClient.getQueryData(queryKeys.addons(PROFILE_ID))).toEqual([]);
  });

  it("skips foreign profile changes", () => {
    const queryClient = createClient();
    const result = applySyncChange(
      { ...librarySyncChange, profile_id: OTHER_PROFILE_ID },
      { profileId: PROFILE_ID, queryClient },
    );
    expect(result.skipped).toBe(true);
    expect(queryClient.getQueryData(queryKeys.library(PROFILE_ID))).toBeUndefined();
  });

  it("tolerates malformed library payloads", () => {
    const queryClient = createClient();
    const result = applySyncChange(malformedLibraryChange, {
      profileId: PROFILE_ID,
      queryClient,
    });
    expect(result.skipped).toBe(true);
  });
});
