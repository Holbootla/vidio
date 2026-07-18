import { profilePreferencesSchema } from "@/lib/api/schemas";
import { z } from "zod";

const languageCodeSchema = z
  .string()
  .min(2, "Use a language code such as en or en-US")
  .max(16, "Language code is too long");

const qualitySchema = z
  .string()
  .min(1, "Quality label is required")
  .max(16, "Quality label is too long");

export const preferencesFormSchema = profilePreferencesSchema.extend({
  locale: z
    .string()
    .min(2, "Locale is required")
    .max(16, "Locale is too long")
    .regex(/^[a-z]{2}(-[A-Za-z0-9]+)?$/, "Use a BCP-47 locale such as en-US"),
  subtitle_languages: z.array(languageCodeSchema),
  audio_languages: z.array(languageCodeSchema),
  preferred_qualities: z.array(qualitySchema),
});

export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

export const defaultPreferencesFormValues: PreferencesFormValues = {
  locale: "en-US",
  subtitle_languages: [],
  audio_languages: [],
  preferred_qualities: [],
  hide_p2p_streams: false,
};
