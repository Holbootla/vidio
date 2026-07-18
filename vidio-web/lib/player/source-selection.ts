import type { ResolvedStream } from "@/lib/api/schemas";

export type PlayableAction = "vidstack" | "youtube" | "external";

export interface SourceDisableInfo {
  disabled: boolean;
  reason: string | null;
}

export interface ProcessedSource {
  id: string;
  resolved: ResolvedStream;
  label: string;
  qualityLabel: string | null;
  disabled: boolean;
  disableReason: string | null;
  playable: PlayableAction | null;
}

export interface SourceGroup {
  installationId: string;
  addonName: string;
  sources: ProcessedSource[];
}

const QUALITY_PATTERN = /(\d{3,4}p|4k|2160p|1440p|1080p|720p|480p|360p|240p|hd|sd|uhd)/i;

export function getSourceDisableReason(resolved: ResolvedStream): string | null {
  if (resolved.kind === "torrent") {
    return "Torrent playback is not supported in the browser.";
  }
  if (resolved.kind === "unknown") {
    return "Unknown stream format.";
  }
  if (!resolved.supported) {
    return "This source is not supported by the web player.";
  }
  if (resolved.kind === "url" && !resolved.is_web_ready) {
    return "Needs local proxy — not available in web v1.";
  }
  return null;
}

export function getPlayableAction(resolved: ResolvedStream): PlayableAction | null {
  if (getSourceDisableReason(resolved)) {
    return null;
  }
  if (resolved.kind === "url" && resolved.is_web_ready) {
    return "vidstack";
  }
  if (resolved.kind === "youtube") {
    return "youtube";
  }
  if (resolved.kind === "external") {
    return "external";
  }
  return null;
}

export function getSourceDisableInfo(resolved: ResolvedStream): SourceDisableInfo {
  const reason = getSourceDisableReason(resolved);
  return {
    disabled: reason !== null,
    reason,
  };
}

export function extractQualityLabel(resolved: ResolvedStream): string | null {
  const candidates = [resolved.stream.title, resolved.stream.name, resolved.stream.url];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const match = candidate.match(QUALITY_PATTERN);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

export function buildSourceLabel(resolved: ResolvedStream): string {
  const stream = resolved.stream;
  const base = stream.title?.trim() || stream.name?.trim() || resolved.addon_name;
  const quality = extractQualityLabel(resolved);
  if (quality && !base.toLowerCase().includes(quality.toLowerCase())) {
    return `${base} · ${quality}`;
  }
  return base;
}

export function buildSourceId(resolved: ResolvedStream, index: number): string {
  return `${resolved.installation_id}:${index}`;
}

export function processSource(resolved: ResolvedStream, index: number): ProcessedSource {
  const disable = getSourceDisableInfo(resolved);
  return {
    id: buildSourceId(resolved, index),
    resolved,
    label: buildSourceLabel(resolved),
    qualityLabel: extractQualityLabel(resolved),
    disabled: disable.disabled,
    disableReason: disable.reason,
    playable: getPlayableAction(resolved),
  };
}

function qualityScore(label: string | null, preferredQualities: string[]): number {
  if (!label) {
    return preferredQualities.length + 100;
  }
  const normalized = label.toLowerCase();
  const index = preferredQualities.findIndex((quality) =>
    normalized.includes(quality.toLowerCase()),
  );
  return index === -1 ? preferredQualities.length + 50 : index;
}

export function compareSources(
  a: ProcessedSource,
  b: ProcessedSource,
  preferredQualities: string[],
): number {
  const aScore = qualityScore(a.qualityLabel, preferredQualities);
  const bScore = qualityScore(b.qualityLabel, preferredQualities);
  if (aScore !== bScore) {
    return aScore - bScore;
  }
  return a.label.localeCompare(b.label);
}

export function groupAndSortSources(
  streams: ResolvedStream[],
  preferredQualities: string[] = [],
): SourceGroup[] {
  const processed = streams.map((stream, index) => processSource(stream, index));
  const groups = new Map<string, SourceGroup>();

  for (const source of processed) {
    const existing = groups.get(source.resolved.installation_id);
    if (existing) {
      existing.sources.push(source);
      continue;
    }
    groups.set(source.resolved.installation_id, {
      installationId: source.resolved.installation_id,
      addonName: source.resolved.addon_name,
      sources: [source],
    });
  }

  for (const group of groups.values()) {
    group.sources.sort((a, b) => compareSources(a, b, preferredQualities));
  }

  return [...groups.values()].sort((a, b) => a.addonName.localeCompare(b.addonName));
}

export function selectPlayableSource(
  streams: ResolvedStream[],
  preferredQualities: string[] = [],
  preferredInstallationId?: string | null,
): ProcessedSource | null {
  const groups = groupAndSortSources(streams, preferredQualities);
  const ordered = preferredInstallationId
    ? [
        ...groups.filter((group) => group.installationId === preferredInstallationId),
        ...groups.filter((group) => group.installationId !== preferredInstallationId),
      ]
    : groups;

  for (const group of ordered) {
    const playable = group.sources.find((source) => source.playable !== null);
    if (playable) {
      return playable;
    }
  }
  return null;
}

export function openExternalStream(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return;
  }
  window.open(parsed.toString(), "_blank", "noopener,noreferrer");
}

export function detectStreamMimeType(url: string): string | undefined {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8")) {
    return "application/x-mpegurl";
  }
  if (lower.includes(".mpd")) {
    return "application/dash+xml";
  }
  return undefined;
}
