import type { DeviceType } from "@/lib/validations/location";

/**
 * What the device is doing right now, as far as the client can tell.
 * Sent with every fix and heartbeat so the partner's UI can explain a missing
 * pin instead of showing a generic "Offline".
 */
export const TRACKING_STATES = [
  "foreground",
  "background",
  "hidden",
  "denied",
  "gps-off",
  "battery-saver",
  "stopped",
] as const;

export type TrackingState = (typeof TRACKING_STATES)[number];

/** One position sample, independent of where it came from (web or native). */
export type LocationFix = {
  /** Client-generated UUID: the server's idempotency key. */
  clientId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  deviceType: DeviceType;
  /** When the device actually took the fix (not when it was delivered). */
  recordedAt: string;
  trackingState: TrackingState;
  source: "web" | "native";
};

/** A fix still sitting in the local outbox. */
export type QueuedFix = LocationFix & { queuedAt: number };
