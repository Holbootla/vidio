import { z } from "zod";

export const installAddonFormSchema = z.object({
  transport_url: z
    .string()
    .min(1, "Manifest URL is required")
    .url("Enter a valid HTTPS manifest URL")
    .refine((value) => value.startsWith("https://"), {
      message: "Manifest URL must use HTTPS",
    }),
});

export type InstallAddonFormValues = z.infer<typeof installAddonFormSchema>;
