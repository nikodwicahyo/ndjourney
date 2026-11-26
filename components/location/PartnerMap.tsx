"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSession } from "next-auth/react";
import { Heart, MapPin, Ruler } from "lucide-react";
import {
  formatDistance,
  haversineMeters,
  reliableBearing,
  formatBearingId,
} from "@/lib/geo";
import { safeAvatarSrc } from "@/lib/format";
import {
  reverseGeocodeName,
  effectiveDistance,
  shouldUseRoadRoute,
  ROAD_ROUTE_COLOR,
  STRAIGHT_ROUTE_COLOR,
  type RoadRoute,
} from "@/lib/routing";
import { escapeHtml } from "@/lib/escape-html";

import type { LocationPoint, LocationHistoryPoint } from "@/hooks/useLocation";
import {
  downsampleWaypoints,
  fetchRoadSnappedRoute,
  formatDurationId,
  formatStopTimeLabel,
  formatTimeOnly,
  headingOnPolyline,
  projectPointToPolyline,
  waypointBearing,
  type VisitedStop,
} from "@/lib/location-history";
import { stopOrdinalLabel, type HistoryView } from "@/lib/history-view";
import {
  HISTORY_TRAIL_STYLE,
  HISTORY_USER_COLORS,
  MAP_PANES,
  MAP_ZOOM_LIMITS,
  NAV_PATH,
  WAYPOINT_ARROW_SIZE,
  nextCameraAction,
  waypointArrowSvg,
  type CameraOwner,
} from "@/lib/map-panes";

type Pin = {
  id: string;
  label: string;
  point: LocationPoint;
  isSelf: boolean;
  image: string | null;
  deviceType?: string | null;
};

type AnimatableMap = L.Map & {
  _animatingZoom?: boolean;
  _onZoomTransitionEnd?: () => void;
};

/**
 * Leaflet silently drops a new view while a zoom transition is still in
 * flight (`_tryAnimatedZoom` bails) and then snaps the map back to the old
 * target when that transition ends. Finish the stale one so the newest intent
 * — ours or the user's — wins.
 */
function finishZoomAnimation(map: L.Map) {
  const m = map as AnimatableMap;
  if (m._animatingZoom) m._onZoomTransitionEnd?.();
}

const TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Session cache for road-snapped history segments. Re-snapping every 60 s
// history poll would hammer OSRM for geometry that has not changed.
const historySnapCache = new Map<string, Array<[number, number]>>();
const HISTORY_SNAP_CACHE_MAX = 40;

function segmentCacheKey(segment: LocationHistoryPoint[]): string {
  const waypoints = downsampleWaypoints(
    segment.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    35,
    40,
  );
  return waypoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
}

/**
 * Sparse breadcrumbs instead of an arrow per fix: one per 5 min or 100 m,
 * capped at 24. The line already shows the path; 2,000 arrows hide it.
 */
function breadcrumbPoints(points: LocationHistoryPoint[]): LocationHistoryPoint[] {
  const picked: LocationHistoryPoint[] = [];
  let lastTime = 0;
  let lastPoint: LocationHistoryPoint | null = null;

  for (const point of points) {
    const time = new Date(point.createdAt).getTime();
    const moved = lastPoint
      ? haversineMeters(
          { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
          { latitude: point.latitude, longitude: point.longitude },
        )
      : Infinity;
    if (!lastPoint || time - lastTime >= 5 * 60_000 || moved >= 100) {
      picked.push(point);
      lastPoint = point;
      lastTime = time;
    }
  }

  if (picked.length <= 24) return picked;
  const step = (picked.length - 1) / 23;
  return Array.from({ length: 24 }, (_, i) => picked[Math.round(i * step)]);
}

// Leaflet popups/icons are raw HTML strings, so lucide paths are inlined here
// instead of embedding platform-dependent emoji glyphs.
const MAP_PIN_PATH =
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>';
const CLOCK_PATH =
  '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
const SPEED_PATH =
  '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>';
function inlineIcon(path: string, size: number, color = "currentColor", filled = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? color : "none"}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-2px;flex:none;">${path}</svg>`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

function accuracyLabel(meters: number | null): string {
  if (meters === null) return "";
  if (meters <= 10) return "Akurat";
  if (meters <= 30) return "Cukup akurat";
  if (meters <= 65) return "Kurang akurat";
  if (meters <= 150) return "Tidak akurat";
  return "Sangat tidak akurat";
}

function createAvatarIcon(
  image: string | null,
  isSelf: boolean,
  isStationary: boolean = false,
): L.DivIcon {
  const ring = isSelf ? "#3b82f6" : "#F43F5E";
  const bg = "var(--card, #fff)";
  const fg = "var(--foreground, #0f172a)";
  const shadow = "0 2px 8px rgba(0,0,0,.35)";
  const heart = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="${ring}" stroke="${ring}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

  const safeImage = safeAvatarSrc(image);
  const avatarContent = safeImage
    ? `<img src="${safeImage}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:3px solid ${ring};box-shadow:${shadow};background:${bg};display:block;" />`
    : `<div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${bg};border:3px solid ${ring};box-shadow:${shadow};color:${fg};">${heart}</div>`;

  const statusBadge = isStationary
    ? `<div style="pointer-events:none;position:absolute;bottom:-1px;right:-1px;width:17px;height:17px;border-radius:50%;background:${ring};color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);" title="Sedang singgah">${inlineIcon(MAP_PIN_PATH, 10, "#fff")}</div>`
    : "";

  const inner = `<div class="avatar-marker-pin" style="position:relative;width:44px;height:44px;cursor:pointer;">${avatarContent}${statusBadge}</div>`;

  return L.divIcon({
    className: "",
    html: inner,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
  });
}

function createPulseIcon(isSelf: boolean): L.DivIcon {
  const color = isSelf ? "#3b82f6" : "#F43F5E";
  return L.divIcon({
    className: "",
    html: `<div style="pointer-events:none;width:24px;height:24px;border-radius:50%;background:${color};opacity:0.2;animation:leaflet-pulse 1.5s ease-in-out infinite;" />`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createBearingArrow(heading: number, isSelf: boolean): L.DivIcon {
  const color = isSelf ? "#3b82f6" : "#F43F5E";
  return L.divIcon({
    className: "",
    html: `<div style="pointer-events:none;width:14px;height:14px;transform:rotate(${heading}deg);opacity:0.8;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));">${inlineIcon(NAV_PATH, 14, color, isSelf)}</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 14],
  });
}

/**
 * History waypoint: arrow points along the recorded direction of travel.
 * Filled with the person's trail color and outlined with the trail's dark
 * casing so it reads the same as the dashed line underneath it.
 */
function createWaypointArrow(heading: number, color: string): L.DivIcon {
  const size = WAYPOINT_ARROW_SIZE;
  return L.divIcon({
    className: "",
    html: waypointArrowSvg(heading, color, size),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createStopIcon(
  index: number,
  color: string,
  label: string,
): L.DivIcon {
  // Solid person color + white text/border stays legible on light tiles, the
  // dark trail casing, and dark mode alike.
  const shadow = "0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(15,23,42,.35)";

  const inner = `<div class="visited-stop-marker" style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;border:2px solid #fff;box-shadow:${shadow};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;font-family:system-ui,sans-serif;" aria-label="${escapeHtml(label)}">${index + 1}</div>`;

  return L.divIcon({
    className: "",
    html: inner,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
  });
}

function buildAvatarPopup(
  p: Pin,
  address: string | null,
  currentStop?: VisitedStop | null,
  towardBearing?: number | null,
  partnerName = "pasangan",
): string {
  const safeImg = safeAvatarSrc(p.image);

  const deviceInfo = p.deviceType
    ? `<span style="font-size:11px;opacity:0.75;">${escapeHtml(p.deviceType)}</span>`
    : "";
  const accuracyInfo = p.point.accuracy
    ? `<div style="font-size:12px;margin-top:2px;color:var(--foreground,#111827);">±${Math.round(p.point.accuracy)}m · ${accuracyLabel(p.point.accuracy)}</div>`
    : "";
  const timeInfo = p.point.updatedAt
    ? `<div style="font-size:12px;opacity:0.6;margin-top:2px;">${inlineIcon(CLOCK_PATH, 12)} Diperbarui: ${timeAgo(p.point.updatedAt)}</div>`
    : "";
  const addressInfo = address
    ? `<div style="font-size:12px;margin-top:3px;font-weight:500;color:var(--foreground,#111827);">${escapeHtml(address)}</div>`
    : `<div style="font-size:12px;margin-top:3px;color:var(--muted-foreground,#64748b);">Memuat alamat…</div>`;
  // Same bearing the distance card uses: from this person toward the other.
  // The device compass is a different (often stale) value; showing both under
  // one "Arah" label made the two views disagree.
  const towardLabel = p.isSelf ? `Arah ke ${escapeHtml(partnerName)}` : "Arah ke kamu";
  const headingInfo =
    towardBearing !== null && towardBearing !== undefined
      ? `<div style="font-size:12px;margin-top:2px;opacity:0.6;display:flex;align-items:center;gap:4px;">` +
        `<span style="display:inline-flex;transform:rotate(${towardBearing}deg);">${inlineIcon(NAV_PATH, 12)}</span>` +
        `<span>${towardLabel}: ${formatBearingId(towardBearing)}</span></div>`
      : "";
  const speedInfo =
    p.point.speed !== null && p.point.speed >= 0
      ? `<div style="font-size:12px;margin-top:2px;opacity:0.6;display:flex;align-items:center;gap:4px;">${inlineIcon(SPEED_PATH, 12)}<span>Kecepatan: ${(p.point.speed * 3.6).toFixed(1)} km/j</span></div>`
      : "";

  const stopStatus = currentStop
    ? `<div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:${p.isSelf ? "#3b82f618" : "#F43F5E18"};color:${p.isSelf ? "#2563eb" : "#e11d48"};font-size:11px;font-weight:600;">
        ${inlineIcon(MAP_PIN_PATH, 12)} Sedang di sini · ${formatDurationId(currentStop.durationMinutes)}
       </div>`
    : "";

  const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${p.isSelf ? "#3b82f6" : "#F43F5E"}" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
  const avatarHtml = safeImg
    ? `<img src="${safeImg}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid ${p.isSelf ? "#3b82f6" : "#F43F5E"};" />`
    : `<div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--muted,#f1f5f9);border:2px solid ${p.isSelf ? "#3b82f6" : "#F43F5E"};">${heartSvg}</div>`;

  return `
    <div style="min-width:190px;font-family:system-ui,-apple-system,sans-serif;color:var(--foreground,#111827);padding:2px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        ${avatarHtml}
        <div>
          <div style="font-weight:700;font-size:14px;color:var(--foreground,#111827);">${escapeHtml(p.label)}</div>
          ${deviceInfo}
        </div>
      </div>
      ${addressInfo}
      ${stopStatus}
      <div style="margin-top:5px;border-top:1px solid #e2e8f0;padding-top:4px;">
        ${accuracyInfo}
        ${speedInfo}
        ${headingInfo}
        ${timeInfo}
      </div>
      <div style="font-size:10px;opacity:0.4;margin-top:3px;">
        ${p.point.lat.toFixed(6)}, ${p.point.lng.toFixed(6)}
      </div>
    </div>
  `;
}

export default function PartnerMap({
  self,
  partner,
  view = null,
  showHistory = false,
  selectedStop = null,
  snapToRoads = true,
  route = null,
  stopAddresses,
  historyFilterKey = "",
  selfId: selfIdProp,
}: {
  self: Pin | null;
  partner: Pin | null;
  /** One shared view model, built once by LocationManager for map + card. */
  view?: HistoryView | null;
  showHistory?: boolean;
  selectedStop?: VisitedStop | null;
  snapToRoads?: boolean;
  /** Geometry drawn on the map (follows the view toggle). The distance label
   * follows the same toggle: road km when snapped, straight km otherwise. */
  route?: RoadRoute | null;
  stopAddresses?: Record<string, string | null>;
  /** Identifies the chosen history range/filter. Only a change here may
   * re-frame the camera; data refreshes must never move it. */
  historyFilterKey?: string;
  /** Passed explicitly so history rendering doesn't depend on session timing. */
  selfId?: string;
}) {
  const { data: session } = useSession();
  const selfId = selfIdProp ?? session?.user?.id;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stopMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyLayerRef = useRef<L.LayerGroup | null>(null);
  const historyLayerRef = useRef<L.LayerGroup | null>(null);
  const headingLayerRef = useRef<L.LayerGroup | null>(null);

  const selfMarkerRef = useRef<L.Marker | null>(null);
  const partnerMarkerRef = useRef<L.Marker | null>(null);
  const selfPulseRef = useRef<L.Marker | null>(null);
  const partnerPulseRef = useRef<L.Marker | null>(null);
  const selfAccuracyRef = useRef<L.Circle | null>(null);
  const partnerAccuracyRef = useRef<L.Circle | null>(null);
  const selfHeadingRef = useRef<L.Marker | null>(null);
  const partnerHeadingRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const distanceLabelRef = useRef<L.Marker | null>(null);
  const etaLabelRef = useRef<L.Marker | null>(null);

  const selfRef = useRef(self);
  const partnerRef = useRef(partner);
  selfRef.current = self;
  partnerRef.current = partner;

  const historyFittedRef = useRef(false);
  const historyFitKeyRef = useRef("");
  const markersFittedRef = useRef(false);
  // Who owns the camera. "auto" until the user takes it (drag, zoom, a center
  // button, picking a stop). While "auto" the map may frame the pins/trail as
  // data arrives; once "user" nothing but an explicit history filter change
  // may move it.
  const cameraOwnerRef = useRef<CameraOwner>("auto");
  // Leaflet fires `zoomstart` for programmatic zooms too, so our own moves are
  // flagged: a fit must never look like a gesture that hands over the camera.
  const programmaticRef = useRef(false);

  const runCameraMove = useCallback((fn: (map: L.Map) => void) => {
    const map = mapRef.current;
    if (!map) return;
    finishZoomAnimation(map);
    programmaticRef.current = true;
    try {
      fn(map);
    } finally {
      programmaticRef.current = false;
    }
  }, []);

  /** Pan to a single point without changing zoom (follow-one-pin mode). */
  const followPin = useCallback(
    (point: LocationPoint) => {
      runCameraMove((map) =>
        map.panTo([point.lat, point.lng], {
          animate: !prefersReducedMotion(),
          duration: 0.8,
        }),
      );
    },
    [runCameraMove],
  );

  /** Frame whatever pins exist. Returns false when there is nothing to frame. */
  const framePins = useCallback(
    (animate: boolean): boolean => {
      const pins = [selfRef.current, partnerRef.current].filter(
        (p): p is Pin => !!p?.point,
      );
      if (pins.length === 0) return false;
      runCameraMove((map) => {
        if (pins.length === 2) {
          map.fitBounds(
            L.latLngBounds(
              pins.map((p) => [p.point.lat, p.point.lng] as L.LatLngTuple),
            ),
            { padding: [80, 80], maxZoom: 16, animate },
          );
        } else {
          map.setView([pins[0].point.lat, pins[0].point.lng], 16, { animate });
        }
      });
      return true;
    },
    [runCameraMove],
  );

  const [addressCache, setAddressCache] = useState<
    Record<string, string | null>
  >({});
  const addressCacheRef = useRef(addressCache);
  addressCacheRef.current = addressCache;
  const stopAddressesRef = useRef(stopAddresses);
  stopAddressesRef.current = stopAddresses;
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    [selfRef.current, partnerRef.current].forEach((p) => {
      if (!p?.point) return;
      const key = `${p.point.lat.toFixed(4)},${p.point.lng.toFixed(4)}`;
      if (!(key in addressCacheRef.current)) {
        reverseGeocodeName(p.point.lat, p.point.lng).then((addr) => {
          if (addr)
            setAddressCache((prev) => ({ ...prev, [key]: addr }));
        });
      }
    });
  }, [self?.point?.lat, self?.point?.lng, partner?.point?.lat, partner?.point?.lng]);

  // The map's CSS ships with this component (static import above); no runtime
  // <style> fallback needed.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const container = containerRef.current;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      container.style.minHeight = "420px";
    }

    const center =
      selfRef.current?.point ?? partnerRef.current?.point ?? { lat: -6.2, lng: 106.816 };

    // Strict-mode remount can leave a stale Leaflet id on the container
    const stale = container as HTMLDivElement & { _leaflet_id?: number };
    if (stale._leaflet_id) {
      container.innerHTML = "";
      delete stale._leaflet_id;
    }

    let map: L.Map;
    try {
      map = L.map(container, {
        center: [center.lat, center.lng],
        zoom: 15,
        minZoom: MAP_ZOOM_LIMITS.min,
        maxZoom: MAP_ZOOM_LIMITS.max,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
      });
    } catch (err) {
      console.error("[PartnerMap] L.map() failed:", err);
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">Peta gagal dimuat</div>';
      return;
    }

    let tile: L.TileLayer;
    try {
      tile = L.tileLayer(TILE_URL, {
        // One above the map max: detectRetina subtracts 1 on hi-dpi screens.
        maxZoom: MAP_ZOOM_LIMITS.tileMax,
        minZoom: MAP_ZOOM_LIMITS.min,
        maxNativeZoom: MAP_ZOOM_LIMITS.tileNativeMax,
        subdomains: "abc",
        attribution: TILE_ATTR,
        detectRetina: true,
      }).addTo(map);
      tile.on("tileerror", (e: unknown) => {
        const err = e as { url?: string };
        console.warn("[PartnerMap] tileerror", err?.url ?? "(no url)");
      });
      tile.on("tileload", () => {
        if (mapRef.current) mapRef.current.invalidateSize({ debounceMoveend: true });
      });
    } catch (err) {
      console.error("[PartnerMap] tileLayer failed:", err);
      map.remove();
      return;
    }
    tileLayerRef.current = tile;

    try {
      accuracyLayerRef.current = L.layerGroup().addTo(map);
      historyLayerRef.current = L.layerGroup().addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      headingLayerRef.current = L.layerGroup().addTo(map);
      // Explicit stacking: live road line (420), dashed history trail (430),
      // waypoint arrows (440), avatars/stop pins (600). Arrows sit in their own
      // pane so Leaflet's SVG z-index cannot bury them near the top edge.
      map.createPane("routePane").style.zIndex = String(MAP_PANES.route);
      map.createPane("historyPane").style.zIndex = String(MAP_PANES.history);
      map.createPane("waypointPane").style.zIndex = String(MAP_PANES.waypoint);
      // Only a real gesture takes the camera. Programmatic fitBounds/flyTo
      // also fire `zoomstart`; treating those as gestures is what let data
      // updates fight the view the user had just chosen.
      map.on("dragstart zoomstart", () => {
        if (programmaticRef.current) return;
        cameraOwnerRef.current = "user";
        // Grabbing the map mid-animation must win now, not when the old zoom
        // ends (that is the "it jumps back and ignores me" freeze).
        finishZoomAnimation(map);
      });
    } catch (err) {
      console.error("[PartnerMap] layerGroup failed:", err);
      return;
    }

    L.control
      .scale({
        position: "bottomleft",
        metric: true,
        imperial: false,
        // Leaflet rounds the label from this width. At z21 ~0.074 m/px near
        // Jakarta, so 72px lands in the 5 m bucket (60px would label 3 m).
        maxWidth: MAP_ZOOM_LIMITS.scaleMaxWidth,
      })
      .addTo(map);

    const scaleStyle = document.createElement("style");
    scaleStyle.textContent = `
.leaflet-control-scale{max-width:none!important;width:fit-content!important}
.leaflet-control-scale-line{background:var(--card,#fff)!important;border:1px solid #ccc!important;border-top:none!important;color:var(--foreground,#333)!important;padding:0 6px 1px!important;font-size:12px!important;font-weight:500!important;width:fit-content!important;text-shadow:none!important;box-shadow:none!important}
.leaflet-bar a{width:44px!important;height:44px!important;line-height:44px!important;font-size:18px!important;}
@media (max-width:639px){.leaflet-bar a{width:36px!important;height:36px!important;line-height:36px!important;font-size:16px!important}.leaflet-control-scale-line{font-size:10px!important}}
@keyframes leaflet-line-dash{to{stroke-dashoffset:-24}}
.leaflet-connecting-line{animation:leaflet-line-dash 1.5s linear infinite}
@keyframes leaflet-pulse{0%{transform:scale(1);opacity:.2}50%{transform:scale(2);opacity:0}100%{transform:scale(1);opacity:.2}}
@keyframes leaflet-pulse-calm{0%,100%{opacity:.15}50%{opacity:.45}}
/* Reduced motion keeps the pulse (it marks a live partner) but drops the
   scale travel. The dashed connector is the only cue for straight-line mode,
   so slow it down instead of freezing it — the line still reads as active. */
@media (prefers-reduced-motion: reduce){.leaflet-connecting-line{animation-duration:6s}div[style*="leaflet-pulse"]{animation:leaflet-pulse-calm 2.5s ease-in-out infinite!important}}
.visited-stop-marker{cursor:pointer;transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)}
.visited-stop-marker:hover{transform:scale(1.25);z-index:1000!important}
.stop-selected .visited-stop-marker{transform:scale(1.35);box-shadow:0 0 0 4px rgba(244,63,94,.25)}
.avatar-marker-pin{cursor:pointer;transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)}
.avatar-marker-pin:hover{transform:scale(1.12);z-index:3000!important}
`;
    containerRef.current?.appendChild(scaleStyle);

    function makeControlBtn(
      html: string,
      title: string,
      onClick: () => void,
    ): HTMLAnchorElement {
      const btn = L.DomUtil.create("a");
      btn.innerHTML = html;
      btn.title = title;
      btn.href = "#";
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-label", title);
      btn.style.cssText = [
        "width:44px",
        "height:44px",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "text-decoration:none",
        "color:#222",
        "background:#fff",
        "border-bottom:1px solid #ccc",
        "cursor:pointer",
      ].join(";");
      L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
      btn.onclick = (e) => {
        L.DomEvent.preventDefault(e);
        onClick();
      };
      btn.onmouseenter = () => { btn.style.background = "#f4f4f4"; };
      btn.onmouseleave = () => { btn.style.background = "#fff"; };
      return btn;
    }

    function zoomBtn(label: string, title: string, action: () => void): HTMLAnchorElement {
      const btn = makeControlBtn(label, title, action);
      btn.style.fontSize = "18px";
      btn.style.fontWeight = "bold";
      btn.style.lineHeight = "44px";
      return btn;
    }

    const zoomBar = L.DomUtil.create("div");
    zoomBar.className = "leaflet-control-zoom leaflet-bar";
    zoomBar.appendChild(zoomBtn("+", "Perbesar peta", () => map.zoomIn()));
    zoomBar.appendChild(zoomBtn("−", "Perkecil peta", () => map.zoomOut()));
    const ZoomCtrl = L.Control.extend({ onAdd: () => zoomBar });
    new ZoomCtrl({ position: "bottomright" }).addTo(map);

    const actionBar = L.DomUtil.create("div");
    actionBar.className = "leaflet-control-zoom leaflet-bar";
    actionBar.appendChild(
      makeControlBtn(
        `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
        "Pusatkan ke lokasi saya",
        () => {
          // Follow me: stay centered on my own pin as fixes arrive, but never
          // refit to both (that is what used to undo this button seconds later).
          cameraOwnerRef.current = "self";
          const reduceAnim = prefersReducedMotion();
          const currentSelf = selfRef.current;
          if (currentSelf?.point) {
            const { lat, lng } = currentSelf.point;
            runCameraMove((map) =>
              map.flyTo([lat, lng], 17, {
                duration: reduceAnim ? 0 : 1.2,
                easeLinearity: 0.3,
              }),
            );
          } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                runCameraMove((map) =>
                  map.flyTo([pos.coords.latitude, pos.coords.longitude], 17, {
                    duration: reduceAnim ? 0 : 1.2,
                    easeLinearity: 0.3,
                  }),
                );
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
            );
          }
        },
      ),
    );
    actionBar.appendChild(
      makeControlBtn(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-5px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
        "Pusatkan ke pasangan",
        () => {
          // "Show us both" is exactly what auto framing means, so it re-arms it
          // (a later drag still takes the camera back).
          cameraOwnerRef.current = "auto";
          const reduceAnim = prefersReducedMotion();
          const selfPoint = selfRef.current?.point;
          const partnerPoint = partnerRef.current?.point;
          const duration = reduceAnim ? 0 : 1.2;
          if (selfPoint && partnerPoint) {
            runCameraMove((map) =>
              map.fitBounds(
                L.latLngBounds([
                  [selfPoint.lat, selfPoint.lng],
                  [partnerPoint.lat, partnerPoint.lng],
                ]),
                { padding: [80, 80], maxZoom: 16, animate: !reduceAnim, duration },
              ),
            );
          } else if (selfPoint) {
            runCameraMove((map) =>
              map.flyTo([selfPoint.lat, selfPoint.lng], 16, { duration }),
            );
          } else if (partnerPoint) {
            runCameraMove((map) =>
              map.flyTo([partnerPoint.lat, partnerPoint.lng], 16, { duration }),
            );
          }
        },
      ),
    );
    actionBar.appendChild(
      makeControlBtn(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
        "Layar penuh",
        () => {
          const el = containerRef.current;
          if (!el) return;
          if (!document.fullscreenElement) {
            el.requestFullscreen()
              .then(() => setIsFullscreen(true))
              .catch(() => {});
          } else {
            document
              .exitFullscreen()
              .then(() => setIsFullscreen(false))
              .catch(() => {});
          }
        },
      ),
    );
    const ActionCtrl = L.Control.extend({ onAdd: () => actionBar });
    new ActionCtrl({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    function tryInvalidate(attempt = 0): void {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize({ debounceMoveend: true });
      const size = mapRef.current.getSize();
      if ((size.x === 0 || size.y === 0) && attempt < 60) {
        const delay = Math.min(100 * Math.pow(1.15, attempt), 5000);
        setTimeout(() => tryInvalidate(attempt + 1), delay);
      }
    }

    tryInvalidate();
    map.whenReady(() => tryInvalidate());

    // First visit frames both people. A later data update must not re-fit
    // (the marker effect owns auto framing), and the user's own choice wins.
    map.whenReady(() => {
      if (mapRef.current !== map) return;
      if (cameraOwnerRef.current !== "auto" || markersFittedRef.current) return;
      map.invalidateSize();
      if (framePins(false)) markersFittedRef.current = true;
    });

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize({ debounceMoveend: true });
    });
    if (containerRef.current) ro.observe(containerRef.current);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && mapRef.current) {
            mapRef.current.invalidateSize({ debounceMoveend: true });
          }
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    if (containerRef.current) io.observe(containerRef.current);

    const onResize = () => {
      if (mapRef.current) mapRef.current.invalidateSize({ debounceMoveend: true });
    };
    window.addEventListener("resize", onResize);

    const onVisible = () => {
      if (document.visibilityState === "visible" && mapRef.current) {
        mapRef.current.invalidateSize({ debounceMoveend: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisible);
      if (scaleStyle.parentNode) scaleStyle.parentNode.removeChild(scaleStyle);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
      accuracyLayerRef.current = null;
      historyLayerRef.current = null;
      headingLayerRef.current = null;
    };
  }, [framePins, runCameraMove]);

  // Fly to selected stop when requested
  useEffect(() => {
    if (!selectedStop || !mapRef.current) return;
    // Picking a stop is an explicit camera choice; a presence poll must not
    // pull the map back to the two live pins.
    cameraOwnerRef.current = "user";
    const reduceAnim = prefersReducedMotion();
    runCameraMove((map) =>
      map.flyTo([selectedStop.latitude, selectedStop.longitude], 17, {
        duration: reduceAnim ? 0 : 1.0,
        easeLinearity: 0.3,
      }),
    );

    if (selectedStop.isCurrent) {
      // Focus on the live avatar marker and open its popup
      const isSelf = selectedStop.userId === selfId;
      const targetMarker = isSelf ? selfMarkerRef.current : partnerMarkerRef.current;
      if (targetMarker) {
        setTimeout(() => {
          targetMarker.openPopup();
        }, reduceAnim ? 50 : 600);
      }
    } else {
      // Focus on the past stop pin marker
      const marker = stopMarkersRef.current.get(selectedStop.id);
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, reduceAnim ? 50 : 600);
      }
    }
  }, [selectedStop, selfId, runCameraMove]);

  // Highlight the stop chosen from the list. Stable callback so re-selecting
  // never rebuilds the history layer.
  const selectedStopRef = useRef(selectedStop);
  selectedStopRef.current = selectedStop;
  const applyStopHighlight = useCallback(() => {
    stopMarkersRef.current.forEach((marker, id) => {
      marker.getElement()?.classList.toggle(
        "stop-selected",
        !!selectedStopRef.current && selectedStopRef.current.id === id,
      );
    });
  }, []);
  useEffect(() => { applyStopHighlight(); }, [selectedStop, applyStopHighlight]);

  // Update history trail — with fitBounds to show trail + markers when ON,
  // and re-fit to markers when OFF.
  // Keyed by rounded coordinates: the 15s presence poll creates new pin objects
  // every time, which would otherwise rebuild the whole trail layer each poll.
  const selfKey = self ? `${self.point.lat.toFixed(4)},${self.point.lng.toFixed(4)}` : "none";
  const partnerKey = partner ? `${partner.point.lat.toFixed(4)},${partner.point.lng.toFixed(4)}` : "none";
  const historyDrawRef = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    const hLayerUntyped = historyLayerRef.current;
    if (!map || !hLayerUntyped) return;
    const hLayer: L.LayerGroup = hLayerUntyped;

    // Token guards async road-snapping: a stale response must not touch a
    // layer that has already been cleared for a newer render.
    historyDrawRef.current += 1;
    const drawToken = historyDrawRef.current;

    hLayer.clearLayers();
    stopMarkersRef.current.clear();

    // Only an explicit range/filter change re-frames the trail. Data arriving
    // (a new stop, the 60 s refresh, a live fix) must never move the camera:
    // that heuristic also reset the camera owner, so seconds after the user
    // centered on themselves the next fix snapped the map back to both pins.
    if (historyFilterKey !== historyFitKeyRef.current) {
      historyFitKeyRef.current = historyFilterKey;
      historyFittedRef.current = false;
      cameraOwnerRef.current = "auto";
    }

    const pins = [selfRef.current, partnerRef.current].filter(Boolean) as Pin[];
    const markerLatLngs = pins.map(
      (p) => [p.point.lat, p.point.lng] as L.LatLngExpression,
    );

    const fitMarkerBounds = () => {
      if (markersFittedRef.current) return;
      if (cameraOwnerRef.current !== "auto") return;
      if (framePins(!prefersReducedMotion())) markersFittedRef.current = true;
    };

    if (!showHistory || !view) {
      fitMarkerBounds();
      return;
    }

    const allTrailLatLngs: L.LatLngExpression[] = [];

    function renderUserTrail(
      userView: HistoryView["self"],
      color: string,
      userLabel: string,
      layer: L.LayerGroup,
    ) {
      const { segments, stops: userStops } = userView;
      if (segments.length === 0 && userStops.length === 0) return;

      segments.forEach((segment) => {
        if (segment.length === 0) return;
        const latlngs = segment.map(
          (p) => [p.latitude, p.longitude] as L.LatLngTuple,
        );
        allTrailLatLngs.push(...latlngs);

        // A single high-contrast dash style is used in BOTH route modes: dark
        // casing + partner-colored core. Mode only changes the live route.
        const casing = L.polyline(latlngs, {
          pane: "historyPane",
          color: HISTORY_TRAIL_STYLE.casing,
          weight: HISTORY_TRAIL_STYLE.casingWeight,
          opacity: 0.9,
          // Same dash pattern as the colored line: a solid casing would hide
          // the road continuously, including in the gaps between dashes.
          dashArray: HISTORY_TRAIL_STYLE.dash,
          lineCap: "round",
          lineJoin: "round",
          interactive: false,
        }).addTo(layer);

        const polyline = L.polyline(latlngs, {
          pane: "historyPane",
          // Per-partner color; identical in road and line modes.
          color,
          weight: HISTORY_TRAIL_STYLE.coreWeight,
          opacity: 0.95,
          dashArray: HISTORY_TRAIL_STYLE.dash,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layer);

        const crumbs: Array<{
          marker: L.Marker;
          origLat: number;
          origLng: number;
          heading: number;
          label: string;
        }> = [];

        // Sparse direction arrows, not an arrow per fix. Each one is clickable
        // and opens a popup with the recorded time and speed.
        // Skip the first point: the "Mulai" marker already sits exactly there
        // and would otherwise render a second, overlapping waypoint/popup.
        breadcrumbPoints(segment).slice(1).forEach((p) => {
          const timeStr = formatTimeOnly(p.createdAt);
          const speedStr = p.speed !== null && p.speed > 0 ? ` • ${(p.speed * 3.6).toFixed(0)} km/j` : "";
          const label = `${userLabel}: ${timeStr}${speedStr}`;
          // Recorded device heading covers a fully stationary trail, where no
          // direction can be derived from movement between fixes.
          const heading = waypointBearing(segment, segment.indexOf(p)) ?? p.heading ?? 0;
          const crumb = L.marker([p.latitude, p.longitude], {
            pane: "waypointPane",
            icon: createWaypointArrow(heading, color),
          }).addTo(layer);

          crumbs.push({
            marker: crumb,
            origLat: p.latitude,
            origLng: p.longitude,
            heading,
            label,
          });

          crumb.getElement()?.setAttribute("aria-label", label);
          // Same popup shell as the stop/avatar popups on this map.
          crumb.bindPopup(
            `<div style="min-width:180px;font-family:system-ui,-apple-system,sans-serif;padding:2px;">` +
              `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">` +
                `<span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;">${escapeHtml(userLabel)}</span>` +
                `<span style="font-size:10px;font-weight:600;color:var(--muted-foreground,#64748b);background:${color}15;padding:1px 6px;border-radius:999px;">Waypoint</span>` +
              `</div>` +
              `<div style="font-size:11px;color:var(--muted-foreground,#64748b);">` +
                `${inlineIcon(CLOCK_PATH, 12)} ${escapeHtml(timeStr)}${escapeHtml(speedStr)}` +
              `</div>` +
            `</div>`,
            { autoPan: true, closeButton: true, offset: [0, -10] },
          );
        });

        const snapBreadcrumbsToRoad = (roadCoords: Array<[number, number]>) => {
          crumbs.forEach(({ marker, origLat, origLng, heading, label }) => {
            const snapped = projectPointToPolyline([origLat, origLng], roadCoords);
            marker.setLatLng(snapped);
            // Snap direction to the road as well: an arrow that keeps its raw
            // GPS bearing would point off the line after the position snapped.
            const roadHeading = headingOnPolyline(roadCoords, snapped);
            if (roadHeading !== null && roadHeading !== heading) {
              marker.setIcon(createWaypointArrow(roadHeading, color));
              // setIcon replaces the DOM node, so restore the accessible name.
              marker.getElement()?.setAttribute("aria-label", label);
            }
          });
        };

        // Snap each segment separately: a gap is a gap, never a fake straight
        // line across it. Cached per segment; stale responses are token-gated.
        if (snapToRoads && segment.length >= 2) {
          const key = segmentCacheKey(segment);
          const cached = historySnapCache.get(key);
          if (cached) {
            casing.setLatLngs(cached);
            polyline.setLatLngs(cached);
            snapBreadcrumbsToRoad(cached);
          } else {
            fetchRoadSnappedRoute(
              segment.map((p) => ({ lat: p.latitude, lng: p.longitude })),
            ).then((roadCoords) => {
              if (historyDrawRef.current !== drawToken) return;
              if (!mapRef.current || !hLayer.hasLayer(polyline)) return;
              // null = no real OSRM geometry. Leave the recorded GPS line
              // alone; replacing it with downsampled straight points is what
              // drew a new dashed line across the road.
              if (roadCoords) {
                if (historySnapCache.size >= HISTORY_SNAP_CACHE_MAX) {
                  const oldest = historySnapCache.keys().next().value;
                  if (oldest) historySnapCache.delete(oldest);
                }
                historySnapCache.set(key, roadCoords);
                // Both layers must move together; updating only the core left
                // the dark casing on the raw straight coordinates.
                casing.setLatLngs(roadCoords);
                polyline.setLatLngs(roadCoords);
                snapBreadcrumbsToRoad(roadCoords);
              }
            });
          }
        }
      });

      // "Mulai" anchor: where this person's recorded trail begins.
      const firstPoint = segments[0]?.[0];
      if (firstPoint) {
        L.marker([firstPoint.latitude, firstPoint.longitude], {
          icon: L.divIcon({
            className: "",
            html: `<div style="display:flex;align-items:center;gap:3px;border-radius:999px;background:var(--card,#fff);border:1px solid ${color};color:${color};font:600 9px/1 system-ui,sans-serif;padding:2px 5px;box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap;">${inlineIcon(NAV_PATH, 8, color, true)} Mulai</div>`,
            iconSize: [0, 0],
            iconAnchor: [12, 10],
          }),
          interactive: false,
          keyboard: false,
          zIndexOffset: 250,
        }).addTo(layer);
      }

      // A stationary GPS trace is sub-pixel when the map fits two people 8km
      // apart. Mark every visited place with a PIXEL-radius circle so a history
      // view is always visible, even when nobody moved. The numbered pin below
      // stays for past stops; the live avatar covers the current one.
      userStops.forEach((stop) => {
        L.circleMarker([stop.latitude, stop.longitude], {
          pane: "historyPane",
          radius: stop.isCurrent ? 42 : 22,
          color,
          weight: stop.isCurrent ? 2 : 1.5,
          fillColor: color,
          fillOpacity: stop.isCurrent ? 0.06 : 0.1,
          dashArray: stop.isCurrent ? "5 5" : undefined,
          interactive: false,
        })
          .addTo(layer)
          .bindTooltip(
            stop.isCurrent
              ? `${escapeHtml(userLabel)}: sedang di sini · ${formatDurationId(stop.durationMinutes)}`
              : `${escapeHtml(userLabel)}: singgah ${formatDurationId(stop.durationMinutes)}`,
            { direction: "top", offset: [0, -4] },
          );
      });

      // Numbered pins use the SAME ordinal as the card list (index in the full
      // stop array, current included), so "#2" is one place in both places.
      userStops.forEach((stop, index) => {
        if (stop.isCurrent) return;

        const stopIcon = createStopIcon(index, color, `${userLabel} - ${stopOrdinalLabel(index)}`);
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: stopIcon,
          zIndexOffset: 300,
          title: `${userLabel} - ${stopOrdinalLabel(index)}`,
        }).addTo(layer);

        // Leaflet stamps role=button/tabindex on markers; give the real pin an
        // accessible name instead of an anonymous tab stop.
        marker.getElement()?.setAttribute("aria-label", `${userLabel}, ${stopOrdinalLabel(index)}`);

        stopMarkersRef.current.set(stop.id, marker);

        const durationStr = `Singgah ${formatDurationId(stop.durationMinutes)}`;
        const timeLabel = formatStopTimeLabel(stop);

        // Dynamic content reads the latest place name at popup-open time.
        // A name arriving later must not rebuild the whole history layer.
        marker.bindPopup(() => {
          const displayAddr = stopAddressesRef.current?.[stop.id] || "Menunggu nama lokasi…";
          return `
          <div style="min-width:180px;font-family:system-ui,-apple-system,sans-serif;padding:2px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
              <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;">
                ${stopOrdinalLabel(index)}
              </span>
              <span style="font-size:11px;font-weight:600;color:var(--foreground,#111827);background:${color}15;padding:1px 6px;border-radius:999px;">
                ${durationStr}
              </span>
            </div>
            <div style="font-weight:600;font-size:13px;color:var(--foreground,#111827);margin-bottom:3px;">
              ${escapeHtml(displayAddr)}
            </div>
            <div style="font-size:11px;color:var(--muted-foreground,#64748b);">
              ${inlineIcon(CLOCK_PATH, 12)} ${escapeHtml(timeLabel)}
            </div>
            <div style="font-size:10px;color:var(--muted-foreground,#94a3b8);margin-top:2px;">
              ${escapeHtml(userLabel)} · ${stop.pointCount} titik pantau
            </div>
          </div>
        `;
        }, {
          autoPan: true,
          closeButton: true,
          offset: [0, -10],
        });
      });
    }

    renderUserTrail(view.self, HISTORY_USER_COLORS.self, "Kamu", hLayer);
    renderUserTrail(view.partner, HISTORY_USER_COLORS.partner, partner?.label ?? "Pasangan", hLayer);

    applyStopHighlight();

    if (allTrailLatLngs.length === 0) {
      fitMarkerBounds();
      historyFittedRef.current = false;
      return;
    }
    const bounds = L.latLngBounds(allTrailLatLngs);
    if (markerLatLngs.length > 0) {
      markerLatLngs.forEach((ll) => bounds.extend(ll));
    }
    if (!historyFittedRef.current && cameraOwnerRef.current === "auto") {
      runCameraMove((m) =>
        m.fitBounds(bounds, {
          padding: [80, 80],
          maxZoom: 16,
          animate: !prefersReducedMotion(),
        }),
      );
      historyFittedRef.current = true;
      // The trail fit already includes both pins; don't let the marker effect
      // queue a second animation in the same tick (Leaflet drops the second
      // one and then snaps back to the first target when it completes).
      markersFittedRef.current = true;
    }
  }, [
    view,
    showHistory,
    selfKey,
    partnerKey,
    partner?.label,
    snapToRoads,
    applyStopHighlight,
    historyFilterKey,
    framePins,
    runCameraMove,
  ]);

  // Update markers (animated)
  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const accuracyLayer = accuracyLayerRef.current;
    const headingLayer = headingLayerRef.current;
    if (!map || !markerLayer || !accuracyLayer || !headingLayer) return;

    markerLayer.clearLayers();
    accuracyLayer.clearLayers();
    headingLayer.clearLayers();

    const pins = [self, partner].filter(Boolean) as Pin[];
    const latlngs: L.LatLngExpression[] = [];

    pins.forEach((p) => {
      const latlng: L.LatLngExpression = [p.point.lat, p.point.lng];
      latlngs.push(latlng);

      // Direction toward the other person — same guard and bearing as the card.
      const other = p.isSelf ? partner : self;
      const towardBearing = other ? reliableBearing(p.point, other.point) : null;

      // Accuracy circle
      if (p.point.accuracy && p.point.accuracy > 0 && p.point.accuracy < 1000) {
        const color = p.isSelf ? "#3b82f6" : "#F43F5E";
        L.circle(latlng, {
          radius: p.point.accuracy,
          color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1.5,
          opacity: 0.3,
          interactive: false,
        }).addTo(accuracyLayer);
      }

      // Pulse ring
      L.marker(latlng, {
        icon: createPulseIcon(p.isSelf),
        interactive: false,
        // keyboard defaults to true and stamps role="button"/tabindex on a
        // decorative ring — no name, so axe flags aria-command-name.
        keyboard: false,
      }).addTo(markerLayer);

      // Check if user is currently stopped at a place
      const currentStop = p.isSelf
        ? (view?.self.stops.find((s) => s.isCurrent) ?? null)
        : (view?.partner.stops.find((s) => s.isCurrent) ?? null);

      // Main avatar marker with high z-index and explicit click handler
      const marker = L.marker(latlng, {
        icon: createAvatarIcon(p.image, p.isSelf, !!currentStop),
        zIndexOffset: 2000,
        riseOnHover: true,
      }).addTo(markerLayer);

      marker.getElement()?.setAttribute("aria-label", `Lokasi ${p.label}`);

      if (p.isSelf) {
        selfMarkerRef.current = marker;
      } else {
        partnerMarkerRef.current = marker;
      }

      // Arrow points toward the other person, matching the popup and card.
      if (towardBearing !== null) {
        L.marker(latlng, {
          icon: createBearingArrow(towardBearing, p.isSelf),
          interactive: false,
          keyboard: false,
          zIndexOffset: 1500,
        })
          .addTo(headingLayer)
          .setLatLng([
            p.point.lat + 0.0002,
            p.point.lng,
          ]);
      }

      const addrKey = `${p.point.lat.toFixed(4)},${p.point.lng.toFixed(4)}`;

      // Dynamic popup binding on avatar: opens fresh without layer re-creation
      marker.bindPopup(() => {
        const cached = addressCacheRef.current[addrKey];
        if (!cached) {
          reverseGeocodeName(p.point.lat, p.point.lng).then((addr) => {
            if (addr) {
              addressCacheRef.current[addrKey] = addr;
              if (marker.isPopupOpen()) {
                marker.setPopupContent(buildAvatarPopup(p, addr, currentStop, towardBearing, partner?.label));
              }
            }
          });
        }
        return buildAvatarPopup(p, cached ?? null, currentStop, towardBearing, partner?.label);
      }, {
        autoPan: true,
        closeButton: true,
        offset: [0, -15],
      });

      marker.on("click", () => {
        marker.openPopup();
      });
    });

    // Connecting line + distance + ETA
    if (pins.length >= 1) {
      map.invalidateSize({ debounceMoveend: true });
    }

    if (pins.length === 2) {
      const hasRoadRoute = !!route?.geometry && route.geometry.length >= 2;
      const lineLatLngs: L.LatLngExpression[] = hasRoadRoute ? route!.geometry! : latlngs;

      // White casing keeps the blue road line readable over busy tiles.
      if (hasRoadRoute) {
        L.polyline(lineLatLngs, {
          pane: "routePane",
          color: "#ffffff",
          weight: 8,
          opacity: 0.75,
          lineCap: "round",
          lineJoin: "round",
          interactive: false,
        }).addTo(markerLayer);
      }
      const routeColor = hasRoadRoute ? ROAD_ROUTE_COLOR : STRAIGHT_ROUTE_COLOR;
      lineRef.current = L.polyline(lineLatLngs, {
        pane: "routePane",
        color: routeColor,
        weight: hasRoadRoute ? 4 : 3,
        dashArray: hasRoadRoute ? undefined : "12 12",
        opacity: hasRoadRoute ? 0.95 : 0.7,
        className: hasRoadRoute ? undefined : "leaflet-connecting-line",
        interactive: false,
      }).addTo(markerLayer);

      const mid = L.latLngBounds(lineLatLngs).getCenter();
      const straightMeters = haversineMeters(
        { latitude: pins[0].point.lat, longitude: pins[0].point.lng },
        { latitude: pins[1].point.lat, longitude: pins[1].point.lng },
      );
      // The map's number follows the same toggle as its line: road km for the
      // snapped route, straight km for the line. The card stays road-only.
      const distLabel = formatDistance(
        effectiveDistance(shouldUseRoadRoute(route), straightMeters),
      );
      distanceLabelRef.current = L.marker(mid, {
        icon: L.divIcon({
          className: "",
          html: `<div style="color:${routeColor};font-size:18px;font-weight:800;white-space:nowrap;display:flex;align-items:center;gap:6px;text-shadow:0 1px 4px rgba(255,255,255,0.95),0 0 8px rgba(255,255,255,0.85);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${routeColor}" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg><span>${distLabel}</span></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(markerLayer);
    }

    const owner = cameraOwnerRef.current;
    const inView =
      owner === "self"
        ? !!selfRef.current?.point &&
          map
            .getBounds()
            .pad(-0.25)
            .contains([
              selfRef.current.point.lat,
              selfRef.current.point.lng,
            ])
        : latlngs.every((ll) =>
            map
              .getBounds()
              .pad(pins.length === 2 ? -0.1 : -0.15)
              .contains(ll),
          );
    const action = nextCameraAction({
      owner,
      pinCount: pins.length,
      fitted: markersFittedRef.current,
      inView,
    });
    if (action === "fit-pins") {
      if (framePins(!prefersReducedMotion())) markersFittedRef.current = true;
    } else if (action === "follow-pin") {
      const target = owner === "self" ? selfRef.current?.point : pins[0].point;
      if (target) followPin(target);
    } else if (action === "default") {
      runCameraMove((m) =>
        m.setView([-6.2, 106.816], 14, { animate: !prefersReducedMotion() }),
      );
    }
  }, [self, partner, view, route, framePins, followPin, runCameraMove]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      requestAnimationFrame(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
          setTimeout(() => mapRef.current?.invalidateSize(), 300);
          setTimeout(() => mapRef.current?.invalidateSize(), 700);
        }
      });
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const selfAddressKey = self?.point
    ? `${self.point.lat.toFixed(4)},${self.point.lng.toFixed(4)}`
    : null;
  const partnerAddressKey = partner?.point
    ? `${partner.point.lat.toFixed(4)},${partner.point.lng.toFixed(4)}`
    : null;
  const selfAddress = selfAddressKey ? addressCache[selfAddressKey] : null;
  const partnerAddress = partnerAddressKey
    ? addressCache[partnerAddressKey]
    : null;

  return (
    <div
      className={`
        isolate relative z-0 w-full max-w-full scroll-mt-20 rounded-2xl border border-border overflow-hidden
        ${
          isFullscreen
            ? "fixed inset-0 z-[9999] rounded-none border-0 bg-background"
            : "h-[46vh] min-h-[320px] sm:h-[420px] md:h-[480px] lg:h-[540px] xl:h-[560px]"
        }
        transition-[border,border-radius] duration-300
      `}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label="Peta lokasi pasangan"
        className="h-full w-full min-h-[280px] sm:min-h-[420px]"
        style={{
          background: "var(--background, #eef2f7)",
        }}
      />
      <ul className="sr-only">
        {self?.point && (
          <li>
            {self.label}: {self.point.lat.toFixed(6)}, {self.point.lng.toFixed(6)}
          </li>
        )}
        {partner?.point && (
          <li>
            {partner.label}: {partner.point.lat.toFixed(6)}, {partner.point.lng.toFixed(6)}
          </li>
        )}
      </ul>

      {showHistory && (
        <div className="absolute left-3 top-3 z-[1001] flex items-center gap-1.5 rounded-full bg-background/75 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Riwayat lokasi
        </div>
      )}

      {/* Partner colors: dashed = history, solid = live route. */}
      {showHistory && view && (view.self.segments.length > 0 || view.partner.segments.length > 0) && (
        <div className="pointer-events-none absolute left-3 top-12 z-[1001] space-y-1 rounded-lg bg-background/85 px-2.5 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: HISTORY_USER_COLORS.self }} aria-hidden="true" />
            Kamu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: HISTORY_USER_COLORS.partner }} aria-hidden="true" />
            {partner?.label ?? "Pasangan"}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0 w-5 border-t-2"
              style={{
                borderColor: shouldUseRoadRoute(route) ? ROAD_ROUTE_COLOR : STRAIGHT_ROUTE_COLOR,
              }}
              aria-hidden="true"
            />
            Rute
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-900 text-[9px] font-bold text-white shadow-sm" aria-hidden="true">
              2
            </span>
            Kunjungan
          </span>
        </div>
      )}

      {/* Bottom info bar. right-16 clears the 44px Leaflet control column
          (.leaflet-bar a is forced to 44px + 10px corner margin); bottom-8
          clears the scale control at bottom-left on every breakpoint. */}
      <div className="absolute bottom-8 left-1.5 right-12 z-[1001] sm:bottom-8 sm:left-2 sm:right-16">
        <div className="mx-auto flex w-fit max-w-[calc(100%-0.5rem)] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full bg-background/95 px-3 py-1.5 text-center text-[10px] shadow-md backdrop-blur-sm sm:px-4 sm:text-xs text-muted-foreground">
          {self?.point && (
            <>
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: HISTORY_USER_COLORS.self }}
                  aria-hidden="true"
                />
                {self.label}
              </span>
              {selfAddress && (
                <span className="hidden sm:inline text-muted-foreground/60 truncate max-w-[120px]">
                  · {selfAddress}
                </span>
              )}
            </>
          )}
          {partner?.point && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" aria-hidden="true" /> {partner.label}
              </span>
              {partnerAddress && (
                <span className="hidden sm:inline text-muted-foreground/60 truncate max-w-[120px]">
                  · {partnerAddress}
                </span>
              )}
            </>
          )}
          {self?.point && partner?.point && (() => {
            const roadRoute = shouldUseRoadRoute(route);
            const modeColor = roadRoute ? ROAD_ROUTE_COLOR : STRAIGHT_ROUTE_COLOR;
            const straightMeters = haversineMeters(
              { latitude: self.point.lat, longitude: self.point.lng },
              { latitude: partner.point.lat, longitude: partner.point.lng },
            );
            return (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1 font-medium" style={{ color: modeColor }}>
                  <Ruler className="h-3 w-3" aria-hidden="true" />{" "}
                  {formatDistance(effectiveDistance(roadRoute, straightMeters))}
                </span>
              </>
            );
          })()}
          {self?.point?.accuracy && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>±{Math.round(self.point.accuracy)}m</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
