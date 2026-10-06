#!/usr/bin/env node
// Generate one .xlsx mock test per Post-UTME subject combination for the new
// quiz platform, mirroring the composition the acadmate codebase already uses.
//
// Composition (from acadmate-api exam-factory.service.ts POST_UTME_SPLIT and
// mock-exam.service.ts COMPULSORY_SUBJECT_PATTERNS):
//   - Compulsory core in EVERY paper: English (w=10), Mathematics (w=10),
//     General Knowledge / General Paper (w=5).
//   - Electives: the 2–3 course subjects, w=5 each.
//   - Weights are scaled to exactly QUESTIONS_PER_TEST using proportional
//     allocation + largest-remainder rounding (allocateBucketLimits), so a paper
//     with only 2 electives still fills to 40.
//
// Platform import format (from Downloads/sample_question.xlsx):
//   Question Type | Detailed Question | Option A | Option B | Option C | Option D
//   | Correct Answer | Total Mark | Negative Mark | Explanation
//   - Type: MCQ (all our content) · Correct Answer: option letter(s) e.g. "C"
//   - Non-MCQ types put "_" in the option cells; rich text uses HTML (<br>, <u>).
//
// Rules (locked in with the user): reuse allowed across files; fill & flag when a
// subject's pool can't supply its share.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const QUESTIONS_PER_TEST = 40;
const SAMPLE_PATH = "C:/Users/HomePC/Downloads/sample_question.xlsx";
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, "combination-xlsx");

// Question banks. Add the pasted subject files here as they arrive.
// Both shapes accepted: nested {options:[{label,text,isCorrect}]} and flat
// {optionA..D, correctOption}.
const SOURCES = [
  // Full bank exported from the site (Use of English, Mathematics, General Paper,
  // Government, CRS, Literature, Chemistry, Biology, Physics).
  "C:/Users/HomePC/Downloads/mock-cmqkuk7hh003wlg01zb1d8c9a-questions-2026-07-02.json",
  "economics.json",
  "geography.json",
  "government.json",
];

// Compulsory core present in every paper, with the codebase's weights.
// General Paper is the "General Knowledge" component.
const COMPULSORY = [
  { subject: "Use of English", weight: 10 },
  { subject: "Mathematics", weight: 10 },
  { subject: "General Paper", weight: 5 },
];
const ELECTIVE_WEIGHT = 5;

// Each combination lists only its ELECTIVE subjects (the course subjects beyond
// the compulsory core). Mathematics is compulsory, so a "maths combination" just
// drops Maths from its electives.
const COMBINATIONS = [
  { name: "MPC", electives: ["Physics", "Chemistry"] },
  { name: "BCP", electives: ["Biology", "Chemistry", "Physics"] },
  // Combination 3's 4th subject is "one social science" — using Government; change if needed.
  { name: "Commercial", electives: ["Economics", "Government"] },
  { name: "Law-Arts", electives: ["Literature in English", "Government", "Christian Religious Studies"] },
  { name: "SocSci-Humanities", electives: ["Literature in English", "Government", "Economics"] },
  { name: "Geo-Social", electives: ["Government", "Economics", "Geography"] },
  { name: "Math-Phys-Geo", electives: ["Physics", "Geography"] },
  { name: "Math-Econ-Geo", electives: ["Economics", "Geography"] },
  { name: "Bio-Chem-Math", electives: ["Biology", "Chemistry"] },
];

// Subject-name aliases → canonical name. Lookup is lowercased + trimmed, so this
// normalizes case (PHYSICS → Physics) and maps spelling differences.
const SUBJECT_ALIASES = {
  "english": "Use of English",
  "english language": "Use of English",
  "use of english": "Use of English",
  "mathematics": "Mathematics",
  "maths": "Mathematics",
  "physics": "Physics",
  "chemistry": "Chemistry",
  "biology": "Biology",
  "economics": "Economics",
  "government": "Government",
  "geography": "Geography",
  "literature": "Literature in English",
  "literature in english": "Literature in English",
  "literature-in-english": "Literature in English",
  "crs": "Christian Religious Studies",
  "christian religious studies": "Christian Religious Studies",
  "christian religious knowledge": "Christian Religious Studies",
  "irs": "Islamic Religious Studies",
  "islamic religious studies": "Islamic Religious Studies",
  "general knowledge": "General Paper",
  "general studies": "General Paper",
  "general paper": "General Paper",
  "gk": "General Paper",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const canonSubject = (s) => {
  const key = String(s ?? "").trim().toLowerCase();
  return SUBJECT_ALIASES[key] ?? String(s ?? "").trim();
};

// Convert a LaTeX snippet (the content inside $…$) to HTML/Unicode the platform
// can render. The dataset's LaTeX is light — mostly plain algebra, a few
// sub/superscripts and fractions — so once delimiters are gone most of it is
// already readable text.
function latexToHtml(x) {
  return x
    .replace(/\\[,;:!]/g, " ")                                  // thin-space commands
    .replace(/\\ /g, " ")                                       // backslash-space
    .replace(/\\left|\\right/g, "")
    .replace(/\\[td]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2") // \frac{a}{b} → a/b
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
    .replace(/\\(ldots|cdots|dots)/g, "…")
    .replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/\\cdot/g, "·")
    .replace(/\\pm/g, "±").replace(/\\mp/g, "∓")
    .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈").replace(/\\infty/g, "∞")
    .replace(/\\pi/g, "π").replace(/\\theta/g, "θ").replace(/\\mu/g, "μ")
    .replace(/\\alpha/g, "α").replace(/\\beta/g, "β")
    .replace(/\\Delta/g, "Δ").replace(/\\delta/g, "δ")
    .replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>")
    .replace(/\^(\w)/g, "<sup>$1</sup>")
    .replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>")
    .replace(/_(\w)/g, "<sub>$1</sub>")
    .replace(/[{}]/g, "")
    .replace(/\\/g, "");                                        // drop any leftover backslash
}

// Convert stored rich text to platform HTML. Uses the same $-segmentation as the
// site's MathText component, so exactly the spans the author sees as math get the
// LaTeX treatment; plain-text segments keep the _word_ → underline convention.
function toHtml(s) {
  const str = String(s ?? "");
  // No $ but raw LaTeX commands → whole string is math (mirrors MathText).
  if (!str.includes("$") && /\\[a-zA-Z]+/.test(str)) {
    return latexToHtml(str).replace(/\r?\n/g, "<br>");
  }
  return str
    .split(/(\$\$[\s\S]+?\$\$|\$(?!\$)[\s\S]+?\$)/g)
    .map((seg) => {
      if (seg.startsWith("$$") && seg.endsWith("$$")) return latexToHtml(seg.slice(2, -2));
      if (seg.startsWith("$") && seg.endsWith("$")) return latexToHtml(seg.slice(1, -1));
      return seg.replace(/_([^_]+)_/g, "<u>$1</u>");
    })
    .join("")
    .replace(/\r?\n/g, "<br>");
}

// Normalize one raw question (either shape) → { subject, text, options, answer, explanation }
function normalize(raw) {
  const subject = canonSubject(raw.subject ?? raw.Subject);
  const text = raw.text ?? raw.question ?? "";
  const explanation = raw.explanation ?? raw.solution ?? "";

  let options;
  if (Array.isArray(raw.options)) {
    options = raw.options.map((o, i) => ({
      label: o.label ?? String.fromCharCode(65 + i),
      text: o.text ?? "",
      isCorrect: !!o.isCorrect,
    }));
  } else {
    const letters = ["A", "B", "C", "D"];
    const correct = String(raw.correctOption ?? raw.correct ?? "").trim().toUpperCase();
    options = letters
      .map((L) => ({ label: L, text: raw["option" + L] ?? "", isCorrect: correct.includes(L) }))
      .filter((o) => o.text !== "");
  }

  const answer = options.filter((o) => o.isCorrect).map((o) => o.label).join("");
  return { subject, text, options, answer, explanation };
}

// Fisher–Yates shuffle (new array).
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Proportional allocation of `total` across weighted buckets with largest-remainder
// rounding — a direct port of allocateBucketLimits in exam-factory.service.ts.
function allocateBucketLimits(buckets, total) {
  const totalWeight = buckets.reduce((s, b) => s + b.weight, 0);
  if (totalWeight === 0 || total <= 0) return buckets.map((b) => ({ ...b, limit: 0 }));
  const quotas = buckets.map((b) => {
    const raw = (total * b.weight) / totalWeight;
    return { ...b, limit: Math.floor(raw), remainder: raw - Math.floor(raw) };
  });
  let assigned = quotas.reduce((s, q) => s + q.limit, 0);
  for (const q of [...quotas].sort((a, b) => b.remainder - a.remainder)) {
    if (assigned >= total) break;
    q.limit += 1;
    assigned += 1;
  }
  return quotas.map(({ subject, limit }) => ({ subject, limit }));
}

// Weighted subject buckets for a combination (compulsory core + its electives).
function combinationBuckets(combo) {
  const seen = new Set();
  const buckets = [];
  for (const { subject, weight } of COMPULSORY) {
    const s = canonSubject(subject);
    if (!seen.has(s)) { buckets.push({ subject: s, weight }); seen.add(s); }
  }
  for (const e of combo.electives) {
    const s = canonSubject(e);
    if (!seen.has(s)) { buckets.push({ subject: s, weight: ELECTIVE_WEIGHT }); seen.add(s); }
  }
  return buckets;
}

// The 10 platform cells for one normalized MCQ question.
function toRow(q) {
  const opt = (L) => {
    const o = q.options.find((x) => x.label === L);
    return o ? toHtml(o.text) : "_";
  };
  return ["MCQ", toHtml(q.text), opt("A"), opt("B"), opt("C"), opt("D"), q.answer, 1, 0, toHtml(q.explanation)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  // 1. Copy the sample's header row verbatim.
  const sampleWb = XLSX.readFile(SAMPLE_PATH);
  const sampleWs = sampleWb.Sheets[sampleWb.SheetNames[0]];
  const header = XLSX.utils.sheet_to_json(sampleWs, { header: 1, defval: "" })[0];

  // 2. Build the pool, indexed by canonical subject. The platform template only
  // has Option A–D columns, so questions with a 5th option (or a correct answer
  // outside A–D) can't be represented faithfully and are skipped, not mangled.
  const pool = new Map();
  const droppedTemplate = new Map();
  for (const src of SOURCES) {
    const p = path.isAbsolute(src) ? src : path.join(__dirname, src);
    if (!fs.existsSync(p)) { console.warn(`! source not found, skipping: ${src}`); continue; }
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    const arr = Array.isArray(data) ? data : data.questions ?? data.data ?? [];
    for (const raw of arr) {
      const q = normalize(raw);
      if (!q.text || !q.answer) continue; // malformed / no correct answer
      if (q.options.length > 4 || !/^[A-D]+$/.test(q.answer)) {
        droppedTemplate.set(q.subject, (droppedTemplate.get(q.subject) ?? 0) + 1);
        continue;
      }
      if (!pool.has(q.subject)) pool.set(q.subject, []);
      pool.get(q.subject).push(q);
    }
  }

  // Drop duplicate questions within a subject (same stem), so overlapping sources
  // can't place the same question twice in one paper.
  for (const [subject, qs] of pool) {
    const seen = new Set();
    pool.set(subject, qs.filter((q) => {
      const key = q.text.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }

  if (droppedTemplate.size) {
    console.log("Skipped (5+ options / answer outside A–D, can't fit template):");
    for (const [s, n] of [...droppedTemplate].sort()) console.log(`  ${s}: ${n}`);
    console.log("");
  }

  console.log("Pool by subject:");
  for (const [s, qs] of [...pool].sort()) console.log(`  ${s}: ${qs.length}`);
  console.log("");

  // 3. Coverage: max per-file need per subject across all combinations vs. pool.
  const need = new Map();
  for (const combo of COMBINATIONS) {
    for (const { subject, limit } of allocateBucketLimits(combinationBuckets(combo), QUESTIONS_PER_TEST)) {
      need.set(subject, Math.max(need.get(subject) ?? 0, limit));
    }
  }
  console.log("Subject coverage (have / max needed per file):");
  const missing = [];
  for (const [s, want] of [...need].sort()) {
    const have = (pool.get(s) ?? []).length;
    const status = have === 0 ? "MISSING" : have < want ? "SHORT" : "ok";
    if (status !== "ok") missing.push(`${s} (${have}/${want})`);
    console.log(`  ${s}: ${have} / ${want}  ${status === "ok" ? "" : "<-- " + status}`);
  }
  console.log(missing.length ? `\nNeed questions for: ${missing.join(", ")}\n` : "\nAll subjects covered — generating files.\n");

  // Don't write half-empty papers: only generate once every subject is covered.
  if (missing.length) {
    console.log("Skipping file generation until the pool is complete. Add the missing questions to SOURCES.");
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 4. One file per combination.
  for (const combo of COMBINATIONS) {
    const buckets = allocateBucketLimits(combinationBuckets(combo), QUESTIONS_PER_TEST);
    const rows = [header];
    const report = [];
    for (const { subject, limit } of buckets) {
      const bank = pool.get(subject) ?? [];
      const take = shuffled(bank).slice(0, limit);
      take.forEach((q) => rows.push(toRow(q)));
      const short = limit - take.length;
      report.push(`${subject}: ${take.length}/${limit}${short > 0 ? ` (SHORT ${short})` : ""}`);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Worksheet");
    const safe = combo.name.replace(/[^\w.-]+/g, "_");
    const outPath = path.join(OUT_DIR, `mock-${safe}.xlsx`);
    XLSX.writeFile(wb, outPath);
    console.log(`${combo.name} → ${path.relative(__dirname, outPath)}  (${rows.length - 1}/${QUESTIONS_PER_TEST})`);
    console.log(`    ${report.join("  |  ")}`);
  }
}

main();
