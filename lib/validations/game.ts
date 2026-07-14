import { z } from "zod";

const baseQuestionSchema = z.object({
  question: z.string().min(1, "Pertanyaan wajib diisi").max(500),
  category: z.string().max(100).optional(),
});

export const createQuestionSchema = z.discriminatedUnion("type", [
  baseQuestionSchema.extend({
    type: z.literal("WOULD_YOU_RATHER"),
    optionA: z.string().min(1, "Opsi A wajib diisi").max(200),
    optionB: z.string().min(1, "Opsi B wajib diisi").max(200),
    answer: z.enum(["A", "B", "none"]),
  }),
  baseQuestionSchema.extend({
    type: z.literal("TRIVIA"),
    optionA: z.string().max(200).optional(),
    optionB: z.string().max(200).optional(),
    answer: z.string().min(1, "Jawaban wajib diisi").max(500),
  }),
  baseQuestionSchema.extend({
    type: z.literal("SPIN_THE_WHEEL"),
    optionA: z.string().max(200).optional(),
    optionB: z.string().max(200).optional(),
    answer: z.string().max(500).optional(),
  }),
  baseQuestionSchema.extend({
    type: z.literal("TRUTH_OR_DARE"),
    optionA: z.string().max(200).optional(),
    optionB: z.string().max(200).optional(),
    answer: z.string().max(500).optional(),
    category: z.enum(["Truth", "Dare"]),
  }),
]);

export const updateQuestionSchema = z.discriminatedUnion("type", [
  baseQuestionSchema.extend({
    type: z.literal("WOULD_YOU_RATHER"),
    optionA: z.string().min(1, "Opsi A wajib diisi").max(200),
    optionB: z.string().min(1, "Opsi B wajib diisi").max(200),
    answer: z.enum(["A", "B", "none"]),
  }),
  baseQuestionSchema.extend({
    type: z.literal("TRIVIA"),
    optionA: z.string().max(200).nullable().optional(),
    optionB: z.string().max(200).nullable().optional(),
    answer: z.string().min(1, "Jawaban wajib diisi").max(500),
    category: z.string().max(100).nullable().optional(),
  }),
  baseQuestionSchema.extend({
    type: z.literal("SPIN_THE_WHEEL"),
    optionA: z.string().max(200).nullable().optional(),
    optionB: z.string().max(200).nullable().optional(),
    answer: z.string().max(500).nullable().optional(),
    category: z.string().max(100).nullable().optional(),
  }),
  baseQuestionSchema.extend({
    type: z.literal("TRUTH_OR_DARE"),
    optionA: z.string().max(200).nullable().optional(),
    optionB: z.string().max(200).nullable().optional(),
    answer: z.string().max(500).nullable().optional(),
    category: z.enum(["Truth", "Dare"]),
  }),
]);

export const submitScoreSchema = z.object({
  questionId: z.string().cuid(),
  isCorrect: z.boolean(),
  playerName: z.string().min(1).max(100).optional(),
});

export const submitArcadeScoreSchema = z.object({
  gameType: z.enum(["SLIDING_PUZZLE", "LOVE_DARTS"]),
  score: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
  playerName: z.string().min(1).max(100).optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
export type SubmitArcadeScoreInput = z.infer<typeof submitArcadeScoreSchema>;
