import { buildMediaKey } from "@/lib/media/keys";
import type { PlaybackProgress } from "@/lib/api/schemas";

export function findResumeEntry(
  entries: PlaybackProgress[] | undefined,
  contentType: string,
  videoId: string,
  manifestId: string,
): PlaybackProgress | null {
  if (!entries?.length) {
    return null;
  }

  const keyResult = buildMediaKey(contentType, manifestId, videoId);
  if (!keyResult.ok) {
    return null;
  }

  const entry = entries.find((item) => item.video_key === keyResult.key);
  if (!entry || entry.watched || entry.position_secs <= 0) {
    return null;
  }

  return entry;
}

export function getResumePosition(
  entries: PlaybackProgress[] | undefined,
  contentType: string,
  videoId: string,
  manifestId: string,
): number | null {
  const entry = findResumeEntry(entries, contentType, videoId, manifestId);
  return entry ? entry.position_secs : null;
}
