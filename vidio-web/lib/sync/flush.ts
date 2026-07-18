import { ApiError } from "@/lib/api/errors";
import { addLibraryItem, removeLibraryItem } from "@/features/library/api";
import { putProgress } from "@/features/playback/api";
import { updatePreferences } from "@/features/settings/api";
import {
  listQueuedMutations,
  removeQueuedMutation,
  type QueuedMutationRecord,
} from "@/lib/sync/offlineQueue";

export function isPermanentFlushError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (error.status === 408 || error.status === 429) {
    return false;
  }
  if (error.status >= 500) {
    return false;
  }
  return error.status >= 400;
}

export function isRetryableFlushError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 408 || error.status === 429 || error.status >= 500) {
      return true;
    }
    return false;
  }
  return true;
}

export interface FlushQueueResult {
  flushed: number;
  discarded: Array<{ id: string; detail: string }>;
  halted: boolean;
  haltReason?: string;
}

async function executeQueuedMutation(
  profileId: string,
  record: QueuedMutationRecord,
): Promise<void> {
  switch (record.mutation.type) {
    case "library_add":
      await addLibraryItem(profileId, record.mutation.body);
      return;
    case "library_remove":
      await removeLibraryItem(profileId, record.mutation.mediaKey);
      return;
    case "progress":
      await putProgress(profileId, record.mutation.body);
      return;
    case "preferences":
      await updatePreferences(profileId, record.mutation.body);
      return;
  }
}

export async function flushOfflineQueue(profileId: string): Promise<FlushQueueResult> {
  const queued = await listQueuedMutations(profileId);
  const result: FlushQueueResult = {
    flushed: 0,
    discarded: [],
    halted: false,
  };

  for (const record of queued) {
    try {
      await executeQueuedMutation(profileId, record);
      await removeQueuedMutation(record.id);
      result.flushed += 1;
    } catch (error) {
      if (isPermanentFlushError(error)) {
        const detail =
          error instanceof ApiError
            ? (error.detail ?? error.title)
            : error instanceof Error
              ? error.message
              : "Permanent flush error";
        result.discarded.push({ id: record.id, detail });
        await removeQueuedMutation(record.id);
        continue;
      }

      if (isRetryableFlushError(error)) {
        result.halted = true;
        result.haltReason = error instanceof Error ? error.message : "Retryable flush error";
        break;
      }

      result.halted = true;
      result.haltReason = "Unknown flush error";
      break;
    }
  }

  return result;
}
