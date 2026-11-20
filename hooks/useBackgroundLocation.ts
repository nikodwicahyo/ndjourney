"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { detectDeviceType } from "@/lib/device";
import { haversineMeters } from "@/lib/geo";
import { shouldPost } from "@/lib/location/gate";
import { flushOutbox, postFix, beaconFix } from "@/lib/location/sender";
import { outbox } from "@/lib/location/outbox";
import { newClientId } from "@/lib/location/client-id";
import { isNativePlatform } from "@/lib/location/platform";
import type { LocationFix, TrackingState } from "@/lib/location/types";

export type ShareStatus =
  | "idle"
  | "locating"
  | "sharing"
  | "denied"
  | "unsupported"
  | "recovering"
  | "gps-error";

/** Fast recovery while there is no fix at all. */
const GPS_PING_INTERVAL = 12_000;
/** While the phone is clearly moving. */
const GPS_PING_MOVING = 10_000;
/** Stationary, or a hidden tab (the browser throttles timers anyway). */
const GPS_PING_IDLE = 60_000;
/** How long after real movement we keep the fast cadence. */
const MOVING_WINDOW_MS = 120_000;
/** Never post faster than this, even while walking. */
const MIN_POST_INTERVAL_MS = 8_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;
const GPS_ERROR_THRESHOLD = 3;
const MOVE_THRESHOLD_METERS = 5;

type QueryClient = ReturnType<typeof useQueryClient>;

let globalWatchId: number | null = null;
const globalStatusListeners: Set<(status: ShareStatus) => void> = new Set();
let globalStatus: ShareStatus = "idle";
let globalLastFix: LocationFix | null = null;
let globalLastPostAt = 0;
let globalLastMoveAt = 0;
let globalRetryCount = 0;
let globalPingTimer: ReturnType<typeof setTimeout> | null = null;
let globalHeartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let globalGpsFailCount = 0;
let globalRetryTimers: Set<ReturnType<typeof setTimeout>> = new Set();
let globalWakeHandlers: {
  visibility: () => void;
  online: () => void;
  pageHide: () => void;
  pageShow: () => void;
  freeze: () => void;
  resume: () => void;
} | null = null;
let globalBatteryLow = false;
let globalPermissionStatus: PermissionStatus | null = null;
let globalPermissionHandler: (() => void) | null = null;
/** `-1` marks a native watcher; web watch ids are non-negative. */
let globalEngineGeneration = 0;
let globalNativeState: TrackingState | null = null;

function setGlobalStatus(status: ShareStatus) {
  if (globalStatus === status) return;
  globalStatus = status;
  globalStatusListeners.forEach((fn) => fn(status));
}

function noteGpsSuccess() {
  globalGpsFailCount = 0;
}

function noteGpsError() {
  globalGpsFailCount++;
  if (globalGpsFailCount >= GPS_ERROR_THRESHOLD) setGlobalStatus("gps-error");
  else setGlobalStatus("recovering");
}

function scheduleRetry(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    globalRetryTimers.delete(t);
    fn();
  }, ms);
  globalRetryTimers.add(t);
}

function clearRetries() {
  for (const t of globalRetryTimers) clearTimeout(t);
  globalRetryTimers.clear();
}

function currentTrackingState(): TrackingState {
  // In the native shell the OS app state is the truth: the WebView document
  // can still report "visible" while the app is in the background.
  if (globalNativeState) return globalNativeState;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return "hidden";
  }
  if (globalBatteryLow) return "battery-saver";
  return "foreground";
}

function makeFix(pos: GeolocationPosition): LocationFix {
  return {
    clientId: newClientId(),
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
    heading: pos.coords.heading ?? null,
    speed: pos.coords.speed ?? null,
    altitude: pos.coords.altitude ?? null,
    deviceType: detectDeviceType(),
    recordedAt: new Date(pos.timestamp || Date.now()).toISOString(),
    trackingState: currentTrackingState(),
    source: "web",
  };
}

function movedEnough(prev: LocationFix | null, next: LocationFix): boolean {
  if (!prev) return true;
  return (
    haversineMeters(
      { latitude: prev.latitude, longitude: prev.longitude },
      { latitude: next.latitude, longitude: next.longitude },
    ) >= MOVE_THRESHOLD_METERS
  );
}

/**
 * Heartbeat without coordinates. This is what lets the partner's UI say
 * "app is open but GPS has no fix" instead of a generic "Offline".
 */
function sendHeartbeat(state: TrackingState = currentTrackingState()) {
  void fetch("/api/location/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingState: state }),
    keepalive: true,
    credentials: "same-origin",
  })
    .then((res) => {
      if (res.status === 403) setGlobalStatus("idle");
    })
    .catch(() => {
      /* a missed heartbeat is harmless: the next one is 30 s away */
    });
}

function scheduleHeartbeat() {
  if (globalHeartbeatTimer) clearTimeout(globalHeartbeatTimer);
  globalHeartbeatTimer = setTimeout(() => {
    sendHeartbeat();
    scheduleHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

function nextPingDelay(): number {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return GPS_PING_IDLE;
  }
  if (!globalLastFix) return GPS_PING_INTERVAL;
  if (Date.now() - globalLastMoveAt < MOVING_WINDOW_MS) return GPS_PING_MOVING;
  return GPS_PING_IDLE;
}

function scheduleGpsPing(qc: QueryClient) {
  if (globalPingTimer) clearTimeout(globalPingTimer);
  globalPingTimer = setTimeout(() => {
    pingGps(qc);
    scheduleGpsPing(qc);
  }, nextPingDelay());
}

function handleFix(pos: GeolocationPosition, qc: QueryClient, force = false) {
  handleExternalFix(makeFix(pos), qc, force);
}

/** Shared post path for web and native fixes: gate, outbox, status, retry. */
export function handleExternalFix(fix: LocationFix, qc: QueryClient, force = false) {
  noteGpsSuccess();

  if (movedEnough(globalLastFix, fix)) globalLastMoveAt = Date.now();

  const now = Date.now();
  const withinMinInterval = now - globalLastPostAt < MIN_POST_INTERVAL_MS;
  if (!force && withinMinInterval) return;
  if (!force && !shouldPost(globalLastFix, fix, now)) return;

  globalLastFix = fix;
  globalLastPostAt = now;
  setGlobalStatus("sharing");

  void postFix(fix).then((result) => {
    if (result === "ok") {
      globalRetryCount = 0;
      qc.invalidateQueries({ queryKey: queryKeys.location.all });
    } else if (result === "drop") {
      // The server refuses this fix (sharing off / expired): stop pretending.
      setGlobalStatus("idle");
    } else if (globalRetryCount < MAX_RETRIES) {
      globalRetryCount++;
      scheduleRetry(() => void flushOutbox(), 1000 * globalRetryCount);
      setGlobalStatus("recovering");
    } else {
      setGlobalStatus("recovering");
    }
  });
}

function pingGps(qc: QueryClient, force = false) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => handleFix(pos, qc, force),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) setGlobalStatus("denied");
      else noteGpsError();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
  );
}

async function watchBattery() {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, fn: () => void) => void }>;
  };
  if (typeof nav.getBattery !== "function") return;
  try {
    const battery = await nav.getBattery();
    const update = () => {
      globalBatteryLow = battery.level < 0.2 && !battery.charging;
    };
    update();
    battery.addEventListener("levelchange", update);
    battery.addEventListener("chargingchange", update);
  } catch {
    /* battery API is best-effort */
  }
}

async function watchPermission() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    globalPermissionStatus = status;
    const handler = () => {
      if (status.state === "denied") setGlobalStatus("denied");
      else if (status.state === "granted" && globalStatus === "denied") {
        setGlobalStatus(globalLastFix ? "sharing" : "locating");
      }
    };
    globalPermissionHandler = handler;
    status.addEventListener("change", handler);
  } catch {
    /* Safari < 16 has no geolocation permission query */
  }
}

/** OS-level engine state -> the status the partner UI can explain. */
export function handleNativeState(state: TrackingState | "gps-error") {
  globalNativeState = state === "gps-error" || state === "stopped" ? null : state;
  if (state === "denied") setGlobalStatus("denied");
  else if (state === "gps-error") setGlobalStatus("gps-error");
  else if (state === "stopped") setGlobalStatus("idle");
  else if (
    globalStatus === "idle" ||
    globalStatus === "denied" ||
    globalStatus === "recovering" ||
    globalStatus === "gps-error"
  ) {
    setGlobalStatus("locating");
  }
}

function startNativeWatching(qc: QueryClient) {
  const generation = globalEngineGeneration;
  globalWatchId = -1;
  setGlobalStatus("locating");

  void import("@/lib/location/engine-native")
    .then(({ startNativeEngine }) => {
      // A stop (or a second start) may have happened while the chunk loaded.
      if (generation !== globalEngineGeneration) return;
      return startNativeEngine({
        onFix: (fix) => handleExternalFix(fix, qc),
        onState: handleNativeState,
      });
    })
    .catch(() => setGlobalStatus("unsupported"));

  // Coordinate-free heartbeats keep `lastSeenAt` honest when GPS is quiet.
  scheduleHeartbeat();
}

function startWatching(qc: QueryClient) {
  if (globalWatchId !== null) return;
  globalEngineGeneration++;
  if (isNativePlatform()) {
    startNativeWatching(qc);
    return;
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    setGlobalStatus("unsupported");
    return;
  }

  setGlobalStatus("locating");

  navigator.geolocation.getCurrentPosition(
    (pos) => handleFix(pos, qc),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) setGlobalStatus("denied");
      else noteGpsError();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  );

  globalWatchId = navigator.geolocation.watchPosition(
    (pos) => handleFix(pos, qc),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGlobalStatus("denied");
        return;
      }
      noteGpsError();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  );

  scheduleGpsPing(qc);
  scheduleHeartbeat();
  void watchBattery();
  void watchPermission();

  const visibility = () => {
    if (document.visibilityState === "visible") {
      // Returning to the tab: prove the GPS is back now, not on the next tick.
      pingGps(qc, true);
      void flushOutbox();
      scheduleGpsPing(qc);
      scheduleHeartbeat();
    } else {
      // Going hidden: the tab may be frozen at any moment. Persist what we
      // have and tell the partner the app is still alive.
      sendHeartbeat("hidden");
      void flushOutbox();
    }
  };

  const online = () => {
    void flushOutbox();
    pingGps(qc, true);
  };

  const pageHide = () => {
    if (globalLastFix) beaconFix(globalLastFix);
    void flushOutbox();
  };

  const pageShow = () => {
    void flushOutbox();
    pingGps(qc, true);
  };

  const freeze = () => {
    sendHeartbeat("hidden");
    void flushOutbox();
  };

  const resume = () => {
    void flushOutbox();
    pingGps(qc, true);
  };

  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("online", online);
  window.addEventListener("pagehide", pageHide);
  window.addEventListener("pageshow", pageShow);
  // Chrome-only Page Lifecycle events; harmless everywhere else.
  document.addEventListener("freeze", freeze);
  document.addEventListener("resume", resume);

  globalWakeHandlers = { visibility, online, pageHide, pageShow, freeze, resume };
}

function stopWatching() {
  globalEngineGeneration++;
  if (globalWatchId === -1) {
    globalWatchId = null;
    globalNativeState = null;
    void import("@/lib/location/engine-native").then((m) => m.stopNativeEngine());
  } else if (globalWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(globalWatchId);
    globalWatchId = null;
  }
  if (globalPingTimer) {
    clearTimeout(globalPingTimer);
    globalPingTimer = null;
  }
  if (globalHeartbeatTimer) {
    clearTimeout(globalHeartbeatTimer);
    globalHeartbeatTimer = null;
  }
  if (globalWakeHandlers) {
    document.removeEventListener("visibilitychange", globalWakeHandlers.visibility);
    window.removeEventListener("online", globalWakeHandlers.online);
    window.removeEventListener("pagehide", globalWakeHandlers.pageHide);
    window.removeEventListener("pageshow", globalWakeHandlers.pageShow);
    document.removeEventListener("freeze", globalWakeHandlers.freeze);
    document.removeEventListener("resume", globalWakeHandlers.resume);
    globalWakeHandlers = null;
  }
  if (globalPermissionStatus && globalPermissionHandler) {
    globalPermissionStatus.removeEventListener("change", globalPermissionHandler);
    globalPermissionStatus = null;
    globalPermissionHandler = null;
  }
  clearRetries();
  globalRetryCount = 0;
  globalGpsFailCount = 0;
  globalLastFix = null;
  globalLastPostAt = 0;
  globalLastMoveAt = 0;
  setGlobalStatus("idle");
}

export function initBackgroundLocation(enabled: boolean, qc: QueryClient) {
  if (enabled) startWatching(qc);
  else stopWatching();
}

/** Manual retry for the "gps-error" state. */
export function retrySharing(qc: QueryClient) {
  globalGpsFailCount = 0;
  setGlobalStatus("locating");
  if (isNativePlatform()) {
    const generation = ++globalEngineGeneration;
    void import("@/lib/location/engine-native")
      .then(async (m) => {
        if (generation !== globalEngineGeneration) return;
        await m.stopNativeEngine();
        if (generation !== globalEngineGeneration) return;
        globalWatchId = null;
        startNativeWatching(qc);
      })
      .catch(() => setGlobalStatus("unsupported"));
    return;
  }
  pingGps(qc, true);
}

function subscribeStatus(listener: () => void) {
  globalStatusListeners.add(listener);
  return () => {
    globalStatusListeners.delete(listener);
  };
}

function getStatusSnapshot() {
  return globalStatus;
}

// Server/hydration value: no watcher exists until a client effect starts one,
// so "idle" is the truthful snapshot. Without it React throws during SSR.
function getServerStatusSnapshot(): ShareStatus {
  return "idle";
}

export function useBackgroundLocationStatus(): ShareStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getServerStatusSnapshot);
}

/** Number of fixes waiting for the network, for the "N titik menunggu" chip. */
export function useQueuedFixCount(pollMs = 10_000) {
  const [count, setCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const read = () => {
      void outbox
        .count()
        .then((n) => {
          if (mounted.current) setCount(n);
        })
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [pollMs]);

  return count;
}

/** Drop queued coordinates when sharing is turned off or the user logs out. */
export async function clearQueuedFixes(): Promise<void> {
  try {
    await outbox.clear();
  } catch {
    /* nothing to clear */
  }
}
