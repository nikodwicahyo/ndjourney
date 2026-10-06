import { z } from "zod";

export const createLetterSchema = z.object({
  title: z.string().min(1, "Judul surat wajib diisi").max(200),
  content: z.string().min(1, "Konten surat wajib diisi").max(50000, "Konten surat terlalu panjang"),
  recipientId: z.string().cuid(),
  mood: z.enum(["LOVE", "GRATEFUL", "MISSING", "HAPPY", "APOLOGY", "SURPRISE"]),
  isTimeCapsule: z.boolean().default(false),
  unlockAt: z.string().datetime().nullable().optional(),
  isPublic: z.boolean().default(false),
}).refine(
  (v) => (v.isTimeCapsule ? !!v.unlockAt && new Date(v.unlockAt).getTime() > Date.now() : !v.unlockAt),
  { message: "unlockAt wajib di masa depan untuk time capsule, dan kosong jika bukan", path: ["unlockAt"] },
);

export const updateLetterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  mood: z
    .enum(["LOVE", "GRATEFUL", "MISSING", "HAPPY", "APOLOGY", "SURPRISE"])
    .optional(),
  isPublic: z.boolean().optional(),
});

export type CreateLetterInput = z.infer<typeof createLetterSchema>;
export type UpdateLetterInput = z.infer<typeof updateLetterSchema>;
