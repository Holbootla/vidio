# Vidio backend architecture

This document summarizes the implemented backend and the planned roadmap. Vidio
is a **client-only** media hub: it manages users, add-ons, catalogs, library and
watch state, but never hosts, transcodes or proxies media.

Rust minimizes the platform's own overhead, but end-to-end speed also depends on
third-party add-ons; bounded concurrency, caching and strict timeouts are
therefore first-class concerns.

## Stack

- Rust (stable, pinned via `rust-toolchain.toml`).
- Axum + Tokio + Tower for the HTTP API.
- Serde for (de)serialization; RFC 3339 timestamps throughout.
- Reqwest + rustls for outbound add-on requests.
- Argon2id, HS256 JWT (via `jsonwebtoken`), SHA-256-hashed refresh tokens.
- Tracing + EnvFilter for observability.
- Storage behind repository **ports**; in-memory adapter today, PostgreSQL/SQLx next.

Two binaries: `vidio-api` (stateless HTTP API) and `vidio-worker` (scheduled jobs).

## Crate layout (hexagonal)

`domain` → `addon-protocol`, `auth` → `addon-runtime` → `application` (ports +
services) → `persistence` (adapters) + `http-api` → `apps/{api,worker}`.

Business logic depends only on port traits, keeping it storage-agnostic and
hermetically testable.

## Implemented features

1. **Accounts & sessions** — registration (Argon2id), login, JWT access tokens,
   rotating refresh tokens with reuse detection (revokes the session family),
   logout, devices, stateless token verification.
2. **Profiles & preferences** — default profile per user, owner-scoped access,
   synced preferences.
3. **Stremio-compatible add-ons** — manifest parsing (short/full resources,
   catalogs, behavior hints), `catalog`/`meta`/`stream`/`subtitles`, capability
   routing (type + idPrefix), protocol-correct URL building, extra args.
4. **Add-on management** — SSRF-validated install, duplicate detection,
   enable/disable, remove, priority reorder, manifest refresh.
5. **Discovery** — concurrent home aggregation, search, metadata resolution,
   per-add-on failure isolation (warnings, not errors).
6. **Playback resolution** — concurrent stream/subtitle resolution, source
   classification, web-ready detection, P2P-hiding preference, de-duplication.
   Torrent/unknown sources are surfaced but flagged unsupported until clients
   ship a local playback engine.
7. **Library, progress & sync** — library with soft-remove, progress with
   completion inference, continue-watching/history, and a cursor-based
   incremental per-profile change feed.
8. **HTTP API** — versioned `/v1`, RFC 9457 problem responses, bearer auth,
   permissive CORS for multi-client access.

## Security

HTTPS-only add-on transport; rejection of embedded credentials and of
private/loopback/link-local/CGNAT/reserved IPs, internal hostnames and cloud
metadata endpoints; DNS re-validation against rebinding; response-size and
timeout limits; per-hop redirect validation. Secret-bearing values (configured
transport URLs) are never logged and are omitted from API DTOs and sync payloads.

## Next steps

- **PostgreSQL/SQLx adapter** implementing the existing ports (production storage).
- Response caching (Valkey) with per-visibility scoping and stale-while-revalidate.
- Rate limiting, idempotency keys, envelope encryption for configured URLs.
- Email verification/reset delivery; worker jobs (manifest refresh, cleanup).
- Single-catalog pagination endpoint; OpenAPI generation.

## Features to plan fully later

Multiple/child profiles · Trakt sync & scrobbling · custom layouts & collections
· add-on repositories (`addon_catalog`) · recommendations · calendar &
notifications · offline downloads · debrid integrations · local P2P/torrent
sidecars · casting & remote control · watch parties · live TV/EPG · local
media/DLNA/Jellyfin/Plex · passkeys/OAuth/MFA · ratings & shared lists · audio /
podcast / radio / book experiences · legacy & IPFS transports · optional legal
media relay/transcoding · multi-region deployment.

## References

- [Stremio add-on protocol](https://stremio.github.io/stremio-addon-sdk/protocol.html)
- [Stremio SDK resources](https://stremio.github.io/stremio-addon-sdk/api/)
- [Nuvio features](https://nuvio.wiki/features)
