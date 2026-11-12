// How a form's blocks part into items (docs/spec/directives.md, Rules for every directive): every heading at the level of
// the first begins an item, and what follows, up to the next, is its own; what stands before the first is the intro. The
// renderer reads the core's tree with it and the checks the core's body model, so each gives the readings of its own.
//
// A card's picture and eyebrows may stand right after its heading or right before it (`leading`). The items are read as
// written, each heading's blocks after it; then a run of pictures and eyebrows at the end of what stands before a heading
// moves to that heading's card, unless the card before would lose a run that is all it holds, written right after its
// own heading, or the next card has a block of that kind after its heading already.

/**
 * @template B
 * @param {B[]} blocks The blocks in order.
 * @param {object} readings
 * @param {(block: B) => number | null} readings.levelOf A heading's level, null for any other block.
 * @param {(block: B) => 'picture' | 'eyebrow' | null} [readings.kindOf] What a block that may lead a card is.
 * @param {boolean} [readings.leading] Whether pictures and eyebrows may stand before their item's heading.
 * @returns {{ intro: B[], items: { heading: B, before: B[], blocks: B[] }[] }}
 */
export function seriesItems(blocks, { levelOf, kindOf = () => null, leading = false }) {
  const first = blocks.findIndex((block) => levelOf(block) !== null);
  if (first < 0) return { intro: [...blocks], items: [] };
  const level = levelOf(blocks[first]);
  const intro = blocks.slice(0, first);
  const items = [];
  for (const block of blocks.slice(first)) {
    if (levelOf(block) === level) items.push({ heading: block, before: [], blocks: [] });
    else items.at(-1).blocks.push(block);
  }
  if (!leading) return { intro, items };
  const kinds = (nodes) => new Set(nodes.map(kindOf).filter(Boolean));
  items.forEach((item, index) => {
    const source = index === 0 ? intro : items[index - 1].blocks;
    let from = source.length;
    while (from > 0 && kindOf(source[from - 1])) from -= 1;
    if (from === source.length) return;
    const run = source.slice(from);
    if (index > 0) {
      const has = kinds(item.blocks);
      if ([...kinds(run)].some((kind) => has.has(kind))) return;
      if (items[index - 1].before.length === 0 && from === 0) return;
    }
    source.splice(from);
    item.before = run;
  });
  return { intro, items };
}
