#!/usr/bin/env node
// Builds the English Language bulk-import files.
//
//   node content/english/build.mjs            → writes content/english/dist/*.json
//   node content/english/build.mjs --preview  → also keeps the rendered PNGs in dist/preview/
//
// Diagrams (diagrams.mjs) are drawn as SVG, rendered to PNG with headless
// Chrome and embedded as base64 data URIs. The importers upload those images
// and store ordinary links, so no base64 ends up in the database.
//
// Upload dist/english-notes.import.json at /admin/notes → Bulk import, and
// dist/english-questions.import.json at /admin/imports. Both import as drafts.
//
// Set CHROME to the browser binary if it is not in the default location.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { diagrams } from "./diagrams.mjs";
import { notes } from "./notes.mjs";
import { questions } from "./questions.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const keepPreview = process.argv.includes("--preview");

const CHROME =
  process.env.CHROME ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!CHROME) throw new Error("Chrome not found. Set the CHROME environment variable to its path.");

// ── Render every diagram to a PNG data URI ───────────────────────────────────
const work = mkdtempSync(path.join(tmpdir(), "english-diagrams-"));
const dataUris = {};
for (const [name, { svg, width, height }] of Object.entries(diagrams)) {
  const svgPath = path.join(work, `${name}.svg`);
  const pngPath = path.join(work, `${name}.png`);
  writeFileSync(svgPath, svg);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2", // crisp on phone screens
      `--user-data-dir=${path.join(work, "profile")}`,
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(svgPath).href,
    ],
    { stdio: "ignore" },
  );
  const png = readFileSync(pngPath);
  dataUris[name] = `data:image/png;base64,${png.toString("base64")}`;
  if (keepPreview) {
    mkdirSync(path.join(dist, "preview"), { recursive: true });
    writeFileSync(path.join(dist, "preview", `${name}.png`), png);
  }
  console.log(`rendered ${name} (${Math.round(png.length / 1024)} KB)`);
}
rmSync(work, { recursive: true, force: true });

function dataUri(name) {
  if (!dataUris[name]) throw new Error(`Unknown diagram "${name}"`);
  return dataUris[name];
}

// ── Notes: {{diagram:name|alt text}} → Markdown image with an embedded PNG ───
const used = new Set();
const notesOut = notes.map((topic) => ({
  ...topic,
  sections: topic.sections.map((section) => ({
    title: section.title,
    body: section.body.trim().replace(/\{\{diagram:([\w-]+)\|([^}]+)\}\}/g, (_m, name, alt) => {
      used.add(name);
      return `![${alt}](${dataUri(name)})`;
    }),
  })),
}));

// ── Questions: `diagram: "name"` → imageUrl with an embedded PNG ─────────────
const questionsOut = questions.map(({ diagram, ...row }) => {
  if (!diagram) return row;
  used.add(diagram);
  return { ...row, imageUrl: dataUri(diagram) };
});

const unused = Object.keys(diagrams).filter((name) => !used.has(name));
if (unused.length) console.warn(`warning: diagrams not used anywhere: ${unused.join(", ")}`);

mkdirSync(dist, { recursive: true });
const write = (file, data) => {
  const json = JSON.stringify(data, null, 1);
  writeFileSync(path.join(dist, file), json);
  console.log(`wrote dist/${file} (${Math.round(json.length / 1024)} KB)`);
};
write("english-notes.import.json", notesOut);
write("english-questions.import.json", questionsOut);

const sections = notesOut.reduce((n, t) => n + t.sections.length, 0);
console.log(`${notesOut.length} topics, ${sections} note sections, ${questionsOut.length} questions, ${used.size} diagrams embedded`);
