export type BlogCategory =
  | "UTME"
  | "POST_UTME"
  | "JAMB"
  | "SCHOOL_NEWS"
  | "STUDY_TIPS"
  | "SCHOLARSHIPS"
  | "CAREER"
  | "ANNOUNCEMENT"
  | "GENERAL";

export const BLOG_CATEGORIES: BlogCategory[] = [
  "UTME",
  "POST_UTME",
  "JAMB",
  "SCHOOL_NEWS",
  "STUDY_TIPS",
  "SCHOLARSHIPS",
  "CAREER",
  "ANNOUNCEMENT",
  "GENERAL",
];

const LABELS: Record<BlogCategory, string> = {
  UTME: "UTME",
  POST_UTME: "Post-UTME",
  JAMB: "JAMB",
  SCHOOL_NEWS: "School News",
  STUDY_TIPS: "Study Tips",
  SCHOLARSHIPS: "Scholarships",
  CAREER: "Career",
  ANNOUNCEMENT: "Announcement",
  GENERAL: "General",
};

export function categoryLabel(cat: BlogCategory): string {
  return LABELS[cat] ?? cat;
}
