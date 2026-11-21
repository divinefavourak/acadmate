#!/usr/bin/env node
// Acadmate question pipeline. See content/pipeline/README.md.
//
//   node content/pipeline/run.mjs status
//   node content/pipeline/run.mjs pilot                       ~$1 end-to-end sample, prints cost per question
//   node content/pipeline/run.mjs wave --subjects BIO,CHM,PHY [--pages 480-694]   extract→solve→verify→emit
//   node content/pipeline/run.mjs normalize                   load JSON sources (free)
//   node content/pipeline/run.mjs extract  [--subjects CHM,BIO] [--source <key>] [--limit-chunks N]
//   node content/pipeline/run.mjs photos   --dir <folder> --school UNILAG [--year 2023]   register booklet photos
//   node content/pipeline/run.mjs solve    [--subjects ...] [--origin json|pdf|gen] [--limit N] [--allow-partial]
//   node content/pipeline/run.mjs verify   [--subjects ...] [--origin ...] [--limit N] [--effort medium|high]
//   node content/pipeline/run.mjs generate [--subjects ...] [--min-per-topic 15] [--max-requests N]
//   node content/pipeline/run.mjs emit                        write import files to content/pipeline/dist (free)
//
// Every paid stage takes --budget <usd> (total cap across all runs, default 24), --dry-run, and --no-wait
// (submit and exit; the next run of the same stage collects the results).
import { DEFAULT_BUDGET_USD, KEYLESS_POLICY, MODELS, VERIFY_EFFORT } from './config.mjs';
import { loadBatches, loadRows, loadSpend, readJson } from './lib/state.mjs';
import { csv, parseArgs, usd } from './lib/util.mjs';
import { runEmit } from './stages/emit.mjs';
import { registerPhotos, runExtract } from './stages/extract.mjs';
import { runGenerate } from './stages/generate.mjs';
import { runNormalize } from './stages/normalize.mjs';
import { runSolve } from './stages/solve.mjs';
import { runVerify } from './stages/verify.mjs';

const args = parseArgs(process.argv.slice(2));
const [cmd] = args._;
const common = {
  subjects: csv(args.subjects),
  budget: args.budget ? Number(args.budget) : DEFAULT_BUDGET_USD,
  dryRun: Boolean(args['dry-run']),
  wait: !args['no-wait'],
  origin: args.origin ?? null, // json | pdf | gen
  keyless: args.keyless ?? KEYLESS_POLICY, // see config.KEYLESS_POLICY
};

const PAID = new Set(['extract', 'solve', 'verify', 'generate', 'pilot', 'wave']);
if (PAID.has(cmd) && !common.dryRun && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error('Set ANTHROPIC_API_KEY first (PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-...")');
  process.exit(1);
}

function status() {
  const rows = loadRows();
  const statuses = ['new', 'needs_verify', 'accepted', 'discarded'];
  const table = {};
  for (const r of rows) {
    const k = `${r.examType === 'POST_UTME' ? `PUTME ${r.school ?? '?'}` : 'JAMB'} ${r.subject}${r.sourceType === 'AI_ASSISTED' ? ' (AI)' : ''}`;
    table[k] ??= Object.fromEntries([...statuses, 'needsImage'].map((s) => [s, 0]));
    if (r.needsImage && r.status === 'new') table[k].needsImage++;
    else table[k][r.status]++;
  }
  console.table(Object.fromEntries(Object.entries(table).sort()));
  const spend = loadSpend();
  const byStage = {};
  for (const e of spend.entries) byStage[e.stage] = (byStage[e.stage] ?? 0) + e.usd;
  console.log(`spent ${usd(spend.totalUsd)} of ${usd(common.budget)}`, Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, usd(v)])));
  const open = loadBatches();
  if (open.length) console.log(`in flight: ${open.map((b) => `${b.stage} ${b.id}`).join(', ')}`);
  const photos = readJson('sources.json', []);
  if (photos.length) console.log('photo sources:', photos.map((p) => `${p.key} = ${p.dir} (${p.files.length} photos, ${p.school ?? ''} ${p.year ?? ''})`).join('; '));
  const failures = Object.entries(readJson('extract/failures.json', {})).filter(([, f]) => f.permanent);
  if (failures.length) console.log(`extract chunks given up on: ${failures.map(([id, f]) => `${id} (${f.error})`).join('; ')}`);
}

/**
 * One subject group end to end: extract → solve → verify → emit. Extraction is capped at half of what's left,
 * because questions that are extracted but never solved are money wasted (solve+verify cost about as much again).
 */
async function wave() {
  if (!common.subjects) throw new Error('wave needs --subjects, e.g. --subjects BIO,CHM,PHY');
  runNormalize();
  const spent = () => loadSpend().totalUsd;
  const extractCap = spent() + (common.budget - spent()) / 2;
  await runExtract({ ...common, budget: extractCap, sourceKeys: null, pages: args.pages, limitChunks: undefined });
  await runSolve({ ...common, allowPartial: Boolean(args['allow-partial']) });
  await runVerify({ ...common, effort: args.effort ?? VERIFY_EFFORT });
  runEmit();
  status();
}

async function pilot() {
  // A small slice of every stage, to measure real cost per question before committing the budget.
  const before = loadSpend().totalUsd;
  const budget = Math.min(common.budget, before + 1.5);
  runNormalize();
  await runExtract({ ...common, budget, subjects: ['PHY', 'ENG'], limitChunks: 1 });
  // The pilot extracts one chunk per PDF, so solve those rows without waiting for the answer-key pages.
  await runSolve({ ...common, budget, subjects: null, origin: 'pdf', allowPartial: true });
  await runSolve({ ...common, budget, subjects: null, origin: 'json', limit: 30 });
  await runVerify({ ...common, budget, subjects: null, limit: 40 });
  runEmit();
  const rows = loadRows();
  const accepted = rows.filter((r) => r.status === 'accepted').length;
  const spent = loadSpend().totalUsd - before;
  console.log(`\npilot spent ${usd(spent)} · ${accepted} accepted questions · ≈${usd(accepted ? spent / accepted : 0)} per question`);
  console.log(`At that rate the remaining ${usd(common.budget - loadSpend().totalUsd)} buys ≈${accepted ? Math.floor((common.budget - loadSpend().totalUsd) / (spent / accepted)) : '?'} more.`);
  console.log('Check content/pipeline/dist/*.json by hand (answers, explanations, rendered figures) before scaling up.');
}

try {
  switch (cmd) {
    case 'status': status(); break;
    case 'normalize': runNormalize(); break;
    case 'photos': registerPhotos({ dir: args.dir, school: args.school, year: args.year, examType: args.exam ?? 'POST_UTME' }); break;
    case 'extract': await runExtract({ ...common, sourceKeys: args.source ? String(args.source).split(',') : null, limitChunks: args['limit-chunks'] ? Number(args['limit-chunks']) : undefined, pages: args.pages }); break;
    case 'solve': await runSolve({ ...common, limit: args.limit, allowPartial: Boolean(args['allow-partial']) }); break;
    case 'verify': await runVerify({ ...common, limit: args.limit, effort: args.effort ?? VERIFY_EFFORT }); break;
    case 'generate': await runGenerate({ ...common, minPerTopic: args['min-per-topic'] ?? 15, maxRequests: args['max-requests'] }); break;
    case 'emit': runEmit(); break;
    case 'pilot': await pilot(); break;
    case 'wave': await wave(); break;
    default:
      console.log(`usage: node content/pipeline/run.mjs <status|pilot|wave|normalize|photos|extract|solve|verify|generate|emit> [flags]
models: worker ${MODELS.worker}, judge ${MODELS.judge}. See content/pipeline/README.md.`);
  }
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
}
