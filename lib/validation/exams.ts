import { z } from "zod";

export const createExamSessionSchema = z.object({
  mode: z.enum(["MOCK", "PRACTICE", "TOPIC"]).default("MOCK"),
  examTemplateId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  topicId: z.string().cuid().optional(),
  proseTextId: z.string().cuid().optional(),
  questionCount: z.number().int().min(1).max(100).default(40),
});

export const submitAnswerSchema = z.object({
  questionId: z.string().cuid(),
  optionId: z.string().cuid().nullable(),
});

export const markReviewSchema = z.object({
  questionId: z.string().cuid(),
  markedReview: z.boolean(),
});

export const bulkSaveAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().cuid(),
      optionId: z.string().cuid().nullable(),
    })
  ),
});

export type CreateExamSessionInput = z.infer<typeof createExamSessionSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
