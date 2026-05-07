import type { School } from './types';

/**
 * Canonical school list. The `id` field must match the value stored in
 * Question.school on the backend — coordinate with whoever imports the questions.
 */
export const SCHOOLS: School[] = [
  { id: 'UNILAG', name: 'University of Lagos', abbr: 'UNILAG', location: 'Lagos' },
  { id: 'UI', name: 'University of Ibadan', abbr: 'UI', location: 'Ibadan' },
  { id: 'OAU', name: 'Obafemi Awolowo University', abbr: 'OAU', location: 'Ile-Ife' },
  { id: 'UNIBEN', name: 'University of Benin', abbr: 'UNIBEN', location: 'Benin City' },
  { id: 'ABU', name: 'Ahmadu Bello University', abbr: 'ABU', location: 'Zaria' },
  { id: 'UNN', name: 'University of Nigeria Nsukka', abbr: 'UNN', location: 'Nsukka' },
];

export const DEFAULT_QUESTION_COUNT = 40;
