# Push Notification & Unified Activity — Design

Date: 2026-11-03
Status: Approved (approach A picked by user)

## Intent

Every action in the app (photo/video, letter, milestone, note, wishlist, games, profile) creates one activity event. The **partner** (never the actor) gets it live in an in-app bell, and — for noteworthy events — as a native OS push on all their devices, even with the browser closed. The dashboard "aktivitas terbaru" reads the same event stream, now including the types the current derived SQL-UNION feed misses (notes, wishes, games).

## Goals

- One helper, one source of truth; no duplicate logging logic.
- Free stack: existing Pusher (in-app realtime) + `web-push` npm with free VAPID keys (native push).
- Works on mobile/tablet/desktop; app is on Vercel, service worker already exists (`public/sw.js`).
- All user-facing event text in **Indonesian**.
- Fail-open: notification/push failure never blocks the content mutation.
- Secure: couple/user identity always from the authenticated session; payloads plaintext only.

## Non-goals

- Email digests, per-type notification preferences (only a global browser-push on/off), notification grouping/threading, emoji reactions push.

## Approaches considered

1. **A (chosen): ActivityEvent table + central `emitActivity()` hook** wired into the existing `triggerCoupleEvent()` call sites. One source of truth, read-state impossible without a table, push payload ready at emit time.
2. Prisma-extension auto-detect (rejected: misses raw-SQL writes, no update context, magic).
3. No table, push-only at emit time (rejected: no read state, no notification history — half the feature).

## Current state (facts from codebase)

- Next.js 16.4.2 App Router, React 19, Prisma 7 (Neon Postgres), Upstash Redis, NextAuth v5 (JWT), TanStack Query + Zustand.
- `lib/pusher-server.ts` → `triggerCoupleEvent(coupleId, scope)` fires `sync-mutate` on `private-couple-${coupleId}`; imported by 23 API route files (28 call sites). Client `RealtimeSyncClient` subscribes via `lib/pusher-client.ts` and invalidates TanStack Query caches. Modeled as: existing infra reused untouched.
- `app/api/dashboard/activity/route.ts`: auth-guarded UNION of last 5 Photo / 5 Letter / 5 Milestone rows, LIMIT 10, cached 120 s in Upstash (`cacheKey("dashboard","activity",coupleId)`), users batch-loaded via `lib/batch.ts`.
- No `Activity`/`Notification` model; no web-push; PWA SW v12 with caches only.

## Design

### Schema additions (`prisma/schema.prisma`)

```prisma
model ActivityEvent {
  id        String   @id @default(cuid())
  coupleId  String
  actorId   String   // who did it
  type      String   // photo|letter|milestone|note|wish|game|arcade|profile|location
  action    String   // created|updated|scored|...
  title     String   // Indonesian, e.g. "Foto baru"
  body      String?  // Indonesian, e.g. "Nika menambahkan \"Pantai 2026\""
  href      String?  // site-RELATIVE deep link only, validated server-side
  level     String   // "both" | "bell"
  meta      Json?    // snapshot: thumbnail URL, before/after fields, etc.
  createdAt DateTime @default(now())
  @@index([coupleId, createdAt])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
  @@index([userId])
}

model CoupleMember {
  // existing model gains:
  lastSeenActivityAt DateTime?
}
```
(Note for builder: the snippet is indicative — real Prisma relations/back-relations on `Couple`/`CoupleMember`/`User` are required for `prisma migrate` to compile; add them when writing the schema.)

### Central helper — `lib/activity.ts` → `emitActivity()`

Signature (indicative): `emitActivity(coupleId, actorId, { type, action, title, body, href, level, meta })`.

Each call, in order, all inside try/catch that **swallows and logs** errors (fail-open; a Pusher/web-push failure never fails the POST):

1. `prisma.activityEvent.create` (always written — actor's own events appear in the dashboard feed, not in the bell).
2. Existing `triggerCoupleEvent(coupleId, scope)` behavior preserved; the `sync-mutate` payload extended with the compact event so `RealtimeSyncClient` invalidation keeps working untouched → bell + feed update live.

   **Client invalidation is additional work, not free** (the current client only switches on `scope`): add a `NOTIFICATIONS` scope to `types/index.ts` + a case in `hooks/useRealtimeSync.ts` invalidating the bell query, and extend the existing `DAILY_NOTES`/`WISHLIST` invalidation cases to also invalidate `dashboard.activity` (they don't today — note/wish events would otherwise leave the feed stale up to 120 s).
3. When `level === "both"`: load couple members **excluding actor**, delete their `PushSubscription` rows → `web-push.sendNotification(endpoint, payload)`. HTTP 404/410 responses delete the dead subscription (stale-subscription cleanup). Payload: `{ title, body, url: href }` — plaintext only.
4. No post-response fire-and-forget (Vercel serverless kills background work): steps run awaited inside the route, same as today's `triggerCoupleEvent` call. DB insert + a handful of push sends is one-figure-milliseconds cost.

Deep-link rule: `href` must be a `//`-free, site-relative path starting with `/`; anything else stored as `null`. Enforced inside `emitActivity` (single choke point).

### Route wiring

- Replace existing `triggerCoupleEvent()` calls with `emitActivity()` calls. Actual inventory: **28 call sites across 23 route files** (photos, albums, letters + letters/open, milestones, notes, wishes, games/questions + questions/[id] + round + arcade-score, location/share, couple, user, cron/time-capsule…). Build the sweep list with `grep triggerCoupleEvent app/api`, not from this doc; fill payload per content type.
- **Exception — the live location ping stays a raw `triggerCoupleEvent`.** `app/api/location/route.ts` fires `triggerCoupleEvent(coupleId, "LOCATION")` on every position update (~8 s poll per tab) so the map stays live; heartbeats never create an `ActivityEvent`. **One exception:** when the previous fix is older than `LOCATION_STALE_AFTER_SECONDS` (the same 60 s the location card renders as "Offline"), the GPS has come back online and the ping calls `notifyLocationReonline` → one `location`/`updated` event (`both`, "Partner online" / "{actor} kembali online — Sharing live location"). A 5-minute cooldown (shared with the share-on event) stops a flapping GPS from spamming. The **share-on** toggle also emits (`both`); share-off emits nothing beyond the existing Pusher invalidation.
- True new emits: `app/api/location/share` (on-toggle → `both`), `app/api/location/heart` stays **ephemeral, instant-only** (bespoke `location-heart` Pusher event, unchanged — no `emitActivity`, no history), and `app/api/games/score` (per-question scores → `bell`).
- Profile/couple-config edits already trigger (`app/api/user/route.ts`, `app/api/couple/route.ts`) → swap only. Letter-opened (`letters/[id]/open`) and question-bank create/archive (`games/questions*`) have triggers but no mapping row: builder picks sensible defaults (letter-open → no event or `bell`; question-bank is admin-mode noise → `bell` at most).

### Event → level mapping

| Event | level |
|---|---|
| Photo/video, letter, milestone, note, wishlist, time-capsule cron | `both` |
| Game/arcade scores, profile/couple-config edits, question-bank admin changes | `bell` |
| Partner starts sharing location (comes online: `location/share` → on) | `both` (body: "partner online") — share-off emits nothing; heart taps stay ephemeral live-only (no event) |
| GPS comes back online while sharing is already on (`POST /api/location` after a ≥60 s gap) | `both` ("{actor} kembali online — Sharing live location"), 5-minute cooldown shared with the share-on event; normal 8–30 s pings emit nothing |

Updates count (action `updated`) and are surfaced like creates — with "what changed" text where cheap (e.g. priority/visibility/album title).

### API endpoints (all auth-gated, identity from session; rate-limited à la `/api/pusher/auth`)

- `GET /api/notifications` — couple-scoped `ActivityEvent` list (ordered `createdAt desc`), returns `unreadCount` (events newer than the caller's `lastSeenActivityAt`), cursor pagination, users resolved via existing `lib/batch.ts`.
- `POST /api/notifications/seen` — stamps `lastSeenActivityAt = now` for the caller's membership.
- `POST /api/push/subscribe` — upserts a `PushSubscription` for the logged-in user (keyed by unique `endpoint`; `p256dh`/`auth` from the body, endpoint must be a valid push-service URL).
- `POST /api/push/unsubscribe` — deletes by endpoint (caller's own).

### Dashboard feed

`GET /api/dashboard/activity` switches from the raw-SQL UNION to a plain couple-scoped `activityEvent.findMany` (LIMIT 10), same response shape (`RecentActivity[]` via the existing user-batch loader) and same 120 s Upstash cache with added cache key-bump on emit. This adds note/wish/game types to the feed for free. `RecentActivity.type` gains the new union values; `RecentActivity.tsx` icon/href config extended accordingly — **all new types must be present in `typeConfig` before the feed returns them** (unknown types crash on `config.icon`). `note` already exists in the config but was never returned; add `wish`, `game`/`arcade`, `profile`, `location`. That's the doc for the dash part: keep the same upstash cache semantics and the batch loader, no other behavior change.

### UI

- **Bell** in the existing header: reuses TanStack Query (`useNotifications`) + the existing Pusher-driven invalidation. Badge = unread count. Desktop dropdown; mobile full-width sheet consistent with existing mobile patterns. Dummy-minimal list item: icon per type, title, body, relative time; click → navigate to `href` + mark seen.
- **Permission flow:** post-login onboarding card (one-time): "Aktifkan notifikasi?" → `Notification.requestPermission()` → `pushManager.subscribe(VAPID)` → `POST /api/push/subscribe`. Skip if permission already denied/granted. **On iOS, the card explains push requires "Add to Home Screen" first (Safari ≥16.4)** and only prompts further once installed. Also a browser-push toggle in Settings. VAPID public key via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Sign-out:** `lib/sign-out.ts` additionally `pushManager.unsubscribe()` (best-effort) so no orphan device persists.
- **Service worker (`public/sw.js`):** add `push` listener → `showNotification` (title, body, icon/badge from existing manifest, `data: { url }`); `notificationclick` → focus or open `data.url`, same-origin validated. Pusher handles the live bell (SW isn't needed for in-browser lists). **Bump `CACHE_NAME` (v12 → v13)** so the new SW ships to existing installs. New dependency: `web-push` in package.json; env keys: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client), `VAPID_PRIVATE_KEY` (server, `emitActivity`).

### Security

- coupleId/actor always from the authenticated session, never from request bodies.
- Push-service endpoint must parse as `https://` push URL before storage (no SSRF surface later at send time).
- Notification payloads are plaintext strings; nothing renders HTML. SW click URL is same-origin validated.
- Rate-limit the subscribe route (subscription writes, not content reads).

### Testing

- Vitest unit: `emitActivity` — fail-open behavior (Pusher/web-push throw → mutation result unaffected), deep-link validation, self-exclusion from recipient set, 404/410 subscription cleanup.
- Vitest route tests: notifications/seen/push-subscribe auth guards + rate limit.
- e2e happy path: upload a photo → partner sees bell badge within seconds + receives browser push (permission granted).

## Open decisions (resolved with the user)

- Hearts on live location: **instant-only**, no event written (user confirmed).
- Live location pings: **never notified**; only the share-on toggle ("partner online") notifies (user confirmed).
- iOS home-screen requirement acknowledged; permission-card copy will explain it (user confirmed).
- Bell shows only partner-authored events; dashboard feed shows both partners' (user confirmed; event text in Indonesian).

## Left to the builder (your calls within the design)

- Exact Indonesian wording per event type/action.
- Exact icon per brand new type in the bell (reuse what `RecentActivity.tsx` has, add for note/wish/game).
- Whether the `lastSeenActivityAt` stamp lives on `CoupleMember` (default) or moves to `User` — builder's pick, one-line difference.
- Notification panel internals (virtualization not expected at LIMIT 50/page).

## Performance notes

- Index `(coupleId, createdAt)` covers every read.
- Push fan-out is bounded by couple size (2 members), no N+1 beyond the two batched queries.
- No new realtime connections; the existing single `private-couple-*` subscription serves everything.
