"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { detectDeviceType } from "@/lib/device";

export type ShareStatus =
  | "idle"
  | "locating"
  | "sharing"
  | "denied"
  | "unsupported"
  | "recovering";

const POST_THROTTLE_MS = 8000;
const KEEPALIVE_INTERVAL_MS = 30000;
const MIN_MOVE_METERS = 5;
const MAX_RETRIES = 3;
const GPS_PING_INTERVAL = 12000;

type LocationPostPayload = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  deviceType: string;
};

let globalWatchId: number | null = null;
let globalStatusListeners: Set<(status: ShareStatus) => void> = new Set();
let globalStatus: ShareStatus = "idle";
let globalLastPostPayload: LocationPostPayload | null = null;
let globalLastPostTime = 0;
let globalRetryCount = 0;
let globalPingTimer: ReturnType<typeof setTimeout> | null = null;
let globalKeepAliveTimer: ReturnType<typeof setTimeout> | null = null;

function setGlobalStatus(status: ShareStatus) {
  if (globalStatus === status) return;
  globalStatus = status;
  globalStatusListeners.forEach((fn) => fn(status));
}

async function postLocation(
  payload: LocationPostPayload,
  qc: ReturnType<typeof useQueryClient>,
  force = false,
) {
  const now = Date.now();
  const last = globalLastPostPayload;

  if (!force && last) {
    const age = now - globalLastPostTime;
    const dLat = (payload.latitude - last.latitude) * 111320;
    const dLng = (payload.longitude - last.longitude) * 111320 * Math.cos((last.latitude * Math.PI) / 180);
    const moved = Math.sqrt(dLat * dLat + dLng * dLng);
    const withinWindow = age < POST_THROTTLE_MS;
    if (withinWindow && moved < MIN_MOVE_METERS) return;
  }

  try {
    const res = await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      globalLastPostPayload = payload;
      globalLastPostTime = now;
      globalRetryCount = 0;
      setGlobalStatus("sharing");
      qc.invalidateQueries({ queryKey: queryKeys.location.all });
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SET_LAST_POSITION",
          payload: { ...payload, timestamp: Date.now() },
        });
      }
    } else if (res.status === 403) {
      setGlobalStatus("idle");
    } else if (globalRetryCount < MAX_RETRIES) {
      globalRetryCount++;
      setTimeout(() => void postLocation(payload, qc, force), 1000 * globalRetryCount);
    }
  } catch {
    if (globalRetryCount < MAX_RETRIES) {
      globalRetryCount++;
      setTimeout(() => void postLocation(payload, qc, force), 1000 * globalRetryCount);
    }
  }
}

function makePayload(pos: GeolocationPosition): LocationPostPayload {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
    heading: pos.coords.heading ?? null,
    speed: pos.coords.speed ?? null,
    altitude: pos.coords.altitude ?? null,
    deviceType: detectDeviceType(),
  };
}

function postIfBetter(
  payload: LocationPostPayload,
  qc: ReturnType<typeof useQueryClient>,
) {
  const accuracy = payload.accuracy;
  if (accuracy === null) return false;

  const lastAcc = globalLastPostPayload?.accuracy ?? Infinity;
  const improvement = lastAcc === Infinity || accuracy < lastAcc * 0.85;

  if (improvement) {
    setGlobalStatus("sharing");
    void postLocation(payload, qc);
    return true;
  }
  return false;
}

function pingGps(qc: ReturnType<typeof useQueryClient>) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const payload = makePayload(pos);
      postIfBetter(payload, qc);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
  );
}

function scheduleGpsPing(qc: ReturnType<typeof useQueryClient>) {
  if (globalPingTimer) clearTimeout(globalPingTimer);
  globalPingTimer = setTimeout(() => {
    pingGps(qc);
    scheduleGpsPing(qc);
  }, GPS_PING_INTERVAL);
}

function keepAlive(qc: ReturnType<typeof useQueryClient>) {
  if (!globalLastPostPayload) return;
  void postLocation(globalLastPostPayload, qc, true);
}

function scheduleKeepAlive(qc: ReturnType<typeof useQueryClient>) {
  if (globalKeepAliveTimer) clearTimeout(globalKeepAliveTimer);
  globalKeepAliveTimer = setTimeout(() => {
    keepAlive(qc);
    scheduleKeepAlive(qc);
  }, KEEPALIVE_INTERVAL_MS);
}

function startWatching(qc: ReturnType<typeof useQueryClient>) {
  if (globalWatchId !== null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    setGlobalStatus("unsupported");
    return;
  }

  setGlobalStatus("locating");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const payload = makePayload(pos);
      setGlobalStatus("sharing");
      void postLocation(payload, qc);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  );

  globalWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const payload = makePayload(pos);
      postIfBetter(payload, qc);
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGlobalStatus("denied");
        return;
      }
      setGlobalStatus("recovering");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    },
  );

  scheduleGpsPing(qc);
  scheduleKeepAlive(qc);
}

function stopWatching() {
  if (globalWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(globalWatchId);
    globalWatchId = null;
  }
  if (globalPingTimer) {
    clearTimeout(globalPingTimer);
    globalPingTimer = null;
  }
  if (globalKeepAliveTimer) {
    clearTimeout(globalKeepAliveTimer);
    globalKeepAliveTimer = null;
  }
  globalRetryCount = 0;
  globalLastPostPayload = null;
  globalLastPostTime = 0;
  setGlobalStatus("idle");
}

export function initBackgroundLocation(
  enabled: boolean,
  qc: ReturnType<typeof useQueryClient>,
) {
  if (enabled) startWatching(qc);
  else stopWatching();
}

export function useBackgroundLocationStatus() {
  const [status, setStatus] = useState<ShareStatus>(globalStatus);
  useEffect(() => {
    globalStatusListeners.add(setStatus);
    return () => { globalStatusListeners.delete(setStatus); };
  }, []);
  return status;
}

export function useBackgroundLocationCleanup() {
  useEffect(() => {
    const handler = () => {
      if (globalWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(globalWatchId);
        globalWatchId = null;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
