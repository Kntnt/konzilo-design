// What a card series needs stated at build, since no selector can read it from text (docs/spec/directives.md, `cards`).

// A telephone number as people write one: digits, with an optional leading plus, spaces, dots, hyphens, dashes,
// slashes and parentheses between them, and at least three digits, so "112" is one and "Call us" is none.
const PHONE = /^\+?[\d\s().\/‐-―-]+$/;
// An address as people write one: a local part, an at sign and a domain with a dot, none of them with white space.
const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:".]+$/;

// 'phone' for a tel: link whose text is a telephone number, 'email' for a mailto: link whose text is an address,
// and null for anything else, such as a tel: link whose text is "Call us".
export function contactOf(href, text) {
  if (typeof href !== 'string' || typeof text !== 'string') return null;
  const scheme = href.trim().match(/^([a-z][a-z\d+.-]*):/i)?.[1].toLowerCase();
  const words = text.replace(/\s+/g, ' ').trim();
  if (scheme === 'tel') return PHONE.test(words) && (words.match(/\d/g)?.length ?? 0) >= 3 ? 'phone' : null;
  if (scheme === 'mailto') return EMAIL.test(words) ? 'email' : null;
  return null;
}
