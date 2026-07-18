import { z } from "zod";
import {
  addonDtoSchema,
  libraryEntrySchema,
  playbackProgressSchema,
  profilePreferencesSchema,
} from "@/lib/api/schemas";

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

export type ParsedSyncPayload =
  | { kind: "preferences"; payload: z.infer<typeof profilePreferencesSchema> | null }
  | { kind: "addon"; payload: z.infer<typeof addonDtoSchema> | null }
  | { kind: "library"; payload: z.infer<typeof libraryEntrySchema> | null }
  | { kind: "progress"; payload: z.infer<typeof playbackProgressSchema> | null };

export function parseSyncChangePayload(change: SyncChange): ParsedSyncPayload | null {
  if (change.deleted) {
    return { kind: change.kind, payload: null };
  }

  if (change.payload === null || change.payload === undefined) {
    return null;
  }

  switch (change.kind) {
    case "preferences": {
      const parsed = profilePreferencesSchema.safeParse(change.payload);
      return parsed.success ? { kind: "preferences", payload: parsed.data } : null;
    }
    case "addon": {
      const parsed = addonDtoSchema.safeParse(change.payload);
      return parsed.success ? { kind: "addon", payload: parsed.data } : null;
    }
    case "library": {
      const parsed = libraryEntrySchema.safeParse(change.payload);
      return parsed.success ? { kind: "library", payload: parsed.data } : null;
    }
    case "progress": {
      const parsed = playbackProgressSchema.safeParse(change.payload);
      return parsed.success ? { kind: "progress", payload: parsed.data } : null;
    }
    default:
      return null;
  }
}
