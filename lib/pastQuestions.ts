/**
 * Server-side data access for the public past-question pages. Types mirror
 * acadmate-api/src/modules/past-questions/past-questions.service.ts.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** ISR window for every past-question page and sitemap, in seconds. */
export const PQ_REVALIDATE = 3600;

export const EXAM_LABEL = "JAMB";

/** Questions per year page. Must match YEAR_PAGE_SIZE in the API's past-questions.service.ts. */
export const YEAR_PAGE_SIZE = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PublicSubjectSummary {
  id: string;
  slug: string;
  name: string;
  code: string;
  total: number;
  years: { year: number; count: number }[];
}

export interface PublicQuestion {
  slug: string;
  number: number;
  text: string;
  plainText: string;
  imageUrl: string | null;
  year: number;
  topic: { id: string; name: string } | null;
  proseText: { title: string; author: string | null } | null;
  options: { label: string; text: string; plainText: string }[];
  answer: string;
}

export interface HubData {
  exam: "jamb";
  total: number;
  subjects: PublicSubjectSummary[];
}

export interface SubjectData {
  subject: PublicSubjectSummary;
  topics: { id: string; name: string; count: number }[];
}

export interface YearData {
  subject: PublicSubjectSummary;
  year: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  questions: PublicQuestion[];
}

export interface QuestionData {
  subject: PublicSubjectSummary;
  question: PublicQuestion;
  yearPage: number;
  prev: string | null;
  next: string | null;
  related: { slug: string; snippet: string; year: number }[];
}

export interface SitemapData {
  total: number;
  pageSize: number;
  pages: number;
  items: { slug: string; updatedAt: string }[];
}

// ─── Fetching ────────────────────────────────────────────────────────────────

/**
 * null only for a real 404. Any other failure throws, so ISR keeps serving the
 * last good page instead of caching an API blip as "not found".
 */
async function getJson<T>(path: string): Promise<T | null> {
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const res = await fetch(`${API_URL}/api/public/past-questions${path}`, {
    next: { revalidate: PQ_REVALIDATE },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Past questions API returned ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export async function getHub(): Promise<HubData> {
  const hub = await getJson<HubData>("");
  if (!hub) throw new Error("Past questions hub not found");
  return hub;
}

export const getSubject = (subject: string) =>
  getJson<SubjectData>(`/jamb/${encodeURIComponent(subject)}`);

export const getYear = (subject: string, year: number, page: number) =>
  getJson<YearData>(`/jamb/${encodeURIComponent(subject)}/${year}?page=${page}`);

export const getQuestion = (slug: string) =>
  getJson<QuestionData>(`/questions/${encodeURIComponent(slug)}`);

export const getSitemapPage = (page: number) =>
  getJson<SitemapData>(`/sitemap?page=${page}`);

// ─── Paths ───────────────────────────────────────────────────────────────────

export const HUB_PATH = "/past-questions";
export const subjectPath = (subject: string) => `${HUB_PATH}/jamb/${subject}`;
export const yearPath = (subject: string, year: number, page = 1) =>
  `${subjectPath(subject)}/${year}${page > 1 ? `/${page}` : ""}`;
export const questionPath = (slug: string) => `/question/${slug}`;

/** CBT practice for a subject, or a Topic Drill when a topic is known. Logged-out visitors go through login first. */
export function practicePath(subjectId: string, topicId?: string | null): string {
  const params = new URLSearchParams(
    topicId ? { mode: "TOPIC", subjectId, topicId } : { mode: "PRACTICE", subjectId },
  );
  return `/exam/new?${params}`;
}

/** "earliest–latest" for a list of years, e.g. "1983–2004". */
export function yearRange(years: { year: number }[]): string {
  if (years.length === 0) return "";
  const sorted = years.map((y) => y.year).sort((a, b) => a - b);
  const [first, last] = [sorted[0], sorted[sorted.length - 1]];
  return first === last ? String(first) : `${first}–${last}`;
}

/** Cut already-plain text at a word boundary. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}
