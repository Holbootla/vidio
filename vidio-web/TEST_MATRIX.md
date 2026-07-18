# Test matrix

Maps user-facing features and critical mutations to automated tests. Run unit tests with `pnpm test`, e2e with `pnpm test:e2e`, accessibility scans in `e2e/accessibility.spec.ts`.

| Feature / flow                        | Unit / component (Vitest)                                       | E2E (Playwright)                                    |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| **Auth — login form errors**          | `features/auth/LoginForm.test.tsx`                              | `e2e/auth.spec.ts`                                  |
| **Auth — register form**              | `features/auth/RegisterForm.test.tsx`                           | `e2e/auth.spec.ts`                                  |
| **BFF login/register/refresh/logout** | `app/api/auth/auth-routes.test.ts`                              | via auth flows                                      |
| **Auth client 401 refresh**           | `lib/api/client.auth.test.ts`                                   | —                                                   |
| **Auth server API**                   | `lib/auth/server-api.test.ts`                                   | —                                                   |
| **Cookie helpers**                    | `lib/auth/cookies.test.ts`                                      | —                                                   |
| **Problem JSON errors**               | `lib/api/errors.test.ts`                                        | —                                                   |
| **Board home rows + warnings**        | `features/discovery/board-view.test.tsx`                        | `e2e/browse-playback.spec.ts`                       |
| **Continue watching enrichment**      | `features/playback/continue-watching.test.ts`                   | `e2e/browse-playback.spec.ts`                       |
| **Discover row picker**               | `features/discovery/discover-view.test.tsx`                     | —                                                   |
| **Search (empty blocked + results)**  | `features/discovery/search-view.test.tsx`                       | `e2e/accessibility.spec.ts`                         |
| **Global `/` search shortcut**        | `lib/hooks/use-global-shortcuts.test.ts`                        | `e2e/offline-shortcuts.spec.ts`                     |
| **Grid arrow navigation**             | `lib/hooks/use-grid-arrow-navigation.test.tsx`                  | —                                                   |
| **Detail episode picker**             | `features/detail/episode-picker.test.tsx`                       | —                                                   |
| **Detail library add**                | `features/detail/detail-view.test.tsx`                          | `e2e/browse-playback.spec.ts`                       |
| **Library list + optimistic remove**  | `features/library/library-view.test.tsx`                        | `e2e/library.spec.ts`                               |
| **Media keys**                        | `lib/media/keys.test.ts`, `lib/media/parse-keys.test.ts`        | —                                                   |
| **Sources list disable rules**        | `features/playback/sources-list.test.tsx`                       | `e2e/browse-playback.spec.ts`                       |
| **Source selection matrix**           | `lib/player/source-selection.test.ts`                           | —                                                   |
| **Progress reporter throttle**        | `lib/player/progress-reporter.test.ts`                          | —                                                   |
| **Resume helpers**                    | `lib/player/resume.test.ts`                                     | —                                                   |
| **Subtitle ordering**                 | `lib/player/subtitles.test.ts`                                  | —                                                   |
| **Watch href helpers**                | `lib/player/watch-href.test.ts`                                 | —                                                   |
| **Playback hooks**                    | `features/playback/hooks.test.tsx`                              | —                                                   |
| **Add-ons install/manage**            | `features/addons/addons-view.test.tsx`, `hooks.test.tsx`        | `e2e/settings.spec.ts`                              |
| **Preferences PUT**                   | `features/settings/preferences-view.test.tsx`, `hooks.test.tsx` | `e2e/settings.spec.ts`                              |
| **Settings navigation**               | `features/settings/settings-nav.test.tsx`                       | `e2e/settings.spec.ts`                              |
| **Account email + logout only**       | `features/settings/account-view.test.tsx`                       | `e2e/settings.spec.ts`                              |
| **Sync apply reducer**                | `lib/sync/applyChange.test.ts`                                  | —                                                   |
| **Sync pull pagination**              | `lib/sync/pull.test.ts`                                         | —                                                   |
| **Offline queue flush**               | `lib/sync/flush.test.ts`, `offlineQueue.test.ts`                | —                                                   |
| **Offline mutations UI**              | `lib/sync/offlineMutations.test.tsx`                            | —                                                   |
| **Sync provider status + error**      | `features/sync/SyncProvider.test.tsx`                           | `e2e/offline-shortcuts.spec.ts`                     |
| **WCAG axe primary pages**            | —                                                               | `e2e/accessibility.spec.ts`                         |
| **Performance budgets**               | —                                                               | `scripts/check-performance.mjs` (`pnpm perf:check`) |

## Current counts

- **Vitest files:** 43
- **Vitest tests:** 135
- **E2E spec files:** 6
- **E2E test cases:** 15 (including 8 axe page scans)
