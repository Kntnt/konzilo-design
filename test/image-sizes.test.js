// The widths and sizes in which the design draws an image, by the core's contexts (docs/spec/konzilo.md, Images), as
// fromDesign hands them to the core's konzilo({ images }): each context's `sizes` against the width the design's CSS
// draws its image at, worked out here straight from the specs' words, and in every engine against the browser's own
// layout.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { heroProps } from '../src/components/design-props.js';
import { pageContext } from '../src/directives/render/context.js';
import { articleBody, articleOpening, looseSection, openingPicture, pageBody, section } from '../src/page-parts/parts.js';
import { renderDirective } from '../src/directives/render/render.js';
import { presentationHtml, teaserCard } from '../src/presentations/teasers.js';
import { imageContexts } from '../src/konzilo/index.js';
import {
  ACCORDION, BADGE, CARD, FALLBACK_RATIO, FEATURED, GALLERY, HEADER, HERO_HEIGHTS, HERO_STACKED, LOGO, LOGOS, OFFER, SECTION, SWITCH, SYMBOL, WIDEST,
  bandPictureSizes, drawnWidths, heroPictureOf, noWider, pictureSizes, seriesPicture, teaserPictures,
} from '../src/konzilo/images.js';
import { htmlToHast } from 'satteri';
import { render } from './helpers/render.js';
import { bodyHtml, renderBody } from './helpers/konzilo-body.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

// Designs at the ends of what the tool allows (schema: Narrow 480–960, Wide 800–1800), one where Narrow is wider than
// Wide, a hero's picture in each place the design may put it, and a section's picture on each side.
const hero = (picture) => ({ hero: { ...defaultInputs().hero, picture } });
const side = (picture) => ({ section: { 'picture-side': picture } });
const DESIGNS = {
  default: {},
  other: { layout: { narrow: 560, wide: 1440 }, 'density-profile': 100, ...hero('end'), ...side('alternate') },
  small: { layout: { narrow: 480, wide: 800 }, 'density-profile': 0, ...hero('start-bleed'), ...side('corners-bleed') },
  large: { layout: { narrow: 960, wide: 1800 }, ...hero('end-bleed'), ...side('corners') },
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

// The sizes of a `sizes`, split at the commas outside any parentheses.
function sizesIn(sizes) {
  const all = [''];
  let depth = 0;
  for (const character of sizes) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (character === ',' && depth === 0) all.push('');
    else all[all.length - 1] += character;
  }
  return all.map((one) => one.trim());
}

// A length a `sizes` holds, as a browser reads it in a window `px` wide and `high` tall: rem, vw, vh and px, added and
// taken away in calc(), and the least or the greatest of several in min() and max(), as the core writes a display
// width, min(…, 632px), and a picture cropped to cover a box as tall as a share of the window says max(…, 75vh).
function lengthAt(text, px, high) {
  let at = 0;
  const space = () => { while (text[at] === ' ') at += 1; };
  const term = () => {
    space();
    const call = /^(calc|min|max)\(/.exec(text.slice(at));
    if (call) {
      at += call[0].length;
      const all = [expression()];
      for (space(); text[at] === ','; space()) {
        at += 1;
        all.push(expression());
      }
      assert.equal(text[at], ')', `a parenthesis closes ${call[1]}() in ${text}`);
      at += 1;
      return { calc: all[0], min: Math.min(...all), max: Math.max(...all) }[call[1]];
    }
    const unit = /^(-?[\d.]+)(rem|vw|vh|px)/.exec(text.slice(at));
    if (!unit) throw new Error(`not a length a sizes holds: ${text}`);
    at += unit[0].length;
    return Number(unit[1]) * { rem: 16, vw: px / 100, vh: high / 100, px: 1 }[unit[2]];
  };
  function expression() {
    let value = term();
    for (space(); text[at] === '+' || text[at] === '-'; space()) {
      const sign = text[at] === '-' ? -1 : 1;
      at += 1;
      value += sign * term();
    }
    return value;
  }
  const value = expression();
  assert.equal(at, text.length, `one length in ${text}`);
  return value;
}

// What a `sizes` says at a window `px` wide and `high` tall, read as a browser reads one: the first size whose condition
// holds.
function sizesAt(sizes, px, high = 900) {
  for (const size of sizesIn(sizes)) {
    const condition = /^\(min-width: ([\d.]+)rem\) (.+)$/.exec(size);
    if (!condition) return lengthAt(size, px, high);
    if (px >= Number(condition[1]) * 16) return lengthAt(condition[2], px, high);
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
  assert.match(read('../src/components/cards.css'), /\.kn-cards\[data-kn-picture="behind"\] \.kn-card > \.kn-card-picture \{ aspect-ratio: auto; \}/);
  assert.match(read('../src/components/band.css'), /\.kn-cards\[data-kn-picture="behind"\] \.kn-card > \.kn-card-picture \{ z-index: -2; max-inline-size: none; object-fit: cover; object-position: center; \}/);
  assert.equal(lightbox.sizes, '100vw');
  // The context names no picture's proportions, so it says the box's width, the band's; a band as tall as its text says
  // the same, which is all a sizes can know of it.
  assert.equal(opening.sizes, '100vw');
  assert.equal(bandPictureSizes(), opening.sizes);
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

test('the lengths the CSS draws the pictures from a body by are the CSS\'s own', () => {
  const sectionCss = read('../src/components/section.css');
  assert.match(sectionCss, new RegExp(`@media \\(width >= ${SECTION.beside}rem\\) \\{\\n\\s+/\\* Rule 1: a picture first\\.`));
  assert.match(sectionCss, new RegExp(`@media \\(width >= ${SECTION.wide}rem\\) \\{\\n\\s+/\\* Rule 4: a head and an accordion alone\\.`));
  assert.equal(SECTION.share, 3 / 5);
  assert.equal((sectionCss.match(/grid-template-columns: minmax\(0, 2fr\) minmax\(0, 3fr\);/g) ?? []).length, 3, 'rules 2, 4 and 5');
  assert.ok(sectionCss.includes(`grid-template-columns: repeat(auto-fit, minmax(min(100%, ${SECTION.columns}rem), 1fr));`));
  assert.match(sectionCss, new RegExp(`max-inline-size: min\\(100%, var\\(--kn-section-offer-size, ${OFFER.narrow}rem\\)\\)`));
  assert.ok(sectionCss.includes(`--kn-section-offer-size: ${OFFER.wide}rem;`));
  assert.ok(sectionCss.includes(`.kn-section-badges img { display: block; inline-size: auto; block-size: auto; max-block-size: ${BADGE.height}rem; max-inline-size: ${BADGE.widest}rem;`));
  assert.ok(read('../src/components/hero.css').includes(`.kn-hero-logo { display: block; justify-self: start; inline-size: auto; block-size: auto; max-block-size: ${LOGO.height}rem; max-inline-size: min(100%, ${LOGO.widest}rem);`));
  const logos = read('../src/components/logos.css');
  assert.ok(logos.includes(`--kn-logo-height: ${LOGOS.height};`));
  assert.ok(logos.includes(`max-inline-size: min(${LOGOS.widest} * var(--kn-logo-height), 100%)`));
  const cards = read('../src/components/cards.css');
  assert.ok(cards.includes(`inline-size: calc(${SYMBOL.itemBox} * ${SYMBOL.size} * var(--kn-type-heading-2-size));\n    block-size: calc(${SYMBOL.size} * var(--kn-type-heading-2-size));`));
  assert.ok(cards.includes(`inline-size: ${SYMBOL.size}em;\n    block-size: ${SYMBOL.size}em;`));
  const accordion = read('../src/components/accordion.css');
  assert.ok(accordion.includes(`.kn-accordion-content { padding-block-end: 1em; padding-inline: ${ACCORDION.padding / 2}em; }`));
  assert.ok(accordion.includes(`> .kn-accordion-content { position: relative; padding-inline: ${ACCORDION.questions - ACCORDION.padding / 2}em ${ACCORDION.padding / 2}em; }`));
  // A picture cropped to cover its box: a card's at 16:9, or behind its text at least 20rem high; a section's photo up to
  // a square and 85svh beside the text, and corner to corner as tall as its band, up to 85svh beside text no taller; and
  // a hero's at least its share of the window less the header (card.css, cards.css, section.css, hero.css).
  assert.ok(read('../src/components/card.css').includes('.kn-card-picture { display: block; inline-size: 100%; aspect-ratio: 16 / 9; object-fit: cover;'));
  assert.equal(CARD.box, 9 / 16);
  assert.ok(cards.includes(`justify-content: flex-end;\n    min-block-size: ${CARD.behind}rem;`));
  assert.ok(sectionCss.includes(`min-block-size: min(100%, 100cqi, ${SECTION.most * 100}svh);`));
  assert.ok(sectionCss.includes(`max-block-size: ${SECTION.most * 100}svh;`));
  const heroCss = read('../src/components/hero.css');
  for (const [height, share] of Object.entries(HERO_HEIGHTS)) {
    const written = { 1: '', [1 / 3]: ' / 3', [1 / 2]: ' / 2', [2 / 3]: ' * 2 / 3' }[share];
    assert.ok(heroCss.includes(`.kn-hero[data-kn-height="${height}"] { --kn-hero-height: ${written ? 'calc(' : ''}var(--kn-hero-screen, calc(100svh - var(--kn-header-height)))${written}${written ? ')' : ''}; }`), height);
  }
  // The header's height, which a hero's picture bleeding beside its text reaches over (header.css).
  const header = read('../src/components/header.css');
  assert.ok(header.includes(`--kn-header-height: calc(max(${HEADER.least}rem, var(--kn-header-identity) + ${2 * HEADER.padding}rem) + ${HEADER.hairline}rem);`));
  assert.ok(header.includes(`--kn-header-cap: ${HEADER.cap};`));
  assert.ok(header.includes(`--kn-header-slogan-gap: ${HEADER.gap}rem;`) && header.includes(`calc(var(--kn-header-logo) + ${HEADER.gap}rem + var(--kn-header-name))`));
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

// ---------- The pictures the package draws from a body (issue #38) ----------

// A type size from page.md's words: from its least at a window of 390 px to its most at 1440 px (the design's type
// breakpoints).
const typeSize = ({ min, max }, px) => Math.min(Math.max(min, max), Math.max(Math.min(min, max), min + (max - min) * (px - 390) / 1050));
// A heading's size by the owner's formula: the body size times the base to the power of its step, the base, too, a
// straight line from its least at 390 px to its most at 1440 px.
function scaleSize(r, name, px) {
  const { ratio, 'body-size': body } = r['type-scale'];
  const share = Math.min(1, Math.max(0, (px - 390) / 1050));
  return (body.min + (body.max - body.min) * share) * (ratio.min + (ratio.max - ratio.min) * share) ** r.type[name].step;
}
const gaps = (r, px) => ({ column: fluid(r.space.roles['column-gap'], px), component: fluid(r.space.roles['component-gap'], px) });
const halfOf = (r, px) => (contentArea(r, px) - gaps(r, px).column) / 2;
// A section lays its picture beside its text from a window of 48rem, and its head beside an accordion from 60rem; a
// part of 2fr and 3fr takes three fifths (section.css).
const sideBySide = (px) => px >= 48 * 16;

// An item of a series of `count` items in a row `row` wide, `gap` apart, as cards.css lays it out: its tracks at least
// the greatest of its terms, four, three or two shares of the row a hair under each, or the whole row, each switched
// on by its term times 999 once the row is short of so many items of 15rem; the number of items sets the shares: two
// for two, three for one, three, and 5, 6 or 9 more than a multiple of 12, four and then two for 4 more than a multiple
// of 6, and four and then three for any other (the owner's rule of 2026-11-10).
function seriesItem(row, gap, count) {
  const minimum = 15 * 16;
  const [four, three, two] = [4, 3, 2].map((k) => (row - (k - 1) * gap) * 0.99 / k);
  let [wide, middle] = [four, three];
  if (count % 6 === 4) middle = two;
  if (count === 1 || count === 3 || [5, 6, 9].includes(count % 12)) [wide, middle] = [three, three];
  if (count === 2) [wide, middle] = [two, two];
  const least = Math.max(wide, Math.min(middle, (4 * minimum + 3 * gap - row) * 999), Math.min(two, (3 * minimum + 2 * gap - row) * 999), Math.min(row, (2 * minimum + gap - row) * 999));
  const tracks = Math.max(1, Math.floor((row + gap) / (least + gap)));
  return (row - (tracks - 1) * gap) / tracks;
}

// The places a series of the directives stands in, each its row and its gap in a window `px` wide: across a band's
// content area; in a section's body beside its picture, beside a heading with a form, at Narrow, or in two columns of at
// least 18rem; and in an accordion across a band or beside its head, whose answer stands 0.75em in from each edge, or
// 1.75em from its start where it is of questions, and whose series takes the component gap (konzilo.md, Images).
function seriesPlaces(r, px) {
  const { column, component } = gaps(r, px);
  const area = contentArea(r, px);
  const body = typeSize(r.type.body.size, px);
  const share = sideBySide(px) ? (area - column) * 3 / 5 : area;
  const places = [
    [area, column],
    [sideBySide(px) ? halfOf(r, px) : area, column],
    [share, column],
    [Math.min(area, r.layout.narrow), column],
    [area >= 2 * 18 * 16 + column ? halfOf(r, px) : area, column],
    ...[area, px >= 60 * 16 ? (area - column) * 3 / 5 : area].flatMap((row) => [[row - 1.5 * body, component], [row - 2.5 * body, component]]),
  ];
  // Where the design sets its pictures corner to corner, the text beside a cropped picture stands in half the content
  // area less the column gap (section.css).
  if (r.section['picture-side'].startsWith('corners')) places.push([sideBySide(px) ? area / 2 - column : area, column]);
  return places;
}
const widestItem = (r, px, count) => Math.max(...seriesPlaces(r, px).map(([row, gap]) => seriesItem(row, gap, count)));

test('a series\' picture says the widest an item of so many is drawn in any place a series stands in, at every window', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    for (const count of [1, 2, 3, 4, 5, 6, 7, 9, 10, 12]) {
      const { sizes } = seriesPicture(r, count);
      for (let px = 320; px <= 3200; px += 0.5) {
        const [said, drawn] = [sizesAt(sizes, px), widestItem(r, px, count)];
        const why = `${name}, a series of ${count} at ${px}px: sizes says ${said}, the widest item is ${drawn}`;
        // An answer's 2.5em takes the body size's clamp, whose vw the CSS rounds to four places, two and a half times.
        assert.ok(said > drawn - 0.1, why);
        // Where the widest place changes its columns, the next widest may be a fraction of a pixel narrower, and a
        // width never grows by more than a fifth of a pixel over a fifth of one where it does not jump.
        const jumps = Math.abs(widestItem(r, px - 0.1, count) - widestItem(r, px + 0.1, count)) > 0.3;
        if (!jumps) assert.ok(said < drawn + 0.1, why);
      }
    }
  }
});

test('a series of three or four in a band across a wide window says about as wide as it draws its items, where the card context says two columns', () => {
  const r = design({});
  // 22.9rem and 16.4rem across the band at 90rem (the triage of issue #38); an accordion draws three a little wider, and
  // a section at Narrow draws four in two.
  assert.equal(Math.round(sizesAt(seriesPicture(r, 3).sizes, 1440)), Math.round(widestItem(r, 1440, 3)));
  assert.ok(sizesAt(seriesPicture(r, 3).sizes, 1440) < 24 * 16);
  assert.ok(sizesAt(seriesPicture(r, 4).sizes, 1440) < 21 * 16);
  assert.ok(sizesAt(imageContexts(r).card.sizes, 1440) > 35 * 16);
  // One item takes a column of three, so it says as three do.
  assert.equal(seriesPicture(r, 1).sizes, seriesPicture(r, 3).sizes);
  // Its widths are the ladder's steps that cover it from the narrowest window at density 1 to its widest at density 2.
  const steps = imageContexts(r).lightbox.widths;
  for (const count of [1, 2, 3, 4, 7]) {
    let widest = 0;
    for (let px = 320; px <= 3200; px += 1) widest = Math.max(widest, widestItem(r, px, count));
    const { widths } = seriesPicture(r, count);
    const why = `a series of ${count}: ${widths}, for ${widestItem(r, 320, count)} at the narrowest and ${widest} at the widest`;
    assert.equal(widths[0], steps.find((step) => step >= widestItem(r, 320, count)), why);
    assert.equal(widths.at(-1), steps.find((step) => step >= 2 * widest), why);
    assert.deepEqual(widths, steps.filter((step) => step >= widths[0] && step <= widths.at(-1)), why);
  }
  assert.throws(() => seriesPicture(r, 0), /a series of at least one item/);
});

// The header's height at the most, in px (header.css): the taller of 4rem and its identity with 0.75rem above and below,
// and its 1px hairline, the identity the taller of the logo and a line of the name or the slogan, 0.66 of their size at
// its largest.
const headerMost = (r) => Math.max(64, Math.max(r.header['logo-height'], 0.66 * scaleSize(r, 'heading-5', 1e5), 0.66 * scaleSize(r, 'small', 1e5)) + 24) + 1;

// How wide the package's CSS draws each other picture it draws from a body, from the specs' words, in a window `px`
// wide and `high` tall: { picture, options, drawn }. `ratio` is a picture's width over its height. A picture cropped to
// cover its box is drawn as wide as the box, or as its height times the picture's proportions where that is wider: a
// hero's box at least its share of the window, the header's height not taken off, and the hero's text none; a
// section's photo beside its text up to a square and 85% of the window's height; and one corner to corner as tall as its
// band, up to 85% of the window's height beside text no taller.
function otherPictures(r) {
  const area = (px) => contentArea(r, px);
  const column = (px) => gaps(r, px).column;
  const beside = (px, then) => (sideBySide(px) ? then : area(px));
  // A hero's text beside its picture, and the picture, from a window past 40rem (hero.css).
  const heroHalf = (px, whole) => (px > 40 * 16 ? whole / 2 - column(px) / 2 : whole);
  const side = r.section['picture-side'];
  const band = (px) => fluid(r.space.roles.band, px);
  // A hero's picture beside its text, by the hero's share of the window's height, as tall as its media: past 40rem the
  // hero less its band space, and bleeding the hero and the header; above the text, at least 16:9 of its width, and
  // the hero less its band space and the column gap, or bleeding, less one band space and with the header.
  const heroBeside = (place, share, ratio) => (px, high) => {
    const bleed = place.endsWith('-bleed');
    const whole = bleed ? px : area(px);
    const header = bleed ? headerMost(r) : 0;
    const box = heroHalf(px, whole);
    if (px > 40 * 16) return Math.max(box, ratio * (bleed ? share * high + (1 - share) * header : share * high - 2 * band(px)));
    const above = Math.max(whole * 9 / 16 + header, share * high - (bleed ? band(px) - header : 2 * band(px)) - column(px));
    return Math.max(box, ratio * above);
  };
  const cropped = (ratio) => (px, high) => {
    if (!sideBySide(px)) return side === 'corners-bleed' ? px : area(px);
    if (side === 'corners') return Math.max(area(px) / 2, 0.85 * high * ratio);
    if (side === 'corners-bleed') return Math.max(px / 2, 0.85 * high * ratio);
    return Math.max(halfOf(r, px), ratio * Math.min(halfOf(r, px), 0.85 * high));
  };
  const pictures = [
    // A section's photo fills its media: beside the text half the content area less half the column gap, corner to
    // corner exactly half of it, or from the middle to the window's edge, and above the text on a narrower window the
    // content area's width or the window's (section.css), cropped to cover it beside the text.
    ...[[1.5, 1.5], [0.75, 0.75], [undefined, 16 / 9]].map(([ratio, as]) => ({ picture: 'section-photo', options: { layout: 'cropped', ratio }, drawn: cropped(as) })),
    // A picture behind a band's text covers the band, as wide as the window, and in a hero as tall as its share.
    ...[[undefined, 0, 16 / 9], ['third', 1 / 3, 1.5], ['half', 1 / 2, 3], ['full', 1, 0.75], ['two-thirds', 2 / 3, undefined]].map(([height, share, ratio]) => ({
      picture: 'band', options: { height, ratio }, drawn: (px, high) => Math.max(px, share * high * (ratio ?? 16 / 9)),
    })),
    { picture: 'section-photo', options: { layout: 'badges' }, drawn: (px) => beside(px, halfOf(r, px)) },
    // Beside a form it is shown whole, at most 16rem wide, and 26rem beside the text.
    { picture: 'section-photo', options: { layout: 'offered' }, drawn: (px) => (sideBySide(px) ? Math.min(halfOf(r, px), 26 * 16) : Math.min(area(px), 16 * 16)) },
    // A figure in a section's body takes the body's width: across the content area, beside the picture, beside the
    // picture corner to corner, at Narrow, or in three fifths after a form beside the heading.
    { picture: 'section-body', options: { layout: 'across' }, drawn: area },
    { picture: 'section-body', options: { layout: 'beside' }, drawn: (px) => beside(px, halfOf(r, px)) },
    { picture: 'section-body', options: { layout: 'corners' }, drawn: (px) => beside(px, area(px) / 2 - column(px)) },
    { picture: 'section-body', options: { layout: 'narrow' }, drawn: (px) => Math.min(area(px), r.layout.narrow) },
    { picture: 'section-body', options: { layout: 'form' }, drawn: (px) => beside(px, (area(px) - column(px)) * 3 / 5) },
    ...['start', 'end', 'start-bleed', 'end-bleed'].flatMap((place) => [[undefined, 0, 1.5], ['half', 1 / 2, 1.5], ['full', 1, 16 / 9], ['third', 1 / 3, 3]].map(([height, share, ratio]) => ({
      picture: 'hero', options: { side: place, height, ratio: height === 'full' ? undefined : ratio }, drawn: heroBeside(place, share, ratio),
    }))),
    // A logo is 4rem high, its width by its proportions, at most 16rem and its text's width; a badge 4rem high, at most
    // 8rem wide (hero.css, section.css).
    ...[[0.5, undefined], [3, 'end'], [5, 'start-bleed'], [undefined, undefined]].map(([ratio, place]) => ({
      picture: 'hero-logo', options: { ratio, side: place }, drawn: (px) => Math.min(16 * 16, 4 * 16 * (ratio ?? Infinity), place ? heroHalf(px, area(px)) : area(px)),
    })),
    ...[0.5, 1.5, 3, undefined].map((ratio) => ({ picture: 'badge', options: { ratio }, drawn: () => Math.min(8 * 16, 4 * 16 * (ratio ?? Infinity)) })),
    // A logo in a list of logos is as high as the list's logos, 2.5rem on the narrowest window to 4.5rem at 90rem, and
    // at most four times as wide (logos.css).
    ...[0.5, 2, 6, undefined].map((ratio) => ({ picture: 'logo', options: { ratio }, drawn: (px) => fluid({ min: 40, max: 72 }, px) * Math.min(4, ratio ?? Infinity) })),
    // A card's symbol is shown whole in a box twice as wide as high at 1.25 times the size of a heading 2, or in a square
    // of 1.25em of the card's heading, a heading 5 (cards.css).
    ...[0.5, 1.5, 4, undefined].flatMap((ratio) => [
      { picture: 'symbol', options: { layout: 'item', ratio }, drawn: (px) => 1.25 * scaleSize(r, 'heading-2', px) * Math.min(2, ratio ?? Infinity) },
      { picture: 'symbol', options: { layout: 'heading', ratio }, drawn: (px) => 1.25 * scaleSize(r, 'heading-5', px) * Math.min(1, ratio ?? Infinity) },
    ]),
  ];
  return pictures;
}

test('each other picture the package draws from a body says the width its CSS draws it at, at every window', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    for (const { picture, options, drawn } of otherPictures(r)) {
      const sizes = pictureSizes(r, picture, options);
      // Every half pixel of a window 900 px tall, and every few pixels of a short and a tall one.
      for (const [high, step] of [[900, 0.5], [420, 3.25], [1600, 3.25]]) {
        for (let px = 320; px <= 3200; px += step) {
          const said = sizesAt(sizes, px, high);
          const why = `${name}, ${picture} ${JSON.stringify(options)} at ${px} × ${high}px: sizes ${sizes} says ${said}, the CSS draws ${drawn(px, high)}`;
          // Where the drawing jumps, a sizes holds the side whose box is the wider a 32nd of a pixel past the edge (The
          // edges), which beside a picture cropped to cover a box as tall as a share of the window may be the narrower.
          const [before, after] = [drawn(px - 0.1, high), drawn(px + 0.1, high)];
          const jumps = Math.abs(before - after) >= 1;
          assert.ok(said > (jumps ? Math.min(before, after, drawn(px, high)) : drawn(px, high)) - 0.05, why);
          if (!jumps) assert.ok(said < drawn(px, high) + 0.05, why);
        }
      }
    }
  }
});

test('a picture cropped to cover a box as tall as a share of the window says how wide its proportions make it there, in vh', () => {
  const r = design({});
  // The default design's hero, half the window's height, its picture behind the text: on a phone 390 × 844 a picture of
  // 1920 × 1281 is drawn 632 px wide, 422 px of its height times its proportions, where the band is 390 px wide.
  const sizes = pictureSizes(r, 'band', { height: 'half', ratio: 1920 / 1281 });
  assert.equal(sizes, 'max(100vw, 74.9415vh)');
  assert.equal(Math.round(sizesAt(sizes, 390, 844)), 633);
  assert.equal(sizesAt(sizes, 1440, 900), 1440);
  // Its proportions not known, it is taken as 16:9; a band as tall as its text says the window's width.
  assert.equal(FALLBACK_RATIO, 16 / 9);
  assert.equal(pictureSizes(r, 'band', { height: 'full' }), 'max(100vw, 177.7778vh)');
  assert.equal(pictureSizes(r, 'band', { ratio: 3 }), '100vw');
  assert.equal(bandPictureSizes({ height: 'third', ratio: 1.5 }), pictureSizes(design(DESIGNS.small), 'band', { height: 'third', ratio: 1.5 }), 'whatever the design');
  // A section's photo beside its text crops a portrait to no more than its own width.
  assert.equal(pictureSizes(r, 'section-photo', { layout: 'cropped', ratio: 0.75 }), pictureSizes(r, 'section-photo', { layout: 'badges' }));
  // A picture whose box grows with the window's height is made in every step up to the cap.
  assert.deepEqual(heroPictureOf(r, { ratio: 1.5 }).widths, [360, 509, 720, 1018, 1440, 2036, 2520]);
  assert.deepEqual(heroPictureOf(design(DESIGNS.other), { ratio: 1.5 }), { widths: imageContexts(design(DESIGNS.other)).lightbox.widths, sizes: pictureSizes(design(DESIGNS.other), 'hero', { side: 'end', height: 'half', ratio: 1.5 }) });
});

test('a card\'s picture says as wide as its proportions make its 16:9 crop, and behind its text the card\'s, at least 20rem high', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    for (const count of [1, 2, 3, 4, 7]) {
      for (const [ratio, behind] of [[2.8, false], [1.5, false], [undefined, true], [0.75, true]]) {
        const { sizes } = seriesPicture(r, count, { ratio, behind });
        for (let px = 320; px <= 3200; px += 2.5) {
          const item = widestItem(r, px, count);
          const drawn = behind ? Math.max(item, 20 * 16 * (ratio ?? 16 / 9)) : item * Math.max(1, (ratio ?? 16 / 9) * 9 / 16);
          const jumps = Math.abs(widestItem(r, px - 0.1, count) - widestItem(r, px + 0.1, count)) > 0.3;
          const said = sizesAt(sizes, px);
          const why = `${name}, ${count} cards of ${ratio}${behind ? ' behind' : ''} at ${px}px: says ${said}, drawn ${drawn}`;
          assert.ok(said > drawn - 0.2, why);
          if (!jumps) assert.ok(said < drawn + 0.2, why);
        }
      }
    }
  }
});

// The widest an item of a series of `count` is drawn in any row up to `room` px wide, at either gap, by brute force.
function widestWithin(r, px, room, count) {
  const { column, component } = gaps(r, px);
  let widest = 0;
  for (let row = Math.min(room, 100); row <= room; row += 0.25) for (const gap of [column, component]) widest = Math.max(widest, seriesItem(row, gap, count));
  return widest;
}

test('a series or a figure deeper in a part than the places a series is counted in says at least the widest the room it stands in lets it be drawn', () => {
  const r = design({});
  for (const px of [320, 390, 600, 768, 1024, 1280, 1440, 1920]) {
    const area = contentArea(r, px);
    const body = typeSize(r.type.body.size, px);
    for (const count of [1, 2, 3, 4, 10]) {
      // In a tab, a choice's panel or a fact box, the content area at most; in an answer of an accordion in a tab, 1.5em
      // less; and in a card's words, the widest item of its own series.
      for (const [within, room] of [[['tabs'], area], [['choice', 'aside'], area], [['tabs', 'accordion'], area - 1.5 * body], [[{ series: 2 }], widestItem(r, px, 2)]]) {
        const said = sizesAt(seriesPicture(r, count, { within }).sizes, px);
        const most = widestWithin(r, px, room, count);
        assert.ok(said >= most - 0.5, `${JSON.stringify(within)}, ${count} at ${px}px: says ${said}, drawn up to ${most}`);
        assert.ok(said <= room + 0.5, `${JSON.stringify(within)}, ${count} at ${px}px: says ${said}, wider than its room ${room}`);
      }
    }
    // A figure the part passes through fills the room, at most its own width.
    assert.ok(Math.abs(sizesAt(pictureSizes(r, 'figure', { within: ['accordion'] }), px) - (area - 1.5 * body)) < 0.1, `an answer's figure at ${px}px`);
    assert.ok(Math.abs(sizesAt(pictureSizes(r, 'figure', { within: ['tabs'] }), px) - area) < 0.1, `a tab's figure at ${px}px`);
    assert.ok(Math.abs(sizesAt(pictureSizes(r, 'figure', { within: [{ series: 3 }] }), px) - widestItem(r, px, 3)) < 0.1, `a card's figure at ${px}px`);
    assert.ok(Math.abs(sizesAt(pictureSizes(r, 'figure', { within: ['tabs'], display: 300 }), px) - Math.min(area, 300)) < 0.1, `a tab's figure of 300 px at ${px}px`);
  }
  // A series in an accordion at the top of a section's body is one of the places counted, so it says what it says there.
  assert.equal(seriesPicture(r, 3, { within: ['accordion'] }).sizes, seriesPicture(r, 3).sizes);
});

// The core gives a body's image the body's widths and the lightbox's (its versionsInBody()), so a picture the package
// draws from a body finds a version near its own width wherever it is wider than the body's narrowest version.
test('a body\'s image has a version that covers each picture the package draws from it at its widest on a dense screen, up to the cap', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    const { body, lightbox } = imageContexts(r);
    const srcset = [...new Set([...body.widths, ...lightbox.widths])].sort((a, b) => a - b);
    const all = [...otherPictures(r).map(({ picture, options }) => [`${picture} ${JSON.stringify(options)}`, pictureSizes(r, picture, options)]),
      ...[1, 2, 3, 4, 7].map((count) => [`a series of ${count}`, seriesPicture(r, count).sizes])];
    for (const [what, sizes] of all) {
      let widest = 0;
      for (let px = 320; px <= 3200; px += 1) widest = Math.max(widest, sizesAt(sizes, px));
      assert.ok(srcset.some((step) => step >= Math.min(2 * widest, WIDEST)), `${name}, ${what}: ${widest} px at the widest, versions ${srcset}`);
    }
    // From the body's narrowest version to the cap, every step of the ladder, each √2 wider than the one before.
    assert.equal(srcset.at(-1), WIDEST, name);
    srcset.slice(0, -1).forEach((step, i) => assert.ok(i === 0 || Math.abs(step / srcset[i - 1] - Math.SQRT2) < 0.01, `${name}: ${srcset}`));
  }
});

test('a picture the editor gave a display width says each size no wider where the CSS draws it no wider than its width, and not where it stretches it', () => {
  const r = design({});
  // A badge, a hero's logo, a picture beside a form and a figure in a section's body are drawn at most their own width.
  assert.equal(pictureSizes(r, 'badge', { ratio: 3, display: 100 }), 'min(8rem, 100px)');
  for (const [picture, options] of [['hero-logo', { ratio: 2 }], ['section-photo', { layout: 'offered' }], ['section-body', { layout: 'across' }], ['section-body', { layout: 'narrow' }], ['section-body', { layout: 'beside' }]]) {
    const plain = sizesIn(pictureSizes(r, picture, options));
    const capped = sizesIn(pictureSizes(r, picture, { ...options, display: 200 }));
    assert.deepEqual(capped, plain.map((size) => size.replace(/^(\(min-width: [\d.]+rem\) )?(.+)$/, '$1min($2, 200px)')), picture);
  }
  // A section's photo, a hero's picture beside its text, a logo in a list, a card's symbol and its picture are stretched to
  // their boxes, whatever their width.
  for (const [picture, options] of [['section-photo', { layout: 'cropped' }], ['section-photo', { layout: 'badges' }], ['hero', { side: 'end' }], ['logo', { ratio: 2 }], ['symbol', { layout: 'item', ratio: 1 }]]) {
    assert.equal(pictureSizes(r, picture, { ...options, display: 200 }), pictureSizes(r, picture, options), picture);
  }
  assert.throws(() => pictureSizes(r, 'gallery', {}), /draws no picture gallery from a body/);
});

// A picture as the core writes it into a body: its versions with the body's sizes, at its widest version's size, or at
// the display width the editor gave it, its sizes then no wider; an SVG as it is, with no versions.
const BODY_SIZES = imageContexts(design({})).body.sizes;
const master = (name, { width = 2520, height = 1680, display } = {}) => {
  const [w, h] = display ? [display, Math.round(display * height / width)] : [width, height];
  return `<img src="/_astro/${name}.webp" srcset="/_astro/${name}_360.webp 360w, /_astro/${name}_${width}.webp ${width}w" sizes="${display ? noWider(BODY_SIZES, display) : BODY_SIZES}" alt="" width="${w}" height="${h}" loading="lazy" decoding="async">`;
};
const svgMaster = (name) => `<img src="/_astro/${name}.svg" alt="" width="200" height="50">`;
const figure = (image) => `<figure>${image}</figure>`;
const contextFor = (inputs = {}) => pageContext({ design: { project: { name: 'Example' }, resolved: design(inputs) }, title: 'A page', warn: () => {}, id: (prefix) => `${prefix}-1` });
const imagesIn = (html) => [...html.matchAll(/<img ([^>]*)>/g)].map(([, attributes]) => Object.fromEntries([...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, (value ?? '').replaceAll('&amp;', '&')])));
const imageOf = (html, className) => imagesIn(html).find((image) => (image.class ?? '').split(' ').includes(className));
const cardsOf = (count, pictures = (i) => figure(master(`card-${i}`))) => Array.from({ length: count }, (_, i) => `<h3>Card ${i}</h3>${pictures(i)}<p>Its words.</p>`).join('');

test('a card\'s picture in :::cards says the widest an item of its series is drawn, by the number of cards, in every series layout', () => {
  const ctx = contextFor();
  const r = ctx.design.resolved;
  for (const count of [1, 2, 3, 4, 7]) {
    for (const attributes of [{}, { picture: 'behind' }, { type: 'navigation' }]) {
      const html = renderDirective('cards', attributes, htmlToHast(cardsOf(count), { fragment: true }), ctx);
      const pictures = imagesIn(html).filter((image) => image.class === 'kn-card-picture');
      assert.equal(pictures.length, count);
      // A picture of 3:2 in a crop of 16:9 is drawn as wide as its card; behind the text it covers a card at least 20rem
      // high, as wide as its proportions make that.
      const expected = seriesPicture(r, count, { ratio: 1.5, behind: attributes.picture === 'behind' }).sizes;
      for (const picture of pictures) assert.equal(picture.sizes, expected, `${count} cards ${JSON.stringify(attributes)}`);
      assert.match(pictures[0].srcset, /_360\.webp 360w/, 'the core\'s versions stay');
    }
  }
  assert.equal(seriesPicture(r, 3, { ratio: 1.5 }).sizes, seriesPicture(r, 3).sizes);
  assert.equal(sizesAt(seriesPicture(r, 3, { ratio: 1.5, behind: true }).sizes, 1440), 30 * 16);
  // A panorama is drawn wider than its card's 16:9.
  const wide = renderDirective('cards', {}, htmlToHast(cardsOf(3, (i) => figure(master(`wide-${i}`, { width: 2800, height: 1000 }))), { fragment: true }), ctx);
  assert.equal(imageOf(wide, 'kn-card-picture').sizes, seriesPicture(r, 3, { ratio: 2.8 }).sizes);
  assert.notEqual(seriesPicture(r, 3, { ratio: 2.8 }).sizes, seriesPicture(r, 3).sizes);
  // Every card counts, with a picture or not, as the grid counts its items.
  const some = renderDirective('cards', {}, htmlToHast(cardsOf(4, (i) => (i === 0 ? figure(master('only')) : '')), { fragment: true }), ctx);
  assert.equal(imageOf(some, 'kn-card-picture').sizes, seriesPicture(r, 4).sizes);
  // A symbol is drawn in its box by its proportions; an SVG keeps what the core wrote.
  for (const symbol of ['item', 'heading']) {
    const html = renderDirective('cards', { symbol }, htmlToHast(cardsOf(3, (i) => (i === 0 ? figure(svgMaster('mark')) : figure(master(`mark-${i}`, { width: 1600, height: 800 })))), { fragment: true }), ctx);
    const symbols = imagesIn(html);
    assert.equal(symbols[0].sizes, undefined, 'an SVG has no versions');
    assert.equal(symbols[1].sizes, pictureSizes(r, 'symbol', { layout: symbol, ratio: 2 }), symbol);
  }
});

test('a figure a part passes through, and a series deeper than the places counted, say the widest the parts they stand in let them be drawn', () => {
  const ctx = contextFor();
  const r = ctx.design.resolved;
  const tree = (html) => htmlToHast(html, { fragment: true });
  const nested = (html) => `<div data-directive="cards">${html}</div>`;
  // In an answer, 1.5em narrower than the room the accordion stands in, the content area at most; in a tab, a choice's
  // panel and a fact box, the content area; with a display width, no wider; an SVG as the core wrote it.
  const answer = renderDirective('accordion', {}, tree(`<h3>Which plan?</h3><p>Words.</p>${figure(master('answer'))}${figure(master('small', { display: 300 }))}${figure(svgMaster('seal'))}`), ctx);
  assert.deepEqual(imagesIn(answer).map((image) => image.sizes), [pictureSizes(r, 'figure', { within: ['accordion'] }), pictureSizes(r, 'figure', { within: ['accordion'], display: 300 }), undefined]);
  const tab = renderDirective('tabs', {}, tree(`<h3>One</h3>${figure(master('tab'))}`), ctx);
  assert.equal(imagesIn(tab)[0].sizes, pictureSizes(r, 'figure', { within: ['tabs'] }));
  const fact = renderDirective('aside', {}, tree(`<h3>Note</h3>${figure(master('fact'))}`), ctx);
  assert.equal(imagesIn(fact)[0].sizes, pictureSizes(r, 'figure', { within: ['aside'] }));
  // A card's words stand in an item of its series; a second picture in them is passed through so.
  const card = renderDirective('cards', {}, tree(`<h3>One</h3>${figure(master('lead'))}<p>Words.</p>${figure(master('inner'))}<h3>Two</h3><p>Words.</p>`), ctx);
  assert.deepEqual(imagesIn(card).map((image) => image.sizes), [seriesPicture(r, 2, { ratio: 1.5 }).sizes, pictureSizes(r, 'figure', { within: [{ series: 2 }] })]);
  // A series in an accordion at the top is counted; in a tab, or in an accordion in a tab, it says its room's widest.
  const counted = renderDirective('accordion', {}, tree(`<h3>Plans</h3>${nested(cardsOf(3))}`), ctx);
  assert.equal(imageOf(counted, 'kn-card-picture').sizes, seriesPicture(r, 3, { ratio: 1.5 }).sizes);
  const deep = renderDirective('tabs', {}, tree(`<h3>Plans</h3>${nested(cardsOf(3))}`), ctx);
  assert.equal(imageOf(deep, 'kn-card-picture').sizes, seriesPicture(r, 3, { ratio: 1.5, within: ['tabs'] }).sizes);
  const deeper = renderDirective('tabs', {}, tree(`<h3>Plans</h3><div data-directive="accordion"><h4>Which?</h4>${nested(cardsOf(4))}${figure(master('deep'))}</div>`), ctx);
  assert.equal(imageOf(deeper, 'kn-card-picture').sizes, seriesPicture(r, 4, { ratio: 1.5, within: ['tabs', 'accordion'] }).sizes);
  assert.equal(imagesIn(deeper).at(-1).sizes, pictureSizes(r, 'figure', { within: ['tabs', 'accordion'] }));
  assert.notEqual(seriesPicture(r, 3, { within: ['tabs'] }).sizes, seriesPicture(r, 3).sizes);
  // A figure at the top of a section's body keeps the section's own (withBodySizes()), as before.
  const top = renderDirective('section', {}, tree(`<h2>Plans</h2><p>Words.</p>${figure(master('top'))}`), ctx);
  assert.equal(imagesIn(top)[0].sizes, pictureSizes(r, 'section-body', { layout: 'across' }));
});

test('a section\'s photo, its badges and a figure in its body say the widths the section draws them at, by its layout', () => {
  const tree = (html) => htmlToHast(html, { fragment: true });
  for (const inputs of [{}, side('corners'), side('corners-bleed')]) {
    const ctx = contextFor(inputs);
    const r = ctx.design.resolved;
    // A photo beside the text, cropped, with a figure after the body's words.
    const cropped = renderDirective('section', {}, tree(`${figure(master('photo'))}<h2>Plans</h2><p>Words.</p><p>More words.</p>${figure(master('after'))}`), ctx);
    assert.equal(imageOf(cropped, 'kn-section-picture').sizes, pictureSizes(r, 'section-photo', { layout: 'cropped', ratio: 1.5 }));
    const corners = r.section['picture-side'].startsWith('corners');
    assert.equal(imagesIn(cropped).at(-1).sizes, pictureSizes(r, 'section-body', { layout: corners ? 'corners' : 'beside' }));
    // With badges, which the core gave display widths, the photo is not cropped to the band's corners.
    const badged = renderDirective('section', {}, tree(`${figure(master('photo'))}${figure(master('badge', { width: 1200, height: 400, display: 240 }))}${figure(svgMaster('seal'))}<h2>Plans</h2><p>Words.</p>`), ctx);
    assert.equal(imageOf(badged, 'kn-section-picture').sizes, pictureSizes(r, 'section-photo', { layout: 'badges' }));
    const [, badge, seal] = imagesIn(badged);
    assert.equal(badge.sizes, pictureSizes(r, 'badge', { ratio: 3, display: 240 }));
    assert.equal(seal.sizes, undefined);
    // Beside a form the photo is offered, shown whole.
    const offered = renderDirective('section', {}, tree(`${figure(master('product'))}<h2>Order</h2><div data-directive="form" data-name="contact"></div>`), ctx);
    assert.equal(imageOf(offered, 'kn-section-picture').sizes, pictureSizes(r, 'section-photo', { layout: 'offered' }));
  }
  const ctx = contextFor();
  const r = ctx.design.resolved;
  const bodyFigure = (html, attributes = {}, options = {}) => imagesIn(renderDirective('section', attributes, tree(html), ctx, options)).at(-1).sizes;
  const capped = (layout) => pictureSizes(r, 'section-body', { layout, display: 600 });
  const late = figure(master('late', { display: 600 }));
  assert.equal(bodyFigure(`<h2>Plans</h2><p>Words.</p>${late}`), capped('across'));
  assert.equal(bodyFigure(`<h2>Plans</h2><p>Words.</p>${late}`, { align: 'center' }), capped('narrow'));
  assert.equal(bodyFigure(`<h2>Plans</h2><p>Words.</p><div data-directive="form" data-name="contact"></div>${late}`), capped('narrow'));
  assert.equal(bodyFigure(`<h2>Plans</h2><div data-directive="form" data-name="contact"></div>${late}`), capped('form'));
  // Its body as the core drew it in the section's slot: the figure, and the lightbox's dialog after it, which keeps its own.
  const slot = `<p>Words.</p><figure><button class="konzilo-lightbox-open" type="button">${master('late', { display: 600 })}</button></figure><dialog class="konzilo-modal konzilo-lightbox"><img src="/_astro/late.webp" srcset="/_astro/late_2520.webp 2520w" sizes="100vw" alt=""></dialog>`;
  const fromSlot = renderDirective('section', {}, tree(`<h2>Plans</h2><p>Words.</p>${late}`), ctx, { body: `<h2>Plans</h2>${slot}` });
  assert.deepEqual(imagesIn(fromSlot).map((image) => image.sizes), [capped('across'), '100vw']);
});

test('the page parts\' Section draws its photo, badges and the figures in its body with the sizes a section draws them at', () => {
  const ctx = contextFor();
  const r = ctx.design.resolved;
  const drawn = (html) => `${html}<dialog class="konzilo-modal konzilo-lightbox"><img src="/_astro/x.webp" sizes="100vw" alt=""></dialog>`;
  const body = [figure(master('photo')), figure(master('badge', { width: 800, height: 400 })), '<h2>Plans</h2>', '<p>Words.</p>', figure(master('after'))].map(drawn).join('');
  const html = looseSection(body, ctx);
  assert.deepEqual(imagesIn(html).filter((image) => image.sizes !== '100vw').map((image) => image.sizes), [
    pictureSizes(r, 'section-photo', { layout: 'badges' }), pictureSizes(r, 'badge', { ratio: 2 }), pictureSizes(r, 'section-body', { layout: 'beside' }),
  ]);
  const plain = section({ heading: 'Plans', body: `<p>Words.</p>${drawn(figure(master('after')))}`, align: 'center' }, ctx);
  assert.equal(imagesIn(plain)[0].sizes, pictureSizes(r, 'section-body', { layout: 'narrow' }));
  // A page's body draws its loose blocks so too.
  assert.equal(imagesIn(pageBody(body, ctx, { title: false }))[0].sizes, pictureSizes(r, 'section-photo', { layout: 'badges' }));
  // Without the page's design, as a template that never called designPage() has it, a picture keeps the core's sizes.
  assert.equal(imagesIn(section({ heading: 'Plans', body: drawn(figure(master('after'))) }))[0].sizes, BODY_SIZES);
});

test('a hero\'s picture beside its text and its logo, and a logo in a list of logos, say the widths they are drawn at', () => {
  for (const place of ['start', 'end', 'start-bleed', 'end-bleed', 'behind']) {
    const ctx = contextFor(hero(place));
    const r = ctx.design.resolved;
    const html = renderDirective('hero', {}, htmlToHast(`${figure(master('logo', { width: 1000, height: 250 }))}<p>Start small.</p>${figure(master('beds'))}`, { fragment: true }), ctx);
    const beside = place !== 'behind';
    assert.equal(imageOf(html, 'kn-hero-logo').sizes, pictureSizes(r, 'hero-logo', { ratio: 4, side: beside ? place : undefined }), place);
    // Beside the text or behind it, by the hero's height, the design's or the directive's own, and the picture's
    // proportions, 3:2 here.
    const picture = imagesIn(html).at(-1);
    assert.equal(picture.sizes, beside ? pictureSizes(r, 'hero', { side: place, height: 'half', ratio: 1.5 }) : pictureSizes(r, 'band', { height: 'half', ratio: 1.5 }), place);
    const full = imagesIn(renderDirective('hero', { height: 'full' }, htmlToHast(`<p>Start small.</p>${figure(master('beds'))}`, { fragment: true }), ctx)).at(-1);
    assert.equal(full.sizes, beside ? pictureSizes(r, 'hero', { side: place, height: 'full', ratio: 1.5 }) : 'max(100vw, 150vh)', place);
  }
  const ctx = contextFor();
  const html = renderDirective('list', { type: 'logos' }, htmlToHast(`<p>Trusted by</p><ul><li>${master('grower', { width: 900, height: 300 })}</li><li><a href="/a/">${svgMaster('mark')}</a></li></ul>`, { fragment: true }), ctx);
  const [grower, mark] = imagesIn(html);
  assert.equal(grower.sizes, pictureSizes(ctx.design.resolved, 'logo', { ratio: 3 }));
  assert.equal(mark.sizes, undefined);
});

// ---------- A post list's teasers and an article's opening (issue #39) ----------

// `featured` lays out by its list's own width, wherever the list stands (post-list.css): one column under 32rem; from
// 32rem two, the latest across both; from 50rem three, the latest over two; the column gap apart.
function featuredItem(row, gap, first) {
  if (row >= 50 * 16) return first ? 2 * (row - 2 * gap) / 3 + gap : (row - 2 * gap) / 3;
  if (row >= 32 * 16) return first ? row : (row - gap) / 2;
  return row;
}
// The places a post list stands in, each its row in a window `px` wide: only directly in a section, which the checks
// hold it to, since a part drawn from its tree cannot draw one (directives.md, What only the core can draw), so a
// series' places but an accordion's: across a band's content area, as a page's loose blocks and a term's page put it
// too; in a section's body beside its picture, corner to corner where the design sets pictures so, after a form beside
// the heading, at Narrow, as an article's reading column is, and in two columns of at least 18rem.
function listPlaces(r, px) {
  const area = contentArea(r, px);
  const { column } = gaps(r, px);
  const rows = [area, sideBySide(px) ? halfOf(r, px) : area, sideBySide(px) ? (area - column) * 3 / 5 : area, Math.min(area, r.layout.narrow), area >= 2 * 18 * 16 + column ? halfOf(r, px) : area];
  if (r.section['picture-side'].startsWith('corners')) rows.push(sideBySide(px) ? area / 2 - column : area);
  return rows;
}
// The widest a teaser of each kind is drawn in any place a post list stands in, in a window `px` wide: one of a series
// of `count`, as cards and filtered draw them; the latest post of `featured` and another; and a lone teaser of `cards`,
// which fills its column beside a quotation (section.css, body="columns"), where an item of a series of one takes a
// third of its row.
const widestTeaser = (r, px, count) => Math.max(...listPlaces(r, px).map((row) => seriesItem(row, gaps(r, px).column, count)));
const TEASERS = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 7].map((count) => [`filtered-${count}`, (r, px) => widestTeaser(r, px, count)])),
  'featured-first': (r, px) => Math.max(...listPlaces(r, px).map((row) => featuredItem(row, gaps(r, px).column, true))),
  'featured-other': (r, px) => Math.max(...listPlaces(r, px).map((row) => featuredItem(row, gaps(r, px).column, false))),
  'cards-1': (r, px) => Math.max(widestTeaser(r, px, 1), contentArea(r, px) >= 2 * 18 * 16 + gaps(r, px).column ? halfOf(r, px) : contentArea(r, px)),
};
const teaserOfKind = (r, kind) => {
  const [presentation, which] = kind.split('-');
  if (presentation === 'featured') return teaserPictures(r, presentation, 3)[which === 'first' ? 0 : 1];
  return teaserPictures(r, presentation, Number(which))[0];
};

test('a teaser\'s picture says the widest it is drawn in any place a post list stands in, at every window, by its presentation and number of posts', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    const steps = imageContexts(r).lightbox.widths;
    for (const [kind, widest] of Object.entries(TEASERS)) {
      const { sizes, widths } = teaserOfKind(r, kind);
      let most = 0;
      for (let px = 320; px <= 3200; px += 0.5) {
        const [said, drawn] = [sizesAt(sizes, px), widest(r, px)];
        most = Math.max(most, drawn);
        const why = `${name}, ${kind} at ${px}px: sizes says ${said}, the widest teaser is ${drawn}`;
        assert.ok(said > drawn - 0.1, why);
        const jumps = Math.abs(widest(r, px - 0.1) - widest(r, px + 0.1)) > 0.3;
        if (!jumps) assert.ok(said < drawn + 0.1, why);
      }
      // The ladder's steps that cover it from the narrowest window at density 1 to its widest at density 2.
      const why = `${name}, ${kind}: ${widths}, for ${widest(r, 320)} at the narrowest and ${most} at the widest`;
      assert.equal(widths[0], steps.find((step) => step >= widest(r, 320)), why);
      assert.equal(widths.at(-1), steps.find((step) => step >= Math.min(2 * most, WIDEST)), why);
      assert.deepEqual(widths, steps.filter((step) => step >= widths[0] && step <= widths.at(-1)), why);
    }
  }
});

test('the lengths the CSS draws a post list\'s teasers by are the CSS\'s own', () => {
  const postList = read('../src/components/post-list.css');
  assert.ok(postList.includes(`@container (width >= ${FEATURED.two}rem) {\n    .kn-featured { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n    .kn-featured > .kn-card:first-child { grid-column: 1 / -1; }`));
  assert.ok(postList.includes(`@container (width >= ${FEATURED.three}rem) {\n    .kn-featured { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n    .kn-featured > .kn-card:first-child { grid-column: span 2;`));
  assert.ok(postList.includes('.kn-featured { display: grid; gap: var(--kn-space-column-gap);'));
  // A lone teaser of `cards` fills its column beside a quotation.
  assert.ok(read('../src/components/section.css').includes('.kn-section[data-kn-body="columns"] > .kn-band-content > .kn-section-body > .kn-post-list[data-kn-presentation="cards"] > .kn-cards:has(> :only-child) {\n    grid-template-columns: minmax(0, 1fr);'));
});

// Astro's getImage() as a presentation hands it, here a version of each width asked for, of a master 1600 × 1000.
const getImage = async ({ src, widths }) => ({
  src: `/_astro/${src.name}.webp`,
  srcSet: { attribute: widths.map((width) => `/_astro/${src.name}_${width}.webp ${width}w`).join(', ') },
  attributes: { width: 1600, height: 1000 },
});
const postsOf = (count) => Array.from({ length: count }, (_, i) => ({ entry: { id: `post-${i}`, collection: 'articles', data: { title: `Post ${i}`, image: { src: { name: `post-${i}` }, alt: '' } } }, url: `/post-${i}/` }));
const widthsIn = (srcset) => srcset.split(', ').map((candidate) => Number(candidate.split(' ')[1].slice(0, -1)));

test('each teaser\'s picture in a presentation is made in the ladder\'s widths with the sizes of where the design draws it, by the number of posts', async () => {
  for (const name of ['default', 'other', 'small']) {
    const ctx = contextFor(DESIGNS[name]);
    const r = ctx.design.resolved;
    const ladder = imageContexts(r).lightbox.widths;
    for (const presentation of ['cards', 'featured', 'filtered']) {
      for (const count of [1, 2, 3, 4, 7]) {
        const html = await presentationHtml(presentation, { posts: postsOf(count), options: {} }, ctx, { getImage });
        const pictures = imagesIn(html).filter((image) => image.class === 'kn-card-picture');
        const expected = teaserPictures(r, presentation, count);
        const where = `${name}, ${presentation} of ${count}`;
        assert.equal(pictures.length, count, where);
        pictures.forEach((picture, at) => {
          assert.equal(picture.sizes, expected[at].sizes, `${where}, teaser ${at}`);
          assert.deepEqual(widthsIn(picture.srcset), expected[at].widths, `${where}, teaser ${at}`);
          assert.ok(expected[at].widths.every((width) => ladder.includes(width)), `${where}: ${expected[at].widths} on the ladder ${ladder}`);
        });
        // A series' own, by its number of items, in the places a post list stands in, but for a lone teaser of `cards`,
        // which may fill its column.
        if (presentation !== 'featured' && !(presentation === 'cards' && count === 1)) assert.deepEqual(expected[0], seriesPicture(r, count, { list: true }), where);
      }
    }
  }
  // On a wide window the default design draws the latest post of `featured` wider than the others, and a lone teaser of
  // `cards` beside a quotation wider than an item of a series of one.
  const r = design({});
  const [first, other] = teaserPictures(r, 'featured', 3);
  assert.ok(sizesAt(first.sizes, 1440) > 1.5 * sizesAt(other.sizes, 1440));
  assert.ok(sizesAt(teaserPictures(r, 'cards', 1)[0].sizes, 1440) > 1.5 * sizesAt(seriesPicture(r, 1).sizes, 1440));
  // With no accordion to stand in, a list of three across a band on a 90rem window says what it draws, 22.92rem, where
  // a series of three cards says 23.57rem.
  assert.equal(sizesAt(teaserPictures(r, 'cards', 3)[0].sizes, 1440), 22.9167 * 16);
  assert.ok(sizesAt(seriesPicture(r, 3).sizes, 1440) > 23.5 * 16);
  assert.deepEqual(teaserPictures(r, 'filtered', 0), []);
  assert.throws(() => teaserPictures(r, 'rows', 2), /no post-list presentation rows/);
  // A teaser's picture is cropped to 16:9 of its card, so a panorama, whose proportions its master gives, says as wide as
  // they make that, and one of unknown proportions, or narrower, its card's width.
  const ctx = contextFor();
  const posts = postsOf(3).map((post, at) => (at === 1 ? { ...post, entry: { ...post.entry, data: { ...post.entry.data, image: { src: { name: 'wide', width: 2800, height: 1000 }, alt: '' } } } } : post));
  const sizes = imagesIn(await presentationHtml('cards', { posts, options: {} }, ctx, { getImage })).map((image) => image.sizes);
  assert.deepEqual(sizes, [teaserPictures(r, 'cards', 3)[0].sizes, teaserPictures(r, 'cards', 3, [undefined, 2.8])[1].sizes, teaserPictures(r, 'cards', 3)[0].sizes]);
  assert.ok(sizesAt(sizes[1], 1440) > 1.5 * sizesAt(sizes[0], 1440));
  assert.deepEqual(teaserPictures(r, 'featured', 2, [1.5, 4 / 3]), teaserPictures(r, 'featured', 2));
});

test('an article\'s opening makes its main image in the widths and sizes of a hero\'s picture, by the design\'s hero height and the picture\'s proportions', async () => {
  // The master's proportions, 3:2, as Astro's image import gives them.
  const image = { src: { name: 'soil', width: 2400, height: 1600 }, alt: 'A spade in soil' };
  for (const place of ['behind', 'start', 'end', 'start-bleed', 'end-bleed', 'none']) {
    const ctx = contextFor(hero(place));
    const r = ctx.design.resolved;
    const expected = heroPictureOf(r, { ratio: 1.5 });
    const picture = await openingPicture(image, ctx, getImage);
    assert.equal(picture.sizes, expected.sizes, place);
    assert.equal(picture.sizes, place === 'behind' ? pictureSizes(r, 'band', { height: 'half', ratio: 1.5 }) : pictureSizes(r, 'hero', { side: place === 'none' ? 'end' : place, height: 'half', ratio: 1.5 }), place);
    // Its box grows with the window's height, so it is made in every step up to the cap.
    assert.deepEqual(widthsIn(picture.srcset), expected.widths, place);
    assert.equal(expected.widths.at(-1), WIDEST, place);
    const html = articleOpening(ctx, { data: { headline: 'Know your soil' }, picture });
    const drawn = imagesIn(html).at(-1);
    assert.equal(drawn.class, place === 'behind' ? 'kn-band-picture' : undefined, place);
    assert.deepEqual([drawn.sizes, drawn.srcset], [expected.sizes, picture.srcset], place);
  }
  // Behind the text it covers the band, the window's width, or as wide as half the window's height makes it, and a
  // picture of unknown proportions is taken as 16:9.
  const behind = await openingPicture({ src: { name: 'soil' }, alt: '' }, contextFor(hero('behind')), getImage);
  assert.equal(behind.sizes, 'max(100vw, 88.8889vh)');
  // A picture of its own address, as a site's public folder holds it, is written as given.
  assert.deepEqual(await openingPicture({ src: '/public/soil.webp', alt: '' }, contextFor(), getImage), { src: '/public/soil.webp', alt: '' });
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

// The widths the CSS draws each context's picture at. A hero's, the box it covers, beside the text its media and behind
// it the band, since the context names no picture's proportions, by which the picture is drawn wider where the box is
// taller than they are (konzilo.md, Images; the pictures the package draws itself say that, below).
const drawn = (tab) => tab.evaluate(() => {
  const width = (selector) => document.querySelector(selector).getBoundingClientRect().width;
  const hero = width(document.querySelector('#hero .kn-hero-media img') ? '#hero .kn-hero-media img' : '#hero > .kn-band-picture');
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

// ---------- In the browser: the pictures the package draws from a body (issue #38) ----------

// A picture of `width` × `height` pixels, all of one colour, as a PNG, to stand for a version of `width` px: a browser
// draws it at its sizes' width wherever the CSS sizes it by its own, as the density its descriptor gives says.
const PNGS = new Map();
function png(width, height) {
  const key = `${width}x${height}`;
  if (PNGS.has(key)) return PNGS.get(key);
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([length, Buffer.from(type), data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([0x88, 0xaa, 0x88]))]);
  const data = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
  const url = `data:image/png;base64,${data.toString('base64')}`;
  PNGS.set(key, url);
  return url;
}

// A body as Markdown, as an editor writes it, each picture `![](../media/<id>-<width>x<height>.webp)`, which the core
// writes with versions, a single one here, and the body's sizes, at its widest version's size.
const pic = (id, width = 2520, height = 1680) => `![](../media/${id}-${width}x${height}.webp)`;
// The version is 720 px wide, which every picture's proportions here divide, so it has them exactly.
const withVersions = (html) => html.replace(/<img src="\/_astro\/([\w-]+)-(\d+)x(\d+)\.webp" alt(?:="[^"]*")?>/g, (_, id, width, height) => {
  const version = png(720, 720 * Number(height) / Number(width));
  return `<img id="${id}" src="${version}" srcset="${version} 720w" sizes="${BODY_SIZES}" alt="" width="${width}" height="${height}" loading="eager" decoding="async">`;
});
const cardsMd = (id, count, colons = 3, { attributes = '', width = 1600, height = 900 } = {}) => `${':'.repeat(colons)}cards${attributes}\n\n${Array.from({ length: count }, (_, i) => `### Card ${i}\n\n${pic(`${id}-${i}`, width, height)}\n\nIts words.`).join('\n\n')}\n\n${':'.repeat(colons)}`;
const COUNTS = [2, 3, 4, 7];
// Each place a series stands in, as a body holds it, for a series of `count`: its first card's picture is `s-<place>-<count>-0`.
const SERIES_PLACES = {
  band: (count) => `::::section\n\n## Plans\n\n${cardsMd(`s-band-${count}`, count)}\n\n::::`,
  beside: (count) => `::::section\n\n${pic(`p-beside-${count}`)}\n\n${pic(`b-beside-${count}`, 800, 400)}\n\n## Plans\n\n${cardsMd(`s-beside-${count}`, count)}\n\n::::`,
  cropped: (count) => `::::section\n\n${pic(`p-cropped-${count}`)}\n\n## Plans\n\n${cardsMd(`s-cropped-${count}`, count)}\n\n::::`,
  form: (count) => `::::section\n\n## Order\n\n::form{name="contact"}\n\n${cardsMd(`s-form-${count}`, count)}\n\n::::`,
  narrow: (count) => `::::section{align="center"}\n\n## Plans\n\n${cardsMd(`s-narrow-${count}`, count)}\n\n::::`,
  columns: (count) => `::::section{body="columns"}\n\n## Plans\n\n${cardsMd(`s-columns-${count}`, count)}\n\n> A quotation.\n\n::::`,
  accordion: (count) => `:::::section\n\n::::accordion{first="open"}\n\n### Plans\n\n${cardsMd(`s-accordion-${count}`, count)}\n\n::::\n\n:::::`,
  questions: (count) => `:::::section\n\n::::accordion{first="open"}\n\n### Which plan?\n\n${cardsMd(`s-questions-${count}`, count)}\n\n::::\n\n:::::`,
  head: (count) => `:::::section\n\n## Plans\n\n::::accordion{first="open"}\n\n### Plans\n\n${cardsMd(`s-head-${count}`, count)}\n\n::::\n\n:::::`,
  headQuestions: (count) => `:::::section\n\n## Plans\n\n::::accordion{first="open"}\n\n### Which plan?\n\n${cardsMd(`s-headQuestions-${count}`, count)}\n\n::::\n\n:::::`,
};
// The other pictures, by id: a section's photo cropped, beside short words and beside words taller than it may grow,
// with badges and offered; a figure in a section's body in each layout; a hero's logo and its picture beside or behind
// its text, where the design puts it; badges, logos and symbols of several proportions; a series of cards with its
// pictures behind their text, one of navigation and one of panoramas, each across a band; and the pictures a part passes
// through and a series in a tab, deeper than the places a series is counted in.
const TALL = Array.from({ length: 40 }, (_, i) => `Words, line ${i}.`).join('\n\n');
const OTHERS_MD = [
  `::::hero\n\n${pic('hero-logo', 1000, 250)}\n\nStart small.\n\n${pic('hero-picture')}\n\n::::`,
  `::::section\n\n${pic('photo-offered')}\n\n## Order\n\n::form{name="contact"}\n\n::::`,
  `::::section\n\n${pic('photo-badged')}\n\n${pic('badge-wide', 1200, 400)}\n\n${pic('badge-narrow', 600, 400)}\n\n## Plans\n\nWords.\n\n${pic('figure-beside')}\n\n::::`,
  `::::section\n\n${pic('photo-cropped')}\n\n## Plans\n\nWords.\n\n${pic('figure-cropped')}\n\n::::`,
  `::::section\n\n${pic('photo-tall')}\n\n## Plans\n\n${TALL}\n\n::::`,
  `::::section\n\n${pic('photo-short')}\n\n## Plans\n\nWords.\n\n::::`,
  `::::section\n\n## Plans\n\n${cardsMd('behind-3', 3, 3, { attributes: '{picture="behind"}' })}\n\n::::`,
  `::::section\n\n## Plans\n\n${cardsMd('nav-3', 3, 3, { attributes: '{type="navigation"}' })}\n\n::::`,
  `::::section\n\n## Plans\n\n${cardsMd('wide-3', 3, 3, { width: 2880, height: 1080 })}\n\n::::`,
  `:::::section\n\n::::accordion{first="open"}\n\n### Plans\n\nWords.\n\n${pic('f-answer')}\n\n::::\n\n:::::`,
  `:::::section\n\n::::tabs\n\n### Plans\n\n${pic('f-tab')}\n\n### Prices\n\nWords.\n\n::::\n\n:::::`,
  `::::::section\n\n:::::tabs\n\n### Plans\n\n::::accordion{first="open"}\n\n#### Plans\n\n${pic('f-deep')}\n\n::::\n\n### Prices\n\n${cardsMd('d-tab-3', 3, 4)}\n\n:::::\n\n::::::`,
  `::::section\n\n:::cards\n\n### One\n\n${pic('f-lead', 1600, 900)}\n\nWords.\n\n${pic('f-card')}\n\n### Two\n\nWords.\n\n:::\n\n::::`,
  `::::section\n\n## Plans\n\nWords.\n\nMore words.\n\n${pic('figure-across')}\n\n::::`,
  `::::section{align="center"}\n\n## Plans\n\nWords.\n\nMore words.\n\n${pic('figure-narrow')}\n\n::::`,
  `::::section\n\n## Order\n\n::form{name="contact"}\n\n${pic('figure-form')}\n\n::::`,
  `::::section\n\n:::list{type="logos"}\n\nTrusted by\n\n- ${pic('logo-wide', 900, 300)}\n- ${pic('logo-long', 1800, 200)}\n- ${pic('logo-tall', 300, 600)}\n\n:::\n\n::::`,
  `::::section\n\n:::cards{symbol="item"}\n\n### One\n\n${pic('symbol-item', 1600, 800)}\n\nWords.\n\n### Two\n\n${pic('symbol-tall', 400, 800)}\n\nWords.\n\n:::\n\n:::cards{symbol="heading"}\n\n### One\n\n${pic('symbol-heading', 1600, 800)}\n\nWords.\n\n:::\n\n::::`,
].join('\n\n');

async function picturesPage(r) {
  const ctx = pageContext({ design: { resolved: r, project: { name: 'Example' } }, title: 'A page', warn: () => {} });
  const markdown = [OTHERS_MD, ...COUNTS.flatMap((count) => Object.values(SERIES_PLACES).map((place) => place(count)))].join('\n\n');
  const html = renderBody(withVersions(bodyHtml(markdown)), ctx);
  const styles = [coreCss(r), flat('../src/konzilo/body-styles.css'), read('../src/konzilo/konzilo.css'), components].join('\n');
  // What each picture's sizes says, by its id; and the page with every one of them so wide that the CSS alone draws
  // each picture, one it draws at its own width at the most the CSS lets it be.
  // The lightbox's dialog after a figure holds the picture again, which keeps the body's sizes, and stands after it.
  const sizes = {};
  for (const image of imagesIn(html)) if (image.id && image.srcset && !(image.id in sizes)) sizes[image.id] = image.sizes;
  const page = html.replace(/ sizes="[^"]*"/g, ' sizes="10000px"');
  return { sizes, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}:root { scrollbar-width: none; }</style></head><body data-kn-surface="page"><main class="kn-page-main">${page}</main></body></html>` };
}

// The width each picture is drawn at, by its id: the picture's own within its box, where the box is not as wide as its
// proportions make it at its height, as wider where the CSS crops it to cover its box, and narrower where it shows it
// whole within it, as a symbol's.
const drawnPictures = (tab, ids, boxes = []) => tab.evaluate(([ids, boxes]) => Object.fromEntries(ids.map((id) => {
  const image = document.getElementById(id);
  const { width, height } = image.getBoundingClientRect();
  // Its proportions, its width and height as written, which its version has, loaded or, lazy, not yet.
  const own = height * Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
  const fit = boxes.includes(id) ? 'fill' : getComputedStyle(image).objectFit;
  return [id, fit === 'cover' ? Math.max(width, own) : fit === 'contain' ? Math.min(width, own) : width];
})), [ids, boxes]);

// The pictures whose sizes says no less than they are drawn, but more on this page (konzilo.md, Images): by a part of
// their box's height the sizes cannot know, a hero's picture beside its text above it on a phone, or bleeding, the
// header's height, and a section's photo beside words shorter than it may grow; and by the places they may stand in,
// a series' picture across a band, which says the widest of a series' places, a picture in a card's words, as wide as
// the widest item of its series anywhere, and a series in a tab, as wide as its widest item in any row the tab leaves
// room for.
function atLeast(r, id, px) {
  if (id === 'hero-picture') return r.hero.picture !== 'behind' && (r.hero.picture.endsWith('-bleed') || px <= 40 * 16);
  if (['photo-cropped', 'photo-short', 'f-card', 'f-lead'].includes(id)) return true;
  return ['p-cropped-', 'behind-3-', 'nav-3-', 'wide-3-', 'd-tab-'].some((prefix) => id.startsWith(prefix));
}

for (const name of ['default', 'other', 'small', 'large', 'inverted']) {
  test(`in every engine each picture the package draws from a body says the width the CSS draws it at, on each side of every breakpoint: ${name}`, { timeout: 900000 }, async () => {
    const r = design(DESIGNS[name]);
    const { sizes, html } = await picturesPage(r);
    const ids = Object.keys(sizes);
    for (const required of ['hero-logo', 'hero-picture', 'photo-offered', 'photo-badged', 'photo-cropped', 'photo-tall', 'photo-short', 'badge-wide', 'figure-across', 'figure-narrow', 'figure-form', 'figure-beside', 'logo-wide', 'symbol-item', 'symbol-heading', 's-band-3-0', 's-head-7-0', 'behind-3-0', 'nav-3-0', 'wide-3-0', 'f-answer', 'f-tab', 'f-deep', 'f-card', 'd-tab-3-0']) assert.ok(ids.includes(required), `${name}: ${required} is drawn with versions`);
    // Corner to corner, a photo beside words taller than 85% of the window, as beside the tall words, a figure or a
    // series, is drawn wider than its sizes says, which the sizes leaves out, since it cannot know the words' height
    // (konzilo.md, Images); beside short words it is drawn no wider.
    const corners = r.section['picture-side'].startsWith('corners');
    const checked = ids.filter((id) => !(corners && (['photo-tall', 'photo-cropped'].includes(id) || id.startsWith('p-cropped-'))));
    const panorama = (2880 / 1080) * 9 / 16;
    // One sizes for every series of a number, wherever it stands.
    for (const count of COUNTS) assert.equal(new Set(Object.keys(SERIES_PLACES).map((place) => sizes[`s-${place}-${count}-0`])).size, 1, `${name}: a series of ${count}`);
    const distinct = Object.fromEntries([...new Set(Object.values(sizes))].map((text, i) => [i, text]));
    const edges = Object.values(distinct).flatMap((text) => [...text.matchAll(/\(min-width: ([\d.]+)rem\)/g)].map((match) => Number(match[1]) * 16));
    // A pixel either side of every edge; on the edge of 48rem itself, where the section sets its picture beside its text,
    // the sizes says the wider stacked width for a 32nd of a pixel, as every narrowing does (konzilo.md, The edges).
    const windows = [...new Set([320, 390, 600, 1024, 1440, 1920, 2560, ...edges.flatMap((edge) => [Math.floor(edge) - 1, Math.ceil(edge) + 1])])].filter((px) => px >= 320 && px <= 3200).sort((a, b) => a - b);
    for (const [engine, browser] of browsers) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const tab = await context.newPage();
      await tab.setContent(html);
      for (const px of windows) {
        await tab.setViewportSize({ width: px, height: 900 });
        const read = await said(tab, distinct, engine);
        const told = Object.fromEntries(ids.map((id) => [id, read[Object.keys(distinct).find((key) => distinct[key] === sizes[id])]]));
        const drawn = await drawnPictures(tab, ids);
        // Chromium's reading is a natural width, a whole pixel, and its layout a 64th of one, which a picture cropped to
        // cover its box takes times its proportions, up to three times here.
        const near = engine === 'chromium' ? 1 + 6 / 64 : 0.6;
        const where = (id, is) => `${engine}, ${name}, ${id} at ${px}px: drawn ${is}, sizes ${sizes[id] ?? ''} says ${told[id]}`;
        for (const id of checked.filter((one) => !one.startsWith('s-'))) {
          if (atLeast(r, id, px)) assert.ok(told[id] >= drawn[id] - near, where(id, drawn[id]));
          else assert.ok(Math.abs(drawn[id] - told[id]) <= near, where(id, drawn[id]));
        }
        // A series of navigation is laid out as any series, and a panorama's crop as wide as its proportions make it; a
        // card with its picture of 16:9 behind its text, and words shorter than it, is 20rem high.
        assert.ok(Math.abs(drawn['nav-3-0'] - drawn['s-band-3-0']) <= near, where('nav-3-0', drawn['nav-3-0']));
        assert.ok(Math.abs(drawn['behind-3-0'] - Math.max(drawn['s-band-3-0'], 20 * 16 * 16 / 9)) <= near, where('behind-3-0', drawn['behind-3-0']));
        assert.ok(Math.abs(told['wide-3-0'] - panorama * told['s-band-3-0']) <= 2 * near, where('wide-3-0', drawn['wide-3-0']));
        // A series' item says the widest it is drawn in any place, and is drawn no wider in each.
        for (const count of COUNTS) {
          const first = Object.keys(SERIES_PLACES).map((place) => `s-${place}-${count}-0`);
          const widest = Math.max(...first.map((id) => drawn[id]));
          assert.ok(Math.abs(widest - told[first[0]]) <= near, `${engine}, ${name}, a series of ${count} at ${px}px: says ${told[first[0]]}, drawn ${first.map((id) => `${id.split('-')[1]} ${drawn[id]}`).join(', ')}`);
        }
      }
      await context.close();
    }
  });
}

// ---------- In the browser: a post list's teasers and an article's opening (issue #39) ----------

// A post list by its presentation and number of posts, as an editor places it, in each place a post list stands in: a
// band's section; beside a section's photo, with badges and cropped; after a form beside the heading; centred, at
// Narrow; and in two columns beside a quotation. `featured` and `filtered` stand there too, though the checks refuse
// them beside a quotation, since a list's sizes counts that place whatever its presentation.
const LISTS = [['cards', 1], ['cards', 2], ['cards', 3], ['cards', 4], ['cards', 7], ['filtered', 1], ['filtered', 4], ['featured', 3]];
const listMd = ([presentation, count]) => `::post-list{type="article" number="${count}" presentation="${presentation}"}`;
const LIST_PLACES = {
  band: (list) => `::::section\n\n## Plans\n\n${listMd(list)}\n\n::::`,
  beside: (list, id) => `::::section\n\n${pic(`p-${id}`)}\n\n${pic(`b-${id}`, 800, 400)}\n\n## Plans\n\n${listMd(list)}\n\n::::`,
  cropped: (list, id) => `::::section\n\n${pic(`p-${id}`)}\n\n## Plans\n\n${listMd(list)}\n\n::::`,
  form: (list) => `::::section\n\n## Order\n\n::form{name="contact"}\n\n${listMd(list)}\n\n::::`,
  narrow: (list) => `::::section{align="center"}\n\n## Plans\n\n${listMd(list)}\n\n::::`,
  columns: (list) => `::::section{body="columns"}\n\n## Plans\n\n${listMd(list)}\n\n> A quotation.\n\n::::`,
};
// Astro's getImage() for a teaser, here one version 720 px wide of a master 1600 × 900, which a card crops to 16:9.
const teaserImage = async ({ widths }) => {
  assert.ok(widths.length > 0);
  return { src: png(720, 405), srcSet: { attribute: `${png(720, 405)} 720w` }, attributes: { width: 1600, height: 900 } };
};
const openingImage = async () => ({ src: png(720, 480), srcSet: { attribute: `${png(720, 480)} 720w` }, attributes: { width: 1620, height: 1080 } });
const teaserPosts = (count) => Array.from({ length: count }, (_, i) => ({ entry: { id: `post-${i}`, collection: 'articles', data: { title: `Post ${i}`, excerpt: 'Its words.', image: { src: { name: `post-${i}` }, alt: '' } } }, url: `/post-${i}/` }));

async function teasersPage(r) {
  const ctx = pageContext({ design: { resolved: r, project: { name: 'Example' } }, title: 'A page', warn: () => {} });
  // The lists in the order they stand, each its teasers' pictures `t-<presentation>-<count>-<place>-<n>`.
  const placed = Object.entries(LIST_PLACES).flatMap(([place, markdown]) => LISTS.map((list) => ({ list, id: `${list.join('-')}-${place}`, markdown: markdown(list, `${list.join('-')}-${place}`) })));
  let body = renderBody(withVersions(bodyHtml(placed.map(({ markdown }) => markdown).join('\n\n'))), ctx);
  for (const { list: [presentation, count], id } of placed) {
    let n = 0;
    const html = (await presentationHtml(presentation, { posts: teaserPosts(count), options: {} }, ctx, { getImage: teaserImage }))
      .replace(/<img class="kn-card-picture"/g, () => `<img id="t-${id}-${n++}" class="kn-card-picture"`);
    body = body.replace(/<div class="test-post-list"[^>]*><\/div>/, () => html);
  }
  assert.doesNotMatch(body, /test-post-list/);
  // An article's opening, its main image where the design puts a hero's picture, its master of 3:2.
  const picture = await openingPicture({ src: { name: 'soil', width: 1620, height: 1080 }, alt: '' }, ctx, openingImage);
  const html = articleOpening(ctx, { data: { headline: 'Know your soil', standfirst: 'All about soil.' }, picture: { ...picture, id: 'opening' } }) + body;
  const sizes = {};
  for (const image of imagesIn(html)) if (image.id && image.srcset && !(image.id in sizes)) sizes[image.id] = image.sizes;
  const styles = [coreCss(r), flat('../src/konzilo/body-styles.css'), read('../src/konzilo/konzilo.css'), components].join('\n');
  // Every sizes so wide that the CSS alone draws each picture.
  const page = html.replace(/ sizes="[^"]*"/g, ' sizes="10000px"');
  return { sizes, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}:root { scrollbar-width: none; }</style></head><body data-kn-surface="page"><main class="kn-page-main">${page}</main></body></html>` };
}

for (const name of ['default', 'other', 'small', 'large']) {
  test(`in every engine a teaser's sizes in each presentation, and an article opening's, is the widest the CSS draws it, on each side of every breakpoint: ${name}`, { timeout: 600000 }, async () => {
    const r = design(DESIGNS[name]);
    const { sizes, html } = await teasersPage(r);
    const ids = Object.keys(sizes);
    // Each teaser's picture by its kind, the first of a series and the latest and the next of `featured`, in each place.
    const kinds = {};
    for (const [presentation, count] of LISTS) {
      const of = (n) => Object.keys(LIST_PLACES).map((place) => `t-${presentation}-${count}-${place}-${n}`);
      if (presentation === 'featured') Object.assign(kinds, { 'featured-first': of(0), 'featured-other': of(1) });
      else kinds[`${presentation}-${count}`] = of(0);
    }
    for (const [kind, all] of Object.entries(kinds)) {
      for (const id of all) assert.ok(ids.includes(id), `${name}: ${id} is drawn with versions`);
      assert.equal(new Set(all.map((id) => sizes[id])).size, 1, `${name}: one sizes for ${kind}, wherever it stands`);
    }
    assert.ok(ids.includes('opening'), `${name}: the opening's picture`);
    const distinct = Object.fromEntries([...new Set(Object.values(sizes))].map((text, i) => [i, text]));
    const edges = Object.values(distinct).flatMap((text) => [...text.matchAll(/\(min-width: ([\d.]+)rem\)/g)].map((match) => Number(match[1]) * 16));
    // A pixel either side of every edge (konzilo.md, The edges).
    const windows = [...new Set([320, 390, 600, 1024, 1440, 1920, 2560, ...edges.flatMap((edge) => [Math.floor(edge) - 1, Math.ceil(edge) + 1])])].filter((px) => px >= 320 && px <= 3200).sort((a, b) => a - b);
    for (const [engine, browser] of browsers) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const tab = await context.newPage();
      await tab.setContent(html);
      for (const px of windows) {
        await tab.setViewportSize({ width: px, height: 900 });
        const read = await said(tab, distinct, engine);
        const told = (id) => read[Object.keys(distinct).find((key) => distinct[key] === sizes[id])];
        // The latest post of `featured` grows to the height of the two beside it from a list of 50rem, by their words,
        // which a sizes cannot know, so it says its 16:9 crop's width, its box's (konzilo.md, Images).
        const drawn = await drawnPictures(tab, ids, kinds['featured-first']);
        // Chromium's reading is a natural width, a whole pixel, and its layout a 64th of one, which a picture cropped to
        // cover its box takes times its proportions, up to three times here.
        const near = engine === 'chromium' ? 1 + 6 / 64 : 0.6;
        const opening = `${engine}, ${name}, the opening at ${px}px: drawn ${drawn.opening}, sizes ${sizes.opening} says ${told('opening')}`;
        if (atLeast(r, 'hero-picture', px)) assert.ok(told('opening') >= drawn.opening - near, opening);
        else assert.ok(Math.abs(drawn.opening - told('opening')) <= near, opening);
        // A teaser says the widest it is drawn in any place, and is drawn no wider in each.
        for (const [kind, all] of Object.entries(kinds)) {
          const widest = Math.max(...all.map((id) => drawn[id]));
          assert.ok(Math.abs(widest - told(all[0])) <= near, `${engine}, ${name}, ${kind} at ${px}px: says ${told(all[0])}, drawn ${all.map((id) => `${id.split('-').at(-2)} ${drawn[id]}`).join(', ')}`);
        }
      }
      await context.close();
    }
  });
}
