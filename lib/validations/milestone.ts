import { z } from "zod";
import { parseJakartaDateOnly } from "@/lib/date";

const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((v) => parseJakartaDateOnly(v) !== null, "Tanggal tidak valid");

const photoUploadSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string().min(1, "Judul milestone wajib diisi").max(200),
  description: z.string().max(2000).optional(),
  date: dateOnlyString,
  icon: z.string().max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus hex color")
    .optional(),
  location: z.string().max(200).optional(),
  isPublic: z.boolean().default(true),
  photoIds: z.array(z.string().cuid()).max(10).optional(),
  photoUploads: z.array(photoUploadSchema).max(10).optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: dateOnlyString.optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  location: z.string().max(200).nullable().optional(),
  isPublic: z.boolean().optional(),
  photoIds: z.array(z.string().cuid()).max(10).optional(),
  photoUploads: z.array(photoUploadSchema).max(10).optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
