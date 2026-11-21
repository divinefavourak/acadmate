// Human-readable console output: step headers, progress bars, plain-English summaries.
// Everything the pipeline prints goes through here, so the run reads like a story rather than a debug log.

const tty = Boolean(process.stdout.isTTY);
const C = tty
  ? { bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' }
  : { bold: '', dim: '', green: '', yellow: '', red: '', cyan: '', reset: '' };

let liveLine = false; // a progress line is being redrawn in place

function endLive() {
  if (liveLine) {
    process.stdout.write('\n');
    liveLine = false;
  }
}

const line = (s) => {
  endLive();
  console.log(s);
};

export const fmt = {
  n: (x) => Number(x).toLocaleString('en-US'),
  usd: (x) => `$${x >= 1 || x === 0 ? x.toFixed(2) : x.toPrecision(2)}`,
  mins: (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)} min`),
};

export function bar(done, total, width = 20) {
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  const full = Math.round(frac * width);
  return `[${'█'.repeat(full)}${'░'.repeat(width - full)}]`;
}

// A `wave` announces how many steps it will run; each stage then prints "Step n of N" in order.
let planTotal = 0;
let planDone = 0;
export function plan(total) {
  planTotal = total;
  planDone = 0;
}
/** Header for a stage: numbered when running inside a plan, plain otherwise. */
export function stage(title) {
  if (planTotal) step(++planDone, planTotal, title);
  else step(null, null, title);
}

/** "━━━ Step 2 of 4 · Claude answers the questions ━━━" */
export function step(n, total, title) {
  const head = total ? `Step ${n} of ${total} · ${title}` : title;
  line('');
  line(`${C.bold}${C.cyan}━━━ ${head} ${'━'.repeat(Math.max(4, 58 - head.length))}${C.reset}`);
}

export const info = (msg) => line(`  ${msg}`);
export const ok = (msg) => line(`  ${C.green}✅ ${msg}${C.reset}`);
export const warn = (msg) => line(`  ${C.yellow}⚠️  ${msg}${C.reset}`);
export const fail = (msg) => line(`  ${C.red}✖ ${msg}${C.reset}`);
export const hint = (msg) => line(`  ${C.dim}${msg}${C.reset}`);

/** A progress line redrawn in place (or printed once per call when output isn't a terminal). */
export function progress(label, done, total, extra = '') {
  const s = `  ${label} ${bar(done, total)}  ${fmt.n(done)}/${fmt.n(total)}${extra ? ` · ${extra}` : ''}`;
  if (tty) {
    // Fit the window exactly: a line longer than the console wraps, and \r then only rewinds the last row.
    const width = Math.max(20, (process.stdout.columns || 80) - 1);
    process.stdout.write(`\r${s.slice(0, width).padEnd(width)}`);
    liveLine = true;
  } else {
    console.log(s);
  }
}

export function budgetLine(spent, budget, thisRun, inProgress = 0) {
  info(
    `💰 Budget ${bar(spent + inProgress, budget)}  ${fmt.usd(spent)} spent` +
      `${inProgress ? ` + ≈${fmt.usd(inProgress)} still with Claude` : ''} of ${fmt.usd(budget)}` +
      `${thisRun != null ? ` · this step ≈ ${fmt.usd(thisRun)}` : ''}`,
  );
}

/** A small aligned table: rows of [label, ...cells], first row is the header. */
export function table(rows) {
  endLive();
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i] ?? '').length)));
  // Numbers (and the · / – placeholders) right-align; text left-aligns.
  const numeric = (c) => /^[\d,.$·–-]*$/.test(String(c ?? ''));
  rows.forEach((r, idx) => {
    const cells = r.map((c, i) => {
      const s = String(c ?? '');
      return i > 0 && (idx === 0 ? rows.slice(1).every((row) => numeric(row[i])) : numeric(s)) ? s.padStart(widths[i]) : s.padEnd(widths[i]);
    });
    console.log(`  ${idx === 0 ? C.bold : ''}${cells.join('   ')}${C.reset}`);
    if (idx === 0) console.log(`  ${C.dim}${widths.map((w) => '─'.repeat(w)).join('   ')}${C.reset}`);
  });
}

export { endLive };
