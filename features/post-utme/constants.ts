import type { School } from './types';

/**
 * Canonical school list. The `id` field must match the value stored in
 * Question.school on the backend — coordinate with whoever imports the questions.
 */
export const SCHOOLS: School[] = [
  { id: 'UNILAG', name: 'University of Lagos',          abbr: 'UNILAG', location: 'Lagos',      logoUrl: '/logos/UNILAG LOGO.png' },
  { id: 'UI',     name: 'University of Ibadan',         abbr: 'UI',     location: 'Ibadan',     logoUrl: '/logos/ui logo.jpeg' },
  { id: 'OAU',   name: 'Obafemi Awolowo University',   abbr: 'OAU',    location: 'Ile-Ife',    logoUrl: '/logos/OAU-LOGO.png' },
  { id: 'UNIBEN',name: 'University of Benin',           abbr: 'UNIBEN', location: 'Benin City', logoUrl: '/logos/UNIBEN-logo.png' },
  { id: 'ABU',   name: 'Ahmadu Bello University',      abbr: 'ABU',    location: 'Zaria',      logoUrl: '/logos/ABU_Zaria_logo.jpg' },
  { id: 'UNN',   name: 'University of Nigeria Nsukka', abbr: 'UNN',    location: 'Nsukka',     logoUrl: '/logos/UNN Logo.png' },
];

export const DEFAULT_QUESTION_COUNT = 40;
