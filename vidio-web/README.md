# Vidio Web

Browser client for [Vidio](https://github.com/Holbootla/vidio) — browse, library, add-ons, and playback against the Rust `/v1` API.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS v4, TanStack Query, Zustand, Zod, Vidstack, IndexedDB sync.

## Setup

```bash
pnpm install
cp .env.example .env.local
# set NEXT_PUBLIC_API_BASE_URL and VIDIO_API_BASE_URL to your Vidio API
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Purpose                         |
| ------------------- | ------------------------------- |
| `pnpm dev`          | Turbopack development server    |
| `pnpm build`        | Production build (standalone)   |
| `pnpm start`        | Start Next server               |
| `pnpm lint`         | Oxlint                          |
| `pnpm format:check` | Oxfmt check                     |
| `pnpm typecheck`    | `tsc --noEmit`                  |
| `pnpm test`         | Vitest unit/component tests     |
| `pnpm test:e2e`     | Playwright e2e (mocked API)     |
| `pnpm perf:check`   | Route bundle budgets            |

## Docs

- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — milestone plan against the backend contract
- [`TEST_MATRIX.md`](./TEST_MATRIX.md) — feature → test mapping
- [`PERFORMANCE.md`](./PERFORMANCE.md) — bundle budgets
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Docker and environment

## Auth model

Refresh tokens stay in an httpOnly BFF cookie (`/api/auth/*`). Access tokens live in memory only and are attached to direct browser → API calls.
