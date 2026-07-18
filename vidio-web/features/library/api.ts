import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { profilePath } from "@/lib/api/profile-path";
import {
  addLibraryRequestSchema,
  libraryEntriesSchema,
  libraryEntrySchema,
  metaSchema,
} from "@/lib/api/schemas";
import { encodeMediaKeyForPath } from "@/lib/media/keys";
import type { AddLibraryRequest } from "@/lib/api/schemas";

export function fetchMeta(profileId: string, contentType: string, id: string) {
  return apiGet(
    profilePath(profileId, `/meta/${encodeURIComponent(contentType)}/${encodeURIComponent(id)}`),
    metaSchema,
  );
}

export function fetchLibrary(profileId: string) {
  return apiGet(profilePath(profileId, "/library"), libraryEntriesSchema);
}

export function addLibraryItem(profileId: string, payload: AddLibraryRequest) {
  const body = addLibraryRequestSchema.parse(payload);
  return apiPost(profilePath(profileId, "/library"), body, libraryEntrySchema);
}

export function removeLibraryItem(profileId: string, mediaKey: string) {
  return apiDelete(profilePath(profileId, `/library/${encodeMediaKeyForPath(mediaKey)}`));
}
