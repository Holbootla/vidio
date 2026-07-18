export type IdNamespace = "imdb" | "kitsu" | "addon";

export function classifyContentId(contentId: string): IdNamespace {
  const trimmed = contentId.trim();
  if (trimmed.startsWith("tt")) {
    return "imdb";
  }
  if (trimmed.startsWith("kitsu:")) {
    return "kitsu";
  }
  return "addon";
}

export function buildMediaKey(
  mediaType: string,
  manifestId: string,
  contentId: string,
): { ok: true; key: string } | { ok: false; reason: string } {
  const trimmedId = contentId.trim();
  if (!trimmedId) {
    return { ok: false, reason: "Content id is required." };
  }

  const namespace = classifyContentId(trimmedId);
  if (namespace === "imdb") {
    return { ok: true, key: `${mediaType}:imdb:${trimmedId}` };
  }
  if (namespace === "kitsu") {
    const rest = trimmedId.replace(/^kitsu:/, "");
    return { ok: true, key: `${mediaType}:kitsu:${rest}` };
  }

  const trimmedManifest = manifestId.trim();
  if (!trimmedManifest) {
    return {
      ok: false,
      reason:
        "Add-on manifest is required for this title. Open it from a catalog row or search result.",
    };
  }
  return { ok: true, key: `${mediaType}:addon:${trimmedManifest}:${trimmedId}` };
}

export function resolveManifestIdForLibrary(
  contentId: string,
  provenanceManifestId?: string | null,
): { ok: true; manifestId: string } | { ok: false; reason: string } {
  const namespace = classifyContentId(contentId);
  if (namespace === "imdb" || namespace === "kitsu") {
    return { ok: true, manifestId: provenanceManifestId?.trim() || "shared" };
  }
  const manifestId = provenanceManifestId?.trim();
  if (!manifestId) {
    return {
      ok: false,
      reason:
        "This title needs add-on provenance to save. Browse to it from the board, discover, or search instead of using a direct link.",
    };
  }
  return { ok: true, manifestId };
}

export function encodeMediaKeyForPath(mediaKey: string): string {
  return encodeURIComponent(mediaKey);
}
