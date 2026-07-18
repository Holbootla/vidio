import { apiGet, apiPut } from "@/lib/api/client";
import { profilePath } from "@/lib/api/profile-path";
import { profilePreferencesSchema, profileSchema } from "@/lib/api/schemas";
import type { ProfilePreferences } from "@/lib/api/schemas";

export function fetchPreferences(profileId: string) {
  return apiGet(profilePath(profileId, "/preferences"), profilePreferencesSchema);
}

export function updatePreferences(profileId: string, preferences: ProfilePreferences) {
  const body = profilePreferencesSchema.parse(preferences);
  return apiPut(profilePath(profileId, "/preferences"), body, profileSchema);
}
