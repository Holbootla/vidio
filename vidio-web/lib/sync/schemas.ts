import { z } from "zod";
import { profilePreferencesSchema } from "@/lib/api/schemas";

const rfc3339 = z.string().datetime({ offset: true });
const uuid = z.uuid();

export const syncResourceKindSchema = z.enum(["preferences", "addon", "library", "progress"]);

export type SyncResourceKind = z.infer<typeof syncResourceKindSchema>;

export const syncChangeSchema = z.object({
  sequence: z.number().int().nonnegative(),
  profile_id: uuid,
  kind: syncResourceKindSchema,
  key: z.string(),
  payload: z.unknown(),
  deleted: z.boolean(),
  created_at: rfc3339,
});

export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncPageSchema = z.object({
  changes: z.array(syncChangeSchema),
  latest_sequence: z.number().int().nonnegative(),
  has_more: z.boolean(),
});

export type SyncPage = z.infer<typeof syncPageSchema>;

/** Partial library snapshot on the sync wire (Rust omits profile/time fields). */
export const syncLibraryPayloadSchema = z.object({
  media_key: z.string(),
  type: z.string(),
  name: z.string(),
  poster: z.string().nullable().optional(),
});

export type SyncLibraryPayload = z.infer<typeof syncLibraryPayloadSchema>;

/** Partial progress snapshot on the sync wire. */
export const syncProgressPayloadSchema = z.object({
  video_key: z.string(),
  media_key: z.string(),
  position_secs: z.number(),
  duration_secs: z.number(),
  watched: z.boolean(),
  revision: z.number().int().nonnegative(),
});

export type SyncProgressPayload = z.infer<typeof syncProgressPayloadSchema>;

/** Partial add-on snapshot on the sync wire (no capabilities or timestamps). */
export const syncAddonPayloadSchema = z.object({
  id: uuid,
  manifest_id: z.string(),
  name: z.string(),
  version: z.string(),
  enabled: z.boolean(),
  priority: z.number().int(),
});

export type SyncAddonPayload = z.infer<typeof syncAddonPayloadSchema>;

/** Partial preferences snapshot on the sync wire. */
export const syncPreferencesPayloadSchema = z.object({
  name: z.string(),
  preferences: profilePreferencesSchema,
  version: z.number().int().nonnegative(),
});

export type SyncPreferencesPayload = z.infer<typeof syncPreferencesPayloadSchema>;

export type ParsedSyncPayload =
  | { kind: "preferences"; payload: SyncPreferencesPayload | null }
  | { kind: "addon"; payload: SyncAddonPayload | null }
  | { kind: "library"; payload: SyncLibraryPayload | null }
  | { kind: "progress"; payload: SyncProgressPayload | null };

export function parseSyncChangePayload(change: SyncChange): ParsedSyncPayload | null {
  if (change.deleted) {
    return { kind: change.kind, payload: null };
  }

  if (change.payload === null || change.payload === undefined) {
    return null;
  }

  switch (change.kind) {
    case "preferences": {
      const parsed = syncPreferencesPayloadSchema.safeParse(change.payload);
      return parsed.success ? { kind: "preferences", payload: parsed.data } : null;
    }
    case "addon": {
      const parsed = syncAddonPayloadSchema.safeParse(change.payload);
      return parsed.success ? { kind: "addon", payload: parsed.data } : null;
    }
    case "library": {
      const parsed = syncLibraryPayloadSchema.safeParse(change.payload);
      return parsed.success ? { kind: "library", payload: parsed.data } : null;
    }
    case "progress": {
      const parsed = syncProgressPayloadSchema.safeParse(change.payload);
      return parsed.success ? { kind: "progress", payload: parsed.data } : null;
    }
    default:
      return null;
  }
}
