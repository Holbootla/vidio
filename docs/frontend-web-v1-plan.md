# Web frontend — v1 plan

The plan for the first version of the Vidio **web** client. It targets the
implemented backend API (`/v1`, RFC 9457 errors, bearer access tokens + rotating
refresh tokens, per-profile sync feed) and is designed so the other platform
clients can reuse the same API contract and UX patterns.

## Platform clients (context)

The web app is the first of several clients. Planned stacks per platform:

| Platform | Stack |
| --- | --- |
| Web | Next.js, React, TypeScript, Tailwind CSS, Vidstack player |
| Android / Android TV | Kotlin, Jetpack Compose, AndroidX Media3 |
| Windows | C#, .NET, WinUI 3, libmpv / Media Foundation |
| iOS | Swift, SwiftUI, AVFoundation |
| macOS | Swift, SwiftUI, AVFoundation |
| Linux | Tauri (Rust), React, TypeScript, Tailwind, libmpv |
| Tizen | Tizen Web App, React, TypeScript, AVPlay |

The rest of this document covers **web only**.

## 1. Goals & non-goals

**Goals**

- A fast, modern, accessible browser client for browse → detail → play.
- Full parity with the implemented backend: auth, profiles, add-ons, discovery,
  library, progress/continue-watching, search, playback source selection.
- Secure token handling (no refresh token in JS-reachable storage).
- Offline-tolerant library/progress via the sync feed with optimistic updates.
- A design system that the TV and mobile clients can visually align with.

**Non-goals (v1)**

- Torrent/P2P playback (backend flags these unsupported for now).
- Multiple profiles switching UI beyond the default profile (schema-ready, later).
- Downloads, casting, watch parties, Trakt — later milestones.

## 2. Stack (latest stable)

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js (App Router, React Server Components)** | Turbopack dev/build; BFF via Route Handlers |
| Language | **TypeScript (strict)** | `strict`, `noUncheckedIndexedAccess` |
| Styling | **Tailwind CSS v4** | CSS-first `@theme`; design tokens as CSS vars |
| UI primitives | **Radix UI** + **shadcn/ui** | accessible, unstyled → themed |
| Server state | **TanStack Query v5** | caching, mutations, optimistic updates |
| Client state | **Zustand** | player + ephemeral UI state only |
| Forms/validation | **React Hook Form** + **Zod** | Zod shared for API DTO parsing |
| Player | **Vidstack** (HLS via `hls.js`, DASH via `dash.js`, native MP4) | Shaka Player as fallback |
| Data/offline | **IndexedDB** via `idb` | offline mutation queue + sync cursor |
| i18n | **next-intl** | message catalogs, locale routing |
| Icons | **lucide-react** | |
| Linting | **oxlint** | fast; primary linter |
| Formatting | **oxfmt** | fast; fallback to Prettier if a feature gap blocks CI |
| Testing | **Vitest** + **Testing Library**, **Playwright** (e2e), **MSW** (API mocks) | |
| Package manager | **pnpm** (Node 22 LTS) | |
| Deploy | Docker (standalone Next output); Vercel-compatible | |

> `oxfmt` is early-stage; the repo will pin a known-good version and CI will run
> `oxlint` + `oxfmt --check`. If a blocking gap appears, Prettier is the drop-in
> fallback without changing app code.

## 3. Architecture — Backend-for-Frontend (BFF)

The browser never holds the refresh token. Next.js Route Handlers act as a thin
BFF between the browser and the Rust API:

- **Login/refresh/logout** happen through Next Route Handlers. The refresh token
  is stored in an **httpOnly, Secure, SameSite=Strict cookie** set by the BFF.
- The **access token** is kept **in memory** (React state/Zustand) and attached
  to API calls; on 401 the client calls the BFF `/refresh`, which reads the
  cookie, calls the Rust API, rotates the token, and returns a fresh access token.
- All other reads can go **directly** from the browser to the Rust API with the
  in-memory bearer token (CORS is permissive server-side), or be proxied through
  the BFF for uniformity. v1 uses direct calls for data, BFF only for the token
  lifecycle, minimizing latency while keeping the refresh token safe.

```
Browser ──(access token in memory)──▶ Rust API  /v1/...
   │
   └──(httpOnly refresh cookie)────▶ Next BFF ──▶ Rust API  /v1/auth/*
```

A generated, typed API client (from the backend OpenAPI once available; until
then a hand-written typed `fetch` wrapper with Zod response schemas) centralizes
error mapping (RFC 9457 → typed `ApiError`) and auth retry.

## 4. Directory structure

```
web/
  app/
    (marketing)/                 # logged-out landing/auth
    (app)/                       # authenticated shell
      board/                     # home board (aggregated catalogs)
      discover/                  # per-catalog browse + filters
      search/
      library/
      detail/[type]/[id]/        # meta detail + episode picker + sources
      watch/[type]/[videoId]/    # player route
      settings/
        addons/                  # install/manage/reorder add-ons
        account/
        preferences/
    api/                         # BFF Route Handlers (auth token lifecycle)
      auth/{login,refresh,logout}/route.ts
  components/                    # UI (shadcn-derived) + composite components
  features/                     # feature modules (queries, hooks, components)
    auth/ addons/ discovery/ library/ playback/ sync/
  lib/
    api/                         # typed client, Zod schemas, error mapping
    sync/                        # sync-feed consumer, IndexedDB queue
    player/                      # Vidstack setup, source selection
    i18n/
  styles/                       # Tailwind v4 theme tokens
  test/                         # Vitest setup, MSW handlers
  e2e/                          # Playwright
```

## 5. Screens & routes (v1)

1. **Auth** — register, login (email/password), logout. Errors surfaced from
   RFC 9457 responses.
2. **Board** (`/board`) — `GET /v1/profiles/{id}/home`: rows of catalogs with
   posters; per-add-on warnings shown non-intrusively; a **Continue Watching**
   row from `GET .../continue-watching`.
3. **Discover** (`/discover`) — browse a chosen add-on catalog with genre filter
   (uses catalog `extra`); infinite scroll (pagination endpoint arrives later —
   v1 loads the first page and appends when the backend adds `skip`).
4. **Search** (`/search`) — `GET .../search?q=` across search-capable catalogs.
5. **Detail** (`/detail/[type]/[id]`) — `GET .../meta/{type}/{id}`: hero art,
   synopsis, metadata, add/remove **Library**, and for series an episode picker.
6. **Sources** — on detail/episode select, `GET .../streams/{type}/{videoId}`:
   grouped, sorted sources with quality/labels; unsupported (torrent) sources
   are visibly disabled with an explanatory tooltip.
7. **Watch** (`/watch/[type]/[videoId]`) — Vidstack player; loads subtitles from
   `GET .../subtitles/...`; reports progress via `PUT .../progress` (throttled);
   resumes from saved position; auto-marks watched by backend threshold.
8. **Library** (`/library`) — `GET .../library`, grid with type filter, remove.
9. **Settings → Add-ons** — list/install (`POST .../addons` with manifest URL),
   enable/disable, reorder (drag-and-drop → `POST .../addons/reorder`), refresh,
   remove. Never displays the configured transport URL (backend omits it).
10. **Settings → Preferences** — subtitle/audio languages, preferred qualities,
    hide-P2P toggle → `PUT .../preferences`.
11. **Settings → Account** — email, sessions/devices (later), logout.

## 6. State, data & sync

- **TanStack Query** for all reads with sensible `staleTime`s mirroring backend
  cache guidance (catalogs short, meta long, streams never cached).
- **Optimistic mutations** for library add/remove and progress, rolled back on
  error.
- **Sync consumer**: on load and periodically, `GET .../sync?after=<cursor>`;
  apply `library`/`progress`/`preferences`/`addon` changes to the query cache
  and persist the cursor in IndexedDB. Offline mutations are queued in IndexedDB
  and flushed on reconnect (idempotent on the backend).

## 7. Player & source selection

- Choose delivery by `kind`: `url` (native MP4 or HLS/DASH via hls.js/dash.js),
  `youtube` (embed/iframe), `external` (open in new tab). `torrent`/`unknown`
  are shown disabled in v1.
- Only `is_web_ready` HTTPS sources play in-browser; non-web-ready sources are
  labeled (they need a local proxy/engine — a later milestone).
- Progress reporting throttled (e.g. every 15s and on pause/seek/end).

## 8. Design system & accessibility

- Tailwind v4 tokens (`@theme`) for color/spacing/typography; dark-first with a
  light theme; large-poster and dense-grid layouts.
- Radix/shadcn components ensure focus management, keyboard nav and ARIA.
- Keyboard-first: `/` to search, arrow navigation on grids, full player hotkeys.
- Targets WCAG 2.2 AA; visible focus rings; reduced-motion support.

## 9. Tooling & configuration

- **oxlint** with a shared config (type-aware rules where supported), run in CI
  and pre-commit.
- **oxfmt** for formatting (`--check` in CI).
- **TypeScript strict**; **Zod** schemas double as runtime validation and types.
- **Husky + lint-staged** (or `simple-git-hooks`) for pre-commit lint/format.
- **MSW** for component/integration tests against the API contract.
- Env: `NEXT_PUBLIC_API_BASE_URL`, server-only `VIDIO_API_BASE_URL` for the BFF.

## 10. Performance

- React Server Components for shells/static chrome; client components only for
  interactive/data-driven views.
- Route-level code splitting; `next/image` for posters with sized art.
- Prefetch detail on poster hover/focus; skeletons for perceived speed.
- Avoid caching stream responses; cache catalogs/meta client-side per backend TTLs.

## 11. Testing strategy

- **Unit**: utilities, source-selection logic, sync reducer (Vitest).
- **Component**: screens with MSW-mocked API (Testing Library).
- **E2E** (Playwright): register → login → install add-on (mock) → browse home →
  open detail → resolve sources → record progress → see Continue Watching →
  add/remove library.
- Accessibility checks via `axe` in component/e2e tests.

## 12. CI/CD

- CI: `pnpm install --frozen-lockfile`, `oxlint`, `oxfmt --check`, `tsc --noEmit`,
  `vitest run`, `playwright test`, `next build`.
- Docker image using Next standalone output; deployable to Vercel or self-hosted.

## 13. Milestones

1. **Foundation** — project setup, tooling (oxlint/oxfmt), design tokens, typed
   API client + Zod schemas, BFF auth + token refresh, app shell.
2. **Browse** — board, discover, search, detail, library.
3. **Playback** — sources UI, Vidstack player, subtitles, progress, resume,
   continue-watching.
4. **Add-ons & preferences** — install/manage/reorder, preferences.
5. **Sync & offline** — sync consumer, optimistic updates, offline queue.
6. **Hardening** — a11y pass, performance budget, e2e coverage, Docker/deploy.

Detailed component APIs and visual design will be specified at the start of each
milestone against the stable backend OpenAPI contract.
