// Turn a question's figure into a PNG data URI (the importer uploads data URIs to Cloudinary):
//   table   → Claude's HTML table, rendered with headless Chrome
//   diagram → Claude's redrawn SVG, rendered with headless Chrome
//   picture → cropped straight from the source PDF page (pypdfium2)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PIPELINE_DIR } from '../config.mjs';

const HELPER = path.join(PIPELINE_DIR, 'lib', 'figures.py');
const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const CHROME =
  process.env.CHROME ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(fs.existsSync);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'acadmate-figures-'));
let n = 0;

const toDataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

function screenshot(file, width, height) {
  if (!CHROME) throw new Error('Chrome not found; set CHROME to render tables and diagrams');
  const raw = path.join(work, `shot-${++n}.png`);
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      `--user-data-dir=${path.join(work, 'profile')}`,
      `--window-size=${width},${height}`,
      `--screenshot=${raw}`,
      pathToFileURL(file).href,
    ],
    { stdio: 'ignore', timeout: 60_000 },
  );
  const out = path.join(work, `fig-${n}.png`);
  execFileSync(PYTHON, ['-I', HELPER, 'trim', raw, out], { stdio: 'pipe' });
  return toDataUri(out);
}

const TABLE_CSS = `body{margin:0;padding:16px;background:#fff;font:18px/1.4 "Segoe UI",Arial,sans-serif;color:#111}
table{border-collapse:collapse}th,td{border:1.5px solid #333;padding:6px 12px;text-align:left;vertical-align:top}
th{background:#f1f1f1;font-weight:600}caption{font-weight:600;margin-bottom:6px}`;

export function renderTable(html) {
  const file = path.join(work, `table-${++n}.html`);
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${TABLE_CSS}</style>${html}`);
  return screenshot(file, 1000, 1400);
}

export function renderSvg(svg) {
  const w = Number(/\bwidth="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 600);
  const h = Number(/\bheight="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 400);
  const file = path.join(work, `diagram-${++n}.html`);
  // Wrapped in HTML with a white background so transparent SVGs don't screenshot as black-on-nothing.
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${svg}</body>`);
  return screenshot(file, Math.ceil(w) + 40, Math.ceil(h) + 40);
}

/** Crop a figure out of a booklet photo (full resolution, EXIF-rotated). bbox as in cropFromPdf. */
export function cropFromPhoto(photoFile, bbox) {
  const out = path.join(work, `crop-${++n}.png`);
  execFileSync(PYTHON, ['-I', HELPER, 'cropimg', photoFile, bbox.x0, bbox.y0, bbox.x1, bbox.y1, out].map(String), {
    stdio: 'pipe',
  });
  return toDataUri(out);
}

/** Rotated + downsized JPEG of a phone photo, as base64, ready for an image content block. */
export function prepPhoto(photoFile) {
  const out = path.join(work, `prep-${++n}.jpg`);
  execFileSync(PYTHON, ['-I', HELPER, 'prep', photoFile, out], { stdio: 'pipe' });
  return fs.readFileSync(out).toString('base64');
}

/** bbox is page fractions {x0,y0,x1,y1}, origin top-left. pageIndex is 0-based in the original PDF. */
export function cropFromPdf(pdfFile, pageIndex, bbox) {
  const out = path.join(work, `crop-${++n}.png`);
  execFileSync(
    PYTHON,
    ['-I', HELPER, 'crop', pdfFile, String(pageIndex), bbox.x0, bbox.y0, bbox.x1, bbox.y1, out].map(String),
    { stdio: 'pipe' },
  );
  return toDataUri(out);
}
