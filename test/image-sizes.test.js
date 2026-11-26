// The widths and sizes in which the design draws an image, by the core's contexts (docs/spec/konzilo.md, Images), as
// fromDesign hands them to the core's konzilo({ images }): each context's `sizes` against the width the design's CSS
// draws its image at, worked out here straight from the specs' words, and in every engine against the browser's own
// layout.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { heroProps } from '../src/components/design-props.js';
import { pageContext } from '../src/directives/render/context.js';
import { articleBody } from '../src/page-parts/parts.js';
import { teaserCard } from '../src/presentations/teasers.js';
import { imageContexts } from '../src/konzilo/index.js';
import { CARD, GALLERY, HERO_STACKED, SWITCH, WIDEST, drawnWidths } from '../src/konzilo/images.js';
import { render } from './helpers/render.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

// Designs at the ends of what the tool allows (schema: Narrow 480–960, Wide 800–1800), one where Narrow is wider than
// Wide, and a hero's picture in each place the design may put it.
const hero = (picture) => ({ hero: { ...defaultInputs().hero, picture } });
const DESIGNS = {
  default: {},
  other: { layout: { narrow: 560, wide: 1440 }, 'density-profile': 100, ...hero('end') },
  small: { layout: { narrow: 480, wide: 800 }, 'density-profile': 0, ...hero('start-bleed') },
  large: { layout: { narrow: 960, wide: 1800 }, ...hero('end-bleed') },
  inverted: { layout: { narrow: 960, wide: 800 }, ...hero('start') },
  none: hero('none'),
};
const design = (inputs) => derive({ ...defaultInputs(), ...inputs });

// The design's measures straight from page.md's words, in px at a 16px root, with the clamps' own endpoints
// unrounded: the side margin 16–48 px over windows of 320–1440 px, the content area min(window − 2 × margin, Wide),
// and Narrow within it.
const fluid = ({ min, max }, px) => Math.min(Math.max(min, max), Math.max(Math.min(min, max), min + (max - min) * (px - 320) / 1120));
const contentArea = (r, px) => Math.min(px - 2 * fluid({ min: 16, max: 48 }, px), r.layout.wide);
const readingColumn = (r, px) => Math.min(contentArea(r, px), r.layout.narrow);
// A series of two items as its grid lays it out (cards.css, the owner's rule of 2026-11-10): `auto-fill` tracks at
// least the greatest of its terms wide, `gap` apart, the item in the first. Two items are the widest a series draws an
// item at, whatever the number, since one item takes a third. The terms times 999 are the CSS's switches.
function widestOfSeries(row, minimum, gap) {
  const two = (row - gap) * 0.99 / 2;
  const least = Math.max(two, Math.min(two, (3 * minimum + 2 * gap - row) * 999), Math.min(row, (2 * minimum + gap - row) * 999));
  const tracks = Math.max(1, Math.floor((row + gap) / (least + gap)));
  return (row - (tracks - 1) * gap) / tracks;
}
const DRAWN = {
  // A body's figure stands in the reading column, at most its width (konzilo.css, page.md's Reading Area).
  body: readingColumn,
  // A gallery in that column: its pictures in columns of at least 12rem, the component gap apart (konzilo.css).
  gallery: (r, px) => widestOfSeries(readingColumn(r, px), 12 * 16, fluid(r.space.roles['component-gap'], px)),
  // The core's lightbox fits the whole picture in the window, at most its width (its modal.css).
  lightbox: (r, px) => px,
  // A hero's picture behind its text covers the band, the window's width; beside it, half the content area less half
  // the column gap, out to the window's edge where it bleeds, and above the text on a window up to 40rem, as wide as
  // the content area or, bleeding, the window (hero.css). With no picture in the design, a hero's picture stands at
  // the end (directives.md, hero).
  hero: (r, px) => {
    const half = (whole) => whole / 2 - fluid(r.space.roles['column-gap'], px) / 2;
    if (r.hero.picture === 'behind') return px;
    if (r.hero.picture.endsWith('-bleed')) return px > 40 * 16 ? half(px) : px;
    return px > 40 * 16 ? half(contentArea(r, px)) : contentArea(r, px);
  },
  // A card in a series across the content area, each at least 15rem, the column gap apart (cards.css).
  card: (r, px) => widestOfSeries(contentArea(r, px), 15 * 16, fluid(r.space.roles['column-gap'], px)),
};

// What a `sizes` says at a window `px` wide, read as a browser reads one: the first size whose condition holds.
function sizesAt(sizes, px) {
  const length = (text) => {
    const rem = /^(-?[\d.]+)rem$/.exec(text);
    if (rem) return Number(rem[1]) * 16;
    const vw = /^([\d.]+)vw$/.exec(text);
    if (vw) return Number(vw[1]) * px / 100;
    const both = /^calc\(([\d.]+)vw ([+-]) ([\d.]+)rem\)$/.exec(text);
    if (both) return Number(both[1]) * px / 100 + (both[2] === '-' ? -1 : 1) * Number(both[3]) * 16;
    const less = /^calc\(([\d.]+)rem - ([\d.]+)vw\)$/.exec(text);
    if (less) return Number(less[1]) * 16 - Number(less[2]) * px / 100;
    throw new Error(`not a length a context's sizes holds: ${text}`);
  };
  for (const size of sizes.split(', ')) {
    const condition = /^\(min-width: ([\d.]+)rem\) (.+)$/.exec(size);
    if (!condition) return length(size);
    if (px >= Number(condition[1]) * 16) return length(condition[2]);
  }
  throw new Error(`${sizes} says nothing for a window ${px}px wide`);
}

test('fromDesign\'s contexts give a body\'s image the reading column\'s width, Narrow on a wide window', () => {
  const { body } = imageContexts(design({}));
  assert.equal(body.sizes, '(min-width: 48.6363rem) 45rem, calc(94.2858vw - 0.8572rem)');
  assert.equal(body.ratio, undefined, 'a body\'s image is drawn whole');
});

test('each context\'s sizes is the width the design draws its image at, at every window from a phone to a wide screen', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    const contexts = imageContexts(r);
    for (const [context, drawn] of Object.entries(DRAWN)) {
      for (let px = 320; px <= 3200; px += 0.25) {
        const said = sizesAt(contexts[context].sizes, px);
        const why = `${name}, ${context} at ${px}px: sizes says ${said}, the design draws ${drawn(r, px)}`;
        assert.ok(said > drawn(r, px) - 0.05, why);
        // Where the drawing jumps, as a series changes its columns, the CSS's rounded numbers and the words' exact ones
        // may part by a hair, and there the wider of the two holds.
        const jumps = Math.abs(drawn(r, px - 0.1) - drawn(r, px + 0.1)) > 1;
        if (!jumps) assert.ok(said < drawn(r, px) + 0.05, why);
      }
    }
  }
});

// The presentation tells a reader how wide each context's picture is drawn on a phone and on a wide screen, from the
// same derivation as its sizes, so the two never disagree.
test('the width each context draws its picture at in a window is the width the specs\' words make it', () => {
  const whole = (widths) => Object.fromEntries(Object.entries(widths).map(([context, px]) => [context, Math.round(px)]));
  assert.deepEqual(whole(drawnWidths(design({}), 390)), { body: 354, gallery: 354, lightbox: 390, hero: 390, card: 354 });
  assert.deepEqual(whole(drawnWidths(design({}), 1440)), { body: 720, gallery: 350, lightbox: 1440, hero: 1440, card: 575 });
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    for (let px = 320; px <= 3200; px += 3.25) {
      const widths = drawnWidths(r, px);
      for (const [context, drawn] of Object.entries(DRAWN)) {
        const jumps = Math.abs(drawn(r, px - 0.1) - drawn(r, px + 0.1)) > 1;
        if (!jumps) assert.ok(Math.abs(widths[context] - drawn(r, px)) < 0.05, `${name}, ${context} at ${px}px: ${widths[context]}, the design draws ${drawn(r, px)}`);
      }
    }
  }
});

test('a gallery\'s pictures are drawn in its widest columns, cropped to 4:3, as the design crops them', () => {
  const { gallery } = imageContexts(design({}));
  // One column up to a window of 27.5585rem, then two, from a 32nd of a pixel on, which every engine tells apart, until the column is Narrow, and the gap still grows to 90rem.
  assert.equal(gallery.sizes, '(min-width: 89.9776rem) 21.875rem, (min-width: 48.6363rem) calc(21.9553rem - 0.0893vw), (min-width: 27.5604rem) calc(47.0536vw - 0.9733rem), calc(94.2858vw - 0.8572rem)');
  assert.equal(gallery.ratio, '4:3');
  assert.deepEqual(gallery.widths, [360, 509, 720, 1018]);
});

test('a card\'s, a hero\'s and the lightbox\'s pictures are cropped to no ratio, the lightbox\'s and a hero\'s behind its text across the window', () => {
  const { lightbox, hero: opening, card } = imageContexts(design({}));
  assert.ok(!('ratio' in lightbox) && !('ratio' in opening), 'the core takes no ratio for the lightbox, and none means the image\'s own');
  // A card crops its picture to 16:9, but a person's card to a square and a card with its picture behind to the card's
  // own height, so a crop to any one ratio would be cropped again, and a square lose its sides.
  assert.ok(!('ratio' in card), 'a card\'s picture is cropped by its card alone');
  assert.match(read('../src/components/card.css'), /\.kn-card\[data-kn-variant="person"\] > \.kn-card-picture \{ aspect-ratio: 1; \}/);
  assert.match(read('../src/components/cards.css'), /\.kn-cards\[data-kn-picture="behind"\] \.kn-card > \.kn-card-picture \{[^}]*aspect-ratio: auto; object-fit: cover; \}/);
  assert.equal(lightbox.sizes, '100vw');
  assert.equal(opening.sizes, '100vw');
  // Up to the cap, the master's longest side, which a hero across a wide, dense screen gets and no more.
  assert.deepEqual(lightbox.widths, [360, 509, 720, 1018, 1440, 2036, 2520]);
  assert.deepEqual(opening.widths, lightbox.widths);
  // Two columns of the content area at the most, 575 px on a wide window, so 1150 at density 2.
  assert.deepEqual(card.widths, [360, 509, 720, 1018, 1440]);
  // Beside the text, the picture's widest is above it on a window of 40rem, the content area there, 590 px.
  assert.deepEqual(imageContexts(design(DESIGNS.none)).hero.widths, [360, 509, 720, 1018, 1440]);
});

test('a sizes says its windows by min-width alone, which every engine reads and which holds no angle bracket for a reader of the HTML to stop at', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    for (const [context, { sizes }] of Object.entries(imageContexts(design(inputs)))) assert.doesNotMatch(sizes, /[<>]/, `${name}, ${context}: ${sizes}`);
  }
});

test('a sizes has no stretch of windows narrower than a hundredth of a rem, where two of the design\'s clamps end together', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    for (const [context, { sizes }] of Object.entries(imageContexts(design(inputs)))) {
      const edges = [...sizes.matchAll(/\(min-width: ([\d.]+)rem\)/g)].map((match) => Number(match[1]));
      edges.forEach((edge, i) => assert.ok(i === 0 || edges[i - 1] - edge >= 0.01, `${name}, ${context}: ${sizes}`));
    }
  }
});

test('a body\'s widths are steps of one ladder from Narrow, from a phone at density 1 to the widest drawing at density 2', () => {
  assert.deepEqual(imageContexts(design({})).body.widths, [360, 509, 720, 1018, 1440]);
  assert.deepEqual(imageContexts(design(DESIGNS.other)).body.widths, [396, 560, 792, 1120]);
});

test('the lengths the CSS draws by, not the design file, are the CSS\'s own', () => {
  const gallery = read('../src/konzilo/konzilo.css');
  assert.match(gallery, new RegExp(`\\.konzilo-gallery \\{\\n\\s+--kn-series-minimum: ${GALLERY.minimum}rem;`));
  assert.match(gallery, new RegExp(`\\.konzilo-gallery > figure img \\{[^}]*aspect-ratio: ${GALLERY.ratio.replace(':', ' / ')};[^}]*object-fit: cover;`));
  assert.match(read('../src/components/cards.css'), new RegExp(`:is\\(\\.kn-card-grid\\.kn-cards, \\.kn-timeline, \\.kn-reasons\\) \\{\\n\\s+--kn-series-minimum: ${CARD.minimum}rem;`));
  for (const file of ['../src/konzilo/konzilo.css', '../src/components/cards.css']) {
    assert.ok(read(file).includes(`min(100%, (2 * var(--kn-series-minimum) + var(--kn-series-gap) - 100%) * ${SWITCH})`), file);
  }
  assert.match(read('../src/components/hero.css'), new RegExp(`@media \\(width <= ${HERO_STACKED}rem\\) \\{\\n\\s+\\.kn-hero\\[data-kn-picture\\] > \\.kn-hero-content`));
});

test('every context\'s widths cover it from the narrowest window at density 1 to its widest drawing at density 2, up to the cap, and no two widths of a design are near duplicates', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    const contexts = imageContexts(r);
    const all = [...new Set(Object.values(contexts).flatMap(({ widths }) => widths))].sort((a, b) => a - b);
    all.forEach((one, i) => assert.ok(i === 0 || all[i - 1] < 0.9 * one, `${name}: ${all[i - 1]} and ${one} are within a tenth`));
    assert.equal(all.at(-1), WIDEST, `${name}: the cap is the widest`);
    for (const [context, drawn] of Object.entries(DRAWN)) {
      const { widths } = contexts[context];
      const narrowest = drawn(r, 320);
      let widest = 0;
      for (let px = 320; px <= 3200; px += 1) widest = Math.max(widest, drawn(r, px));
      const growing = drawn(r, 3200) > drawn(r, 3100);
      const most = growing ? WIDEST : Math.min(2 * widest, WIDEST);
      const why = `${name}, ${context}: ${widths} for ${narrowest} at the narrowest and ${most} at the most`;
      assert.ok(widths[0] >= narrowest && all.filter((one) => one < widths[0]).every((one) => one < narrowest), why);
      assert.ok(widths.at(-1) >= most && widths.slice(0, -1).every((one) => one < most), why);
      assert.deepEqual(widths, all.filter((one) => one >= widths[0] && one <= widths.at(-1)), `${name}, ${context}: every step between`);
    }
  }
});

// In the browser: a page of each context as the package draws it, an article's body with a figure and galleries of
// two, three and four pictures, a hero by the design's choices, a series of cards across a section and the core's
// lightbox, with every stylesheet a site has, in each engine that is there.
const BROWSERS = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let components;
before(async () => {
  components = await componentsCss();
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

const flat = (path) => read(path).replace(/@import "(.+?)";/g, (_, file) => readFileSync(new URL(file, new URL(path, import.meta.url)), 'utf8'));
const svg = (width, height) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#8a8"/></svg>`)}`;
// A picture as the core writes it, at its widest version's size, in the button that opens the lightbox.
const shown = (id, width = 2520, height = 1680) => `<button class="konzilo-lightbox-open" type="button"><img id="${id}" alt="" width="${width}" height="${height}" src="${svg(width, height)}"></button>`;
const gallery = (count) => `<figure class="konzilo-gallery">${Array.from({ length: count }, (_, i) => `<figure>${shown(`gallery-${count}-${i}`, 1600, 1200)}</figure>`).join('')}<figcaption>A gallery.</figcaption></figure>`;
const cards = (count) => `<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><div class="kn-card-grid kn-cards" id="cards-${count}">${
  Array.from({ length: count }, () => teaserCard({ href: '/a/', headline: 'A teaser', text: 'Its words.', picture: { src: svg(1600, 900), alt: '', width: 1600, height: 900 } })).join('')}</div></div></div></section>`;

async function page(r) {
  const ctx = pageContext({ design: { resolved: r, project: { name: 'Example' } } });
  const props = heroProps(r.hero, { behind: svg(2520, 1680), side: svg(1600, 1200), alt: 'A bed' });
  // A design with no picture in its hero puts the one a page gives at the end.
  if (r.hero.picture === 'none') Object.assign(props, { picture: svg(1600, 1200), side: 'end', alt: 'A bed' });
  const hero = await render('Hero', { ...props, heading: 'A heading', id: 'hero' });
  const body = articleBody(`<p>Words.</p><figure>${shown('body')}<figcaption>A caption.</figcaption></figure>${gallery(2)}${gallery(3)}${gallery(4)}`, ctx);
  const lightbox = `<dialog class="konzilo-modal konzilo-lightbox" id="lightbox" aria-label="Image"><ul class="konzilo-lightbox-strip" tabindex="0"><li><figure><img id="whole" alt="" width="4000" height="1000" src="${svg(4000, 1000)}"></figure></li></ul></dialog>`;
  const styles = [coreCss(r), flat('../src/konzilo/body-styles.css'), read('../src/konzilo/konzilo.css'), read('fixtures/konzilo-modal.css'), components].join('\n');
  // No classic scrollbar, so the window a sizes reads is the one the page is cut from.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}:root { scrollbar-width: none; }</style></head><body data-kn-surface="page"><main>${hero}${body}${cards(2)}${cards(3)}${lightbox}</main></body></html>`;
}

// The width a sizes says, as the browser reads it: an image of one candidate 1000 px wide, `1000w`, is drawn at its
// density-corrected width, which is the sizes' width, wherever nothing else sizes it. Chromium draws it at a density
// it rounds, 281.25 px for 288, so there it is read as the image's natural width, which is the sizes' to the pixel.
const said = (tab, all, engine) => tab.evaluate(async ([all, engine]) => {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [1000, 1];
  const candidate = `${canvas.toDataURL()} 1000w`;
  const box = document.createElement('div');
  box.style.cssText = 'position: fixed; inset: 0; overflow: hidden; visibility: hidden;';
  document.body.append(box);
  const widths = {};
  for (const [name, sizes] of Object.entries(all)) {
    const probe = new Image();
    probe.style.cssText = 'position: absolute; inset-block-start: 0; inset-inline-start: 0; display: block; inline-size: auto; block-size: auto; max-inline-size: none;';
    probe.sizes = sizes;
    probe.srcset = candidate;
    box.append(probe);
    await probe.decode();
    widths[name] = engine === 'chromium' ? probe.naturalWidth : probe.getBoundingClientRect().width;
  }
  box.remove();
  return widths;
}, [all, engine]);

// The widths the CSS draws each context's picture at.
const drawn = (tab) => tab.evaluate(() => {
  const width = (selector) => document.querySelector(selector).getBoundingClientRect().width;
  const hero = document.querySelector('#hero .kn-hero-media img') ? width('#hero .kn-hero-media img') : width('#hero');
  const lightbox = document.querySelector('#lightbox');
  lightbox.showModal();
  const whole = width('#whole');
  lightbox.close();
  return {
    body: width('#body'), gallery: width('#gallery-2-0'), gallery3: width('#gallery-3-0'), gallery4: width('#gallery-4-0'),
    hero, card: width('#cards-2 .kn-card-picture'), card3: width('#cards-3 .kn-card-picture'), lightbox: whole,
  };
});

for (const name of ['default', 'other', 'small', 'large']) {
  test(`in every engine each context's sizes is the width the CSS draws its picture at, on each side of every breakpoint: ${name}`, { timeout: 300000 }, async () => {
    const r = design(DESIGNS[name]);
    const contexts = imageContexts(r);
    const sizes = Object.fromEntries(Object.entries(contexts).map(([context, { sizes: text }]) => [context, text]));
    const edges = Object.values(sizes).flatMap((text) => [...text.matchAll(/\(min-width: ([\d.]+)rem\)/g)].map((match) => Number(match[1]) * 16));
    const windows = [...new Set([320, 360, 390, 430, 600, 768, 1024, 1280, 1440, 1920, 2560, ...edges.flatMap((edge) => [Math.floor(edge) - 1, Math.floor(edge), Math.ceil(edge) + 1])])].sort((a, b) => a - b);
    const html = await page(r);
    for (const [engine, browser] of browsers) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const tab = await context.newPage();
      await tab.setContent(html);
      for (const px of windows) {
        await tab.setViewportSize({ width: px, height: 900 });
        const [is, says] = [await drawn(tab), await said(tab, sizes, engine)];
        const where = (context) => `${engine}, ${name}, ${context} at ${px}px: drawn ${is[context]}, sizes says ${says[context]}`;
        const near = engine === 'chromium' ? 1 : 0.6;
        for (const context of ['body', 'gallery', 'hero', 'card']) assert.ok(Math.abs(is[context] - says[context]) <= near, where(context));
        // A gallery of three or four, and a series of three, have narrower columns than the widest a sizes says.
        for (const [context, more] of [['gallery', 'gallery3'], ['gallery', 'gallery4'], ['card', 'card3']]) assert.ok(is[more] <= says[context] + near, where(more));
        // The core's lightbox leaves room for its arrows beside the picture on a wide window.
        assert.ok(is.lightbox <= says.lightbox + near && is.lightbox >= says.lightbox - 8 * 16 - near, where('lightbox'));
      }
      await context.close();
    }
  });
}
