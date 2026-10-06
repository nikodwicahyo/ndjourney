import { z } from "zod";
import { parseJakartaDateOnly } from "@/lib/date";
import { httpUrl } from "./http-url";

const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((v) => parseJakartaDateOnly(v) !== null, "Tanggal tidak valid");

// local copy (couple.ts uses the zod/v4 entry point — no cross-import).
const cropRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
  })
  .refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1, "Crop rect melebihi batas gambar");

const photoUploadSchema = z.object({
  url: httpUrl(),
  publicId: z.string().min(1),
  thumbnailUrl: httpUrl().optional(),
  crop: cropRectSchema.nullable().optional(),
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
  photoIds: z.array(z.string().cuid()).max(2).optional(),
  photoUploads: z.array(photoUploadSchema).max(2).optional(),
  // crop per gallery-linked photoId — same photo, different framing per milestone.
  photoCrops: z.record(z.string().cuid(), cropRectSchema).optional(),
}).refine(
  (v) => (v.photoIds?.length ?? 0) + (v.photoUploads?.length ?? 0) <= 2,
  "Maksimal 2 foto per milestone",
);

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
  photoIds: z.array(z.string().cuid()).max(2).optional(),
  photoUploads: z.array(photoUploadSchema).max(2).optional(),
  photoCrops: z.record(z.string().cuid(), cropRectSchema).optional(),
}).refine(
  (v) => (v.photoIds?.length ?? 0) + (v.photoUploads?.length ?? 0) <= 2,
  "Maksimal 2 foto per milestone",
);

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
