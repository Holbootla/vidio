import { z } from "zod";

const rfc3339 = z.string().datetime({ offset: true });
const uuid = z.uuid();

export const problemJsonSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
});

export type ProblemJson = z.infer<typeof problemJsonSchema>;

export const userStatusSchema = z.enum(["pending_verification", "active", "disabled"]);

export const userDtoSchema = z.object({
  id: uuid,
  email: z.string().email(),
  status: userStatusSchema,
  created_at: rfc3339,
});

export type UserDto = z.infer<typeof userDtoSchema>;

export const profilePreferencesSchema = z.object({
  locale: z.string(),
  subtitle_languages: z.array(z.string()),
  audio_languages: z.array(z.string()),
  preferred_qualities: z.array(z.string()),
  hide_p2p_streams: z.boolean(),
});

export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;

export const profileSchema = z.object({
  id: uuid,
  user_id: uuid,
  name: z.string(),
  is_default: z.boolean(),
  preferences: profilePreferencesSchema,
  version: z.number().int().nonnegative(),
  created_at: rfc3339,
  updated_at: rfc3339,
});

export type Profile = z.infer<typeof profileSchema>;

export const authResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  access_expires_at: rfc3339,
  refresh_token: z.string(),
  refresh_expires_at: rfc3339,
  profile: profileSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const registerResponseSchema = z.object({
  user: userDtoSchema,
  profile: profileSchema,
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device: z
    .object({
      platform: z.string().optional(),
      display_name: z.string().optional(),
      app_version: z.string().optional(),
    })
    .optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  profile_name: z.string().min(1).max(60).optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const clientAuthSessionSchema = z.object({
  access_token: z.string(),
  access_expires_at: rfc3339,
  profile: profileSchema,
  user: userDtoSchema.optional(),
});

export type ClientAuthSession = z.infer<typeof clientAuthSessionSchema>;
