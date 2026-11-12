// The presentations of a post list (src/presentations/): teasers from posts in the shape the Konzilo core hands a
// presentation, `{ entry, url }` with the entry's data as its content collection holds it, the pager written from the
// core's data as its Pager.astro writes it, and a filtered list's rows and keys, with the core's `list` and without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageContext } from '../src/directives/render/context.js';
import { filterRowsOf, ownSummary, pagerHtml, presentationHtml, teaserCard, teaserOf, termsOf } from '../src/presentations/teasers.js';
import { iconHtml } from '../src/directives/icons.js';
import { testDesign } from './helpers/konzilo-body.js';

const ref = (collection, id) => ({ collection, id });
const NAMES = { 'categories/guides': 'Guides', 'categories/news': 'News', 'topics/soil': 'Soil', 'topics/tools': 'Tools', 'topics/water': 'Water', 'authors/a-writer': 'A. Writer' };
// Astro's getEntry() for the terms, and its getImage() for a picture, as the presentation's component hands them.
const getEntry = async ({ collection, id }) => ({ id, collection, data: { name: NAMES[`${collection}/${id}`] } });
const getImage = async ({ src, widths }) => ({ src: `/_astro/${src.name}.webp`, srcSet: { attribute: widths.map((width) => `/_astro/${src.name}-${width}.webp ${width}w`).join(', ') }, attributes: { width: 1200, height: 800 } });
const article = (id, data) => ({ entry: { id, collection: 'articles', data: { title: id, ...data } }, url: `/${id}/` });
const POSTS = [
  article('soil', { headline: 'Know your soil', excerpt: 'What  lies\nbelow.', category: [ref('categories', 'guides')], topics: [ref('topics', 'soil')], image: { src: { name: 'soil' }, alt: 'A spade in soil' } }),
  article('tools', { headline: 'The right tools', teaser: { text: 'Fewer, better.' }, category: [ref('categories', 'guides')], topics: [ref('topics', 'tools'), ref('topics', 'soil')] }),
  article('water', { headline: 'Water early', standfirst: 'Before the heat.', eyebrow: 'A note', topics: [ref('topics', 'water')] }),
];
const context = (options) => pageContext({ design: testDesign(), title: 'T', warn: () => {}, ...options });

test('a teaser takes the core\'s summary, the category\'s name or else the eyebrow, and the teaser\'s own headline and picture first', async () => {
  assert.equal(ownSummary({ excerpt: '  ', teaser: { text: 'Teaser\n text' }, standfirst: 'Standfirst' }), 'Teaser text');
  assert.equal(ownSummary({ standfirst: 'Standfirst' }), 'Standfirst');
  assert.equal(ownSummary({ description: 'Not a summary' }), '');
  assert.deepEqual(await teaserOf(POSTS[0], { getEntry, getImage, taxonomies: ['topics'] }), {
    href: '/soil/', headline: 'Know your soil', text: 'What lies below.', label: 'Guides',
    picture: { src: '/_astro/soil.webp', srcset: '/_astro/soil-400.webp 400w, /_astro/soil-800.webp 800w, /_astro/soil-1200.webp 1200w', sizes: '(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw', width: 1200, height: 800, alt: 'A spade in soil', loading: 'lazy', decoding: 'async' },
    terms: { topics: ['soil'] },
  });
  const water = await teaserOf(POSTS[2], { getEntry });
  assert.deepEqual([water.label, water.text, water.picture], ['A note', 'Before the heat.', null]);
  const own = await teaserOf({ entry: { data: { title: 'T', headline: 'H', teaser: { headline: 'Teaser headline', image: { src: '/public/p.webp', alt: 'P' } } } }, url: null });
  assert.deepEqual([own.headline, own.picture, own.href], ['Teaser headline', { src: '/public/p.webp', alt: 'P' }, null]);
  // The core's `list` names the terms, so no entry is read.
  const listed = await teaserOf(POSTS[0], { list: { terms: { category: [{ id: 'guides', name: 'Our guides', count: 2 }] } } });
  assert.equal(listed.label, 'Our guides');
  // A taxonomy of a site's own, held under another field, is found by its collection.
  assert.deepEqual(termsOf({ data: { region: [ref('regions', 'north')] } }, 'regions'), [ref('regions', 'north')]);
  assert.deepEqual(termsOf({ data: { places: [ref('categories', 'x')] } }, 'category'), [ref('categories', 'x')]);
});

test('a teaser card is a link as a whole on its plate, and without an address an open card', () => {
  const teaser = { href: '/a/', headline: 'A <headline>', text: 'Its text.', label: 'A category', picture: { src: '/a.webp', alt: 'A' }, terms: {} };
  assert.equal(teaserCard(teaser), '<article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture" src="/a.webp" alt="A"><p class="kn-card-eyebrow" data-kn-type="label">A category</p><h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="/a/">A &lt;headline&gt;</a></h3><p class="kn-card-text" data-kn-type="small">Its text.</p></article>');
  assert.match(teaserCard(teaser, { ground: 'raised', type: 'heading-3' }), /data-kn-surface="page".*data-kn-type="heading-3"/);
  assert.equal(teaserCard({ ...teaser, href: null, picture: null, label: undefined, text: '' }), '<article class="kn-card"><h3 class="kn-card-heading" data-kn-type="heading-5">A &lt;headline&gt;</h3></article>');
});

test('the pager is the core\'s markup from its data, and none for a list of one page', () => {
  const pager = {
    label: 'Pages',
    items: [{ number: 1, url: '/news/', label: 'Page 1', current: false }, { gap: true }, { number: 4, url: '/news/page/4/', label: 'Page 4', current: true }, { number: 9, url: '/news/page/9/', label: 'Page 9', current: false }],
    previous: { url: '/news/page/3/', label: 'Previous page' },
    next: { url: '/news/page/5/', label: 'Next page' },
  };
  // As Pager.astro writes it, but for the white space between its elements.
  assert.equal(pagerHtml(pager), '<nav class="konzilo-pager" aria-label="Pages"><ul><li class="konzilo-pager-previous"><a href="/news/page/3/" rel="prev">Previous page</a></li><li><a href="/news/" aria-label="Page 1">1</a></li><li class="konzilo-pager-gap" aria-hidden="true">…</li><li><a href="/news/page/4/" aria-label="Page 4" aria-current="page">4</a></li><li><a href="/news/page/9/" aria-label="Page 9">9</a></li><li class="konzilo-pager-next"><a href="/news/page/5/" rel="next">Next page</a></li></ul></nav>');
  assert.equal(pagerHtml({ ...pager, items: [pager.items[0]] }), '');
  assert.equal(pagerHtml(null), '');
});

test('cards and featured write one root, the mark on it, the pager after the cards, and the list\'s text where nothing matches', async () => {
  const ctx = context();
  const pager = { label: 'Pages', items: [{ number: 1, url: '/', label: 'Page 1', current: true }, { number: 2, url: '/page/2/', label: 'Page 2', current: false }], previous: null, next: { url: '/page/2/', label: 'Next page' } };
  const cards = await presentationHtml('cards', { posts: POSTS, options: {}, empty: 'Nothing yet.', pager, 'data-konzilo-block': '2.1' }, ctx, { getEntry, getImage });
  assert.match(cards, /^<div data-konzilo-block="2\.1" class="kn-post-list" data-kn-presentation="cards"><div class="kn-card-grid kn-cards">(<article class="kn-card" data-kn-surface="raised">.*?<\/article>){3}<\/div><nav class="konzilo-pager" aria-label="Pages">.*<\/nav><\/div>$/);
  const featured = await presentationHtml('featured', { posts: POSTS, options: {} }, ctx, { getEntry, getImage });
  assert.match(featured, /^<div class="kn-post-list" data-kn-presentation="featured"><div class="kn-featured"><article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture" src="\/_astro\/soil\.webp" srcset="[^"]*1800w" sizes="\(min-width: 50rem\) 66vw, 100vw"[^>]*><p class="kn-card-eyebrow" data-kn-type="label">Guides<\/p><h3 class="kn-card-heading" data-kn-type="heading-3">/);
  assert.equal((featured.match(/data-kn-type="heading-5"/g) ?? []).length, 2);
  assert.equal(await presentationHtml('filtered', { posts: [], options: {}, empty: 'Nothing yet.', 'data-konzilo-block': '4' }, ctx), '<div data-konzilo-block="4" class="kn-post-list" data-kn-presentation="filtered"><p>Nothing yet.</p></div>');
  await assert.rejects(presentationHtml('rows', { posts: [] }, ctx), /no presentation rows/);
});

test('a filtered list\'s rows stand in a fixed order, the page\'s own left out, with topics where none is chosen', () => {
  assert.deepEqual(filterRowsOf('search topics category'), { taxonomies: ['category', 'topics'], search: true });
  assert.deepEqual(filterRowsOf('regions topics search category'), { taxonomies: ['category', 'topics', 'regions'], search: true });
  assert.deepEqual(filterRowsOf(undefined), { taxonomies: ['topics'], search: false });
  assert.deepEqual(filterRowsOf('category topics search', { taxonomy: 'category', term: 'guides' }), { taxonomies: ['topics'], search: true });
  assert.deepEqual(filterRowsOf('search'), { taxonomies: [], search: true });
});

test('a filtered list with the core\'s list: rows of its terms over every page, the count of all, and what a search sends', async () => {
  const list = {
    type: { name: 'article', label: 'Article', plural: 'Articles' },
    total: 17,
    terms: {
      category: [{ id: 'news', name: 'News', count: 3, url: '/category/news/' }, { id: 'guides', name: 'Guides', count: 14, url: '/category/guides/' }],
      topics: [{ id: 'water', name: 'Water', count: 2 }, { id: 'soil', name: 'Soil', count: 9 }, { id: 'tools', name: 'Tools', count: 9 }],
    },
    search: '/search/',
  };
  const html = await presentationHtml('filtered', { posts: POSTS, options: { filters: 'topics search category' }, list }, context(), { getEntry, getImage });
  const form = /<form class="kn-visitor-filters"[^>]*>.*<\/form>/s.exec(html)[0];
  assert.equal(form, [
    '<form class="kn-visitor-filters" role="search" method="get" action="/search/"><input type="hidden" name="type" value="article"><div class="kn-visitor-filter-panel">',
    '<fieldset class="kn-visitor-filter-group"><legend>Category</legend><div class="kn-visitor-filter-toggles">',
    '<label class="kn-pill"><input type="checkbox" name="category" value="guides" aria-controls="posts-1" data-kn-match="1-1">Guides</label>',
    '<label class="kn-pill"><input type="checkbox" name="category" value="news" aria-controls="posts-1" data-kn-match="1-2">News</label></div></fieldset>',
    '<fieldset class="kn-visitor-filter-group"><legend>Topic</legend><div class="kn-visitor-filter-toggles">',
    '<label class="kn-pill"><input type="checkbox" name="topics" value="soil" aria-controls="posts-1" data-kn-match="2-1">Soil</label>',
    '<label class="kn-pill"><input type="checkbox" name="topics" value="tools" aria-controls="posts-1" data-kn-match="2-2">Tools</label>',
    '<label class="kn-pill"><input type="checkbox" name="topics" value="water" aria-controls="posts-1" data-kn-match="2-3">Water</label></div></fieldset>',
    `<div class="kn-field kn-visitor-filter-search"><label class="kn-field-label" for="posts-1-search">Search</label><div class="kn-visitor-filter-input">${iconHtml('search')}<input class="kn-field-control" id="posts-1-search" name="q" type="search"></div></div>`,
    '<button class="kn-button kn-visitor-filter-submit" type="submit" data-kn-variant="outline">Search</button></div>',
    '<p class="kn-visitor-filter-count" data-kn-type="small">Showing 3 of 17 articles</p></form>',
  ].join(''));
  const cards = [...html.matchAll(/<article class="kn-card"([^>]*)>/g)].map((match) => match[1]);
  assert.deepEqual(cards, [
    ' data-kn-surface="raised" data-kn-item data-kn-matches="1-1 2-1"',
    ' data-kn-surface="raised" data-kn-item data-kn-matches="1-1 2-1 2-2"',
    ' data-kn-surface="raised" data-kn-item data-kn-matches="2-3"',
  ]);
  assert.match(html, /<div class="kn-card-grid kn-cards" id="posts-1">/);
  // On a category's page its row is left out, and a search keeps to the category.
  const settled = await presentationHtml('filtered', { posts: POSTS, options: { filters: 'category topics search' }, list, settled: { taxonomy: 'category', term: 'guides' } }, context(), { getEntry, getImage });
  assert.match(settled, /<input type="hidden" name="type" value="article"><input type="hidden" name="category" value="guides"><div class="kn-visitor-filter-panel"><fieldset class="kn-visitor-filter-group"><legend>Topic<\/legend>/);
  assert.doesNotMatch(settled, /<legend>Category/);
  // Pills alone: no search, no hidden field, a form to the page itself, an empty action, and "Show".
  const pills = await presentationHtml('filtered', { posts: POSTS, options: {}, list }, context({ words: { show: 'Visa', taxonomies: { topics: 'Ämnen' } } }), { getEntry, getImage });
  assert.match(pills, /<form class="kn-visitor-filters" role="search" method="get" action><div class="kn-visitor-filter-panel"><fieldset class="kn-visitor-filter-group"><legend>Ämnen<\/legend>.*<button[^>]*>Visa<\/button>/);
});

test('a filtered list without the core\'s list does the best its page\'s posts allow', async () => {
  const warned = [];
  const ctx = context({ search: '/search/', types: { articles: { name: 'article', plural: 'Articles' } }, warn: (message) => warned.push(message) });
  const html = await presentationHtml('filtered', { posts: POSTS, options: { filters: 'category topics authors regions search' } }, ctx, { getEntry, getImage });
  // The terms of the posts on the page, the most posts first, then by name, read from their entries.
  assert.match(html, /<legend>Category<\/legend><div class="kn-visitor-filter-toggles"><label class="kn-pill"><input type="checkbox" name="category" value="guides"[^>]*>Guides<\/label><\/div>/);
  assert.match(html, /<legend>Topic<\/legend><div class="kn-visitor-filter-toggles"><label class="kn-pill"><input[^>]*value="soil"[^>]*>Soil<\/label><label class="kn-pill"><input[^>]*value="tools"[^>]*>Tools<\/label><label class="kn-pill"><input[^>]*value="water"[^>]*>Water<\/label>/);
  assert.match(html, /action="\/search\/"><input type="hidden" name="type" value="article">/);
  assert.match(html, /Showing 3 articles<\/p>/);
  // At most three rows of pills, as the stylesheet knows; the fourth is left out, saying so. Authors and regions have none here.
  assert.equal(warned.length, 1);
  assert.match(warned[0], /at most 3 rows of pills/);
  // No search page known: the search row is left out, saying so, and the plural is the site's word.
  const lost = [];
  const plain = await presentationHtml('filtered', { posts: POSTS, options: { filters: 'topics search' } }, context({ warn: (message) => lost.push(message), words: { posts: 'inlägg' } }), { getEntry });
  assert.doesNotMatch(plain, /kn-visitor-filter-search|type="hidden"/);
  assert.match(plain, /Showing 3 inlägg/);
  assert.match(lost[0], /neither the core nor designPage\(Astro, \{ search \}\)/);
  // One post is counted in the singular, by the type's label.
  const one = await presentationHtml('filtered', { posts: POSTS.slice(0, 1), options: {} }, context({ types: { articles: { name: 'article', label: 'Article', plural: 'Articles' } } }), { getEntry });
  assert.match(one, /Showing 1 article<\/p>/);
  assert.match(await presentationHtml('filtered', { posts: POSTS.slice(0, 1), options: {} }, context(), { getEntry }), /Showing 1 post<\/p>/);
});
