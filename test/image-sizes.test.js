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
import { articleBody, looseSection, pageBody, section } from '../src/page-parts/parts.js';
import { renderDirective } from '../src/directives/render/render.js';
import { teaserCard } from '../src/presentations/teasers.js';
import { imageContexts } from '../src/konzilo/index.js';
import {
  ACCORDION, BADGE, CARD, GALLERY, HERO_STACKED, LOGO, LOGOS, OFFER, SECTION, SWITCH, SYMBOL, WIDEST, bandPictureSizes, drawnWidths, noWider,
  pictureSizes, seriesPicture,
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
  // A picture the editor gave a display width says each size no wider, as the core writes it: min(…, 632px).
  const capped = (text) => {
    const most = /^min\((.+), ([\d.]+)px\)$/.exec(text);
    return most ? Math.min(length(most[1]), Number(most[2])) : length(text);
  };
  for (const size of sizesIn(sizes)) {
    const condition = /^\(min-width: ([\d.]+)rem\) (.+)$/.exec(size);
    if (!condition) return capped(size);
    if (px >= Number(condition[1]) * 16) return capped(condition[2]);
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
  // The hero directive writes the band's on its picture behind the text, in place of the body's the core gives it.
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
  assert.ok(cards.includes(`inline-size: calc(${SYMBOL.item} * ${SYMBOL.size} * var(--kn-type-heading-2-size));\n    block-size: calc(${SYMBOL.size} * var(--kn-type-heading-2-size));`));
  assert.ok(cards.includes(`inline-size: ${SYMBOL.size}em;\n    block-size: ${SYMBOL.size}em;`));
  const accordion = read('../src/components/accordion.css');
  assert.ok(accordion.includes(`.kn-accordion-content { padding-block-end: 1em; padding-inline: ${ACCORDION.padding / 2}em; }`));
  assert.ok(accordion.includes(`> .kn-accordion-content { position: relative; padding-inline: ${ACCORDION.questions - ACCORDION.padding / 2}em ${ACCORDION.padding / 2}em; }`));
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

// How wide the package's CSS draws each other picture it draws from a body, from the specs' words, in a window `px`
// wide: { picture, options, drawn }. `ratio` is a picture's width over its height.
function otherPictures(r) {
  const area = (px) => contentArea(r, px);
  const column = (px) => gaps(r, px).column;
  const beside = (px, then) => (sideBySide(px) ? then : area(px));
  // A hero's text beside its picture, and the picture, from a window past 40rem (hero.css).
  const heroHalf = (px, whole) => (px > 40 * 16 ? whole / 2 - column(px) / 2 : whole);
  const side = r.section['picture-side'];
  const pictures = [
    // A section's photo fills its media: beside the text half the content area less half the column gap, corner to
    // corner exactly half of it, or from the middle to the window's edge, and above the text on a narrower window the
    // content area's width or the window's (section.css).
    { picture: 'section-photo', options: { layout: 'cropped' }, drawn: (px) => (side === 'corners' ? beside(px, area(px) / 2) : side === 'corners-bleed' ? (sideBySide(px) ? px / 2 : px) : beside(px, halfOf(r, px))) },
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
    ...['start', 'end', 'start-bleed', 'end-bleed'].map((place) => ({ picture: 'hero', options: { side: place }, drawn: (px) => heroHalf(px, place.endsWith('-bleed') ? px : area(px)) })),
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
      for (let px = 320; px <= 3200; px += 0.5) {
        const said = sizesAt(sizes, px);
        const why = `${name}, ${picture} ${JSON.stringify(options)} at ${px}px: sizes ${sizes} says ${said}, the CSS draws ${drawn(px)}`;
        assert.ok(said > drawn(px) - 0.05, why);
        if (Math.abs(drawn(px - 0.1) - drawn(px + 0.1)) < 1) assert.ok(said < drawn(px) + 0.05, why);
      }
    }
  }
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
      for (const picture of pictures) assert.equal(picture.sizes, seriesPicture(r, count).sizes, `${count} cards ${JSON.stringify(attributes)}`);
      assert.match(pictures[0].srcset, /_360\.webp 360w/, 'the core\'s versions stay');
    }
  }
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

test('a section\'s photo, its badges and a figure in its body say the widths the section draws them at, by its layout', () => {
  const tree = (html) => htmlToHast(html, { fragment: true });
  for (const inputs of [{}, side('corners'), side('corners-bleed')]) {
    const ctx = contextFor(inputs);
    const r = ctx.design.resolved;
    // A photo beside the text, cropped, with a figure after the body's words.
    const cropped = renderDirective('section', {}, tree(`${figure(master('photo'))}<h2>Plans</h2><p>Words.</p><p>More words.</p>${figure(master('after'))}`), ctx);
    assert.equal(imageOf(cropped, 'kn-section-picture').sizes, pictureSizes(r, 'section-photo', { layout: 'cropped' }));
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
    if (beside) assert.equal(imagesIn(html).at(-1).sizes, pictureSizes(r, 'hero', { side: place }), place);
  }
  const ctx = contextFor();
  const html = renderDirective('list', { type: 'logos' }, htmlToHast(`<p>Trusted by</p><ul><li>${master('grower', { width: 900, height: 300 })}</li><li><a href="/a/">${svgMaster('mark')}</a></li></ul>`, { fragment: true }), ctx);
  const [grower, mark] = imagesIn(html);
  assert.equal(grower.sizes, pictureSizes(ctx.design.resolved, 'logo', { ratio: 3 }));
  assert.equal(mark.sizes, undefined);
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
  // Beside the text the picture in its media, behind it the band's own (band.css).
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
const cardsMd = (id, count, colons = 3) => `${':'.repeat(colons)}cards\n\n${Array.from({ length: count }, (_, i) => `### Card ${i}\n\n${pic(`${id}-${i}`, 1600, 900)}\n\nIts words.`).join('\n\n')}\n\n${':'.repeat(colons)}`;
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
// The other pictures, by id: a section's photo cropped, with badges and offered; a figure in a section's body in each
// layout; a hero's logo and its picture beside its text; badges, logos and symbols of several proportions.
const OTHERS_MD = [
  `::::hero\n\n${pic('hero-logo', 1000, 250)}\n\nStart small.\n\n${pic('hero-picture')}\n\n::::`,
  `::::section\n\n${pic('photo-offered')}\n\n## Order\n\n::form{name="contact"}\n\n::::`,
  `::::section\n\n${pic('photo-badged')}\n\n${pic('badge-wide', 1200, 400)}\n\n${pic('badge-narrow', 600, 400)}\n\n## Plans\n\nWords.\n\n${pic('figure-beside')}\n\n::::`,
  `::::section\n\n${pic('photo-cropped')}\n\n## Plans\n\nWords.\n\n${pic('figure-cropped')}\n\n::::`,
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

// The width each picture is drawn at, by its id; a symbol's the picture's own within its box, which shows it whole.
const drawnPictures = (tab, ids) => tab.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const image = document.getElementById(id);
  const { width, height } = image.getBoundingClientRect();
  if (!image.closest('.kn-card-symbol')) return [id, width];
  return [id, Math.min(width, height * image.naturalWidth / image.naturalHeight)];
})), ids);

for (const name of ['default', 'other', 'small', 'large']) {
  test(`in every engine each picture the package draws from a body says the width the CSS draws it at, on each side of every breakpoint: ${name}`, { timeout: 600000 }, async () => {
    const r = design(DESIGNS[name]);
    const { sizes, html } = await picturesPage(r);
    const ids = Object.keys(sizes);
    for (const required of ['hero-logo', 'photo-offered', 'photo-badged', 'photo-cropped', 'badge-wide', 'figure-across', 'figure-narrow', 'figure-form', 'figure-beside', 'logo-wide', 'symbol-item', 'symbol-heading', 's-band-3-0', 's-head-7-0']) assert.ok(ids.includes(required), `${name}: ${required} is drawn with versions`);
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
        // Chromium's reading is a natural width, a whole pixel, and its layout a 64th of one.
        const near = engine === 'chromium' ? 1 + 2 / 64 : 0.6;
        const where = (id, is) => `${engine}, ${name}, ${id} at ${px}px: drawn ${is}, sizes ${sizes[id] ?? ''} says ${told[id]}`;
        for (const id of ids.filter((one) => !one.startsWith('s-'))) assert.ok(Math.abs(drawn[id] - told[id]) <= near, where(id, drawn[id]));
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
