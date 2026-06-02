// Normalises Nigerian phone numbers to E.164 (+234XXXXXXXXXX) so the same
// number entered in any common local format resolves to one stored value.
//
// Accepts: 08012345678, 8012345678, 2348012345678, +2348012345678
// (spaces, dashes and parentheses are ignored).
export function normalizePhone(input: string): string {
  let d = input.replace(/[^\d+]/g, '').replace(/^\+/, '');

  if (d.startsWith('0') && d.length === 11) {
    d = '234' + d.slice(1); // local 0-prefixed → country code
  } else if (d.length === 10) {
    d = '234' + d; // bare 10-digit subscriber number
  }

  return '+' + d;
}

// True when the input looks like a usable phone number rather than an email or
// arbitrary text. Used to route login by identifier.
export function looksLikePhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return !input.includes('@') && digits.length >= 10 && digits.length <= 15;
}
