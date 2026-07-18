import type { Meta } from "@/lib/api/schemas";
import { buildMediaKey, resolveManifestIdForLibrary } from "@/lib/media/keys";
import type { MediaProvenance } from "@/lib/media/provenance";
import type { AddLibraryRequest } from "@/lib/api/schemas";

export function buildLibraryRequest(
  meta: Meta,
  provenance: MediaProvenance | null,
): { ok: true; request: AddLibraryRequest } | { ok: false; reason: string } {
  const manifestResult = resolveManifestIdForLibrary(meta.id, provenance?.manifestId);
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const keyResult = buildMediaKey(meta.type, manifestResult.manifestId, meta.id);
  if (!keyResult.ok) {
    return keyResult;
  }

  return {
    ok: true,
    request: {
      content_type: meta.type,
      content_id: meta.id,
      manifest_id: manifestResult.manifestId,
      name: meta.name,
      poster: meta.poster,
      meta_snapshot: JSON.stringify({
        id: meta.id,
        type: meta.type,
        name: meta.name,
        poster: meta.poster,
      }),
    },
  };
}
