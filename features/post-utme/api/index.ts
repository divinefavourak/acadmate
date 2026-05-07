import { apiClient } from '@/lib/api/client';
import type { CreatePostUtmeExamPayload, PostUtmeQuestion } from '../types';

interface BrowseQuestionsResponse {
  questions: PostUtmeQuestion[];
  total: number;
  limit: number;
  offset: number;
}

interface ExamSessionResponse {
  examSession: { id: string };
}

/**
 * Fetch all published POST_UTME questions for a given school so the packs page
 * can extract unique years. Limit capped at 500 — POST-UTME banks are typically
 * small enough that a single request covers all years.
 */
export function fetchPostUtmeQuestions(school: string): Promise<BrowseQuestionsResponse> {
  const params = new URLSearchParams({
    examType: 'POST_UTME',
    school,
    limit: '500',
  });
  return apiClient<BrowseQuestionsResponse>(`/api/questions?${params}`);
}

/**
 * Create a POST_UTME exam session. The backend selects questions matching the
 * school + year filter, shuffles them, and returns the session ID.
 */
export function createPostUtmeExam(
  payload: Omit<CreatePostUtmeExamPayload, 'mode'>,
): Promise<ExamSessionResponse> {
  return apiClient<ExamSessionResponse>('/api/exams', {
    method: 'POST',
    body: JSON.stringify({ mode: 'POST_UTME', ...payload }),
  });
}
