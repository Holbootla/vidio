import type { IdNamespace } from "@/lib/media/keys";

export interface ParsedMediaKey {
  contentType: string;
  namespace: IdNamespace;
  mediaId: string;
  manifestId?: string;
}

export interface ParsedVideoKey extends ParsedMediaKey {
  videoId: string;
}

function parseKey(key: string): ParsedMediaKey | null {
  const parts = key.split(":");
  if (parts.length < 3) {
    return null;
  }

  const [contentType, namespaceRaw, ...rest] = parts;
  if (!contentType || !namespaceRaw) {
    return null;
  }

  if (namespaceRaw === "imdb" || namespaceRaw === "kitsu") {
    const id = rest.join(":");
    if (!id) {
      return null;
    }
    return {
      contentType,
      namespace: namespaceRaw,
      mediaId: id,
    };
  }

  if (namespaceRaw === "addon") {
    const [manifestId, ...idParts] = rest;
    const mediaId = idParts.join(":");
    if (!manifestId || !mediaId) {
      return null;
    }
    return {
      contentType,
      namespace: "addon",
      manifestId,
      mediaId,
    };
  }

  return null;
}

export function parseMediaKey(mediaKey: string): ParsedMediaKey | null {
  return parseKey(mediaKey);
}

export function parseVideoKey(videoKey: string): ParsedVideoKey | null {
  const parsed = parseKey(videoKey);
  if (!parsed) {
    return null;
  }
  return {
    ...parsed,
    videoId: parsed.mediaId,
  };
}

export function manifestIdFromParsedKey(
  parsed: ParsedMediaKey,
  fallbackManifestId?: string | null,
): string {
  if (parsed.namespace === "addon" && parsed.manifestId) {
    return parsed.manifestId;
  }
  return fallbackManifestId?.trim() || "shared";
}

export function resolveManifestIdForProgress(
  provenanceManifestId: string | undefined,
  installationId: string | undefined,
  addons: Array<{ id: string; manifest_id: string }> | undefined,
): string | null {
  const fromProvenance = provenanceManifestId?.trim();
  if (fromProvenance) {
    return fromProvenance;
  }
  if (installationId && addons) {
    const addon = addons.find((item) => item.id === installationId);
    if (addon) {
      return addon.manifest_id;
    }
  }
  return null;
}
