# Public Page Offline Fallback Design

## Intent
Offline navigation to the six non-home public pages must show the same `/offline.html` screen that login/dashboard already show. The home page `/` keeps its cached shell. Today `public/sw.js` caches all seven public routes, so offline visitors see stale page shells instead of the offline screen.

## Goals
- Cacheable page set in the service worker contains only `/`.
- Existing installs purge stale page shells through a `CACHE_NAME` bump; `activate` already removes old caches.
- E2E proves the offline screen on `/gallery`, `/timeline`, `/games`, `/notes`, `/letters`, `/wishlist`, private routes (`/dashboard`, `/dashboard/gallery`, `/location`), and a cached home shell on `/`.
- E2E seeds an `ndjourney-v14` cache and proves activation removes it.
- No API response is persisted by the worker; the personalized `/api/games/questions` stale-while-revalidate cache is removed.

## Non-goals
- No client-side navigation guard (Approach B), no new dependencies, no change to private-route caching or durable client stores. API responses are network-only.
- No change to sign-out's deliberate cache wipe.

## Constraints
- Private/authenticated HTML and JSON must never be cached (`sw.js` SEC comments).
- `/` is `force-static`; caching its shell is safe.
- `/offline.html` and `/sw.js` remain excluded from the auth middleware.
- Approach chosen by the human partner: service-worker policy fix only (A).

## Decisions
- `PUBLIC_PAGE_PATHS` becomes a cacheable-only set with `/` as its single member; rename to `CACHEABLE_PAGE_PATHS` so the name matches the rule.
- `CACHE_NAME` moves from `ndjourney-v14` to `ndjourney-v15` so stale shells are deleted on activate.
- `PUBLIC_API_PATHS`, `API_CACHE_NAME` and `staleWhileRevalidate()` are deleted; the activate keep-list keeps only page and image caches so an existing `ndjourney-api-v15` cache is purged.
- The test asserts the offline page's own heading, not generic h1/img selectors: offline copy for non-home routes, home hero for `/`, and no app error boundary anywhere.
- The worker is registered directly in tests (same `/sw.js` script) because app registration is idle-deferred and dev-server compilation can starve it; `clients.claim()` controls the open page without a reload.
- Firefox is skipped in this spec: Playwright's Firefox offline emulation does not fail service-worker fetches, so it would exercise the browser HTTP cache instead of the SW fallback. Chromium and mobile cover the navigation path.
