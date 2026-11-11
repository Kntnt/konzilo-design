// Where a Reading Area has room for two columns (docs/spec/page.md, The Reading Area, point 4).
//
// It has two where Narrow, the column gap and the Aside's minimum fit in the content area,
// min(window − 2 × side margin, Wide). The side margin and the column gap are fluid, each a clamp of
// the window, so every value is known when the CSS is written. Each clamp is a rem length plus a share
// of the window, held between two rem lengths; scaling the window and the text size alike scales every
// term alike, so the answer, in rem, holds at every text size, as a media query in rem does.

const CLAMP = /^clamp\((-?[\d.]+)rem, (-?[\d.]+)rem ([+-]) ([\d.]+)vw, (-?[\d.]+)rem\)$/;

// A fluid value as the CSS writes it, read back so the arithmetic uses the very numbers the browser
// gets. Returns its value in rem at a window `w` rem wide, and the windows where it reaches its limits.
export function fluidLine(css) {
  const match = CLAMP.exec(css);
  if (!match) throw new Error(`not a fluid clamp: ${css}`);
  const [low, intercept, sign, share, high] = [match[1], match[2], match[3], match[4], match[5]];
  // `share` vw of a window w rem wide is share / 100 × w rem.
  const slope = (sign === '-' ? -1 : 1) * Number(share) / 100;
  const line = { low: Number(low), high: Number(high), intercept: Number(intercept), slope };
  const at = (w) => Math.min(line.high, Math.max(line.low, line.intercept + slope * w));
  const limits = slope === 0 ? [] : [(line.low - line.intercept) / slope, (line.high - line.intercept) / slope];
  return { ...line, at, limits };
}

const round = (x, toward) => Math[toward](x * 1e4) / 1e4;

// The windows, in rem, at which two columns fit: a list of { from, to }, `to` null where it holds for
// every wider window. Usually one, from a width on; none where Wide is too narrow for them ever; a
// window bounded above only where the column gap grows past what Wide leaves room for.
export function readingColumnWindows(layout, columnGap) {
  const margin = fluidLine(layout['side-margin'].css);
  const gap = fluidLine(columnGap.css);
  const wide = layout.wide / 16, need = (layout.narrow + layout['aside-min']) / 16;
  const content = (w) => Math.min(w - 2 * margin.at(w), wide);
  const room = (w) => content(w) - gap.at(w) - need;
  // Between these the room is a straight line, apart from where the content area reaches Wide, found
  // below; past the last the content area is Wide and the gap constant, so the room is constant.
  const ends = [0, ...margin.limits, ...gap.limits].filter((w) => w >= 0).sort((a, b) => a - b);
  const last = ends.at(-1) + 2 * wide + 1;
  ends.push(last);
  const points = new Set(ends);
  for (let i = 0; i < ends.length - 1; i++) {
    const [a, b] = [ends[i], ends[i + 1]];
    // w − 2m(w) is straight on [a, b]; where it crosses Wide the room bends.
    const [ya, yb] = [a - 2 * margin.at(a), b - 2 * margin.at(b)];
    if ((ya - wide) * (yb - wide) < 0) points.add(a + (wide - ya) * (b - a) / (yb - ya));
  }
  const xs = [...points].sort((a, b) => a - b);
  const windows = [];
  let from = room(xs[0]) >= 0 ? xs[0] : null;
  for (let i = 0; i < xs.length - 1; i++) {
    const [a, b] = [xs[i], xs[i + 1]];
    const [ra, rb] = [room(a), room(b)];
    if ((ra < 0) === (rb < 0)) continue;
    const cross = a + (0 - ra) * (b - a) / (rb - ra);
    if (ra < 0) from = cross;
    else { windows.push({ from: round(from, 'ceil'), to: round(cross, 'floor') }); from = null; }
  }
  if (from !== null) windows.push({ from: round(from, 'ceil'), to: null });
  return windows;
}

// The media query of each window, in rem.
export const readingColumnQueries = (windows) => windows.map(({ from, to }) => `(width >= ${from}rem)${to === null ? '' : ` and (width < ${to}rem)`}`);
