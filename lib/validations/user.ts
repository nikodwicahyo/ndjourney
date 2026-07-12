import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100).optional(),
  image: z.string().url().optional().nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
