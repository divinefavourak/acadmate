// Resumable on-disk state. Every stage reads and writes through here, so a crash or Ctrl-C never loses paid work.
import fs from 'node:fs';
import path from 'node:path';
import { STATE_DIR } from '../config.mjs';

fs.mkdirSync(STATE_DIR, { recursive: true });

const file = (name) => path.join(STATE_DIR, name);

export function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw new Error(`state/${name} is unreadable (${err.message}); fix or delete it before re-running`);
  }
}

/** Write via a temp file + rename so an interrupted write can't leave half a JSON file behind. */
export function writeJson(name, value) {
  const target = file(name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
  fs.renameSync(tmp, target);
}

// ── Rows: the canonical question records every stage advances ──────────────
// row.status: new → solved → (needs_verify →) accepted | discarded
export function loadRows() {
  return readJson('rows.json', []);
}
export function saveRows(rows) {
  writeJson('rows.json', rows);
}

// ── Batches: submitted-but-not-ingested batch ids, so a restart resumes instead of paying again ──
export function loadBatches() {
  return readJson('batches.json', []);
}
export function saveBatches(batches) {
  writeJson('batches.json', batches);
}

// ── Spend ledger ──────────────────────────────────────────────────────────
export function loadSpend() {
  return readJson('spend.json', { totalUsd: 0, entries: [] });
}
export function recordSpend(entry) {
  const spend = loadSpend();
  spend.entries.push({ at: new Date().toISOString(), ...entry });
  spend.totalUsd = spend.entries.reduce((s, e) => s + e.usd, 0);
  writeJson('spend.json', spend);
  return spend.totalUsd;
}
