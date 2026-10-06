# FULL REPORT — couple-web Engineering Audit & Remediation Program

> **Repository:** `couple-web` (Next.js 16.3.8 / React 19 / Prisma 7 / Neon Postgres / Upstash Redis / Pusher / Cloudinary / Resend-nodemailer SMTP)
> **Period:** 2026-10-04 → 2026-10-06
> **Mode history:** forensic plan → build/fix rounds → plan audits → remediation → active verification → lint burndown
> **Status line:** `tsc` clean · `eslint` 0 errors (32 warnings) · **180/180 tests pass (28 files)** · `next build` clean (61 routes) · `npm audit --omit=dev`: 11 vulns (0 critical)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Methodology & Session Map](#2-methodology--session-map)
3. [Baseline Verification Matrix](#3-baseline-verification-matrix)
4. [Round-by-Round Findings & Remediation](#4-round-by-round-findings--remediation)
5. [Cross-Cutting Inventories](#5-cross-cutting-inventories)
6. [Current Test & Quality Posture](#6-current-test--quality-posture)
7. [Remaining Work & Recommendations](#7-remaining-work--recommendations)
8. [Production Readiness Reassessment](#8-production-readiness-reassessment)
9. [Appendix A — Verification Command Log](#appendix-a--verification-command-log)
10. [Appendix B — Dependency Decisions](#appendix-b--dependency-decisions)
11. [Appendix C — Glossary of Recurring Patterns](#appendix-c--glossary-of-recurring-patterns)

---

## 1. Executive Summary

Over ~15 audit/fix cycles the codebase went from **unaudited with unknown risk** to **measured, hardened, and green across every runnable gate**:

| Dimension | Before | After |
|---|---|---|
| Typecheck | clean (narrow) | clean |
| Lint | **broken config (script errored)** → 76 problems after wiring | **0 errors**, 32 advisory warnings |
| Tests | ~166 passing, fragmented entry, false-confidence cases | **180 passing**, unified `npm test`, real-code assertions |
| Build | Next 16.3.5, passing | Next **16.3.8**, 61 routes incl. new `/api/health` |
| Audit | 17 vulns (1 critical Next.js RCE) | 11 vulns (**0 critical**) |
| AuthZ | cross-couple reads on photos/albums/milestones/wishes | scoped by `coupleId`, tested |
| Uploads | allowlist gaps, N+1 album checks, unclassified video | allowlisted, batched, `isVideoUrl`-routed |
| Data integrity | quota TOCTOU, non-atomic link replace, split-brain couples | advisory-locked register, transactional replace |
| Docs | stale PRD/README claims, missing secret names | corrected tables, deploy runbook, env examples |
| A11y/UX | no dialog semantics, unassociated labels, silent errors | `role=dialog` + focus trap, `htmlFor`, `role=alert`, ID voice |

**Deliberately NOT done** (documented with reasons in §7): mass version upgrades beyond the security-driven pins, Prettier whole-repo rewrite (291 files), `tsconfig` strictness escalation, E2E journeys requiring browsers/seeded DB, observability stack, staging environments, product decisions (OAuth linking, public-by-design endpoints, pagination UI).

---

## 2. Methodology & Session Map

| # | Session | Mode | Output |
|---|---|---|---|
| 1 | Forensic codebase audit | Plan (read-only) | Stack map, architecture map, risk areas A–L |
| 2 | Functional correctness audit | Plan | F-findings with file:line evidence, bug inventories |
| 3 | Fix round 1 (functional) | Build | Root-cause fixes, verification runs |
| 4 | Security audit (OWASP) | Plan | SEC-findings with CWE, attack scenarios |
| 5 | Fix round 2 (security) | Build | Scoping, sanitization, hardening |
| 6 | Perf/scalability/reliability audit | Plan | P-findings with bottlenecks |
| 7 | Fix round 3 (perf) | Build | Query rewrites, atomicity, cache freshness |
| 8 | Architecture & maintainability audit | Plan | Scores 7.0/6.5, debt/dead-code maps |
| 9 | Fix round 4 (structure) | Build | Dead-code deletion, unification, doc fixes |
| 10 | QA & testing audit | Plan | T-findings (5 tests that pass while broken), gap matrix |
| 11 | Fix round 5 (tests) | Build | Real-code assertions, harness wiring |
| 12 | CI/CD & release audit | Plan | C-findings, ideal gate proposal |
| 13 | Fix round 6 (CI/CD) | Build | Workflow rewrite, health endpoint, migration folding |
| 14 | Dependency & config audit | Plan | Per-dep classification, lockfile/config audit |
| 15 | Fix round 7 (deps/config) | Build | Dep moves, eslint config, analyzer wiring |
| 16 | Frontend/UX/a11y audit | Plan | F-01–F-15 findings |
| 17 | Fix round 8 (frontend) | Build | Dialog, labels, alerts, buttons, targets, focus |
| 18 | Cross-layer contract audit | Plan | Contract matrix, 19 mismatches |
| 19 | Fix round 9 (contracts) | Build | Payload nulls (CRITICAL), type narrowing, dead DTOs |
| 20 | Active verification | Execute-only | Full suite results, no source changes |
| 21 | Master register consolidation | Plan | Deduplicated MR-01–MR-50 + roadmap |
| 22 | Remediation mode (register) | Build | Versions, throttles, advisory locks, renames |
| 23 | Pasted-lint-error fix | Build | 4 render-timing conversions |
| 24 | Lint burndown (this report's trigger) | Build | **41 errors → 0** |
| 25 | FULL_REPORT.md | Docs | This file |

**Working rules enforced throughout:** smallest safe diff; root cause over symptom; no unrelated refactoring; preserve working behavior; verify (tsc + eslint + vitest + build) before marking done; evidence (`file:line`) for every claim; failed verifications reported, never hidden (e.g. the `tsconfigPaths` removal that broke 27 suites was reverted on the spot).

---

## 3. Baseline Verification Matrix

Final measured state (2026-10-06, all commands in Appendix A):

| Check | Command | Result | Exit |
|---|---|---|---|
| Install tree | `npm ls --depth=0` | 57 top-level pkgs, no peer/extraneous errors | 0 |
| Typecheck | `npm run typecheck` | clean | 0 |
| Lint | `npm run lint` | **0 errors**, 32 warnings | 1→0 errors (warnings don't fail; script exits 0) |
| Unit + integration | `npm test` | **28 files / 180 tests pass** | 0 |
| Production build | `npm run build` | compiles, typechecks, 61 routes, CSP in sync | 0 |
| Coverage | `npm run test:coverage` | Stmts **42.2%**, Branch 39.7%, Funcs 31.4%, Lines 44.4% | 0 (no thresholds) |
| Deps audit (prod) | `npm audit --omit=dev` | 11 vulns (1 low / 1 moderate / 9 high), **0 critical** | 1 (vulns present) |
| Prisma | `npx prisma validate` | valid | 0 |
| Prettier | `npx prettier --check .` | 291 files unformatted (pre-existing, never enforced) | 1 |
| E2E list | `npx playwright test --list` | 85 specs listed | 0 |
| E2E run | — | **blocked**: no browsers, no seed creds/DB in this env | n/a (env) |
| Live smoke | prod `npm start` + `GET /api/health` | **200 `{"status":"ok","checks":{"database":"ok","cache":"ok"}}`** | 0 |

---

## 4. Round-by-Round Findings & Remediation

### 4.1 Forensic audit → mental model (no code change)
Mapped: App Router groups `(public)/(private)/(auth)`, ~40 API routes behind `withRateLimit`/`auth()`, Prisma-Neon (`max:5`), Upstash Redis (cache + rate limit, fail-open by design), Pusher `private-couple-*`, Cloudinary direct + proxied uploads, SMTP via misnamed `lib/resend.ts`, Vercel-only deploy (no Dockerfile), single `test.yml` workflow. Flagged the patterns every later round confirmed: triplicated fetch clients, dead `withCouple`, nullable legacy `coupleId`, doc drift.

### 4.2 Functional audit → fix round 1
**Fixed (verified):** wishes/milestones/photo-album cross-couple reads now couple-scoped; letter double-open made atomic (`updateMany` claim + 409); location history share-gated; heart emoji capped; `unlockAt` cross-field validation; `page/limit/type/year` clamping; `useMilestone` double-wrap; `api.*` mutations now throw (no more false-success toasts); anon-score ranking documented; `doneAt` clearing; time-capsule validation gaps; `useWishes` double-`res.json`; credentials open-redirect closed; `proxy.ts` fail-open for public paths; invite fail-closed + constant-time compare; `ensureCouple` 2-member cap; password 72-char bcrypt ceiling; album ownership on POST/PUT/bulk; `error.tsx` Indonesian match; `api.upload` null guard; leaderboard key prefix; realtime re-subscription.
**Tests:** real-behavior assertions added (409 race, opt-out gating, album scoping, SQL predicates).

### 4.3 Security audit (OWASP) → fix round 2
**Fixed:** milestone `photoUploads` allowlist; server-side HTML sanitizer (`lib/sanitize-html.ts`, zero-dep) enforced on letter POST; Leaflet popup escaping + avatar-host allowlist; `google_only` cookie → `httpOnly`; session cache TTL 1800s → 300s; `pusher/auth` rate-limited (60/hr); cron constant-time compare; all email links via `safeAppUrl`; `.gitignore` hardened (`.env.test`, playwright artifacts); proxy matcher extended to static assets; CSP +`object-src 'none'`/`upgrade-insecure-requests` synced to `vercel.json`; SW stops persisting non-allowlisted `/api/*` and drops `/api/couple` from public cache.
**Accepted risks (documented):** `allowDangerousEmailAccountLinking` (product call), public-by-design notes/couple endpoints, single static `INVITE_TOKEN` in URL, Redis fail-open (by design, now error-logged).

### 4.4 Performance audit → fix round 3
**Fixed:** dashboard stats rewritten to indexed `coupleId` predicates + parallel Cloudinary/count/unread fetch; `globalThis` client reuse in prod (Prisma + Redis); new migration `20261004000002` with `(Milestone.coupleId,date)` + `(WishItem.coupleId,isDone,createdAt)`; bulk-upload album check collapsed N→1 (`findMany`); repeated `getUserCoupleId` calls deduped (photos PUT 3→1, wishes, milestone re-read); milestone link-replace + location upsert folded into transactions; cron mail fan-out bounded (concurrency 5); `home:*` invalidated on all content writes; gallery O(n²) `indexOf` → memoized id map; abort signals on hot queries; timer/rAF leaks closed (HeroSection, FloatingHearts, CountdownTimer); version polling deduplicated to one shared poller; SW skips `version.json`; `storage/usage` + API header scoping fixed.
**Deferred with reasons:** `?random=` full-bank load (later bounded in round 9 as MR-12), map rebuild churn, polling cadences (need RUM), GET throttles (done in round 9), `CoupleConfig` singleton ceiling (by design).

### 4.5 Architecture audit (scores 7.0 arch / 6.5 maintainability) → fix round 4
**Fixed:** deleted dead `withCouple` + `api-body` JSON helpers (+ their dedicated tests), `PaginatedResponse`, `mapUserTo*`; shared `normalizeEmail`; `safeTokenEqual` stragglers unified; single `buildPhotoPayload` (later hardened in round 9); `formatBytes` canonical re-export; `radix-ui` uninstalled (62 packages pruned, lockfile synced with zero drift); README falsehoods corrected (`standalone`, `AUTH_SECRET`); `proxy.ts` guards extracted to pure `lib/route-guards.ts` (testable without Next runtime).
**Kept intentionally:** `cloudinary.ts` vs `cloudinary-urls.ts` (server/client boundary), chunked-upload god-module, raw-SQL photo query, `ensureCouple` nesting, `api-fetch` (tested 401-transport role).

### 4.6 QA audit → fix round 5 (test-the-tests)
**Fixed false-confidence tests:** validations tautology → real assertion; heart-cap inline slice → real route test (then route-level); proxy-guard local copy → imports real module; shape tautology removed; gallery pagination test now advances pages and asserts cursor-2.
**Harness fixed:** `storageState` wired into all Playwright projects; CI serves prod build (no more `webServer: undefined`); `auth.setup` fails loudly on CI; Playwright artifacts gitignored; `npm test` unified to `vitest run tests/unit tests/integration` (was unit-only + 2 ad-hoc `node --import tsx` twins — both deleted as duplicated coverage); coverage `include` widened to `lib + app/api + hooks`.
**Added coverage:** user/couple schema matrix, photos cache-hit (no-DB-serve), letters 429 + 500-shape, bulk single-lookup, milestone `$transaction`, stats-SQL predicate assertions.
**Still open:** E2E journeys (no browsers/seed locally), real-DB testing decision, coverage thresholds, 13/16 hook files untested.

### 4.7 CI/CD audit → fix round 6
**Fixed:** workflow rewritten — `concurrency` + `permissions: contents: read` + per-job timeouts; new `static` job (`typecheck` + non-gating audit); jobs use `npm run` scripts; e2e gets full runtime env (`DATABASE_URL` mapped from test secret, `TEST_AUTH_SECRET`, service vars); fork-PR skip for secrets-bound e2e; shared prod server for smoke + specs; Playwright artifact upload; `GET /api/health` endpoint (DB + Redis checks, covered by 2 tests, smoke-verified live 200); manual SQL folded into idempotent migration `20261004000003`; `db:migrate:deploy` script; README deploy runbook (migrate-before-promote, `maxDuration` Hobby cap, smoke command, forward-only-rollback caveat); `engines >=20`, `packageManager` pin.
**Requires human action:** create `TEST_AUTH_SECRET`/`TEST_USER_*` secrets + seed test user; apply migrations per environment.

### 4.8 Dependency/config audit → fix round 7
**Fixed:** `@types/leaflet` + `dotenv` → devDeps (lockfile hand-synced, `npm ls` verifies, zero version drift); `eslint.config.mjs` created (flat, `core-web-vitals`) — `npm run lint` works; `@next/bundle-analyzer` wired (`ANALYZE=true` functional); `security:audit` → `--omit=dev` + `sync:csp` script added; `.prettierignore` created; generated `public/version.json` untracked; SETUP/`.env.test.example` env drift corrected.
**Frozen by instruction (documented):** Prisma 7.8↔7.10 drift (fixed later in round 9), adapter-v7 peer gap, `@types/nodemailer@8`, zod entry mix, TS strictness flags, `lib/env.ts` rewire.

### 4.9 Frontend/UX/a11y audit → fix round 8
**Fixed (F-01–F-15 except verified-no-issue):** dialog `role` + focus trap + return-focus; label association across 5 forms + editor `ariaLabel` + `aria-pressed` toggles; `role="alert"` on 14 error states; 17 EN→ID aria-labels; scoped `refetch()` retries replacing full-page reloads; `role=button` divs converted or given names/expanded state; touch targets to ≥40px; SlidingPuzzle state-bearing alts; letter submit disable-until-valid; Lightbox dialog semantics + focus in/out. **Refuted (no change):** games multi-`h1` (exclusive branches), hero 100vw overflow (layout already clips), WishCard alt, pessimistic mutations (correct by design).
**Tests:** new `dialog-a11y.test.tsx` (also caught missing RTL cleanup — fixed with explicit `cleanup`).

### 4.10 Contract audit → fix round 9 (this week)
**Fixed CRITICAL:** `buildPhotoPayload` emitted explicit `null`s that `createPhotoSchema` (`.optional()` without `.nullable()`) rejects — every album-less upload would 400. Proven by executing the real helper against the real schema (`safeParse → false`), fixed by omit-unset semantics, re-proven `true`, plus regression tests.
**Fixed MEDIUM:** lying letter types → `LetterListItem`/`LockedLetter`/`LetterDetail` with cast-based narrowing (Prisma index signatures defeat `in`-narrowing — documented inline); dead DTOs deleted (`ApiResponse`, `CursorPaginatedResponse`, `UploadResult`, 3 query-param types).
**Left intact deliberately:** `{message}` vs `{data}` deletes (consumers status-only), unread `{error,code}`, crop/publicId shape variants, silent `playerName` drop, pagination caps, PUT-replace semantics, dormant year filter, ghost user, Date-over-JSON.

### 4.11 Active verification (no source changes)
Full suite executed and reported without suppression: install/tree clean, typecheck clean, 180/180 tests, build clean (61 routes), coverage 42.2/39.7/31.4/44.4, audit 11 vulns (0 critical), prisma valid, E2E listed (run blocked on env), prettier 291 unformatted (pre-existing).

### 4.12 Master register → remediation mode (MR-01–MR-50)
**Fixed:** Next.js 16.3.5→16.3.8 (RCE gone from audit) + `eslint-config-next`/`bundle-analyzer` aligned; Prisma client/adapter-neon 7.8.0→7.10.0 + client regenerated; test-only strictness from new types (`?.` per file convention); `upload/bulk` dead `albumId` read removed; `generatePublicId` unified (repaired an accidental catch-block deletion mid-edit, verified by tsc); thumbnail builder unified into `cloudinary-urls.ts`; `takenAt` stamped at save; CSP drift warn→build-failing throw; dummy bcrypt (real cost-10 hash) on auth misses; anon throttles on leaderboards + photo list + 429 test; fail-open log upgraded to actionable error; register quota serialized via `pg_advisory_xact_lock` + MR-09 test; `?random=` bounded prefetch + fill + count with regression test; delete envelopes standardized to `{data:{id}}`; `lib/resend.ts` → `lib/email.ts` via `git mv` (10 importers updated).
**Verified after:** tsc clean, 179→180 tests pass, eslint clean on touched files, build clean on 16.3.8.

### 4.13 Lint burndown: 41 errors → 0 (this session)
Converted post-paint sync sets to render-time adjustments (`AddMilestoneForm`, `MilestoneCard`, `WishCard`, `WishForm`, `PhotoCard`, `UploadItem`, `DistanceCard`, `GallerySlideshow`, `MemoryMatch` — which also deleted a dead never-rendering skeleton branch and deduped the placeholder pool builder); `useSyncExternalStore` mount guards via new shared `hooks/useMounted.ts` (`QuoteOfTheDay`, `Navbar`); `useMemo`/`useState`-initializer derivations (`LoveMeter`, `useCountdown`, `SlidingPuzzle` best-times); effect-scoped ref syncs (`GallerySlideshow`, `useRealtimeSync`); declaration reordering (`MemoryBlockBlast`); deterministic decorative values (confetti pieces, suggestion picker — the latter also fixing a per-render flicker bug); submit-effect one-shot guards via refs (`MemoryBlockBlast`, `SlidingPuzzle` with staged queue); 3 justified disables (stable icon alias, 2× mount-once PWA sync); entities escaped ×3. One self-inflicted file corruption repaired mid-session (sign-route catch block, `MemoryMatch` shuffle signature) with verification after each.

---

## 5. Cross-Cutting Inventories

### 5.1 Test gap matrix (current)
| Feature | Unit | Integration | E2E | Security | Edge | Risk |
|---|---|---|---|---|---|---|
| Auth register/quota | schema | matrix + tx test | invite-negative only | timing mitigated, oracle untested | race serialized | MEDIUM |
| Letters | schema+sanitize | POST/GET/DELETE/open incl. 409/423/429/500 | shell only | recipient-IDOR mocked | double-open mocked | MEDIUM |
| Photos/gallery | classifiers+payload | status+shape+SQL asserts | conditional upload | album-ownership mocked | cursor-tamper untested | MEDIUM |
| Uploads (4 paths) | magic/policy | status-heavy | — | SVG path mocked | 100MB/30-file untested | MEDIUM-HIGH |
| Location | geo math | status+share-gate | shell only | opt-out mocked | deny-permission untested | MEDIUM |
| Games | schema | status-heavy | names only | anon-score untested | tie-order untested | MEDIUM |
| Dashboard/cron | — | shape+retry | heading only | — | Cloudinary-fail untested | MEDIUM |
| Hooks (16 files) | 3 covered | — | — | — | abort/filter untested | MEDIUM |
| Realtime/pusher | server init | never asserted | — | channel mocked | reconnect untested | MEDIUM |

### 5.2 Contract matrix (residual)
All live mismatches fixed (§4.10). Residual: `{message}`→standardized this round (done); unread `{error,code}`; `cropRectSchema` ×3; `playerName` silent drop; pagination caps w/o UI; PUT-replace semantics; dormant year filter (now fed by `takenAt`); ghost activity user; Date-over-JSON (formatters accept both).

### 5.3 Dead-code ledger (removed vs kept)
Removed: `withCouple`, `api-body` JSON helpers, `PaginatedResponse` + 5 DTOs, `mapUserTo*`, `validateImageDimensions`, `radix-ui` (62 pkgs), ad-hoc test twins, `upload/bulk albumId` read, MemoryMatch dead skeleton branch. Kept deliberately: `api-fetch` (tested 401 transport), `generatePublicId` filename variant (removed — unified), legacy query-param shims, null-`coupleId` leniency, `note` activity variant.

---

## 6. Current Test & Quality Posture

- **180/180 across 28 files** (unit 15 + integration 11 + miscs). Real-code assertions: SQL predicates, `$transaction` usage, cache-hit-no-DB, 429/500 shapes, atomic-race 409, opt-out gating, schema round-trips, dialog semantics, payload classification.
- **Coverage:** 42.2% stmts / 39.7% branch / 31.4% funcs. Strong: health 93%, open-letter 90%, sanitize 92%, history 85%. Weak: hooks ~8%, notes route 16%, `[...nextauth]` 0%, chunked-upload/cloudinary/prisma/pusher-client 0%.
- **False-confidence tests eliminated:** T-01–T-05 (tautology, inline-slice, local-copy guard, vacuous invariant, no-pagination test).
- **Harness:** unified `npm test`, wired `storageState`, fail-loud CI setup, artifact uploads, coverage include `lib + app/api + hooks`, no thresholds yet.

---

## 7. Remaining Work & Recommendations

### P1 — security & integrity (needs action)
1. **Mailer advisories** (`nodemailer`, no upstream fix): add envelope validation now (zod-email on `to`, strip CRLF from subject at `lib/email.ts` call sites) as defense-in-depth; track upstream; plan migration (e.g. provider API instead of SMTP).
2. **Adapter/Prisma peer gap**: monitor `@auth/prisma-adapter` v7 support; align remaining drift (`@types/nodemailer@8`, `prisma` CLI 7.10 already aligned).
3. **Couple split-brain**: add DB-level guard (partial unique index or serialized formation via advisory lock, mirroring the register fix).
4. **Sign-path byte trust**: bind `allowed_formats` or HEAD-verify `publicId` before DB insert (verify latency impact first).
5. **Account-linking merge**: product decision (default-deny vs current auto-link).
6. **Throttling**: per-account lockout/backoff on auth; extend anon budgets to remaining expensive GETs; wire fail-open error string to alerting.

### P1 — verification & release
7. **E2E**: create `TEST_AUTH_SECRET`/`TEST_USER_*` secrets + seed test user; add journeys E-01–E-05 (register→CRUD→delete, upload growth, letter open flow, deny-permission, quota-full).
8. **Lint gate**: burn the remaining pre-existing debt only if desired — repo is at 0 errors now; add `npm run lint` to CI `static` job.
9. **Observability**: metrics/tracing/error-tracker (Sentry-class), alert on fail-open string + cron 500s, uptime monitor on `/api/health`.

### P2 — correctness & performance follow-ups
10. Wire pagination UI or document caps; decide dormant `?year=` UI; document PUT-replace semantics in milestone UI (confirm on photo removal).
11. `lib/env.ts` zod boot gate (fail-closed prod, warn dev) — replaces scattered `|| ""` + `!` assertions.
12. `tsconfig` strictness (`noUncheckedIndexedAccess`, `noUnusedLocals`) as a flagged cleanup round.
13. Map rebuild churn (`setLatLng` updates), poll cadence tuning (needs RUM), `random-bank` done — verify under load.
14. Cron poison-row attempt cap + DLQ log; photo-delete compensation/reconcile; letter `Idempotency-Key`.
15. Unify `cropRectSchema`, `generatePublicId` follow-ups done — remaining: `buildTransform` copy, `getVideoPosterUrl` Lightbox dup.

### P3 — hygiene (batch when tree is quiet)
16. Prettier `--write` whole repo (291 files) + add `format:check` to CI.
17. `resend` naming done; remaining: `{error,code}` standard, `usePartner` relocation, `query-keys` factory completion, `ARCHITECTURE.md` + access matrix + shim register, PRD marked historical.
18. Staging/preview envs, `CHANGELOG.md`/tags, `migrate resolve` runbook, `db:reset` guard, WebKit matrix decision, browser/`.next` CI caching.
19. Version hygiene: `zod` entry standardization, `framer-motion`/`tiptap` code-split audit, lodash-via-cloudinary depth check.

### Manual / infra actions (cannot be done in code)
- [ ] Create GitHub Secrets: `TEST_AUTH_SECRET`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`; seed test DB user
- [ ] Run `prisma migrate deploy` per environment (incl. `20261004000002`, `20261004000003`)
- [ ] Confirm Vercel plan covers `maxDuration: 300` (else uploads/cron truncate at 60s)
- [ ] Delete `manual_add_photo_ispublic.sql` once the folded migration is applied everywhere
- [ ] Rotate any secret ever pasted into build logs; verify `.env` never committed

---

## 8. Production Readiness Reassessment

| Dimension (weight) | Score | Rationale |
|---|---|---|
| Security (20) | 15 | AuthZ/timing/compare/throttle/upload/sanitize/mailer-input pending; linking + mailer-CVE decisions open |
| Functionality (15) | 13 | Payload-400 + types + clamps + refines fixed; silent caps documented |
| Testing (15) | 10 | 180 honest tests; E2E theater + thresholds + hooks gap remain |
| CI/CD (15) | 11 | Rewritten pipeline, health+smoke, migrate path; secrets + lint-gate + staging open |
| Reliability (10) | 8 | Timeouts/retries/isolation/health; poison-cap + breakers open |
| Performance (10) | 8 | Hot paths fixed; map/poll tuning needs RUM |
| Maintainability (10) | 8 | Dead code/dupes/docs done; prettier + strictness + env-layer open |
| Scalability (5) | 4 | Stateless, pooled, bounded; single-region documented |

**Total: 77/100 → GO WITH CONDITIONS** (conditions = P1 items 1–9 above; no live P0; no hidden CRITICAL/HIGH).

---

## Appendix A — Verification Command Log

| Command | Result | Exit |
|---|---|---|
| `npm ls --depth=0` | 57 packages, clean tree | 0 |
| `npm run typecheck` | clean | 0 |
| `npm run lint` | **0 errors**, 32 warnings | 0 |
| `npm test` | **28 files / 180 tests pass** | 0 |
| `npm run build` (Next 16.3.8) | 61 routes, CSP in sync | 0 |
| `npm run test:coverage` | 42.2 / 39.7 / 31.4 / 44.4 % | 0 |
| `npm audit --omit=dev` | 11 vulns (1/1/9/0), was (1/1/8/1) | 1 |
| `npx prisma validate` | valid | 0 |
| `npx prettier --check .` | 291 unformatted (pre-existing) | 1 |
| `npx playwright test --list` | 85 specs | 0 |
| Live `GET /api/health` | 200 ok/ok | 0 |
| `npx tsx` schema-vs-payload proof | `false` before fix → `true` after | 0 |

Self-inflicted incidents repaired with verification: `tsconfigPaths` removal broke 27 suites (reverted); sign-route catch deletion (restored, tsc-verified); `MemoryMatch` shuffle-signature clobber (restored); `[id]`-path deletions needing `-LiteralPath`; silent `Remove-Item` failure on bracket paths (re-done + `git status` verified).

## Appendix B — Dependency Decisions

| Package | Decision | Why |
|---|---|---|
| `next` 16.3.5→16.3.8 | Upgraded (+eslint/analyzer aligned) | Critical RCE; patch-line, build+tests green |
| `@prisma/{client,adapter-neon}` 7.8.0→7.10.0 | Upgraded + client regenerated | Align with CLI/engines; adapter peer still upstream |
| `radix-ui` | Removed (62 pkgs) | Zero source imports |
| `@types/leaflet`, `dotenv` | → devDependencies | Placement only, zero drift |
| `nodemailer` | Kept, harden inputs | No upstream fix; mitigate at envelope layer |
| `next-auth` beta, `zod` v4, `vitest` 5 | Kept | Verified compatible; upgrades are separate rounds |

## Appendix C — Glossary of Recurring Patterns

- **Render-time adjustment**: `if (x !== prevX) { setPrevX(x); setDerived(...); }` — the endorsed replacement for post-paint sync sets (used 12×).
- **`useSyncExternalStore` mount/client reads**: for SSR-unsafe values (`useMounted`, quote/task snapshots) — preserves hydration.
- **Effect-written refs**: allowed (never during render) — one-shot submit guards, navigator mirrors.
- **Justified disables (5)**: stable icon alias, 2× PWA mount sync, 2× pre-existing — each documents why the code is correct.
- **Fail-open with error log**: availability-first paths (Redis, Pusher) log actionable strings for alerting.
- **Advisory-lock serialization**: `pg_advisory_xact_lock` for check-then-act races the schema can't constrain.
