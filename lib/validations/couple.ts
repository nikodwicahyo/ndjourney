import { z } from "zod/v4";
import { parseJakartaDateOnly } from "@/lib/date";
import { isAllowedMediaDeliveryUrl } from "@/lib/upload-policy";
import { httpUrl } from "./http-url";

const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((v) => parseJakartaDateOnly(v) !== null, "Tanggal tidak valid");

export const cropRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
  })
  .refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1, "Crop rect melebihi batas gambar");

export const updateCoupleSchema = z.object({
  name1: z.string().min(1).max(100).optional(),
  name2: z.string().min(1).max(100).optional(),
  anniversaryDate: dateOnlyString.optional(),
  birthDate1: dateOnlyString.nullable().optional(),
  birthDate2: dateOnlyString.nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  // Hero enters only via Cloudinary uploads / gallery picks — anything else
  // can't be optimized, preloaded, or safely deleted, so don't persist it.
  heroPhotoUrl: httpUrl().nullable().optional().refine(
    (u) => u == null || isAllowedMediaDeliveryUrl(u),
    "URL hero harus dari media yang diupload ke Cloudinary",
  ),
  heroCrop: cropRectSchema.nullable().optional(),
  spotifyPlaylistUrl: httpUrl().nullable().optional(),
  backgroundMusicUrl: httpUrl().nullable().optional(),
});
