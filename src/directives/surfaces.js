// Where the design puts a part on a plate of its own, the site writes the Surface this gives, since a stylesheet cannot
// put one on an element (docs/spec/directives.md, How the design reads content). Each part has its plate, and another
// where the band around it already has that kind, so the plate still stands out from its ground.
const PART_SURFACES = Object.freeze({
  'link-card': ['raised', 'page'],
  'action-card': ['tint', 'raised'],
  'behind-card': ['picture-dark', 'picture-dark'],
  'fact-box': ['tint', 'raised'],
  'choice-answer': ['raised', 'page'],
  'choice-panel': ['raised', 'page'],
});

// Each part that takes another plate on a ground of its own kind, as directives.md writes it, for the stylesheet to
// find it there.
const PART_SELECTORS = Object.freeze({
  'link-card': '.kn-card:has(.kn-card-link)',
  'action-card': '.kn-card:has(.kn-actions)',
  'fact-box': '.kn-fact-box',
  'choice-answer': '.kn-choice-answer',
  'choice-panel': '.kn-choice-panel',
});

// `ground` is the Surface kind of the band around the part: left out, or undefined, for the page or a ground not known.
// An unknown part has no plate.
export function surfaceOf(part, ground) {
  if (!Object.hasOwn(PART_SURFACES, part)) return null;
  const [surface, onSame] = PART_SURFACES[part];
  return ground === surface ? onSame : surface;
}

// The pairs in which a part takes another plate on a ground of its own kind: the kind, the plate it turns to, and the
// selector of the parts that do. The generated core gives these parts the other plate where they stand on their own
// kind, so a part written without its ground still stands off it (docs/spec/plates.md, A plate finds its ground).
export function sameGroundPlates() {
  const pairs = new Map();
  for (const [part, [surface, onSame]] of Object.entries(PART_SURFACES)) {
    if (surface === onSame) continue;
    if (!Object.hasOwn(PART_SELECTORS, part)) throw new Error(`${part} takes another plate on its own kind, but has no selector`);
    const key = `${surface} ${onSame}`;
    if (!pairs.has(key)) pairs.set(key, { ground: surface, surface: onSame, parts: [] });
    pairs.get(key).parts.push(PART_SELECTORS[part]);
  }
  return [...pairs.values()].map(({ ground, surface, parts }) => ({ ground, surface, selector: `:is(${parts.join(', ')})` }));
}
