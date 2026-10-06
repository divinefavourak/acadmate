// Diagrams for the English Language notes and questions, drawn as SVG.
// build.mjs renders each one to PNG and embeds it in the import files as base64.
// They sit on a white card so they read the same on light and dark pages.

const FONT = "Segoe UI, Arial, sans-serif";
const INK = "#0f172a";
const MUTED = "#475569";
const LINE = "#cbd5e1";
const INDIGO = "#4f46e5";
const TINT = "#eef2ff";
const GREEN = "#059669";
const AMBER = "#b45309";
const ROSE = "#be123c";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** White card of the given size with a title; `body` is the SVG drawn inside it. */
function card(width, height, title, body) {
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
<rect width="${width}" height="${height}" fill="#ffffff"/>
<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="#ffffff" stroke="${LINE}" stroke-width="2"/>
<text x="${width / 2}" y="46" text-anchor="middle" font-size="24" font-weight="700" fill="${INK}">${esc(title)}</text>
${body}
</svg>`,
  };
}

const text = (x, y, s, { size = 16, weight = 400, fill = INK, anchor = "middle", style = "" } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${style}>${esc(s)}</text>`;

const box = (x, y, w, h, { fill = TINT, stroke = INDIGO, rx = 12 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;

const arrow = (x1, y1, x2, y2, color = MUTED) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" marker-end="url(#arrow)"/>`;

const ARROW_DEF = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${MUTED}"/></marker></defs>`;

// ── 1. Parts of speech ───────────────────────────────────────────────────────
function partsOfSpeech() {
  const parts = [
    ["Noun", "names a person, place or thing", "teacher, Lagos, book"],
    ["Pronoun", "stands in for a noun", "she, they, it"],
    ["Verb", "shows an action or a state", "run, write, is"],
    ["Adjective", "describes a noun", "tall, clever, red"],
    ["Adverb", "describes a verb, adjective or adverb", "quickly, very, often"],
    ["Preposition", "shows position or relation", "in, on, between"],
    ["Conjunction", "joins words or clauses", "and, but, because"],
    ["Interjection", "expresses sudden feeling", "Oh! Alas! Wow!"],
  ];
  const w = 205, h = 150, gap = 16, left = 22, top = 76;
  const cells = parts
    .map(([name, job, eg], i) => {
      const x = left + (i % 4) * (w + gap);
      const y = top + Math.floor(i / 4) * (h + gap);
      return [
        box(x, y, w, h),
        text(x + w / 2, y + 36, name, { size: 20, weight: 700, fill: INDIGO }),
        text(x + w / 2, y + 68, job, { size: 13.5, fill: INK }),
        `<line x1="${x + 24}" y1="${y + 88}" x2="${x + w - 24}" y2="${y + 88}" stroke="${LINE}" stroke-width="1.5"/>`,
        text(x + w / 2, y + 116, eg, { size: 14.5, fill: MUTED, style: 'font-style="italic"' }),
      ].join("\n");
    })
    .join("\n");
  return card(904, 420, "The eight parts of speech", cells);
}

// ── 2. Parts of a sentence (also used, numbered, as a question image) ────────
function sentenceParts({ numbered = false } = {}) {
  const parts = [
    ["The diligent student", "Subject", "who or what the sentence is about", INDIGO, 250],
    ["passed", "Verb", "the action", GREEN, 120],
    ["the examination", "Object", "receives the action", AMBER, 210],
    ["easily.", "Adverbial", "how, when or where", ROSE, 130],
  ];
  let x = 40;
  const body = parts
    .map(([words, label, job, color, w], i) => {
      const out = [
        `<rect x="${x}" y="92" width="${w}" height="64" rx="12" fill="#ffffff" stroke="${color}" stroke-width="3"/>`,
        text(x + w / 2, 132, words, { size: 20, weight: 600 }),
        `<line x1="${x + w / 2}" y1="158" x2="${x + w / 2}" y2="188" stroke="${color}" stroke-width="2.5"/>`,
      ];
      if (numbered) {
        out.push(`<circle cx="${x + w / 2}" cy="214" r="24" fill="${color}"/>`, text(x + w / 2, 222, String(i + 1), { size: 22, weight: 700, fill: "#ffffff" }));
      } else {
        out.push(text(x + w / 2, 214, label, { size: 19, weight: 700, fill: color }), text(x + w / 2, 240, job, { size: 13.5, fill: MUTED }));
      }
      x += w + 18;
      return out.join("\n");
    })
    .join("\n");
  return card(844, 270, numbered ? "Parts of a sentence" : "How a sentence is built", body);
}

// ── 3. Sentence types ────────────────────────────────────────────────────────
function sentenceTypes() {
  const main = (x, y, w, s) => `${box(x, y, w, 40, { fill: TINT, stroke: INDIGO, rx: 8 })}${text(x + w / 2, y + 26, s, { size: 14.5, weight: 600 })}`;
  const sub = (x, y, w, s) => `${box(x, y, w, 40, { fill: "#fff7ed", stroke: AMBER, rx: 8 })}${text(x + w / 2, y + 26, s, { size: 14.5, weight: 600 })}`;
  const join = (x, y, s) => text(x, y + 26, s, { size: 14.5, weight: 700, fill: GREEN });
  const row = (y, name, rule, blocks) =>
    `${text(36, y + 18, name, { size: 18, weight: 700, anchor: "start", fill: INK })}${text(36, y + 40, rule, { size: 13, anchor: "start", fill: MUTED })}${blocks}`;
  const body = [
    row(84, "Simple", "one main clause", main(300, 84, 250, "The bell rang.")),
    row(150, "Compound", "main + main, joined", main(300, 150, 190, "The bell rang") + join(520, 150, "and") + main(550, 150, 250, "the students left.")),
    row(216, "Complex", "main + subordinate", sub(300, 216, 220, "When the bell rang,") + main(532, 216, 268, "the students left.")),
    row(
      282,
      "Compound-complex",
      "two main + subordinate",
      sub(300, 282, 180, "When the bell rang,") + main(490, 282, 150, "the students left") + join(662, 282, "but") + main(690, 282, 160, "the teacher stayed."),
    ),
    `<rect x="300" y="346" width="18" height="18" rx="4" fill="${TINT}" stroke="${INDIGO}" stroke-width="2"/>${text(326, 360, "main clause (can stand alone)", { size: 13, anchor: "start", fill: MUTED })}`,
    `<rect x="540" y="346" width="18" height="18" rx="4" fill="#fff7ed" stroke="${AMBER}" stroke-width="2"/>${text(566, 360, "subordinate clause (cannot stand alone)", { size: 13, anchor: "start", fill: MUTED })}`,
  ].join("\n");
  return card(880, 384, "Four types of sentence", body);
}

// ── 4. Concord ───────────────────────────────────────────────────────────────
function concord() {
  const rows = [
    ["each, every, everyone, nobody", "singular", "Everyone has arrived."],
    ["one of the + plural noun", "singular", "One of the boys is absent."],
    ["A and B (two different things)", "plural", "Ada and Chidi are here."],
    ["A as well as B, A together with B", "follows A", "The principal, as well as the teachers, is here."],
    ["either…or, neither…nor", "follows the nearer subject", "Neither the teacher nor the students are in."],
    ["the number of…", "singular", "The number of candidates has risen."],
    ["a number of…", "plural", "A number of candidates have left."],
  ];
  const top = 78, rh = 46;
  const head = `<rect x="24" y="${top}" width="872" height="${rh}" rx="10" fill="${INDIGO}"/>${text(40, top + 30, "When the subject is…", { size: 15.5, weight: 700, fill: "#fff", anchor: "start" })}${text(360, top + 30, "the verb is…", { size: 15.5, weight: 700, fill: "#fff", anchor: "start" })}${text(566, top + 30, "Example", { size: 15.5, weight: 700, fill: "#fff", anchor: "start" })}`;
  const body = rows
    .map(([subject, verb, eg], i) => {
      const y = top + rh * (i + 1);
      return `<rect x="24" y="${y}" width="872" height="${rh}" fill="${i % 2 ? "#ffffff" : "#f8fafc"}"/>${text(40, y + 29, subject, { size: 14.5, anchor: "start", weight: 600 })}${text(360, y + 29, verb, { size: 14.5, anchor: "start", weight: 700, fill: GREEN })}${text(566, y + 29, eg, { size: 13.5, anchor: "start", fill: MUTED, style: 'font-style="italic"' })}`;
    })
    .join("\n");
  return card(920, top + rh * (rows.length + 1) + 24, "Concord: making the verb agree with its subject", head + body);
}

// ── 5. Vowel chart ───────────────────────────────────────────────────────────
function vowelChart() {
  // Trapezium: top-left (150,110) → top-right (650,110) → bottom-right (650,450) → bottom-left (330,450).
  const v = (x, y, symbol, word) =>
    `<circle cx="${x}" cy="${y}" r="24" fill="${TINT}" stroke="${INDIGO}" stroke-width="2"/>${text(x, y + 7, symbol, { size: 20, weight: 700, fill: INDIGO })}${text(x, y + 43, word, { size: 13, fill: MUTED })}`;
  const body = [
    `<path d="M150 110 L650 110 L650 450 L330 450 Z" fill="#f8fafc" stroke="${LINE}" stroke-width="3"/>`,
    text(250, 92, "FRONT", { size: 13, weight: 700, fill: MUTED }),
    text(470, 92, "CENTRAL", { size: 13, weight: 700, fill: MUTED }),
    text(605, 92, "BACK", { size: 13, weight: 700, fill: MUTED }),
    text(84, 156, "tongue high", { size: 13, fill: MUTED }),
    text(150, 400, "tongue low", { size: 13, fill: MUTED }),
    v(210, 150, "iː", "seat"),
    v(296, 190, "ɪ", "sit"),
    v(304, 282, "e", "set"),
    v(366, 388, "æ", "sat"),
    v(452, 262, "ɜː", "bird"),
    v(528, 300, "ə", "about"),
    v(492, 388, "ʌ", "cup"),
    v(604, 150, "uː", "food"),
    v(526, 190, "ʊ", "put"),
    v(604, 250, "ɔː", "law"),
    v(604, 326, "ɒ", "pot"),
    v(604, 400, "ɑː", "car"),
    text(400, 496, "A long vowel is marked with ː after the symbol. The word under each symbol contains that sound.", { size: 13.5, fill: MUTED }),
  ].join("\n");
  return card(800, 524, "The twelve pure vowels of English", body);
}

// ── 6. Word stress (also used as a question image) ───────────────────────────
function stressDots(pattern, cx, y) {
  // "S" = stressed syllable (big dot), "w" = weak syllable (small dot).
  const step = 46;
  const start = cx - ((pattern.length - 1) * step) / 2;
  return [...pattern].map((p, i) => `<circle cx="${start + i * step}" cy="${y}" r="${p === "S" ? 17 : 8}" fill="${p === "S" ? INDIGO : LINE}"/>`).join("");
}

function wordStress() {
  const pairs = [
    ["record", "REcord", "reCORD"],
    ["present", "PREsent", "preSENT"],
    ["import", "IMport", "imPORT"],
  ];
  const head = `${text(250, 104, "as a NOUN", { size: 17, weight: 700, fill: INDIGO })}${text(250, 126, "stress the first syllable", { size: 13, fill: MUTED })}${text(590, 104, "as a VERB", { size: 17, weight: 700, fill: GREEN })}${text(590, 126, "stress the second syllable", { size: 13, fill: MUTED })}`;
  const body = pairs
    .map(([word, noun, verb], i) => {
      const y = 150 + i * 96;
      return `${text(60, y + 50, word, { size: 17, weight: 600, anchor: "start", fill: MUTED })}${box(150, y, 200, 80, { fill: TINT, stroke: INDIGO })}${stressDots("Sw", 250, y + 28)}${text(250, y + 66, noun, { size: 18, weight: 700 })}${box(490, y, 200, 80, { fill: "#ecfdf5", stroke: GREEN })}${stressDots("wS", 590, y + 28)}${text(590, y + 66, verb, { size: 18, weight: 700 })}`;
    })
    .join("\n");
  return card(760, 460, "Stress can change a word's class", head + body);
}

function stressPatternQuestion() {
  const body = `${box(230, 84, 300, 120, { fill: TINT, stroke: INDIGO })}${stressDots("Sw", 380, 144)}${text(380, 236, "big dot = stressed syllable     small dot = unstressed syllable", { size: 14, fill: MUTED })}`;
  return card(760, 264, "A two-syllable stress pattern", body);
}

// ── 7. Comprehension steps ───────────────────────────────────────────────────
function comprehensionSteps() {
  const steps = [
    ["1", "Skim", "Read the passage once, quickly, for the general idea."],
    ["2", "Read the questions", "Know what you are looking for before you read again."],
    ["3", "Read closely", "Find the lines that answer each question."],
    ["4", "Answer from the text", "Choose what the passage says, not what you believe."],
  ];
  const w = 196, gap = 24, top = 88;
  const body =
    ARROW_DEF +
    steps
      .map(([n, name, tip], i) => {
        const x = 28 + i * (w + gap);
        const words = tip.split(" ");
        const lines = [];
        let line = "";
        for (const word of words) {
          if ((line + " " + word).trim().length > 24) { lines.push(line.trim()); line = word; } else line += " " + word;
        }
        lines.push(line.trim());
        return [
          box(x, top, w, 190),
          `<circle cx="${x + w / 2}" cy="${top + 38}" r="22" fill="${INDIGO}"/>`,
          text(x + w / 2, top + 46, n, { size: 20, weight: 700, fill: "#fff" }),
          text(x + w / 2, top + 90, name, { size: 18, weight: 700 }),
          ...lines.map((l, k) => text(x + w / 2, top + 118 + k * 19, l, { size: 13.5, fill: MUTED })),
          i < steps.length - 1 ? arrow(x + w + 3, top + 95, x + w + gap - 3, top + 95) : "",
        ].join("\n");
      })
      .join("\n");
  return card(900, 306, "Four steps for a comprehension passage", body);
}

// ── 8. Register scale ────────────────────────────────────────────────────────
function registerScale() {
  const rows = [
    ["commence", "start", "kick off"],
    ["purchase", "buy", "grab"],
    ["children", "kids", "pikin (pidgin)"],
    ["I regret to inform you", "I'm sorry to tell you", "Bad news, I'm afraid"],
  ];
  const cols = [
    ["FORMAL", "official letters, reports, speeches", INDIGO, 40],
    ["NEUTRAL", "everyday writing and speech", GREEN, 320],
    ["INFORMAL", "friends, family, chat", AMBER, 600],
  ];
  const head = cols.map(([name, where, color, x]) => `<rect x="${x}" y="80" width="240" height="60" rx="12" fill="${color}"/>${text(x + 120, 106, name, { size: 17, weight: 700, fill: "#fff" })}${text(x + 120, 127, where, { size: 12.5, fill: "#fff" })}`).join("");
  const body = rows
    .map((row, i) => {
      const y = 156 + i * 50;
      return row.map((cell, k) => `<rect x="${cols[k][3]}" y="${y}" width="240" height="40" rx="8" fill="#f8fafc" stroke="${LINE}"/>${text(cols[k][3] + 120, y + 26, cell, { size: 14.5, weight: 600 })}`).join("");
    })
    .join("\n");
  return card(880, 376, "The same idea in three registers", head + body);
}

// ── 9. Summary funnel ────────────────────────────────────────────────────────
function summarySteps() {
  const body =
    ARROW_DEF +
    [
      box(40, 96, 220, 150, { fill: "#f8fafc", stroke: LINE }),
      text(150, 128, "The passage", { size: 18, weight: 700 }),
      ...["examples", "repetition", "description", "main points"].map((s, i) => text(150, 158 + i * 22, s, { size: 14, fill: i === 3 ? INDIGO : MUTED, weight: i === 3 ? 700 : 400 })),
      arrow(266, 171, 316, 171),
      box(322, 96, 220, 150),
      text(432, 128, "Pick out", { size: 18, weight: 700, fill: INDIGO }),
      text(432, 160, "only the points the", { size: 14, fill: MUTED }),
      text(432, 180, "question asks for", { size: 14, fill: MUTED }),
      text(432, 214, "drop examples and detail", { size: 13, fill: ROSE }),
      arrow(548, 171, 598, 171),
      box(604, 96, 236, 150, { fill: "#ecfdf5", stroke: GREEN }),
      text(722, 128, "Write", { size: 18, weight: 700, fill: GREEN }),
      text(722, 160, "one sentence per point,", { size: 14, fill: MUTED }),
      text(722, 180, "in your own words,", { size: 14, fill: MUTED }),
      text(722, 200, "with no extra detail", { size: 14, fill: MUTED }),
    ].join("\n");
  return card(880, 276, "From passage to summary", body);
}

export const diagrams = {
  "parts-of-speech": partsOfSpeech(),
  "sentence-parts": sentenceParts(),
  "sentence-parts-numbered": sentenceParts({ numbered: true }),
  "sentence-types": sentenceTypes(),
  concord: concord(),
  "vowel-chart": vowelChart(),
  "word-stress": wordStress(),
  "stress-pattern-question": stressPatternQuestion(),
  "comprehension-steps": comprehensionSteps(),
  "register-scale": registerScale(),
  "summary-steps": summarySteps(),
};
