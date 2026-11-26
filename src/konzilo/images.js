// The widths and sizes in which the design draws an image, by the contexts the Konzilo core names, as its
// konzilo({ images }) takes them (docs/spec/konzilo.md, Images; the core's ADR 0022): each context's `sizes` the width
// its CSS draws the image at, worked out from the same values the CSS uses, and its widths steps of one ladder.
//
// Each width here is a function of the window's width `v`, in rem, which between its bends is a straight line: the
// side margin and the gaps are clamps of the window, and the rest is sums, halves and least values of those and the
// design's own lengths. So a `sizes` can say it exactly, one straight line per stretch of windows.
import { contentAreaLine, fluidLine } from '../generator/layout.js';
import { number, stepStart } from '../generator/fluid.js';

// The narrowest window the design is made for, where its fluid scales start, in rem. Below it the narrowest stretch of
// a `sizes` goes on as it is, which says a little more than the design draws, since a clamp only stops a margin or a
// gap from shrinking further.
const NARROWEST = 20;

// A width as a function of the window, `at(v)`, and the windows where it may bend or jump, sorted.
const width = (at, bends = []) => ({ at, bends: [...new Set(bends)].filter(Number.isFinite).sort((a, b) => a - b) });
const fixed = (length) => width(() => length);
const WINDOW = width((v) => v);
const fluid = (css) => {
  const line = fluidLine(css);
  return width(line.at, line.limits);
};
const sum = (...parts) => width((v) => parts.reduce((total, part) => total + part.at(v), 0), parts.flatMap((part) => part.bends));
const times = (part, factor) => width((v) => factor * part.at(v), part.bends);

// The windows, past the narrowest, where `one` and `other` cross. Each is straight between its bends, where it may also
// jump, as a series does where it changes its columns, so the two are compared just inside each stretch.
const INSIDE = 1e-7;
function crossings(one, other) {
  const xs = [...new Set([NARROWEST, ...one.bends, ...other.bends].filter((x) => x >= NARROWEST))].sort((a, b) => a - b);
  xs.push(xs.at(-1) + 1000);
  const found = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const [a, b] = [xs[i] + INSIDE, xs[i + 1] - INSIDE];
    const [da, db] = [one.at(a) - other.at(a), one.at(b) - other.at(b)];
    if (da * db < 0) found.push(a + da * (b - a) / (da - db));
  }
  return found;
}
const least = (one, other) => width((v) => Math.min(one.at(v), other.at(v)), [...one.bends, ...other.bends, ...crossings(one, other)]);
const greatest = (...parts) => parts.reduce((one, other) => width((v) => Math.max(one.at(v), other.at(v)), [...one.bends, ...other.bends, ...crossings(one, other)]));
// `then` where `test` is at least `limit`, or past it where `strict`, and `otherwise` short of it.
function switched(test, limit, then, otherwise, { strict = false } = {}) {
  const holds = (v) => (strict ? test.at(v) > limit.at(v) : test.at(v) >= limit.at(v));
  return width((v) => (holds(v) ? then : otherwise).at(v), [...test.bends, ...limit.bends, ...then.bends, ...otherwise.bends, ...crossings(test, limit)]);
}
// The columns a series of `count` items takes (cards.css, the owner's rule of 2026-11-10): at most two for two; three
// for one, three, and 5, 6 or 9 more than a multiple of 12; and four for any other, which falls to two where it is 4
// more than a multiple of 6 and to three otherwise. Every series falls to two and then one as its row narrows.
function columnsOf(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`a series of at least one item, not ${count}`);
  if (count === 2) return { most: 2, three: false };
  if (count === 1 || count === 3 || [5, 6, 9].includes(count % 12)) return { most: 3, three: true };
  return { most: 4, three: count % 6 !== 4 };
}

// An item of a series of `count` items in a row `row` wide, `gap` apart, each column at least `minimum`. The CSS
// switches to k columns by a term times SWITCH, `(k × minimum + (k − 1) × gap − row) × 999`, which falls under a k-th of
// the row a hair before the row holds k columns: k columns where (km + (k − 1)g − row) × 999 ≤ (row − (k − 1)g) / k, so
// from row ≥ km × 999k / (999k + 1) + (k − 1)g, two from 2m × 1998/1999 + g. Where four fall to two, three stand for a
// sliver of a pixel between, narrower than two, which the series' width leaves out, since it says the wider.
function seriesItem(row, gap, count, minimum = CARD.minimum) {
  const { most, three } = columnsOf(count);
  const share = (k) => times(sum(row, times(gap, -(k - 1))), 1 / k);
  const from = (k) => sum(fixed(k * minimum * (k * SWITCH) / (k * SWITCH + 1)), times(gap, k - 1));
  let drawn = switched(row, from(2), share(2), row);
  if (three) drawn = switched(row, from(3), share(3), drawn);
  if (most === 4) drawn = switched(row, from(4), share(4), drawn);
  return drawn;
}
// The widest a series' item is drawn in a row `row` wide: two columns where two of at least `minimum` fit, `gap` apart,
// and else one, whatever the number of items, since a lone item takes a third.
const widestOfSeries = (row, minimum, gap) => seriesItem(row, gap, 2, minimum);

// The straight stretches of a width, `drawn`, from the narrowest window on, each { from, slope, intercept }, `from` in
// rem.
function stretches(drawn) {
  const starts = [NARROWEST, ...drawn.bends.filter((x) => x > NARROWEST)];
  const found = [];
  starts.forEach((from, i) => {
    const to = starts[i + 1] ?? from + 2;
    // Where two clamps end within a hundredth of a rem of each other, the stretch between them is a sliver the one
    // before it covers to within a ten-thousandth of a pixel. One where a width jumps wider, as where two places a
    // series stands in change their columns together, it does not cover, and it stays.
    const middle = (from + to) / 2;
    if (i > 0 && starts[i + 1] !== undefined && to - from < 0.01 && drawn.at(middle) <= stretchAt(found.at(-1), middle) + 1e-4) return;
    const [p, q] = [from + (to - from) / 3, from + 2 * (to - from) / 3];
    const slope = (drawn.at(q) - drawn.at(p)) / (q - p);
    const stretch = { from, slope, intercept: drawn.at(p) - slope * p };
    // A bend of a part that leaves the whole straight, such as the content area reaching Wide under Narrow, is none.
    const last = found.at(-1);
    if (last && Math.abs(last.slope - slope) < 1e-7 && Math.abs(last.intercept - stretch.intercept) < 5e-4) return;
    found.push(stretch);
  });
  return found;
}

// A stretch's width as a length a `sizes` holds: rem, vw, or both in calc().
function lengthOf({ slope, intercept }) {
  const [vw, rem] = [number(slope * 100), number(Math.abs(intercept))];
  if (vw === '0') return `${number(intercept)}rem`;
  if (rem === '0') return `${vw}vw`;
  if (slope < 0) return `calc(${number(intercept)}rem - ${number(-slope * 100)}vw)`;
  return `calc(${vw}vw ${intercept < 0 ? '-' : '+'} ${rem}rem)`;
}

// A stretch's width at a window `v` rem wide.
const stretchAt = ({ slope, intercept }, v) => slope * v + intercept;
const floor = (x) => Math.floor(x * 1e4) / 1e4;

// A width, `drawn`, as a `sizes`, its widest windows first, each stretch from its window on by `min-width`, which every
// engine reads in a `sizes`, where a range such as `(width >= 40rem)` Safari has read only since 16.4, and whose text
// holds no angle bracket for a reader of the HTML to stop at. A stretch that goes on from the one before starts at its
// edge; one that starts wider or narrower than it, as a series' second column or a hero's picture beside its text past
// the window it stands above it on, starts APART on the side where the wider of the two holds, so a `sizes` never says
// less than is drawn.
function sizesOf(drawn) {
  const found = stretches(drawn);
  return found.map((stretch, i) => {
    if (i === 0) return lengthOf(stretch);
    const [after, before] = [stretchAt(stretch, stretch.from), stretchAt(found[i - 1], stretch.from)];
    const edge = floor(stretch.from) + (Math.abs(after - before) < 1e-6 ? 0 : after > before ? -APART : APART);
    return `(min-width: ${number(edge)}rem) ${lengthOf(stretch)}`;
  }).reverse().join(', ');
}
// Chromium and WebKit tell a media query's length apart from a window's to about a 64th of a pixel, so the next window
// they all tell from an edge is a 32nd of a pixel past it, in rem.
const APART = 0.002;

// What the design's CSS draws by lengths of its own, not of the design file: a gallery's least column, and the aspect
// ratio it crops its pictures to (konzilo.css).
export const GALLERY = Object.freeze({ minimum: 12, ratio: '4:3' });
// A series of cards' least column (cards.css). A card's picture has no one ratio: 16:9, a person's square, and behind
// the text as tall as the card (card.css, cards.css), so the card crops it, and the core does not.
export const CARD = Object.freeze({ minimum: 15 });
// The factor by which a series' CSS turns a length into a switch (cards.css, konzilo.css).
export const SWITCH = 999;
// The widest window, in rem, on which a hero's picture beside its text stands above it instead (hero.css).
export const HERO_STACKED = 40;

// The widest version the core makes of any image, its master's longest side (the core's WIDEST, ADR 0022).
export const WIDEST = 2520;
// Two widths within a tenth of each other are near duplicates, which a browser choosing between them gains nothing
// from (the core's ADR 0022).
const NEAR = 0.9;

// The design's ladder of widths: steps a factor of √2 apart, two to each doubling, from Narrow, the reading column at
// its widest, so a body's image on a wide screen is made at exactly its width at density 1 and 2; and the cap.
function ladder(anchor) {
  const steps = [WIDEST];
  for (let k = -12; k < 12; k++) {
    const step = Math.round(anchor * 2 ** (k / 2));
    if (step >= 1 && step < WIDEST * NEAR) steps.push(step);
  }
  return [...new Set(steps)].sort((a, b) => a - b);
}

// The widths of a context whose picture is `drawn` wide: from the step that covers it at the narrowest window at
// density 1 to the step that covers it at its widest at density 2, or the cap.
function widthsOf(drawn, steps) {
  const runs = stretches(drawn);
  // In px, to a thousandth, so that arithmetic's last digit does not take a step past the one a width meets.
  const px = (rem) => Math.round(rem * 16 * 1000) / 1000;
  const narrowest = px(stretchAt(runs[0], NARROWEST));
  const ends = runs.flatMap((run, i) => [stretchAt(run, run.from), stretchAt(run, runs[i + 1]?.from ?? run.from)]);
  const widest = runs.at(-1).slope > 1e-9 ? Infinity : px(Math.max(...ends));
  const first = steps.find((step) => step >= narrowest) ?? WIDEST;
  const last = steps.find((step) => step >= Math.min(2 * widest, WIDEST)) ?? WIDEST;
  return steps.filter((step) => step >= first && step <= last);
}

// A picture behind a band's text covers the band, which is as wide as the window (band.css).
const BAND = WINDOW;

// A hero's picture where the design puts it (hero.css): behind the text it covers the band, the window's width; beside
// it, half the content area less half the column gap, or from the middle to the window's edge where it bleeds; and on a
// window up to 40rem above the text, the content area's width or, bleeding, the window's. A design with no picture in
// its hero puts one a page gives at the end (directives.md, hero).
function heroPicture(place = 'behind', contentArea, columnGap) {
  if (place === 'behind') return BAND;
  const whole = place.endsWith('-bleed') ? WINDOW : contentArea;
  const beside = sum(times(whole, 1 / 2), times(columnGap, -1 / 2));
  return switched(WINDOW, fixed(HERO_STACKED), beside, whole, { strict: true });
}

// The design's measures a picture is drawn by, each a function of the window.
function measures(r) {
  // The content area, min(window − 2 × side margin, Wide), as the layout works it out for the Reading Area too.
  const area = contentAreaLine(r.layout);
  return {
    contentArea: width(area.at, area.bends),
    narrow: fixed(r.layout.narrow / 16),
    columnGap: fluid(r.space.roles['column-gap'].css),
    componentGap: fluid(r.space.roles['component-gap'].css),
    body: fluid(r.type.body.size.css),
  };
}

// How wide the design draws a picture in each context, as a function of the window.
function drawings(r) {
  const { contentArea, narrow, columnGap, componentGap } = measures(r);
  const column = least(contentArea, narrow);
  return {
    // A body's figure, in the reading column: Narrow, or the content area where that is narrower (page.md).
    body: column,
    // A gallery in that column, at its widest column.
    gallery: widestOfSeries(column, GALLERY.minimum, componentGap),
    // The core's lightbox, which fits each picture whole in the window, so at most the window's width.
    lightbox: WINDOW,
    hero: heroPicture(r.hero?.picture, contentArea, columnGap),
    // A card in a series across the content area, at its widest column.
    card: widestOfSeries(contentArea, CARD.minimum, columnGap),
  };
}

/**
 * The widths, sizes and aspect ratio in which a resolved design draws an image, by the core's contexts.
 * @param {object} r A design file's `resolved`.
 * @returns {Record<'body' | 'gallery' | 'lightbox' | 'hero' | 'card', { widths: number[], sizes: string, ratio?: string }>}
 */
export function imageContexts(r) {
  const steps = ladder(Math.min(r.layout.narrow, r.layout.wide));
  const contexts = Object.fromEntries(Object.entries(drawings(r)).map(([name, drawn]) => [name, { widths: widthsOf(drawn, steps), sizes: sizesOf(drawn) }]));
  // A gallery's pictures are cropped to its ratio.
  contexts.gallery.ratio = GALLERY.ratio;
  return contexts;
}

/**
 * How wide a resolved design draws a picture in each of the core's contexts in a window `px` wide, in px at the default
 * text size, a gallery's and a card's at the widest column of a series; what the presentation tells a reader.
 * @param {object} r A design file's `resolved`.
 * @param {number} px The window's width.
 * @returns {Record<'body' | 'gallery' | 'lightbox' | 'hero' | 'card', number>}
 */
export function drawnWidths(r, px) {
  return Object.fromEntries(Object.entries(drawings(r)).map(([name, drawn]) => [name, drawn.at(px / 16) * 16]));
}

/**
 * The `sizes` of a picture behind a band's text, the band's width, whatever the design: what the hero directive writes
 * on its picture behind in place of the body's `sizes` the core gives every image in a body (konzilo.md, Images).
 * @returns {string}
 */
export const bandPictureSizes = () => sizesOf(BAND);

// ---------- The pictures the package draws from a body (issue #38; konzilo.md, Images) ----------

// What the package's CSS draws these pictures by that the design file does not hold, each held to its stylesheet by a
// test. A section sets its picture beside its text from a window of `beside` rem, and its head beside an accordion from
// `wide` rem, in parts of 2fr and 3fr, `share` the second (section.css); a body in columns takes two of at least
// `columns` rem (section.css); an accordion's answer stands `padding` em from its edges together, `questions` where it
// is of questions (accordion.css).
export const SECTION = Object.freeze({ beside: 48, wide: 60, share: 3 / 5, columns: 18 });
export const ACCORDION = Object.freeze({ padding: 1.5, questions: 2.5 });

// The places a series of the directives stands in, each its row and its gap: across a band's content area, the place
// the criteria hold exactly; in a section's body beside its picture, beside a heading with a form right after it, at
// Narrow, as a centred section's or one with a form or a choice, and as an article's reading column is, and in two
// columns; and in an accordion across a band or beside its head, whose series takes the component gap. A renderer does
// not know which it stands in, so a series' picture says the widest it is drawn in any of them. A post list stands only
// directly in a section, which the checks hold it to, since a part drawn from its tree cannot draw one (directives.md,
// What only the core can draw), so never in an accordion (`list`).
function seriesPlaces(r, { list = false } = {}) {
  const { contentArea: area, narrow, columnGap: gap, componentGap, body } = measures(r);
  const from = (window, then) => switched(WINDOW, fixed(window), then, area);
  const share = times(sum(area, times(gap, -1)), SECTION.share);
  const accordion = (row) => [ACCORDION.padding, ACCORDION.questions].map((padding) => [sum(row, times(body, -padding)), componentGap]);
  const places = [
    [area, gap],
    [from(SECTION.beside, halfOf(area, gap)), gap],
    [from(SECTION.beside, share), gap],
    [least(area, narrow), gap],
    [inColumns(area, gap), gap],
    ...(list ? [] : [...accordion(area), ...accordion(from(SECTION.wide, share))]),
  ];
  // Corner to corner, the text beside a picture the section crops stands in half the content area less the column gap.
  if (cornerToCorner(r)) places.push([from(SECTION.beside, sum(times(area, 1 / 2), times(gap, -1))), gap]);
  return places;
}
const cornerToCorner = (r) => String(r.section?.['picture-side'] ?? '').startsWith('corners');
// Half the content area less half the column gap; and a column of a section's body in two, each at least 18rem where
// two fit, and else the whole content area (section.css, body="columns").
const halfOf = (area, gap) => times(sum(area, times(gap, -1)), 1 / 2);
const inColumns = (area, gap) => switched(area, sum(fixed(2 * SECTION.columns), gap), halfOf(area, gap), area);

// The ladder of a design's widths.
const ladderOf = (r) => ladder(Math.min(r.layout.narrow, r.layout.wide));
// A picture drawn `drawn` wide, as its widths on the ladder and its sizes.
const drawnPicture = (r, drawn) => ({ widths: widthsOf(drawn, ladderOf(r)), sizes: sizesOf(drawn) });
// The widest an item of a series of `count` items is drawn in any place a series, or a post list, stands in.
const seriesDrawn = (r, count, options) => greatest(...seriesPlaces(r, options).map(([row, gap]) => seriesItem(row, gap, count)));

/**
 * The widths and sizes of a picture that fills an item of a series of `count` items, as a card's picture in `:::cards`,
 * or a post list's teaser: the widest its item is drawn in any place a series stands in, at each window, and the
 * ladder's steps that cover it from the narrowest window at density 1 to its widest at density 2 (konzilo.md, Images).
 * @param {object} r A design file's `resolved`.
 * @param {number} count The number of items the series draws, at least one.
 * @param {{ list?: boolean }} [options] `list`: a post list's, in the places a post list stands in, which leave out an
 *   accordion's.
 * @returns {{ widths: number[], sizes: string }}
 */
export const seriesPicture = (r, count, options) => drawnPicture(r, seriesDrawn(r, count, options));

// ---------- A post list's teasers (issue #39; konzilo.md, Images) ----------

// `featured` lays out by its list's own width, by container queries (post-list.css): one column under `two` rem; from
// it two, the latest across both; from `three` rem three, the latest over two; the column gap apart wherever it stands.
export const FEATURED = Object.freeze({ two: 32, three: 50 });
function featuredItem(row, gap, first) {
  const share = (k) => times(sum(row, times(gap, -(k - 1))), 1 / k);
  const two = first ? row : share(2);
  const three = first ? sum(times(share(3), 2), gap) : share(3);
  return switched(row, fixed(FEATURED.three), three, switched(row, fixed(FEATURED.two), two, row));
}

/**
 * The widths and sizes of each teaser's picture in a post list of `count` posts as the package's presentation draws it,
 * the widest it is drawn in any place a post list stands in, as a series' (seriesPicture()): in `cards` and `filtered`
 * an item of a series of `count`, every teaser counted, the ones a filtered list's pills hide too, as the series' rule
 * counts them; but a lone teaser of `cards` fills its column beside a quotation (section.css, body="columns"); and in
 * `featured` the latest post and the others by the list's own columns.
 * @param {object} r A design file's `resolved`.
 * @param {'cards' | 'featured' | 'filtered'} presentation
 * @param {number} count The number of posts the list draws.
 * @returns {{ widths: number[], sizes: string }[]} One for each teaser, in order.
 */
export function teaserPictures(r, presentation, count) {
  if (count < 1) return [];
  const { contentArea, columnGap } = measures(r);
  if (presentation === 'featured') {
    const rows = seriesPlaces(r, { list: true }).map(([row]) => row);
    const [first, other] = [true, false].map((latest) => drawnPicture(r, greatest(...rows.map((row) => featuredItem(row, columnGap, latest)))));
    return Array.from({ length: count }, (_, at) => (at === 0 ? first : other));
  }
  if (!['cards', 'filtered'].includes(presentation)) throw new Error(`the package has no presentation ${presentation}`);
  const series = seriesDrawn(r, count, { list: true });
  const drawn = presentation === 'cards' && count === 1 ? greatest(series, inColumns(contentArea, columnGap)) : series;
  return Array(count).fill(drawnPicture(r, drawn));
}

/**
 * Every teaser's picture a resolved design makes in its presentations of a post list, its widths and its sizes, for the
 * presentation's Details page (tool.md, Pictures at the right size): in `cards` and `filtered` by the number of posts,
 * from one to eight, those of the same sizes together; a lone teaser of `cards`; and the latest post of `featured` and
 * another.
 * @param {object} r A design file's `resolved`.
 * @returns {{ key: string, picture: string, counts?: number[], widths: number[], sizes: string }[]}
 */
export function teaserRows(r) {
  const series = new Map();
  for (let count = 1; count <= 8; count++) {
    const [picture] = teaserPictures(r, 'filtered', count);
    series.set(picture.sizes, { ...picture, counts: [...(series.get(picture.sizes)?.counts ?? []), count] });
  }
  const rows = [...series.values()].map(({ counts, widths, sizes }) => ({ key: `teaser-${counts.join('-')}`, picture: 'teaser', counts, widths, sizes }));
  const [first, other] = teaserPictures(r, 'featured', 2);
  rows.push({ key: 'teaser-lone', picture: 'teaser-lone', ...teaserPictures(r, 'cards', 1)[0] }, { key: 'featured-first', picture: 'featured-first', ...first }, { key: 'featured-other', picture: 'featured-other', ...other });
  return rows;
}

// A picture shown whole at a height, its width by its proportions, `ratio` its width over its height, at most `widest`:
// a hero's logo and a section's badge are 4rem high, at most 16rem and 8rem wide (hero.css, section.css); a logo in a list
// of logos is as high as the list's logos, a clamp of the window, at most four times as wide (logos.css); and a card's
// symbol is shown whole in a box twice as wide as high at 1.25 times the size of a heading 2, or in a square of 1.25em
// of the card's heading, a heading 5 (cards.css).
export const LOGO = Object.freeze({ height: 4, widest: 16 });
export const BADGE = Object.freeze({ height: 4, widest: 8 });
export const LOGOS = Object.freeze({ height: 'clamp(2.5rem, 1.9286rem + 2.8571vw, 4.5rem)', widest: 4 });
export const SYMBOL = Object.freeze({ size: 1.25, item: 2 });
// A picture a form offers beside it stands at most 16rem wide, and 26rem from a window of 48rem (section.css).
export const OFFER = Object.freeze({ narrow: 16, wide: 26 });
const whole = (height, ratio, widest) => times(height, Math.min(widest, ratio > 0 && Number.isFinite(ratio) ? ratio : Infinity));

// A type size as the owner's formula, the body size times the base to the power of its step, each a straight line of
// the window between the type's breakpoints (css/index.js, scaleCurve()), in rem: in straight pieces between eight
// windows on it, whose chords lie on it or above, since it bends upwards, so a sizes never says less than it is. A
// design file without its scale has the clamp a browser without pow() keeps.
function typeSize(r, name) {
  if (!r['type-scale']) return fluid(r.type[name].size.css);
  const { breakpoints: { min, max }, ratio, 'body-size': body } = r['type-scale'];
  const { step } = r.type[name];
  const [from, to] = [stepStart(min, max) / 16, max / 16];
  const exact = (v) => {
    const share = Math.min(1, Math.max(0, (v - from) / (to - from)));
    return (body.min + (body.max - body.min) * share) / 16 * (ratio.min + (ratio.max - ratio.min) * share) ** step;
  };
  const knots = Array.from({ length: 9 }, (_, i) => from + (to - from) * i / 8);
  return width((v) => {
    if (v <= from || v >= to) return exact(v);
    const i = Math.min(7, Math.floor((v - from) / (to - from) * 8));
    return exact(knots[i]) + (exact(knots[i + 1]) - exact(knots[i])) * (v - knots[i]) / (knots[i + 1] - knots[i]);
  }, knots);
}

// How wide the package's CSS draws each other picture it draws from a body, and whether that is at most the picture's
// own width, its display width where the editor gave it one (`capped`), or stretched to its box whatever that is.
function pictureDrawing(r, picture, { layout, side, ratio } = {}) {
  const { contentArea: area, narrow, columnGap: gap } = measures(r);
  const beside = (then, otherwise = area) => switched(WINDOW, fixed(SECTION.beside), then, otherwise);
  const half = times(sum(area, times(gap, -1)), 1 / 2);
  const heroText = side ? heroPicture('end', area, gap) : area;
  switch (picture) {
    // A section's photo fills its media (section.css): beside the text half the content area less half the column
    // gap, and corner to corner, which the section does to a picture neither a form offers nor badges stand with,
    // exactly half of it, or from the middle to the window's edge; above the text, on a narrower window, the content
    // area's width or, bleeding, the window's. One a form offers is shown whole at most so wide.
    case 'section-photo': {
      if (layout === 'offered') return { drawn: beside(least(half, fixed(OFFER.wide)), least(area, fixed(OFFER.narrow))), capped: true };
      const corners = layout === 'cropped' ? r.section?.['picture-side'] : undefined;
      if (corners === 'corners') return { drawn: beside(times(area, 1 / 2)) };
      if (corners === 'corners-bleed') return { drawn: beside(times(WINDOW, 1 / 2), WINDOW) };
      return { drawn: beside(half) };
    }
    // A figure in a section's body is drawn at most its width and the body's (konzilo.css): across the content area,
    // beside the picture, beside a picture corner to corner, at Narrow, or in three fifths after a form beside the
    // heading (section.css).
    case 'section-body': {
      const body = {
        across: area,
        beside: beside(half),
        corners: beside(sum(times(area, 1 / 2), times(gap, -1))),
        narrow: least(area, narrow),
        form: beside(times(sum(area, times(gap, -1)), SECTION.share)),
      }[layout];
      if (!body) throw new Error(`a section's body stands across, beside, corners, narrow or form, not ${layout}`);
      return { drawn: body, capped: true };
    }
    // A hero's picture beside its text fills its media (hero.css).
    case 'hero': return { drawn: heroPicture(side ?? 'end', area, gap) };
    case 'hero-logo': return { drawn: least(whole(fixed(LOGO.height), ratio, LOGO.widest / LOGO.height), heroText), capped: true };
    case 'badge': return { drawn: whole(fixed(BADGE.height), ratio, BADGE.widest / BADGE.height), capped: true };
    case 'logo': return { drawn: whole(fluid(LOGOS.height), ratio, LOGOS.widest) };
    case 'symbol': {
      const heading = layout === 'heading';
      const size = times(typeSize(r, heading ? 'heading-5' : 'heading-2'), SYMBOL.size);
      return { drawn: whole(size, ratio, heading ? 1 : SYMBOL.item) };
    }
    default: throw new Error(`the package draws no picture ${picture} from a body`);
  }
}

/**
 * A `sizes` that says no picture is drawn wider than `px` pixels: each size no wider, by min(), as the core writes the
 * sizes of a picture the editor gave a display width (its sizesNoWider()).
 * @param {string} sizes @param {number} px
 */
export const noWider = (sizes, px) => sizes.split(', ').map((size) => size.replace(/^(\(min-width: [\d.]+rem\) )?(.+)$/, `$1min($2, ${number(px)}px)`)).join(', ');

/**
 * The display width the editor gave a picture, which the core writes into each of its `sizes` as min(…, <n>px), or null.
 * @param {string | undefined} sizes The core's.
 */
export function displayWidthOf(sizes) {
  const found = /,\s*(\d+(?:\.\d+)?)px\)\s*$/.exec(String(sizes ?? ''));
  return found ? Number(found[1]) : null;
}

/**
 * The `sizes` of a picture this package draws from a body, other than a series' (seriesPicture()), the width its CSS
 * draws it at, in place of the body's the core gives every image in a body (konzilo.md, Images): `section-photo`, by
 * its `layout`, `cropped`, `badges` or `offered`; `section-body`, a figure in a section's body, by the body's `layout`,
 * `across`, `beside`, `corners`, `narrow` or `form`; `hero`, a hero's picture beside its text, by its `side`;
 * `hero-logo` and `badge`, by the picture's `ratio` and, for a logo, whether the hero has a picture at its `side`;
 * `logo`, in a list of logos, by its `ratio`; and `symbol`, a card's, by its `layout`, `item` or `heading`, and `ratio`.
 * A picture with a display width says each size no wider where the CSS draws it no wider than its own width.
 * @param {object} r A design file's `resolved`.
 * @param {string} picture
 * @param {{ layout?: string, side?: string, ratio?: number, display?: number | null }} [options] `ratio` its width over
 *   its height, the widest the CSS allows where it is not known; `display` the editor's display width in px.
 * @returns {string}
 */
export function pictureSizes(r, picture, { display = null, ...options } = {}) {
  const { drawn, capped = false } = pictureDrawing(r, picture, options);
  const sizes = sizesOf(drawn);
  return capped && display ? noWider(sizes, display) : sizes;
}

/**
 * Every sizes a resolved design writes on a picture its parts draw from a body, for the presentation's Details page
 * (tool.md, Pictures at the right size): a card's picture by the number of cards, from one to eight, those of the same
 * sizes together; a section's photo and a figure in its body by the section's layout, corner to corner where the design
 * sets its pictures so; a hero's picture beside its text where the design puts it there; and a logo, a badge and a
 * symbol at their widest, a narrower one by its proportions.
 * @param {object} r A design file's `resolved`.
 * @returns {{ key: string, picture: string, layout?: string, counts?: number[], sizes: string }[]}
 */
export function bodyPictures(r) {
  const series = new Map();
  for (let count = 1; count <= 8; count++) {
    const { sizes } = seriesPicture(r, count);
    series.set(sizes, [...(series.get(sizes) ?? []), count]);
  }
  const rows = [...series].map(([sizes, counts]) => ({ key: `series-${counts.join('-')}`, picture: 'series', counts, sizes }));
  const row = (picture, layout, options = {}) => ({ key: layout ? `${picture}-${layout}` : picture, picture, layout, sizes: pictureSizes(r, picture, { layout, ...options }) });
  rows.push(...['cropped', 'badges', 'offered'].map((layout) => row('section-photo', layout)));
  rows.push(...['across', 'beside', ...(cornerToCorner(r) ? ['corners'] : []), 'narrow', 'form'].map((layout) => row('section-body', layout)));
  const place = r.hero?.picture ?? 'behind';
  if (place !== 'behind') rows.push(row('hero', undefined, { side: place === 'none' ? 'end' : place }));
  rows.push(row('hero-logo'), row('badge'), row('logo'), row('symbol', 'item'), row('symbol', 'heading'));
  return rows;
}