// The presentations of a post list (docs/spec/directives.md, ::post-list): what the Konzilo core hands a presentation,
// `{ posts, options, empty, pager }`, each post `{ entry, url }`, and, from a version of the core that gives it, `list`,
// what the list is of, `{ type: { name, label, plural }, total, terms: { <taxonomy>: [{ id, name, count, url }] }, search }`,
// drawn as teaser cards. A term's page calls a presentation itself, with `settled: { taxonomy, term }`, the term it lists.
//
// Plain JavaScript with no import of Astro's or the core's: the presentation's component hands it Astro's getEntry() and
// getImage() (Cards.astro, Featured.astro, Filtered.astro), and the tests their own.
import { iconHtml } from '../directives/icons.js';
import { surfaceOf } from '../directives/surfaces.js';
import { FILTER_GROUPS, FILTER_VALUES, filterKeys, itemMatches } from '../components/visitor-filters.js';
import { escapeText, tag, voidTag } from '../directives/render/html.js';
import { withMark } from '../directives/render/render.js';

// The presentations this package draws.
export const PRESENTATIONS = Object.freeze(['cards', 'featured', 'filtered']);

// A post's own words for a teaser, as the core's ownSummary() reads them: its excerpt, else its teaser's text, else its
// standfirst, its white space collapsed.
export function ownSummary(data = {}) {
  const found = [data.excerpt, data.teaser?.text, data.standfirst].find((one) => typeof one === 'string' && one.trim() !== '');
  return (found ?? '').replace(/\s+/g, ' ').trim();
}

// The collections of the core's built-in taxonomies, by their names.
const COLLECTIONS = Object.freeze({ category: 'categories', topics: 'topics', authors: 'authors' });
const isReference = (value) => !!value && typeof value === 'object' && typeof value.id === 'string' && typeof value.collection === 'string';

/**
 * A post's terms of a taxonomy, as references `{ collection, id }`: the field of the taxonomy's name, as the core's
 * article holds its category, topics and authors, or else every reference to the taxonomy's collection in the post.
 * @param {{ data?: object }} entry
 * @param {string} taxonomy
 */
export function termsOf(entry, taxonomy) {
  const own = entry?.data?.[taxonomy];
  if (Array.isArray(own) && own.length > 0 && own.every(isReference)) return own;
  const collection = COLLECTIONS[taxonomy] ?? taxonomy;
  return Object.values(entry?.data ?? {}).filter(Array.isArray).flat().filter((value) => isReference(value) && value.collection === collection);
}

// A term's name: from the core's `list` where it gives the taxonomy's terms, else from the term's entry.
async function termName(reference, taxonomy, { list, getEntry }) {
  const listed = list?.terms?.[taxonomy]?.find((term) => term.id === reference.id);
  if (listed?.name) return listed.name;
  const entry = getEntry ? await getEntry(reference) : null;
  return entry?.data?.name ?? reference.id;
}

// The widths a teaser's picture is made at, and how wide it shows: a card is a column of three or four on a wide window,
// and the featured post's spans two of three.
const PICTURES = Object.freeze({
  card: { widths: [400, 800, 1200], sizes: '(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw' },
  featured: { widths: [600, 1200, 1800], sizes: '(min-width: 50rem) 66vw, 100vw' },
  // A hero's picture beside its text, and one behind it, which fills the window's width.
  hero: { widths: [800, 1200, 1600, 2400], sizes: '(min-width: 40rem) 50vw, 100vw' },
  behind: { widths: [800, 1200, 1600, 2400], sizes: '100vw' },
});

// A post's picture as the attributes of its <img>, for a teaser or an opening (`place`): made by Astro's getImage() from
// the post's image, or as given; null for none.
export async function pictureOf(image, place, getImage) {
  if (!image?.src) return null;
  const alt = image.alt ?? '';
  if (typeof image.src === 'string' || !getImage) return { src: String(image.src?.src ?? image.src), alt };
  const made = await getImage({ src: image.src, ...PICTURES[place] });
  return {
    src: made.src,
    srcset: made.srcSet?.attribute || undefined,
    sizes: PICTURES[place].sizes,
    width: made.attributes?.width,
    height: made.attributes?.height,
    alt,
    loading: 'lazy',
    decoding: 'async',
  };
}

/**
 * A post as a teaser: its address, its teaser headline, its own words, its label, the category's name or else its
 * eyebrow, its picture, the teaser's image or else its featured image, and its terms by taxonomy.
 * @param {{ entry: object, url: string | null }} post
 * @param {object} [options] `list`, `getEntry` and `getImage` as the presentation has them; `place`, `card` or `featured`;
 *   `taxonomies`, the taxonomies whose terms the teaser carries.
 */
export async function teaserOf({ entry, url }, { list, getEntry, getImage, place = 'card', taxonomies = [] } = {}) {
  const data = entry?.data ?? {};
  const [category] = termsOf(entry, 'category');
  const label = category ? await termName(category, 'category', { list, getEntry }) : (typeof data.eyebrow === 'string' && data.eyebrow.trim() ? data.eyebrow : undefined);
  return {
    href: url ?? null,
    headline: data.teaser?.headline ?? data.headline ?? data.title ?? '',
    text: ownSummary(data),
    label,
    picture: await pictureOf(data.teaser?.image ?? data.image, place, getImage),
    terms: Object.fromEntries(taxonomies.map((taxonomy) => [taxonomy, termsOf(entry, taxonomy).map((reference) => reference.id)])),
  };
}

/**
 * A teaser card, a link as a whole where the post has an address (directives.md, ::post-list).
 * @param {object} teaser As teaserOf() gives it.
 * @param {{ ground?: string, type?: string, values?: object }} [options] The Surface around it, its heading's type and
 *   attributes of its own.
 */
export function teaserCard(teaser, { ground, type = 'heading-5', values = {} } = {}) {
  const linked = typeof teaser.href === 'string';
  return tag('article', { class: 'kn-card', 'data-kn-surface': linked ? surfaceOf('link-card', ground) : undefined, ...values },
    teaser.picture ? voidTag('img', { class: 'kn-card-picture', ...teaser.picture }) : '',
    teaser.label ? tag('p', { class: 'kn-card-eyebrow', 'data-kn-type': 'label' }, escapeText(teaser.label)) : '',
    tag('h3', { class: 'kn-card-heading', 'data-kn-type': type }, linked ? tag('a', { class: 'kn-card-link', href: teaser.href }, escapeText(teaser.headline)) : escapeText(teaser.headline)),
    teaser.text ? tag('p', { class: 'kn-card-text', 'data-kn-type': 'small' }, escapeText(teaser.text)) : '');
}

/**
 * The core's pager from its data, as its Pager.astro writes it: nothing for a list of one page.
 * @param {{ label: string, items: object[], previous: object | null, next: object | null } | null} pager
 */
export function pagerHtml(pager) {
  if (!pager || !(pager.items?.length > 1)) return '';
  return tag('nav', { class: 'konzilo-pager', 'aria-label': pager.label },
    tag('ul', {},
      pager.previous ? tag('li', { class: 'konzilo-pager-previous' }, tag('a', { href: pager.previous.url, rel: 'prev' }, escapeText(pager.previous.label))) : '',
      pager.items.map((item) => (item.gap
        ? '<li class="konzilo-pager-gap" aria-hidden="true">…</li>'
        : tag('li', {}, tag('a', { href: item.url, 'aria-label': item.label, 'aria-current': item.current ? 'page' : undefined }, String(item.number))))),
      pager.next ? tag('li', { class: 'konzilo-pager-next' }, tag('a', { href: pager.next.url, rel: 'next' }, escapeText(pager.next.label))) : ''));
}

// ---------- filtered ----------

/**
 * The rows a filtered list has, in the fixed order a site writes them whatever order they are given in: the category,
 * the topics, any other taxonomy in the order given, and search last (directives.md, `presentation="filtered"`). A list
 * placed with no rows chosen has one row of topics. A row the page settles is left out.
 * @param {string | undefined} filters The option `filters`, the rows' names apart by spaces.
 * @param {{ taxonomy: string } | undefined} settled
 * @returns {{ taxonomies: string[], search: boolean }}
 */
export function filterRowsOf(filters, settled) {
  const asked = [...new Set(String(filters ?? '').split(/\s+/).filter(Boolean))];
  const chosen = asked.length ? asked : ['topics'];
  const taxonomies = chosen.filter((name) => name !== 'search');
  const order = (name) => (name === 'category' ? 0 : name === 'topics' ? 1 : 2);
  return {
    taxonomies: taxonomies.map((name, at) => ({ name, at })).sort((a, b) => order(a.name) - order(b.name) || a.at - b.at)
      .map(({ name }) => name).filter((name) => name !== settled?.taxonomy),
    search: chosen.includes('search'),
  };
}

// A row's terms: the core's, over every post the list matches, where it gives them; else those of the posts on the
// page, with their names. The terms with the most posts first, then by name, at most FILTER_VALUES.
async function rowTerms(taxonomy, posts, { list, getEntry }) {
  let terms = list?.terms?.[taxonomy];
  if (!Array.isArray(terms)) {
    const counted = new Map();
    for (const { entry } of posts) {
      for (const reference of termsOf(entry, taxonomy)) {
        const known = counted.get(reference.id) ?? { id: reference.id, reference, count: 0 };
        known.count += 1;
        counted.set(reference.id, known);
      }
    }
    terms = await Promise.all([...counted.values()].map(async (term) => ({ id: term.id, count: term.count, name: await termName(term.reference, taxonomy, { getEntry }) })));
  }
  return [...terms].sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || String(a.name).localeCompare(String(b.name))).slice(0, FILTER_VALUES);
}

// The list's type: the core's `list`, else the site's `types` in the page's context, by the posts' collection.
function typeOf(posts, list, ctx) {
  if (list?.type?.name) return list.type;
  const collection = posts[0]?.entry?.collection;
  return collection ? ctx.types?.[collection] ?? null : null;
}

async function filtered(posts, teasers, { ctx, options, list, settled }) {
  const { words } = ctx;
  const rows = filterRowsOf(options.filters, settled);
  if (rows.taxonomies.length > FILTER_GROUPS) {
    ctx.warn(`a filtered list filters by at most ${FILTER_GROUPS} rows of pills, and it was given ${rows.taxonomies.join(', ')}: it shows the first ${FILTER_GROUPS}`);
    rows.taxonomies.length = FILTER_GROUPS;
  }
  const groups = (await Promise.all(rows.taxonomies.map(async (taxonomy) => ({
    taxonomy,
    legend: words.taxonomies[taxonomy] ?? taxonomy.charAt(0).toUpperCase() + taxonomy.slice(1),
    terms: await rowTerms(taxonomy, posts, { list, getEntry: options.getEntry }),
  })))).filter((group) => group.terms.length > 0);
  const keys = filterKeys(groups.map((group) => ({ name: group.taxonomy, options: group.terms.map((term) => ({ value: term.id })) })));
  const id = ctx.id('posts');
  const type = typeOf(posts, list, ctx);
  const action = typeof list?.search === 'string' ? list.search : list?.search?.url ?? list?.search?.address ?? ctx.search;
  const search = rows.search && typeof action === 'string' && action !== '';
  if (rows.search && !search) ctx.warn('a filtered list has a search row, but neither the core nor designPage(Astro, { search }) gives the site\'s search page: it is left out');
  // With a search row, what the list settles, its type, and what the page settles, its term, go with a search.
  const hidden = search ? [['type', type?.name], ...(settled ? [[settled.taxonomy, settled.term]] : [])].filter(([, value]) => value) : [];
  const total = Number.isInteger(list?.total) ? list.total : posts.length;
  const nouns = { label: type?.label ?? type?.plural ?? words.post, plural: type?.plural ?? words.posts };
  return tag('form', { class: 'kn-visitor-filters', role: 'search', method: 'get', action: search ? action : '' },
    hidden.map(([name, value]) => voidTag('input', { type: 'hidden', name, value })),
    tag('div', { class: 'kn-visitor-filter-panel' },
      groups.map((group) => tag('fieldset', { class: 'kn-visitor-filter-group' }, `<legend>${escapeText(group.legend)}</legend>`,
        tag('div', { class: 'kn-visitor-filter-toggles' }, group.terms.map((term) => tag('label', { class: 'kn-pill' },
          voidTag('input', { type: 'checkbox', name: group.taxonomy, value: term.id, 'aria-controls': id, 'data-kn-match': keys.get(group.taxonomy).get(term.id) }),
          escapeText(term.name)))))),
      search ? tag('div', { class: 'kn-field kn-visitor-filter-search' },
        tag('label', { class: 'kn-field-label', for: `${id}-search` }, escapeText(words.search)),
        tag('div', { class: 'kn-visitor-filter-input' }, iconHtml('search'), voidTag('input', { class: 'kn-field-control', id: `${id}-search`, name: 'q', type: 'search' }))) : '',
      tag('button', { class: 'kn-button kn-visitor-filter-submit', type: 'submit', 'data-kn-variant': 'outline' }, escapeText(search ? words.search : words.show))),
    tag('p', { class: 'kn-visitor-filter-count', 'data-kn-type': 'small' }, escapeText(words.count(teasers.length, total, nouns))))
    + tag('div', { class: 'kn-card-grid kn-cards', id }, teasers.map((teaser) => teaserCard(teaser, {
      ground: ctx.ground,
      values: { 'data-kn-item': '', 'data-kn-matches': itemMatches(keys, teaser.terms) || undefined },
    })));
}

/**
 * A post list as a presentation of this package's draws it: one root, `div.kn-post-list`, with the pager, where the
 * list has pages, after its cards, and the list's text in place of them where it matches nothing.
 * @param {'cards' | 'featured' | 'filtered'} name
 * @param {object} props What the core hands the presentation: `posts`, `options`, `empty`, `pager`, `list`,
 *   `settled` and, in the live preview, `data-konzilo-block`.
 * @param {object} ctx The page's context.
 * @param {{ getEntry?: Function, getImage?: Function }} [astro] Astro's getEntry() and getImage().
 * @returns {Promise<string>}
 */
export async function presentationHtml(name, props, ctx, { getEntry, getImage } = {}) {
  if (!PRESENTATIONS.includes(name)) throw new Error(`@kntnt/konzilo-design has no presentation ${name}; it has ${PRESENTATIONS.join(', ')}.`);
  const { posts = [], options = {}, empty, pager, list, settled } = props;
  const block = props['data-konzilo-block'];
  const root = (...content) => withMark(tag('div', { class: 'kn-post-list', 'data-kn-presentation': name }, ...content), block);
  if (posts.length === 0) return root(empty ? tag('p', {}, escapeText(empty)) : '');
  const taxonomies = name === 'filtered' ? filterRowsOf(options.filters, settled).taxonomies : [];
  const teasers = await Promise.all(posts.map((post, at) => teaserOf(post, { list, getEntry, getImage, taxonomies, place: name === 'featured' && at === 0 ? 'featured' : 'card' })));
  if (name === 'featured') {
    return root(tag('div', { class: 'kn-featured' }, teasers.map((teaser, at) => teaserCard(teaser, { ground: ctx.ground, type: at === 0 ? 'heading-3' : 'heading-5' }))), pagerHtml(pager));
  }
  if (name === 'filtered') return root(await filtered(posts, teasers, { ctx, options: { ...options, getEntry }, list, settled }), pagerHtml(pager));
  return root(tag('div', { class: 'kn-card-grid kn-cards' }, teasers.map((teaser) => teaserCard(teaser, { ground: ctx.ground }))), pagerHtml(pager));
}

