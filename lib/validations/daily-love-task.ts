import { z } from "zod";

/**
 * The client sends the day it rendered so a tab left open past Jakarta
 * midnight cannot write yesterday's task into today's row. The task itself is
 * checked against the shared bank in the route (zod only guards the shape).
 */
export const dailyLoveTaskUpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  task: z
    .string()
    .trim()
    .min(1, "Tugas tidak valid")
    .max(200, "Tugas tidak valid"),
  done: z.boolean(),
});

export type DailyLoveTaskUpdateInput = z.infer<typeof dailyLoveTaskUpdateSchema>;
