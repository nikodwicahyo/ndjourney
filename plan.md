# Plan: Partner Live Location — "Where's My Love" 💕

**Status:** Ready to build · **Last updated:** 2026-07-17
**Stack:** Next.js 16 (App Router) · React 19 · Prisma + Neon · Pusher · TanStack Query · Zustand · Tailwind v4 · Framer Motion · shadcn/ui · lucide-react

---

## 0. Decisions (confirmed with user)

| Decision | Choice |
|----------|--------|
| Location capture | **Live GPS** via `navigator.geolocation.watchPosition`, pushed live through Pusher |
| Privacy | **Opt-in per partner** — toggle in settings; location only updates when both enable sharing. Off by default |
| Map display | **Leaflet + OpenStreetMap** (free, no API key) |
| "Meet" threshold | **100m** default (configurable constant) |
| Where it shows | **Public pages** (home, gallery, timeline, etc.) **and** a dedicated dashboard page — but **only for the logged-in partner** (anonymous visitors see nothing) |
| Extras | Floating hearts, nearby date suggestions, last-seen, plus more (see §7) |
| UI/UX | Modern, romantic, consistent with existing `BottleLetter` / `HeroSection` patterns (Framer Motion, `Card`/`Badge`/`Button`, Indonesian copy, heart confetti) |

---

## 1. Goals & Success Metrics

- Each partner can opt-in to live-share their GPS location, tagged with device type (mobile / tablet / desktop).
- The other partner sees both pins on a Leaflet/OSM map, live distance, and device badges.
- When within 100m → romantic **"Meet 💕"** state with animation + confetti.
- Feature is visible on public pages **only to the authenticated partner** (couple-scoped, never to guests).
- Realtime updates via Pusher; graceful polling fallback.

---

## 2. Data Model (`prisma/schema.prisma`)

Add two models (kept separate from `User` so login stays lean and location can be cleared independently):

```prisma
model LocationShare {
  id        String   @id @default(cuid())
  userId    String   @unique
  coupleId  String
  isSharing Boolean  @default(false)
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  couple    Couple   @relation(fields: [coupleId], references: [id], onDelete: Cascade)
  @@index([coupleId])
}

model UserLocation {
  id         String    @id @default(cuid())
  userId     String    @unique
  coupleId   String
  latitude   Float
  longitude  Float
  accuracy   Float?
  deviceType String    // "mobile" | "tablet" | "desktop"
  updatedAt  DateTime  @updatedAt
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  couple     Couple    @relation(fields: [coupleId], references: [id], onDelete: Cascade)
  @@index([coupleId])
}
```

- `UserLocation` = last known live position (upserted frequently, 1 row per user).
- `LocationShare.isSharing` = opt-in flag, checked server-side before accepting updates / broadcasting.
- Migration: `npm run db:migrate -- --name add_location` → then `npm run db:generate` (client output is `lib/generated/prisma`).

---

## 3. Backend API (`app/api/location/`)

Follow the exact conventions of `app/api/partner/route.ts` (auth guard + `getUserCoupleId` + `NextResponse`).

### `app/api/location/route.ts`
- **GET** — returns, for the caller's couple:
  - `self`: `{ userId, deviceType, isSharing }`
  - `partner`: `{ userId, name, image, deviceType, location: { lat, lng, accuracy, updatedAt } | null, isSharing }`
  - `meetThresholdMeters`: 100
  - 401 if not authed; 404 if no partner.
- **POST** — body validated by `lib/validations/location.ts`. Server checks `LocationShare.isSharing === true` for caller; if off → 403. Upsert `UserLocation` (coupleId-scoped). Trigger Pusher `LOCATION` scope. Rate-limited.
- Add to `rateLimitConfigs` in `lib/rate-limit.ts`:
  ```ts
  location: { maxRequests: 600, windowSeconds: 3600, keyPrefix: "location" },
  ```

### `app/api/location/share/route.ts`
- **PUT** — toggle `LocationShare.isSharing` for self (upsert with `isSharing`). Trigger Pusher `LOCATION` so partner's UI updates the "waiting…" state instantly.

### Pusher wiring
- Add `"LOCATION"` to `SyncScope` in `types/index.ts`.
- `lib/pusher-server.ts` `triggerCoupleEvent(coupleId, "LOCATION")` already works (uses `private-couple-${coupleId}`).
- `hooks/useRealtimeSync.ts`: add a `case "LOCATION"` that invalidates `queryKeys.location.all` (live map + distance refresh without polling).
- Keep a 15s polling fallback in `usePartnerLocation` for when Pusher is disconnected.

### `lib/validations/location.ts`
```ts
import { z } from "zod";

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(100000).optional(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]),
});
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const updateShareSchema = z.object({ isSharing: z.boolean() });
export type UpdateShareInput = z.infer<typeof updateShareSchema>;
```
Used via `updateLocationSchema.safeParse(await req.json())` exactly like `lib/validations/note.ts` is used in `app/api/notes/route.ts`.

---

## 4. Client Utilities

### `lib/device.ts`
```ts
export type DeviceType = "mobile" | "tablet" | "desktop";
export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const tablets = /iPad|Tablet|PlayBook|Silk|Kindle|Galaxy Tab/i.test(ua);
  const mobile = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (tablets) return "tablet";
  if (mobile || (navigator.maxTouchPoints ?? 0) > 1 && /Macintosh/.test(ua)) return "mobile";
  return "desktop";
}
```
Pure, testable, reused by the location hook.

### `lib/geo.ts`
```ts
export const MEET_THRESHOLD_METERS = 100;

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number { /* standard haversine */ }

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
```

### `lib/query-keys.ts`
Add:
```ts
location: { all: ["location"] as const },
```

---

## 5. Client Hooks — `hooks/useLocation.ts` (`"use client"`)

Mirrors `useNotes` / `usePhotos` patterns (TanStack Query + mutation + `useSession`):

- `useLocationSettings()` — `useQuery` GET `/api/location` → self/partner share state + device.
- `usePartnerLocation()` — derived from above; polling refetch every 15s as fallback (Pusher invalidates on `LOCATION`).
- `useToggleShare()` — `useMutation` PUT `/api/location/share` → optimistic update + `queryClient.invalidateQueries(location.all)` + toast.
- `useShareLocation()` — starts `navigator.geolocation.watchPosition`; on change (throttled ~10s), POSTs via mutation; auto-stops on toggle-off / unmount / tab hidden. Returns `{ status: "idle"|"locating"|"sharing"|"denied"|"unsupported" }`.

UX details:
- If geolocation unsupported or permission denied → `toast` + `Badge` "Lokasi tidak tersedia".
- Throttle: only POST if moved > 5m or > 10s elapsed (saves writes + rate limit).

---

## 6. UI Components

### New `components/location/`
1. **`LocationToggle.tsx`** — opt-in switch (`useToggleShare`). States: off / sharing / waiting-for-partner / denied. Uses `Button` + `Badge` + `MapPin` icon.
2. **`PartnerMap.tsx`** — Leaflet map, **dynamic import `ssr:false`** (Leaflet touches `window`). Both heart-pins (self vs partner), a connecting line, live distance label, OSM tiles (no key). Recenters softly on update.
3. **`DeviceBadge.tsx`** — `Smartphone` / `Tablet` / `Monitor` lucide icon + label per user.
4. **`DistanceCard.tsx`** — `Card` showing partner distance, device badges, accuracy, last-seen. Framer Motion number/position transitions.
5. **`MeetBanner.tsx`** — when `haversine <= 100m`: animated **"Meet 💕"** banner (Framer Motion `initial/animate`, heart confetti like `BottleLetter` `modalConfetti`), gentle pulse.
6. **`LocationWidget.tsx`** — **compact public-page variant**. A small `Card`/pill showing partner distance + device badge + "Meet" indicator. **Conditionally rendered**: returns `null` when `!session?.user` (anonymous) or partner not sharing. This is what goes on public pages.
7. **`FloatingHeart.tsx`** — tap-to-send a heart to partner (Pusher `LOCATION`/custom event; rendered as floating animation on recipient's map/widget).
8. **`NearbySuggestion.tsx`** — when "Meet", shows a random date idea pulled from `WishItem`/spin-wheel data (reuses existing game/seed patterns).

### Placement
- **Public pages** (logged-in only): mount `<LocationWidget />` in `app/(public)/page.tsx` (e.g. below hero / in `HomeContent`) and optionally a floating mini-pill via `Navbar`/`BottomNav` (session-gated). It self-hides for guests.
- **Private**: `app/(private)/dashboard/location/page.tsx` (server wrapper + `<Suspense>` + `PageTransition`) → `components/dashboard/LocationManager.tsx` (`"use client"`) with full map + toggle + `DistanceCard` + `MeetBanner` + extras. Follow `NotesManager` structure.

### Nav entries (session-aware, like existing `privateLinks`)
- `Sidebar.tsx` `sidebarLinks`: `{ href: "/dashboard/location", label: "Location", icon: MapPin }`.
- `BottomNav.tsx` `navItems`: add `{ href: "/dashboard/location", label: "Location", icon: MapPin, auth: true }`.
- `Navbar.tsx` `privateLinks`: add `{ href: "/dashboard/location", label: "Location", icon: MapPin }`.
- Public `LocationWidget` needs **no** nav entry — it appears automatically for logged-in users.

---

## 7. Extras & Modern UI/UX Recommendations

**Fun extras (romantic, couple-scoped):**
1. **Floating Hearts** — tap to send a heart; recipient sees it float up on their widget/map (Pusher event). Reuse `BottleLetter` confetti/hearts style.
2. **Nearby Date Suggestion** — when "Meet", surface a random `WishItem`/spin-wheel idea ("Nyoba kulineran yuk 🍜").
3. **Last-Seen** — when partner not sharing, show "Terakhir terlihat …" timestamp (from `UserLocation.updatedAt`).
4. **"On the way" pulse** — when distance is decreasing over time, show a subtle directional indicator / "menuju kamu…" hint. (Optional, v1.1.)
5. **Share-my-location quick action** — one-tap enable from the navbar pill when off.

**Modern UI/UX (consistent with existing codebase):**
- Use `motion.div` with `initial={{opacity:0,y:20}}` + `animate` + `useInView` scroll reveals (see `BottleLetter`, `HeroSection`).
- `AnimatePresence` for the "Meet" banner enter/exit and widget mount/unmount.
- Heart-confetti burst on entering "Meet" state (mirror `BottleLetter` `modalConfetti` emojis ❤️✨💫🌟💖⭐).
- Soft gradient cards (`rounded-2xl border border-border bg-card`), `primary` rose palette (`#F43F5E`), blur/glow like hero blobs.
- `Skeleton` loading states (shadcn) while fetching location; `toast` (sonner) for enable/errors.
- Accessibility: `aria-label` on toggle/buttons; `prefers-reduced-motion` respected (Framer Motion `useReducedMotion`).
- Dark mode: Leaflet tiles + overlays use `next-themes` aware classes; map container gets `dark:` tint.
- Responsive: widget is a compact card on mobile (bottom-sheet friendly), full map on desktop/tablet.

---

## 8. Privacy & Security

- Public `LocationWidget` only fetches via `GET /api/location` (coupleId-scoped); anonymous → 401, nothing rendered.
- `POST /api/location` rejected (403) unless `LocationShare.isSharing === true` for that user.
- All reads scoped by `coupleId` from `getUserCoupleId` (same guard as `partner` route) — the two partners only ever see each other.
- No historical location stored beyond the single last point (`UserLocation` is upserted, not appended). Optional cleanup cron out of scope for v1.
- Geolocation permission is explicit (browser prompt); never coerced. Off by default.

---

## 9. Files — Create / Modify

**New**
- `prisma` migration (add `LocationShare`, `UserLocation`)
- `lib/validations/location.ts`
- `lib/device.ts`
- `lib/geo.ts`
- `hooks/useLocation.ts`
- `components/location/LocationToggle.tsx`
- `components/location/PartnerMap.tsx`
- `components/location/DeviceBadge.tsx`
- `components/location/DistanceCard.tsx`
- `components/location/MeetBanner.tsx`
- `components/location/LocationWidget.tsx`
- `components/location/FloatingHeart.tsx`
- `components/location/NearbySuggestion.tsx`
- `app/(private)/dashboard/location/page.tsx`
- `components/dashboard/LocationManager.tsx`

**Modify**
- `prisma/schema.prisma` — add 2 models
- `types/index.ts` — add `"LOCATION"` to `SyncScope`
- `lib/pusher-server.ts` — already supports scope (no change needed, documented)
- `hooks/useRealtimeSync.ts` — add `LOCATION` case
- `lib/query-keys.ts` — add `location`
- `lib/rate-limit.ts` — add `location` config
- `components/layout/Sidebar.tsx` — `sidebarLinks` entry
- `components/layout/BottomNav.tsx` — `navItems` entry (`auth:true`)
- `components/layout/Navbar.tsx` — `privateLinks` entry
- `app/(public)/page.tsx` + `components/home/HomeContent.tsx` — mount `LocationWidget` (session-gated)
- `package.json` — add `leaflet` + `@types/leaflet` (`npm install leaflet @types/leaflet`)

---

## 10. Verification

1. `npm run db:migrate` then `npm run db:generate`.
2. `npm run lint` and `npx tsc --noEmit` (typecheck).
3. Manual:
   - Logged-out: no widget, `GET /api/location` → 401, no location in public HTML.
   - Logged-in A enables sharing → B's widget shows "menunggu…" until B enables.
   - Both on: live pins + distance update; move within 100m → "Meet 💕" banner + confetti.
   - Toggle off → updates stop, `Last-Seen` appears.
   - Mobile/tablet/desktop each show correct `DeviceBadge`.

---

## 11. Out of Scope (v1)
- Historical location trail / timeline of movements.
- Geofence alerts beyond the single "Meet" threshold.
- Push notifications (Web Push) for "partner is nearby" (PWA already scaffolded; can add later).
- Reverse-geocoding to addresses (would need a free geocoder; optional v1.1).

---

## 12. Implementation Status — ✅ Built

All layers implemented, type-checked (`tsc --noEmit` clean) and `next build` compiles successfully.

**New files**
- `prisma/migrations/20260717000000_add_location/migration.sql`
- `lib/validations/location.ts`, `lib/device.ts`, `lib/geo.ts`
- `hooks/useLocation.ts` (settings, distance, isMeeting, toggleShare, sendHeart, floatingHearts, shareLocation/GPS watch)
- `app/api/location/route.ts` (GET/POST), `app/api/location/share/route.ts` (PUT), `app/api/location/heart/route.ts` (POST)
- `components/location/*` — `DeviceBadge`, `MeetBanner`, `FloatingHeart`, `NearbySuggestion`, `LocationToggle`, `PartnerMap` (Leaflet+OSM), `DistanceCard`, `LocationWidget`
- `components/dashboard/LocationManager.tsx`, `app/(private)/dashboard/location/page.tsx`

**Modified**
- `prisma/schema.prisma` (+2 models + back-relations on `User`/`Couple`)
- `types/index.ts` (`LOCATION` scope), `lib/query-keys.ts`, `lib/rate-limit.ts`, `hooks/useRealtimeSync.ts`
- `components/layout/Sidebar.tsx`, `BottomNav.tsx`, `Navbar.tsx` (Location nav entries)
- `components/home/HomeContent.tsx` (mounts session-gated `LocationWidget` on public home)

**Run to deploy DB**: `npm run db:migrate` (applies the migration SQL) then the client is already generated.

**Verification done**: TypeScript clean · Production build succeeds · `/dashboard/location` route registered · location API routes registered. Manual browser testing (GPS permission + two-device "Meet") still recommended before prod.
