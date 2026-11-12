// What the header decides at build time. Its behaviour in the browser is HTML and CSS (header.md, How it is built):
// no script measures it, follows the scrolling or opens its panels.

// The header's own words, which a site gives in its language through Header's `words` (or headerProps' `words`); each
// one it leaves out is the English one here. `menu` names the menu button and the large menu, `mainMenu` the large
// menu's navigation and `linkMenu` the bar's, `openSearch` the magnifier, `search` the search button, `searchHeading`
// the search box's heading, `closeSearch` its close button, `languages` the languages moved into the large menu,
// `language` the globe, followed by the current language's name, and `skip` the link that skips to the content.
export const HEADER_WORDS = Object.freeze({
  skip: 'Skip to content',
  menu: 'Menu',
  mainMenu: 'Main menu',
  linkMenu: 'Main',
  openSearch: 'Search',
  search: 'Search',
  searchHeading: 'Search',
  closeSearch: 'Close search',
  languages: 'Languages',
  language: 'Language',
});

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
