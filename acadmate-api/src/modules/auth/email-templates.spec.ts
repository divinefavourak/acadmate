import { describe, expect, it } from '@jest/globals';
import {
  ALL_REMINDER_VARIANTS,
  pickReminderVariant,
  reminderEmail,
  reminderVariantsFor,
} from './email-templates';

const DAY = 24 * 60 * 60 * 1000;
const NOV_2026 = new Date('2026-11-25T09:00:00Z');

describe('reminderVariantsFor', () => {
  it('never gives Premium users the upgrade letter', () => {
    expect(reminderVariantsFor('PREMIUM', NOV_2026)).not.toContain('fullMock');
    expect(reminderVariantsFor('FREE', NOV_2026)).toContain('fullMock');
  });

  it('drops letters once their news is stale', () => {
    expect(reminderVariantsFor('FREE', NOV_2026)).toContain('registration2027');
    const later = new Date('2027-06-01T00:00:00Z');
    const options = reminderVariantsFor('FREE', later);
    expect(options).not.toContain('registration2027');
    expect(options).not.toContain('topScorer');
    expect(options.length).toBeGreaterThan(0);
  });
});

describe('pickReminderVariant', () => {
  it('sends a different letter each fortnight to the same user', () => {
    for (const id of ['cm1abc', 'cm9xyz', 'user-42']) {
      let previous = pickReminderVariant(id, 'FREE', NOV_2026);
      for (let i = 1; i <= 6; i++) {
        const next = pickReminderVariant(id, 'FREE', new Date(NOV_2026.getTime() + i * 14 * DAY));
        expect(next).not.toBe(previous);
        previous = next;
      }
    }
  });

  it('only picks letters the plan allows', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickReminderVariant(`user-${i}`, 'PREMIUM', NOV_2026)).not.toBe('fullMock');
    }
  });
});

describe('reminderEmail', () => {
  it('renders every letter with the name, the unsubscribe link and an inbox preview', () => {
    for (const variant of ALL_REMINDER_VARIANTS) {
      const { subject, html } = reminderEmail(variant, 'Ada Obi', 'https://x.test/unsub?t=1');
      expect(subject.length).toBeGreaterThan(10);
      expect(html).toContain('Hi Ada,');
      expect(html).toContain('https://x.test/unsub?t=1');
      expect(html).toContain('display:none');
      expect(html).toContain('/api/email/logo.png');
    }
  });

  it('adds the blog block only when there are posts, and escapes their text', () => {
    const without = reminderEmail('howToStudy', null, 'u');
    expect(without.html).not.toContain('From the Acadmate blog');

    const { html } = reminderEmail('howToStudy', null, 'u', [
      { slug: 'scholarships 2027', title: '<b>Scholarships</b>', excerpt: 'x'.repeat(300) },
    ]);
    expect(html).toContain('From the Acadmate blog');
    expect(html).toContain('/blog/scholarships%202027');
    expect(html).toContain('&lt;b&gt;Scholarships&lt;/b&gt;');
    expect(html).not.toContain('x'.repeat(200));
  });
});
