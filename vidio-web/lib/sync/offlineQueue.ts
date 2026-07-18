import { buildMediaKey } from "@/lib/media/keys";
import type { AddLibraryRequest, ProgressRequest, ProfilePreferences } from "@/lib/api/schemas";
import { openSyncDb, type OfflineMutationPayload, type QueuedMutationRecord } from "@/lib/sync/db";

export type { OfflineMutationPayload, QueuedMutationRecord };

function createMutationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildDedupeKey(mutation: OfflineMutationPayload): string {
  switch (mutation.type) {
    case "library_add": {
      const keyResult = buildMediaKey(
        mutation.body.content_type,
        mutation.body.manifest_id,
        mutation.body.content_id,
      );
      return keyResult.ok ? `library:${keyResult.key}` : `library:add:${mutation.body.content_id}`;
    }
    case "library_remove":
      return `library:${mutation.mediaKey}`;
    case "progress":
      return `progress:${mutation.body.content_type}:${mutation.body.video_id}`;
    case "preferences":
      return "preferences";
  }
}

function reconcileMutations(
  existing: OfflineMutationPayload | undefined,
  incoming: OfflineMutationPayload,
): OfflineMutationPayload | null {
  if (!existing) {
    return incoming;
  }

  if (existing.type === "library_add" && incoming.type === "library_remove") {
    const existingKey = buildDedupeKey(existing);
    const incomingKey = buildDedupeKey(incoming);
    if (existingKey === incomingKey) {
      return null;
    }
  }

  if (existing.type === "library_remove" && incoming.type === "library_add") {
    const existingKey = buildDedupeKey(existing);
    const incomingKey = buildDedupeKey(incoming);
    if (existingKey === incomingKey) {
      return incoming;
    }
  }

  return incoming;
}

async function nextQueueOrder(profileId: string): Promise<number> {
  const db = await openSyncDb();
  const tx = db.transaction("queue", "readonly");
  const index = tx.store.index("byProfileOrder");
  const cursor = await index.openCursor(
    IDBKeyRange.bound([profileId, 0], [profileId, Number.MAX_SAFE_INTEGER]),
  );
  let maxOrder = -1;
  let current = cursor;
  while (current) {
    maxOrder = Math.max(maxOrder, current.value.order);
    current = await current.continue();
  }
  await tx.done;
  return maxOrder + 1;
}

export async function enqueueOfflineMutation(
  profileId: string,
  mutation: OfflineMutationPayload,
): Promise<QueuedMutationRecord> {
  const db = await openSyncDb();
  const dedupeKey = buildDedupeKey(mutation);

  const existing = await db.getFromIndex("queue", "byProfileDedupe", [profileId, dedupeKey]);
  const reconciled = reconcileMutations(existing?.mutation, mutation);

  if (existing && reconciled === null) {
    await db.delete("queue", existing.id);
    notifyQueueChanged(profileId);
    return existing;
  }

  if (existing && reconciled) {
    const updated: QueuedMutationRecord = {
      ...existing,
      mutation: reconciled,
      createdAt: new Date().toISOString(),
    };
    await db.put("queue", updated);
    notifyQueueChanged(profileId);
    return updated;
  }

  const record: QueuedMutationRecord = {
    id: createMutationId(),
    profileId,
    order: await nextQueueOrder(profileId),
    dedupeKey,
    mutation: reconciled ?? mutation,
    createdAt: new Date().toISOString(),
  };
  await db.put("queue", record);
  notifyQueueChanged(profileId);
  return record;
}

export function notifyQueueChanged(profileId: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vidio-sync-queue-changed", { detail: { profileId } }));
  }
}

export async function listQueuedMutations(profileId: string): Promise<QueuedMutationRecord[]> {
  const db = await openSyncDb();
  const items = await db.getAllFromIndex(
    "queue",
    "byProfileOrder",
    IDBKeyRange.bound([profileId, 0], [profileId, Number.MAX_SAFE_INTEGER]),
  );
  return items.sort((a, b) => a.order - b.order);
}

export async function countQueuedMutations(profileId: string): Promise<number> {
  const items = await listQueuedMutations(profileId);
  return items.length;
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await openSyncDb();
  await db.delete("queue", id);
}

export async function clearQueuedMutations(profileId: string): Promise<void> {
  const db = await openSyncDb();
  const items = await listQueuedMutations(profileId);
  const tx = db.transaction("queue", "readwrite");
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

export function buildOfflineLibraryAddRequest(payload: AddLibraryRequest): AddLibraryRequest {
  return payload;
}

export function buildOfflineProgressRequest(payload: ProgressRequest): ProgressRequest {
  return payload;
}

export function buildOfflinePreferencesRequest(payload: ProfilePreferences): ProfilePreferences {
  return payload;
}
