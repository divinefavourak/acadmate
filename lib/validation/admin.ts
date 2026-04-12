import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").toUpperCase(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const createTopicSchema = z.object({
  subjectId: z.string().cuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateTopicSchema = createTopicSchema.partial().omit({ subjectId: true });

export const createProseTextSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  year: z.number().int().optional(),
  summary: z.string().optional(),
  themes: z.string().optional(),
  isPublished: z.boolean().default(false),
});

export const createProseSectionSchema = z.object({
  proseTextId: z.string().cuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

export const importRowSchema = z.object({
  subject: z.string(),
  topic: z.string().optional(),
  text: z.string().min(1),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctOption: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().optional(),
  year: z.coerce.number().int().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type CreateProseTextInput = z.infer<typeof createProseTextSchema>;
export type ImportRow = z.infer<typeof importRowSchema>;
