# Performance budgets

Measured after `pnpm build` via `pnpm perf:check` (`scripts/check-performance.mjs`).

## Route first-load JavaScript (uncompressed)

| Route                     | Budget    | Rationale                                      |
| ------------------------- | --------- | ---------------------------------------------- |
| `/board`                  | ≤ 1100 KB | Browse shell; must not include Vidstack player |
| `/watch/[type]/[videoId]` | ≤ 1300 KB | Watch route may load player chunks dynamically |

Current baselines (Jul 2026): `/board` ~968 KB, `/watch` ~961 KB + watch-only chunks.

## Code splitting

- `VidstackPlayer` and `YouTubeWatchPlayer` are `next/dynamic` with `ssr: false` in `features/playback/watch-view.tsx`.
- `perf:check` asserts board-only chunks do **not** contain `vidstack`.
- Stream queries use `staleTime: 0` and `gcTime: 0` (`features/playback/hooks.ts`).

## TanStack Query cache

| Query             | staleTime        | Notes                           |
| ----------------- | ---------------- | ------------------------------- |
| home              | 60s              | Board rows                      |
| search            | 30s              | Aggregated search               |
| continue watching | 30s              | Resume strip                    |
| meta              | 5–15m (prefetch) | Detail prefetch on poster focus |
| library           | 30s              | Optimistic mutations            |
| streams           | 0                | Never cached                    |
| subtitles         | 60s              | Short-lived                     |

## Images

`PosterImage` uses responsive `sizes`:

`(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 20vw, 180px`

Posters in cards use decorative images with accessible link labels.

## Runtime targets (manual / e2e)

| Metric                       | Target                        |
| ---------------------------- | ----------------------------- |
| Board interactive (mock API) | < 3s cold, < 1.5s warm        |
| Detail meta (cache hit)      | < 500ms client navigation     |
| Stream fetch                 | Always network; no HTTP cache |

## Waivers

None. Revisit budgets when adding analytics or a service worker.
