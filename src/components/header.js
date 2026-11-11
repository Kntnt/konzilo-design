// What the header decides at build time. Its behaviour in the browser is HTML and CSS (header.md, How it is built):
// no script measures it, follows the scrolling or opens its panels.

export const GIVING_WAY_ORDER = ['slogan', 'name', 'links', 'word', 'language', 'cta', 'search'];
const ARRANGEMENTS = {
  A: [['identity'], ['search', 'language', 'links', 'menu', 'cta']],
  B: [['identity', 'links'], ['search', 'language', 'menu', 'cta']],
  C: [['identity', 'links', 'search'], ['language', 'menu', 'cta']],
};
export function arrangementGroups(arrangement, items = {}) {
  if (!ARRANGEMENTS[arrangement]) throw new TypeError('Unknown header arrangement');
  return ARRANGEMENTS[arrangement].map((group) => group.filter((item) => item === 'identity' || items[item]));
}

// The giving-way steps a header can take, in order: a step with nothing to take is left out, so the bar is written
// with one hidden copy per step that remains. A name without a logo never goes, and a word goes only from a button
// that has one, whether its own or the one that appears when the link menu goes.
export function givingWaySteps({ slogan = false, logo = false, name = false, links = false, word = false, language = false, cta = false, search = false } = {}) {
  const has = { slogan, name: name && logo, links, word, language, cta, search };
  return GIVING_WAY_ORDER.filter((step) => has[step]);
}
