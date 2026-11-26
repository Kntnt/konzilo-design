// A section's grouping, by the rules of docs/spec/directives.md, `section`: its media, its head with the deck, and its
// body. The stylesheet reads the section's layout from these groups, so this states only what the content is.

// About the characters a line of a deck holds beside a heading. A deck is long when its text is longer.
export const DECK_LINE = 70;

const collapse = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// `blocks` is the section's blocks in order, each `{ kind, text }`; `text` is needed only for a paragraph. It returns
// arrays of indexes for the three groups, the deck's index or null, and whether the deck is long. The head holds the
// eyebrows, the heading, the deck and the actions after them, in order.
export function sectionParts(blocks) {
  const kinds = blocks.map((block) => block?.kind);
  const media = [];
  let i = 0;
  while (kinds[i] === 'picture') media.push(i++);

  const head = [];
  let deck = null;
  let next = i;
  while (kinds[next] === 'eyebrow') next++;
  if (kinds[next] === 'heading') {
    for (let eyebrow = i; eyebrow <= next; eyebrow++) head.push(eyebrow);
    const heading = next++;
    const after = kinds.slice(heading + 1);
    const onlyParagraphs = after.length > 0 && after.every((kind) => kind === 'paragraph');
    const leadsToForm = kinds.some((kind) => kind === 'form' || kind === 'choice');
    if (kinds[next] === 'paragraph' && !onlyParagraphs && !leadsToForm) head.push(deck = next++);
    while (kinds[next] === 'actions') head.push(next++);
  }

  const grouped = new Set([...media, ...head]);
  const body = kinds.map((_, index) => index).filter((index) => !grouped.has(index));
  const deckLong = deck !== null && [...collapse(blocks[deck].text)].length > DECK_LINE;
  return { media, head, deck, body, deckLong };
}

// The layouts sectionLayout() names, which the pictures' sizes (src/konzilo/images.js), the presentation's Details page
// and its words read.
export const SECTION_LAYOUTS = Object.freeze({
  photo: Object.freeze(['cropped', 'badges', 'offered']),
  body: Object.freeze(['across', 'beside', 'corners', 'narrow', 'form']),
});

/**
 * Where the stylesheet draws a section's photo and its body, by the rules of section.css, for the sizes of the pictures
 * in them (konzilo.md, Images): its photo `offered` beside a form in its body and shown whole, standing with `badges`,
 * or `cropped`; and its body `beside` the photo, `corners` where the design sets a cropped photo corner to corner,
 * `form` in three fifths after a form beside the heading (rule 2), `narrow` at Narrow where it is centred or holds a
 * form or a choice (rule 3), or `across` the content area. Each is one of SECTION_LAYOUTS.
 * @param {{ kind: string }[]} blocks The section's blocks, as sectionParts() takes them.
 * @param {ReturnType<typeof sectionParts>} parts
 * @param {{ align?: string, body?: string, corners?: boolean }} [section] Its attributes, and whether the design sets a
 *   cropped photo corner to corner.
 * @returns {{ photo: 'offered' | 'badges' | 'cropped', body: 'beside' | 'corners' | 'form' | 'narrow' | 'across' }}
 */
export function sectionLayout(blocks, parts, { align, body: columns, corners = false } = {}) {
  const kinds = blocks.map((block) => block?.kind);
  const body = parts.body.map((at) => kinds[at]);
  const photo = body.includes('form') ? 'offered' : parts.media.length > 1 ? 'badges' : 'cropped';
  if (parts.media.length) return { photo, body: photo === 'cropped' && corners ? 'corners' : 'beside' };
  const bare = parts.head.length > 0 && parts.deck === null && !parts.head.some((at) => kinds[at] === 'actions');
  if (bare && body[0] === 'form') return { photo, body: 'form' };
  if (body.includes('form') || body.includes('choice') || (align === 'center' && columns !== 'columns')) return { photo, body: 'narrow' };
  return { photo, body: 'across' };
}
