import { z } from "zod";

export const createQuestionSchema = z.object({
  subjectId: z.string().cuid(),
  topicId: z.string().cuid().optional(),
  proseTextId: z.string().cuid().optional(),
  text: z.string().min(1, "Question text is required"),
  year: z.number().int().min(1990).max(2030).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  sourceType: z.enum(["MANUAL", "IMPORTED", "AI_ASSISTED"]).default("MANUAL"),
  sourceRef: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string().length(1),
        text: z.string().min(1),
        isCorrect: z.boolean(),
        sortOrder: z.number().int().default(0),
      })
    )
    .min(2, "At least 2 options required")
    .max(6),
  explanation: z.string().optional(),
  aiAssistedExplanation: z.boolean().default(false),
});

export const updateQuestionSchema = createQuestionSchema.partial().extend({
  isPublished: z.boolean().optional(),
});

export const questionQuerySchema = z.object({
  subjectId: z.string().cuid().optional(),
  topicId: z.string().cuid().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type QuestionQuery = z.infer<typeof questionQuerySchema>;
