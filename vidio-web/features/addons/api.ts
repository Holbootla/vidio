import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { profilePath } from "@/lib/api/profile-path";
import { addonDtoSchema, addonListSchema, type AddonDto } from "@/lib/api/schemas";
import { z } from "zod";

export const installAddonRequestSchema = z.object({
  transport_url: z.string().url(),
});

export type InstallAddonRequest = z.infer<typeof installAddonRequestSchema>;

export const patchAddonRequestSchema = z.object({
  enabled: z.boolean(),
});

export type PatchAddonRequest = z.infer<typeof patchAddonRequestSchema>;

export const reorderAddonsRequestSchema = z.object({
  order: z.array(z.uuid()),
});

export type ReorderAddonsRequest = z.infer<typeof reorderAddonsRequestSchema>;

export function fetchAddons(profileId: string) {
  return apiGet(profilePath(profileId, "/addons"), addonListSchema);
}

export function installAddon(profileId: string, payload: InstallAddonRequest) {
  const body = installAddonRequestSchema.parse(payload);
  return apiPost(profilePath(profileId, "/addons"), body, addonDtoSchema);
}

export function patchAddon(profileId: string, installationId: string, payload: PatchAddonRequest) {
  const body = patchAddonRequestSchema.parse(payload);
  return apiPatch(
    profilePath(profileId, `/addons/${encodeURIComponent(installationId)}`),
    body,
    addonDtoSchema,
  );
}

export function refreshAddon(profileId: string, installationId: string) {
  return apiPost(
    profilePath(profileId, `/addons/${encodeURIComponent(installationId)}/refresh`),
    {},
    addonDtoSchema,
  );
}

export function removeAddon(profileId: string, installationId: string) {
  return apiDelete(profilePath(profileId, `/addons/${encodeURIComponent(installationId)}`));
}

export function reorderAddons(profileId: string, payload: ReorderAddonsRequest) {
  const body = reorderAddonsRequestSchema.parse(payload);
  return apiPost(profilePath(profileId, "/addons/reorder"), body, addonListSchema);
}

export function sortAddonsByPriority(addons: AddonDto[]): AddonDto[] {
  return [...addons].sort((a, b) => a.priority - b.priority);
}
