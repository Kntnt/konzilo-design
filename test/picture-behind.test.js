// A picture behind a band's text (directives.md, Rules for every directive; konzilo.md, A band's picture; issue #40):
// an <img> after the band's content, with the srcset and sizes it is given, so a browser loads a version near the band's
// width, where a CSS background loaded the widest. Its address is written as given, as every other picture's is, and
// it keeps the alt text it came with.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generate, parse as parseCss, walk } from 'css-tree';
import { chromium, firefox, webkit } from 'playwright-core';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { htmlToHast } from 'satteri';
import { render } from './helpers/render.js';
import { decodePng } from './helpers/ink.js';
import { serve } from './helpers/serve.js';
import { renderMarkdown, testDesign } from './helpers/konzilo-body.js';
import { ROLES, ROLE_TARGETS, contrast, derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { surfaceCss } from '../src/css/surface.js';
import { componentsCss } from '../src/css/components.js';
import { breadcrumbProps } from '../src/components/design-props.js';
import { pageContext } from '../src/directives/render/context.js';
import { renderDirective } from '../src/directives/render/render.js';
import { articleOpening } from '../src/page-parts/parts.js';
import { pictureSizes } from '../src/konzilo/images.js';

// The band's own children, in order, by their tags and classes.
const childrenOf = (section) => section.children.filter((node) => node.type === 1).map((node) => `${node.name}.${node.attributes.class}`);
const sectionOf = (html) => one(parse(html), 'section');
const pictureOf = (section) => section.children.find((node) => node.type === 1 && node.name === 'img');

test('a band on a picture Surface draws its picture as an <img> after its content, its address as given and alt text empty unless given', async () => {
  for (const address of ['/media/beds.webp', 'media/beds.webp', '../media/beds.webp', 'https://example.com/beds.webp']) {
    const band = sectionOf(await render('Band', { surface: 'picture-dark', picture: address }, { default: '<p>Words.</p>' }));
    assert.equal(band.attributes.style, undefined, `${address}: no style`);
    assert.deepEqual(childrenOf(band), ['div.kn-band-content', 'img.kn-band-picture'], address);
    const image = pictureOf(band).attributes;
    assert.equal(image.src, address);
    assert.equal(image.alt, '', `${address}: decorative unless the template says what it shows`);
    assert.equal(image.loading, 'eager');
  }
  const given = pictureOf(sectionOf(await render('Band', { surface: 'picture-light', picture: '/beds-2520.webp', alt: 'Raised beds', srcset: '/beds-509.webp 509w, /beds-1018.webp 1018w', sizes: '100vw', pictureWidth: 2520, pictureHeight: 1680 }))).attributes;
  assert.deepEqual([given.src, given.srcset, given.sizes, given.alt], ['/beds-2520.webp', '/beds-509.webp 509w, /beds-1018.webp 1018w', '100vw', 'Raised beds']);
  // Given the picture's width and height, as getImage() gives them, and no sizes, a band as tall as its text says the
  // window's width, which is all a sizes can know of it.
  const measured = pictureOf(sectionOf(await render('Band', { surface: 'picture-dark', picture: '/beds-2520.webp', srcset: '/beds-509.webp 509w', pictureWidth: 2520, pictureHeight: 1680 }))).attributes;
  assert.deepEqual([measured.sizes, measured.width, measured.height], ['100vw', '2520', '1680']);
  // A site's own style stays the band's.
  assert.equal(sectionOf(await render('Band', { surface: 'picture-dark', picture: '/a.webp', style: 'outline: 0' })).attributes.style, 'outline: 0');
  // Only a picture Surface shows a picture behind, as only it has the scrim the text is checked on.
  assert.equal(all(sectionOf(await render('Band', { surface: 'brand', picture: '/a.webp' })), 'img').length, 0);
  assert.equal(all(sectionOf(await render('Band', {})), 'img').length, 0);
});

test('a Hero with its picture behind gives the band its picture, its alt text, srcset and sizes', async () => {
  const hero = (props) => render('Hero', { heading: 'A heading', surface: 'picture-dark', picture: '/beds.webp', ...props });
  const plain = sectionOf(await hero({}));
  assert.equal(plain.attributes.style, undefined);
  assert.deepEqual(childrenOf(plain), ['div.kn-band-content kn-hero-content', 'img.kn-band-picture']);
  assert.equal(pictureOf(plain).attributes.alt, '');
  const given = pictureOf(sectionOf(await hero({ alt: 'Raised beds', srcset: '/beds-509.webp 509w', sizes: '100vw', pictureWidth: 2400, pictureHeight: 1600 }))).attributes;
  assert.deepEqual([given.src, given.srcset, given.sizes, given.alt, given.loading], ['/beds.webp', '/beds-509.webp 509w', '100vw', 'Raised beds', 'eager']);
  // With no sizes, the Hero works it out from its height and the picture's proportions: it covers a band at least half
  // the window's height, so a picture of 3:2 is drawn as wide as 75% of the window's height where that is wider, and
  // one of 16:9 at its full height as wide as 177.78%; with no height the band is as tall as its text.
  const sized = async (props) => pictureOf(sectionOf(await hero({ srcset: '/beds-509.webp 509w', ...props }))).attributes.sizes;
  assert.equal(await sized({ height: 'half', pictureWidth: 2400, pictureHeight: 1600 }), 'max(100vw, 75vh)');
  assert.equal(await sized({ height: 'full', pictureWidth: 1600, pictureHeight: 900 }), 'max(100vw, 177.7778vh)');
  assert.equal(await sized({ pictureWidth: 2400, pictureHeight: 1600 }), '100vw');
  assert.equal(await sized({ height: 'half', sizes: '50vw', pictureWidth: 2400, pictureHeight: 1600 }), '50vw', 'a sizes given is written as it is');
});

// A picture's proportions decide how wide a band taller than they are draws it, so a Band or a Hero given its versions
// requires its width and height, and guesses none (the owner, 2026-11-26).
test('a Band or a Hero given a srcset without its picture\'s width and height stops the build, naming both and where to get them', async () => {
  const components = { Band: { surface: 'picture-dark', picture: '/beds.webp' }, Hero: { heading: 'A heading', surface: 'picture-dark', picture: '/beds.webp', height: 'half' } };
  for (const [name, props] of Object.entries(components)) {
    for (const missing of [{}, { pictureWidth: 2400 }, { pictureHeight: 1600 }, { sizes: '100vw' }, { pictureWidth: 0, pictureHeight: 1600 }]) {
      await assert.rejects(render(name, { ...props, srcset: '/beds-509.webp 509w', ...missing }), (error) => {
        assert.match(error.message, new RegExp(`A ${name} given a srcset requires pictureWidth and pictureHeight`));
        assert.match(error.message, /getImage\(\), as image\.attributes\.width and image\.attributes\.height/);
        return true;
      }, `${name} ${JSON.stringify(missing)}`);
    }
    // Without a srcset it needs neither, as before.
    assert.equal(pictureOf(sectionOf(await render(name, props))).attributes.sizes, undefined, name);
  }
});

test('the hero directive draws its picture behind as an <img> with the core\'s srcset, the band\'s sizes and the picture\'s own alt text', () => {
  // The tree a site's reader hands the component, the picture as the core writes it, with the body's sizes.
  const opening = (src, picture, mark = '') => {
    const tree = htmlToHast(`<p>Start small.</p><figure${mark}><img src="${src}" srcset="/_astro/beds_360.webp 360w, /_astro/beds_509.webp 509w, /_astro/beds_2520.webp 2520w" sizes="(min-width: 48.6363rem) 45rem, calc(94.2858vw - 0.8572rem)" alt="Raised beds" width="2520" height="1680" loading="lazy" decoding="async"></figure>`, { fragment: true });
    return renderDirective('hero', {}, tree, pageContext({ design: testDesign({ hero: { picture } }), title: 'Planning a garden', warn: () => {} }));
  };
  const band = sectionOf(opening('/_astro/beds.webp', 'behind', ' data-konzilo-block="2"'));
  assert.equal(band.attributes.style, undefined);
  assert.deepEqual(childrenOf(band), ['div.kn-band-content kn-hero-content', 'img.kn-band-picture']);
  const image = pictureOf(band).attributes;
  assert.equal(image.src, '/_astro/beds.webp');
  assert.equal(image.srcset, '/_astro/beds_360.webp 360w, /_astro/beds_509.webp 509w, /_astro/beds_2520.webp 2520w');
  // The band is as wide as the window, and at least half its height, the design's, so a picture of 3:2 is drawn as wide
  // as 75% of the window's height where that is wider.
  assert.equal(image.sizes, 'max(100vw, 75vh)');
  assert.equal(image.sizes, pictureSizes(testDesign({ hero: { picture: 'behind' } }).resolved, 'band', { height: 'half', ratio: 1.5 }));
  assert.equal(image.alt, 'Raised beds', 'the alt text the picture came with');
  assert.equal(image.loading, 'eager');
  assert.deepEqual([image.width, image.height, image.decoding], ['2520', '1680', 'async']);
  assert.equal(image['data-konzilo-block'], '2', 'the block\'s mark stays on its picture');
  // A relative address is written as given, as beside the text.
  assert.equal(pictureOf(sectionOf(opening('media/beds.webp', 'behind'))).attributes.src, 'media/beds.webp');
  assert.match(opening('media/beds.webp', 'end'), /<div class="kn-hero-media"><img src="media\/beds\.webp"/);
});

test('an article\'s opening draws its main image behind as an <img> with the srcset and sizes it is given', () => {
  const picture = { src: '/_astro/soil.webp', srcset: '/_astro/soil_800.webp 800w, /_astro/soil_1200.webp 1200w', sizes: '100vw', width: 1600, height: 1067, alt: 'A spade in soil', loading: 'lazy', decoding: 'async' };
  const opening = (design, given = picture) => articleOpening(pageContext({ design: testDesign({ hero: design }), title: 'Know your soil', warn: () => {} }), { picture: given });
  const band = sectionOf(opening({ picture: 'behind' }));
  assert.equal(band.attributes.style, undefined);
  assert.deepEqual(childrenOf(band), ['div.kn-band-content kn-hero-content', 'img.kn-band-picture']);
  const image = pictureOf(band).attributes;
  assert.deepEqual([image.src, image.srcset, image.sizes, image.alt, image.loading], [picture.src, picture.srcset, '100vw', 'A spade in soil', 'eager']);
  assert.equal(pictureOf(sectionOf(opening({ picture: 'behind' }, { src: 'media/soil.webp', alt: '' }))).attributes.src, 'media/soil.webp');
});

// ---------- In print, by the stylesheets ----------

// What surface.js declares for a Surface, by property, each with every value it takes: the block of each kind, and the
// block a header the page starts under takes from its first band, of a design and one with the quiet edge, which adds
// the filled button's ring. A kind with a scrim is a picture's.
function surfaceDeclarations() {
  const blocks = { own: [], header: [] };
  for (const inputs of [defaultInputs(), { ...defaultInputs(), frame: { width: 1, color: 'border' } }]) {
    walk(parseCss(surfaceCss(derive(inputs).surfaces)), {
      visit: 'Rule',
      enter(rule) {
        const selector = generate(rule.prelude);
        const declared = new Map();
        walk(rule.block, { visit: 'Declaration', enter(node) { declared.set(node.property, generate(node.value).trim()); } });
        const kind = /\[data-kn-surface="([\w-]+)"\]/.exec(selector)?.[1];
        if (/^\[data-kn-surface="[\w-]+"\]$/.test(selector)) blocks.own.push({ kind, declared });
        else if (selector.endsWith('>[data-kn-start="under"]')) blocks.header.push({ kind, declared });
      },
    });
  }
  const pictures = new Set(blocks.own.filter(({ declared }) => declared.has('--kn-scrim')).map(({ kind }) => kind));
  const of = (found) => found.filter(({ kind }) => pictures.has(kind)).reduce((all, { declared }) => {
    for (const [property, value] of declared) all.set(property, [...(all.get(property) ?? []), value]);
    return all;
  }, new Map());
  return { picture: of(blocks.own), header: of(blocks.header) };
}

// What a component's stylesheet declares in print for one selector, at its top and in its print block.
function printedFor(file, selector) {
  const wanted = generate(parseCss(selector, { context: 'selector' }));
  const declared = new Map();
  walk(parseCss(readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8')), {
    visit: 'Rule',
    enter(rule) {
      const within = this.atrule;
      const applies = !within || within.name === 'layer' || (within.name === 'media' && generate(within.prelude) === 'print');
      if (!applies || !rule.prelude.children.toArray().some((one) => generate(one) === wanted)) return;
      walk(rule.block, { visit: 'Declaration', enter(node) { declared.set(node.property, generate(node.value).trim()); } });
    },
  });
  return declared;
}

// A band's, a card's and a header's own print rules take back what surface.js gives a picture's Surface, and what a
// header takes from a first band of one, so each stands in the colours of what it stands on: every declaration, unless
// it reads only what the rule takes back, as a background, a colour and the frame's ring do, or is one of the scrim's
// masks, which shape a scrim the rule clears. A declaration surface.js adds that a print rule leaves out fails here.
const MASKS = ['--kn-scrim-fade', '--kn-scrim-header'];
const PRINTED_RESETS = [
  ['band.css', '.kn-band:has(> .kn-band-picture)', 'picture'],
  ['cards.css', '.kn-cards[data-kn-picture="behind"] .kn-card:has(> .kn-card-picture)', 'picture'],
  ['header.css', '.kn-page:has(> .kn-page-main > .kn-band:first-child > .kn-band-picture) > .kn-header[data-kn-start="under"]', 'header'],
];
test('in print a band, a card and a header that a picture behind the text leaves on what they stand on take back every declaration surface.js gives them', () => {
  const surfaces = surfaceDeclarations();
  assert.ok(surfaces.picture.has('--kn-scrim') && surfaces.picture.has('background-image') && MASKS.every((mask) => surfaces.picture.has(mask)), 'a picture\'s Surface has its scrim, its picture and the scrim\'s masks');
  for (const [file, selector, from] of PRINTED_RESETS) {
    const printed = printedFor(file, selector);
    const reads = (values) => values.every((value) => /^var\(--kn-[\w-]+\)$/.test(value) && printed.has(value.slice(4, -1)));
    for (const [property, values] of surfaces[from]) {
      if (MASKS.includes(property) || reads(values)) continue;
      assert.ok(printed.has(property), `${file}: in print ${selector} takes back ${property}, which surface.js gives it as ${values[0]}`);
    }
    for (const [property, value] of printed) {
      if (!surfaces[from].has(property)) continue;
      const taken = property === '--kn-scrim' ? 'transparent' : property === 'background-image' ? 'none' : 'inherit';
      assert.equal(value, taken, `${file}: in print ${selector} sets ${property} to ${taken}`);
    }
  }
});

// ---------- In the browser ----------

const BROWSERS =Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
// A phone and a wide screen.
const WINDOWS = [[390, 844], [1440, 900]];
const HEIGHTS = ['third', 'half', 'two-thirds', 'full'];
// In the middle the even scrim covers the picture; at the top and the bottom the overlay fades.
const PLACES = ['center', 'top', 'bottom'];
const MODES = ['light', 'dark'];
// The presentation's own photo, 1920 × 1281, so a phone's band crops its sides and a wide one its top and bottom.
const PICTURE = '/hero.webp';
// The hero directive's and an article opening's, at the default design's height and one more, in the middle and at the
// bottom, in light mode: the same band, drawn by the renderers in place of Hero.
const DRAWN_BY = ['directive', 'opening'];
const DRAWN_HEIGHTS = ['half', 'full'];
const DRAWN_PLACES = ['center', 'bottom'];
// In print, a sheet of A4, 210 × 297 mm, at 96 CSS pixels to the inch, as a browser lays a page out on it. On it, each
// band with its picture behind, under the site's header and with a band on the page after it: a Hero with its text at
// each place, and under a header the page starts under, the hero directive's, an article opening's, the design's own,
// a Band's, one with a picture taller than half the sheet, and a series of cards with their pictures behind, on the page
// and in a band of another colour.
const SHEET = { width: 794, height: 1123 };
const PRINTED = ['hero-top', 'hero-center', 'hero-bottom', 'hero-under', 'directive', 'opening', 'band', 'tall'];
const DECK = 'Practical support, useful information and a straightforward way to get started.';
const TALL = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="900" height="1600" fill="#5a7d5a"/><circle cx="450" cy="800" r="300" fill="#d9c27a"/></svg>')}`;
const CARDS = `::::section\n\n## Plans\n\n:::cards{picture="behind"}\n\n${['Plan the first week', 'What a visit costs', 'Tools we rely on'].map((heading, i) => `### ${heading}\n\n![A landscape](/landscape-${i + 1}.webp)\n\nThe words of the card.`).join('\n\n')}\n\n### No picture\n\nThe words of the card.\n\n:::\n\n::::`;

let server;
const browsers = [];
before(async () => {
  const styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  const pages = new Map();
  const next = await render('Band', {}, { default: '<h2>What follows</h2><p>Some words.</p>' });
  const document = (page, mode) => `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><title>Hero</title><style>${styles}</style></head><body>${page}</body></html>`;
  for (const height of HEIGHTS) for (const place of PLACES) {
    const hero = await render('Hero', { heading: 'Make the next step clear', eyebrow: 'A clear direction', deck: 'Practical support, useful information and a straightforward way to get started.', surface: 'picture-dark', picture: PICTURE, alt: 'A garden', height, place }, { default: '<p>A note under the deck.</p>' });
    const page = await render('Page', {}, { default: `${hero}${next}` });
    for (const mode of MODES) pages.set(`/${height}-${place}-${mode}.html`, document(page, mode));
  }
  // The hero directive from a body's tree, its picture as the core writes it, and an article's opening of its main image,
  // each with the sizes it writes, as wide as the band draws the picture: with the band's width alone, WebKit draws a
  // picture taller in its proportions than its band from a version it has scaled down to the band's width, and soft.
  const image = `<img src="${PICTURE}" srcset="${PICTURE} 1920w" sizes="100vw" alt="A garden" width="1920" height="1281">`;
  for (const height of DRAWN_HEIGHTS) for (const place of DRAWN_PLACES) {
    const ctx = pageContext({ design: testDesign({ hero: { picture: 'behind', height, place } }), title: 'Make the next step clear', warn: () => {} });
    const directive = renderDirective('hero', { height }, htmlToHast(`<p>Practical support, useful information and a straightforward way to get started.</p><figure>${image}</figure>`, { fragment: true }), ctx);
    const opening = articleOpening(ctx, { data: { headline: 'Make the next step clear', standfirst: 'Practical support, useful information and a straightforward way to get started.' }, picture: { src: PICTURE, srcset: `${PICTURE} 1920w`, sizes: pictureSizes(ctx.design.resolved, 'band', { height, ratio: 1920 / 1281 }), width: 1920, height: 1281, alt: 'A garden' } });
    for (const [by, hero] of [['directive', directive], ['opening', opening]]) pages.set(`/${by}-${height}-${place}-light.html`, document(await render('Page', {}, { default: `${hero}${next}` }), 'light'));
  }
  const header = (start) => render('Header', { identity: { label: 'Example', href: '#home', name: 'Example' }, menu: [{ label: 'Products', href: '#products' }], linkMenu: true, attachment: 'sticky', start });
  const below = await header('below');
  const trail = await render('Breadcrumbs', breadcrumbProps({ separator: 'slash', current: true, narrow: 'trail' }, { name: 'Example' }, { trail: [{ label: 'Services', href: '#services' }, { label: 'A clear next step' }] }));
  const hero = (props) => render('Hero', { heading: 'Make the next step clear', eyebrow: 'A clear direction', deck: DECK, surface: 'picture-dark', picture: PICTURE, alt: 'A garden', height: 'half', ...props }, { before: trail, default: '<p>A note under the deck.</p>' });
  const ctx = pageContext({ design: testDesign({ hero: { picture: 'behind' } }), title: 'Make the next step clear', warn: () => {} });
  const printed = {
    'hero-top': [below, await hero({ place: 'top' })],
    'hero-center': [below, await hero({ place: 'center' })],
    'hero-bottom': [below, await hero({ place: 'bottom' })],
    'hero-under': [await header('under'), await hero({ place: 'bottom', height: 'full' })],
    directive: [below, renderDirective('hero', {}, htmlToHast(`<p>${DECK}</p><figure>${image}</figure>`, { fragment: true }), ctx)],
    opening: [below, articleOpening(ctx, { data: { headline: 'Make the next step clear', standfirst: DECK }, picture: { src: PICTURE, srcset: `${PICTURE} 1920w`, sizes: pictureSizes(ctx.design.resolved, 'band', { height: 'half', ratio: 1920 / 1281 }), width: 1920, height: 1281, alt: 'A garden' } })],
    band: [below, await render('Band', { surface: 'picture-dark', picture: PICTURE, alt: 'A garden' }, { default: '<h2>Raised beds</h2><p>Start small, and let the beds widen year by year.</p>' })],
    tall: [below, await render('Band', { surface: 'picture-light', picture: TALL }, { default: '<h2>A tall picture</h2><p>Taller than half the sheet.</p>' })],
    cards: [below, renderMarkdown(CARDS)],
    'cards-band': [below, renderMarkdown(CARDS.replace('::::section', '::::section{surface="inverse"}'))],
  };
  for (const [name, [top, band]] of Object.entries(printed)) for (const mode of MODES) pages.set(`/print-${name}-${mode}.html`, document(await render('Page', {}, { header: top, default: `${band}${next}` }), mode));
  server = await serve(fileURLToPath(new URL('../presentation/pictures/', import.meta.url)), { pages });
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(async () => {
  await Promise.all(browsers.map(([, browser]) => browser.close()));
  await server?.close();
});

// How far apart two screenshots are, square by square of BLOCK pixels: the largest difference of a square's mean in a
// channel, in levels of 255. An engine samples a picture a little differently as an <img> and as a background, a few
// levels at a pixel, which a square's mean evens out, while a picture moved by a single pixel moves every edge in it.
// The three engines draw the two within about three levels of each other (measured 2026-11-26), and a missing or a
// second scrim, or text under the picture, tens of levels apart.
const BLOCK = 16;
const LIMIT = 4;
function apart(one, other) {
  assert.deepEqual([one.width, one.height], [other.width, other.height], 'the same box');
  let worst = 0;
  for (let top = 0; top + BLOCK <= one.height; top += BLOCK) for (let left = 0; left + BLOCK <= one.width; left += BLOCK) {
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0;
      for (let y = top; y < top + BLOCK; y++) for (let x = left; x < left + BLOCK; x++) {
        sum += one.pixels[(y * one.width + x) * one.channels + channel] - other.pixels[(y * other.width + x) * other.channels + channel];
      }
      worst = Math.max(worst, Math.abs(sum) / BLOCK ** 2);
    }
  }
  return worst;
}

// That a page's hero, `/<page>.html`, draws its picture behind its text as its CSS background did, in each engine at a
// phone's and a wide window: the same box, crop and place, under the scrim and the text.
async function fillsAsBackground(t, pages) {
  for (const [name, browser] of browsers) for (const [width, height] of WINDOWS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const tab = await context.newPage();
    try {
      for (const page of pages) {
        const label = `${name} ${width} × ${height}, ${page}`;
        await tab.goto(`${server.origin}/${page}.html`);
        // WebKit decodes a large picture apart from the page and draws it once it is done.
        await tab.evaluate(() => document.querySelector('.kn-band-picture').decode());
        const drawn = await tab.evaluate(() => {
          const hero = document.querySelector('.kn-hero');
          const image = hero.querySelector('.kn-band-picture');
          const box = (node) => {
            const { left, top, width, height } = node.getBoundingClientRect();
            return { left, top, width, height };
          };
          const heading = hero.querySelector('.kn-heading-group-heading').getBoundingClientRect();
          const { objectFit, objectPosition } = getComputedStyle(image);
          const met = document.elementFromPoint(heading.left + 4, heading.top + heading.height / 2);
          return {
            hero: box(hero), image: box(image), objectFit, objectPosition, onTop: Boolean(met?.closest('.kn-heading-group-heading')),
            // Covering the band, the picture runs past it across or down, whichever its proportions are narrower in.
            across: image.naturalWidth / image.naturalHeight > hero.clientWidth / hero.clientHeight,
          };
        });
        for (const side of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(drawn.image[side] - drawn.hero[side]) < 0.5, `${label}: the picture's ${side} is the band's, ${drawn.image[side]}, not ${drawn.hero[side]}`);
        assert.equal(drawn.objectFit, 'cover', label);
        assert.equal(drawn.objectPosition, '50% 50%', label);
        assert.ok(drawn.onTop, `${label}: the heading stands over the picture`);
        const now = decodePng(await tab.locator('.kn-hero').screenshot({ animations: 'disabled' }));
        // The same hero with its picture as the CSS background it was until issue #40: the Surface's even scrim over the
        // picture in the middle, the picture alone under the fade at the top and the bottom, covering the band from its
        // centre. An engine starts a background at a whole pixel and may start an <img> between two, so the background is
        // also drawn up to half a pixel either way along the picture's run past the band, by quarters.
        await tab.evaluate(() => document.querySelector('.kn-hero .kn-band-picture').remove());
        let distance = Infinity;
        for (const shift of [0, 0.25, -0.25, 0.5, -0.5]) {
          await tab.evaluate(([source, offset, across]) => {
            const hero = document.querySelector('.kn-hero');
            const even = (hero.dataset.knPlace ?? 'center') === 'center';
            hero.style.backgroundImage = `${even ? 'linear-gradient(var(--kn-scrim), var(--kn-scrim)), ' : ''}url("${source}")`;
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = across ? `calc(50% + ${offset}px) 50%` : `50% calc(50% + ${offset}px)`;
          }, [PICTURE, shift, drawn.across]);
          // Two frames, so WebKit has drawn the background at its new place.
          await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          distance = Math.min(distance, apart(now, decodePng(await tab.locator('.kn-hero').screenshot({ animations: 'disabled' }))));
          if (distance <= LIMIT) break;
        }
        t.diagnostic(`${label}: ${distance.toFixed(2)}`);
        assert.ok(distance <= LIMIT, `${label}: a square of the hero is ${distance.toFixed(2)} levels from the background's`);
      }
    } finally {
      await context.close();
    }
  }
}

test('a picture behind a hero\'s text fills the band exactly as its CSS background did, under the scrim and the text, at every height and place, in both modes', { timeout: 600000 }, async (t) => {
  await fillsAsBackground(t, HEIGHTS.flatMap((share) => PLACES.flatMap((place) => MODES.map((mode) => `${share}-${place}-${mode}`))));
});

test('the hero directive\'s and an article opening\'s picture behind the text fill the band as Hero\'s does', { timeout: 600000 }, async (t) => {
  await fillsAsBackground(t, DRAWN_BY.flatMap((by) => DRAWN_HEIGHTS.flatMap((share) => DRAWN_PLACES.map((place) => `${by}-${share}-${place}-light`))));
});

// ---------- In print ----------
// A browser prints an <img> whether or not it prints backgrounds, and the scrim is a background, which it prints only
// where the reader asks for backgrounds. So in print a picture behind a band's or a card's text is an ordinary picture
// above the text, whole and without the scrim, and the text takes the page's colours, which need no background to be
// read (the owner, 2026-11-26; konzilo.md, A band's picture).

// A layer's paint as `content` or `background-color background-image`, and whether it paints nothing.
const clear = (layer) => layer === 'none' || /(?:, 0\)|\/ 0\)|transparent) none$/.test(layer);
const hex = (color) => `#${color.match(/[\d.]+/g).slice(0, 3).map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('')}`;

// What a printed page shows of its first band with a picture behind: the boxes of the band, its picture, its content
// and the header, the picture's own proportions, the band's paddings, the space a band without a picture has, its scrim
// and the hero's fade, and the colours of the heading, the band, the header and the page, every role by its token.
function readBand(roles) {
  const band = document.querySelector('.kn-band:has(> .kn-band-picture)');
  const picture = band.querySelector(':scope > .kn-band-picture');
  const content = band.querySelector(':scope > .kn-band-content');
  const header = document.querySelector('.kn-header');
  const page = document.querySelector('.kn-page');
  const box = (node) => {
    const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
    return { left, top, right, bottom, width, height };
  };
  const words = document.createRange();
  words.selectNodeContents(content);
  const probe = band.parentElement.appendChild(document.createElement('section'));
  probe.className = 'kn-band';
  const space = parseFloat(getComputedStyle(probe).paddingBlockStart);
  probe.remove();
  const layer = (node, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    return style.content === 'none' ? 'none' : `${style.backgroundColor} ${style.backgroundImage}`;
  };
  const colours = (node) => {
    const style = getComputedStyle(node);
    return { color: style.color, background: style.backgroundColor, scheme: style.colorScheme, roles: roles.map((role) => style.getPropertyValue(`--kn-${role}`).trim()) };
  };
  const style = getComputedStyle(band);
  const next = band.nextElementSibling;
  return {
    band: box(band), picture: box(picture), content: box(content), words: words.getBoundingClientRect().top, header: box(header),
    proportions: picture.naturalWidth / picture.naturalHeight, padding: [parseFloat(style.paddingBlockStart), parseFloat(style.paddingBlockEnd)], space,
    layers: [layer(band, '::after'), layer(content, '::before')], image: style.backgroundImage,
    heading: getComputedStyle(content.querySelector('h1, h2, .kn-heading-group-heading')).color,
    colours: colours(band), headerColours: colours(header), page: colours(page),
    next: next.dataset.knSurface ? null : parseFloat(getComputedStyle(next).paddingBlockStart),
  };
}

// How far the picture at `selector` is drawn from the same picture alone in its box, inside an inset that leaves out
// rounded corners: a copy of it laid over everything there. Anything drawn over the picture, a scrim or a fade, or the
// text, sets them tens of levels apart; the same picture drawn twice, none.
async function bare(tab, selector, inset) {
  const clip = await tab.evaluate(([selector, inset]) => {
    const { left, top, width, height } = document.querySelector(selector).getBoundingClientRect();
    return { x: left + inset, y: top + inset, width: width - 2 * inset, height: height - 2 * inset };
  }, [selector, inset]);
  const drawn = decodePng(await tab.screenshot({ clip, animations: 'disabled' }));
  await tab.evaluate(async (selector) => {
    const picture = document.querySelector(selector);
    const { left, top, width, height } = picture.getBoundingClientRect();
    const { objectFit, objectPosition } = getComputedStyle(picture);
    const copy = picture.cloneNode();
    copy.removeAttribute('class');
    copy.style.cssText = `position: absolute; left: ${left + scrollX}px; top: ${top + scrollY}px; width: ${width}px; height: ${height}px; max-width: none; max-height: none; margin: 0; object-fit: ${objectFit}; object-position: ${objectPosition}; z-index: 2147483647`;
    document.body.append(copy);
    await copy.decode();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, selector);
  const alone = decodePng(await tab.screenshot({ clip, animations: 'disabled' }));
  await tab.evaluate(() => document.body.lastElementChild.remove());
  return apart(drawn, alone);
}

test('in print a picture behind a band\'s text stands whole above all of it, within the content area and at most half the sheet high, with no scrim, the text in the page\'s colours, in both modes', { timeout: 600000 }, async (t) => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: SHEET });
    try {
      await tab.emulateMedia({ media: 'print' });
      for (const printed of PRINTED) for (const mode of MODES) {
        const label = `${name}, ${printed} in ${mode} mode`;
        await tab.goto(`${server.origin}/print-${printed}-${mode}.html`);
        await tab.evaluate(() => document.querySelector('.kn-band-picture').decode());
        const seen = await tab.evaluate(readBand, ROLES);
        const { band, picture, content } = seen;
        // First in the band, before the trail, under the space a band without a picture has, the hero's height and the
        // header's room gone: the band is as tall as its space, its picture and its text.
        assert.ok(picture.bottom <= seen.words + 0.5, `${label}: the picture, to ${picture.bottom}, stands above the band's first text, at ${seen.words}`);
        assert.ok(Math.abs(picture.top - band.top - seen.padding[0]) < 0.5 && Math.abs(band.bottom - seen.padding[1] - content.bottom) < 0.5, `${label}: the band has no height of its own, ${JSON.stringify([band, picture, content, seen.padding])}`);
        assert.ok(Math.abs(seen.padding[0] - seen.space) < 0.5 && Math.abs(band.top - seen.header.bottom) < 0.5, `${label}: no more space above the picture than a band without one has, ${seen.padding[0]} under the header's ${seen.header.bottom}, not ${seen.space}`);
        if (seen.next !== null) assert.equal(seen.next, 0, `${label}: a band after it on the page shares its space`);
        // Whole, at its own proportions, as wide as the content area or half the sheet high, centred.
        assert.ok(picture.left >= content.left - 0.5 && picture.right <= content.right + 0.5, `${label}: within the content area`);
        assert.ok(Math.abs(picture.left + picture.right - content.left - content.right) < 1, `${label}: centred`);
        assert.ok(Math.abs(picture.width / picture.height / seen.proportions - 1) < 0.005, `${label}: at its own proportions, ${picture.width} × ${picture.height}, not ${seen.proportions}`);
        assert.ok(picture.height <= SHEET.height / 2 + 0.5, `${label}: at most half the sheet high, ${picture.height}`);
        assert.ok(Math.abs(picture.width - content.width) < 0.5 || Math.abs(picture.height - SHEET.height / 2) < 0.5, `${label}: across the content area, or half the sheet high`);
        // No scrim and no fade over it, nor anything else.
        assert.ok(seen.layers.every(clear) && seen.image === 'none', `${label}: no scrim or fade, ${seen.layers}, ${seen.image}`);
        const distance = await bare(tab, '.kn-band-picture', 1);
        t.diagnostic(`${label}: ${distance.toFixed(2)}`);
        assert.ok(distance <= LIMIT, `${label}: the picture is drawn ${distance.toFixed(2)} levels from itself alone`);
        // The page's colours, every role, in its scheme, and the header's that the page starts under with them.
        assert.equal(seen.heading, seen.page.color, `${label}: the heading in the page's text colour`);
        assert.equal(seen.colours.background, seen.page.background, `${label}: on the page's background`);
        assert.ok(contrast(hex(seen.heading), hex(seen.page.background)) >= ROLE_TARGETS.text, `${label}: at the design's contrast`);
        assert.deepEqual([seen.colours.scheme, seen.colours.roles], [seen.page.scheme, seen.page.roles], `${label}: every role the page's`);
        assert.deepEqual([seen.headerColours.color, seen.headerColours.roles], [seen.page.color, seen.page.roles], `${label}: the header in the page's colours`);
      }
    } finally {
      await tab.close();
    }
  }
});

test('in print a card\'s picture behind its text stands above it, 16:9 of the card\'s width, with no scrim and in the page\'s colours, in both modes', { timeout: 300000 }, async (t) => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: SHEET });
    try {
      await tab.emulateMedia({ media: 'print' });
      for (const mode of MODES) {
        const label = `${name} in ${mode} mode`;
        await tab.goto(`${server.origin}/print-cards-${mode}.html`);
        await tab.evaluate(() => Promise.all([...document.querySelectorAll('.kn-card-picture')].map((picture) => picture.decode())));
        const seen = await tab.evaluate((roles) => {
          const page = getComputedStyle(document.querySelector('.kn-page'));
          const rolesOf = (style) => roles.map((role) => style.getPropertyValue(`--kn-${role}`).trim());
          return { page: { color: page.color, background: page.backgroundColor, roles: rolesOf(page) }, cards: [...document.querySelectorAll('.kn-card:has(> .kn-card-picture)')].map((card) => {
            const picture = card.querySelector(':scope > .kn-card-picture').getBoundingClientRect();
            const style = getComputedStyle(card);
            const scrim = getComputedStyle(card, '::after');
            return {
              card: card.getBoundingClientRect().toJSON(), picture: picture.toJSON(), fit: getComputedStyle(card.querySelector('.kn-card-picture')).objectFit,
              words: Math.min(...[...card.children].filter((child) => !child.matches('.kn-card-picture')).map((child) => child.getBoundingClientRect().top)),
              scrim: scrim.content === 'none' ? 'none' : `${scrim.backgroundColor} ${scrim.backgroundImage}`,
              image: style.backgroundImage,
              heading: getComputedStyle(card.querySelector('.kn-card-heading')).color, background: style.backgroundColor, roles: rolesOf(style),
            };
          }) };
        }, ROLES);
        assert.equal(seen.cards.length, 3, label);
        for (const [i, { card, picture, fit, words, scrim, image, heading, background, roles }] of seen.cards.entries()) {
          const which = `${label}, card ${i + 1}`;
          assert.ok(Math.abs(picture.top - card.top) < 0.5 && picture.bottom <= words + 0.5, `${which}: the picture first, above the card's text`);
          assert.ok(Math.abs(picture.left - card.left) < 0.5 && Math.abs(picture.width - card.width) < 0.5, `${which}: as wide as the card`);
          assert.ok(Math.abs(picture.height - picture.width * 9 / 16) < 0.5 && fit === 'cover', `${which}: cropped to 16:9, ${picture.width} × ${picture.height}`);
          assert.ok(clear(scrim), `${which}: no scrim, ${scrim}`);
          // Nor the Surface's own under the picture, a background a browser prints with backgrounds.
          assert.equal(image, 'none', `${which}: no scrim under the picture either`);
          assert.equal(heading, seen.page.color, `${which}: the heading in the page's text colour`);
          assert.equal(background, seen.page.background, `${which}: on the page's background`);
          assert.ok(contrast(hex(heading), hex(seen.page.background)) >= ROLE_TARGETS.text, `${which}: at the design's contrast`);
          assert.deepEqual(roles, seen.page.roles, `${which}: every role the page's`);
          const distance = await bare(tab, `.kn-cards > .kn-card:nth-child(${i + 1}) > .kn-card-picture`, 12);
          t.diagnostic(`${which}: ${distance.toFixed(2)}`);
          assert.ok(distance <= LIMIT, `${which}: the picture is drawn ${distance.toFixed(2)} levels from itself alone`);
        }
      }
    } finally {
      await tab.close();
    }
  }
});

// A card with its picture behind, in a band of another colour, prints in that band's colours, as an ordinary card there
// does: with backgrounds printed, the page's dark text would stand on the band's dark background (the assistant's reading
// of #43's "in the page's colours", awaiting the owner; konzilo.md, A band's picture).
test('in print a card\'s picture behind its text in a band of another colour leaves the card in the band\'s colours, as an ordinary card there, in both modes', { timeout: 300000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: SHEET });
    try {
      await tab.emulateMedia({ media: 'print' });
      for (const mode of MODES) {
        const label = `${name} in ${mode} mode`;
        await tab.goto(`${server.origin}/print-cards-band-${mode}.html`);
        const seen = await tab.evaluate((roles) => {
          const colours = (node) => {
            const style = getComputedStyle(node);
            return { color: style.color, background: style.backgroundColor, scheme: style.colorScheme, roles: roles.map((role) => style.getPropertyValue(`--kn-${role}`).trim()) };
          };
          const heading = (card) => getComputedStyle(card.querySelector('.kn-card-heading')).color;
          const cards = [...document.querySelectorAll('.kn-band[data-kn-surface] .kn-card')];
          return {
            band: colours(document.querySelector('.kn-band[data-kn-surface]')),
            page: colours(document.querySelector('.kn-page')),
            behind: cards.filter((card) => card.querySelector(':scope > .kn-card-picture')).map((card) => ({ ...colours(card), heading: heading(card) })),
            ordinary: cards.filter((card) => !card.querySelector(':scope > .kn-card-picture')).map(heading),
          };
        }, ROLES);
        assert.equal(seen.behind.length, 3, label);
        assert.equal(seen.ordinary.length, 1, label);
        assert.notEqual(seen.band.background, seen.page.background, `${label}: the band is of another colour than the page`);
        for (const [i, card] of seen.behind.entries()) {
          const which = `${label}, card ${i + 1}`;
          assert.equal(card.heading, seen.band.color, `${which}: the heading in the band's text colour`);
          assert.equal(card.heading, seen.ordinary[0], `${which}: as an ordinary card's heading in the band`);
          assert.equal(card.background, seen.band.background, `${which}: on the band's background`);
          assert.ok(contrast(hex(card.heading), hex(seen.band.background)) >= ROLE_TARGETS.text, `${which}: at the design's contrast`);
          assert.deepEqual([card.scheme, card.roles], [seen.band.scheme, seen.band.roles], `${which}: every role the band's`);
        }
      }
    } finally {
      await tab.close();
    }
  }
});

// A PDF's first page as Firefox's own pdf.js draws it at 100%, where a pixel is a CSS pixel of the page as it was laid
// out on the sheet. Playwright turns pdf.js off, and a preference turns it on again.
async function firstPage(viewer, pdf) {
  const tab = await viewer.newPage({ viewport: { width: 1000, height: 1300 } });
  try {
    await tab.route('**/sheet.pdf', (route) => route.fulfill({ body: pdf, contentType: 'application/pdf' }));
    await tab.goto('http://sheet.test/sheet.pdf#zoom=100');
    const canvas = tab.locator('.page[data-page-number="1"][data-loaded="true"] .canvasWrapper > canvas');
    await canvas.waitFor();
    return decodePng(await canvas.screenshot());
  } finally {
    await tab.close();
  }
}
// The pixels of a box, a whole number of pixels in from its edges.
function within(image, { left, top, right, bottom }, inset = 0) {
  const pixels = [];
  for (let y = Math.ceil(top) + inset; y < Math.floor(bottom) - inset; y++) for (let x = Math.ceil(left) + inset; x < Math.floor(right) - inset; x++) {
    const at = (y * image.width + x) * image.channels;
    pixels.push([image.pixels[at], image.pixels[at + 1], image.pixels[at + 2]]);
  }
  return pixels;
}
const lightness = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// What a line of text prints as: the paper, its commonest colour, and the ink, the pixel least like the paper.
function inkOf(pixels) {
  const counts = new Map();
  for (const pixel of pixels) counts.set(pixel.join(), (counts.get(pixel.join()) ?? 0) + 1);
  const paper = [...counts].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const ink = pixels.reduce((most, pixel) => Math.abs(lightness(pixel) - lightness(paper)) > Math.abs(lightness(most) - lightness(paper)) ? pixel : most, paper);
  return { paper, ink };
}
const near = (one, other, tolerance) => one.every((channel, i) => Math.abs(channel - other[i]) <= tolerance);
const rgb = ([r, g, b]) => hex(`rgb(${r}, ${g}, ${b})`);

test('Chromium\'s PDF shows the picture above a heading in the page\'s colours, readable whether or not it prints backgrounds', { timeout: 300000, skip: !BROWSERS.some(([name]) => name === 'chromium') || !existsSync(firefox.executablePath()) }, async (t) => {
  const [, maker] = browsers.find(([name]) => name === 'chromium');
  const viewer = await firefox.launch({ firefoxUserPrefs: { 'pdfjs.disabled': false } });
  const tab = await maker.newPage({ viewport: SHEET });
  try {
    await tab.emulateMedia({ media: 'print' });
    for (const printed of ['opening', 'hero-under']) for (const mode of MODES) {
      await tab.goto(`${server.origin}/print-${printed}-${mode}.html`);
      await tab.evaluate(() => document.querySelector('.kn-band-picture').decode());
      // Where the page lays out its picture and its heading on the sheet, and the heading of the band after it.
      const boxes = await tab.evaluate(() => Object.fromEntries(Object.entries({ picture: '.kn-band-picture', heading: '.kn-band:has(> .kn-band-picture) .kn-heading-group-heading', after: '.kn-band:has(> .kn-band-picture) + .kn-band h2' }).map(([part, selector]) => [part, document.querySelector(selector).getBoundingClientRect().toJSON()])));
      assert.ok(boxes.picture.bottom < boxes.heading.top && boxes.after.bottom < SHEET.height, `${printed} in ${mode} mode: ${JSON.stringify(boxes)}`);
      const sheets = [];
      for (const printBackground of [false, true]) {
        const label = `${printed} in ${mode} mode, ${printBackground ? 'with' : 'without'} backgrounds`;
        const sheet = await firstPage(viewer, await tab.pdf({ format: 'A4', printBackground }));
        assert.deepEqual([sheet.width, sheet.height], [SHEET.width, SHEET.height], label);
        sheets.push(sheet);
        // The picture, as varied as a photo, not the paper.
        const shades = within(sheet, boxes.picture, 4).map(lightness);
        const mean = shades.reduce((sum, shade) => sum + shade, 0) / shades.length;
        const spread = Math.sqrt(shades.reduce((sum, shade) => sum + (shade - mean) ** 2, 0) / shades.length);
        assert.ok(spread > 20, `${label}: the picture shows above the heading, its shades spread ${spread.toFixed(1)}`);
        // The heading prints as the page's own text, the band's after it: in light mode dark on the paper.
        const heading = inkOf(within(sheet, boxes.heading));
        const after = inkOf(within(sheet, boxes.after));
        t.diagnostic(`${label}: the picture's shades spread ${spread.toFixed(1)}, the heading ${rgb(heading.ink)} on ${rgb(heading.paper)}, the next ${rgb(after.ink)} on ${rgb(after.paper)}`);
        assert.ok(near(heading.paper, after.paper, 2) && near(heading.ink, after.ink, 8), `${label}: the heading prints as the page's text, ${rgb(heading.ink)} on ${rgb(heading.paper)}, where it is ${rgb(after.ink)} on ${rgb(after.paper)}`);
        if (mode === 'light') assert.ok(contrast(rgb(heading.ink), rgb(heading.paper)) >= ROLE_TARGETS.text, `${label}: the heading reads, ${rgb(heading.ink)} on ${rgb(heading.paper)}`);
      }
      // In light mode the paper is the page's, so the heading prints the same whether or not backgrounds are.
      if (mode === 'light') {
        const around = (sheet) => {
          const { left, top, width, height } = boxes.heading;
          const x = Math.floor(left) - 16, y = Math.floor(top) - 16, w = Math.ceil(width) + 32, h = Math.ceil(height) + 32;
          const pixels = Buffer.alloc(w * h * sheet.channels);
          for (let row = 0; row < h; row++) sheet.pixels.copy(pixels, row * w * sheet.channels, ((y + row) * sheet.width + x) * sheet.channels, ((y + row) * sheet.width + x + w) * sheet.channels);
          return { width: w, height: h, channels: sheet.channels, pixels };
        };
        const distance = apart(around(sheets[0]), around(sheets[1]));
        t.diagnostic(`${printed}: the heading prints ${distance.toFixed(2)} levels apart with and without backgrounds`);
        assert.ok(distance <= LIMIT, `${printed}: the heading prints ${distance.toFixed(2)} levels apart with and without backgrounds`);
      }
    }
  } finally {
    await tab.close();
    await viewer.close();
  }
});
