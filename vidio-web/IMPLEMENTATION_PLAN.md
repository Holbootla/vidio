# Vidio web — implementation plan

Turns the Vidio web v1 product plan into an ordered, contract-aware build plan for this repository. Stack and BFF rules apply unchanged (Next.js App Router, TanStack Query, Zustand for player/UI only, Zod-validated fetch client, BFF-only refresh cookie).

**App root:** repository root (maps to the `web/` tree in the product plan).

**Backend source of truth:** the Vidio Rust API (`/v1` routes and DTOs). No OpenAPI artifact yet — Zod schemas are hand-written from those types.

---

## Dependency / order

```
M1 Foundation
 └─► M2 Browse
      └─► M3 Playback          (needs detail + query client)
           │
           ├─► M4 Add-ons & preferences  (can start after M1; needed before rich discover UX)
           │
           └─► M5 Sync & offline         (needs library/progress mutations from M2–M3)
                └─► M6 Hardening
```

| Rule            | Detail                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strict          | M1 before everything. M2 before M3. M5 after library + progress mutations exist. M6 last.                                                              |
| Parallel-safe   | M4 can start once M1 auth + profile context exist; ship before M6. Prefer finishing M4 before polishing Discover (catalog metadata lives on installs). |
| Do not block on | Per-catalog discover API, catalog `skip` pagination, sessions UI, torrent playback, multi-profile switcher.                                            |

---

## Contract inventory (implemented today)

All authenticated routes need `Authorization: Bearer <access_token>`. Errors are RFC 9457 `application/problem+json`: `{ type, title, status, detail }` (`type` values like `/errors/validation`).

| Method       | Path                                    | Request                                               | Response                                                      |
| ------------ | --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| GET          | `/health`                               | —                                                     | `{ status: "ok" }`                                            |
| POST         | `/v1/auth/register`                     | `{ email, password, profile_name? }`                  | **201** `{ user: UserDto, profile: Profile }` — **no tokens** |
| POST         | `/v1/auth/login`                        | `{ email, password, device? }`                        | `AuthResponse`                                                |
| POST         | `/v1/auth/refresh`                      | `{ refresh_token }`                                   | `AuthResponse`                                                |
| POST         | `/v1/auth/logout`                       | `{ refresh_token }`                                   | **204**                                                       |
| GET          | `/v1/me`                                | —                                                     | `UserDto`                                                     |
| GET          | `/v1/profiles`                          | —                                                     | `Profile[]`                                                   |
| GET          | `/v1/profiles/{profile_id}`             | —                                                     | `Profile`                                                     |
| PATCH        | `/v1/profiles/{profile_id}`             | `{ name }`                                            | `Profile`                                                     |
| GET          | `/v1/profiles/{profile_id}/preferences` | —                                                     | `ProfilePreferences`                                          |
| PUT          | `/v1/profiles/{profile_id}/preferences` | `ProfilePreferences`                                  | `Profile` (full)                                              |
| GET/POST     | `.../addons`                            | install: `{ transport_url }`                          | `AddonDto[]` / **201** `AddonDto`                             |
| POST         | `.../addons/reorder`                    | `{ order: uuid[] }`                                   | `AddonDto[]`                                                  |
| PATCH/DELETE | `.../addons/{installation_id}`          | patch: `{ enabled? }`                                 | `AddonDto` / **204**                                          |
| POST         | `.../addons/{installation_id}/refresh`  | —                                                     | `AddonDto`                                                    |
| GET          | `.../home`                              | —                                                     | `DiscoveryResponse`                                           |
| GET          | `.../search?q=`                         | `q` required, non-empty                               | `DiscoveryResponse`                                           |
| GET          | `.../meta/{content_type}/{id}`          | —                                                     | `Meta` (addon-protocol, **camelCase**)                        |
| GET          | `.../streams/{content_type}/{video_id}` | —                                                     | `StreamResolution`                                            |
| GET          | `.../subtitles/{content_type}/{id}`     | —                                                     | `SubtitleResolution`                                          |
| PUT          | `.../progress`                          | `ProgressRequest`                                     | `PlaybackProgress`                                            |
| GET          | `.../continue-watching`                 | —                                                     | `PlaybackProgress[]` (limit 50 server-side)                   |
| GET          | `.../history`                           | —                                                     | `PlaybackProgress[]` (limit 100) — **not in product screens** |
| GET/POST     | `.../library`                           | add: `AddLibraryRequest`                              | `LibraryEntry[]` / **201** `LibraryEntry`                     |
| DELETE       | `.../library/{*media_key}`              | path = full media key                                 | **204**                                                       |
| GET          | `.../sync?after=&limit=`                | `after` default 0; `limit` default 100, clamped 1–500 | `SyncPage`                                                    |

### Shared DTO shapes (Zod must match)

- **UserDto:** `{ id, email, status, created_at }` — `status`: `pending_verification` \| `active` \| `disabled`; times RFC3339.
- **AuthResponse:** `{ access_token, token_type, access_expires_at, refresh_token, refresh_expires_at, profile }`.
- **Profile:** `{ id, user_id, name, is_default, preferences, version, created_at, updated_at }`.
- **ProfilePreferences:** `{ locale, subtitle_languages[], audio_languages[], preferred_qualities[], hide_p2p_streams }`.
- **AddonDto:** `{ id, manifest_id, name, version, description?, enabled, priority, capabilities, installed_at, updated_at }` — **never** `transport_url` / `manifest_snapshot`.
- **AddonCapabilities:** `{ resources[], types[], id_prefixes[] }` — **no catalog extras**.
- **DiscoveryResponse:** `{ rows: CatalogRow[], warnings: AddonWarning[] }` (snake_case).
- **CatalogRow:** `{ installation_id, addon_name, catalog_id, content_type, title, items: MetaPreview[] }`.
- **MetaPreview / Meta / Video / Stream / Subtitle:** addon-protocol **camelCase** (`type` not `content_type` in JSON; Rust field is `content_type` via `#[serde(rename = "type")]`).
- **StreamResolution:** `{ streams: ResolvedStream[], warnings }` — `ResolvedStream`: `{ installation_id, addon_name, kind, is_web_ready, supported, stream }` (`kind`: `url`\|`youtube`\|`torrent`\|`external`\|`unknown`).
- **SubtitleResolution:** `{ subtitles: ResolvedSubtitle[], warnings }` — `ResolvedSubtitle`: `{ installation_id, addon_name, subtitle }`.
- **AddLibraryRequest:** `{ content_type, content_id, manifest_id, name, poster?, meta_snapshot? }`.
- **LibraryEntry:** `{ profile_id, media_key, media_type, name, poster?, meta_snapshot?, removed, added_at, updated_at }` — list returns non-removed only.
- **ProgressRequest:** `{ content_type, video_id, media_id, manifest_id, position_secs, duration_secs, watched?, device_id? }`.
- **PlaybackProgress:** `{ profile_id, video_key, media_key, position_secs, duration_secs, watched, revision, last_device_id?, updated_at }`.
- **SyncPage:** `{ changes: SyncChange[], latest_sequence, has_more }` — `SyncChange`: `{ sequence, profile_id, kind, key, payload, deleted, created_at }`; `kind`: `preferences`\|`addon`\|`library`\|`progress`.
- **DeviceRequest (login):** `{ platform?, display_name?, app_version? }` — send `platform: "web"`.

**Media keys** (library delete path): e.g. `movie:imdb:tt1254207`, `series:addon:{manifestId}:{id}`. URL-encode the full key; route is catch-all `{*media_key}`.

---

## Backend contract mismatches / unavailable endpoints

Explicit gaps vs `docs/frontend-web-v1-plan.md` screens. Implement UI around these; do not invent client-only APIs.

| Gap                                | Product plan expectation                     | Actual contract                                                                                        | Web v1 workaround                                                                                                                            |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-catalog Discover**           | Browse one add-on catalog with genre `extra` | **No** `GET .../catalog/...` or extras query                                                           | Discover = pick a **home row** (or search result set) client-side; genre filter **unavailable** until backend exposes catalog fetch + extras |
| **Catalog pagination `skip`**      | Infinite scroll later                        | Not exposed                                                                                            | Load first aggregated page only; no “load more”                                                                                              |
| **Catalog extras / genre options** | From catalog `extra`                         | `AddonDto` omits manifest catalogs                                                                     | Cannot render genre chips from API                                                                                                           |
| **Register → session**             | Auth flow                                    | Register returns user+profile **without** tokens                                                       | BFF: register then login; or UI “continue to login”                                                                                          |
| **Sessions / devices**             | Settings → Account “later”                   | **No** list/revoke session endpoints                                                                   | Account = email from `/me` + logout only                                                                                                     |
| **Continue Watching enrichment**   | Poster row                                   | `PlaybackProgress[]` keys only                                                                         | Join posters from library cache / prior meta / placeholder; optional silent meta fetch                                                       |
| **History**                        | Not in screens                               | `GET .../history` exists                                                                               | Omit from nav; optional later                                                                                                                |
| **Multi-profile UI**               | Non-goal                                     | list/get/rename exist                                                                                  | Always use `AuthResponse.profile` / default from `GET /v1/profiles`; no switcher                                                             |
| **OpenAPI**                        | Generate client later                        | None                                                                                                   | Hand-written Zod + typed fetch                                                                                                               |
| **JSON casing mix**                | —                                            | App wrappers snake_case; Meta/Stream/Subtitle camelCase                                                | Dual Zod conventions; never normalize away wire shape in parsers                                                                             |
| **Torrent / non-web-ready**        | Disabled UI                                  | Returned with `supported: false` / `is_web_ready: false`; P2P hidden server-side if `hide_p2p_streams` | Disable + tooltip; never attempt play                                                                                                        |

---

## Milestone 1 — Foundation

### Scope

Scaffold Next.js app, tooling, design tokens, typed API client, BFF auth cookie lifecycle, authenticated app shell with profile context. No browse/playback screens beyond empty shells / auth pages.

### Routes / components / modules

```
vidio-web/
  app/
    (marketing)/
      page.tsx                 # landing → login/register CTAs
      login/page.tsx
      register/page.tsx
    (app)/
      layout.tsx               # shell: nav placeholders, auth gate
      board/page.tsx           # stub
      ...                      # other stubs optional
    api/auth/
      login/route.ts
      register/route.ts
      refresh/route.ts
      logout/route.ts
  components/ui/               # shadcn/Radix primitives
  components/shell/            # AppNav, AuthGate
  features/auth/               # forms, session hooks
  lib/api/                     # client, schemas, errors, query keys
  lib/auth/                    # access-token store (memory/Zustand)
  styles/                      # Tailwind v4 @theme tokens
  test/                        # Vitest + MSW setup
```

### API endpoints & DTOs

| Client surface                | Backend                                             | Notes                                                                                                                                            |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| BFF `POST /api/auth/register` | `POST /v1/auth/register` then `POST /v1/auth/login` | Set httpOnly refresh cookie from login; return `{ access_token, access_expires_at, profile, user }` to browser — **never** refresh token in JSON |
| BFF `POST /api/auth/login`    | `POST /v1/auth/login`                               | Body + `device: { platform: "web", display_name, app_version? }`; cookie + access token                                                          |
| BFF `POST /api/auth/refresh`  | `POST /v1/auth/refresh`                             | Read cookie → body `{ refresh_token }`; rotate cookie; return new access token                                                                   |
| BFF `POST /api/auth/logout`   | `POST /v1/auth/logout`                              | Cookie → body; clear cookie; **204**                                                                                                             |
| Direct `GET /v1/me`           | —                                                   | After access token available                                                                                                                     |
| Direct `GET /v1/profiles`     | —                                                   | Resolve default `is_default` profile if needed                                                                                                   |

Zod: `ProblemJson`, `UserDto`, `Profile`, `ProfilePreferences`, `AuthResponse`, register/login request bodies.

### Data / state strategy

- Access token + `profile` in memory (Zustand `authStore`); lost on full reload → BFF refresh on boot.
- TanStack Query: `['me']`, `['profiles']` only.
- Env: `NEXT_PUBLIC_API_BASE_URL` (browser→Rust), `VIDIO_API_BASE_URL` (BFF→Rust), cookie name/flags documented.
- Cookie: `httpOnly`, `Secure`, `SameSite=Strict`, path scoped to `/api/auth`.

### Accessibility

- Auth forms: labeled inputs, `aria-invalid` + `detail` from ProblemJson, focus on first error.
- Visible focus rings from tokens; skip-link to main in shell.
- Prefer reduced-motion token wiring even if unused until M6.

### Tests

- Unit: ProblemJson → `ApiError` mapping; cookie parsing helpers.
- MSW: login/refresh/logout happy + 401/422.
- Component: LoginForm / RegisterForm error surfacing.
- Smoke: `GET /health` optional in CI against mock.

### Exit criteria

- [ ] `pnpm` app builds; oxlint + oxfmt + `tsc --noEmit` pass.
- [ ] Register → login → access token in memory; refresh cookie set; reload restores session via refresh.
- [ ] Logout clears cookie + memory; protected `(app)` redirects to login.
- [ ] Typed client rejects malformed JSON via Zod; RFC 9457 mapped.
- [ ] Shell renders with nav stubs; design tokens applied (non-default fonts per design rules).

---

## Milestone 2 — Browse

### Scope

Board, Discover (constrained), Search, Detail, Library. Wire queries/mutations to real endpoints. Sources panel can be stubbed until M3.

### Routes / components / modules

| App route             | Feature module       | Primary UI                                                                                                                                   |
| --------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/board`              | `features/discovery` | Horizontal catalog rows + warning toast/banner; Continue Watching **placeholder row** (empty until M3 progress exists — still call endpoint) |
| `/discover`           | `features/discovery` | Catalog picker from **last home `rows`** (installation_id + catalog_id + title); grid of that row’s items only                               |
| `/search`             | `features/discovery` | Search box (`/` hotkey later in M6); results as rows/grid                                                                                    |
| `/detail/[type]/[id]` | `features/detail`    | Hero, synopsis, metadata, library toggle, series episode list                                                                                |
| `/library`            | `features/library`   | Grid + type filter (client-side on `media_type`); remove                                                                                     |

Shared: `PosterCard`, `CatalogRow`, `MetaHero`, `EpisodePicker`, `AddonWarnings`, `EmptyState`, `Skeleton`.

Query keys: `['home', profileId]`, `['search', profileId, q]`, `['meta', profileId, type, id]`, `['library', profileId]`, `['continueWatching', profileId]`.

### API endpoints & DTOs

| Use                     | Endpoint                         | DTO                                                                                            |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Board rows              | `GET .../home`                   | `DiscoveryResponse`                                                                            |
| Continue Watching strip | `GET .../continue-watching`      | `PlaybackProgress[]` — posters unresolved (show title from key / “Resume” until M3 enrichment) |
| Search                  | `GET .../search?q=`              | `DiscoveryResponse`; empty `q` → client validation (backend 422)                               |
| Detail                  | `GET .../meta/{type}/{id}`       | `Meta` camelCase                                                                               |
| Library list            | `GET .../library`                | `LibraryEntry[]`                                                                               |
| Add                     | `POST .../library`               | `AddLibraryRequest` from meta + **manifest_id** from catalog row / resolve strategy            |
| Remove                  | `DELETE .../library/{media_key}` | Encode `media_key` from entry                                                                  |

**manifest_id for library add:** Prefer `CatalogRow` provenance when navigating board/search → detail (pass via query state or detail loader context). If deep-linked detail only has type/id, use IMDb/Kitsu-safe ids with a sentinel only when protocol allows; for addon-scoped ids, require provenance or block add with message.

**Unavailable:** per-catalog fetch, genre filter, `skip` — Discover UI must not promise them.

### Data / state strategy

- staleTime: home/search short (~30–60s); meta longer (~5–15m); library ~30s.
- Optimistic library add/remove on query cache; rollback on error.
- Prefetch meta on poster focus/hover.
- RSC shells OK; grids/detail interactive client components.

### Accessibility

- Poster grids: `role="list"` / keyboard focusable cards; Enter opens detail.
- Detail: heading hierarchy; episode list keyboard operable.
- Warnings: non-modal, dismissible, not only color.

### Tests

- MSW fixtures for home/search/meta/library.
- Library add/remove optimistic rollback.
- Discover does not call non-existent catalog API.
- Detail series episode picker renders `videos[]`.

### Exit criteria

- [ ] Board shows rows + handles `warnings`.
- [ ] Search returns aggregated rows; empty query blocked client-side.
- [ ] Detail loads meta; library add/remove works with correct media key delete URL.
- [ ] Discover limited to selecting an existing home row’s items (documented limitation).
- [ ] No transport URL ever rendered.

---

## Milestone 3 — Playback

### Scope

Sources UI, Vidstack player, subtitles, progress reporting, resume, Continue Watching usable row.

### Routes / components / modules

| Route                         | Module                            | UI                                                                         |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Detail sources drawer/section | `features/playback`               | Group/sort streams; disable `!supported` or torrent; label `!is_web_ready` |
| `/watch/[type]/[videoId]`     | `features/playback`, `lib/player` | Vidstack; source select; subtitle tracks; hotkeys                          |

Modules: `selectPlayableSource()`, `progressReporter` (15s + pause/seek/end), `resumePosition` from continue-watching/history match on `video_key`.

Zustand `playerStore`: current source, text track, UI chrome only.

### API endpoints & DTOs

| Use         | Endpoint                                    | DTO                                    |
| ----------- | ------------------------------------------- | -------------------------------------- |
| Sources     | `GET .../streams/{content_type}/{video_id}` | `StreamResolution`                     |
| Subtitles   | `GET .../subtitles/{content_type}/{id}`     | `SubtitleResolution`                   |
| Progress    | `PUT .../progress`                          | `ProgressRequest` → `PlaybackProgress` |
| Resume / CW | `GET .../continue-watching`                 | Match `video_key`; compute resume secs |
| Optional    | `GET .../history`                           | Not required for exit                  |

**ProgressRequest mapping:** `video_id` = route video id; `media_id` = parent meta id; `content_type` = type; `manifest_id` = stream’s add-on `manifest_id` if known else installation’s `manifest_id` from addons list / row provenance; `device_id` optional (omit until device ids stored).

**Playback rules:**

- `kind === "url"` && `is_web_ready` → Vidstack (HLS/DASH/MP4).
- `youtube` → embed/iframe.
- `external` → `window.open(external_url)`.
- `torrent` / `unknown` / `!supported` → disabled + tooltip.
- `supported && !is_web_ready` → disabled (“needs local proxy — later”).

Stream nested object remains camelCase inside snake_case wrapper.

### Data / state strategy

- **Never** cache streams in TanStack (`gcTime`/`staleTime` 0) or HTTP cache.
- Subtitles: short stale OK.
- Progress: optimistic patch of continue-watching list; throttle writes.
- Resume: before play, read CW entry for video; seek when metadata ready.

### Accessibility

- Player: keyboard (space, j/k or arrows, m, f, c for captions) documented in UI.
- Source list: radiogroup semantics; disabled items explain why (`title`/`aria-description`).
- Captions menu labeled; prefer `ProfilePreferences.subtitle_languages` order when applying tracks.

### Tests

- Unit: source selection matrix (url/youtube/external/torrent/web-ready).
- Unit: progress throttle + completion threshold awareness (backend auto-watches at 0.9 — client may still send positions).
- Component: sources list disables torrent.
- MSW: streams/subtitles/progress.

### Exit criteria

- [ ] User can open sources from detail/episode, start web-ready URL playback.
- [ ] Subtitles load and are selectable.
- [ ] Progress PUT fires throttled; CW row updates after watch.
- [ ] Resume seeks to saved `position_secs` when `!watched`.
- [ ] Unsupported sources never start the player.

---

## Milestone 4 — Add-ons & preferences

### Scope

Install/manage/reorder add-ons; preferences form; account page (email + logout only).

### Routes / components / modules

| Route                   | Module                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `/settings/addons`      | `features/addons` — list, install URL form, enable switch, refresh, remove, reorder (dnd) |
| `/settings/preferences` | `features/settings` — locale, subtitle/audio langs, qualities, hide P2P                   |
| `/settings/account`     | `features/settings` — email from `me`; logout button                                      |

Components: `AddonList`, `InstallAddonForm`, `ReorderList`, `PreferencesForm`. **Never** display transport URL (not in DTO).

### API endpoints & DTOs

| Use            | Endpoint                       | Body / response                              |
| -------------- | ------------------------------ | -------------------------------------------- |
| List           | `GET .../addons`               | `AddonDto[]`                                 |
| Install        | `POST .../addons`              | `{ transport_url }` → **201** `AddonDto`     |
| Enable/disable | `PATCH .../addons/{id}`        | `{ enabled: boolean }`                       |
| Refresh        | `POST .../addons/{id}/refresh` | `AddonDto`                                   |
| Remove         | `DELETE .../addons/{id}`       | **204**                                      |
| Reorder        | `POST .../addons/reorder`      | `{ order: installationId[] }` → `AddonDto[]` |
| Get prefs      | `GET .../preferences`          | `ProfilePreferences`                         |
| Put prefs      | `PUT .../preferences`          | full `ProfilePreferences` → `Profile`        |
| Account        | `GET /v1/me`                   | `UserDto`                                    |

**Unavailable:** session/device management endpoints.

After prefs `hide_p2p_streams` change, invalidate stream queries.

### Data / state strategy

- Mutations invalidate `['addons', profileId]`, `['home', profileId]`, `['search', ...]`.
- Reorder: optimistic reorder in cache; commit full `order` array of ids.
- Preferences: RHF + Zod; PUT replaces entire preferences object (send all fields).

### Accessibility

- Reorder: keyboard alternative to drag (move up/down buttons) required for AA.
- Switches labeled; install form describes URL as secret (not shown after install).

### Tests

- MSW: install omits secrets in response; reorder payload order.
- Preferences PUT round-trip.
- Account has no sessions UI.

### Exit criteria

- [ ] Full add-on lifecycle works; transport URL never shown.
- [ ] Preferences persist and reload.
- [ ] Account shows email + logout only.
- [ ] Home refresh reflects new/reordered add-ons.

---

## Milestone 5 — Sync & offline

### Scope

Sync feed consumer, cache application, IndexedDB cursor + offline mutation queue for library/progress (and prefs if queued).

### Routes / components / modules

No new pages. Modules:

```
lib/sync/
  cursor.ts          # idb cursor per profileId
  applyChange.ts     # reducer: kind → query cache patch
  pull.ts            # GET sync loop while has_more
  offlineQueue.ts    # enqueue/flush library + progress (+ prefs)
features/sync/
  SyncProvider.tsx   # on auth + interval + online event
```

### API endpoints & DTOs

| Use    | Endpoint                                                          | Notes                                                                                                    |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Pull   | `GET .../sync?after={cursor}&limit=100`                           | Persist `latest_sequence` when page applied; if `has_more`, continue with `after = last change.sequence` |
| Replay | Existing `POST/DELETE library`, `PUT progress`, `PUT preferences` | Idempotent server-side                                                                                   |

**SyncChange.payload:** opaque JSON snapshot — parse per `kind` with Zod unions (`LibraryEntry`, `PlaybackProgress`, `ProfilePreferences` / addon-shaped payload, or `null` when `deleted`).

### Data / state strategy

- On login and every N minutes / `visibilitychange` / `online`: pull sync.
- Apply: update TanStack cache for library/progress/preferences/addons; ignore unknown kinds safely.
- Offline: queue mutations with client idempotency keys if useful; flush in order on reconnect; then pull sync.
- Optimistic UI from M2–M3 remains; sync is reconciliation layer.

### Accessibility

- Sync/offline status: polite live region (“Offline — changes will sync when reconnected”) — not only icon color.

### Tests

- Unit: `applyChange` reducer for library add/delete, progress upsert, prefs replace, addon delete flag.
- Unit: pagination loop until `!has_more`.
- Integration: offline queue flush ordering with MSW.

### Exit criteria

- [ ] Cursor survives reload in IndexedDB.
- [ ] Sync updates library/progress without full refetch storms.
- [ ] Offline library toggle + progress enqueue and flush successfully.
- [ ] No duplicate rows after sync + optimistic paths.

---

## Milestone 6 — Hardening

### Scope

A11y pass, performance budget, e2e coverage, Docker/deploy. No new product features except keyboard shortcuts and polish deferred from earlier milestones.

### Routes / components / modules

- Global shortcuts: `/` focuses search; grid arrow nav if not done.
- `next/image` sizing for posters; route-level splitting audit.
- `Dockerfile` standalone Next output; CI script per product plan §12.
- axe in Playwright + critical component tests.

### API endpoints & DTOs

None new. Reconfirm MSW handlers match contract inventory. Fix any Zod drift found in e2e.

### Data / state strategy

- Measure: home TTI, detail meta cache hit, stream fetch uncached.
- Bundle: player code only on `/watch` (and sources chunk).

### Accessibility

- WCAG 2.2 AA checklist on auth, board, detail, player, settings.
- `prefers-reduced-motion` disables non-essential motion (ship 2–3 intentional motions elsewhere per design rules).
- Focus traps in dialogs; player controls reachable.

### Tests

Playwright e2e (MSW or test API):

1. Register → login
2. Install add-on (mock transport)
3. Board → detail → sources → play (mock stream URL)
4. Progress → Continue Watching visible
5. Library add/remove
6. axe on those pages

CI: `pnpm install --frozen-lockfile`, oxlint, oxfmt --check, tsc, vitest, playwright, next build.

### Exit criteria

- [ ] E2E path above green in CI.
- [ ] axe: no critical/serious on primary flows.
- [ ] Docker image builds and serves standalone output.
- [ ] Performance: documented budgets met or waived with issue links.
- [ ] Contract caveats still documented; no fake catalog/session APIs.

---

## Cross-cutting implementation notes

1. **Profile id:** From login/refresh `profile`; store beside access token; all `/v1/profiles/{id}/...` calls use it.
2. **401 handling:** Direct API client → BFF refresh once → retry; failure → logout.
3. **IDs in paths:** `content_type` and ids are path segments — encode safely; media keys need encodeURIComponent per segment or full catch-all encoding as used by Axum.
4. **Directory rename:** Product plan says `web/`; this repo uses `vidio-web/` — keep imports consistent.
5. **Do not implement yet:** application code under this plan is out of scope until a milestone kickoff; this file is the sole deliverable for planning.

---

## Milestone checklist (quick)

| #   | Name            | Depends on | Hard blockers from backend                      |
| --- | --------------- | ---------- | ----------------------------------------------- |
| 1   | Foundation      | —          | Register without tokens (BFF chains login)      |
| 2   | Browse          | M1         | No catalog-by-id / genre / skip                 |
| 3   | Playback        | M2         | CW lacks posters; streams uncached              |
| 4   | Add-ons & prefs | M1         | No sessions API; AddonDto has no catalog extras |
| 5   | Sync & offline  | M2–M3      | —                                               |
| 6   | Hardening       | M1–M5      | —                                               |
