# Push Notification & Unified Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every app action writes one `ActivityEvent`; the partner (never the actor) gets it live in an in-app bell and, for `level: "both"` events, as a native Web Push on all devices; the dashboard feed reads the same table.

**Architecture:** One `emitActivity()` helper replaces the 28 existing `triggerCoupleEvent()` call sites (23 route files; the live location ping route is explicitly NOT swapped). It writes the event, triggers the existing Pusher `sync-mutate` (payload gains an `activity` object), bumps the dashboard-feed cache, and fans out `web-push` sends to the partner's devices (fail-open). Bell + feed read the table; `CoupleMember.lastSeenActivityAt` is the read state.

**Tech Stack:** Prisma 7 (Neon), Next.js 16 App Router route handlers, Pusher (existing), `web-push` npm (new), Vitest + Playwright (existing).

**Spec:** `docs/superpowers/specs/2026-11-03-push-notifications-design.md` (read it first; it has the event→level table and resolved user decisions).

## Global Constraints

- All user-facing notification strings (title/body) in **Indonesian**.
- The actor must never see own events in the bell (bell list + `unreadCount` filter `actorId != me`); own events DO appear in the dashboard feed.
- Fail-open: any Pusher/web-push/cache failure inside `emitActivity` is caught + `console.error`-logged; the hosting content mutation must still succeed.
- `href` values are site-relative only: must start with `/`, not `//`, else stored/read as `null`. Enforced inside `emitActivity` (single choke point) and validated again in the SW `notificationclick`.
- coupleId/actor/user identity always from the authenticated session, never from request bodies.
- Live location pings (`app/api/location/route.ts` position-update trigger) are **not** swapped — no ActivityEvent rows for heartbeats. Heart taps (`app/api/location/heart`) stay ephemeral (unchanged). Only the share-**on** toggle notifies ("partner online").
- Do not break the existing `triggerCoupleEvent` contract: `lib/pusher-server.ts` stays as-is; `emitActivity` calls it.
- Scope: only Vercel-synced env keys `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client) and `VAPID_PRIVATE_KEY` (server). Push behaves as a no-op when they are missing (same pattern as `lib/pusher-server.ts` env guard).
- After finishing, ensure `npm run test:unit` stays green before each commit (project convention).

## Review Focus

Failure modes the spec implies that no single unit test fully pins; each gets its owning test below:

1. **Cross-couple leak** — a crafted request (e.g. subscribing with another couple's context or arbitrary coupleId in a body) must never surface another couple's events. Test: integration route tests assert couple-scoping is session-derived (Task 3/4).
2. **Self-event leak to bell** — uploading a photo must not raise own unreadCount or show in own bell. Test: unit/integration on notifications list filter (Task 3).
3. **Fail-open** — web-push throwing must not fail the API POST that mutated content. Test: vi.mock web-push to throw, assert emitActivity resolves (Task 2).
4. **Stale subscription cleanup** — HTTP 404/410 from sendNotification deletes that subscription row only. Test: mock 410 response, assert deleteMany called for that row (Task 2).
5. **Unknown crash added before feed returns it** — `RecentActivity.tsx` `typeConfig[item.type]` crashes on unknown types; task 7 adds every new type before the feed ever returns them. Test: unit render test of the component with a wish/game event (Task 7).

---

### Task 1: Prisma schema — ActivityEvent, PushSubscription, read-state

**Files:**
- Modify: `prisma/schema.prisma` (add models; extend existing `CoupleMember`)

**Interfaces:**
- Produces: Prisma models `ActivityEvent` (fields: `id cuid()`, `coupleId`, `actorId`, `type String`, `action String`, `title String`, `body String?`, `href String?`, `level String`, `meta Json?`, `createdAt @default(now())`, index `@@index([coupleId, createdAt])`), `PushSubscription` (`id`, `userId`, `endpoint String @unique`, `p256dh`, `auth`, `userAgent String?`, `createdAt`, `@@index([userId])`), and `lastSeenActivityAt DateTime?` on `CoupleMember`. Full Prisma relations/back-relations as required by `prisma migrate` (relation on `Couple`, `User` for both new models).

- [ ] **Step 1: Add the models to `prisma/schema.prisma`** with relations (`ActivityEvent.couple → Couple`, `ActivityEvent.actor → User`; `PushSubscription.user → User`; back-relations on those models; `lastSeenActivityAt DateTime?` added to `CoupleMember`).
- [ ] **Step 2: Run migration + generate.** Run: `npm run db:migrate -- --name activity_push_subscriptions` then `npm run db:generate`. Expected: migration created and applied, generated client includes `prisma.activityEvent` and `prisma.pushSubscription`.
- [ ] **Step 3: Typecheck.** Run: `npm run typecheck`. Expected: pass.
- [ ] **Step 4: Commit** `feat(db): activity events, push subscriptions, member read-state`.

### Task 2: `lib/activity.ts` — `emitActivity()`

**Files:**
- Create: `lib/activity.ts`
- Create: `tests/unit/activity-emit.test.ts`
- Modify: `package.json` (add `web-push@^3` to dependencies)

**Interfaces:**
- Consumes: `triggerCoupleEvent(coupleId, scope)` from `lib/pusher-server.ts`; `SyncScope` from `@/types`; Prisma client from `lib/generated/prisma`; `web-push`; the cache key helper used by `app/api/dashboard/activity/route.ts` (read that route for the exact `cacheKey`/redis import).
- Produces (Tasks 6 onwards call this; Task 5 relies on the payload shape):

```ts
export type ActivityLevel = "both" | "bell";
export type EmitActivityInput = {
  type: string;          // "photo" | "video" folded into "photo" | "letter" | "milestone" | "note" | "wish" | "game" | "arcade" | "profile" | "location" | "questions"
  action: string;        // "created" | "updated" | "scored"
  title: string;         // complete Indonesian string, e.g. "Foto baru"
  body?: string | null;  // complete Indonesian string, includes actor name
  href?: string | null;  // site-relative deep link; sanitized
  level: ActivityLevel;
  meta?: Prisma.InputJsonObject; // e.g. { thumbnailUrl, video?, count }
};
export async function emitActivity(coupleId: string, actorId: string, input: EmitActivityInput): Promise<void>;
```

Behavior, in order, all inside one outer try/catch that swallows + logs (fail-open):
1. Sanitize `href`: keep only strings starting with `/` and not `//`; else `null`.
2. `prisma.activityEvent.create` with the full input (always written, even when the actor is a partner-only case).
3. Map type → existing `SyncScope` via a `const ACTIVITY_SCOPE: Record<string, SyncScope>` (`photo→GALLERY`, `letter→LETTERS`, `milestone→TIMELINE`, `note→DAILY_NOTES`, `wish→WISHLIST`, `game`/`arcade→GAMES_LEADERBOARD`, `profile→PROFILE`, `location→LOCATION`, `questions→GAMES_QUESTIONS`; default `DASHBOARD`) and call `triggerCoupleEvent(coupleId, scope)` with the payload extended to `{ scope, action: "REFRESH", activity: { id, type, action, title, body, href, createdAt } }`. Extend `SyncPayload` in `types/index.ts` with the optional `activity` field here or in Task 5 (one edit either way; pick one place).
4. `redis.del(cacheKey("dashboard", "activity", coupleId))` — same helper the dashboard route uses (kills the ≤120 s staleness on live updates).
5. When `level === "both"`: look up couple members **excluding `actorId`**, their `PushSubscription` rows; for each, `webpush.sendNotification(sub.endpoint, JSON.stringify({ title, body, url: href }), { vapidDetails: { subject: mailto-from-env (reuse an existing contact email env or `mailto:app@couple-web`), publicKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } })`. On WebPushError with statusCode 404/410 (or plain 410 result), delete that one subscription row. Missing VAPID env vars → skip the whole push step with one `console.warn` (mirrors the Pusher env guard).

- [ ] **Step 1: Write failing test** `tests/unit/activity-emit.test.ts` (mock `lib/pusher-server.ts`, Prisma client, `lib/redis.ts`, `web-push` with `vi.mock`; follow the mocking style of `tests/unit/pusher-server.test.ts`). Asserts:
  - resolves (does not throw) when `web-push.sendNotification` rejects — fail-open (Review Focus 3);
  - call with `href: "https://evil.com/x"` and `href: "//evil.com"` stores `href: null` in the created `ActivityEvent`;
  - `level: "bell"` performs no `sendNotification` calls; `level: "both"` sends to partner subscriptions only, none belonging to `actorId` (Review Focus 2's underlying guarantee);
  - a `410`/`404` `WebPushError` triggers a delete of exactly that subscription (Review Focus 4);
  - Pusher trigger receives the mapped scope and the `activity` payload field.
- [ ] **Step 2: Run** `npm run test:unit -- activity-emit`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `lib/activity.ts`** per the signature and behavior above.
- [ ] **Step 4: Run** `npm run test:unit -- activity-emit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(activity): emitActivity core (persist, pusher, cache bump, web-push fan-out)`.

### Task 3: Notifications API — list + seen

**Files:**
- Create: `app/api/notifications/route.ts` (GET)
- Create: `app/api/notifications/seen/route.ts` (POST)
- Create: `tests/integration/notifications-api.test.ts`
- Modify: `types/index.ts` — add `NotificationItem` type:

```ts
export type NotificationItem = {
  id: string;
  type: string;
  action: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string; // ISO
  actor: { id: string; name: string | null; image: string | null };
  unread: boolean;   // createdAt > caller's lastSeenActivityAt
};
```

**Interfaces:**
- Consumes: session auth used by every `app/api/**` route (copy the guard pattern from `app/api/dashboard/activity/route.ts`); `batchLoadUsers` from `lib/batch.ts`.
- Produces:
  - `GET /api/notifications?cursor=<id>&limit=20` → `{ items: NotificationItem[], unreadCount: number, nextCursor: string | null }`. Couple-scoped (session user → couple via `CoupleMember`), `actorId != me`, ordered `createdAt desc`, `take: limit+1` cursor pagination. `unreadCount` counts the same filtered set with `createdAt > caller.lastSeenActivityAt` — identical filter as the list, so the badge always matches the list.
  - `POST /api/notifications/seen` → `{ ok: true }`; stamps `CoupleMember.lastSeenActivityAt = new Date()` for the session user's membership.
- Consumed by: Task 8 (bell hook `queryKeys.notifications`).

- [ ] **Step 1: Write failing integration tests** in `tests/integration/notifications-api.test.ts` (follow the auth-mock pattern of existing integration tests): unauthenticated GET → 401/403; couple scoping returns only that couple's partner-authored events with `unread` flags and `unreadCount` (Review Focus 1+2); cursor returns a second page without overlap; POST seen stamps the field and a following GET reports `unreadCount: 0`.
- [ ] **Step 2: Run** `npm run test:integration -- notifications-api`. Expected: FAIL.
- [ ] **Step 3: Implement both routes** per the contracts above (no per-user rate limit needed; read-only + one-field update behind auth).
- [ ] **Step 4: Run** `npm run test:integration -- notifications-api`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): partner notification list + seen state`.

### Task 4: Push subscription endpoints + VAPID env

**Files:**
- Create: `app/api/push/subscribe/route.ts` (POST)
- Create: `app/api/push/unsubscribe/route.ts` (POST)
- Create: `tests/integration/push-api.test.ts`
- Modify: `README.md` or `.env.example` (document both env keys and `npx web-push generate-vapid-keys`; Vercel env vars are a manual/one-time step for the user)

**Interfaces:**
- Produces (consumed by Task 10 client and Task 2's helper):
  - `POST /api/push/subscribe` body `{ endpoint: string, keys: { p256dh: string, auth: string } }` → upsert keyed by the global-unique `endpoint` for the **session user**; validate `endpoint` is an `https://` URL before storage; store `userAgent` from the request header. Rate-limited with the same helper/limit as `app/api/pusher/auth/route.ts` (60/h). Response `{ ok: true }`.
  - `POST /api/push/unsubscribe` body `{ endpoint: string }` → `deleteMany({ where: { userId: session, endpoint } })` → `{ ok: true }`.
- [ ] **Step 1: Write failing integration tests** (`tests/integration/push-api.test.ts`): unauthenticated → 401/403; non-https or malformed endpoint → 400; happy upsert replaces keys for a re-subscribed (same) endpoint; unsubscribe deletes only the session user's row (Review Focus 1); rate limit trips on call 61 within the window.
- [ ] **Step 2: Run** `npm run test:integration -- push-api`. Expected: FAIL.
- [ ] **Step 3: Implement both routes.**
- [ ] **Step 4: Run** `npm run test:integration -- push-api`. Expected: PASS.
- [ ] **Step 5: Generate dev VAPID keys**: run `npx web-push generate-vapid-keys`, put the public key in `.env` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and private as `VAPID_PRIVATE_KEY` (do **not** commit values; `.env` is git-ignored).
- [ ] **Step 6: Commit** `feat(api): web-push subscription management + VAPID env`.

### Task 5: Client realtime invalidation for notifications

**Files:**
- Modify: `types/index.ts` (extend `SyncPayload` with optional `activity` — empty object type with `activity?: { id: string; type: string; title: string }`; single place)
- Modify: `hooks/useRealtimeSync.ts` — in `onSync`, **before** the switch, when `data.activity` is present: `queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: "all" })` and `queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(), refetchType: "all" })`. Also add `queryKeys.dashboard.activity()` invalidation to the `DAILY_NOTES` and `WISHLIST` cases (today they don't refresh the feed; Task 7's feed depends on it).
- Modify: `lib/query-keys.ts` — add `notifications: { all: ["notifications"] as const }` (match the existing factory style).
- Modify: `tests/unit/hooks.test.tsx` (or a sibling unit test) — assert a `sync-mutate` payload carrying `activity` invalidates the notifications query key.

**Interfaces:**
- Consumes: Task 2's payload shape (`activity`), `queryKeys` factory.
- Produces: `queryKeys.notifications.all` (used by Task 8).
- [ ] **Step 1: Write failing test**: dispatch handler from `useRealtimeSync` with a fake payload → notifications + activity keys invalidated (vi.spy on queryClient).
- [ ] **Step 2: Run** `npm run test:unit -- hooks`. Expected: FAIL.
- [ ] **Step 3: Implement the changes above.**
- [ ] **Step 4: Run** `npm run test:unit -- hooks`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(realtime): notifications + feed invalidation off sync-mutate`.

### Task 6: Route wiring sweep — swap triggerCoupleEvent → emitActivity

**Files:**
- Modify: every route file returned by `grep -rl triggerCoupleEvent app/api` **except** `app/api/location/route.ts` (position-update pings stay as-is) — at the time of writing: photos, photos/[id], photos/bulk-upload, albums, albums/[id], letters, letters/[id], letters/[id]/open, milestones, milestones/[id], notes, notes/[id], wishes, wishes/[id], games/questions, games/questions/[id], games/round, games/arcade-score, location/share, couple, user, cron/time-capsule, plus adding a new emit in `app/api/games/score/route.ts` (none today).
- Do **not** touch `app/api/location/heart/route.ts` (stays bespoke ephemeral event).

**Interfaces:**
- Consumes: `emitActivity(coupleId, actorId, input)` from Task 2 (exact signature above). Actor name for body strings comes from the session user (every route already resolves `auth()`); if unavailable, fetch once via `batchLoadUsers`.
- Produces: `ActivityEvent` rows for every content family.

**Replacement rules by route family** (title/body templates in Indonesian; `href` = the page deep link; `level` per the spec's table):

| Route family | type / action | title | body | href | level |
|---|---|---|---|---|---|
| photos (+bulk-upload, photo delete from [id] uses action `updated`? no — skip deletes) | `photo`/`created` | `Foto baru` | `{actor} menambahkan {n} foto` | `/photos?album={albumId}` | `both` |
| albums (+[id]) | `photo`/`created` or `updated` (rename → `Mengganti nama album`) | `Album baru` | `{actor} membuat album "{name}"` | `/photos?album={id}` | `both` |
| letters | `letter`/`created` | `Surat baru` | `{actor} mengirim surat` | `/letters` | `both` |
| letters/[id]/open | — **no event** (default per spec) | | | | |
| milestones (+[id]) | `milestone`/`created` or `updated` | `Milestone baru` | `{actor} menambahkan "{title}"` | `/timeline` | `both` |
| notes (+[id]) | `note`/`created` or `updated` | `Catatan harian` | `{actor} menulis catatan` | `/notes` | `both` |
| wishes (+[id]) | `wish`/`created` or `updated` | `Wishlist` | `{actor} menambahkan keinginan "{name}"` | `/wishlist` | `both` |
| games/round, games/arcade-score (existing triggers) | `game`/`scored` | `Skor baru` | `{actor} mencatat skor {score} di {game}` | `/games` | `bell` |
| games/score (new emit) | `arcade`/`scored` | same as above | same | `/games` | `bell` |
| games/questions (+[id]) | `questions`/`created`/`updated` | `Bank soal` | `{actor} memperbarui bank soal` | `/games` | `bell` |
| couple, user (profile/couple-config edits) | `profile`/`updated` | `Profil diperbarui` | `{actor} memperbarui profil` | `/settings` | `bell` |
| cron/time-capsule | `letter`/`created` (time capsule opened) | `Kapsul waktu` | `Surat kapsul waktu terbuka` | `/letters` | `both`, actorId = letter owner |
| location/share | `location`/`updated` **only when share turns ON** | `Partner online` | `{actor} mulai berbagi lokasi` | `/location` | `both` |

`meta`: pass cheap context (`{ thumbnailUrl }` for photos, `{ count }` for bulk, none elsewhere). Covers the mutation families listed in the spec's route inventory; sweep the grep list and use the table rows, choosing the closest row when a route doesn't map 1:1.

- [ ] **Step 1: Swap call sites** per table (keep each route's existing mutation + response behavior byte-identical otherwise).
- [ ] **Step 2: Verify no swapped routing left behind.** Run: `grep -rn triggerCoupleEvent app/api --include=*.ts`. Expected output: only `lib/pusher-server.ts` import line(s) + `app/api/location/route.ts` call site(s). Else finish the sweep.
- [ ] **Step 3: Run** `npm run test:unit && npm run test:integration && npm run typecheck`. Expected: PASS (no route behavior change breaks existing tests; adjust only test fixtures that asserted on `triggerCoupleEvent` calls in unit tests — replace them with `emitActivity` mocks).
- [ ] **Step 4: Smoke-test locally.** Run: `npm run dev`; mutate one note and one photo; expected: rows appear in `ActivityEvent` (via `npm run db:studio`), partner bell later (Task 8). Then commit `feat(activity): emit events across all mutation routes`.
- [ ] **Step 5: Commit.**

### Task 7: Dashboard feed from ActivityEvent + RecentActivity types/icons

**Files:**
- Modify: `app/api/dashboard/activity/route.ts` — replace the raw-SQL UNION with `prisma.activityEvent.findMany({ where: { coupleId }, orderBy: { createdAt: "desc" }, take: 10 })`; keep the same cache key/120 s Upstash read; map rows to the **existing** `RecentActivity` response shape via `batchLoadUsers` (`user = actor`, `description = body ?? title`).
- Modify: `types/index.ts` — extend `RecentActivity.type` union: `"photo" | "letter" | "milestone" | "note" | "wish" | "game" | "arcade" | "profile" | "location" | "questions"`.
- Modify: `components/dashboard/RecentActivity.tsx` `typeConfig` — add entries for every new type with existing icon style (`note` already exists) — **must land in the same commit as the union change** so a live feed including the new types can't crash on `config.icon` (Review Focus 5).
- Create/extend: a `tests/unit/recent-activity.test.tsx` render test covering a wish and a game event.

**Interfaces:**
- Consumes: Task 6's events; existing `RecentActivity` consumer `DashboardClient.tsx`.
- Produces: nothing new (same response shape; type union widened).
- [ ] **Step 1: Write failing render test** with `type: "wish"` and `type: "game"` items → component renders an icon + label (no crash).
- [ ] **Step 2: Run** `npm run test:unit -- recent-activity`. Expected: FAIL.
- [ ] **Step 3: Implement route rewrite + union + typeConfig icons.**
- [ ] **Step 4: Run** `npm run test:unit -- recent-activity` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(dashboard): feed on activity events, all types wired`.

### Task 8: Bell UI + `useNotifications`

**Files:**
- Create: `hooks/useNotifications.ts` — TanStack Query hook: `{ data: NotificationsResponse, refetch }` on `queryKeys.notifications.all` (key prefix invalidated by Task 5), Poll disabled (Pusher + Task 5 handle it; keep a 60 s `staleTime` fallback via `refetchOnWindowFocus` default).
- Create: `components/notifications/NotificationBell.tsx` — bell button in `components/layout/Navbar.tsx` (match Navbar button styling); badge with unreadCount; opens a dropdown panel on desktop, full-width sheet on mobile (reuse an existing mobile sheet/drawer pattern in `components/layout/`); list of NotificationItem rows (icon-per-type from a small local map, title, body, relative time — reuse any existing relative-time util if present, else `Intl.RelativeTimeFormat`); clicking an item → `router.push(href)` + `POST /api/notifications/seen` + optimistic local clear.
- Modify: `components/layout/Navbar.tsx` — mount the bell for authenticated users (partner icon row placement; no layout shift for guests/auth pages).
- Create: `tests/unit/notification-bell.test.tsx` — vitest render tests: badge shows/omits from unreadCount; empty state "Belum ada aktivitas"; click marks seen and navigates.

**Interfaces:**
- Consumes: Task 3 endpoints, Task 5 invalidation, `queryKeys.notifications`.
- Produces: nothing consumed downstream (leaf UI).
- [ ] **Step 1: Write failing tests** (list above).
- [ ] **Step 2: Run** `npm run test:unit -- notification-bell`. Expected: FAIL.
- [ ] **Step 3: Implement hook + component + Navbar mount.**
- [ ] **Step 4: Run** `npm run test:unit -- notification-bell`. Expected: PASS.
- [ ] **Step 5: Manual dev check (`npm run dev`)**: two browser profiles (two users, same couple); upload a photo as A; B's bell badge increments within a second or two; click works. Commit `feat(ui): partner notification bell`.

### Task 9: Service worker — push + notificationclick, cache version bump

**Files:**
- Modify: `public/sw.js` — bump `CACHE_NAME` to v13 (forces SW update for existing installs); add:

```js
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plaintext fallback ignored */ }
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/";
  event.waitUntil(self.registration.showNotification(data.title ?? "Pasangan update", {
    body: data.body ?? "",
    icon: "/icons/…(existing manifest icon path)", badge: "/icons/…(existing manifest badge path)",
    data: { url }, tag: "couple-web",
  }));
});
self.addEventListener("notificationclick", (event) => {
  const url = (event.notification.data && /^\/(?!\/)/.test(event.notification.data.url)) ? event.notification.data.url : "/";
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const hit = clientsList.find((c) => c.url.includes(self.location.origin));
    if (hit) { await hit.focus(); await hit.navigate?.(new URL(url, self.location.origin).href); }
    else await self.clients.openWindow?.(new URL(url, self.location.origin).href);
  })());
});
```

(same-origin enforcement lives in the `url` regex — never `openWindow`/`navigate` an absolute foreign URL)
- Test: no unit test — exercised by Task 11 e2e; keep a vitest-able pure helper only if the SW needs URL validation duplicated in JS (prefer single inline function, no shared module in the SW for simplicity).
- [ ] **Step 1: Add both listeners + bump `CACHE_NAME`** (exact code above; fill icon paths from `public/manifest.json`'s existing icons).
- [ ] **Step 2: Run** `npm run build`. Expected: passes (SW is not typechecked but must not break precache list).
- [ ] **Step 3: Commit** `feat(pwa): sw push handling + click-through + cache v13`.

### Task 10: Permission flow — `lib/push-client.ts`, onboarding card, settings toggle, sign-out cleanup

**Files:**
- Create: `lib/push-client.ts` — pure client helpers:

```ts
urlBase64ToUint8Array(base64: string): Uint8Array
isPushSupported(): boolean            // 'serviceWorker' in navigator && 'PushManager' in window && !iOS-needs-A2HS
subscribePush(): Promise<boolean>     // requestPermission (if default) → SW ready → pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }) → POST /api/push/subscribe → true; any error/logs → false (never throws)
unsubscribePush(): Promise<void>      // pushManager.unsubscribe() + POST /api/push/unsubscribe (best-effort, never throws)
getPushState(): "unsupported" | "default" | "granted" | "denied" | "a2hs-required"
```

- Create: `components/notifications/PushPermissionCard.tsx` — one-time card shown near the bell/dashboard for users with `getPushState() === "default"`: Indonesian copy ("Aktifkan notifikasi…"), confirm → `subscribePush()`, dismiss stores a `localStorage` flag (`push-card-dismissed-v1`); when `a2hs-required` (Safari/iOS, `navigator.standalone !== true`), the copy explains **"tambahkan ke Layar Utama (Add to Home Screen) terlebih dahulu"** before any prompt.
- Modify: `app/(private)/dashboard/settings/page.tsx` — browser-push toggle row: renders on/off from `getPushState()`, calls `subscribePush()`/`unsubscribePush()`, shows denied-state hint ("izinkan notifikasi di pengaturan browser").
- Modify: `lib/sign-out.ts` (`signOutAndClear`) — `await unsubscribePush()` best-effort before/alongside the existing cache clearing.
- Create: `tests/unit/push-client.test.ts` — `urlBase64ToUint8Array` decodes the VAPID key byte-for-byte; `getPushState` branches map to `Notification.permission`/support mocks; `subscribePush` posts to `/api/push/subscribe` with the subscription JSON.

**Interfaces:**
- Consumes: Task 4 endpoints, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` at run time (`process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`, no import-time crash when unset — feature simply renders unsupported).
- [ ] **Step 1: Write failing unit tests** (list above; mock `navigator.serviceWorker`, `Notification`, `fetch`).
- [ ] **Step 2: Run** `npm run test:unit -- push-client`. Expected: FAIL.
- [ ] **Step 3: Implement lib + card + toggle + sign-out change.**
- [ ] **Step 4: Run** `npm run test:unit -- push-client` + `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(push): permission flow, settings toggle, sign-out cleanup`.

### Task 11: e2e happy path + full verification

**Files:**
- Create: `e2e/push-notifications.spec.ts` (place per the existing `playwright.config` test dir)
- Modify: nothing else.

Scenario (single-tenant-locales, seed via existing `db:seed` fixture patterns):
- [ ] **Step 1: Write the Playwright spec**: login as user A in one context, user B in a second context; B grants `Notification.permission` via Playwright's `--use-fake-ui-for-media-feature` / permission clobber (`context.grantPermissions(["notifications"])`); A uploads a photo via the existing UI flow e2e helper (or POSTs through the app's own API with session cookies); expect B's bell badge within 5 s (Pusher realtime; skip the OS toast assertion — the SW push is covered in Tasks 2/9 logic assertions and by manual QA) and A's badge unchanged.
- [ ] **Step 2: Run** `npm run test:e2e -- push-notifications`. Expected: PASS.
- [ ] **Step 3: Full suite + build.** Run: `npm run test:unit && npm run test:integration && npm run typecheck && npm run build`. Expected: all PASS.
- [ ] **Step 4: Commit** `test(e2e): partner realtime bell happy path`.

## Manual (user) steps after merge — not automatable

1. `npx web-push generate-vapid-keys` → set both keys in Vercel env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) and locally in `.env`.
2. Ship v13 SW: once pushed, existing PWA installs pick it up on next visit.
3. Two-device manual QA: bell badge + OS notification on Android/desktop; on iPhone: Add to Home Screen → open installed app → grant permission → verify.
