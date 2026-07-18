# Vidio

A superfast, Rust-based, Stremio/Nuvio-compatible media hub backend.

Vidio is a **client-only** platform: it manages users, profiles, Stremio-compatible
add-ons, aggregated catalogs, the personal library and cross-device watch state.
It does **not** host, store, transcode or proxy any media. Playable sources are
provided entirely by user-installed add-ons, and users are responsible for only
accessing content they are authorized to.

## Status

First backend implementation. The full feature set, decisions and roadmap live in
[`docs/backend-architecture.md`](docs/backend-architecture.md). The web frontend
plan lives in [`docs/frontend-web-v1-plan.md`](docs/frontend-web-v1-plan.md).
A step-by-step run & deploy guide (in Russian) is in
[`docs/deployment-ru.md`](docs/deployment-ru.md).

Implemented and tested:

- User accounts (Argon2id), JWT access tokens, rotating refresh tokens with reuse
  detection, devices and sessions.
- Profiles and synced preferences.
- Stremio-compatible add-on protocol: manifests, `catalog`/`meta`/`stream`/`subtitles`,
  capability-based routing and protocol-correct request URLs.
- SSRF-safe add-on client (HTTPS only, no private/loopback/metadata targets, DNS
  re-validation, size/timeout limits, per-hop redirect validation).
- Add-on installation/management (install, enable/disable, remove, reorder, refresh).
- Discovery: concurrent home-board aggregation, search and metadata resolution.
- Playback resolution: concurrent stream/subtitle resolution with classification,
  web-ready detection, P2P-hiding and de-duplication.
- Library, playback progress (continue-watching/history) and an incremental,
  cursor-based per-profile sync feed.
- HTTP API (Axum) with RFC 9457 problem responses and a bearer-token auth extractor.

## Architecture

A Cargo workspace with hexagonal boundaries:

| Crate | Responsibility |
| --- | --- |
| `domain` | Pure entities, value objects, canonical media keys, invariants |
| `addon-protocol` | Stremio-compatible protocol types, routing, URL building |
| `auth` | Password hashing, access/refresh tokens |
| `addon-runtime` | SSRF-safe URL validation and the add-on HTTP client |
| `application` | Repository ports and use-case services |
| `persistence` | Repository adapters (in-memory now; PostgreSQL next) |
| `http-api` | Axum router, DTOs, error mapping, auth middleware |
| `telemetry` | Tracing/logging setup |
| `apps/api` | The HTTP API binary (`vidio-api`) |
| `apps/worker` | Background worker skeleton (`vidio-worker`) |

Services depend on repository **ports** (traits), so business logic is storage
agnostic and hermetically testable. The current storage adapter is in-memory; a
PostgreSQL/SQLx adapter implementing the same ports is the next milestone.

## Getting started

Requires the toolchain pinned in `rust-toolchain.toml` (stable 1.97.1).

```bash
# Build and test everything
cargo test --workspace

# Run the API (uses an insecure dev secret if VIDIO_ACCESS_TOKEN_SECRET is unset)
VIDIO_BIND_ADDR=127.0.0.1:8080 cargo run --bin vidio-api
```

Then:

```bash
curl -s localhost:8080/health
curl -s -X POST localhost:8080/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"supersecret"}'
```

### Configuration

See [`.env.example`](.env.example). Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `VIDIO_BIND_ADDR` | `0.0.0.0:8080` | Listen address |
| `VIDIO_ACCESS_TOKEN_SECRET` | dev secret | HS256 signing secret (≥ 32 bytes; **required in production**) |
| `VIDIO_ACCESS_TOKEN_TTL_SECS` | `900` | Access-token lifetime |
| `VIDIO_REFRESH_TOKEN_TTL_SECS` | `2592000` | Refresh-token lifetime |
| `VIDIO_ADDON_FETCH_TIMEOUT_MS` | `8000` | Per-add-on request timeout |
| `VIDIO_ADDON_MAX_RESPONSE_BYTES` | `5242880` | Add-on response size cap |
| `VIDIO_ADDON_ALLOW_PRIVATE_NETWORKS` | `false` | Dev only: allow private/HTTP add-on targets |

## API overview

All endpoints are versioned under `/v1`. Errors use `application/problem+json`
(RFC 9457). Authenticated endpoints require `Authorization: Bearer <access_token>`.

- `POST /v1/auth/register` · `POST /v1/auth/login` · `POST /v1/auth/refresh` · `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/profiles` · `GET|PATCH /v1/profiles/{id}` · `GET|PUT /v1/profiles/{id}/preferences`
- `GET|POST /v1/profiles/{id}/addons` · `PATCH|DELETE /v1/profiles/{id}/addons/{iid}` · `POST .../refresh` · `POST .../reorder`
- `GET /v1/profiles/{id}/home` · `GET /v1/profiles/{id}/search?q=` · `GET /v1/profiles/{id}/meta/{type}/{id}`
- `GET /v1/profiles/{id}/streams/{type}/{video_id}` · `GET /v1/profiles/{id}/subtitles/{type}/{id}`
- `GET|POST /v1/profiles/{id}/library` · `DELETE /v1/profiles/{id}/library/{media_key}`
- `PUT /v1/profiles/{id}/progress` · `GET /v1/profiles/{id}/continue-watching` · `GET /v1/profiles/{id}/history`
- `GET /v1/profiles/{id}/sync?after=&limit=`

## Testing

```bash
cargo test --workspace          # unit + integration tests
cargo clippy --workspace --all-targets
cargo fmt --all -- --check
```

## License

GPL-3.0-or-later.
