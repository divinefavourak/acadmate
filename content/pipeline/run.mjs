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
import * as log from './lib/log.mjs';
import { loadBatches, loadRows, loadSpend, readJson } from './lib/state.mjs';
import { csv, parseArgs, usd } from './lib/util.mjs';
import { SUBJECTS } from './syllabus.mjs';
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

if (!Number.isFinite(common.budget) || common.budget < 0) {
  console.error(`--budget must be a number of dollars, e.g. --budget 50 (got "${args.budget}")`);
  process.exit(1);
}

const PAID = new Set(['extract', 'solve', 'verify', 'generate', 'pilot', 'wave']);
if (PAID.has(cmd) && !common.dryRun && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error('Set ANTHROPIC_API_KEY first (PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-...")');
  process.exit(1);
}

/** Plain-English dashboard: per subject, how many questions are ready, waiting, rejected. */
function status() {
  const rows = loadRows().filter((r) => !r.superseded && !/superseded/.test(r.discardReason ?? ''));
  const groups = new Map();
  for (const r of rows) {
    const name = `${SUBJECTS[r.subject] ?? r.subject}${r.examType === 'POST_UTME' ? ` · Post-UTME${r.school ? ` ${r.school}` : ''}` : ''}${r.sourceType === 'AI_ASSISTED' ? ' · AI practice' : ''}`;
    const g = groups.get(name) ?? groups.set(name, { ready: 0, answer: 0, opus: 0, human: 0, rejected: 0 }).get(name);
    if (r.status === 'accepted') g.ready++;
    else if (r.status === 'needs_verify') g.opus++;
    else if (r.status === 'discarded') g.rejected++;
    else if (r.needsImage) g.human++;
    else g.answer++;
  }
  log.stage('📊 Where things stand');
  const sorted = [...groups].sort(([a], [b]) => a.localeCompare(b));
  const sum = (k) => sorted.reduce((s, [, g]) => s + g[k], 0);
  const cell = (n) => (n ? log.fmt.n(n) : '·');
  log.table([
    ['Subject', '✅ Ready', '📝 To answer', '⚖ Opus to check', '🖼 Needs a human', '✖ Rejected'],
    ...sorted.map(([name, g]) => [name, cell(g.ready), cell(g.answer), cell(g.opus), cell(g.human), cell(g.rejected)]),
    ['TOTAL', cell(sum('ready')), cell(sum('answer')), cell(sum('opus')), cell(sum('human')), cell(sum('rejected'))],
  ]);
  const all = sum('ready') + sum('answer') + sum('opus') + sum('human');
  log.info('');
  log.info(`Progress ${log.bar(sum('ready'), all, 30)}  ${log.fmt.n(sum('ready'))} of ${log.fmt.n(all)} questions checked and ready`);
  log.budgetLine(loadSpend().totalUsd, common.budget, null, loadBatches().reduce((s, b) => s + (b.estUsd ?? 0), 0));

  const open = loadBatches();
  if (open.length) {
    const names = { extract: 'reading booklets', solve: 'answering questions', verify: 'Opus checking', generate: 'writing practice questions' };
    log.info(`⏳ Still with Claude: ${open.map((b) => names[b.stage] ?? b.stage).join(', ')}. Run the same command again to collect the results.`);
  }
  const photos = readJson('sources.json', []);
  for (const p of photos) log.info(`📷 Photo folder ${p.dir} (${p.files.length} photos${p.school ? `, ${p.school}` : ''}${p.year ? `, ${p.year}` : ''}): use --source ${p.key}`);
  const failures = Object.entries(readJson('extract/failures.json', {})).filter(([, f]) => f.permanent);
  if (failures.length) log.warn(`${failures.length} page ranges couldn't be read and were skipped.`);
}

/**
 * One subject group end to end: extract → solve → verify → emit. Extraction is capped at half of what's left,
 * because questions that are extracted but never solved are money wasted (solve+verify cost about as much again).
 */
async function wave() {
  if (!common.subjects) throw new Error('wave needs --subjects, e.g. --subjects BIO,CHM,PHY');
  log.info(`🌊 Running ${common.subjects.map((s) => SUBJECTS[s] ?? s).join(', ')} from start to finish.`);
  log.plan(5); // load files, read booklets, answer, Opus check, write files
  runNormalize();
  const spent = () => loadSpend().totalUsd;
  const extractCap = spent() + (common.budget - spent()) / 2;
  await runExtract({ ...common, budget: extractCap, shownBudget: common.budget, sourceKeys: null, pages: args.pages, limitChunks: undefined });
  await runSolve({ ...common, allowPartial: Boolean(args['allow-partial']) });
  await runVerify({ ...common, effort: args.effort ?? VERIFY_EFFORT });
  runEmit();
  log.plan(0);
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
  log.stage('Pilot result');
  log.info(`Spent ${usd(spent)} · ${accepted} checked questions · about ${usd(accepted ? spent / accepted : 0)} per question.`);
  log.hint('   Open content/pipeline/dist/*.json and check some answers, explanations and figures before running waves.');
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
  log.endLive();
  console.error(`\n✖ Stopped: ${err.message}`);
  console.error('  Nothing already paid for is lost. Fix the problem above, then run the same command again.');
  process.exitCode = 1;
}
