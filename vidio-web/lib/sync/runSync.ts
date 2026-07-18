import type { QueryClient } from "@tanstack/react-query";
import type { Profile } from "@/lib/api/schemas";
import { applySyncChange } from "@/lib/sync/applyChange";
import { getSyncCursor } from "@/lib/sync/cursor";
import { flushOfflineQueue } from "@/lib/sync/flush";
import { isBrowserOnline } from "@/lib/sync/online";
import { countQueuedMutations } from "@/lib/sync/offlineQueue";
import { pullSyncFeed } from "@/lib/sync/pull";

export interface RunSyncOptions {
  profileId: string;
  queryClient: QueryClient;
  setProfile?: (profile: Profile) => void;
  getProfile?: () => Profile | null;
  skipFlush?: boolean;
}

export interface RunSyncResult {
  online: boolean;
  queuedCount: number;
  flushed: number;
  discarded: Array<{ id: string; detail: string }>;
  halted: boolean;
  haltReason?: string;
  appliedCount: number;
  skippedCount: number;
  finalCursor: number;
  pageCount: number;
}

export async function runSync(options: RunSyncOptions): Promise<RunSyncResult> {
  const online = isBrowserOnline();
  const queuedCount = await countQueuedMutations(options.profileId);

  if (!online) {
    return {
      online: false,
      queuedCount,
      flushed: 0,
      discarded: [],
      halted: false,
      appliedCount: 0,
      skippedCount: 0,
      finalCursor: await getSyncCursor(options.profileId),
      pageCount: 0,
    };
  }

  let flushed = 0;
  let discarded: Array<{ id: string; detail: string }> = [];
  let halted = false;
  let haltReason: string | undefined;

  if (!options.skipFlush) {
    const flushResult = await flushOfflineQueue(options.profileId);
    flushed = flushResult.flushed;
    discarded = flushResult.discarded;
    halted = flushResult.halted;
    haltReason = flushResult.haltReason;
  }

  if (halted) {
    const cursor = await getSyncCursor(options.profileId);
    return {
      online: true,
      queuedCount: await countQueuedMutations(options.profileId),
      flushed,
      discarded,
      halted: true,
      haltReason,
      appliedCount: 0,
      skippedCount: 0,
      finalCursor: cursor,
      pageCount: 0,
    };
  }

  const after = await getSyncCursor(options.profileId);
  const pullResult = await pullSyncFeed({
    profileId: options.profileId,
    after,
    applyChange: (change) =>
      applySyncChange(change, {
        profileId: options.profileId,
        queryClient: options.queryClient,
        setProfile: options.setProfile,
        getProfile: options.getProfile,
      }),
  });

  return {
    online: true,
    queuedCount: await countQueuedMutations(options.profileId),
    flushed,
    discarded,
    halted: false,
    appliedCount: pullResult.appliedCount,
    skippedCount: pullResult.skippedCount,
    finalCursor: pullResult.finalCursor,
    pageCount: pullResult.pageCount,
  };
}
