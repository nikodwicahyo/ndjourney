import { z } from "zod";
import { TRACKING_STATES } from "@/lib/location/types";

export const DEVICE_TYPES = ["mobile", "tablet", "desktop"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** A fix timestamp this far ahead/behind the server is not credible. */
export const MAX_FIX_FUTURE_MS = 2 * 60_000;
export const MAX_FIX_PAST_MS = 7 * 24 * 60 * 60_000;

const recordedAtSchema = z.string().datetime().refine(
  (value) => {
    const at = Date.parse(value);
    if (!Number.isFinite(at)) return false;
    const delta = at - Date.now();
    return delta <= MAX_FIX_FUTURE_MS && delta >= -MAX_FIX_PAST_MS;
  },
  { message: "Waktu lokasi di luar rentang yang wajar" },
);

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullish(),
  heading: z.number().min(0).max(360).nullish(),
  speed: z.number().min(0).max(1000).nullish(),
  altitude: z.number().nullish(),
  deviceType: z.enum(DEVICE_TYPES),
  /** Client-generated idempotency key. */
  clientId: z.string().min(8).max(64).optional(),
  /** When the device took the fix, not when it arrived. */
  recordedAt: recordedAtSchema.optional(),
  trackingState: z.enum(TRACKING_STATES).optional(),
  source: z.enum(["web", "native"]).optional(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const batchLocationSchema = z.object({
  fixes: z.array(updateLocationSchema).min(1).max(50),
});

export type BatchLocationInput = z.infer<typeof batchLocationSchema>;

export const locationStatusSchema = z.object({
  trackingState: z.enum(TRACKING_STATES),
  clientId: z.string().min(8).max(64).optional(),
});

export const SHARE_DURATIONS = [15, 60, 480] as const;
export type ShareDuration = (typeof SHARE_DURATIONS)[number] | null;

export const updateShareSchema = z.object({
  isSharing: z.boolean(),
  /** null = sampai dimatikan; 15/60/480 menit = berhenti otomatis. */
  durationMinutes: z
    .union([z.literal(15), z.literal(60), z.literal(480), z.null()])
    .optional(),
});

export type UpdateShareInput = z.infer<typeof updateShareSchema>;
