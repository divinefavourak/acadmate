// Resumable on-disk state. Every stage reads and writes through here, so a crash or Ctrl-C never loses paid work.
import fs from 'node:fs';
import path from 'node:path';
import { STATE_DIR } from '../config.mjs';

fs.mkdirSync(STATE_DIR, { recursive: true });

const file = (name) => path.join(STATE_DIR, name);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw new Error(`state/${name} is unreadable (${err.message}); fix or delete it before re-running`);
  }
}

/**
 * Write via a temp file + rename so an interrupted write can't leave half a JSON file behind.
 * On Windows the rename fails with EPERM/EBUSY while anything (antivirus, search indexer, an editor) has the
 * target open for a moment, so retry with backoff before giving up.
 */
export function writeJson(name, value) {
  const target = file(name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(tmp, target);
      return;
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code) || attempt >= 12) {
        throw new Error(`${err.message}\n(state/${name} is locked by another program: close it in any editor and re-run; nothing is lost)`);
      }
      sleep(Math.min(100 * 2 ** attempt, 3000));
    }
  }
}

// ── Rows: the canonical question records every stage advances ──────────────
// row.status: new → (needs_verify →) accepted | discarded
// holdRows() keeps one copy in memory while a whole batch of results is ingested, then writes once.
let held = null;

export function loadRows() {
  return held ?? readJson('rows.json', []);
}
export function saveRows(rows) {
  if (held) held = rows;
  else writeJson('rows.json', rows);
}
export function holdRows(fn) {
  if (held) return fn(); // already holding (nested call)
  held = readJson('rows.json', []);
  try {
    return fn();
  } finally {
    const rows = held;
    held = null;
    writeJson('rows.json', rows);
  }
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
/** Idempotent per batch: if a crash makes a batch get collected twice, its charge is still counted once. */
export function recordSpend(entry) {
  const spend = loadSpend();
  if (!entry.batchId || !spend.entries.some((e) => e.batchId === entry.batchId)) {
    spend.entries.push({ at: new Date().toISOString(), ...entry });
  }
  spend.totalUsd = spend.entries.reduce((s, e) => s + e.usd, 0);
  writeJson('spend.json', spend);
  return spend.totalUsd;
}
