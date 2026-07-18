import { PROFILE_ID } from "@/test/fixtures/browse";

export const defaultPreferences = {
  locale: "en-US",
  subtitle_languages: ["en"],
  audio_languages: ["en"],
  preferred_qualities: ["1080p", "720p"],
  hide_p2p_streams: false,
};

export const INSTALLATION_ID_2 = "44444444-4444-7444-8444-444444444444";
export const MANIFEST_ID_2 = "community.example.addon";

export const addonListFixture = [
  {
    id: "33333333-3333-7333-8333-333333333333",
    manifest_id: "org.stremio.cinemeta",
    name: "Cinemeta",
    version: "1.0.0",
    description: "Official metadata add-on",
    enabled: true,
    priority: 0,
    capabilities: {
      resources: ["catalog", "meta", "stream"],
      types: ["movie", "series"],
      id_prefixes: ["tt"],
    },
    installed_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: INSTALLATION_ID_2,
    manifest_id: MANIFEST_ID_2,
    name: "Example Streams",
    version: "0.2.0",
    enabled: true,
    priority: 1,
    capabilities: {
      resources: ["stream"],
      types: ["movie"],
      id_prefixes: ["tt"],
    },
    installed_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

export const SECRET_TRANSPORT_URL = "https://secret.example.com/manifest.json";

export { PROFILE_ID };
