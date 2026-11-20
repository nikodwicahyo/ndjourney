import type { TrackingState } from "./types";

/** A fix younger than this is a live position. */
export const FIX_FRESH_SECONDS = 60;
/** A heartbeat younger than this proves the app is still running. */
export const SEEN_FRESH_SECONDS = 120;
/** Past this, the app is treated as closed even if the heartbeat was recent. */
export const SEEN_BACKGROUND_SECONDS = 300;

export type LiveKind = "live" | "no-fix" | "background" | "app-closed" | "off";
export type NoFixReason = "gps-off" | "denied" | "waiting";

export type LiveStatus = {
  kind: LiveKind;
  reason: NoFixReason | null;
  /** Age of the newest fix, or null when there is none. Never negative. */
  ageSeconds: number | null;
  /** Short chip text ("Live", "GPS belum dapat", "9 jam lalu"). */
  label: string;
  /** One-line explanation for tooltips / secondary text. */
  detail: string | null;
  /** Drives the green dot. Only a fresh fix is live. */
  isLive: boolean;
};

export function timeAgoId(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 30) return "baru saja";
  if (seconds < 120) return `${seconds} detik lalu`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

function ageSeconds(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.round((now - at) / 1000));
}

/**
 * One source of truth for "where is this person right now".
 *
 * `isStale` used to be a single 60 s threshold rendered as Live/Offline, which
 * could not tell "app closed" from "GPS off" from "permission revoked".
 */
export function deriveStatus(input: {
  isSharing: boolean;
  lastFixAt: string | null;
  lastSeenAt: string | null;
  trackingState: TrackingState | null;
  now: number;
}): LiveStatus {
  const { isSharing, lastFixAt, lastSeenAt, trackingState, now } = input;

  if (!isSharing) {
    return { kind: "off", reason: null, ageSeconds: null, label: "Off", detail: null, isLive: false };
  }

  const fixAge = ageSeconds(lastFixAt, now);
  const seenAge = ageSeconds(lastSeenAt, now);

  if (trackingState === "denied") {
    return {
      kind: "no-fix",
      reason: "denied",
      ageSeconds: fixAge,
      label: "Izin dicabut",
      detail: "Aktifkan izin lagi",
      isLive: false,
    };
  }

  if (fixAge !== null && fixAge <= FIX_FRESH_SECONDS) {
    return { kind: "live", reason: null, ageSeconds: fixAge, label: "Live", detail: null, isLive: true };
  }

  if (trackingState === "background" && seenAge !== null && seenAge <= SEEN_FRESH_SECONDS) {
    return {
      kind: "background",
      reason: null,
      ageSeconds: fixAge,
      label: "Di background",
      detail: "Aplikasi berjalan",
      isLive: false,
    };
  }

  if (seenAge === null && fixAge === null) {
    return {
      kind: "no-fix",
      reason: "waiting",
      ageSeconds: null,
      label: "Menunggu sinyal",
      detail: "Belum ada titik lokasi",
      isLive: false,
    };
  }

  if (seenAge !== null && seenAge <= SEEN_FRESH_SECONDS) {
    return {
      kind: "no-fix",
      reason: "gps-off",
      ageSeconds: fixAge,
      label: "GPS belum dapat",
      detail: "Aplikasi terbuka",
      isLive: false,
    };
  }

  if (seenAge !== null && seenAge <= SEEN_BACKGROUND_SECONDS) {
    return {
      kind: "background",
      reason: null,
      ageSeconds: fixAge,
      label: "Di background",
      detail: "Sinyal GPS tertunda",
      isLive: false,
    };
  }

  if (fixAge !== null) {
    return {
      kind: "app-closed",
      reason: null,
      ageSeconds: fixAge,
      label: timeAgoId(fixAge),
      detail: "Aplikasi ditutup",
      isLive: false,
    };
  }

  return {
    kind: "no-fix",
    reason: "waiting",
    ageSeconds: null,
    label: "Menunggu sinyal",
    detail: "Belum ada titik lokasi",
    isLive: false,
  };
}
