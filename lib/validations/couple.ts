import { z } from "zod/v4";
import { parseJakartaDateOnly } from "@/lib/date";
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
  heroPhotoUrl: httpUrl().nullable().optional(),
  heroCrop: cropRectSchema.nullable().optional(),
  spotifyPlaylistUrl: httpUrl().nullable().optional(),
  backgroundMusicUrl: httpUrl().nullable().optional(),
});
