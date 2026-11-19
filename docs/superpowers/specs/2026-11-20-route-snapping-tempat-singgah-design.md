# Route Snapping Everywhere + Tempat Singgah — Design

Date: 2026-11-20
Status: Approved

## Intent

The route option (Mengikuti Jalan / Garis Lurus) today only exists inside the history
panel and only bends the history trail. Make it a first-class map setting: always
visible, ON by default, working on the **live distance line between both partners** and
the **history trail** — no clicking "Tampilkan Riwayat" required. Make **Tempat
Singgah** accurate, named with real places, and properly shown/selected on the map.
Harden the whole feature end-to-end (reliability, performance, security, best practice).

## Goals

- Route toggle always visible (when either party shares), default ON, affects both the
  distance line and the history trail.
- `DistanceCard` **ETA uses the OSRM road route** (road distance × mode speed). The
  "Jarak Antar Kita" number stays haversine.
- Tempat Singgah: accurate detection, reverse-geocoded names, proper map markers +
  click-to-focus UX.
- Reliable, resilient, performant, secure across API → lib → hooks → components.

## Non-goals / Anti-goals

- No new routing provider; no schema change (existing `[userId, createdAt]` index is enough).
- Map must never break when OSRM/Nominatim fail — always fall back to straight line /
  no address.
- No XSS via partner names or addresses anywhere on the map.

## Constraints

- OSRM public demo server (driving profile only) and Nominatim (max 1 req/s, requires a
  real `User-Agent`) are third-party. All browser traffic to them must go through our
  own API routes (validation, cache, timeout, fail-soft).
- Current CSP (`lib/csp.ts`, mirrored to `vercel.json` by `npm run sync:csp`) does not
  list `router.project-osrm.org` — today's client-side road snapping is blocked in
  production. The proxy fixes this; Nominatim leaves `connect-src` afterwards.
- Leaflet 1.9, React 19, Next 16 App Router, TanStack Query v5, Prisma, Vitest.

## Approaches considered

- **A. Client calls OSRM/Nominatim directly** (status quo): no cache control, broken
  `User-Agent` for Nominatim (browsers strip it), third-party endpoints exposed,
  hammered on every 15s poll, OSRM blocked by CSP. ❌
- **B. Thin server proxies + client lib** ✅ chosen.
- **C. Don't snap the live distance line**: doesn't meet the request. ❌

## How (chosen)

1. `app/api/route/route.ts` — `GET ?from=lat,lng&to=lat,lng` → validated coords,
   in-memory LRU cache (4-dp rounded), OSRM driving, 4s timeout →
   `{ distanceMeters, durationSeconds, geometry }`, fail-soft `geometry: null`.
2. `app/api/geocode/reverse/route.ts` — `GET ?lat&lng` → Nominatim with a proper
   `User-Agent`, LRU cache, 3s timeout → `{ name } | null`. Fixes the dropped UA header.
3. `lib/routing.ts` — client wrappers `fetchRoadRoute()`, `reverseGeocodeName()` with
   abort + fallback + client LRU; `lib/escape-html.ts` — one shared `escapeHtml`.
4. `lib/location-history.ts` — route fetch goes through the proxy; `detectStopPoints`
   rewritten (accuracy filter, median centroid, dwell rules, gap split, merge).
5. `PartnerMap.tsx` — distance line uses route geometry when snap is ON; history layer
   re-keyed on rounded coordinates instead of object identity; all user-controlled
   strings escaped; selected-stop highlight; stop markers show place names.
6. `LocationManager.tsx` — route toggle moved out of the history panel, always visible;
   `useLocationHistory` runs only when history is shown; place names in stop list rows.
7. `DistanceCard.tsx` — ETA = road route distance ÷ mode speed (traffic multiplier for
   driving); heuristic fallback when no route yet.
8. UI/UX — addresses in stop list rows + popups, selected-row state, loading/empty
   states, `aria-pressed` on toggles, focus-visible, mobile stacking.

## Security

One `escapeHtml` helper reused for every user-controlled string injected into Leaflet
HTML (partner name, address); strict query-param validation on both API routes; auth
required; share-gating stays server-side (history API already enforces it).

## Tests

Pure-function tests for `detectStopPoints`, `fetchRoadRoute`/`reverseGeocodeName`,
road-distance ETA, and the two API routes (auth 401, validation, proxying, fallback,
caching). `tests/integration/api-authz-matrix.test.ts` gains both new routes.
Manual end-to-end checklist (route on/off × both partners × history ranges × stop
naming).

## Calls made (user-approved unless noted)

- History trail stays **OFF by default** (button shows it); route toggle always visible
  and ON by default.
- Distance number stays haversine; **ETA follows the road route** (user-confirmed).
- OSRM driving profile for all modes; walking/motor ETA = road distance ÷ mode speed.
- Map distance label stays haversine (matches the card).
