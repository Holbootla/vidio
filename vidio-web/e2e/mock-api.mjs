#!/usr/bin/env node
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT ?? "18080");
const PROFILE_ID = "22222222-2222-7222-8222-222222222222";
const INSTALLATION_ID = "33333333-3333-7333-8333-333333333333";
const MANIFEST_ID = "org.stremio.cinemeta";

const moviePreview = {
  id: "tt1254207",
  type: "movie",
  name: "Big Buck Bunny",
  poster: "https://example.com/bbb.jpg",
  releaseInfo: "2008",
};

let library = [];
let addons = [
  {
    id: INSTALLATION_ID,
    manifest_id: MANIFEST_ID,
    name: "Cinemeta",
    version: "1.0.0",
    enabled: true,
    priority: 0,
    capabilities: { resources: ["catalog"], types: ["movie", "series"], id_prefixes: ["tt"] },
    installed_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const defaultPreferences = {
  locale: "en-US",
  subtitle_languages: ["eng"],
  audio_languages: [],
  preferred_qualities: ["1080p"],
  hide_p2p_streams: true,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

function writeHeaders(res, status, headers = {}) {
  res.writeHead(status, { ...corsHeaders, ...headers });
}

function json(res, status, body) {
  writeHeaders(res, status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function noContent(res) {
  writeHeaders(res, 204);
  res.end();
}

function authResponse() {
  return {
    access_token: "e2e-access-token",
    token_type: "Bearer",
    access_expires_at: "2026-12-31T23:59:59Z",
    refresh_token: "e2e-refresh-token",
    refresh_expires_at: "2027-12-31T23:59:59Z",
    profile: {
      id: PROFILE_ID,
      user_id: "11111111-1111-7111-8111-111111111111",
      name: "E2E",
      is_default: true,
      preferences: defaultPreferences,
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
}

const discoveryHome = {
  rows: [
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      catalog_id: "top",
      content_type: "movie",
      title: "Popular Movies",
      items: [moviePreview],
    },
  ],
  warnings: [],
};

const movieMeta = {
  id: "tt1254207",
  type: "movie",
  name: "Big Buck Bunny",
  poster: "https://example.com/bbb.jpg",
  description: "A large bunny adventure.",
  releaseInfo: "2008",
  genres: ["Animation"],
  videos: [],
};

const streamResolution = {
  streams: [
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      kind: "url",
      is_web_ready: true,
      supported: true,
      stream: { title: "1080p", url: "https://example.com/video.mp4", sources: [], subtitles: [] },
    },
  ],
  warnings: [],
};

let continueWatching = [];

function profilePath(url) {
  const prefix = `/v1/profiles/${PROFILE_ID}`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  return url.slice(prefix.length) || "/";
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return null;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    writeHeaders(res, 204);
    res.end();
    return;
  }

  if (path === "/health") {
    return json(res, 200, { status: "ok" });
  }

  if (method === "POST" && path === "/__test__/reset") {
    library = [];
    addons = [
      {
        id: INSTALLATION_ID,
        manifest_id: MANIFEST_ID,
        name: "Cinemeta",
        version: "1.0.0",
        enabled: true,
        priority: 0,
        capabilities: { resources: ["catalog"], types: ["movie", "series"], id_prefixes: ["tt"] },
        installed_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    continueWatching = [];
    return json(res, 200, { status: "reset" });
  }

  if (method === "POST" && path === "/v1/auth/login") {
    const body = await readBody(req);
    if (body?.password === "wrong") {
      return json(res, 401, {
        type: "/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid credentials",
      });
    }
    return json(res, 200, authResponse());
  }

  if (method === "POST" && path === "/v1/auth/register") {
    const body = await readBody(req);
    return json(res, 201, {
      user: {
        id: "11111111-1111-7111-8111-111111111111",
        email: body.email,
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
      },
      profile: authResponse().profile,
    });
  }

  if (method === "POST" && path === "/v1/auth/refresh") {
    return json(res, 200, authResponse());
  }

  if (method === "POST" && path === "/v1/auth/logout") {
    return noContent(res);
  }

  if (method === "GET" && path === "/v1/me") {
    return json(res, 200, {
      id: "11111111-1111-7111-8111-111111111111",
      email: "e2e@example.com",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
    });
  }

  const suffix = profilePath(path);
  if (!suffix) {
    return json(res, 404, { type: "/errors/not-found", title: "Not found", status: 404 });
  }

  if (method === "GET" && suffix === "/home") {
    return json(res, 200, discoveryHome);
  }

  if (method === "GET" && suffix === "/search") {
    const q = url.searchParams.get("q");
    if (!q) {
      return json(res, 422, {
        type: "/errors/validation",
        title: "Validation failed",
        status: 422,
        detail: "q is required",
      });
    }
    return json(res, 200, { rows: discoveryHome.rows, warnings: [] });
  }

  if (method === "GET" && suffix.startsWith("/meta/")) {
    return json(res, 200, movieMeta);
  }

  if (method === "GET" && suffix.startsWith("/streams/")) {
    return json(res, 200, streamResolution);
  }

  if (method === "GET" && suffix.startsWith("/subtitles/")) {
    return json(res, 200, { subtitles: [], warnings: [] });
  }

  if (method === "GET" && suffix === "/continue-watching") {
    return json(res, 200, continueWatching);
  }

  if (method === "PUT" && suffix === "/progress") {
    const body = await readBody(req);
    const entry = {
      profile_id: PROFILE_ID,
      video_key: `movie:imdb:${body.video_id}`,
      media_key: `movie:imdb:${body.media_id}`,
      position_secs: body.position_secs,
      duration_secs: body.duration_secs,
      watched: Boolean(body.watched),
      revision: 1,
      last_device_id: null,
      updated_at: "2026-01-03T00:00:00Z",
    };
    continueWatching = [entry];
    return json(res, 200, entry);
  }

  if (method === "GET" && suffix === "/addons") {
    return json(res, 200, addons);
  }

  if (method === "POST" && suffix === "/addons") {
    await readBody(req);
    const addon = {
      id: "55555555-5555-7555-8555-555555555555",
      manifest_id: "installed.example",
      name: "Installed Add-on",
      version: "1.0.0",
      enabled: true,
      priority: addons.length,
      capabilities: { resources: ["catalog"], types: ["movie"], id_prefixes: ["tt"] },
      installed_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-01-03T00:00:00Z",
    };
    addons = [...addons, addon];
    return json(res, 201, addon);
  }

  if (method === "GET" && suffix === "/preferences") {
    return json(res, 200, defaultPreferences);
  }

  if (method === "PUT" && suffix === "/preferences") {
    const _body = await readBody(req);
    return json(res, 200, { ...authResponse().profile, preferences: _body, version: 2 });
  }

  if (method === "GET" && suffix === "/library") {
    return json(res, 200, library);
  }

  if (method === "POST" && suffix === "/library") {
    const body = await readBody(req);
    const entry = {
      profile_id: PROFILE_ID,
      media_key: `movie:imdb:${body.content_id}`,
      media_type: body.content_type,
      name: body.name,
      poster: body.poster ?? null,
      meta_snapshot: body.meta_snapshot ?? null,
      removed: false,
      added_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    library = [...library.filter((item) => item.media_key !== entry.media_key), entry];
    return json(res, 201, entry);
  }

  if (method === "DELETE" && suffix.startsWith("/library/")) {
    const mediaKey = decodeURIComponent(suffix.slice("/library/".length));
    library = library.filter((item) => item.media_key !== mediaKey);
    return noContent(res);
  }

  if (method === "GET" && suffix.startsWith("/sync")) {
    return json(res, 200, {
      changes: [],
      latest_sequence: Number(url.searchParams.get("after") ?? "0"),
      has_more: false,
    });
  }

  return json(res, 404, { type: "/errors/not-found", title: "Not found", status: 404 });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock-api listening on http://127.0.0.1:${PORT}`);
});
