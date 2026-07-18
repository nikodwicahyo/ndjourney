"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { useSession } from "next-auth/react";
import {
  formatDistance,
  bearing,
  formatBearing,
  formatBearingId,
  haversineMeters,
} from "@/lib/geo";

import type { LocationPoint, LocationHistoryPoint } from "@/hooks/useLocation";

type Pin = {
  id: string;
  label: string;
  point: LocationPoint;
  isSelf: boolean;
  image: string | null;
  deviceType?: string | null;
};

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const FALLBACK_TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const NOMINATIM_CACHE = new Map<string, string>();
const NOMINATIM_CACHE_MAX = 50;

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = NOMINATIM_CACHE.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&accept-language=id`,
      { headers: { "User-Agent": "NdJourney/1.0" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const display =
      data?.address?.road ||
      data?.address?.suburb ||
      data?.address?.quarter ||
      data?.address?.city_district ||
      data?.display_name?.split(",")?.[0] ||
      null;
    if (display) {
      if (NOMINATIM_CACHE.size >= NOMINATIM_CACHE_MAX) {
        const firstKey = NOMINATIM_CACHE.keys().next().value;
        if (firstKey) NOMINATIM_CACHE.delete(firstKey);
      }
      NOMINATIM_CACHE.set(key, display);
    }
    return display;
  } catch {
    return null;
  }
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
): L.DivIcon {
  const fallback = isSelf ? "💙" : "💖";
  const ring = isSelf ? "#3b82f6" : "#F43F5E";
  const bg = "#fff";
  const shadow = "0 2px 6px rgba(0,0,0,.35)";

  const inner = image
    ? `<img src="${image}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:3px solid ${ring};box-shadow:${shadow};background:${bg};transition:transform 0.3s ease;" />`
    : `<div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;background:${bg};border:3px solid ${ring};box-shadow:${shadow};">${fallback}</div>`;

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
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};opacity:0.2;animation:leaflet-pulse 1.5s ease-in-out infinite;" />`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createBearingArrow(heading: number, isSelf: boolean): L.DivIcon {
  const color = isSelf ? "#3b82f6" : "#F43F5E";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;transform:rotate(${heading}deg);font-size:14px;line-height:1;opacity:0.7;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));">${isSelf ? "▲" : "△"}</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 14],
  });
}

export default function PartnerMap({
  self,
  partner,
  history,
  showHistory = false,
}: {
  self: Pin | null;
  partner: Pin | null;
  history?: LocationHistoryPoint[];
  showHistory?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
  const markersFittedRef = useRef(false);

  const [addressCache, setAddressCache] = useState<
    Record<string, string | null>
  >({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    [self, partner].forEach((p) => {
      if (!p?.point) return;
      const key = `${p.point.lat.toFixed(4)},${p.point.lng.toFixed(4)}`;
      if (!(key in addressCache)) {
        reverseGeocode(p.point.lat, p.point.lng).then((addr) => {
          if (addr)
            setAddressCache((prev) => ({ ...prev, [key]: addr }));
        });
      }
    });
  }, [self?.point?.lat, self?.point?.lng, partner?.point?.lat, partner?.point?.lng]);

  // ponytail: triple-fallback leaflet CSS — import in globals.css + LocationManager.tsx + inline here
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const container = containerRef.current;

    // Fallback: inject leaflet CSS if missing (production builds sometimes drop CSS imports)
    if (!document.querySelector('[data-leaflet-css]')) {
      if (typeof window !== "undefined") console.log("[PartnerMap] injecting fallback leaflet CSS");
      const style = document.createElement("style");
      style.setAttribute("data-leaflet-css", "");
      style.textContent = `
.leaflet-container{background:#ddd;outline:0;overflow:hidden}
.leaflet-container .leaflet-overlay-pane,.leaflet-container .leaflet-marker-pane,.leaflet-container .leaflet-shadow-pane,.leaflet-container .leaflet-tile-pane,.leaflet-container .leaflet-popup-pane{position:absolute;left:0;top:0}
.leaflet-container img.leaflet-tile{max-width:none!important}
.leaflet-tile{filter:inherit;visibility:hidden}
.leaflet-tile-loaded{visibility:inherit}
.leaflet-zoom-box{width:0;height:0}
.leaflet-control{position:relative;z-index:800;float:left;clear:both;pointer-events:auto}
.leaflet-top{top:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-right{right:0}
.leaflet-fade-anim .leaflet-tile{will-change:opacity;transition:opacity .2s}
.leaflet-fade-anim .leaflet-popup{opacity:0;transition:opacity .2s}
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup{opacity:1}
`;
      document.head.appendChild(style);
    }

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      container.style.minHeight = "420px";
    }

    const center =
      self?.point ?? partner?.point ?? { lat: -6.2, lng: 106.816 };

    let map: L.Map;
    try {
      map = L.map(container, {
        center: [center.lat, center.lng],
        zoom: 15,
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
        maxZoom: 20,
        minZoom: 2,
        subdomains: "abcd",
        attribution: TILE_ATTR,
        detectRetina: false,
      }).addTo(map);
    } catch (err) {
      console.error("[PartnerMap] tileLayer failed:", err);
      return;
    }
    tileLayerRef.current = tile;

    try {
      accuracyLayerRef.current = L.layerGroup().addTo(map);
      historyLayerRef.current = L.layerGroup().addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      headingLayerRef.current = L.layerGroup().addTo(map);
    } catch (err) {
      console.error("[PartnerMap] layerGroup failed:", err);
      return;
    }

    L.control
      .scale({
        position: "bottomleft",
        metric: true,
        imperial: false,
        maxWidth: 120,
      })
      .addTo(map);

    const scaleStyle = document.createElement("style");
    scaleStyle.textContent = `
.leaflet-control-scale{max-width:none!important;width:fit-content!important}
.leaflet-control-scale-line{background:#fff!important;border:1px solid #ccc!important;border-top:none!important;color:#333!important;padding:0 6px 1px!important;font-size:11px!important;font-weight:500!important;width:fit-content!important;text-shadow:none!important;box-shadow:none!important}
@keyframes leaflet-line-dash{to{stroke-dashoffset:-24}}
.leaflet-connecting-line{animation:leaflet-line-dash 1.5s linear infinite}
@keyframes leaflet-pulse{0%{transform:scale(1);opacity:.2}50%{transform:scale(2);opacity:0}100%{transform:scale(1);opacity:.2}}
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
      btn.style.cssText = [
        "width:30px",
        "height:35px",
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

    function zoomBtn(label: string, action: () => void): HTMLAnchorElement {
      const btn = makeControlBtn(label, "", action);
      btn.style.fontSize = "18px";
      btn.style.fontWeight = "bold";
      btn.style.lineHeight = "35px";
      return btn;
    }

    const zoomBar = L.DomUtil.create("div");
    zoomBar.className = "leaflet-control-zoom leaflet-bar";
    zoomBar.appendChild(zoomBtn("+", () => map.zoomIn()));
    zoomBar.appendChild(zoomBtn("−", () => map.zoomOut()));
    const ZoomCtrl = L.Control.extend({ onAdd: () => zoomBar });
    new ZoomCtrl({ position: "bottomright" }).addTo(map);

    const actionBar = L.DomUtil.create("div");
    actionBar.className = "leaflet-control-zoom leaflet-bar";
    actionBar.appendChild(
      makeControlBtn(
        `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
        "Pusatkan ke lokasi saya",
        () => {
          const currentSelf = selfRef.current;
          if (currentSelf?.point) {
            map.flyTo([currentSelf.point.lat, currentSelf.point.lng], 17, {
              duration: 1.2,
              easeLinearity: 0.3,
            });
          } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                map.flyTo([pos.coords.latitude, pos.coords.longitude], 17, {
                  duration: 1.2,
                  easeLinearity: 0.3,
                });
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
          if (selfRef.current?.point && partnerRef.current?.point) {
            map.fitBounds(
              L.latLngBounds([
                [selfRef.current.point.lat, selfRef.current.point.lng],
                [partnerRef.current.point.lat, partnerRef.current.point.lng],
              ]),
              { padding: [80, 80], maxZoom: 16, animate: true, duration: 1.2 },
            );
          } else if (selfRef.current?.point) {
            map.flyTo([selfRef.current.point.lat, selfRef.current.point.lng], 16, { duration: 1.2 });
          } else if (partnerRef.current?.point) {
            map.flyTo([partnerRef.current.point.lat, partnerRef.current.point.lng], 16, { duration: 1.2 });
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

    let tileErrors = 0;
    let tileRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let useFallback = false;
    let fallbackPinned = false;

    function switchTileLayer(url: string, attr: string) {
      if (!mapRef.current || !tileLayerRef.current) return;
      console.warn("[PartnerMap] switching tiles to", url.replace(/\{.*\}/, "…"));
      mapRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = L.tileLayer(url, {
        maxZoom: 20,
        minZoom: 2,
        subdomains: "abcd",
        attribution: attr,
        detectRetina: false,
      }).addTo(mapRef.current);
    }

    tile.on("tileerror", (e: unknown) => {
      tileErrors++;
      const err = e as { tile?: HTMLImageElement; url?: string };
      if (tileErrors <= 3) console.warn("[PartnerMap] tileerror #" + tileErrors, err?.url || "(no url)", err?.tile?.src?.slice(0, 80) || "");

      // ponytail: pin to fallback once switched — don't flip-flop back to primary
      if (tileErrors >= 3 && !tileRecoveryTimer && !fallbackPinned) {
        tileRecoveryTimer = setTimeout(() => {
          tileRecoveryTimer = null;
          if (useFallback) return; // already on fallback, don't retoggle
          useFallback = true;
          fallbackPinned = true;
          switchTileLayer(FALLBACK_TILE_URL, FALLBACK_TILE_ATTR);
        }, 3000);
      }
    });

    function recoverTiles() {
      if (tileRecoveryTimer || !mapRef.current || fallbackPinned) return;
      tileErrors = 3;
      mapRef.current.invalidateSize({ debounceMoveend: true });
      tileRecoveryTimer = setTimeout(() => {
        tileRecoveryTimer = null;
        if (useFallback) return;
        useFallback = true;
        fallbackPinned = true;
        switchTileLayer(FALLBACK_TILE_URL, FALLBACK_TILE_ATTR);
      }, 500);
    }

    const tileCheckTimer = setTimeout(() => {
      if (!mapRef.current) return;
      const tileContainer = mapRef.current.getContainer();
      const loadedTiles = tileContainer.querySelectorAll(".leaflet-tile-loaded");
      if (loadedTiles.length === 0 && mapRef.current.getSize().x > 0 && mapRef.current.getSize().y > 0) {
        recoverTiles();
      }
    }, 4000);

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
      if (tileRecoveryTimer) clearTimeout(tileRecoveryTimer);
      clearTimeout(tileCheckTimer);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update history trail — with fitBounds to show trail + markers when ON,
  // and re-fit to markers when OFF
  useEffect(() => {
    const map = mapRef.current;
    const hLayerUntyped = historyLayerRef.current;
    if (!map || !hLayerUntyped) return;
    const hLayer: L.LayerGroup = hLayerUntyped;

    hLayer.clearLayers();

    const pins = [self, partner].filter(Boolean) as Pin[];
    const markerLatLngs = pins.map(
      (p) => [p.point.lat, p.point.lng] as L.LatLngExpression,
    );

    const fitMarkerBounds = () => {
      if (markersFittedRef.current) return;
      if (pins.length === 2) {
        map.fitBounds(L.latLngBounds(markerLatLngs), {
          padding: [80, 80],
          maxZoom: 16,
          animate: true,
        });
        markersFittedRef.current = true;
      } else if (pins.length === 1) {
        map.setView(markerLatLngs[0], 16, { animate: true });
        markersFittedRef.current = true;
      }
    };

    if (!showHistory) {
      historyFittedRef.current = false;
      fitMarkerBounds();
      return;
    }
    if (!history || history.length === 0) {
      fitMarkerBounds();
      return;
    }

    const selfId = session?.user?.id;
    if (!selfId) { fitMarkerBounds(); return; }

    const sorted = [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const selfHistory = sorted.filter((h) => h.userId === selfId);
    const partnerHistory = sorted.filter((h) => h.userId !== selfId);

    const allTrailLatLngs: L.LatLngExpression[] = [];

    function addTrail(
      points: LocationHistoryPoint[],
      color: string,
      layer: L.LayerGroup,
    ) {
      if (points.length === 0) return;
      const latlngs = points.map(
        (p) => [p.latitude, p.longitude] as L.LatLngExpression,
      );
      allTrailLatLngs.push(...latlngs);

      if (points.length >= 2) {
        L.polyline(latlngs, {
          color,
          weight: 4,
          opacity: 0.6,
        }).addTo(layer);
      }

      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        L.circleMarker([p.latitude, p.longitude] as L.LatLngTuple, {
          radius: isLast ? 14 : 9,
          color,
          fillColor: color,
          fillOpacity: 0.4,
          weight: 2.5,
          opacity: 0.7,
          interactive: false,
        }).addTo(layer);
      });
    }

    addTrail(selfHistory, "#3b82f6", hLayer);
    addTrail(partnerHistory, "#F43F5E", hLayer);

    if (allTrailLatLngs.length === 0) {
      fitMarkerBounds();
      historyFittedRef.current = false;
      return;
    }
    const bounds = L.latLngBounds(allTrailLatLngs);
    if (markerLatLngs.length > 0) {
      markerLatLngs.forEach((ll) => bounds.extend(ll));
    }
    if (!historyFittedRef.current) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16, animate: true });
      historyFittedRef.current = true;
    }
  }, [history, showHistory, session?.user?.id, self, partner]);

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
      }).addTo(markerLayer);

      // Main avatar marker
      const marker = L.marker(latlng, {
        icon: createAvatarIcon(p.image, p.isSelf),
      }).addTo(markerLayer);

      // Bearing/heading arrow
      if (p.point.heading !== null && p.point.heading >= 0) {
        L.marker(latlng, {
          icon: createBearingArrow(p.point.heading, p.isSelf),
          interactive: false,
          zIndexOffset: 1000,
        })
          .addTo(headingLayer)
          .setLatLng([
            p.point.lat + 0.0002,
            p.point.lng,
          ]);
      }

      const addrKey = `${p.point.lat.toFixed(4)},${p.point.lng.toFixed(4)}`;
      const address = addressCache[addrKey];

      const deviceInfo = p.deviceType
        ? `<span style="font-size:11px;opacity:0.7;">${p.deviceType}</span>`
        : "";
      const accuracyInfo = p.point.accuracy
        ? `<div style="font-size:11px;margin-top:2px;">±${Math.round(p.point.accuracy)}m · ${accuracyLabel(p.point.accuracy)}</div>`
        : "";
      const timeInfo = p.point.updatedAt
        ? `<div style="font-size:11px;opacity:0.6;margin-top:2px;">${timeAgo(p.point.updatedAt)}</div>`
        : "";
      const addressInfo = address
        ? `<div style="font-size:11px;margin-top:2px;color:#64748b;">📍 ${address}</div>`
        : "";
      const headingInfo =
        p.point.heading !== null && p.point.heading >= 0
          ? `<div style="font-size:11px;margin-top:2px;opacity:0.6;">🧭 ${formatBearing(p.point.heading)}</div>`
          : "";
      const speedInfo =
        p.point.speed !== null && p.point.speed >= 0
          ? `<div style="font-size:11px;margin-top:2px;opacity:0.6;">⚡ ${(p.point.speed * 3.6).toFixed(1)} km/j</div>`
          : "";

      const avatarHtml = p.image
        ? `<img src="${p.image}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
        : `<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:#f1f5f9;">${p.isSelf ? "💙" : "💖"}</div>`;

      marker.bindPopup(
        `
        <div style="min-width:180px;font-family:system-ui,sans-serif;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            ${avatarHtml}
            <div>
              <div style="font-weight:600;font-size:14px;">${p.label}</div>
              ${deviceInfo}
            </div>
          </div>
          ${addressInfo}
          ${accuracyInfo}
          ${headingInfo}
          ${speedInfo}
          ${timeInfo}
          <div style="font-size:10px;opacity:0.4;margin-top:4px;border-top:1px solid #e2e8f0;padding-top:4px;">
            ${p.point.lat.toFixed(6)}, ${p.point.lng.toFixed(6)}
          </div>
        </div>
      `,
      );
    });

    // Connecting line + distance + ETA
    if (pins.length >= 1) {
      map.invalidateSize({ debounceMoveend: true });
    }

    if (pins.length === 2) {
      lineRef.current = L.polyline(latlngs, {
        color: "#F43F5E",
        weight: 3,
        dashArray: "12 12",
        opacity: 0.7,
        className: "leaflet-connecting-line",
      }).addTo(markerLayer);

      const mid = L.latLngBounds(latlngs).getCenter();
      const distMeters = haversineMeters(
        { latitude: pins[0].point.lat, longitude: pins[0].point.lng },
        { latitude: pins[1].point.lat, longitude: pins[1].point.lng },
      );
      const distLabel = formatDistance(distMeters);
      const bearingDeg = bearing(
        { latitude: pins[0].point.lat, longitude: pins[0].point.lng },
        { latitude: pins[1].point.lat, longitude: pins[1].point.lng },
      );
      distanceLabelRef.current = L.marker(mid, {
        icon: L.divIcon({
          className: "",
          html: `<div style="color:#be185d;font-size:18px;font-weight:800;white-space:nowrap;display:flex;align-items:center;gap:6px;text-shadow:0 1px 4px rgba(255,255,255,0.9),0 1px 6px rgba(244,63,94,0.15);"><span style="font-size:16px;line-height:1;">❤️</span><span>${distLabel}</span></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
      }).addTo(markerLayer);

      const bearingId = bearingDeg !== null ? formatBearingId(bearingDeg) : "";

      if (!markersFittedRef.current) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [80, 80], maxZoom: 16, animate: true });
        markersFittedRef.current = true;
      }
    } else if (pins.length === 1) {
      if (!markersFittedRef.current) {
        map.setView([pins[0].point.lat, pins[0].point.lng], 16, {
          animate: true,
        });
        markersFittedRef.current = true;
      }
    } else if (!markersFittedRef.current) {
      // No pins, show default view (once)
      map.setView([-6.2, 106.816], 14, { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self, partner, addressCache]);

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
        relative w-full rounded-2xl border border-border overflow-hidden
        ${
          isFullscreen
            ? "fixed inset-0 z-[9999] rounded-none border-0"
            : "h-[420px] sm:h-[560px]"
        }
        transition-[border,border-radius] duration-300
      `}
    >
      <div
        ref={containerRef}
        className="h-full w-full min-h-[420px]"
        style={{
          background: "#eef2f7",
        }}
      />

      {showHistory && (
        <div className="absolute left-3 top-3 z-[1001] rounded-full bg-background/75 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          🗺️ Riwayat lokasi
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-6 left-2 right-2 z-[1001]">
        <div className="mx-auto flex max-w-max flex-wrap items-center gap-2 rounded-full bg-background/80 px-4 py-1.5 shadow-sm backdrop-blur-sm text-xs text-muted-foreground">
          {self?.point && (
            <>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
                💖 {partner.label}
              </span>
              {partnerAddress && (
                <span className="hidden sm:inline text-muted-foreground/60 truncate max-w-[120px]">
                  · {partnerAddress}
                </span>
              )}
            </>
          )}
          {self?.point && partner?.point && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1">
                📏{" "}
                {formatDistance(
                  haversineMeters(
                    {
                      latitude: self.point.lat,
                      longitude: self.point.lng,
                    },
                    {
                      latitude: partner.point.lat,
                      longitude: partner.point.lng,
                    },
                  ),
                )}
              </span>
            </>
          )}
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
