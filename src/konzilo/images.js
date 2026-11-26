// The widths and sizes in which the design draws an image, by the contexts the Konzilo core names, as its
// konzilo({ images }) takes them (docs/spec/konzilo.md, Images; the core's ADR 0022): each context's `sizes` the width
// its CSS draws the image at, worked out from the same values the CSS uses, and its widths steps of one ladder. Beside
// them, the sizes of each picture the package draws itself, from a body or through Astro's getImage().
//
// Each width here is a function of the window's width `v`, in rem, which between its bends is a straight line: the
// side margin and the gaps are clamps of the window, and the rest is sums, halves and least values of those and the
// design's own lengths. So a `sizes` can say it exactly, one straight line per stretch of windows. A picture the CSS
// crops to cover a box as tall as a share of the window is drawn wider where the box is taller than the picture's
// proportions, which a `sizes` says in vh (A picture cropped to cover its box, below).
import { contentAreaLine, fluidLine } from '../generator/layout.js';
import { number, typeScaleCurve } from '../generator/fluid.js';
import { SECTION_LAYOUTS } from '../directives/section.js';

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
// `then` on a window of at least `rem`, or past it where `strict`, and `otherwise` on a narrower one.
const fromWindow = (rem, then, otherwise, options) => switched(WINDOW, fixed(rem), then, otherwise, options);

// ---------- A series' columns ----------

// The columns a series of `count` items steps down through as its row narrows (cards.css, the owner's rule of
// 2026-11-10): two for two; three for one, three, and 5, 6 or 9 more than a multiple of 12; four and then two for 4 more
// than a multiple of 6, which leaves no lone item where three would; four and then three for any other; and last one.
function columnSteps(count) {
  requireCount(count);
  if (count === 2) return [2, 1];
  if (count === 1 || count === 3 || [5, 6, 9].includes(count % 12)) return [3, 2, 1];
  return count % 6 === 4 ? [4, 2, 1] : [4, 3, 2, 1];
}
// A series has a whole number of items, at least one.
function requireCount(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`a series of at least one item, not ${count}`);
}
// A k-th of a row `row` wide, its items `gap` apart.
const shareOf = (row, gap, k) => times(sum(row, times(gap, -(k - 1))), 1 / k);
// The row from which the CSS lays out k columns of at least `minimum`, `gap` apart. It switches by a term times SWITCH,
// `(k × minimum + (k − 1) × gap − row) × 999`, which falls under a k-th of the row a hair before the row holds k columns:
// k columns where (km + (k − 1)g − row) × 999 ≤ (row − (k − 1)g) / k, so from row ≥ km × 999k / (999k + 1) + (k − 1)g,
// two from 2m × 1998/1999 + g.
const columnsFrom = (k, gap, minimum) => sum(fixed(k * minimum * (k * SWITCH) / (k * SWITCH + 1)), times(gap, k - 1));

// An item of a series of `count` items in a row `row` wide, `gap` apart, each column at least `minimum`. Where four fall
// to two, three stand for a sliver of a pixel between, narrower than two, which the series' width leaves out, since it
// says the wider.
function seriesItem(row, gap, count, minimum = CARD.minimum) {
  const switches = columnSteps(count).filter((k) => k > 1).reverse();
  return switches.reduce((drawn, k) => switched(row, columnsFrom(k, gap, minimum), shareOf(row, gap, k), drawn), row);
}
// The widest an item of a series of `count` is drawn in any row no wider than `room`, `gap` apart: the room's own item,
// or, where a row is narrower, the widest an item is just short of a switch to more columns, where it has fewer.
function seriesItemWithin(room, gap, count) {
  const steps = columnSteps(count);
  const peaks = steps.slice(0, -1).map((k, i) => shareOf(columnsFrom(k, gap, CARD.minimum), gap, steps[i + 1]));
  return greatest(least(room, greatest(...peaks)), seriesItem(room, gap, count));
}

// ---------- A picture cropped to cover its box ----------

// A picture the CSS crops to cover its box, by `object-fit: cover`, is drawn as wide as the box, or, where the box is
// taller than the picture's proportions, as wide as the box's height times them, `ratio` its width over its height.
// Where the box's height follows from the window's, a `sizes` says it in vh, which every engine reads in one, and which
// is never less than the svh the CSS sets the heights by. A drawing is then { box, tall }: `box` the box's width and
// `tall` its height times the picture's proportions, `vh` hundredths of the window's height and `base`, a width, at
// most `cap`, which is NONE where nothing caps it and 0 on windows where the CSS does not crop the picture.
const NONE = 1e5;
const isNone = (length) => length >= NONE / 100;
// The picture's proportions, which every picture the package crops so has, and none is guessed (the owner, 2026-11-26):
// one from a body by the width and height the core writes on every raster image it makes, one made through getImage()
// by its master's, and a Band's or a Hero's by the width and height it requires with its versions.
const isRatio = (ratio) => ratio > 0 && Number.isFinite(ratio);
/**
 * A picture's proportions, its width over its height, from the two as an image's attributes, a component's props or a
 * master give them, numbers or their text; undefined where either is missing or not more than nothing.
 * @param {number | string | undefined} wide @param {number | string | undefined} high
 * @returns {number | undefined}
 */
export function ratioFrom(wide, high) {
  const [w, h] = [Number(wide), Number(high)];
  return w > 0 && h > 0 ? w / h : undefined;
}
function proportions(ratio) {
  if (isRatio(ratio)) return ratio;
  throw new TypeError(`A picture the CSS crops to cover its box needs its proportions, its width over its height, to say how wide it is drawn, not ${ratio}`);
}
function covering(box, ratio, { vh = 0, base = fixed(0), cap = fixed(NONE) } = {}) {
  return { box, tall: { vh: vh * ratio, base: times(base, ratio), cap: times(cap, ratio) } };
}
const drawingOf = (drawn) => (drawn.box ? drawn : { box: drawn });

// ---------- Stretches and sizes ----------

// A stretch's width at a window `v` rem wide.
const stretchAt = ({ slope, intercept }, v) => slope * v + intercept;
const floor = (x) => Math.floor(x * 1e4) / 1e4;
// The straight line `part` is from `from` to `to`, read a third and two thirds in.
function lineOf(part, from, to) {
  const [p, q] = [from + (to - from) / 3, from + 2 * (to - from) / 3];
  const slope = (part.at(q) - part.at(p)) / (q - p);
  return { slope, intercept: part.at(p) - slope * p };
}
const sameLine = (one, other) => Math.abs(one.slope - other.slope) < 1e-7 && Math.abs(one.intercept - other.intercept) < 5e-4;

// The straight stretches of a drawing, from the narrowest window on, each { from, slope, intercept } of its box, `from`
// in rem, and where it covers its box, `tall`, the lines of its height's `base` and `cap` there.
function stretches(drawing) {
  const { box, tall } = drawingOf(drawing);
  const parts = tall ? [box, tall.base, tall.cap] : [box];
  // A clamp read back from the CSS's rounded numbers may start a hair past the narrowest window, which is none.
  const starts = [NARROWEST, ...[...new Set(parts.flatMap((part) => part.bends))].filter((x) => x > NARROWEST + 0.01).sort((a, b) => a - b)];
  const found = [];
  starts.forEach((from, i) => {
    const to = starts[i + 1] ?? from + 2;
    // Where two clamps end within a hundredth of a rem of each other, the stretch between them is a sliver the one
    // before it covers, its box to within a ten-thousandth of a rem and its height to within a thousandth, a 60th of a
    // pixel. One where a width jumps wider, as where two places a series stands in change their columns together, it
    // does not cover, and it stays.
    const middle = (from + to) / 2;
    const last = found.at(-1);
    // The stretch before goes on over this one: a height's to its end too.
    const goesOn = () => {
      if (tall) last.tall.to = to;
    };
    if (i > 0 && starts[i + 1] !== undefined && to - from < 0.01) {
      const lines = [last, ...(tall ? [last.tall.base, last.tall.cap] : [])];
      if (parts.every((part, j) => part.at(middle) <= stretchAt(lines[j], middle) + (j === 0 ? 1e-4 : 1e-3))) return goesOn();
    }
    const stretch = { from, ...lineOf(box, from, to) };
    if (tall) stretch.tall = { vh: tall.vh, base: lineOf(tall.base, from, to), cap: lineOf(tall.cap, from, to), to };
    // A bend of a part that leaves the whole straight, such as the content area reaching Wide under Narrow, is none.
    if (last && sameLine(last, stretch) && (!tall || (sameLine(last.tall.base, stretch.tall.base) && sameLine(last.tall.cap, stretch.tall.cap)))) return goesOn();
    found.push(stretch);
  });
  return found;
}

// A length a `sizes` holds: rem, vw, vh, or several in calc(), the ones added first. `slope` is the share of the
// window's width, `vh` hundredths of its height and `intercept` rem.
function lengthOf({ slope, intercept, vh = 0 }) {
  const terms = [[slope * 100, 'vw'], [vh, 'vh'], [intercept, 'rem']].filter(([value]) => number(Math.abs(value)) !== '0');
  if (terms.length === 0) return '0rem';
  if (terms.length === 1) return `${number(terms[0][0])}${terms[0][1]}`;
  const ordered = [...terms.filter(([value]) => value > 0), ...terms.filter(([value]) => value < 0)];
  return `calc(${ordered.map(([value, unit], i) => (i === 0 ? `${number(value)}${unit}` : `${value < 0 ? '-' : '+'} ${number(Math.abs(value))}${unit}`)).join(' ')})`;
}

// Whether a stretch's picture can be drawn wider than its box: where the CSS crops it there and its height, at most its
// cap, can come to more than the box's width somewhere in the stretch.
function covers({ from, slope, intercept, tall }) {
  if (!tall) return false;
  const ends = [from, tall.to];
  const box = ends.map((v) => slope * v + intercept);
  const cap = ends.map((v) => stretchAt(tall.cap, v));
  if (cap.every((length, i) => length <= box[i] + 1e-6)) return false;
  return tall.vh > 0 || ends.some((v, i) => stretchAt(tall.base, v) > box[i] + 1e-6);
}

// A stretch's width as a `sizes` says it: its box's, or, where the picture may be drawn wider by its box's height, the
// greater of the two, max(box, min(cap, height)).
function sizeOf(stretch) {
  const box = lengthOf(stretch);
  if (!covers(stretch)) return box;
  const { vh, base, cap } = stretch.tall;
  const height = lengthOf({ ...base, vh });
  return `max(${box}, ${isNone(stretchAt(cap, stretch.from)) ? height : `min(${lengthOf(cap)}, ${height})`})`;
}

// A drawing as a `sizes`, its widest windows first, each stretch from its window on by `min-width`, which every engine
// reads in a `sizes`, where a range such as `(width >= 40rem)` Safari has read only since 16.4, and whose text holds no
// angle bracket for a reader of the HTML to stop at. A stretch that goes on from the one before starts at its edge; one
// whose box starts wider or narrower than the one before, as a series' second column or a hero's picture beside its
// text past the window it stands above it on, starts APART on the side where the wider of the two holds, so a `sizes`
// never says less than is drawn.
function sizesOf(drawing) {
  const found = stretches(drawing);
  return found.map((stretch, i) => {
    if (i === 0) return sizeOf(stretch);
    const [after, before] = [stretchAt(stretch, stretch.from), stretchAt(found[i - 1], stretch.from)];
    const edge = floor(stretch.from) + (Math.abs(after - before) < 1e-6 ? 0 : after > before ? -APART : APART);
    return `(min-width: ${number(edge)}rem) ${sizeOf(stretch)}`;
  }).reverse().join(', ');
}
// Chromium and WebKit tell a media query's length apart from a window's to about a 64th of a pixel, so the next window
// they all tell from an edge is a 32nd of a pixel past it, in rem.
const APART = 0.002;

// What the design's CSS draws by lengths of its own, not of the design file: a gallery's least column, and the aspect
// ratio it crops its pictures to (konzilo.css).
export const GALLERY = Object.freeze({ minimum: 12, ratio: '4:3' });
// A series of cards' least column (cards.css). A card's picture has no one ratio: 16:9, `box` its height over its width,
// a person's square, and behind the text the card's own, at least `behind` rem high (card.css, cards.css), so the card
// crops it, and the core does not.
export const CARD = Object.freeze({ minimum: 15, box: 9 / 16, behind: 20 });
// The factor by which a series' CSS turns a length into a switch (cards.css, konzilo.css).
export const SWITCH = 999;
// The widest window, in rem, on which a hero's picture beside its text stands above it instead (hero.css).
export const HERO_STACKED = 40;
// A hero's least height, a share of the window's height less the header's, or of all of it under a header the page
// starts under, by its `height` (hero.css).
export const HERO_HEIGHTS = Object.freeze({ third: 1 / 3, half: 1 / 2, 'two-thirds': 2 / 3, full: 1 });

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
const ladderOf = (r) => ladder(Math.min(r.layout.narrow, r.layout.wide));

/**
 * The widths a picture made through Astro's getImage() asks for of a master `own` px wide, by the core's rule against
 * near duplicates (Kntnt/konzilo `src/astro/image-versions.js`, its versionWidths() and NEAR_DUPLICATE; ADR 0022): none
 * wider than the master, or than the cap where the master is wider, and in place of each width wider than it or within
 * a tenth below it, the master's own width, or the cap, once. The core applies the tenth only where a width asked for
 * is wider than the master, which a body's image always asks for, with the lightbox's widths; this applies it whether
 * or not, so a teaser or an opening asks for the versions the core makes of the same master in a body, and shares its
 * files (the owner, 2026-11-26). Where the master's width is not known, the widths as given.
 * @param {number[]} widths @param {number | undefined} own
 * @returns {number[]}
 */
export function masterWidths(widths, own) {
  if (!(own > 0)) return [...widths];
  const widest = Math.min(Math.round(own), WIDEST);
  const asked = [...new Set(widths.map(Math.round))].sort((a, b) => a - b);
  const kept = asked.filter((one) => one < widest * NEAR);
  return kept.length === asked.length ? kept : [...kept, widest];
}

// The widths of a picture drawn so: from the step that covers its box at the narrowest window at density 1 to the step
// that covers its widest drawing at density 2, or the cap, which a drawing that grows with the window's height, or
// past the widest window, takes.
function widthsOf(drawing, steps) {
  const runs = stretches(drawing);
  // In px, to a thousandth, so that arithmetic's last digit does not take a step past the one a width meets.
  const px = (rem) => Math.round(rem * 16 * 1000) / 1000;
  const narrowest = px(stretchAt(runs[0], NARROWEST));
  let widest = runs.at(-1).slope > 1e-9 ? Infinity : 0;
  runs.forEach((run, i) => {
    const ends = (line) => [stretchAt(line, run.from), stretchAt(line, runs[i + 1]?.from ?? run.from)];
    widest = Math.max(widest, ...ends(run));
    if (!covers(run)) return;
    if (run.tall.vh > 0 && isNone(stretchAt(run.tall.cap, run.from))) widest = Infinity;
    else widest = Math.max(widest, ...ends(run.tall.vh > 0 ? run.tall.cap : run.tall.base));
  });
  widest = px(widest);
  const first = steps.find((step) => step >= narrowest) ?? WIDEST;
  const last = steps.find((step) => step >= Math.min(2 * widest, WIDEST)) ?? WIDEST;
  return steps.filter((step) => step >= first && step <= last);
}
// A picture drawn so, as its widths on the design's ladder and its sizes.
const drawnPicture = (r, drawing) => ({ widths: widthsOf(drawing, ladderOf(r)), sizes: sizesOf(drawing) });

// ---------- The core's contexts ----------

// The design's measures a picture is drawn by, each a function of the window.
function measures(r) {
  // The content area, min(window − 2 × side margin, Wide), as the layout works it out for the Reading Area too.
  const area = contentAreaLine(r.layout);
  return {
    contentArea: width(area.at, area.bends),
    narrow: fixed(r.layout.narrow / 16),
    columnGap: fluid(r.space.roles['column-gap'].css),
    componentGap: fluid(r.space.roles['component-gap'].css),
    band: fluid(r.space.roles.band.css),
    body: fluid(r.type.body.size.css),
  };
}
// Half a row less half the gap, as two columns of it are, and as a hero's or a section's picture beside its text is.
const halfOf = (row, gap) => shareOf(row, gap, 2);

// The box of a hero's picture where the design puts it (hero.css): behind the text it covers the band, the window's
// width; beside it, half the content area less half the column gap, or from the middle to the window's edge where it
// bleeds; and on a window up to 40rem above the text, the content area's width or, bleeding, the window's. A design with
// no picture in its hero puts one a page gives at the end (directives.md, hero).
function heroPicture(place = 'behind', contentArea, columnGap) {
  if (place === 'behind') return WINDOW;
  const whole = place.endsWith('-bleed') ? WINDOW : contentArea;
  return fromWindow(HERO_STACKED, halfOf(whole, columnGap), whole, { strict: true });
}

// The proportions the `hero` context counts its picture at: 16:9, cropped to cover the hero's box at the design's
// height, as an article's opening draws one, so a hero the core draws loads a version that covers any picture no wider
// than 16:9, and at worst, for a photo of 3:2, one a step of the ladder wider than it needs (the owner, 2026-11-26).
export const HERO_CONTEXT_RATIO = 16 / 9;

// A hero's picture where the design puts it, of proportions `ratio`, cropped to cover its box at the design's height:
// behind its text as the band's, beside it as the hero's, at the end where the design's hero has no picture.
function heroDrawing(r, ratio) {
  const { picture = 'behind', height } = r.hero ?? {};
  return picture === 'behind' ? bandDrawing({ height, ratio }) : heroBeside(r, picture === 'none' ? 'end' : picture, { height, ratio });
}

// How wide the design draws a picture in each context, as a function of the window.
function drawings(r) {
  const { contentArea, narrow, columnGap, componentGap } = measures(r);
  const column = least(contentArea, narrow);
  return {
    // A body's figure, in the reading column: Narrow, or the content area where that is narrower (page.md).
    body: column,
    // A gallery in that column, at its widest column, two items' (a lone item takes a third).
    gallery: seriesItem(column, componentGap, 2, GALLERY.minimum),
    // The core's lightbox, which fits each picture whole in the window, so at most the window's width.
    lightbox: WINDOW,
    // A hero's picture where the design puts it, of 16:9.
    hero: heroDrawing(r, HERO_CONTEXT_RATIO),
    // A card in a series across the content area, at its widest column.
    card: seriesItem(contentArea, columnGap, 2),
  };
}

/**
 * The widths, sizes and aspect ratio in which a resolved design draws an image, by the core's contexts.
 * @param {object} r A design file's `resolved`.
 * @returns {Record<'body' | 'gallery' | 'lightbox' | 'hero' | 'card', { widths: number[], sizes: string, ratio?: string }>}
 */
export function imageContexts(r) {
  const contexts = Object.fromEntries(Object.entries(drawings(r)).map(([name, drawn]) => [name, drawnPicture(r, drawn)]));
  // A gallery's pictures are cropped to its ratio.
  contexts.gallery.ratio = GALLERY.ratio;
  return contexts;
}

// How wide a drawing is drawn in a window `v` rem wide and `h` rem high, as its sizes says it (sizeOf()): its box's
// width, or where it covers its box, as wide as its height makes the picture where that is wider.
function drawnAt(drawing, v, h) {
  const { box, tall } = drawingOf(drawing);
  return tall ? Math.max(box.at(v), Math.min(tall.cap.at(v), tall.vh / 100 * h + tall.base.at(v))) : box.at(v);
}

/**
 * How wide a resolved design draws a picture in each of the core's contexts in a window `px` wide and `high` tall, in
 * px at the default text size, a gallery's and a card's at the widest column of a series, and a hero's of 16:9, which
 * the window's height may draw wider than its box; what the presentation tells a reader.
 * @param {object} r A design file's `resolved`.
 * @param {number} px The window's width. @param {number} high The window's height.
 * @returns {Record<'body' | 'gallery' | 'lightbox' | 'hero' | 'card', number>}
 */
export function drawnWidths(r, px, high) {
  if (!(high >= 0)) throw new TypeError(`drawnWidths() needs the window's height, by which a hero's picture is drawn, not ${high}`);
  return Object.fromEntries(Object.entries(drawings(r)).map(([name, drawn]) => [name, drawnAt(drawn, px / 16, high / 16) * 16]));
}

// ---------- The pictures the package draws itself (issues #38, #39, #40; konzilo.md, Images) ----------

// What the package's CSS draws these pictures by that the design file does not hold, each held to its stylesheet by a
// test. A section sets its picture beside its text from a window of `beside` rem, and its head beside an accordion from
// `wide` rem, in parts of 2fr and 3fr, `share` the second; a body in columns takes two of at least `columns` rem; and a
// photo it crops grows to fill no more than `most` of the window's height (section.css). An accordion's answer stands
// `padding` em from its edges together, `questions` where it is of questions (accordion.css).
export const SECTION = Object.freeze({ beside: 48, wide: 60, share: 3 / 5, columns: 18, most: 0.85 });
export const ACCORDION = Object.freeze({ padding: 1.5, questions: 2.5 });

// The design's `section.picture-side`, and whether it sets a section's cropped photo corner to corner.
const pictureSide = (r) => String(r.section?.['picture-side'] ?? '');
/**
 * Whether a resolved design sets a section's cropped photo corner to corner (section.css, The side of the picture).
 * @param {object} r A design file's `resolved`.
 */
export const cornerToCorner = (r) => pictureSide(r).startsWith('corners');

// The text beside a picture a section crops corner to corner stands in half the content area less the column gap.
const besideCorners = (area, gap) => sum(times(area, 1 / 2), times(gap, -1));
// A column of a section's body in two, each at least 18rem where two fit, and else the whole content area (section.css,
// body="columns").
const inColumns = (area, gap) => switched(area, sum(fixed(2 * SECTION.columns), gap), halfOf(area, gap), area);

// The rows a series stands in at the top of a section's body, by the body's layout (sectionLayout()): `across` the
// content area, as "Read more" and a page's loose blocks stand too; `beside` the photo, half the content area less half
// the column gap from 48rem; `corners`, beside a photo corner to corner, half the content area less the column gap;
// `form`, after a form beside the heading, three fifths of the content area less the column gap from 48rem; `narrow`, at
// Narrow, as a centred section's or one with a form or a choice and an article's reading column; `columns`, a column of
// a body in two, body="columns"; and `head`, where an accordion stands alone beside the section's head, three fifths from
// 60rem (section.css, rules 1 to 4).
export const SERIES_ROWS = Object.freeze(['across', 'beside', 'corners', 'form', 'narrow', 'columns', 'head']);
function bodyRow(r, layout) {
  const { contentArea: area, narrow, columnGap: gap } = measures(r);
  const share = times(sum(area, times(gap, -1)), SECTION.share);
  switch (layout) {
    case 'across': return area;
    case 'beside': return fromWindow(SECTION.beside, halfOf(area, gap), area);
    case 'corners': return fromWindow(SECTION.beside, besideCorners(area, gap), area);
    case 'form': return fromWindow(SECTION.beside, share, area);
    case 'narrow': return least(area, narrow);
    case 'columns': return inColumns(area, gap);
    case 'head': return fromWindow(SECTION.wide, share, area);
    default: throw new Error(`a series stands in no place ${layout}: it stands ${SERIES_ROWS.join(', ')}, or in an accordion in one of them`);
  }
}
// A place a series stands in as its row and its gap: a place is one of SERIES_ROWS, or `{ accordion, questions }` in an
// accordion standing in one, whose answer stands 1.5em in from its edges, or 2.5em where it is of questions, and whose
// series takes the component gap (accordion.css, cards.css).
function rowAndGap(r, place) {
  const { columnGap, componentGap, body } = measures(r);
  if (!place?.accordion) return [bodyRow(r, place), columnGap];
  const padding = place.questions ? ACCORDION.questions : ACCORDION.padding;
  return [sum(bodyRow(r, place.accordion), times(body, -padding)), componentGap];
}
// The rows of SERIES_ROWS a series itself stands in, in a design: every one but `head`, beside which only an accordion
// stands, and `corners` only where the design sets a section's cropped photo corner to corner, the text beside it in
// half the content area less the column gap.
const rowsIn = (r) => SERIES_ROWS.filter((row) => row !== 'head' && (row !== 'corners' || cornerToCorner(r)));

// The places a series of the directives may stand in: each row a series stands in (rowsIn()), across a band's content
// area, in a section's body beside its picture, corner to corner, beside a heading with a form right after it, at
// Narrow, as a centred section's or one with a form or a choice, and as an article's reading column is, and in two
// columns; and an accordion in each but a body in columns, which holds none, and alone beside a section's head, of plain
// answers and of questions. Where nothing says which it stands in, a series' picture says the widest it is drawn in any
// of them, so it never says less than is drawn (the owner, 2026-11-26, issue #44). A post list stands only directly in
// a section, which the checks hold it to, since a part drawn from its tree cannot draw one (directives.md, What only the
// core can draw), so never in an accordion (`list`).
function seriesPlaces(r, { list = false } = {}) {
  const rows = rowsIn(r);
  if (list) return rows;
  const accordions = [...rows.filter((row) => row !== 'columns'), 'head'].flatMap((accordion) => [{ accordion }, { accordion, questions: true }]);
  return [...rows, ...accordions];
}

// Whether a part stands where the places above are counted, `within` the parts it stands in from the outermost in: at
// the top of a section's body or a page's, or in an accordion that stands there.
const counted = (within) => within.length === 0 || (within.length === 1 && within[0] === 'accordion');

// How wide an item of a series of `count` items is drawn: in its `place`, where the part around it knows it (issue #44,
// the owner's decision of 2026-11-26: exact where the package can know the place); else the widest in any place a
// series, or a post list, stands in; and within a part deeper than those, whose place a renderer does not know, in any
// row the part leaves room for, at either gap, as an upper bound (the assistant's choice, 2026-11-26).
function seriesDrawn(r, count, { list = false, within = [], place } = {}) {
  if (place !== undefined) return seriesItem(...rowAndGap(r, place), count);
  if (counted(within)) return greatest(...seriesPlaces(r, { list }).map((one) => seriesItem(...rowAndGap(r, one), count)));
  const room = roomOf(r, within);
  const { columnGap, componentGap } = measures(r);
  return greatest(seriesItemWithin(room, columnGap, count), seriesItemWithin(room, componentGap, count));
}

// How wide a part drawn within others, `within` them from the outermost in, may draw what it holds, at the most: a part
// stands within the content area; an accordion's answer stands 1.5em in from its edges; a card's, a step's or a reason's
// words in an item of its series, `{ series: count }`; and a tab, a choice's panel, a fact box, a hero's text, a list's
// intro and a table of contents' flow in the room they stand in (accordion.css, cards.css).
function roomOf(r, within = []) {
  const { contentArea, body } = measures(r);
  return within.reduce((room, part, at) => {
    if (part === 'accordion') return sum(room, times(body, -ACCORDION.padding));
    if (part?.series) return seriesDrawn(r, part.series, { within: within.slice(0, at) });
    return room;
  }, contentArea);
}

// A picture shown whole at a height, its width by its proportions, `ratio` its width over its height, at most `widest`:
// a hero's logo and a section's badge are 4rem high, at most 16rem and 8rem wide (hero.css, section.css); a logo in a list
// of logos is as high as the list's logos, a clamp of the window, at most four times as wide (logos.css); and a card's
// symbol is shown whole by the card, `symbol="item"`, in a box `itemBox` times as wide as high at `size` times the size of
// a heading 2, or in its heading in a square of `size` em of the card's heading, a heading 5 (cards.css).
export const LOGO = Object.freeze({ height: 4, widest: 16 });
export const BADGE = Object.freeze({ height: 4, widest: 8 });
export const LOGOS = Object.freeze({ height: 'clamp(2.5rem, 1.9286rem + 2.8571vw, 4.5rem)', widest: 4 });
export const SYMBOL = Object.freeze({ size: 1.25, itemBox: 2 });
// A picture a form offers beside it stands at most 16rem wide, and 26rem from a window of 48rem (section.css).
export const OFFER = Object.freeze({ narrow: 16, wide: 26 });
const whole = (height, ratio, widest) => times(height, Math.min(widest, ratio > 0 && Number.isFinite(ratio) ? ratio : Infinity));

// A type size by the owner's scale (typeScaleCurve()), in rem: in straight pieces between nine windows on it, whose chords
// lie on it or above, since it bends upwards, so a sizes never says less than it is. A design file without its scale has
// the clamp a browser without pow() keeps.
function typeSize(r, name) {
  if (!r['type-scale']) return fluid(r.type[name].size.css);
  const { from, to, size } = typeScaleCurve(r['type-scale']);
  const exact = (v) => size(r.type[name].step, v);
  const knots = Array.from({ length: 9 }, (_, i) => from + (to - from) * i / 8);
  return width((v) => {
    if (v <= from || v >= to) return exact(v);
    const i = Math.min(7, Math.floor((v - from) / (to - from) * 8));
    return exact(knots[i]) + (exact(knots[i + 1]) - exact(knots[i])) * (v - knots[i]) / (knots[i + 1] - knots[i]);
  }, knots);
}

// The header's height at the most, in rem (header.css): the taller of 4rem and its identity with 0.75rem above and
// below, and its hairline; its identity at most the design's logo, `logo-height`, beside its name, or above it where the
// brand stands in a column, and its slogan beside them, or under them where the design puts it there, a line of words
// 0.66 of its size, the type at its largest. A site with no logo, name or slogan has a lower one.
export const HEADER = Object.freeze({ least: 4, padding: 0.75, hairline: 0.0625, cap: 0.66, gap: 0.5 });
function headerMost(r) {
  const settings = r.header ?? {};
  const widest = 1e4;
  const logo = (settings['logo-height'] ?? 36) / 16;
  const name = typeSize(r, 'heading-5').at(widest) * HEADER.cap;
  const slogan = typeSize(r, 'small').at(widest) * HEADER.cap;
  const brand = settings.identity === 'both' && settings['brand-axis'] === 'column' ? logo + HEADER.gap + name : Math.max(logo, name);
  const identity = settings['slogan-place'] === 'below' ? brand + HEADER.gap + slogan : Math.max(brand, slogan);
  return Math.max(HEADER.least, identity + 2 * HEADER.padding) + HEADER.hairline;
}

// A picture behind a band's text covers the band (band.css): as wide as the window, and, in a hero of a height, at least
// that share of the window's height, so as wide as its proportions make that where they are wider than the band's.
function bandDrawing({ height, ratio } = {}) {
  const share = HERO_HEIGHTS[height];
  return share ? covering(WINDOW, proportions(ratio), { vh: 100 * share }) : WINDOW;
}

// A hero's picture beside its text covers its media (hero.css), as wide as heroPicture() says. On a window past 40rem
// the media is as tall as the hero's row, at least the hero's height less its band space above and below, and
// bleeding, out over that space and the header's height above it; on a narrower one it stands in the row above the
// text, at least 16:9 of its width, and what the text leaves of the hero's height less the band space and the column
// gap under it, and bleeding, out over the band space and the header above it. The header's height is its most
// (headerMost()), the hero's the window's share without the header taken off, and the text's none, so a `sizes` says no
// less than is drawn where the text fits the hero.
function heroBeside(r, side, { height, ratio } = {}) {
  const { contentArea, columnGap, band } = measures(r);
  const bleed = side.endsWith('-bleed');
  const whole = bleed ? WINDOW : contentArea;
  const a = proportions(ratio);
  const share = HERO_HEIGHTS[height] ?? 0;
  const header = fixed(bleed ? headerMost(r) : 0);
  const stacked = (then, otherwise) => fromWindow(HERO_STACKED, otherwise, then, { strict: true });
  const above = stacked(times(sum(times(whole, 9 / 16), header), a), fixed(0));
  const beside = bleed ? times(header, 1 - share) : times(band, -2);
  const over = bleed ? sum(header, times(band, -1), times(columnGap, -1)) : sum(times(band, -2), times(columnGap, -1));
  return covering(greatest(heroPicture(side, contentArea, columnGap), above), a, { vh: 100 * share, base: stacked(over, beside) });
}

// How wide the package's CSS draws each picture it draws from a body or a teaser, and whether that is at most the
// picture's own width, its display width where the editor gave it one (`capped`), or stretched to its box whatever that
// is.
function pictureDrawing(r, picture, { layout, side, ratio, height, count, behind = false, list = false, within = [], place } = {}) {
  const { contentArea: area, narrow, columnGap: gap } = measures(r);
  const beside = (then, otherwise = area) => fromWindow(SECTION.beside, then, otherwise);
  const half = halfOf(area, gap);
  switch (picture) {
    // A picture behind a band's text.
    case 'band': return { drawn: bandDrawing({ height, ratio }) };
    // A section's photo fills its media (section.css): beside the text half the content area less half the column
    // gap, and corner to corner, which the section does to a picture neither a form offers nor badges stand with,
    // exactly half of it, or from the middle to the window's edge; above the text, on a narrower window, the content
    // area's width or, bleeding, the window's. One a form offers is shown whole at most so wide. Beside the text a photo
    // it crops covers a box that grows with the text, up to a square and 85svh, and corner to corner as tall as its
    // band, which beside text no taller is up to 85svh.
    case 'section-photo': {
      if (layout === 'offered') return { drawn: beside(least(half, fixed(OFFER.wide)), least(area, fixed(OFFER.narrow))), capped: true };
      if (layout !== 'cropped') return { drawn: beside(half) };
      const a = proportions(ratio);
      const crop = (box, cap) => covering(box, a, { vh: 100 * SECTION.most, cap: beside(cap, fixed(0)) });
      if (pictureSide(r) === 'corners') return { drawn: crop(beside(times(area, 1 / 2)), fixed(NONE)) };
      if (pictureSide(r) === 'corners-bleed') return { drawn: crop(beside(times(WINDOW, 1 / 2), WINDOW), fixed(NONE)) };
      return { drawn: crop(beside(half), half) };
    }
    // A figure in a section's body is drawn at most its width and the body's (konzilo.css): across the content area,
    // beside the picture, beside a picture corner to corner, at Narrow, or in three fifths after a form beside the
    // heading (section.css).
    case 'section-body': {
      const body = {
        across: area,
        beside: beside(half),
        corners: beside(besideCorners(area, gap)),
        narrow: least(area, narrow),
        form: beside(times(sum(area, times(gap, -1)), SECTION.share)),
      }[layout];
      if (!body) throw new Error(`a section's body stands ${SECTION_LAYOUTS.body.join(', ')}, not ${layout}`);
      return { drawn: body, capped: true };
    }
    // A figure a part passes through as the core wrote it, in a part drawn from its tree, at most its width and the room
    // the part leaves it.
    case 'figure': return { drawn: roomOf(r, within), capped: true };
    // A card's picture fills its item of a series of `count`: cropped to 16:9 of its width, or behind its text, to the
    // card, at least 20rem high (card.css, cards.css).
    case 'series': {
      const item = seriesDrawn(r, count, { list, within, place });
      const a = proportions(ratio);
      return { drawn: behind ? greatest(item, fixed(CARD.behind * a)) : times(item, Math.max(1, a * CARD.box)) };
    }
    // A hero's picture beside its text fills its media (hero.css).
    case 'hero': return { drawn: heroBeside(r, side ?? 'end', { height, ratio }) };
    case 'hero-logo': return { drawn: least(whole(fixed(LOGO.height), ratio, LOGO.widest / LOGO.height), side ? heroPicture('end', area, gap) : area), capped: true };
    case 'badge': return { drawn: whole(fixed(BADGE.height), ratio, BADGE.widest / BADGE.height), capped: true };
    case 'logo': return { drawn: whole(fluid(LOGOS.height), ratio, LOGOS.widest) };
    case 'symbol': {
      const heading = layout === 'heading';
      const size = times(typeSize(r, heading ? 'heading-5' : 'heading-2'), SYMBOL.size);
      return { drawn: whole(size, ratio, heading ? 1 : SYMBOL.itemBox) };
    }
    default: throw new Error(`the package draws no picture ${picture} from a body`);
  }
}

/**
 * A `sizes` that says no picture is drawn wider than `px` pixels: each size no wider, by min(), as the core writes the
 * sizes of a picture the editor gave a display width (its sizesNoWider()).
 * @param {string} sizes @param {number} px
 */
export const noWider = (sizes, px) => sizesIn(sizes).map((size) => size.replace(/^(\(min-width: [\d.]+rem\) )?(.+)$/, `$1min($2, ${number(px)}px)`)).join(', ');

/**
 * The sizes of a `sizes`, split at the commas outside any parentheses.
 * @param {string} sizes
 * @returns {string[]}
 */
export function sizesIn(sizes) {
  const all = [''];
  let depth = 0;
  for (const character of String(sizes)) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (character === ',' && depth === 0) all.push('');
    else all[all.length - 1] += character;
  }
  return all.map((one) => one.trim());
}

/**
 * The display width the editor gave a picture, which the core writes into each of its `sizes` as min(…, <n>px), or null.
 * @param {string | undefined} sizes The core's.
 */
export function displayWidthOf(sizes) {
  const found = /,\s*(\d+(?:\.\d+)?)px\)\s*$/.exec(String(sizes ?? ''));
  return found ? Number(found[1]) : null;
}

/**
 * The `sizes` of a picture this package draws, the width its CSS draws it at, in place of the body's the core gives
 * every image in a body (konzilo.md, Images): `band`, behind a band's text, by the hero's `height` where it stands in a
 * hero; `section-photo`, by its `layout`, `cropped`, `badges` or `offered`; `section-body`, a figure in a section's body,
 * by the body's `layout`, `across`, `beside`, `corners`, `narrow` or `form`; `figure`, a figure a part passes through,
 * by the parts it stands `within`; `series`, a card's picture, by its series' `count`, whether it stands `behind` the
 * text, the parts it stands `within`, and `list` for a post list's teaser; `hero`, a hero's picture beside its text, by
 * its `side` and the hero's `height`; `hero-logo` and `badge`, by the picture's `ratio` and, for a logo, whether the hero
 * has a picture at its `side`; `logo`, in a list of logos, by its `ratio`; and `symbol`, a card's, by its `layout`, `item`
 * or `heading`. A picture the CSS crops to cover its box says how wide its `ratio` makes it there, which it requires:
 * `band` in a hero of a height, `section-photo` `cropped`, `series` and `hero`. A picture with a display width says each
 * size no wider where the CSS draws it no wider than its own width.
 * @param {object} r A design file's `resolved`.
 * @param {string} picture
 * @param {{ layout?: string, side?: string, ratio?: number, height?: string, count?: number, behind?: boolean,
 *   list?: boolean, within?: (string | { series: number })[], display?: number | null }} [options] `ratio` its width
 *   over its height, required where the CSS crops the picture, and where it shows it whole and it is not known, the
 *   widest the CSS allows; `display` the editor's display width in px.
 * @returns {string}
 */
export function pictureSizes(r, picture, { display = null, ...options } = {}) {
  const { drawn, capped = false } = pictureDrawing(r, picture, options);
  const sizes = sizesOf(drawn);
  return capped && display ? noWider(sizes, display) : sizes;
}

/**
 * The sizes of the width the design draws a picture at, as an image's attributes, in place of the body's the core gives
 * every image in a body (konzilo.md, Images): pictureSizes() with the picture's proportions from its width and height,
 * and its display width from the core's sizes, which writes both on every raster image it makes. Nothing for a picture
 * with no versions, such as an SVG, which the core keeps as it is, and which keeps what it wrote.
 * @param {Record<string, string> | undefined} image The image's attributes, as the directives' renderers read them.
 * @param {object} r A design file's `resolved`. @param {string} picture @param {object} [options] As pictureSizes()'s.
 * @returns {{ sizes?: string }}
 */
export function imageSizes(image, r, picture, options = {}) {
  const { srcset, sizes, width, height } = image ?? {};
  if (!srcset) return {};
  return { sizes: pictureSizes(r, picture, { ...options, ratio: ratioFrom(width, height), display: displayWidthOf(sizes) }) };
}

/**
 * The `sizes` of a picture behind a band's text, whatever the design: the band's width, the window's, and in a hero of
 * a `height` as wide as its `ratio` makes that share of the window's height where that is wider (konzilo.md, Images).
 * @param {{ height?: string, ratio?: number }} [options] The hero's height, `third`, `half`, `two-thirds` or `full`, none
 *   for a band as tall as its text; the picture's width over its height, which a hero of a height requires.
 * @returns {string}
 */
export const bandPictureSizes = (options) => sizesOf(bandDrawing(options));

/**
 * The proportions of the picture a `Band` or a `Hero` is given versions of, its width over its height, from the width
 * and height it requires with a `srcset` (the owner, 2026-11-26): its sizes follows them where the band is taller than
 * they are. None without a `srcset`.
 * @param {'Band' | 'Hero'} component
 * @param {{ srcset?: string, pictureWidth?: number, pictureHeight?: number }} props
 * @returns {number | undefined}
 */
export function bandPictureRatio(component, { srcset, pictureWidth, pictureHeight }) {
  if (!srcset) return undefined;
  const ratio = ratioFrom(pictureWidth, pictureHeight);
  if (ratio !== undefined) return ratio;
  throw new TypeError(`A ${component} given a srcset requires pictureWidth and pictureHeight, its picture's own width and height, by which it works out the picture's sizes: give them from Astro's getImage(), as image.attributes.width and image.attributes.height`);
}

/**
 * The widths and sizes of a picture that fills an item of a series of `count` items, as a card's picture in `:::cards`,
 * or a post list's teaser: the widest its item is drawn in any place a series stands in, at each window, as wide as its
 * `ratio` makes its crop, and the ladder's steps that cover it from the narrowest window at density 1 to its widest at
 * density 2 (konzilo.md, Images). None where its `ratio` is not given: a picture made through getImage() is a master,
 * whose proportions Astro's import gives, and one that is not is made in no versions and written as given.
 * @param {object} r A design file's `resolved`.
 * @param {number} count The number of items the series draws, at least one.
 * @param {{ list?: boolean, ratio?: number, behind?: boolean, within?: (string | { series: number })[] }} [options]
 *   `list`: a post list's, in the places a post list stands in, which leave out an accordion's.
 * @returns {{ widths: number[], sizes: string } | null}
 */
export function seriesPicture(r, count, options = {}) {
  requireCount(count);
  return isRatio(options.ratio) ? drawnPicture(r, pictureDrawing(r, 'series', { ...options, count }).drawn) : null;
}

/**
 * The widths and sizes of a hero's picture where the design puts it, made through Astro's getImage(), as an article's
 * opening makes its main image: behind its text as the band's, beside it as the hero's, by the design's hero height and
 * the picture's `ratio` (konzilo.md, Images); none where it is not given, as seriesPicture().
 * @param {object} r A design file's `resolved`.
 * @param {{ ratio?: number }} [options]
 * @returns {{ widths: number[], sizes: string } | null}
 */
export function heroPictureOf(r, { ratio } = {}) {
  return isRatio(ratio) ? drawnPicture(r, heroDrawing(r, ratio)) : null;
}

// ---------- A post list's teasers (issue #39; konzilo.md, Images) ----------

// `featured` lays out by its list's own width, by container queries (post-list.css): one column under `two` rem; from
// it two, the latest across both; from `three` rem three, the latest over two; the column gap apart wherever it stands.
export const FEATURED = Object.freeze({ two: 32, three: 50 });
function featuredItem(row, gap, first) {
  const two = first ? row : shareOf(row, gap, 2);
  const three = first ? sum(times(shareOf(row, gap, 3), 2), gap) : shareOf(row, gap, 3);
  return switched(row, fixed(FEATURED.three), three, switched(row, fixed(FEATURED.two), two, row));
}

/**
 * The widths and sizes of each teaser's picture in a post list of `count` posts as the package's post-list presentation
 * `presentation` draws it, the widest it is drawn in any place a post list stands in, as a series' (seriesPicture()): in
 * `cards` and `filtered` an item of a series of `count`, every teaser counted, the ones a filtered list's pills hide too,
 * as the series' rule counts them; but a lone teaser of `cards` fills its column beside a quotation (section.css,
 * body="columns"); and in `featured` the latest post and the others by the list's own columns. Each is cropped to 16:9
 * of its width, so as wide as its picture's proportions, `ratios`, make that; none for a teaser whose picture's are not
 * given, as seriesPicture(). Where the list's `place` is known, as a section knows its body's (issue #44), each says
 * the width it is drawn at there: a lone teaser of `cards` fills its column only in `columns`.
 * @param {object} r A design file's `resolved`.
 * @param {'cards' | 'featured' | 'filtered'} presentation
 * @param {number} count The number of posts the list draws.
 * @param {(number | undefined)[]} [ratios] Each teaser's picture's width over its height.
 * @param {{ place?: string }} [options] Where the list stands, one of SERIES_ROWS but `head`, as seriesPicture() takes it.
 * @returns {({ widths: number[], sizes: string } | null)[]} One for each teaser, in order.
 */
export function teaserPictures(r, presentation, count, ratios = [], { place } = {}) {
  if (count < 1) return [];
  const { columnGap } = measures(r);
  const crop = (drawn, at) => (isRatio(ratios[at]) ? drawnPicture(r, times(drawn, Math.max(1, ratios[at] * CARD.box))) : null);
  if (presentation === 'featured') {
    const rows = (place === undefined ? seriesPlaces(r, { list: true }) : [place]).map((one) => rowAndGap(r, one)[0]);
    const [first, other] = [true, false].map((latest) => greatest(...rows.map((row) => featuredItem(row, columnGap, latest))));
    return Array.from({ length: count }, (_, at) => crop(at === 0 ? first : other, at));
  }
  if (!['cards', 'filtered'].includes(presentation)) throw new Error(`the package has no post-list presentation ${presentation}`);
  const drawn = teaserDrawn(r, presentation, count, place);
  return Array.from({ length: count }, (_, at) => crop(drawn, at));
}
// How wide a teaser of `cards` or `filtered` is drawn: as an item of its series, but a lone teaser of `cards`, which fills
// a column of a body in two, in that place, and where its place is not known, the wider of the two.
function teaserDrawn(r, presentation, count, place) {
  const series = seriesDrawn(r, count, { list: true, place });
  if (presentation !== 'cards' || count !== 1) return series;
  const [column] = rowAndGap(r, 'columns');
  if (place === undefined) return greatest(series, column);
  return place === 'columns' ? column : series;
}

// ---------- In the presentation ----------

// A ratio a picture the Details page lists has where its sizes follows its proportions: a camera's 3:2.
const SHOWN_RATIO = 3 / 2;

// The numbers of cards or posts from one to eight, those whose pictures have the same sizes and widths together, each
// { counts, ...picture(count) } in order of their first number; those for which `skip(count, picture)` holds left out.
function byCounts(picture, skip = () => false) {
  const found = new Map();
  for (let count = 1; count <= 8; count++) {
    const made = picture(count);
    if (skip(count, made)) continue;
    const key = `${made.sizes} ${made.widths ?? ''}`;
    found.set(key, { ...made, counts: [...(found.get(key)?.counts ?? []), count] });
  }
  return [...found.values()];
}

/**
 * Every sizes a resolved design writes on a picture its parts draw from a body, for the presentation's Details page
 * (tool.md, Pictures at the right size): a card's picture across a band by the number of cards, from one to eight, those
 * of the same sizes together, and so behind its text (its other places are placeRows()'); a section's photo and a figure
 * in its body by the section's layout, corner to corner where the design sets its pictures so; a hero's picture behind
 * its text or beside it, where the design puts it; and a logo, a badge and a symbol at their widest, a narrower one by
 * its proportions. A picture the CSS crops to cover its box says how wide a picture of 3:2 is drawn there.
 * @param {object} r A design file's `resolved`.
 * @returns {{ key: string, picture: string, layout?: string, counts?: number[], sizes: string }[]}
 */
export function bodyPictures(r) {
  const row = (picture, layout, options = {}) => ({ key: layout ? `${picture}-${layout}` : picture, picture, layout, sizes: pictureSizes(r, picture, { layout, ratio: SHOWN_RATIO, ...options }) });
  const series = (behind) => byCounts((count) => ({ sizes: pictureSizes(r, 'series', { count, behind, ratio: SHOWN_RATIO, place: 'across' }) }))
    .map(({ counts, sizes }) => ({ key: `series${behind ? '-behind' : ''}-${counts.join('-')}`, picture: behind ? 'series-behind' : 'series', counts, sizes }));
  const { picture: place = 'behind', height } = r.hero ?? {};
  return [
    ...series(false),
    ...series(true),
    ...SECTION_LAYOUTS.photo.map((layout) => row('section-photo', layout)),
    ...SECTION_LAYOUTS.body.filter((layout) => layout !== 'corners' || cornerToCorner(r)).map((layout) => row('section-body', layout)),
    place === 'behind' ? row('band', undefined, { height }) : row('hero', undefined, { side: place === 'none' ? 'end' : place, height }),
    row('hero-logo', undefined, { ratio: undefined }), row('badge', undefined, { ratio: undefined }), row('logo', undefined, { ratio: undefined }),
    row('symbol', 'item', { ratio: undefined }), row('symbol', 'heading', { ratio: undefined }),
  ];
}

// The places besides across a band a series may stand in, as the Details page lists them (seriesPlaces()), and none,
// where no part says.
const otherPlaces = (r) => [...seriesPlaces(r).filter((place) => place !== 'across'), undefined];
// A place's name for the Details page's HTML: its row, `accordion-<row>`, with `-questions` for one of questions, for an
// accordion standing there, and `unknown` where no part says.
function placeKey(place) {
  if (place === undefined) return 'unknown';
  return place.accordion ? `accordion-${place.accordion}${place.questions ? '-questions' : ''}` : place;
}

/**
 * What a resolved design writes on a card's or a teaser's picture in each place besides across a band, where it differs
 * from across a band, for the presentation's Details page (tool.md, Pictures at the right size; the assistant's choice,
 * 2026-11-26, issue #44): a row for each place where anything differs, `place` the place, as seriesPicture() takes it,
 * none where no part says where a series stands, and `key` its name in the page's HTML, `accordion-<row>`, with
 * `-questions` for one of questions, for an accordion standing there, and `unknown` where no part says; its `entries` a
 * card's picture by its number of cards, from one to eight, those of one sizes together, which a
 * teaser in `cards` and `filtered` takes too, and where a list may stand, `featured`'s latest post and the others; and
 * where no part says, a list's teasers by their number, which differ there from a card's. Each for a photo of 3:2.
 * @param {object} r A design file's `resolved`.
 * @returns {{ key: string, place?: string | object, entries: { key: string, picture: string, counts?: number[], sizes: string }[] }[]}
 */
export function placeRows(r) {
  const card = (count, place) => pictureSizes(r, 'series', { count, ratio: SHOWN_RATIO, place });
  const teasers = (presentation, count, place) => teaserPictures(r, presentation, count, Array(count).fill(SHOWN_RATIO), { place });
  return otherPlaces(r).map((place) => {
    const entries = byCounts((count) => ({ sizes: card(count, place) }), (count, made) => made.sizes === card(count, 'across'))
      .map(({ counts, sizes }) => ({ key: `series-${counts.join('-')}`, picture: 'series', counts, sizes }));
    if (place === undefined) {
      entries.push(...byCounts((count) => ({ sizes: teasers('filtered', count)[0].sizes }), (count, made) => made.sizes === card(count, place))
        .map(({ counts, sizes }) => ({ key: `teaser-${counts.join('-')}`, picture: 'teaser', counts, sizes })));
    }
    if (!place?.accordion) {
      const [across, here] = [teasers('featured', 2, 'across'), teasers('featured', 2, place)];
      ['featured-first', 'featured-other'].forEach((picture, at) => {
        if (here[at].sizes !== across[at].sizes) entries.push({ key: picture, picture, sizes: here[at].sizes });
      });
    }
    return { key: placeKey(place), place, entries };
  }).filter(({ entries }) => entries.length > 0);
}

/**
 * Every teaser's picture a resolved design makes in its post-list presentations, its widths and its sizes, for the
 * presentation's Details page (tool.md, Pictures at the right size): in `cards` and `filtered` by the number of posts,
 * from one to eight, those of the same sizes together, and the latest post of `featured` and another, across a band; and
 * a lone teaser of `cards` beside a quotation, where it fills its column. Each is made in the widths of the widest place
 * a list may stand in, which a presentation cannot know, and the section around it writes its sizes there (issue #44);
 * the other places are placeRows()'. Each for a photo of 3:2, which its 16:9 crop draws as wide as its card.
 * @param {object} r A design file's `resolved`.
 * @returns {{ key: string, picture: string, counts?: number[], widths: number[], sizes: string }[]}
 */
export function teaserRows(r) {
  // Each teaser's picture with the sizes of `place` and the widths of the widest place, in which the presentation makes it.
  const inPlace = (presentation, count, place) => {
    const photos = Array(count).fill(SHOWN_RATIO);
    const widest = teaserPictures(r, presentation, count, photos);
    return teaserPictures(r, presentation, count, photos, { place }).map(({ sizes }, at) => ({ widths: widest[at].widths, sizes }));
  };
  const rows = byCounts((count) => inPlace('filtered', count, 'across')[0]).map(({ counts, widths, sizes }) => ({ key: `teaser-${counts.join('-')}`, picture: 'teaser', counts, widths, sizes }));
  const [first, other] = inPlace('featured', 2, 'across');
  rows.push({ key: 'teaser-lone', picture: 'teaser-lone', ...inPlace('cards', 1, 'columns')[0] }, { key: 'featured-first', picture: 'featured-first', ...first }, { key: 'featured-other', picture: 'featured-other', ...other });
  return rows;
}
