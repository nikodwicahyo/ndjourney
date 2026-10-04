import { z } from "zod";
import { httpUrl } from "./http-url";

// ponytail: local copy (couple.ts uses the zod/v4 entry point — no cross-import).
const cropRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
  })
  .refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1, "Crop rect melebihi batas gambar");

export const createWishSchema = z.object({
  title: z.string().min(1, "Judul wish list wajib diisi").max(200),
  description: z.string().max(1000).optional(),
  imageUrl: httpUrl().optional(),
  imageCrop: cropRectSchema.nullable().optional(),
  link: httpUrl("Link tidak valid").optional(),
  category: z
    .enum(["DATE_IDEAS", "GIFTS", "TRAVEL", "OTHER"])
    .default("OTHER"),
});

export const updateWishSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: httpUrl().nullable().optional(),
  imageCrop: cropRectSchema.nullable().optional(),
  link: httpUrl().nullable().optional(),
  category: z
    .enum(["DATE_IDEAS", "GIFTS", "TRAVEL", "OTHER"])
    .optional(),
  isDone: z.boolean().optional(),
});

export type CreateWishInput = z.infer<typeof createWishSchema>;
export type UpdateWishInput = z.infer<typeof updateWishSchema>;
