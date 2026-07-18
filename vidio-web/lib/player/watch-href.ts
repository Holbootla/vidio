import type { MediaProvenance } from "@/lib/media/provenance";
import { provenanceToSearchParams } from "@/lib/media/provenance";

export interface WatchProvenance {
  mediaId: string;
  manifestId: string;
  installationId?: string;
}

export function buildWatchHref(
  contentType: string,
  videoId: string,
  provenance: WatchProvenance,
  options?: { installationId?: string },
): string {
  const params = new URLSearchParams();
  params.set("media_id", provenance.mediaId);
  params.set("manifest_id", provenance.manifestId);
  const installationId = options?.installationId ?? provenance.installationId;
  if (installationId) {
    params.set("installation_id", installationId);
  }
  return `/watch/${encodeURIComponent(contentType)}/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function buildWatchHrefFromMediaProvenance(
  contentType: string,
  videoId: string,
  mediaId: string,
  provenance?: MediaProvenance | null,
  installationId?: string,
): string | null {
  const manifestId = provenance?.manifestId?.trim();
  if (!manifestId) {
    return null;
  }
  return buildWatchHref(
    contentType,
    videoId,
    {
      mediaId,
      manifestId,
      installationId: provenance?.installationId,
    },
    { installationId },
  );
}

export function parseWatchSearchParams(
  params: URLSearchParams | Readonly<Record<string, string | string[] | undefined>>,
): WatchProvenance | null {
  const read = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? undefined;
    }
    const raw = params[key];
    if (Array.isArray(raw)) {
      return raw[0];
    }
    return raw;
  };

  const mediaId = read("media_id");
  const manifestId = read("manifest_id");
  if (!mediaId || !manifestId) {
    return null;
  }

  return {
    mediaId,
    manifestId,
    installationId: read("installation_id"),
  };
}

export function appendProvenanceToWatchHref(
  href: string,
  provenance?: MediaProvenance | null,
): string {
  if (!provenance?.manifestId) {
    return href;
  }
  const url = new URL(href, "http://local");
  const params = provenanceToSearchParams(provenance);
  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}
