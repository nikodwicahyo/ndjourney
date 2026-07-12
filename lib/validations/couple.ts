import { z } from "zod/v4";
import { parseJakartaDateOnly } from "@/lib/date";

const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((v) => parseJakartaDateOnly(v) !== null, "Tanggal tidak valid");

export const updateCoupleSchema = z.object({
  name1: z.string().min(1).max(100).optional(),
  name2: z.string().min(1).max(100).optional(),
  anniversaryDate: dateOnlyString.optional(),
  birthDate1: dateOnlyString.nullable().optional(),
  birthDate2: dateOnlyString.nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  heroPhotoUrl: z.string().url().nullable().optional(),
  spotifyPlaylistUrl: z.string().url().nullable().optional(),
  backgroundMusicUrl: z.string().url().nullable().optional(),
});
