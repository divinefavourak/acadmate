/**
 * HTML for engagement emails: the welcome email and the fortnightly letters.
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

/** A URL on the API itself (serves both the pre-launch site and beta). */
export function apiUrl(path = ''): string {
  const base = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${base}${path}`;
}

/** "Ada Obi" → "Ada". Falls back to "there" so the greeting still reads. */
export function firstName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? escapeHtml(first) : 'there';
}

// ─── Building blocks ─────────────────────────────────────────────────────────

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:13px 22px;background:#0874d4;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${label}</a>`;

const link = (href: string, label: string) =>
  `<a href="${href}" style="color:#0874d4;font-weight:600">${label}</a>`;

const p = (html: string) => `<p style="margin:0 0 16px">${html}</p>`;

const h1 = (text: string) =>
  `<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#0d1d2f">${text}</h1>`;

const h2 = (text: string) =>
  `<h2 style="margin:28px 0 10px;font-size:18px;line-height:1.35;color:#0d1d2f">${text}</h2>`;

const ol = (items: string[]) =>
  `<ol style="margin:0 0 18px;padding-left:22px">${items.map((i) => `<li style="margin-bottom:10px">${i}</li>`).join('')}</ol>`;

const ul = (items: string[]) =>
  `<ul style="margin:0 0 18px;padding-left:22px">${items.map((i) => `<li style="margin-bottom:10px">${i}</li>`).join('')}</ul>`;

const quote = (text: string) =>
  `<blockquote style="margin:0 0 18px;padding:4px 0 4px 16px;border-left:4px solid #16b985;color:#0d1d2f;font-size:17px;font-style:italic">${text}</blockquote>`;

/** A tinted box for the one thing to do this week. */
const callout = (title: string, html: string) => `
  <div style="margin:24px 0;padding:18px 20px;background:#eef6fe;border-left:4px solid #0874d4;border-radius:8px">
    <p style="margin:0 0 8px;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#0874d4">${title}</p>
    <div style="color:#1e293b">${html}</div>
  </div>`;

const signoff = `<p style="margin:24px 0 0">Keep going,<br/><strong>The Acadmate team</strong></p>`;

const ps = (html: string) => `<p style="margin:20px 0 0;color:#475569;font-size:14px"><strong>P.S.</strong> ${html}</p>`;

/** Hidden text that inbox lists show next to the subject line. */
const preheader = (text: string) =>
  `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${text}</div>`;

function layout(body: string, footer: string, inboxPreview = ''): string {
  return `
<div style="background:#f4f7fb;padding:24px 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  ${inboxPreview ? preheader(inboxPreview) : ''}
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <div style="background:#0d1d2f;padding:14px 24px">
      <a href="${frontendUrl('/')}" style="text-decoration:none">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;padding-right:10px"><img src="${apiUrl('/api/email/logo.png')}" width="44" height="44" alt="" style="display:block;border:0;outline:none"></td>
          <td style="vertical-align:middle"><span style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:-0.01em">Acadmate</span></td>
        </tr></table>
      </a>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#1a91f0,#16b985)"></div>
    <div style="padding:28px 24px;color:#1e293b;font-size:16px;line-height:1.65">${body}</div>
  </div>
  <p style="max-width:600px;margin:16px auto 0;color:#64748b;font-size:12px;line-height:1.5;text-align:center">${footer}</p>
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

// ─── Fortnightly letters ─────────────────────────────────────────────────────
//
// Each inactive student gets at most one letter a fortnight (see
// EngagementService). A letter is a proper read with one clear thing to do,
// and some letters carry news that goes stale, so those have an `until` date
// after which nobody is sent them.

type Plan = 'FREE' | 'PREMIUM';

export type ReminderVariant =
  | 'registration2027'
  | 'topScorer'
  | 'howToStudy'
  | 'ifThenPlan'
  | 'marksMath'
  | 'fullMock';

/** A published blog post, as the "From the blog" block shows it. */
export interface BlogTeaser {
  slug: string;
  title: string;
  excerpt: string;
}

interface Letter {
  subject: (first: string) => string;
  /** One line that inbox lists show after the subject. Plain text. */
  inboxPreview: string;
  body: (first: string) => string;
  plans: Plan[];
  /** Stop sending this letter after this date (the news in it has gone stale). */
  until?: Date;
}

const BOTH: Plan[] = ['FREE', 'PREMIUM'];

const LETTERS: Record<ReminderVariant, Letter> = {
  // Sources: JAMB advisories on @jamb_hq, 4, 6 and 16 Nov 2026 (reported by
  // Legit.ng, Blueprint, CrispNG); NIN alignment reopening, 16 Oct 2026;
  // e-Facility course changes, Vanguard, 18 Nov 2026. 2026 registration ran
  // 26 Jan to 28 Feb 2026. JAMB had not announced 2027 dates as of Nov 2026.
  registration2027: {
    subject: (first) => `${first === 'there' ? 'Five' : `${first}, five`} JAMB registration mistakes to fix now`,
    inboxPreview: 'JAMB has told 2027 candidates what goes wrong at registration. Most of it you can fix this week.',
    plans: BOTH,
    until: new Date('2027-03-01T00:00:00Z'),
    body: (first) => `
      ${h1('Get your 2027 registration right before it opens')}
      ${p(`Hi ${first},`)}
      ${p('JAMB hasn’t announced the dates for 2027 UTME registration yet. Last year it ran from 26 January to 28 February, so you have a few weeks. Use them, because JAMB spent most of November warning candidates about the same handful of mistakes, and every one of them happens before you sit a single question.')}
      ${p('These come from JAMB’s own posts on its official X account (@jamb_hq):')}
      ${ol([
        '<strong>A wrong subject combination.</strong> JAMB says the wrong four subjects can make you ineligible for your course no matter what you score. Two courses with similar names can need different subjects. Check yours on JAMB’s official brochure site, ' + link('https://ibass.jamb.gov.ng', 'IBASS') + ', not with a friend or the café operator.',
        '<strong>Not checking the admission requirements.</strong> Your school and course want specific O’level credits too. Look them up before you register, so you don’t find a gap after your result comes out.',
        '<strong>Details that don’t match your NIN.</strong> JAMB pulls your name and date of birth from your NIN record, and fixing them later is hard. If your NIN record is wrong, correct it with NIMC first. JAMB reopened its NIN alignment service in October for candidates whose records don’t match.',
        '<strong>Letting someone else register you.</strong> JAMB warned on 16 November against group registration and agents: <em>“You need to understand what is being entered on your behalf.”</em> Sit beside whoever types, and read every field before you submit.',
        '<strong>Following rumours.</strong> Registration dates and “JAMB said” posts on WhatsApp are often wrong. Take dates only from jamb.gov.ng or JAMB’s verified accounts.',
      ])}
      ${callout('This week', `
        ${p('Spend fifteen minutes on two checks: open IBASS and confirm the subject combination for your first-choice course, then open your NIN slip and compare it letter by letter with how you write your name.')}
        <p style="margin:0">Once that’s done, the rest of your time can go to scoring well.</p>`)}
      ${h2('Then put in some practice')}
      ${p('Registration is paperwork. Your score comes from the months after it. A twenty-question session on the CBT screen takes about fifteen minutes and shows you exactly where you stand.')}
      <p style="margin:0 0 8px">${button(frontendUrl('/exam/new'), 'Start a practice session')}</p>
      ${signoff}
      ${ps('JAMB has also moved change of course or institution fully online, through the e-Facility portal. You no longer need to visit an office, and you shouldn’t pay anyone to do it for you or share your OTP.')}`,
  },

  // Sources: Legit.ng interviews of 7, 12 and 18 May 2026; Tribune, 11 May 2026.
  topScorer: {
    subject: () => 'How the 2026 top scorer got 372',
    inboxPreview: 'She was 16, she had a bad first attempt, and she didn’t study all day. Here’s what she did.',
    plans: BOTH,
    until: new Date('2027-05-01T00:00:00Z'),
    body: (first) => `
      ${h1('How the 2026 top scorer got 372')}
      ${p(`Hi ${first},`)}
      ${p('Owoeye Daniella Jesudunsin scored 372 out of 400 in the 2026 UTME, the highest in Nigeria. She was 16. Her breakdown: English 98, Chemistry 98, Physics 94, Biology 82.')}
      ${p('The part most people skipped: 2026 was her second try. She sat the UTME in 2025 too and, in her words, <em>“couldn’t gain admission due to the glitches I experienced in my exam centre.”</em> She started preparing again straight away.')}
      ${p('She told reporters how she prepared, and almost none of it needs money or a famous school. She said herself that she didn’t attend one.')}
      ${h2('1. She wrote down a number')}
      ${quote('“I wrote 370+, and then I aimed towards it.”')}
      ${p('She also said raising the target wasn’t the point: <em>“increasing the goal is not the key, but increasing my efforts, my actions.”</em> A number on paper tells you how far you are each week.')}
      ${h2('2. She treated her phone alarm like a school bell')}
      ${quote('“I set an alarm on my phone. So, I saw that as my own school bell.”')}
      ${p('She read from the time she woke up until about 11:30 in the morning, then took breaks. She also said, <em>“I didn’t study 24 hours a day.”</em> A fixed block that starts on time beats a long day you never begin.')}
      ${h2('3. She kept social media out of her breaks')}
      ${p('Her view was that scrolling doesn’t rest your brain. Breaks were for resting. The phone was for the alarm.')}
      ${h2('4. She made past questions her “best friend”')}
      ${p('Her phrase. She used past-question books, CBT practice sites and free online material. Past questions show you how JAMB words things, which topics come back year after year, and how fast you need to move.')}
      ${h2('5. She worked on her weak subject early')}
      ${p('She found her strengths and weaknesses first and gave each subject the time it needed. Her advice to candidates was to attack weak points early, not in April.')}
      ${callout('Copy one thing this week', `
        <p style="margin:0">Pick a time tomorrow, set an alarm for it, and when it rings, do one twenty-question session in your weakest subject. Write the score down. Do the same next week and compare.</p>`)}
      <p style="margin:0 0 8px">${button(frontendUrl('/exam/new'), 'Start that session')}</p>
      ${signoff}
      ${ps(`Your analytics page lists the topics you miss most once you’ve done a few sessions. ${link(frontendUrl('/analytics'), 'See yours')}.`)}`,
  },

  // Sources: spacing meta-analysis (Latimier et al., 2021); retrieval practice
  // in classrooms review (Agarwal et al., 2021).
  howToStudy: {
    subject: (first) => `${first === 'there' ? 'Why' : `${first}, why`} rereading your notes isn’t working`,
    inboxPreview: 'Two study habits with decades of research behind them, and how to use both before JAMB.',
    plans: BOTH,
    body: (first) => `
      ${h1('Two study habits that work, and one that only feels like it does')}
      ${p(`Hi ${first},`)}
      ${p('You read a chapter on electrolysis twice. The second time, everything looks familiar, so it feels learnt. Then a JAMB question asks it a different way and the page in your head goes blank.')}
      ${p('Familiar is a weak kind of knowing. Recognising something when you see it is easier than pulling it out of your head with nothing in front of you, and the exam asks for the second. Researchers who study memory have tested this for decades, and two habits come out ahead.')}
      ${h2('1. Test yourself, then check')}
      ${p('Psychologists call it <strong>retrieval practice</strong>. Each time you force an answer out of memory, you make that answer easier to find next time. A review of studies in real schools and classrooms found it helped students learn, across subjects and ages.')}
      ${p('In practice:')}
      ${ul([
        'Close the textbook and write down everything you remember about a topic. Then open it and check what you missed.',
        'Answer a past question before you look at the options. Then pick the option.',
        'Get it wrong, read why, and try the same topic again a few days later.',
      ])}
      ${p('Getting answers wrong in practice is part of how this works. The struggle to remember is what makes the memory stick.')}
      ${h2('2. Spread it out')}
      ${p('The second habit is <strong>spacing</strong>: four 30-minute sessions on a topic across two weeks, rather than two hours in one night. A large analysis of spacing studies found spaced practice lifted final test scores by more than half a standard deviation over cramming the same material. For a student near the middle of the class, that can mean moving well into the top third.')}
      ${p('Students tend to avoid both habits because they feel slower. Rereading feels smooth; testing yourself feels like failing. Trust the result over the feeling.')}
      ${callout('A two-week plan', `
        ${ol([
          '<strong>Day 1:</strong> twenty questions in one subject. Note the three topics you missed most.',
          '<strong>Day 2:</strong> read the explanations for those misses, then close everything and write what you remember.',
          '<strong>Day 5:</strong> twenty more questions in the same subject.',
          '<strong>Day 12:</strong> once more. Compare your three scores.',
        ])}
        <p style="margin:0">Fit other subjects into the gaps between.</p>`)}
      <p style="margin:0 0 8px">${button(frontendUrl('/exam/new'), 'Do Day 1 now')}</p>
      ${signoff}
      ${ps(`Every past question on Acadmate has a worked explanation when you’re signed in, so Day 2 is covered. ${link(frontendUrl('/past-questions'), 'Browse past questions')}.`)}`,
  },

  // Sources: Gollwitzer on implementation intentions; Duckworth et al. (2011),
  // mental contrasting + implementation intentions with 66 high school students
  // preparing for a high-stakes exam.
  ifThenPlan: {
    subject: () => 'The one-sentence plan that makes you actually study',
    inboxPreview: 'Students who wrote this kind of sentence did 60% more practice questions. It takes two minutes.',
    plans: BOTH,
    body: (first) => `
      ${h1('The one-sentence plan that makes you actually study')}
      ${p(`Hi ${first},`)}
      ${p('Most students who fall behind meant to study. The plan was “I’ll read Physics this week,” and the week ended without a moment that felt like the right time.')}
      ${p('Psychologists have a fix with nearly a hundred studies behind it. They call it an <strong>if-then plan</strong>. You decide in advance the exact moment you’ll act and what you’ll do:')}
      ${quote('If it’s 4pm and I’ve eaten after school, then I’ll do twenty Physics questions before I touch my phone.')}
      ${p('When 4pm comes, you don’t have to decide anything. You already did.')}
      ${h2('It works for exam prep')}
      ${p('In one experiment, high school students preparing for a big standardised exam spent a short session doing a simple routine before their holiday. The students who did it completed more than 60% more practice questions than the ones who didn’t.')}
      ${p('The routine had four steps, and you can do it in two minutes:')}
      ${ol([
        '<strong>Wish.</strong> Name the outcome: “250 in JAMB,” or “admission to study Nursing.”',
        '<strong>Picture the best result.</strong> Spend a moment on how it would feel to see that score.',
        '<strong>Name the real obstacle.</strong> Be honest. “I start scrolling after school and lose the evening.”',
        '<strong>Write the if-then.</strong> “If I pick up my phone after school, then I’ll open a practice session first.”',
      ])}
      ${p('The third step matters. Picturing success alone can make you feel you’ve already done something. Naming the obstacle is what turns the wish into a plan.')}
      ${callout('Write yours now', `
        ${p('Finish this sentence and put it where you’ll see it, on your wall or as your phone’s lock screen:')}
        <p style="margin:0"><strong>If</strong> it’s ________ and I’ve ________, <strong>then</strong> I’ll ________.</p>`)}
      ${p('Then do the first one today, so the plan has a first entry.')}
      <p style="margin:0 0 8px">${button(frontendUrl('/exam/new'), 'Do today’s session')}</p>
      ${signoff}
      ${ps('Make the “then” small. Twenty questions you do every day will take you further than two hours you keep putting off.')}`,
  },

  // Facts: UTME is 4 subjects scored out of 100 each; Use of English has 60
  // questions and the others 40, 180 in all. 2026: of 1.8m results released,
  // ~26% scored 200+ (Leadership, May 2026). Minimum university cut-off for
  // 2026/2027 is 150; competitive courses ask much more.
  marksMath: {
    subject: () => 'You’re closer to 250 than you think',
    inboxPreview: 'Fifty more marks in JAMB works out to about four extra right answers per subject. Here’s the arithmetic.',
    plans: BOTH,
    body: (first) => `
      ${h1('You’re closer to 250 than you think')}
      ${p(`Hi ${first},`)}
      ${p('A score of 250 can feel like a different league from 200. Run the arithmetic and the gap gets much smaller.')}
      ${h2('How JAMB counts')}
      ${p('The UTME is four subjects, each marked out of 100, for 400 in total. Use of English has 60 questions. Your other three subjects have 40 each.')}
      ${p('So in a 40-question subject, every right answer is worth 2.5 marks. In English, each one is worth about 1.7.')}
      ${callout('The arithmetic', `
        <p style="margin:0 0 10px">To go up <strong>50 marks</strong> in total, you need about:</p>
        ${ul([
          '<strong>4 or 5 more right answers</strong> in each 40-question subject, and',
          '<strong>7 more</strong> in English.',
        ])}
        <p style="margin:0">That’s about 20 extra correct answers out of 180. One or two weak topics per subject often account for all of them.</p>`)}
      ${h2('Where the 2026 candidates landed')}
      ${p('Of the results JAMB had released by May 2026, about one candidate in four scored 200 or more. The minimum score for university admission this session is 150, but that is only the floor. Courses like Medicine, Law, Nursing and Engineering at popular schools ask for far more, and the school’s own screening comes after.')}
      ${p('So a few more right answers per subject can move you from the crowded middle into the group that gets real choices.')}
      ${h2('How to find your twenty')}
      ${ol([
        'Do two or three practice sessions in each of your four subjects.',
        'Open your analytics. It lists the topics you miss most.',
        'Pick the weakest topic in each subject and spend one week on it: explanations first, then questions.',
        'Practise again and watch the topic’s percentage.',
      ])}
      ${p('Each topic you fix adds the few marks it was costing you.')}
      <p style="margin:0 0 8px">${button(frontendUrl('/analytics'), 'See your weakest topics')}</p>
      ${p(`<span style="color:#475569;font-size:14px">No sessions yet? ${link(frontendUrl('/exam/new'), 'Start with one')} and your analytics fills in as you go.</span>`)}
      ${signoff}`,
  },

  // Facts: UTME is 180 questions in 2 hours (120 minutes) → 40 seconds each.
  fullMock: {
    subject: () => 'Can you answer 180 questions in two hours?',
    inboxPreview: 'Forty seconds per question, four subjects, one clock. A full mock shows you how you’ll handle it.',
    plans: ['FREE'],
    body: (first) => `
      ${h1('Can you answer 180 questions in two hours?')}
      ${p(`Hi ${first},`)}
      ${p('That is the real UTME: four subjects, 180 questions, 120 minutes, on a computer screen. Averaged out, you get <strong>40 seconds per question</strong>.')}
      ${p('Plenty of candidates know their work and still lose marks because the clock catches them. They spend six minutes on one calculation in Physics, then rush the last twenty English questions. Or they start strong and fade in the second hour.')}
      ${h2('What a full mock teaches you')}
      ${ul([
        '<strong>Your pace.</strong> You find out whether you finish, and which subject eats your time.',
        '<strong>Your order.</strong> Some students do English first to settle in; some leave it for last. A mock lets you test both.',
        '<strong>When to skip.</strong> On a hard question, mark it, move on, and come back. You only build that habit under a real clock.',
        '<strong>Your stamina.</strong> Two hours of focus is a skill. Your score in the last thirty minutes tells you how well you hold up.',
      ])}
      ${p('Short practice sessions build knowledge. Full mocks build exam control. You need both before the day.')}
      ${callout('Premium on Acadmate', `
        ${p('Premium gives you full four-subject mocks timed like the UTME, plus practice sessions of any length in any subject. It’s one payment, not a subscription.')}
        <p style="margin:0">Message us on WhatsApp and we’ll tell you the price and how to pay.</p>`)}
      <p style="margin:0 0 16px">${button(WHATSAPP_URL, 'Ask us about Premium')}</p>
      ${p(`<span style="color:#475569;font-size:14px">Not ready yet? ${link(frontendUrl('/exam/new'), 'Keep practising free')}. A timed session still trains your pace.</span>`)}
      ${signoff}
      ${ps('In your next free session, check your average time per question at the end. If it’s over 40 seconds, practise speed in that subject before anything else.')}`,
  },
};

/** Letters a user can get today: right plan, and not past its `until` date. */
export function reminderVariantsFor(plan: Plan, now = new Date()): ReminderVariant[] {
  return (Object.keys(LETTERS) as ReminderVariant[]).filter((v) => {
    const letter = LETTERS[v];
    return letter.plans.includes(plan) && (!letter.until || now < letter.until);
  });
}

/** Every letter, including expired ones, for the admin preview send. */
export const ALL_REMINDER_VARIANTS = Object.keys(LETTERS) as ReminderVariant[];

const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Which letter this user gets now. It steps through the list one letter per
 * fortnight, offset per user so a day's batch gets a mix. A user hears from us
 * at most once a fortnight, so two letters in a row always fall in different
 * fortnights and differ, without storing what we sent last.
 */
export function pickReminderVariant(userId: string, plan: Plan, now = new Date()): ReminderVariant {
  const options = reminderVariantsFor(plan, now);
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const fortnight = Math.floor(now.getTime() / FORTNIGHT_MS);
  return options[(fortnight + hash) % options.length];
}

function blogBlock(posts: BlogTeaser[]): string {
  if (posts.length === 0) return '';
  const items = posts
    .map(
      (post) => `
      <div style="margin:0 0 14px">
        <a href="${frontendUrl(`/blog/${encodeURIComponent(post.slug)}`)}" style="color:#0d1d2f;font-weight:700;text-decoration:none;font-size:16px">${escapeHtml(post.title)}</a>
        <p style="margin:4px 0 0;color:#475569;font-size:14px;line-height:1.5">${escapeHtml(post.excerpt.length > 160 ? `${post.excerpt.slice(0, 157).trimEnd()}…` : post.excerpt)}</p>
      </div>`,
    )
    .join('');
  return `
    <div style="margin:32px 0 0;padding-top:20px;border-top:1px solid #e2e8f0">
      <p style="margin:0 0 14px;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#16b985">From the Acadmate blog</p>
      ${items}
      <p style="margin:0;font-size:14px">${link(frontendUrl('/blog'), 'More articles')}</p>
    </div>`;
}

export function reminderEmail(
  variant: ReminderVariant,
  name: string | null,
  unsubscribeLink: string,
  posts: BlogTeaser[] = [],
): { subject: string; html: string } {
  const first = firstName(name);
  const letter = LETTERS[variant];
  const footer = `You’re getting this because you have an Acadmate account. We write about once a fortnight at most. <a href="${unsubscribeLink}" style="color:#64748b">Stop these emails</a>`;
  return {
    subject: letter.subject(first),
    html: layout(letter.body(first) + blogBlock(posts), footer, letter.inboxPreview),
  };
}
