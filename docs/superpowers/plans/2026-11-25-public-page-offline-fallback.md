# Public Page Offline Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline navigation to all non-home public pages shows `/offline.html`; `/` still serves its cached shell.

**Architecture:** The service worker already routes uncached page navigations through `networkFirst`, whose offline branch returns the precached `/offline.html`. Remove the six public pages from the cacheable-page set and bump the page-cache version so existing installs drop their stale shells. E2E asserts the resulting behaviour.

**Tech Stack:** Next.js 16, plain service worker JS, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-public-page-offline-fallback-design.md`

## Global Constraints
- No new dependencies.
- Never cache private/authenticated HTML or JSON; no API response is persisted by the worker.
- `CACHE_NAME` must become `ndjourney-v15`.
- `/offline.html` stays in `PRECACHE_URLS`.
- Only stage files owned by this plan; the working tree has unrelated user edits.

## Review Focus
- Offline hard navigation to each of the six non-home public routes must show the offline screen, not a stale shell.
- Offline `/` must keep the cached home shell and must not show the offline screen.
- A previously installed `ndjourney-v14` cache must be deleted on activate, not left serving stale pages.
- `/dashboard`, `/dashboard/gallery` and `/location` must keep their existing offline fallback.
- No app error boundary or `ada yang salah` text may appear in any offline case.
- An app-initiated `/api/games/questions` fetch must not create an `ndjourney-api-v15` cache entry.

---

### Task 1: Service-worker offline fallback for non-home public pages

**Files:**
- Modify: `public/sw.js`
- Test: `tests/e2e/pwa-offline.spec.ts`

**Interfaces:** none shared.

- [x] **Step 1: Write the failing E2E test**

Replace the single-route assertion in `tests/e2e/pwa-offline.spec.ts` with an assertion loop over `/gallery`, `/timeline`, `/games`, `/notes`, `/letters`, `/wishlist`: after `context.setOffline(true)` and `page.reload()`, expect the offline page's own heading and zero occurrences of `ada yang salah`. Add a home case (cached shell + hero, no offline text), a private-route loop (`/dashboard`, `/dashboard/gallery`, `/location`), and a case that seeds `ndjourney-v14` and proves activation removes it. Register `/sw.js` directly in tests; skip Firefox because its offline emulation does not fail service-worker fetches.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npx playwright test tests/e2e/pwa-offline.spec.ts --project=chromium --workers=1`
Expected: FAIL on the first non-home public route — cached page content is present and the offline heading is absent.

- [x] **Step 3: Implement the service-worker policy**

In `public/sw.js`: rename `PUBLIC_PAGE_PATHS` to `CACHEABLE_PAGE_PATHS` and leave only `/` in it; update the SEC comment that claims all public pages are persisted; bump `CACHE_NAME` from `ndjourney-v14` to `ndjourney-v15`. Delete `PUBLIC_API_PATHS`, `API_CACHE_NAME` and `staleWhileRevalidate()` so `/api/games/questions` is network-only, and narrow the activate keep-list to page + image caches so an old API cache is purged. Leave `PRECACHE_URLS`, image caching, and private-route handling untouched.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npx playwright test tests/e2e/pwa-offline.spec.ts --workers=1`
Expected: PASS on chromium and mobile (5 tests each), Firefox skipped, setup passing.

- [x] **Step 5: Run static checks**

Run: `npm run typecheck`, `npm run lint`, and `npm run test:unit`
Expected: all PASS.

- [x] **Step 6: Commit only this plan's files**

Stage `public/sw.js`, `tests/e2e/pwa-offline.spec.ts`, and the two design/plan docs. Do not stage unrelated dirty files (`public/offline.html` has pre-existing local edits).
