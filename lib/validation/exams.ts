import { z } from "zod";

export const createExamSessionSchema = z.discriminatedUnion("mode", [
  // Full UTME Mock — Use of English is added server-side; user picks exactly 3 other subjects
  z.object({
    mode: z.literal("MOCK"),
    subjectIds: z
      .array(z.string().cuid())
      .length(3, "Select exactly 3 subjects (Use of English is included automatically)"),
    proseTextId: z.string().cuid().optional(),
  }),

  // Single-subject practice at own pace
  z.object({
    mode: z.literal("PRACTICE"),
    subjectId: z.string().cuid(),
    questionCount: z.number().int().min(1).max(100).default(40),
  }),

  // Topic drill within a subject
  z.object({
    mode: z.literal("TOPIC"),
    subjectId: z.string().cuid(),
    topicId: z.string().cuid(),
    questionCount: z.number().int().min(1).max(100).default(20),
  }),
]);

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
