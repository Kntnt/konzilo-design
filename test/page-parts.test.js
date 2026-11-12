// The page parts a site's templates place (src/page-parts/): the title band and a term's opening, a body as bands, an
// article's opening, body and "Read more", each drawn from what a template has in hand from the Konzilo core, and held
// to docs/spec/directives.md's markup. The core itself is not read here; test/konzilo-build.test.js builds with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyHtml, renderBody, testDesign } from './helpers/konzilo-body.js';
import { render } from './helpers/render.js';
import { designPage, pageContext } from '../src/directives/render/context.js';
import { articleBody, articleOpening, looseSection, metaLineHtml, pageBody, readMore, termOpening, titleBand } from '../src/page-parts/parts.js';
import { iconHtml } from '../src/directives/icons.js';
import { PARTS } from '../src/page-parts/parts.js';
import { readdirSync } from 'node:fs';

const md = String.raw;
const TRAIL = [{ name: 'Home', href: '/' }, { name: 'Guides', href: '/guides/' }, { name: 'Planning a garden', href: '/guides/planning/', hidden: true }];
// A page's context, with the design's settings and the site's words a test gives.
const context = ({ design, ...options } = {}) => pageContext({ title: 'Planning a garden', breadcrumbs: TRAIL, warn: () => {}, ...options, design: testDesign(design) });
const tight = (html) => html.replace(/>\s+</g, '><').trim();
const house = iconHtml('house', 'kn-breadcrumbs-house').replace(/>\s+</g, '><');
const TRAIL_HTML = `<nav class="kn-breadcrumbs" aria-label="Breadcrumb" data-kn-type="small" data-kn-separator="slash" data-kn-home="word" data-kn-current="false" data-kn-narrow="trail"><ol role="list"><li><a href="/">${house}<span class="kn-breadcrumbs-label">Home</span></a></li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><a href="/guides/"><span class="kn-breadcrumbs-label">Guides</span></a></li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><span aria-current="page">Planning a garden</span></li></ol></nav>`;
// A body as the core's Body draws it, with the package's components.
const drawn = (markdown, ctx = context()) => renderBody(bodyHtml(markdown), ctx);

test('the title band is a section\'s head of its own: the trail, an eyebrow, the page\'s title as its H1 and a deck', () => {
  assert.equal(tight(titleBand(context())), `<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head">${TRAIL_HTML}<hgroup class="kn-heading-group"><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden</h1></hgroup></header></div></section>`);
  const own = titleBand(context(), { title: 'Search', eyebrow: 'Find', deck: 'Words across the whole site, its articles, its pages and its people, all in one place.', surface: 'tint', trail: false });
  assert.equal(own, '<section class="kn-band kn-section" data-kn-surface="tint"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Find</p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Search</h1><p class="kn-heading-group-deck" data-kn-type="lead" data-kn-deck="long">Words across the whole site, its articles, its pages and its people, all in one place.</p></hgroup></header></div></section>');
  assert.doesNotMatch(titleBand(context(), { deck: 'Short.' }), /data-kn-deck/);
  assert.throws(() => titleBand(context({ title: undefined })), /designPage\(Astro, \{ title \}\)/);
});

test('a term\'s opening names its taxonomy over its name and takes its description as the deck', () => {
  const term = { id: 'guides', collection: 'categories', data: { name: 'Guides', description: 'How to plan, plant and keep a garden.' } };
  assert.match(termOpening(context(), { term, surface: 'tint' }), /^<section class="kn-band kn-section" data-kn-surface="tint">.*<p class="kn-heading-group-eyebrow" data-kn-type="label">Category<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Guides<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">How to plan, plant and keep a garden\.<\/p>/s);
  assert.match(termOpening(context({ words: { taxonomies: { topics: 'Ämne' } } }), { term: { ...term, collection: 'topics' } }), /data-kn-type="label">Ämne</);
  assert.match(termOpening(context(), { term: { ...term, collection: 'regions' } }), /data-kn-type="label">Regions</);
  assert.match(termOpening(context(), { term, taxonomy: 'authors', eyebrow: 'Writer' }), /data-kn-type="label">Writer</);
});

test('a body\'s loose blocks stand in a section of their own, read by the six rules\' groups, and its bands as they are', () => {
  const ctx = context();
  const body = drawn(md`![A shed](/media/shed.webp)

::eyebrow[Tools]

## Everything in one shed

The tools, the seeds and the soil, delivered at once to your door, every spring and every autumn.

:::list{type="actions"}

- **[See what is in it](/plans/)**

:::

Each shed holds what a garden needs.

::eyebrow[Later]

### A later heading

:::section{surface="raised"}

## A band of its own

Words.

:::

Loose again.`, ctx);
  const html = tight(pageBody(body, ctx, { title: false }));
  const [first, second, third] = html.split('</section><section').map((piece, at, all) => (at > 0 ? '<section' : '') + piece + (at < all.length - 1 ? '</section>' : ''));
  assert.equal(first, [
    '<section class="kn-band kn-section"><div class="kn-band-content">',
    '<div class="kn-section-media"><img class="kn-section-picture" src="/media/shed.webp" alt="A shed"></div>',
    '<header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Tools</p><h2 class="kn-heading-group-heading" id="everything-in-one-shed" data-kn-type="heading-2">Everything in one shed</h2><p class="kn-heading-group-deck" data-kn-type="lead" data-kn-deck="long">The tools, the seeds and the soil, delivered at once to your door, every spring and every autumn.</p></hgroup><ul class="kn-actions" role="list"><li><a class="kn-action" href="/plans/" data-kn-main>See what is in it</a></li></ul></header>',
    '<div class="kn-section-body kn-body-text"><p>Each shed holds what a garden needs.</p><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Later</p><h3 class="kn-heading-group-heading" id="a-later-heading">A later heading</h3></hgroup></div>',
    '</div></section>',
  ].join(''));
  assert.match(second, /^<section class="kn-band kn-section" data-kn-surface="raised">/);
  assert.equal(third, '<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><p>Loose again.</p></div></div></section>');
  // A run of paragraphs only, the head beside them as rule 5 reads it.
  assert.equal(tight(looseSection('<h2 id="a">A</h2>\n<p>One.</p>\n<p>Two.</p>')), '<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" id="a" data-kn-type="heading-2">A</h2></hgroup></header><div class="kn-section-body kn-body-text"><p>One.</p><p>Two.</p></div></div></section>');
});

test('a body that opens with no hero has the title band first, and one that opens with a hero has none', () => {
  const ctx = context();
  assert.match(tight(pageBody(drawn('Words.'), ctx)), new RegExp(`^<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head">.*<h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden</h1></hgroup></header></div></section><section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><p>Words.</p>`, 's'));
  const hero = pageBody(drawn(md`:::hero

Words.

:::`, ctx), ctx);
  assert.match(hero, /^<section class="kn-band kn-hero"/);
  assert.equal((hero.match(/<h1/g) ?? []).length, 1);
  assert.equal(tight(pageBody('', ctx)), tight(titleBand(ctx)), 'an empty body has its title alone');
  // In the live preview, the blocks keep their marks inside the section around them.
  const preview = pageBody(renderBody(bodyHtml('Words.\n\n![A shed](/media/shed.webp)', { preview: true }), ctx), ctx, { title: false });
  assert.match(preview, /<p data-konzilo-block="0">Words\.<\/p>/);
  assert.match(preview, /<figure data-konzilo-block="1">/);
});

test('where the design puts the H1 under the hero, the band after it holds the H1 and the trail, or a title band does', () => {
  const ctx = context({ design: { hero: { h1: 'below', picture: 'none' } } });
  const html = tight(pageBody(drawn(md`::::hero

::breadcrumbs

::eyebrow[A guide]

Start small.

::::

:::section

## Our plans

Words.

:::`, ctx), ctx));
  assert.match(html, /^<section class="kn-band kn-hero"[^>]*><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><div class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">A guide<\/p><p class="kn-heading-group-heading"/);
  assert.doesNotMatch(html.slice(0, html.indexOf('</section>')), /kn-breadcrumbs/, 'the trail leaves the hero');
  assert.match(html, new RegExp(`<header class="kn-section-head">${TRAIL_HTML.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<hgroup class="kn-heading-group"><h1 class="kn-heading-group-heading" data-kn-type="heading-1" id="our-plans">Our plans</h1></hgroup></header>`));
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  // With no heading after the hero, a title band stands between them.
  const bare = tight(pageBody(drawn(md`::::hero

Start small.

::::

Words.`, ctx), ctx));
  assert.match(bare, /<\/section><section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><nav class="kn-breadcrumbs".*<h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden<\/h1>.*<\/section><section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><p>Words\.<\/p>/s);
});

test('the meta line is the core\'s pieces: a byline of the authors, the date as a time, the category as a link, and the topics as pills', () => {
  const pieces = [
    { text: 'By ', variable: null, url: null, datetime: null },
    { text: 'A. Writer', variable: 'authors', url: '/author/a-writer/', datetime: null },
    { text: ', ', variable: 'authors', url: null, datetime: null },
    { text: 'B. Writer', variable: 'authors', url: null, datetime: null },
    { text: ' • Published ', variable: null, url: null, datetime: null },
    { text: '10 October 2026', variable: 'date', url: null, datetime: '2026-10-10T08:00:00.000Z' },
    { text: ' in ', variable: null, url: null, datetime: null },
    { text: 'Guides', variable: 'category', url: '/category/guides/', datetime: null },
  ];
  assert.equal(metaLineHtml(pieces, [{ name: 'Soil', url: '/topic/soil/' }, { name: 'Tools' }]),
    '<p class="kn-article-meta" data-kn-type="small"><span class="kn-article-line">By <span class="kn-article-byline"><a href="/author/a-writer/">A. Writer</a>, B. Writer</span> • Published <time class="kn-article-date" datetime="2026-10-10T08:00:00.000Z">10 October 2026</time> in <a class="kn-article-category" href="/category/guides/">Guides</a></span><span class="kn-article-topics"><a class="kn-pill" href="/topic/soil/">Soil</a><span class="kn-pill">Tools</span></span></p>');
  assert.equal(metaLineHtml([{ text: 'Guides', variable: 'category', url: null, datetime: null }], []), '<p class="kn-article-meta" data-kn-type="small"><span class="kn-article-line"><span class="kn-article-category">Guides</span></span></p>');
  assert.equal(metaLineHtml([], []), '');
  assert.equal(metaLineHtml([], [{ name: 'Soil', url: '/topic/soil/' }]), '<p class="kn-article-meta" data-kn-type="small"><span class="kn-article-topics"><a class="kn-pill" href="/topic/soil/">Soil</a></span></p>');
});

test('an article\'s opening is a Hero of its main image, its headline in three parts, its standfirst and its meta line', () => {
  const data = { headline: 'Know your soil', subheadline: 'What lies below', standfirst: 'Dig first, plant later.' };
  const picture = { src: '/_astro/soil.webp', srcset: '/_astro/soil-800.webp 800w', sizes: '100vw', width: 1600, height: 1000, alt: 'A spade in soil' };
  const beside = tight(articleOpening(context({ design: { hero: { picture: 'end', surface: 'none' } } }), { data, eyebrow: 'Guides', picture, metaLine: [{ text: 'Guides', variable: 'category', url: '/category/guides/', datetime: null }], topics: [], after: '<p class="kn-fine-print" data-kn-type="small">A note.</p>' }));
  assert.equal(beside, [
    '<section class="kn-band kn-hero kn-article-opening" data-kn-picture="end" data-kn-height="two-thirds" data-kn-place="bottom"><div class="kn-band-content kn-hero-content"><div class="kn-hero-text">',
    TRAIL_HTML,
    '<hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Guides</p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Know your soil</h1><p class="kn-heading-group-subheadline">What lies below</p><p class="kn-heading-group-deck" data-kn-type="lead">Dig first, plant later.</p></hgroup>',
    '<p class="kn-article-meta" data-kn-type="small"><span class="kn-article-line"><a class="kn-article-category" href="/category/guides/">Guides</a></span></p>',
    '<p class="kn-fine-print" data-kn-type="small">A note.</p>',
    '</div><div class="kn-hero-media"><img src="/_astro/soil.webp" srcset="/_astro/soil-800.webp 800w" sizes="100vw" width="1600" height="1000" alt="A spade in soil" loading="eager"></div></div></section>',
  ].join(''));
  // Its own eyebrow wins over the category; behind the text, the picture is the band's.
  const behind = articleOpening(context({ design: { hero: { picture: 'behind', overlay: 'dark' } } }), { data: { ...data, eyebrow: 'Interview' }, eyebrow: 'Guides', picture });
  assert.match(behind, /^<section class="kn-band kn-hero kn-article-opening" data-kn-surface="picture-dark"[^>]* style="--kn-picture-image:url\(&quot;\/_astro\/soil\.webp&quot;\)">/);
  assert.match(behind, /data-kn-type="label">Interview</);
  assert.doesNotMatch(behind, /kn-hero-media|kn-article-meta/);
  // Without a picture, on the Surface the template gives, or the design's own; the title where there is no headline.
  assert.match(articleOpening(context({ design: { hero: { surface: 'raised' } } }), { data: { title: 'A vacancy' }, surface: 'tint' }), /^<section class="kn-band kn-hero kn-article-opening" data-kn-surface="tint".*<h1 class="kn-heading-group-heading" data-kn-type="heading-1">A vacancy<\/h1>/s);
});

test('an article\'s body has its following menu of crossheads and fact boxes beside it, and its interview\'s questions marked', () => {
  const ctx = context();
  const body = drawn(md`The lede.

## <a id="a-crosshead"></a>A crosshead

**What did you find?**

That the **soil** was dry.

:::aside{anchor="in-short"}

### In short

- Water early.

:::

## Another crosshead`, ctx);
  const html = tight(articleBody(body, ctx));
  assert.equal(html, [
    '<section class="kn-band kn-article-body"><div class="kn-band-content"><div class="kn-reading-area" data-kn-side="start" data-kn-stack="before">',
    '<div class="kn-reading-area-aside"><aside class="kn-aside-block" data-kn-sticky="true"><nav class="kn-toc" aria-labelledby="article-menu-1" data-kn-type="small" data-kn-follow><p class="kn-toc-label" id="article-menu-1" data-kn-type="heading-6">In this article</p><ol role="list"><li><a href="#a-crosshead">A crosshead</a></li><li><a href="#in-short">In short</a></li><li><a href="#another-crosshead">Another crosshead</a></li></ol></nav></aside></div>',
    '<div class="kn-reading-area-flow kn-body-text"><p>The lede.</p><h2 id="a-crosshead">A crosshead</h2><p class="kn-question"><strong>What did you find?</strong></p><p>That the <strong>soil</strong> was dry.</p><aside class="kn-fact-box" id="in-short" data-kn-surface="tint"><h3 class="kn-fact-box-heading" data-kn-type="heading-5">In short</h3><ul><li>Water early.</li></ul></aside><h2 id="another-crosshead">Another crosshead</h2></div>',
    '</div></div></section>',
  ].join(''));
  // Fewer than two stops make no menu; a type's own Aside stands in its place; the menu's label is the site's word.
  assert.doesNotMatch(articleBody(drawn('## One\n\nWords.', ctx), ctx), /kn-reading-area-aside/);
  assert.match(articleBody(body, ctx, { aside: '<aside class="kn-aside-block">Facts</aside>' }), /<div class="kn-reading-area-aside"><aside class="kn-aside-block">Facts<\/aside><\/div>/);
  assert.match(articleBody(body, context({ words: { articleMenu: 'I artikeln' } })), />I artikeln</);
  assert.doesNotMatch(articleBody(body, ctx, { menu: false }), /kn-toc/);
});

test('"Read more" is a section of teasers under a heading and a lone main action, on its Surface, and nothing without teasers', () => {
  const teasers = [{ href: '/a/', headline: 'One', text: 'Its text.', label: 'Guides', picture: null, terms: {} }];
  assert.equal(tight(readMore(context(), { teasers, more: { label: 'More articles', href: '/articles/' }, surface: 'raised' })), [
    '<section class="kn-band kn-section" data-kn-surface="raised"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" data-kn-type="heading-2">Read more</h2></hgroup></header>',
    '<div class="kn-section-body kn-body-text"><div class="kn-card-grid kn-cards"><article class="kn-card" data-kn-surface="page"><p class="kn-card-eyebrow" data-kn-type="label">Guides</p><h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="/a/">One</a></h3><p class="kn-card-text" data-kn-type="small">Its text.</p></article></div>',
    '<ul class="kn-actions" role="list"><li><a class="kn-action" href="/articles/" data-kn-main>More articles</a></li></ul></div></div></section>',
  ].join(''));
  assert.match(readMore(context({ words: { readMore: 'Läs mer' } }), { teasers }), /<h2[^>]*>Läs mer<\/h2>.*<article class="kn-card" data-kn-surface="raised">/s);
  assert.equal(readMore(context(), { teasers: [] }), '');
});

test('the parts\' components draw what the parts draw, from the page\'s context and their slots', async () => {
  const locals = {};
  designPage({ locals }, { design: testDesign(), title: 'Planning a garden', breadcrumbs: TRAIL });
  assert.match(await render('page-parts/TitleBand', { eyebrow: 'Find' }, undefined, { locals }), /<p class="kn-heading-group-eyebrow" data-kn-type="label">Find<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden<\/h1>/);
  const term = { id: 'guides', collection: 'categories', data: { name: 'Guides' } };
  assert.match(await render('page-parts/TermOpening', { term }, undefined, { locals }), /Category<\/p><h1[^>]*>Guides<\/h1>/);
  assert.match(tight(await render('page-parts/PageBody', {}, { default: '<p>Words.</p>' }, { locals })), /<h1[^>]*>Planning a garden<\/h1>.*<div class="kn-section-body kn-body-text"><p>Words\.<\/p><\/div>/s);
  assert.match(await render('page-parts/ArticleBody', { menu: false }, { default: '<p><strong>Why?</strong></p>' }, { locals }), /<p class="kn-question"><strong>Why\?<\/strong><\/p>/);
  await assert.rejects(render('page-parts/TitleBand', {}, undefined, { locals: {} }), /designPage/);
});

test('every part is a component of its own, as the package exports them', () => {
  const files = readdirSync(new URL('../src/page-parts/', import.meta.url)).filter((name) => name.endsWith('.astro')).map((name) => name.replace(/\.astro$/, ''));
  assert.deepEqual(files.sort(), [...PARTS].sort());
});
