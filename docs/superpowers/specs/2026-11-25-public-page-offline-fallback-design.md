# Public Page Offline Fallback Design

## Intent
Offline navigation to the six non-home public pages must show the same `/offline.html` screen that login/dashboard already show. The home page `/` keeps its cached shell. Today `public/sw.js` caches all seven public routes, so offline visitors see stale page shells instead of the offline screen.

## Goals
- Cacheable page set in the service worker contains only `/`.
- Existing installs purge stale page shells through a `CACHE_NAME` bump; `activate` already removes old caches.
- E2E proves the offline screen on `/gallery`, `/timeline`, `/games`, `/notes`, `/letters`, `/wishlist`, and a cached home shell on `/`.

## Non-goals
- No client-side navigation guard (Approach B), no new dependencies, no change to private-route caching or offline data persistence.
- No change to sign-out's deliberate cache wipe.

## Constraints
- Private/authenticated HTML and JSON must never be cached (`sw.js` SEC comments).
- `/` is `force-static`; caching its shell is safe.
- `/offline.html` and `/sw.js` remain excluded from the auth middleware.
- Approach chosen by the human partner: service-worker policy fix only (A).

## Decisions
- `PUBLIC_PAGE_PATHS` becomes a cacheable-only set with `/` as its single member; rename to `CACHEABLE_PAGE_PATHS` so the name matches the rule.
- `CACHE_NAME` moves from `ndjourney-v14` to `ndjourney-v15` so stale shells are deleted on activate.
- The test asserts outcome text, not cache internals: offline page copy for the six routes, home shell for `/`, and no app error boundary anywhere.
