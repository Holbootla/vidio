import { describe, expect, it } from "vitest";
import { addonDtoSchema } from "@/lib/api/schemas";
import { INSTALLATION_ID, MANIFEST_ID } from "@/test/fixtures/browse";

describe("api schemas", () => {
  it("accepts null addon description from Rust Option without skip", () => {
    const parsed = addonDtoSchema.parse({
      id: INSTALLATION_ID,
      manifest_id: MANIFEST_ID,
      name: "Cinemeta",
      version: "1.0.0",
      description: null,
      enabled: true,
      priority: 0,
      capabilities: {
        resources: ["catalog"],
        types: ["movie"],
        id_prefixes: ["tt"],
      },
      installed_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    expect(parsed.description).toBeNull();
  });
});
