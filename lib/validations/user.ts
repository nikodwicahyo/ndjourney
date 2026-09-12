import { z } from "zod";
import { httpUrl } from "./http-url";

export const updateUserSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100).optional(),
  image: httpUrl().optional().nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
