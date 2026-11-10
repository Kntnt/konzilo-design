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
