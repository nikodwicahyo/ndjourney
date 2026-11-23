"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { detectDeviceType } from "@/lib/device";
import {
  deriveMotion,
  isOutlier,
  isValidFix,
  normalizeRecordedAt,
  shouldPost,
  type LocationFix,
  type PostedFix,
} from "@/lib/location";
import {
  clearUser,
  enqueueFix,
  peekFixes,
  purgeOtherUsers,
  removeFixes,
} from "@/lib/location-outbox";
import type { LocationState } from "./useLocation";

export type ShareStatus =
  | "idle"
  | "locating"
  | "sharing"
  | "denied"
  | "unsupported"
  | "recovering"
  | "gps-error";

export type WakeLockStatus = "idle" | "active" | "hidden" | "unsupported" | "denied";

type QueryClient = ReturnType<typeof useQueryClient>;

const GPS_WATCH_TIMEOUT_MS = 15_000;
const GPS_FIX_TIMEOUT_MS = 10_000;
const WATCHDOG_INTERVAL_MS = 15_000;
const WATCHDOG_STALE_MS = 25_000;
const FLUSH_RETRY_MS = 15_000;
const FLUSH_BATCH_SIZE = 100;
const GPS_ERROR_THRESHOLD = 3;
const INVALIDATE_THROTTLE_MS = 1_500;
const HEALTHY_FIX_WINDOW_MS = 30_000;
const CLOCK_REGRESSION_TOLERANCE_MS = 5_000;
const AUTO_RETRY_INTERVAL_MS = 10_000;

let globalWatchId: number | null = null;
let globalUserId: string | null = null;
let globalStatus: ShareStatus = "idle";
let globalWakeStatus: WakeLockStatus = "idle";
let globalLastFix: LocationFix | null = null;
let globalLastFixAt = 0;
let globalLastPosted: PostedFix | null = null;
let globalGpsFailCount = 0;
let globalWatchdog: ReturnType<typeof setInterval> | null = null;
let globalFlushTimer: ReturnType<typeof setTimeout> | null = null;
let globalWakeLock: WakeLockSentinelLike | null = null;
let globalWakeHandlers: { visibility: () => void; online: () => void } | null = null;
type GeoPermissionLike = {
  state: string;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
};
let globalQc: QueryClient | null = null;
let globalAutoRetry: { timer: ReturnType<typeof setInterval> } | null = null;
let globalPermTarget: GeoPermissionLike | null = null;
let globalPermHandler: ((event: Event) => void) | null = null;

// An epoch is the identity of a watch session. Every async callback carries
// the epoch it was started in; after logout/user switch its results are dropped
// instead of mutating the new account's state.
let globalEpoch = 0;
let globalAbort: AbortController | null = null;
// Owners are epochs, not booleans: a stale in-flight op can never clear the
// flag of a newer session.
let globalPostOwner: number | null = null;
let globalFlushOwner: number | null = null;
let globalFlushPending = false;
let globalWakePending = false;
let globalLastInvalidateAt = 0;

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

const statusListeners = new Set<() => void>();
const wakeListeners = new Set<() => void>();

function isCurrent(epoch: number): boolean {
  return epoch === globalEpoch;
}

function setStatus(status: ShareStatus) {
  if (globalStatus === status) return;
  globalStatus = status;
  // While the sensor/permission is unhappy (denied / error streak) keep an
  // auto-retry armed so a GPS off → on cycle recovers without a manual button.
  // Disarmed again as soon as we land in a live-ish status or stop sampling.
  if (status === "denied" || status === "gps-error") {
    armAutoRetry();
  } else {
    disarmAutoRetry();
  }
  statusListeners.forEach((fn) => fn());
}

function setWakeStatus(status: WakeLockStatus) {
  if (globalWakeStatus === status) return;
  globalWakeStatus = status;
  wakeListeners.forEach((fn) => fn());
}

function noteGpsSuccess() {
  globalGpsFailCount = 0;
}

function noteGpsError(err?: GeolocationPositionError) {
  if (err?.code === 2) {
    globalGpsFailCount = GPS_ERROR_THRESHOLD;
    setStatus("gps-error");
    return;
  }
  if (err?.code === 1) {
    stopSampling(true);
    setStatus("denied");
    return;
  }
  globalGpsFailCount++;
  setStatus(globalGpsFailCount >= GPS_ERROR_THRESHOLD ? "gps-error" : "recovering");
}

function invalidate(qc: QueryClient, force = false) {
  // A fix every ~5 s does not justify refetching GET /api/location on every
  // post; the 10 s poll already covers live freshness.
  if (!force && Date.now() - globalLastInvalidateAt < INVALIDATE_THROTTLE_MS) return;
  globalLastInvalidateAt = Date.now();
  qc.invalidateQueries({ queryKey: queryKeys.location.all });
}

function payloadFor(fix: LocationFix) {
  return {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    heading: fix.heading,
    speed: fix.speed,
    altitude: fix.altitude,
    deviceType: detectDeviceType(),
    recordedAt: new Date(fix.recordedAt).toISOString(),
  };
}

function scheduleFlush(qc: QueryClient, userId: string, epoch: number, ms = FLUSH_RETRY_MS) {
  if (globalFlushTimer) return;
  globalFlushTimer = setTimeout(() => {
    globalFlushTimer = null;
    if (isCurrent(epoch)) void flushOutbox(qc, userId, epoch);
  }, ms);
}

function markHealthy(qc: QueryClient) {
  // A successful replay proves the network, not that the sensor still works.
  // Never paper over an active GPS failure streak with historical fixes.
  if (globalGpsFailCount > 0) return;
  if (Date.now() - globalLastFixAt > HEALTHY_FIX_WINDOW_MS) return;
  if (globalStatus !== "sharing") setStatus("sharing");
  invalidate(qc);
}

async function stopForOptOut(qc: QueryClient, userId: string, epoch: number) {
  if (!isCurrent(epoch) || globalUserId !== userId) return;
  // The server says sharing is off: stop burning battery and never upload a
  // queue that belongs to a sharing-disabled account.
  await clearUser(userId);
  if (!isCurrent(epoch)) return;
  stopSampling();
  setStatus("idle");
  invalidate(qc, true);
}

async function postFix(qc: QueryClient, userId: string, fix: LocationFix, epoch: number) {
  if (!isCurrent(epoch)) return;

  if (globalPostOwner !== null) {
    // A slow POST must not drop live fixes — the outbox is exactly for this.
    const queued = await enqueueFix(userId, fix);
    if (!queued && isCurrent(epoch)) setStatus("recovering");
    return;
  }
  globalPostOwner = epoch;
  const signal = globalAbort?.signal;

  try {
    const res = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFor(fix)),
      signal,
    });
    if (!isCurrent(epoch)) return;

    if (res.ok) {
      globalLastPosted = { ...fix, postedAt: Date.now() };
      noteGpsSuccess();
      setStatus("sharing");
      invalidate(qc);
      void flushOutbox(qc, userId, epoch);
      return;
    }

    if (res.status === 403) {
      await stopForOptOut(qc, userId, epoch);
      return;
    }

    // 429/5xx/other: keep the real fix, replay it when the server recovers.
    const queued = await enqueueFix(userId, fix);
    if (!queued && isCurrent(epoch)) {
      setStatus("recovering");
    } else if (isCurrent(epoch)) {
      setStatus("recovering");
      scheduleFlush(qc, userId, epoch);
    }
  } catch {
    if (!isCurrent(epoch)) return;
    const queued = await enqueueFix(userId, fix);
    if (isCurrent(epoch)) {
      setStatus("recovering");
      if (queued) scheduleFlush(qc, userId, epoch);
    }
  } finally {
    if (globalPostOwner === epoch) globalPostOwner = null;
  }
}

async function flushOutbox(qc: QueryClient, userId: string, epoch: number) {
  if (!isCurrent(epoch)) return;
  if (globalFlushOwner !== null) {
    globalFlushPending = true;
    return;
  }
  globalFlushOwner = epoch;
  const signal = globalAbort?.signal;

  try {
    for (;;) {
      if (!isCurrent(epoch)) return;
      const rows = await peekFixes(userId, FLUSH_BATCH_SIZE);
      if (!isCurrent(epoch)) return;
      if (rows.length === 0) return;

      const ids = rows.map((row) => row.id);
      let res: Response;
      try {
        res = await fetch("/api/location/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixes: rows.map(payloadFor) }),
          signal,
        });
      } catch {
        if (isCurrent(epoch)) {
          setStatus("recovering");
          scheduleFlush(qc, userId, epoch);
        }
        return;
      }
      if (!isCurrent(epoch)) return;

      if (res.ok) {
        const removed = await removeFixes(ids);
        if (!isCurrent(epoch)) return;
        if (!removed) {
          setStatus("recovering");
          scheduleFlush(qc, userId, epoch);
          return;
        }
        markHealthy(qc);
        if (rows.length < FLUSH_BATCH_SIZE) return;
        continue;
      }

      if (res.status === 403) {
        await stopForOptOut(qc, userId, epoch);
        return;
      }

      // Rolling deploy may not have the batch route yet: fall back to the
      // single POST rather than dropping a queued fix.
      if (res.status === 404) {
        const single = await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFor(rows[0])),
          signal,
        }).catch(() => null);
        if (!isCurrent(epoch)) return;
        if (single?.ok && (await removeFixes([rows[0].id]))) {
          markHealthy(qc);
          continue;
        }
      }

      setStatus("recovering");
      scheduleFlush(qc, userId, epoch);
      return;
    }
  } finally {
    if (globalFlushOwner === epoch) {
      globalFlushOwner = null;
      if (globalFlushPending && isCurrent(epoch)) {
        globalFlushPending = false;
        void flushOutbox(qc, userId, epoch);
      }
    }
  }
}

function handlePosition(
  pos: GeolocationPosition,
  qc: QueryClient,
  userId: string,
  epoch: number,
) {
  if (!isCurrent(epoch)) return;
  noteGpsSuccess();

  const raw: LocationFix = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
    heading:
      pos.coords.heading !== null && Number.isFinite(pos.coords.heading)
        ? pos.coords.heading
        : null,
    speed:
      pos.coords.speed !== null && Number.isFinite(pos.coords.speed)
        ? Math.max(0, pos.coords.speed)
        : null,
    altitude:
      pos.coords.altitude !== null && Number.isFinite(pos.coords.altitude)
        ? pos.coords.altitude
        : null,
    recordedAt: normalizeRecordedAt(pos.timestamp),
  };

  if (!isValidFix(raw)) return;

  // A backwards clock jump is not movement: never let it become the new
  // "previous" fix, or later motion checks silently stop working.
  if (
    globalLastFix &&
    raw.recordedAt < globalLastFix.recordedAt - CLOCK_REGRESSION_TOLERANCE_MS
  ) {
    return;
  }

  // A jump no vehicle could make is GPS noise: keep the last good fix and do
  // not let the noise become the next "previous" either.
  if (isOutlier(globalLastFix, raw)) return;

  const fix = deriveMotion(raw, globalLastFix);
  globalLastFix = fix;
  globalLastFixAt = Date.now();

  // Optimistically update React Query's location state so the user's own avatar
  // follows immediately without waiting for HTTP POST round-trip.
  if (typeof qc?.getQueryData === "function" && typeof qc?.setQueryData === "function") {
    const prevData = qc.getQueryData<LocationState>(queryKeys.location.all);
    if (prevData?.self) {
      qc.setQueryData<LocationState>(queryKeys.location.all, {
        ...prevData,
        self: {
          ...prevData.self,
          location: {
            lat: fix.latitude,
            lng: fix.longitude,
            accuracy: fix.accuracy,
            heading: fix.heading,
            speed: fix.speed,
            altitude: fix.altitude,
            updatedAt: new Date(fix.recordedAt).toISOString(),
          },
          locationAgeSeconds: 0,
          isStale: false,
        },
      });
    }
  }

  // A fix alone proves the sensor works, not that the server heard us. Stay
  // "locating"/"recovering" until a POST succeeds — unless a recent successful
  // post is still inside the staleness window, in which case we never lied.
  if (
    globalLastPosted &&
    Date.now() - globalLastPosted.postedAt < 60_000 &&
    globalStatus !== "sharing"
  ) {
    setStatus("sharing");
  }

  if (shouldPost(globalLastPosted, fix)) {
    void postFix(qc, userId, fix, epoch);
  }
}

function pingGps(qc: QueryClient, userId: string, epoch = globalEpoch) {
  if (!isCurrent(epoch)) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => handlePosition(pos, qc, userId, epoch),
    (err) => {
      if (!isCurrent(epoch)) return;
      noteGpsError(err);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_FIX_TIMEOUT_MS },
  );
}

function requestWakeLock(epoch: number) {
  if (!isCurrent(epoch) || typeof navigator === "undefined") return;
  const wakeNavigator = navigator as WakeLockNavigator;
  if (!wakeNavigator.wakeLock) {
    setWakeStatus("unsupported");
    return;
  }
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    setWakeStatus("hidden");
    return;
  }
  if (globalWakePending) return;
  if (globalWakeLock && !globalWakeLock.released) {
    setWakeStatus("active");
    return;
  }

  globalWakePending = true;
  void wakeNavigator.wakeLock
    .request("screen")
    .then((sentinel) => {
      globalWakePending = false;
      if (!isCurrent(epoch) || document.visibilityState !== "visible") {
        void sentinel.release().catch(() => {});
        return;
      }
      globalWakeLock = sentinel;
      setWakeStatus("active");
      sentinel.addEventListener("release", () => {
        if (globalWakeLock !== sentinel) return;
        globalWakeLock = null;
        if (!isCurrent(epoch)) return;
        setWakeStatus(document.visibilityState === "visible" ? "idle" : "hidden");
      });
    })
    .catch(() => {
      globalWakePending = false;
      if (isCurrent(epoch)) setWakeStatus("denied");
    });
}

function releaseWakeLock() {
  const lock = globalWakeLock;
  globalWakeLock = null;
  setWakeStatus("idle");
  if (!lock) return;
  void lock.release().catch(() => {});
}

function armPermissionRetry(qc: QueryClient, epoch: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as unknown as {
    permissions?: {
      query?: (desc: { name: string }) => Promise<GeoPermissionLike>;
    };
  };
  if (!nav.permissions?.query) return;
  void nav.permissions
    .query({ name: "geolocation" })
    .then((perm) => {
      if (!isCurrent(epoch)) return;
      globalPermTarget = perm;
      globalPermHandler = () => {
        if (!isCurrent(epoch)) return;
        if (
          perm.state === "granted" &&
          (globalStatus === "denied" || globalStatus === "gps-error")
        ) {
          retryNow(qc);
        }
      };
      perm.addEventListener?.("change", globalPermHandler);
    })
    .catch(() => {});
}

function disarmPermissionRetry() {
  if (globalPermTarget && globalPermHandler) {
    globalPermTarget.removeEventListener?.("change", globalPermHandler);
  }
  globalPermTarget = null;
  globalPermHandler = null;
}

function startSampling(qc: QueryClient, userId: string) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    setStatus("unsupported");
    return;
  }

  const epoch = globalEpoch;
  globalAbort = new AbortController();
  armPermissionRetry(qc, epoch);
  setStatus("locating");
  globalLastFix = null;
  globalLastFixAt = 0;
  globalLastPosted = null;

  void purgeOtherUsers(userId).then(() => {
    if (isCurrent(epoch)) void flushOutbox(qc, userId, epoch);
  });

  pingGps(qc, userId, epoch);

  globalWatchId = navigator.geolocation.watchPosition(
    (pos) => handlePosition(pos, qc, userId, epoch),
    (err) => {
      if (!isCurrent(epoch)) return;
      noteGpsError(err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: GPS_WATCH_TIMEOUT_MS,
    },
  );

  // A watch can go silent on some Android browsers without firing an error.
  // One cheap re-request after 30 s of silence keeps the marker honest.
  globalWatchdog = setInterval(() => {
    if (!isCurrent(epoch)) return;
    if (Date.now() - globalLastFixAt < WATCHDOG_STALE_MS) return;
    pingGps(qc, userId, epoch);
  }, WATCHDOG_INTERVAL_MS);

  requestWakeLock(epoch);

  const visibility = () => {
    if (!isCurrent(epoch)) return;
    if (document.visibilityState === "visible") {
      requestWakeLock(epoch);
      pingGps(qc, userId, epoch);
      void flushOutbox(qc, userId, epoch);
    } else {
      // Release explicitly: browsers that do not auto-release would otherwise
      // keep the screen on all night for a hidden tab.
      releaseWakeLock();
      setWakeStatus("hidden");
    }
  };
  const online = () => {
    if (!isCurrent(epoch)) return;
    void flushOutbox(qc, userId, epoch);
    pingGps(qc, userId, epoch);
  };

  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("online", online);
  globalWakeHandlers = { visibility, online };
}

/** Stop scheduling new work. `keepIdentity` keeps the user id so a permission
 *  denial can be retried without a reload. */
function stopSampling(keepIdentity = false) {
  globalEpoch++;
  globalAbort?.abort();
  globalAbort = null;

  if (globalWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(globalWatchId);
  }
  globalWatchId = null;

  if (globalWatchdog) {
    clearInterval(globalWatchdog);
    globalWatchdog = null;
  }
  if (globalFlushTimer) {
    clearTimeout(globalFlushTimer);
    globalFlushTimer = null;
  }
  if (globalWakeHandlers) {
    document.removeEventListener("visibilitychange", globalWakeHandlers.visibility);
    window.removeEventListener("online", globalWakeHandlers.online);
    globalWakeHandlers = null;
  }

  releaseWakeLock();
  globalWakePending = false;
  globalFlushPending = false;

  globalLastFix = null;
  globalLastFixAt = 0;
  globalLastPosted = null;
  globalGpsFailCount = 0;
  if (!keepIdentity) globalUserId = null;
  disarmAutoRetry();
  disarmPermissionRetry();
  setStatus("idle");
}

/**
 * `enabled === false` stops everything and clears that user's queued fixes.
 * `null`/`undefined` means the share state is still unknown and must not tear
 * down a running watcher.
 */
export function initBackgroundLocation(
  enabled: boolean | null,
  qc: QueryClient,
  userId?: string | null,
) {
  if (!enabled) {
    if (globalWatchId !== null || globalUserId) stopSampling();
    if (userId) void clearUser(userId);
    return;
  }
  if (!userId) return;
  if (globalWatchId !== null && globalUserId === userId) return;
  if (globalWatchId !== null || globalUserId) stopSampling();

  globalUserId = userId;
  globalQc = qc;
  startSampling(qc, userId);
}

function armAutoRetry() {
  if (globalAutoRetry) return;
  globalAutoRetry = {
    timer: setInterval(() => {
      if (!isCurrent(globalEpoch)) { disarmAutoRetry(); return; }
      if (globalStatus !== "denied" && globalStatus !== "gps-error") { disarmAutoRetry(); return; }
      if (globalQc) retryNow(globalQc);
    }, AUTO_RETRY_INTERVAL_MS),
  };
}

function disarmAutoRetry() {
  if (globalAutoRetry) {
    clearInterval(globalAutoRetry.timer);
    globalAutoRetry = null;
  }
}

function retryNow(qc: QueryClient) {
  if (!globalUserId) return;
  globalGpsFailCount = 0;
  if (globalWatchId === null) {
    startSampling(qc, globalUserId);
    return;
  }
  setStatus("locating");
  pingGps(qc, globalUserId);
  void flushOutbox(qc, globalUserId, globalEpoch);
}

/** Impatient retry for "GPS tidak merespons" / "Izin GPS ditolak". */
export function retrySharing(qc: QueryClient) {
  retryNow(qc);
}

function subscribeStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function subscribeWake(listener: () => void) {
  wakeListeners.add(listener);
  return () => {
    wakeListeners.delete(listener);
  };
}

// useSyncExternalStore: the watcher is a module-global store shared by every
// mounted page, and this avoids a setState-in-effect cascade on mount.
export function useBackgroundLocationStatus() {
  return useSyncExternalStore<ShareStatus>(
    subscribeStatus,
    () => globalStatus,
    () => "idle",
  );
}

export function useBackgroundLocationWakeLock() {
  return useSyncExternalStore<WakeLockStatus>(
    subscribeWake,
    () => globalWakeStatus,
    () => "idle",
  );
}

export function useBackgroundLocationCleanup() {
  useEffect(() => {
    const handler = () => stopSampling();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
