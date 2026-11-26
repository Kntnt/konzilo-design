// The widths and sizes in which the design draws an image, by the contexts the Konzilo core names, as its
// konzilo({ images }) takes them (docs/spec/konzilo.md, Images; the core's ADR 0022): each context's `sizes` the width
// its CSS draws the image at, worked out from the same values the CSS uses, and its widths steps of one ladder.
//
// Each width here is a function of the window's width `v`, in rem, which between its bends is a straight line: the
// side margin and the gaps are clamps of the window, and the rest is sums, halves and least values of those and the
// design's own lengths. So a `sizes` can say it exactly, one straight line per stretch of windows.
import { fluidLine } from '../generator/layout.js';
import { number } from '../generator/fluid.js';

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

// The windows, past the narrowest, where `one` and `other` cross.
function crossings(one, other) {
  const xs = [...new Set([NARROWEST, ...one.bends, ...other.bends].filter((x) => x >= NARROWEST))].sort((a, b) => a - b);
  xs.push(xs.at(-1) + 1000);
  const found = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const [a, b] = [xs[i], xs[i + 1]];
    const [da, db] = [one.at(a) - other.at(a), one.at(b) - other.at(b)];
    if (da * db < 0) found.push(a + da * (b - a) / (da - db));
  }
  return found;
}
const least = (one, other) => width((v) => Math.min(one.at(v), other.at(v)), [...one.bends, ...other.bends, ...crossings(one, other)]);
// `then` where `test` is at least `limit`, or past it where `strict`, and `otherwise` short of it.
function switched(test, limit, then, otherwise, { strict = false } = {}) {
  const holds = (v) => (strict ? test.at(v) > limit.at(v) : test.at(v) >= limit.at(v));
  return width((v) => (holds(v) ? then : otherwise).at(v), [...test.bends, ...limit.bends, ...then.bends, ...otherwise.bends, ...crossings(test, limit)]);
}
// The widest a series' item is drawn in a row `row` wide: two columns where two of at least `minimum` fit, `gap` apart,
// and else one, whatever the number of items, since a lone item takes a third (cards.css, the owner's rule of
// 2026-11-10). The CSS switches by a term times SWITCH, `(2 × minimum + gap − row) × 999`, which outgrows half the row a
// hair before the row is short of two columns: one column where (2m + g − row) × 999 > (row − g) / 2, so two from
// row ≥ 2m × 1998/1999 + g.
const widestOfSeries = (row, minimum, gap) => switched(row, sum(fixed(2 * minimum * (2 * SWITCH) / (2 * SWITCH + 1)), gap), times(sum(row, times(gap, -1)), 1 / 2), row);

// The straight stretches of a width from the narrowest window on, each { from, slope, intercept }, `from` in rem.
function stretches(of) {
  const starts = [NARROWEST, ...of.bends.filter((x) => x > NARROWEST)];
  const found = [];
  starts.forEach((from, i) => {
    const to = starts[i + 1] ?? from + 2;
    // Where two clamps end within a hundredth of a rem of each other, the stretch between them is a sliver the one
    // before it covers to within a ten-thousandth of a pixel.
    if (i > 0 && starts[i + 1] !== undefined && to - from < 0.01) return;
    const [p, q] = [from + (to - from) / 3, from + 2 * (to - from) / 3];
    const slope = (of.at(q) - of.at(p)) / (q - p);
    const stretch = { from, slope, intercept: of.at(p) - slope * p };
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

const at = ({ slope, intercept }, v) => slope * v + intercept;
const floor = (x) => Math.floor(x * 1e4) / 1e4;

// A width as a `sizes`, its widest windows first, each stretch from its window on by `min-width`, which every engine
// reads in a `sizes`, where a range such as `(width >= 40rem)` Safari has read only since 16.4, and whose text holds no
// angle bracket for a reader of the HTML to stop at. A stretch that goes on from the one before starts at its edge; one
// that starts wider or narrower than it, as a series' second column or a hero's picture beside its text past the window
// it stands above it on, starts APART on the side where the wider of the two holds, so a `sizes` never says less than
// is drawn.
function sizesOf(of) {
  const found = stretches(of);
  return found.map((stretch, i) => {
    if (i === 0) return lengthOf(stretch);
    const [after, before] = [at(stretch, stretch.from), at(found[i - 1], stretch.from)];
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

// The widths of a context drawn at `of`: from the step that covers it at the narrowest window at density 1 to the
// step that covers it at its widest at density 2, or the cap.
function widthsOf(of, steps) {
  const runs = stretches(of);
  // In px, to a thousandth, so that arithmetic's last digit does not take a step past the one a width meets.
  const px = (rem) => Math.round(rem * 16 * 1000) / 1000;
  const narrowest = px(at(runs[0], NARROWEST));
  const ends = runs.flatMap((run, i) => [at(run, run.from), at(run, runs[i + 1]?.from ?? run.from)]);
  const widest = runs.at(-1).slope > 1e-9 ? Infinity : px(Math.max(...ends));
  const first = steps.find((step) => step >= narrowest) ?? WIDEST;
  const last = steps.find((step) => step >= Math.min(2 * widest, WIDEST)) ?? WIDEST;
  return steps.filter((step) => step >= first && step <= last);
}

// A hero's picture where the design puts it (hero.css): behind the text it covers the band, the window's width; beside
// it, half the content area less half the column gap, or from the middle to the window's edge where it bleeds; and on a
// window up to 40rem above the text, the content area's width or, bleeding, the window's. A design with no picture in
// its hero puts one a page gives at the end (directives.md, hero).
function heroPicture(place = 'behind', contentArea, columnGap) {
  if (place === 'behind') return WINDOW;
  const whole = place.endsWith('-bleed') ? WINDOW : contentArea;
  const beside = sum(times(whole, 1 / 2), times(columnGap, -1 / 2));
  return switched(WINDOW, fixed(HERO_STACKED), beside, whole, { strict: true });
}

/**
 * The widths, sizes and aspect ratio in which a resolved design draws an image, by the core's contexts.
 * @param {object} r A design file's `resolved`.
 * @returns {Record<'body' | 'gallery' | 'lightbox' | 'hero' | 'card', { widths: number[], sizes: string, ratio?: string }>}
 */
export function imageContexts(r) {
  const rem = (px) => px / 16;
  const margin = fluid(r.layout['side-margin'].css);
  const componentGap = fluid(r.space.roles['component-gap'].css);
  const columnGap = fluid(r.space.roles['column-gap'].css);
  const contentArea = least(sum(WINDOW, times(margin, -2)), fixed(rem(r.layout.wide)));
  const column = least(contentArea, fixed(rem(r.layout.narrow)));
  const steps = ladder(Math.min(r.layout.narrow, r.layout.wide));
  const context = (drawn) => ({ widths: widthsOf(drawn, steps), sizes: sizesOf(drawn) });
  return {
    // A body's figure, in the reading column: Narrow, or the content area where that is narrower (page.md).
    body: context(column),
    // A gallery in that column, at its widest column, its pictures cropped to its ratio.
    gallery: { ...context(widestOfSeries(column, GALLERY.minimum, componentGap)), ratio: GALLERY.ratio },
    // The core's lightbox, which fits each picture whole in the window, so at most the window's width.
    lightbox: context(WINDOW),
    hero: context(heroPicture(r.hero?.picture, contentArea, columnGap)),
    // A card in a series across the content area, at its widest column.
    card: context(widestOfSeries(contentArea, CARD.minimum, columnGap)),
  };
}
