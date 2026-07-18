import type { LibraryEntry } from "@/lib/api/schemas";
import {
  manifestIdFromParsedKey,
  parseMediaKey,
  type ParsedMediaKey,
} from "@/lib/media/parse-keys";
import { buildDetailHref } from "@/lib/media/provenance";

function routeIdFromParsed(parsed: ParsedMediaKey): string {
  if (parsed.namespace === "kitsu") {
    return `kitsu:${parsed.mediaId}`;
  }
  return parsed.mediaId;
}

export function buildLibraryEntryHref(entry: LibraryEntry): string {
  const parsed = parseMediaKey(entry.media_key);
  if (!parsed) {
    return buildDetailHref(entry.media_type, entry.media_key);
  }

  const routeId = routeIdFromParsed(parsed);
  const manifestId = manifestIdFromParsedKey(parsed);

  if (parsed.namespace === "addon" && parsed.manifestId) {
    return buildDetailHref(parsed.contentType, routeId, { manifestId: parsed.manifestId });
  }

  return buildDetailHref(parsed.contentType, routeId, { manifestId });
}
