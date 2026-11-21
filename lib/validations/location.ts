import { z } from "zod";

export const DEVICE_TYPES = ["mobile", "tablet", "desktop"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullish(),
  heading: z.number().min(0).max(360).nullish(),
  speed: z.number().min(0).max(1000).nullish(),
  altitude: z.number().min(-100000).max(100000).nullish(),
  deviceType: z.enum(DEVICE_TYPES),
  // Device clock time of the fix. Optional so older clients keep working.
  recordedAt: z.string().datetime({ offset: true }).nullish(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const MAX_BATCH_FIXES = 100;

export const batchLocationSchema = z.object({
  fixes: z.array(updateLocationSchema).min(1).max(MAX_BATCH_FIXES),
});

export type BatchLocationInput = z.infer<typeof batchLocationSchema>;

export const updateShareSchema = z.object({
  isSharing: z.boolean(),
});

export type UpdateShareInput = z.infer<typeof updateShareSchema>;
