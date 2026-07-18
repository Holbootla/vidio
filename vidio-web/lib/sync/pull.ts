import { apiGet } from "@/lib/api/client";
import { profilePath } from "@/lib/api/profile-path";
import { setSyncCursor } from "@/lib/sync/cursor";
import { syncPageSchema, type SyncChange } from "@/lib/sync/schemas";

export const SYNC_PAGE_LIMIT = 100;

export function fetchSyncPage(profileId: string, after: number, limit = SYNC_PAGE_LIMIT) {
  const params = new URLSearchParams({
    after: String(after),
    limit: String(limit),
  });
  return apiGet(profilePath(profileId, `/sync?${params.toString()}`), syncPageSchema);
}

export interface PullSyncResult {
  appliedCount: number;
  skippedCount: number;
  finalCursor: number;
  pageCount: number;
}

export async function pullSyncFeed(options: {
  profileId: string;
  after: number;
  applyChange: (change: SyncChange) => { applied: boolean; skipped: boolean };
}): Promise<PullSyncResult> {
  let cursor = options.after;
  let appliedCount = 0;
  let skippedCount = 0;
  let pageCount = 0;
  let finalCursor = cursor;

  while (true) {
    const page = await fetchSyncPage(options.profileId, cursor, SYNC_PAGE_LIMIT);
    pageCount += 1;

    for (const change of page.changes) {
      const result = options.applyChange(change);
      if (result.applied) {
        appliedCount += 1;
      }
      if (result.skipped) {
        skippedCount += 1;
      }
    }

    if (!page.has_more) {
      finalCursor = page.latest_sequence;
      await setSyncCursor(options.profileId, finalCursor);
      break;
    }

    const lastSequence = page.changes.at(-1)?.sequence;
    if (lastSequence === undefined) {
      break;
    }

    finalCursor = lastSequence;
    await setSyncCursor(options.profileId, finalCursor);
    cursor = lastSequence;
  }

  return { appliedCount, skippedCount, finalCursor, pageCount };
}
