#!/usr/bin/env node
// Re-authorises the API to send email through Gmail: gets a fresh refresh token
// for the sender account and installs it on the server. Run it again whenever
// email stops with "invalid_grant" (password changed, access removed, or the
// OAuth app was left in Testing, where tokens expire after 7 days).
//
//   ACADMATE_SSH_HOST=user@host ACADMATE_ENV_PATH=/path/to/acadmate-api/.env.production \
//     node acadmate-api/scripts/gmail-token.mjs
//
// The host and path are not in this public repo: they are the same values as
// the deploy workflow's SSH_USER@SSH_HOST and DEPLOY_PATH secrets.
//
// What it does:
// 1. Reads GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SMTP_FROM from the
//    server's .env.production over ssh, into memory only.
// 2. Opens Google's consent page (gmail.send) in the browser. If it opens in
//    the wrong browser profile, copy the printed link into one signed in as
//    the sender account.
// 3. Receives the code on http://localhost:53682/oauth2callback and exchanges
//    it. That URI must be an authorised redirect URI on the OAuth client.
// 4. Refuses to save unless the approving account is the SMTP_FROM address.
// 5. Backs up .env.production, writes GMAIL_USER and GMAIL_REFRESH_TOKEN, and
//    recreates the api container.
// The token and the client secret are never printed; the token reaches the
// server over ssh stdin, not on a command line.
//
// Google Cloud prerequisites (once): Gmail API enabled, the redirect URI above
// added to the OAuth client, and the consent screen set to "In production".
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const HOST = process.env.ACADMATE_SSH_HOST;
const ENV_PATH = process.env.ACADMATE_ENV_PATH;
if (!HOST || !ENV_PATH) {
  console.error('Set ACADMATE_SSH_HOST (user@host) and ACADMATE_ENV_PATH (full path to acadmate-api/.env.production).');
  process.exit(2);
}
// The compose file sits two levels up from acadmate-api/.env.production.
const DEPLOY_DIR = path.posix.dirname(path.posix.dirname(ENV_PATH));

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'openid', 'email'];
const TIMEOUT_MS = 20 * 60 * 1000;
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // shell-quote for the remote side

const ssh = (cmd, input) =>
  execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'LogLevel=ERROR', HOST, cmd], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

// ── 1. Client credentials from the server ──
const env = Object.fromEntries(
  ssh(`grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SMTP_FROM)=' ${q(ENV_PATH)}`)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;
const sender = (env.SMTP_FROM?.match(/<([^>]+)>/)?.[1] ?? env.SMTP_FROM ?? '').toLowerCase();
if (!clientId || !clientSecret || !sender) {
  console.error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or SMTP_FROM is missing on the server.');
  process.exit(1);
}
console.log(`OAuth client: ${clientId.split('-')[0]}-…apps.googleusercontent.com`);
console.log(`Approve as: ${sender}`);

// ── 2. Consent URL ──
const state = crypto.randomBytes(16).toString('hex');
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token, even if approved before
    login_hint: sender,
    state,
  });

const page = (title, text) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:Segoe UI,sans-serif;max-width:520px;margin:15vh auto;line-height:1.6"><h1 style="font-size:22px">${title}</h1><p>${text}</p></body>`;

let done = false;
const timer = setTimeout(() => {
  if (done) return;
  console.error('Timed out waiting for Google. Run the script again.');
  process.exit(1);
}, TIMEOUT_MS);

// ── 3–5. Callback, exchange, install ──
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth2callback' || done) return res.writeHead(404).end();

  const reply = (status, title, text) =>
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }).end(page(title, text));
  // Retryable problems keep the server waiting, so the browser link can be tried again.
  const retry = (title, text, log) => {
    reply(400, title, text);
    console.error(log);
  };

  try {
    const error = url.searchParams.get('error');
    if (error) return retry('Not approved', `Google said: ${error}. Open the link again to retry.`, `Google returned: ${error}`);
    if (url.searchParams.get('state') !== state) return retry('Old link', 'Use the link printed in the terminal.', 'State mismatch; ignored.');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code') ?? '',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) return retry('Exchange failed', 'Open the link again to retry.', `Token exchange failed: ${tokens.error} ${tokens.error_description ?? ''}`);
    if (!tokens.refresh_token) return retry('No refresh token', 'Open the link again to retry.', 'Google returned no refresh_token.');
    if (!String(tokens.scope ?? '').includes('gmail.send'))
      return retry('Permission not granted', 'Allow "Send email on your behalf" when Google asks.', `gmail.send not granted (got: ${tokens.scope})`);

    // Which account approved? Must be the sender, or every email would fail.
    const claims = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString());
    const who = String(claims.email ?? '').toLowerCase();
    if (who !== sender)
      return retry('Wrong Google account', `You approved as ${who}. Open the link in a browser signed in as ${sender}.`, `Approved by ${who}, expected ${sender}. Nothing saved.`);

    done = true;
    ssh(
      `set -e; cd ${q(DEPLOY_DIR)}; f=${q(ENV_PATH)}; cp "$f" "$f.bak-$(date +%Y%m%d-%H%M%S)"; ` +
        `grep -vE '^(GMAIL_USER|GMAIL_REFRESH_TOKEN)=' "$f" > "$f.tmp"; cat >> "$f.tmp"; chmod --reference="$f" "$f.tmp"; mv "$f.tmp" "$f"; ` +
        `docker compose -f docker-compose.prod.yml up -d --force-recreate api >/dev/null 2>&1`,
      `GMAIL_USER=${sender}\nGMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`,
    );
    reply(200, 'Done', `Acadmate can now send email as ${sender}. You can close this tab.`);
    console.log(`Saved GMAIL_USER and GMAIL_REFRESH_TOKEN for ${sender}, backed up the old file, and restarted the API.`);
    console.log('Check: the API log should show "Gmail API configured".');
    clearTimeout(timer);
    server.close();
  } catch (err) {
    done = false;
    reply(500, 'Something went wrong', 'Check the terminal.');
    console.error(`Error: ${err.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Waiting for Google on ${REDIRECT} (up to 20 minutes).`);
  console.log(`If the wrong browser opens, paste this link into one signed in as ${sender}:\n${authUrl}`);
  spawn(process.platform === 'win32' ? 'rundll32' : process.platform === 'darwin' ? 'open' : 'xdg-open',
    process.platform === 'win32' ? ['url.dll,FileProtocolHandler', authUrl] : [authUrl],
    { detached: true, stdio: 'ignore' }).unref();
});
