// DESIGN.md's section on figures (issue #34): how a figure with text in it, such as a diagram, a graph or a screenshot,
// is drawn for this design. A page shows an image in running text at its own size, never larger, and at most as wide as
// the column, so a figure looks right only when it was drawn for that column. Every number comes from the resolved design.
// It is a subsection of Layout, after where running text stands, since the format's own sections are fixed and a figure
// is drawn for that column (tool.md, point 4).
import { faceOf } from '../fonts/catalog.js';
import { contrast } from '../generator/color.js';
import { fluidLine } from '../generator/layout.js';
import { number, rem } from '../generator/fluid.js';

// No text in the design is smaller (src/generator/type.js), so no label should show smaller either.
const LEAST_TEXT = 12;
// The window the tool shows a phone in. A design whose type scale starts wider is still read on a phone, and there the
// column is narrower than at its first breakpoint (the assistant's choice, 2026-11-25).
const PHONE = 390;

const px = (value) => `${number(value, 1)} px`;
const sized = (value) => `${px(value)} (${rem(value)})`;
// A label size that must not show smaller than it should, rounded up to a tenth of a pixel.
const up = (value) => Math.ceil(value * 10 - 1e-9) / 10;
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

function measures(r) {
  const narrow = r.layout.narrow;
  const first = r['type-scale'].breakpoints.min;
  const phone = Math.min(first, PHONE);
  // The side margin as the CSS writes it, read back, so the column is the one the browser lays out.
  const margin = fluidLine(r.layout['side-margin'].css).at(phone / 16) * 16;
  const column = Math.round(Math.min(phone - 2 * margin, r.layout.wide, narrow));
  const body = r.type.body.size, small = r.type.small.size;
  // The widest figure whose secondary labels, at the small size, still show at the least text size on a phone.
  const legible = Math.min(narrow, Math.floor(column * small.max / LEAST_TEXT));
  return { narrow, first, phone, column, body, small, legible };
}

function widthWords({ narrow }) {
  return `- **Width:** at most Narrow, ${sized(narrow)}, the widest the column is. Draw a figure at that width or narrower: it is never enlarged, so one drawn narrower keeps its size on a wide screen.`;
}

function phoneWords({ narrow, first, phone, column }) {
  const where = phone === first ? `a ${px(phone)} window, the design's smallest, where its type scale starts` : `a ${px(phone)} window, a phone's, narrower than the type scale's first breakpoint at ${px(first)}`;
  return `- **On a phone:** in ${where}, the column is ${sized(column)} wide, so a wider figure shrinks to fit it: one drawn at Narrow to ${Math.round(column / narrow * 100)}% of its size. No text in this design is smaller than ${sized(LEAST_TEXT)}, and no label should show smaller there: in a figure drawn at Narrow the smallest label is ${px(up(LEAST_TEXT * narrow / column))}, and in one W px wide, ${LEAST_TEXT} × W / ${column} px.`;
}

function labelWords({ narrow, column, body, small, legible }) {
  const sizes = `main labels at the body size, ${px(body.max)}, and secondary ones, such as an axis's values or a note, at the small size, ${px(small.max)}`;
  const onPhone = `where the text is ${px(body.min)}, a main label shows at ${px(body.max * column / legible)} and a secondary one at ${px(small.max * column / legible)}`;
  const wider = legible < narrow
    ? ` So draw a figure with text at most ${px(legible)} wide where it can be. One that needs more room, up to Narrow, takes labels larger by its width over ${px(legible)}: at Narrow, main labels at ${px(up(body.max * narrow / legible))} and secondary ones at ${px(up(small.max * narrow / legible))}, which stand larger than the text beside them on a wide screen.`
    : ' So a figure up to Narrow keeps these sizes.';
  return `- **Labels:** in the figure's own pixels at its full width, ${sizes}, the sizes of the text and the captions beside a figure on a wide screen. They stay legible on a phone in a figure at most ${sized(legible)} wide: there, ${onPhone}.${wider}`;
}

// A typeface by its family, saying so where it is the system's own, which has no file to outline from but the system's.
function faceWords(stack) {
  const family = stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
  return faceOf(family) ? family : `${family} (the system's own)`;
}

function typefaceWords(r) {
  return `- **Typeface:** labels in the main typeface, ${faceWords(r.typefaces.main)}, at weight ${r.type.body.weight}, and at ${r.type['heading-6'].weight}, the emphasis weight, for a title or a name that must stand out; code and values in the monospace, ${faceWords(r.typefaces.monospace)}, at weight ${r.type.mono.weight} and the size of the label they stand in.`;
}

// A figure is an image, which cannot know the page's mode: so it stands on a light plate of its own, or keeps to the
// colours that hold on the page in both modes, lines and marks at 3:1 and text at 4.5:1, as the roles are checked.
const ratio = (value) => `${(Math.floor(value * 10) / 10).toFixed(1)}:1`;
function colourWords(r) {
  const light = r.surfaces.page.light.roles;
  const pages = [light.background, r.surfaces.page.dark.roles.background];
  const role = (name) => `\`${name}\` ${light[name]}`;
  const steps = Object.entries(r.ramps).flatMap(([ramp, values]) => Object.entries(values).map(([step, hex]) => ({ name: `${ramp}-${step}`, hex, on: pages.map((page) => contrast(hex, page)) })));
  const holding = steps.filter(({ on }) => Math.min(...on) >= 3);
  const nearest = steps.reduce((best, step) => (Math.min(...step.on) > Math.min(...best.on) ? step : best));
  const fills = holding.filter(({ hex }) => contrast(light.background, hex) >= 4.5);
  const plate = `its whole background in the \`page\` Surface's light ${role('background')}, and every colour from that Surface's light roles: ${role('text')} for labels, ${role('text-muted')} for quieter ones, ${role('border')} for lines that part things and ${role('border-strong')} for what must be seen, such as an axis or an arrow, ${role('background-alt')} for a quiet fill such as a box, the primary as ${role('button-background')} for a strong fill with ${role('button-text')} on it, and ${role('accent')} for a mark that must stand out. On a light page it does not show; on a dark one it stands as a light panel.`;
  const held = `with no background of its own, so the page shows through in either mode, and every line, mark and fill in a step with at least 3:1 against both page backgrounds, ${pages[0]} and ${pages[1]}: ${list(holding.map(({ name, hex }) => `\`${name}\` ${hex}`))}. No colour has 4.5:1 against both, which text needs: the nearest, \`${nearest.name}\` ${nearest.hex}, has ${ratio(nearest.on[0])} and ${ratio(nearest.on[1])}. So text stands on a fill of its own, in ${light.background}, on a step that gives it 4.5:1: ${list(fills.map(({ name }) => `\`${name}\``))}.`;
  return `- **Colours:** a figure does not follow dark mode, since an image cannot know the page's mode. Draw it in one of two ways:
  - **On a light plate of its own:** ${plate}
  - **In colours that hold in both modes:** ${held}`;
}

// An SVG shown as an image loads nothing outside itself, and the Konzilo core's check of an SVG lets it hold nothing at a
// `data:` address but a still picture (its src/intake/svg.js), so a font cannot travel inside one either.
const OUTLINES = '- **Text in an SVG is outlines.** An SVG shown as an image loads nothing from outside itself, so it cannot use the site\'s fonts, and its text falls back on whatever the visitor\'s system has. Embedding the font is no way round it: a Konzilo site refuses an SVG with a font embedded in it, since the only thing it lets an SVG hold at a `data:` address is a still image, and a font adds its weight to every figure. So convert every label to outlines (paths) in the typefaces above, keep a copy with live text to edit, and give the image an alternative text that says what the figure shows, its words included.';

function fileWords({ legible }) {
  return `- **File:** SVG for diagrams and graphs, with its own \`width\` and \`height\`, the size it is drawn at, and a \`viewBox\` of the same numbers, such as \`width="${legible}" height="240" viewBox="0 0 ${legible} 240"\`: an SVG with only a \`viewBox\` has no size of its own and is stretched to the column, labels and all. A raster figure, such as a screenshot, is saved at the size it is shown, since a page shows an image at its own pixel size: one saved twice as large shows twice as large, up to the column.`;
}

export function figureSection({ resolved: r }) {
  const m = measures(r);
  return `### Figures

A figure with text in it, such as a diagram, a graph or a screenshot, stands in running text as an image. Show it at its own size, never larger, and at most as wide as the column: it looks right only where it was drawn for that column. Every number here is this design's.

${[widthWords(m), phoneWords(m), labelWords(m), typefaceWords(r), colourWords(r), OUTLINES, fileWords(m)].join('\n')}`;
}
