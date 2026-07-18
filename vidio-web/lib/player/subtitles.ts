import type { ResolvedSubtitle } from "@/lib/api/schemas";

export function sortSubtitlesByPreferences(
  subtitles: ResolvedSubtitle[],
  preferredLanguages: string[],
): ResolvedSubtitle[] {
  if (preferredLanguages.length === 0) {
    return subtitles;
  }

  const score = (subtitle: ResolvedSubtitle): number => {
    const lang = subtitle.subtitle.lang.toLowerCase();
    const index = preferredLanguages.findIndex((preferred) => {
      const normalized = preferred.toLowerCase();
      return lang.startsWith(normalized) || normalized.startsWith(lang);
    });
    return index === -1 ? preferredLanguages.length + 1 : index;
  };

  return [...subtitles].sort((a, b) => score(a) - score(b));
}

export function buildSubtitleTrackId(subtitle: ResolvedSubtitle, index: number): string {
  return `${subtitle.installation_id}:${subtitle.subtitle.id}:${index}`;
}
