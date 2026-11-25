/**
 * HTML for engagement emails: the welcome email and the practice reminders.
 * Inline styles only (email clients drop <style>), one column, works without
 * images. Colours follow the site: navy #0D1D2F, brand blue #0874D4, mint #16B985.
 */

export const WHATSAPP_URL = 'https://wa.me/2349031843486';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function frontendUrl(path = ''): string {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

/** "Ada Obi" → "Ada". Falls back to "there" so the greeting still reads. */
export function firstName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? escapeHtml(first) : 'there';
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:13px 22px;background:#0874d4;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${label}</a>`;

const link = (href: string, label: string) =>
  `<a href="${href}" style="color:#0874d4;font-weight:600">${label}</a>`;

function layout(body: string, footer: string): string {
  return `
<div style="background:#f4f7fb;padding:24px 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <div style="background:#0d1d2f;padding:18px 24px">
      <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.01em">Acadmate</span>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#1a91f0,#16b985)"></div>
    <div style="padding:28px 24px;color:#1e293b;font-size:16px;line-height:1.6">${body}</div>
  </div>
  <p style="max-width:560px;margin:16px auto 0;color:#64748b;font-size:12px;line-height:1.5;text-align:center">${footer}</p>
</div>`;
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function welcomeEmail(name: string | null): { subject: string; html: string } {
  const first = firstName(name);
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;color:#0d1d2f">Welcome to Acadmate, ${first}</h1>
    <p style="margin:0 0 16px">Your account is ready. Here’s where to start:</p>
    <ul style="margin:0 0 20px;padding-left:20px">
      <li style="margin-bottom:10px"><strong>Take a practice session.</strong> Pick a subject, answer on a timed CBT screen, and see your score straight away.</li>
      <li style="margin-bottom:10px"><strong>Read past questions.</strong> Real JAMB papers by subject and year, each with its answer. ${link(frontendUrl('/past-questions'), 'Browse them')}</li>
      <li><strong>Read the explanations.</strong> Now that you’re signed in, every answer comes with a worked explanation.</li>
    </ul>
    <p style="margin:0 0 24px">${button(frontendUrl('/exam/new'), 'Start your first session')}</p>
    <p style="margin:0;color:#475569;font-size:14px">Questions about your account? ${link(WHATSAPP_URL, 'Message us on WhatsApp')}.</p>`;
  return {
    subject: `Welcome to Acadmate, ${first === 'there' ? 'let’s get started' : first}`,
    html: layout(body, 'You’re getting this because you just created an Acadmate account.'),
  };
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export type ReminderVariant = 'practice' | 'pastPapers' | 'weakTopics' | 'premiumMock';

/** Reminder kinds a user can get. Premium users never get the upgrade nudge. */
export function reminderVariantsFor(plan: 'FREE' | 'PREMIUM'): ReminderVariant[] {
  return plan === 'FREE'
    ? ['practice', 'pastPapers', 'weakTopics', 'premiumMock']
    : ['practice', 'pastPapers', 'weakTopics'];
}

export function reminderEmail(
  variant: ReminderVariant,
  name: string | null,
  unsubscribeLink: string,
): { subject: string; html: string } {
  const first = firstName(name);
  const footer = `You’re getting this because you have an Acadmate account. We send these now and then, not every day. <a href="${unsubscribeLink}" style="color:#64748b">Stop these reminders</a>`;

  const content: Record<ReminderVariant, { subject: string; body: string }> = {
    practice: {
      subject: `${first === 'there' ? 'Twenty' : `${first}, twenty`} questions today?`,
      body: `
        <p style="margin:0 0 16px">Hi ${first},</p>
        <p style="margin:0 0 16px">Short, regular sessions are how JAMB scores go up. Pick one subject, answer twenty questions on the CBT screen, and see your score the moment you finish.</p>
        <p style="margin:0 0 8px">${button(frontendUrl('/exam/new'), 'Start a practice session')}</p>`,
    },
    pastPapers: {
      subject: 'A JAMB past paper to try this week',
      body: `
        <p style="margin:0 0 16px">Hi ${first},</p>
        <p style="margin:0 0 16px">Pick a subject and a year and work through a real past paper. Every question shows its answer, and the worked explanation tells you why.</p>
        <p style="margin:0 0 8px">${button(frontendUrl('/past-questions'), 'Pick a past paper')}</p>`,
    },
    weakTopics: {
      subject: 'Which topics are costing you marks?',
      body: `
        <p style="margin:0 0 16px">Hi ${first},</p>
        <p style="margin:0 0 16px">JAMB marks you out of 400, and the quickest marks usually hide in a few weak topics. A couple of practice sessions are enough for your analytics to show you which ones.</p>
        <p style="margin:0 0 8px">${button(frontendUrl('/exam/new'), 'Practise and find out')}</p>`,
    },
    premiumMock: {
      subject: 'Ready for a full JAMB mock?',
      body: `
        <p style="margin:0 0 16px">Hi ${first},</p>
        <p style="margin:0 0 16px">The real UTME is four subjects in two hours. Premium lets you sit full mocks exactly like that, with sessions of any length. It’s one payment, not a subscription.</p>
        <p style="margin:0 0 16px">${button(WHATSAPP_URL, 'Ask us about Premium')}</p>
        <p style="margin:0;color:#475569;font-size:14px">Not yet? ${link(frontendUrl('/exam/new'), 'Keep practising free')}.</p>`,
    },
  };

  const { subject, body } = content[variant];
  return { subject, html: layout(body, footer) };
}
