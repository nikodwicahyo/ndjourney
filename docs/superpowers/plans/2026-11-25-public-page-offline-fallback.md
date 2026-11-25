# Public Page Offline Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline navigation to all non-home public pages shows `/offline.html`; `/` still serves its cached shell.

**Architecture:** The service worker already routes uncached page navigations through `networkFirst`, whose offline branch returns the precached `/offline.html`. Remove the six public pages from the cacheable-page set and bump the page-cache version so existing installs drop their stale shells. E2E asserts the resulting behaviour.

**Tech Stack:** Next.js 16, plain service worker JS, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-public-page-offline-fallback-design.md`

## Global Constraints
- No new dependencies.
- Never cache private/authenticated HTML or JSON.
- `CACHE_NAME` must become `ndjourney-v15`.
- `/offline.html` stays in `PRECACHE_URLS`.
- Only stage files owned by this plan; the working tree has unrelated user edits.

## Review Focus
- Offline hard navigation to each of the six non-home public routes must show the offline screen, not a stale shell.
- Offline `/` must keep the cached home shell and must not show the offline screen.
- A previously installed `ndjourney-v14` cache must be deleted on activate, not left serving stale pages.
- `/location` and `/dashboard/*` must keep their existing offline fallback behaviour.
- No app error boundary or `ada yang salah` text may appear in any offline case.

---

### Task 1: Service-worker offline fallback for non-home public pages

**Files:**
- Modify: `public/sw.js:1-3`, `public/sw.js:27-43`, `public/sw.js:197-218`
- Test: `tests/e2e/pwa-offline.spec.ts`

**Interfaces:** none shared.

- [ ] **Step 1: Write the failing E2E test**

Replace the single-route assertion in `tests/e2e/pwa-offline.spec.ts` with an assertion loop over `/gallery`, `/timeline`, `/games`, `/notes`, `/letters`, `/wishlist`: after `context.setOffline(true)` and `page.reload()`, expect `Kamu sedang offline` and zero occurrences of `ada yang salah`. Keep the manifest, SW-controller wait, and existing timeout helpers. Add a home case: visit `/` online, wait for the SW controller, go offline, reload, expect the home shell and no offline text.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx playwright test tests/e2e/pwa-offline.spec.ts --project=chromium`
Expected: FAIL on the first non-home public route — cached page content is present and `Kamu sedang offline` is absent.

- [ ] **Step 3: Implement the service-worker policy**

In `public/sw.js`: rename `PUBLIC_PAGE_PATHS` to `CACHEABLE_PAGE_PATHS` and leave only `/` in it; update the SEC comment that claims all public pages are persisted; bump `CACHE_NAME` from `ndjourney-v14` to `ndjourney-v15`. Leave `PRECACHE_URLS`, API caching, image caching, and private-route handling untouched.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx playwright test tests/e2e/pwa-offline.spec.ts --project=chromium`
Expected: PASS — all six routes show the offline screen offline, `/` shows the cached shell.

- [ ] **Step 5: Run static checks**

Run: `npm run typecheck` and `npm run lint`
Expected: both PASS.

- [ ] **Step 6: Commit only this plan's files**

Stage `public/sw.js`, `tests/e2e/pwa-offline.spec.ts`, and the two design/plan docs. Do not stage unrelated dirty files.
