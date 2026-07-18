export function profilePath(profileId: string, suffix: string): string {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `/v1/profiles/${encodeURIComponent(profileId)}${normalized}`;
}
