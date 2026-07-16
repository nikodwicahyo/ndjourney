import { z } from "zod";

export const createPhotoSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  isVideo: z.boolean().default(false),
  albumId: z.string().cuid().optional(),
  isPublic: z.boolean().optional(),
});

export const updatePhotoSchema = z.object({
  caption: z.string().max(500).optional(),
  albumId: z.string().cuid().nullable().optional(),
  isFavorite: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const createAlbumSchema = z.object({
  name: z.string().min(1, "Nama album wajib diisi").max(100),
  description: z.string().max(500).optional(),
  coverPhotoUrl: z.string().url().optional(),
  isPublic: z.boolean().default(true),
});

export const updateAlbumSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  coverPhotoUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional(),
});

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;
