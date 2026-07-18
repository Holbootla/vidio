import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { Profile } from "@/lib/api/schemas";
import { applySyncChange } from "@/lib/sync/applyChange";
import { addonListFixture, defaultPreferences } from "@/test/fixtures/settings";
import { libraryEntries, PROFILE_ID } from "@/test/fixtures/browse";
import { continueWatchingFixture } from "@/test/fixtures/playback";
import {
  addonDeleteChange,
  addonSyncChange,
  addonSyncPayload,
  libraryDeleteChange,
  librarySyncChange,
  librarySyncPayload,
  malformedLibraryChange,
  preferencesSyncChange,
  preferencesSyncPayload,
  progressDeleteChange,
  progressSyncChange,
  progressSyncPayload,
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
    expect(queryClient.getQueryData(queryKeys.library(PROFILE_ID))).toEqual([
      {
        ...libraryEntries[0],
        added_at: librarySyncChange.created_at,
        updated_at: librarySyncChange.created_at,
      },
    ]);

    applySyncChange(libraryDeleteChange, context);
    expect(queryClient.getQueryData(queryKeys.library(PROFILE_ID))).toEqual([]);
  });

  it("preserves optional library fields when merging partial sync payloads", () => {
    const queryClient = createClient();
    const existing = {
      ...libraryEntries[0]!,
      meta_snapshot: '{"name":"Cached"}',
      added_at: "2025-12-01T00:00:00Z",
    };
    queryClient.setQueryData(queryKeys.library(PROFILE_ID), [existing]);

    applySyncChange(
      {
        ...librarySyncChange,
        payload: { ...librarySyncPayload, name: "Renamed" },
      },
      { profileId: PROFILE_ID, queryClient },
    );

    expect(queryClient.getQueryData(queryKeys.library(PROFILE_ID))).toEqual([
      {
        ...existing,
        name: "Renamed",
        updated_at: librarySyncChange.created_at,
      },
    ]);
  });

  it("upserts and deletes continue watching entries", () => {
    const queryClient = createClient();
    const context = { profileId: PROFILE_ID, queryClient };

    applySyncChange(progressSyncChange, context);
    expect(queryClient.getQueryData(queryKeys.continueWatching(PROFILE_ID))).toEqual([
      {
        ...continueWatchingFixture[0],
        updated_at: progressSyncChange.created_at,
      },
    ]);

    applySyncChange(progressDeleteChange, context);
    expect(queryClient.getQueryData(queryKeys.continueWatching(PROFILE_ID))).toEqual([]);
  });

  it("preserves last_device_id when merging partial progress payloads", () => {
    const queryClient = createClient();
    const deviceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    queryClient.setQueryData(queryKeys.continueWatching(PROFILE_ID), [
      { ...continueWatchingFixture[0]!, last_device_id: deviceId },
    ]);

    applySyncChange(
      {
        ...progressSyncChange,
        payload: { ...progressSyncPayload, position_secs: 1200 },
      },
      { profileId: PROFILE_ID, queryClient },
    );

    expect(
      queryClient.getQueryData<typeof continueWatchingFixture>(
        queryKeys.continueWatching(PROFILE_ID),
      ),
    ).toEqual([
      {
        ...continueWatchingFixture[0],
        position_secs: 1200,
        last_device_id: deviceId,
        updated_at: progressSyncChange.created_at,
      },
    ]);
  });

  it("removes progress marked watched from continue watching", () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.continueWatching(PROFILE_ID), [continueWatchingFixture[0]]);

    applySyncChange(
      {
        ...progressSyncChange,
        payload: { ...progressSyncPayload, watched: true },
      },
      { profileId: PROFILE_ID, queryClient },
    );

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
      preferencesSyncPayload.preferences,
    );
    expect(profile.preferences.locale).toBe("fr-FR");
    expect(profile.version).toBe(2);
    expect(profile.updated_at).toBe(preferencesSyncChange.created_at);
  });

  it("merges addon changes when cache has the installation", () => {
    const queryClient = createClient();
    const context = { profileId: PROFILE_ID, queryClient };
    queryClient.setQueryData(queryKeys.addons(PROFILE_ID), [...addonListFixture]);

    applySyncChange(
      {
        ...addonSyncChange,
        payload: { ...addonSyncPayload, name: "Renamed Cinemeta", priority: 5 },
      },
      context,
    );

    expect(queryClient.getQueryData(queryKeys.addons(PROFILE_ID))).toEqual([
      { ...addonListFixture[1] },
      { ...addonListFixture[0]!, name: "Renamed Cinemeta", priority: 5 },
    ]);
  });

  it("invalidates addons when partial payload has no cached installation", () => {
    const queryClient = createClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    applySyncChange(addonSyncChange, { profileId: PROFILE_ID, queryClient });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.addons(PROFILE_ID),
    });
    expect(queryClient.getQueryData(queryKeys.addons(PROFILE_ID))).toBeUndefined();
  });

  it("deletes addons from cache", () => {
    const queryClient = createClient();
    const context = { profileId: PROFILE_ID, queryClient };
    queryClient.setQueryData(queryKeys.addons(PROFILE_ID), [...addonListFixture]);

    applySyncChange(addonDeleteChange, context);
    expect(queryClient.getQueryData(queryKeys.addons(PROFILE_ID))).toEqual([addonListFixture[1]]);
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
