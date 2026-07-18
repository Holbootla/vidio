import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AddonDto,
  LibraryEntry,
  PlaybackProgress,
  Profile,
  ProfilePreferences,
} from "@/lib/api/schemas";
import { parseSyncChangePayload, type SyncChange } from "@/lib/sync/schemas";

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
        const entry = parsed.payload;
        context.queryClient.setQueryData<LibraryEntry[]>(libraryKey, (current) =>
          upsertLibraryEntry(current, entry),
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
        const progress = parsed.payload;
        context.queryClient.setQueryData<PlaybackProgress[]>(cwKey, (current) =>
          upsertContinueWatching(current, progress),
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
        const preferences: ProfilePreferences = parsed.payload;
        context.queryClient.setQueryData(queryKeys.preferences(context.profileId), preferences);
        const profile = context.getProfile?.();
        if (profile && context.setProfile) {
          context.setProfile({ ...profile, preferences });
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
        const addon = parsed.payload;
        context.queryClient.setQueryData<AddonDto[]>(addonsKey, (current) =>
          upsertAddon(current, addon),
        );
        return { applied: true, skipped: false };
      }
      return { applied: false, skipped: true };
    }
    default:
      return { applied: false, skipped: true };
  }
}
