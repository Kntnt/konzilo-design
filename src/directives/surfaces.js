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

// `ground` is the Surface kind of the band around the part, undefined for the page. An unknown part has no plate.
export function surfaceOf(part, ground) {
  if (!Object.hasOwn(PART_SURFACES, part)) return null;
  const [surface, onSame] = PART_SURFACES[part];
  return ground === surface ? onSame : surface;
}
