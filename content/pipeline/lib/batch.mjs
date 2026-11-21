// Message Batches runner: budget gate → submit → persist batch ids → poll → ingest results → record real spend.
// A batch id is saved the moment it's created, so an interrupted run resumes polling instead of paying twice.
import Anthropic from '@anthropic-ai/sdk';
import { BATCH_DISCOUNT, DEFAULT_BUDGET_USD, PRICES } from '../config.mjs';
import { holdRows, loadBatches, loadSpend, recordSpend, saveBatches } from './state.mjs';
import * as log from './log.mjs';

let client;
const api = () => (client ??= new Anthropic());

const MAX_REQUESTS_PER_BATCH = 5000;
const MAX_BYTES_PER_BATCH = 180 * 1024 * 1024; // API limit is 256 MB; stay well under it
const POLL_MS = 30_000;

/** Real cost of one response's usage at batch prices. */
export function costOf(model, usage) {
  const p = PRICES[model];
  if (!p) throw new Error(`No price configured for ${model}`);
  const write = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const usdStandard =
    ((usage.input_tokens ?? 0) * p.input + write * p.input * 1.25 + read * p.cacheRead + (usage.output_tokens ?? 0) * p.output) /
    1e6;
  return usdStandard * BATCH_DISCOUNT;
}

/** Pre-submit estimate from token guesses; the ledger only ever records real usage. */
export function estimateCost(model, inputTokens, outputTokens) {
  return costOf(model, { input_tokens: inputTokens, output_tokens: outputTokens });
}

/**
 * Trim `requests` so the run stays under the budget. Each request carries `estUsd`.
 * Returns the affordable prefix (callers order requests by priority).
 */
export function fitBudget(requests, budgetUsd = DEFAULT_BUDGET_USD, { shownBudget = budgetUsd } = {}) {
  const spent = loadSpend().totalUsd;
  const pending = loadBatches().reduce((s, b) => s + (b.estUsd ?? 0), 0);
  let room = budgetUsd - spent - pending;
  const out = [];
  for (const r of requests) {
    if (r.estUsd > room) break;
    room -= r.estUsd;
    out.push(r);
  }
  const est = out.reduce((s, r) => s + r.estUsd, 0);
  if (requests.length === 0) return out;
  log.budgetLine(spent, shownBudget, est, pending);
  if (shownBudget !== budgetUsd) {
    log.hint(`   (Reading is limited to ${log.fmt.usd(budgetUsd - spent - pending)} this run, so there's money left to answer and check what's read.)`);
  }
  if (out.length < requests.length) {
    log.warn(
      `Only ${out.length} of ${requests.length} requests fit in the budget. The rest wait for the next run ` +
        `(top up, then re-run with a higher --budget, e.g. --budget 50).`,
    );
  }
  return out;
}

function splitForLimits(requests) {
  const parts = [];
  let cur = [];
  let bytes = 0;
  for (const r of requests) {
    const size = Buffer.byteLength(JSON.stringify(r.params));
    if (cur.length && (cur.length >= MAX_REQUESTS_PER_BATCH || bytes + size > MAX_BYTES_PER_BATCH)) {
      parts.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(r);
    bytes += size;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/**
 * Submit requests ({custom_id, params, estUsd}) for `stage`. Returns the batch records created.
 * custom_id must match ^[a-zA-Z0-9_-]{1,64}$.
 */
export async function submit(stage, requests, { dryRun = false } = {}) {
  if (requests.length === 0) {
    log.info('Nothing new to send for this step.');
    return [];
  }
  const questions = requests.reduce((s, r) => s + (r.rowIds?.length ?? 0), 0);
  const what = questions ? `${log.fmt.n(questions)} questions (${requests.length} requests)` : `${requests.length} requests`;
  if (dryRun) {
    log.info(`🧪 Dry run: would send ${what}. Nothing was sent or charged.`);
    return [];
  }
  const records = [];
  for (const part of splitForLimits(requests)) {
    const batch = await api().messages.batches.create({
      requests: part.map(({ custom_id, params }) => ({ custom_id, params })),
    });
    const record = {
      id: batch.id,
      stage,
      model: part[0].params.model,
      customIds: part.map((r) => r.custom_id),
      estUsd: part.reduce((s, r) => s + r.estUsd, 0),
      submittedAt: new Date().toISOString(),
    };
    saveBatches([...loadBatches(), record]);
    records.push(record);
  }
  log.info(`📤 Sent ${what} to Claude. Batches usually finish within an hour; leave this window open.`);
  log.hint(`   (Safe to stop with Ctrl-C: running the same command again picks the results up. Batch ${records.map((r) => r.id).join(', ')})`);
  return records;
}

/** Custom ids already in flight for a stage, so a re-run doesn't submit them again. */
export function inFlight(stage) {
  return new Set(loadBatches().filter((b) => b.stage === stage).flatMap((b) => b.customIds));
}

/**
 * Wait for every open batch of `stage`, hand each result to `onResult(customId, outcome)`, record spend, and
 * forget the batch. outcome = { ok: true, message, json } | { ok: false, error }.
 * With wait=false, only batches that have already ended are ingested.
 */
export async function collect(stage, onResult, { wait = true, dryRun = false } = {}) {
  if (dryRun) return; // a dry run never talks to the API
  let announced = false;
  for (;;) {
    const open = loadBatches().filter((b) => b.stage === stage);
    if (open.length === 0) return;

    let progressed = false;
    let done = 0, total = 0, errored = 0;
    for (const rec of open) {
      const b = await api().messages.batches.retrieve(rec.id);
      const c = b.request_counts;
      total += c.processing + c.succeeded + c.errored + c.canceled + c.expired;
      done += c.succeeded + c.errored + c.canceled + c.expired;
      errored += c.errored + c.expired;
      if (b.processing_status !== 'ended') continue;
      // Download everything first, then ingest under one held copy of rows.json (one write per batch, not
      // one per result). Re-ingesting after a crash is safe: stages skip rows that already moved on.
      let batchUsd = 0;
      const outcomes = [];
      for await (const r of await api().messages.batches.results(rec.id)) {
        const res = r.result;
        if (res.type === 'succeeded') {
          batchUsd += costOf(rec.model, res.message.usage);
          outcomes.push([r.custom_id, parseMessage(res.message)]);
        } else {
          const error = res.type === 'errored' ? `${res.error?.error?.type ?? res.error?.type}: ${res.error?.error?.message ?? ''}` : res.type;
          outcomes.push([r.custom_id, { ok: false, error, retryable: res.type !== 'errored' || res.error?.error?.type !== 'invalid_request_error' }]);
        }
      }
      holdRows(() => {
        for (const [id, outcome] of outcomes) onResult(id, outcome);
      });
      const spentTotal = recordSpend({ stage, batchId: rec.id, model: rec.model, usd: batchUsd });
      saveBatches(loadBatches().filter((x) => x.id !== rec.id));
      const failed = outcomes.filter(([, o]) => !o.ok).length;
      log.info(
        `📥 Claude finished ${outcomes.length} requests${failed ? ` (${failed} failed and will be retried next run)` : ''}. ` +
          `Cost ${log.fmt.usd(batchUsd)} · total spent so far ${log.fmt.usd(spentTotal)}`,
      );
      progressed = true;
    }
    if (!wait) return;
    if (!progressed) {
      if (!announced) {
        log.info('⏳ Waiting for Claude. The bar updates every 30 seconds:');
        announced = true;
      }
      const since = Math.min(...open.map((b) => Date.parse(b.submittedAt)));
      log.progress('  Working', done, total, `${log.fmt.mins(Date.now() - since)} so far${errored ? ` · ${errored} failed` : ''}`);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

/** Pull the JSON text block out of a structured-output response, guarding refusals and truncation. */
function parseMessage(message) {
  if (message.stop_reason === 'refusal') {
    return { ok: false, error: `refusal (${message.stop_details?.category ?? 'unknown'})`, retryable: false };
  }
  if (message.stop_reason === 'max_tokens') {
    return { ok: false, error: 'max_tokens: output truncated', retryable: true, truncated: true };
  }
  const text = message.content.find((b) => b.type === 'text')?.text;
  if (!text) return { ok: false, error: 'no text block in response', retryable: true };
  try {
    return { ok: true, message, json: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${err.message}`, retryable: true };
  }
}

/** Common request params for a structured-output call. */
export function params({ model, system, content, schema, effort = 'medium', maxTokens = 16000 }) {
  return {
    model,
    max_tokens: maxTokens,
    system,
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  };
}
