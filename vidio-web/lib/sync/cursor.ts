import { openSyncDb } from "@/lib/sync/db";

export async function getSyncCursor(profileId: string): Promise<number> {
  const db = await openSyncDb();
  const record = await db.get("cursors", profileId);
  return record?.sequence ?? 0;
}

export async function setSyncCursor(profileId: string, sequence: number): Promise<void> {
  const db = await openSyncDb();
  await db.put("cursors", { profileId, sequence });
}

export async function clearSyncCursor(profileId: string): Promise<void> {
  const db = await openSyncDb();
  await db.delete("cursors", profileId);
}
