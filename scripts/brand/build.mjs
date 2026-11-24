#!/usr/bin/env node
// Builds every brand asset from the two source logos in scripts/brand/src/.
//
//   node scripts/brand/build.mjs
//
// Sources: logo-light.svg (mark + wordmark on transparent) and logo-dark.svg
// (same lockup recoloured for dark backgrounds, on a navy square). Both are
// 1024x1024 traced artwork, so the script splits each one into its parts by
// position: the figure ("mark") sits above y=790 and the ACADMATE wordmark
// below it.
//
// Outputs:
//   public/brand/mark.svg, mark-dark.svg     figure only, square, transparent
//   public/brand/logo.svg, logo-dark.svg     figure + wordmark, transparent
//   app/icon.svg                             favicon (light mark)
//   app/apple-icon.png                       180px home-screen icon
//   public/brand/icon-192.png, icon-512.png  PWA icons (maskable safe zone)
//   public/brand/og.png                      1200x630 share image
//
// PNGs are rendered with headless Chrome, the same way content/english/build.mjs
// renders its diagrams.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "public", "brand");
const NAVY = "#0D1D2F";
const WORDMARK_TOP = 790;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);

// ── SVG parsing ──────────────────────────────────────────────────────────────

/** Bounding box of a path from its absolute coordinates (control points included, which is fine for sorting parts). */
function bbox(d) {
  const nums = d.match(/-?\d*\.?\d+/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function parse(file) {
  const svg = readFileSync(join(HERE, "src", file), "utf8");
  // bbox() reads coordinates as absolute pairs, so relative commands would break it.
  if (/\sd="[^"]*[a-z]/.test(svg)) throw new Error(`${file} uses relative path commands`);
  const defs = (svg.match(/<defs>[\s\S]*?<\/defs>/g) ?? []).join("");
  const paths = [...svg.matchAll(/<path\b([^>]*?)\sd="([^"]*)"\s*\/>/g)].map((m) => ({
    attrs: m[1],
    d: m[2],
    fill: (m[1].match(/fill="([^"]*)"/) ?? [])[1],
    box: bbox(m[2]),
  }));
  return { defs, paths };
}

const isBackground = (p) => p.box.x0 === 0 && p.box.y0 === 0 && p.box.x1 === 1024 && p.box.y1 === 1024;
const inside = (a, b) => a.x0 >= b.x0 && a.y0 >= b.y0 && a.x1 <= b.x1 && a.y1 <= b.y1;

/**
 * The dark wordmark draws the holes in A, D and A as separate navy shapes on top
 * of the white letters, so on any colour but navy they show as patches. Fold
 * each hole into its letter with fill-rule="evenodd" so it becomes a real hole.
 */
function punchHoles(paths) {
  const holes = paths.filter((p) => p.fill === NAVY && !isBackground(p));
  const rest = paths.filter((p) => !holes.includes(p) && !isBackground(p));
  for (const hole of holes) {
    const letter = rest.find((p) => p !== hole && inside(hole.box, p.box));
    if (!letter) throw new Error("No letter found around a navy hole");
    letter.d += " " + hole.d;
    letter.evenodd = true;
  }
  return rest;
}

function render(paths) {
  return paths
    .map((p) => {
      const attrs = p.attrs.trim() + (p.evenodd ? ' fill-rule="evenodd"' : "");
      // The trace carries 3-5 decimals. One is plenty at 1024 units and halves the file.
      const d = p.d.replace(/-?\d*\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
      return `<path ${attrs} d="${d}"/>`;
    })
    .join("");
}

function union(paths) {
  return paths.reduce(
    (b, p) => ({
      x0: Math.min(b.x0, p.box.x0),
      y0: Math.min(b.y0, p.box.y0),
      x1: Math.max(b.x1, p.box.x1),
      y1: Math.max(b.y1, p.box.y1),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );
}

/** A viewBox around `box`, with `pad` of its larger side added all round. Square when asked. */
function viewBox(box, { pad = 0.03, square = false } = {}) {
  let w = box.x1 - box.x0;
  let h = box.y1 - box.y0;
  let cx = (box.x0 + box.x1) / 2;
  let cy = (box.y0 + box.y1) / 2;
  if (square) w = h = Math.max(w, h);
  const p = Math.max(w, h) * pad;
  w += 2 * p;
  h += 2 * p;
  const r = (n) => Math.round(n * 10) / 10;
  return `${r(cx - w / 2)} ${r(cy - h / 2)} ${r(w)} ${r(h)}`;
}

const svgDoc = (vb, defs, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><title>${title}</title>${defs}${body}</svg>\n`;

// ── Build the SVGs ───────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });
const written = [];
function write(path, content) {
  writeFileSync(path, content);
  written.push(path.slice(ROOT.length + 1).replaceAll("\\", "/"));
}

const variants = {};
for (const [name, file] of [["light", "logo-light.svg"], ["dark", "logo-dark.svg"]]) {
  const { defs, paths } = parse(file);
  const parts = punchHoles(paths);
  const mark = parts.filter((p) => p.box.y0 < WORDMARK_TOP);
  const markVb = viewBox(union(mark), { square: true });
  const logoVb = viewBox(union(parts));
  const suffix = name === "dark" ? "-dark" : "";
  variants[name] = { mark: svgDoc(markVb, defs, render(mark), "Acadmate"), logo: svgDoc(logoVb, defs, render(parts), "Acadmate") };
  write(join(OUT, `mark${suffix}.svg`), variants[name].mark);
  write(join(OUT, `logo${suffix}.svg`), variants[name].logo);
}
write(join(ROOT, "app", "icon.svg"), variants.light.mark);

// ── Render the PNGs ──────────────────────────────────────────────────────────

if (!CHROME) {
  console.warn("Chrome not found, so the PNGs were not rebuilt.");
} else {
  const tmp = mkdtempSync(join(tmpdir(), "acadmate-brand-"));
  const shoot = (name, w, h, html, dest) => {
    const page = join(tmp, `${name}.html`);
    writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}</style></head><body>${html}</body></html>`);
    execFileSync(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      `--window-size=${w},${h}`, "--virtual-time-budget=4000",
      `--screenshot=${dest}`, pathToFileURL(page).href,
    ], { stdio: "ignore" });
    written.push(dest.slice(ROOT.length + 1).replaceAll("\\", "/"));
  };
  const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  // Icons: the light mark on white. Maskable icons get cropped to a circle, so the
  // mark stays inside the central 64%.
  const icon = (size, scale) =>
    `<div style="width:${size}px;height:${size}px;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${dataUri(variants.light.mark)}" style="width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px"></div>`;
  shoot("apple", 180, 180, icon(180, 0.8), join(ROOT, "app", "apple-icon.png"));
  shoot("i192", 192, 192, icon(192, 0.64), join(OUT, "icon-192.png"));
  shoot("i512", 512, 512, icon(512, 0.64), join(OUT, "icon-512.png"));

  // Share image: dark lockup on navy, with the pitch beside it.
  const og = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&display=block" rel="stylesheet">
    <div style="width:1200px;height:630px;background:${NAVY};font-family:Outfit,system-ui,sans-serif;color:#fff;display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;position:relative;overflow:hidden">
      <div style="position:absolute;width:640px;height:640px;left:-180px;top:-120px;border-radius:50%;background:radial-gradient(circle,rgba(14,165,233,.28),transparent 65%)"></div>
      <div style="position:absolute;width:560px;height:560px;right:-160px;bottom:-220px;border-radius:50%;background:radial-gradient(circle,rgba(52,211,153,.22),transparent 65%)"></div>
      <img src="${dataUri(variants.dark.logo)}" style="height:400px;position:relative">
      <div style="position:relative;flex:1">
        <div style="font-size:64px;font-weight:800;line-height:1.05;letter-spacing:-1px">JAMB past questions, with answers.</div>
        <div style="margin-top:24px;font-size:30px;font-weight:500;color:#B8C7D9;line-height:1.35">Free to read. Practise them in a real CBT, and see where you stand.</div>
        <div style="margin-top:36px;display:inline-block;font-size:26px;font-weight:700;padding:12px 24px;border-radius:999px;background:linear-gradient(90deg,#0EA5E9,#34D399);color:${NAVY}">acadmate.com.ng</div>
      </div>
    </div>`;
  shoot("og", 1200, 630, og, join(OUT, "og.png"));
  rmSync(tmp, { recursive: true, force: true });
}

console.log("Wrote:\n  " + written.join("\n  "));
