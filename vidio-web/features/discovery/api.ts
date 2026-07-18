import { apiGet } from "@/lib/api/client";
import { profilePath } from "@/lib/api/profile-path";
import {
  addonListSchema,
  discoveryResponseSchema,
  playbackProgressListSchema,
} from "@/lib/api/schemas";

export function fetchHome(profileId: string) {
  return apiGet(profilePath(profileId, "/home"), discoveryResponseSchema);
}

export function fetchSearch(profileId: string, query: string) {
  const params = new URLSearchParams({ q: query });
  return apiGet(
    `${profilePath(profileId, "/search")}?${params.toString()}`,
    discoveryResponseSchema,
  );
}

export function fetchContinueWatching(profileId: string) {
  return apiGet(profilePath(profileId, "/continue-watching"), playbackProgressListSchema);
}

export function fetchAddons(profileId: string) {
  return apiGet(profilePath(profileId, "/addons"), addonListSchema);
}
