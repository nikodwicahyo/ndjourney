import { z } from "zod";

export const createNoteSchema = z.object({
  content: z
    .string()
    .min(1, "Catatan tidak boleh kosong")
    .max(280, "Catatan maksimal 280 karakter"),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
