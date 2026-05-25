export interface School {
  /** Value sent to the API as the `school` field — must match what's stored on Question rows. */
  id: string;
  name: string;
  abbr: string;
  location: string;
  /** Path relative to /public, e.g. "/logos/unilag.png". Shown in school header; falls back to abbr text. */
  logoUrl?: string;
}

export interface YearPack {
  year: number;
  questionCount: number;
}

export interface PostUtmeQuestion {
  id: string;
  year: number | null;
  school: string | null;
  examType: string | null;
}

export interface CreatePostUtmeExamPayload {
  mode: 'POST_UTME';
  school: string;
  year?: number;
  questionCount?: number;
}
