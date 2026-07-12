import { z } from "zod";

export const createWishSchema = z.object({
  title: z.string().min(1, "Judul wish list wajib diisi").max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  link: z.string().url("Link tidak valid").optional(),
  category: z
    .enum(["DATE_IDEAS", "GIFTS", "TRAVEL", "OTHER"])
    .default("OTHER"),
});

export const updateWishSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  link: z.string().url().nullable().optional(),
  category: z
    .enum(["DATE_IDEAS", "GIFTS", "TRAVEL", "OTHER"])
    .optional(),
  isDone: z.boolean().optional(),
});

export type CreateWishInput = z.infer<typeof createWishSchema>;
export type UpdateWishInput = z.infer<typeof updateWishSchema>;
