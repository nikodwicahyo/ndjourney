import { z } from "zod";

export const createQuestionSchema = z.object({
  type: z.enum(["WOULD_YOU_RATHER", "TRIVIA", "SPIN_THE_WHEEL", "TRUTH_OR_DARE"]),
  question: z.string().min(1, "Pertanyaan wajib diisi").max(500),
  optionA: z.string().max(200).optional(),
  optionB: z.string().max(200).optional(),
  answer: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const updateQuestionSchema = z.object({
  type: z.enum(["WOULD_YOU_RATHER", "TRIVIA", "SPIN_THE_WHEEL", "TRUTH_OR_DARE"]).optional(),
  question: z.string().min(1).max(500).optional(),
  optionA: z.string().max(200).nullable().optional(),
  optionB: z.string().max(200).nullable().optional(),
  answer: z.string().max(500).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

export const submitScoreSchema = z.object({
  questionId: z.string().cuid(),
  isCorrect: z.boolean(),
  playerName: z.string().min(1).max(100).optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
