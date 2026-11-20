import { newClientId } from "./client-id";
import type { DeviceType } from "@/lib/validations/location";
import type { LocationFix, TrackingState } from "./types";

/** The subset of the background-geolocation `Location` payload we consume. */
export type NativePosition = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  bearing?: number | null;
  speed?: number | null;
  time?: number | null;
};

export type NativeFixContext = {
  isActive: boolean;
  batteryLow?: boolean;
  deviceType?: DeviceType;
  now?: number;
};

/** Map a plugin fix to the server contract. Invalid coordinates are dropped. */
export function toLocationFix(
  pos: NativePosition | undefined,
  ctx: NativeFixContext,
): LocationFix | null {
  if (!pos || !Number.isFinite(pos.latitude) || !Number.isFinite(pos.longitude)) {
    return null;
  }

  const now = ctx.now ?? Date.now();
  const time = pos.time ?? 0;
  const recordedAt = Number.isFinite(time) && time > 0 ? time : now;
  let trackingState: TrackingState = ctx.isActive ? "foreground" : "background";
  if (ctx.batteryLow) trackingState = "battery-saver";

  return {
    clientId: newClientId(),
    latitude: pos.latitude as number,
    longitude: pos.longitude as number,
    accuracy: Number.isFinite(pos.accuracy) ? (pos.accuracy as number) : null,
    heading: Number.isFinite(pos.bearing) ? (pos.bearing as number) : null,
    speed: Number.isFinite(pos.speed) ? (pos.speed as number) : null,
    altitude: Number.isFinite(pos.altitude) ? (pos.altitude as number) : null,
    // The native shell only runs on phones/tablets.
    deviceType: ctx.deviceType ?? "mobile",
    recordedAt: new Date(recordedAt).toISOString(),
    trackingState,
    source: "native",
  };
}
