/** Display names for the backend's ExamMode enum. */
const MODE_LABELS: Record<string, string> = {
  MOCK: "Full UTME Mock",
  PRACTICE: "Practice Session",
  TOPIC: "Topic Practice",
  POST_UTME: "Post-UTME",
  DAILY: "Daily Challenge",
  RETRY: "Retry: missed questions",
};

/** Human label for an exam mode. Unknown modes are title-cased rather than shown raw. */
export function modeLabel(mode: string): string {
  return (
    MODE_LABELS[mode] ??
    mode.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
