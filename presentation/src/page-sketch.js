// The page's layout drawn to scale from the design (docs/spec/page.md): the window, the side margin, the content width
// that the header's, the footer's and every band's content align to, bands whose backgrounds run edge to edge, and the
// Reading Area's three placements: the Aside on the right (`end`), on the left (`start`), and Narrow centred without
// one (`none`). Widths are the design's, heights only a diagram. The report draws it once and the design tool at every
// change, from this one markup and page-sketch.css.
import { fluidLine, readingColumnWindows } from '../../src/generator/layout.js';

// The windows drawn: the tool's desktop end, and the report's Phone.
export const SKETCH_WINDOWS = [['wide', 1440], ['phone', 390]];

// The widths in a window `width` px wide, in px at the default text size, as the CSS gives them.
export function pageWidths(resolved, width) {
  const { layout } = resolved;
  const columnGap = resolved.space.roles['column-gap'];
  const at = (css) => fluidLine(css).at(width / 16) * 16;
  const margin = at(layout['side-margin'].css);
  const content = Math.min(width - 2 * margin, layout.wide);
  const gap = at(columnGap.css);
  const windows = readingColumnWindows(layout, columnGap);
  const two = windows.some(({ from, to }) => width / 16 >= from && (to === null || width / 16 < to));
  const narrow = two ? layout.narrow : Math.min(content, layout.narrow);
  return {
    width,
    margin,
    content,
    inset: (width - content) / 2,
    gap,
    columns: two ? 2 : 1,
    narrow,
    // In one column the Aside's blocks stand before or after the text, as wide as the content.
    aside: two ? content - layout.narrow - gap : content,
    asideMin: layout['aside-min'],
    // The first whole window with two columns, or none where the content width never leaves room for them.
    twoFrom: windows.length ? Math.ceil(windows[0].from * 16) : null,
  };
}

// Where Narrow and the Aside stand in a window, as [start, width] in px from the window's left edge.
export function readingBoxes(widths, side) {
  const { inset, content, narrow, gap, aside, columns } = widths;
  if (side === 'none') return { narrow: [inset + (content - narrow) / 2, narrow] };
  if (columns === 1) return { aside: [inset, content], narrow: [inset, narrow] };
  return side === 'end'
    ? { narrow: [inset, narrow], aside: [inset + narrow + gap, aside] }
    : { aside: [inset, aside], narrow: [inset + aside + gap, narrow] };
}

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const share = (part, whole) => `${Number((part / whole * 100).toFixed(4))}%`;

// The drawing's markup. `t(key, values)` gives the document's words and `num` its figures, so the report and the tool
// each speak as they do elsewhere.
export function pageSketch(resolved, { t, num }) {
  const px = (value) => t('value.px', { value: num(value) });
  const drawings = SKETCH_WINDOWS.map(([kind, width]) => {
    const w = pageWidths(resolved, width);
    const at = (start, size) => `style="--x: ${share(start, width)}; --w: ${share(size, width)}"`;
    const box = (part, [start, size], label = '') => `<span class="page-sketch-box" data-part="${part}" ${at(start, size)}>${label}</span>`;
    const figure = (name, text) => `<span data-figure="${name}">${escape(text)}</span>`;
    const end = w.inset + w.content;
    const phone = kind === 'phone';
    const header = `<div class="page-sketch-row" data-row="header">
      ${box('identity', [w.inset, w.content * (phone ? 0.34 : 0.16)])}
      ${box('items', [end - w.content * (phone ? 0.12 : 0.4), w.content * (phone ? 0.12 : 0.4)])}
      <span class="page-sketch-name">${escape(t('header.title'))}</span>
    </div>`;
    const band = (side, name, fill) => {
      const boxes = readingBoxes(w, side);
      const aside = boxes.aside && box('aside', boxes.aside, `${figure('aside', `${t('page.aside')} · ${px(w.aside)}`)}${w.columns === 2 ? figure('aside-min', `≥ ${px(w.asideMin)}`) : ''}`);
      return `<div class="page-sketch-row" data-row="band" data-side="${side}"${fill ? ' data-fill' : ''}>
        <span class="page-sketch-eyebrow" style="--x: ${share(w.inset, width)}">${escape(t(name))}</span>
        ${box('narrow', boxes.narrow, figure('narrow', `${t('page.reading-width')} · ${px(w.narrow)}`))}${aside || ''}
      </div>`;
    };
    // The footer's columns are a third and two thirds of the content, parted by the column gap (footer.md); on a phone
    // they stand one above the other.
    const third = (w.content - w.gap) / 3;
    const footer = `<div class="page-sketch-row" data-row="footer">
      <span class="page-sketch-eyebrow" style="--x: ${share(w.inset, width)}">${escape(t('footer.title'))}</span>
      ${phone ? box('cell-a', [w.inset, w.content]) + box('cell-b', [w.inset, w.content]) : box('cell-a', [w.inset, third]) + box('cell-b', [end - 2 * third, 2 * third])}
    </div>`;
    return `<div class="page-sketch-drawing" data-sketch="${kind}" data-columns="${w.columns}">
      <p class="page-sketch-title">${escape(t(phone ? 'window.phone' : 'window.wide'))}</p>
      <div class="page-sketch-dim" ${at(0, width)}>${figure('window', px(width))}</div>
      <div class="page-sketch-dim" ${at(w.inset, w.content)}>${figure('content', `${t('page.content-width')} · ${px(w.content)}`)}</div>
      <div class="page-sketch-window">
        ${header}
        ${band('end', 'page.aside-end')}
        ${band('start', 'page.aside-start', true)}
        ${band('none', 'page.aside-none')}
        ${footer}
        <i class="page-sketch-margin" data-edge="start" ${at(0, w.margin)}></i><i class="page-sketch-margin" data-edge="end" ${at(width - w.margin, w.margin)}></i>
        <i class="page-sketch-guide" ${at(w.inset, 0)}></i><i class="page-sketch-guide" ${at(end, 0)}></i>
      </div>
      <div class="page-sketch-dim" data-kind="margin" ${at(0, w.margin)}>${figure('margin', `${t('page.side-margin')} · ${px(w.margin)}`)}</div>
    </div>`;
  }).join('');
  const { twoFrom } = pageWidths(resolved, SKETCH_WINDOWS[0][1]);
  return `<div class="page-sketch-pair">${drawings}</div>
    <p class="page-sketch-columns" data-figure="columns">${twoFrom === null ? '' : escape(t('page.columns', { from: px(twoFrom) }))}</p>`;
}
