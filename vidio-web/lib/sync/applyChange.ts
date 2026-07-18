import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AddonDto,
  LibraryEntry,
  PlaybackProgress,
  Profile,
  ProfilePreferences,
} from "@/lib/api/schemas";
import {
  parseSyncChangePayload,
  type SyncAddonPayload,
  type SyncChange,
  type SyncLibraryPayload,
  type SyncProgressPayload,
} from "@/lib/sync/schemas";

export interface ApplyChangeContext {
  profileId: string;
  queryClient: QueryClient;
  setProfile?: (profile: Profile) => void;
  getProfile?: () => Profile | null;
}

export interface ApplyChangeResult {
  applied: boolean;
  skipped: boolean;
}

function upsertLibraryEntry(
  entries: LibraryEntry[] | undefined,
  entry: LibraryEntry,
): LibraryEntry[] {
  const current = entries ?? [];
  const without = current.filter((item) => item.media_key !== entry.media_key);
  if (entry.removed) {
    return without;
  }
  return [...without, entry];
}

function removeLibraryEntry(entries: LibraryEntry[] | undefined, mediaKey: string): LibraryEntry[] {
  return (entries ?? []).filter((item) => item.media_key !== mediaKey);
}

function upsertContinueWatching(
  entries: PlaybackProgress[] | undefined,
  progress: PlaybackProgress,
): PlaybackProgress[] {
  const current = entries ?? [];
  const without = current.filter((entry) => entry.video_key !== progress.video_key);
  if (progress.watched) {
    return without;
  }
  const next = [progress, ...without];
  return next.slice(0, 50);
}

function removeContinueWatching(
  entries: PlaybackProgress[] | undefined,
  videoKey: string,
): PlaybackProgress[] {
  return (entries ?? []).filter((entry) => entry.video_key !== videoKey);
}

function upsertAddon(addons: AddonDto[] | undefined, addon: AddonDto): AddonDto[] {
  const current = addons ?? [];
  const without = current.filter((item) => item.id !== addon.id);
  return [...without, addon].sort((a, b) => a.priority - b.priority);
}

function removeAddon(addons: AddonDto[] | undefined, installationId: string): AddonDto[] {
  return (addons ?? []).filter((item) => item.id !== installationId);
}

function mergeLibraryEntry(
  change: SyncChange,
  partial: SyncLibraryPayload,
  existing?: LibraryEntry,
): LibraryEntry {
  return {
    profile_id: change.profile_id,
    media_key: partial.media_key,
    media_type: partial.type,
    name: partial.name,
    poster: partial.poster ?? existing?.poster ?? null,
    meta_snapshot: existing?.meta_snapshot ?? null,
    removed: false,
    added_at: existing?.added_at ?? change.created_at,
    updated_at: change.created_at,
  };
}

function mergeProgressEntry(
  change: SyncChange,
  partial: SyncProgressPayload,
  existing?: PlaybackProgress,
): PlaybackProgress {
  return {
    profile_id: change.profile_id,
    video_key: partial.video_key,
    media_key: partial.media_key,
    position_secs: partial.position_secs,
    duration_secs: partial.duration_secs,
    watched: partial.watched,
    revision: partial.revision,
    last_device_id: existing?.last_device_id ?? null,
    updated_at: change.created_at,
  };
}

function mergeAddon(partial: SyncAddonPayload, existing?: AddonDto): AddonDto | null {
  if (!existing) {
    return null;
  }
  return {
    ...existing,
    manifest_id: partial.manifest_id,
    name: partial.name,
    version: partial.version,
    enabled: partial.enabled,
    priority: partial.priority,
  };
}

export function applySyncChange(
  change: SyncChange,
  context: ApplyChangeContext,
): ApplyChangeResult {
  if (change.profile_id !== context.profileId) {
    return { applied: false, skipped: true };
  }

  const parsed = parseSyncChangePayload(change);

  if (!parsed && !change.deleted) {
    return { applied: false, skipped: true };
  }

  switch (change.kind) {
    case "library": {
      const libraryKey = queryKeys.library(context.profileId);
      if (change.deleted || parsed?.payload === null) {
        context.queryClient.setQueryData<LibraryEntry[]>(libraryKey, (current) =>
          removeLibraryEntry(current, change.key),
        );
        return { applied: true, skipped: false };
      }
      if (parsed?.kind === "library" && parsed.payload) {
        const partial = parsed.payload;
        const current = context.queryClient.getQueryData<LibraryEntry[]>(libraryKey);
        const existing = current?.find((item) => item.media_key === partial.media_key);
        const entry = mergeLibraryEntry(change, partial, existing);
        context.queryClient.setQueryData<LibraryEntry[]>(libraryKey, (entries) =>
          upsertLibraryEntry(entries, entry),
        );
        return { applied: true, skipped: false };
      }
      return { applied: false, skipped: true };
    }
    case "progress": {
      const cwKey = queryKeys.continueWatching(context.profileId);
      if (change.deleted || parsed?.payload === null) {
        context.queryClient.setQueryData<PlaybackProgress[]>(cwKey, (current) =>
          removeContinueWatching(current, change.key),
        );
        return { applied: true, skipped: false };
      }
      if (parsed?.kind === "progress" && parsed.payload) {
        const partial = parsed.payload;
        const current = context.queryClient.getQueryData<PlaybackProgress[]>(cwKey);
        const existing = current?.find((item) => item.video_key === partial.video_key);
        const progress = mergeProgressEntry(change, partial, existing);
        context.queryClient.setQueryData<PlaybackProgress[]>(cwKey, (entries) =>
          upsertContinueWatching(entries, progress),
        );
        return { applied: true, skipped: false };
      }
      return { applied: false, skipped: true };
    }
    case "preferences": {
      if (change.deleted || parsed?.payload === null) {
        return { applied: false, skipped: true };
      }
      if (parsed?.kind === "preferences" && parsed.payload) {
        const preferences: ProfilePreferences = parsed.payload.preferences;
        context.queryClient.setQueryData(queryKeys.preferences(context.profileId), preferences);
        const profile = context.getProfile?.();
        if (profile && context.setProfile) {
          context.setProfile({
            ...profile,
            name: parsed.payload.name,
            preferences,
            version: parsed.payload.version,
            updated_at: change.created_at,
          });
        }
        return { applied: true, skipped: false };
      }
      return { applied: false, skipped: true };
    }
    case "addon": {
      const addonsKey = queryKeys.addons(context.profileId);
      if (change.deleted || parsed?.payload === null) {
        context.queryClient.setQueryData<AddonDto[]>(addonsKey, (current) =>
          removeAddon(current, change.key),
        );
        return { applied: true, skipped: false };
      }
      if (parsed?.kind === "addon" && parsed.payload) {
        const partial = parsed.payload;
        const current = context.queryClient.getQueryData<AddonDto[]>(addonsKey);
        const existing = current?.find((item) => item.id === partial.id);
        const merged = mergeAddon(partial, existing);
        if (merged) {
          context.queryClient.setQueryData<AddonDto[]>(addonsKey, (addons) =>
            upsertAddon(addons, merged),
          );
        } else {
          void context.queryClient.invalidateQueries({ queryKey: addonsKey });
        }
        return { applied: true, skipped: false };
      }
      return { applied: false, skipped: true };
    }
    default:
      return { applied: false, skipped: true };
  }
}
