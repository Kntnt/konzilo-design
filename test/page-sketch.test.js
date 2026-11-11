// The page's layout sketch (presentation/src/page-sketch.js) draws the design's own widths, as the CSS gives them, and
// follows them when they change: the report draws it once and the design tool at every change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { derive, defaultInputs, readingColumnWindows } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { pageWidths, readingBoxes, pageSketch, SKETCH_WINDOWS } from '../presentation/src/page-sketch.js';

const copy = JSON.parse(await readFile('presentation/copy.json', 'utf8'));
const words = {
  t: (key, values = {}) => copy[key].replace(/\{([\w-]+)\}/g, (_, name) => values[name]),
  num: (value) => String(Math.round(value)),
};
const design = (layout) => derive({ ...defaultInputs(), layout });
const close = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 0.01, `${what}: ${actual} is not ${expected}`);
// What the drawing says each figure is, by its window and name.
const figures = (markup) => Object.fromEntries([...markup.matchAll(/data-sketch="(\w+)"|data-figure="([\w-]+)">([^<]*)</g)]
  .reduce((found, [, kind, name, text]) => {
    if (kind) found.kind = kind;
    else found.list.push([`${name === 'columns' ? '' : `${found.kind} `}${name}`, text]);
    return found;
  }, { kind: '', list: [] }).list);

test('the sketch draws a wide window and a phone, with the default design\'s widths in each', () => {
  assert.deepEqual(SKETCH_WINDOWS, [['wide', 1440], ['phone', 390]]);
  const resolved = design({ wide: 1200, narrow: 720 });
  const wide = pageWidths(resolved, 1440);
  close(wide.margin, 48, 'the side margin at its widest');
  close(wide.content, 1200, 'the content width');
  close(wide.inset, 120, 'the room on each side');
  assert.equal(wide.columns, 2);
  close(wide.narrow, 720, 'the reading width');
  close(wide.aside, 1200 - 720 - wide.gap, 'the Aside, the rest less the gap');
  const phone = pageWidths(resolved, 390);
  close(phone.margin, (0.4286 + 0.028571 * 390 / 16) * 16, 'the side margin of a phone');
  close(phone.content, 390 - 2 * phone.margin, 'the window less two side margins');
  assert.equal(phone.columns, 1);
  close(phone.narrow, phone.content, 'text as wide as the content');
  close(phone.aside, phone.content, 'the Aside above the text, as wide as the content');
  // The switch to two columns is where the CSS emitter's media query puts it.
  const [{ from }] = readingColumnWindows(resolved.layout, resolved.space.roles['column-gap']);
  assert.ok(coreCss(resolved).includes(`(width >= ${from}rem)`));
  assert.equal(wide.twoFrom, Math.ceil(from * 16));
  assert.equal(wide.twoFrom, 1066);
});

test('Narrow stands against the edge opposite the Aside, or centred without one, and the Aside above it in one column', () => {
  const resolved = design({ wide: 1200, narrow: 720 });
  const wide = pageWidths(resolved, 1440);
  assert.deepEqual(readingBoxes(wide, 'end'), { narrow: [120, 720], aside: [120 + 720 + wide.gap, wide.aside] });
  assert.deepEqual(readingBoxes(wide, 'start'), { aside: [120, wide.aside], narrow: [120 + wide.aside + wide.gap, 720] });
  assert.deepEqual(readingBoxes(wide, 'none'), { narrow: [120 + 240, 720] });
  const phone = pageWidths(resolved, 390);
  for (const side of ['end', 'start']) assert.deepEqual(readingBoxes(phone, side), { aside: [phone.inset, phone.content], narrow: [phone.inset, phone.content] });
  assert.deepEqual(readingBoxes(phone, 'none'), { narrow: [phone.inset, phone.content] });
});

test('the sketch\'s figures and widths follow the content width and the reading width', () => {
  const before = pageSketch(design({ wide: 1200, narrow: 720 }), words);
  const gap = pageWidths(design({ wide: 1200, narrow: 720 }), 1440).gap;
  assert.deepEqual(figures(before), {
    'wide window': '1440 px',
    'wide content': 'Content width · 1200 px',
    'wide narrow': 'Reading width · 720 px',
    'wide aside': `Aside · ${Math.round(1200 - 720 - gap)} px`,
    'wide aside-min': '≥ 224 px',
    'wide margin': 'Side margin · 48 px',
    'phone window': '390 px',
    'phone content': 'Content width · 354 px',
    'phone narrow': 'Reading width · 354 px',
    'phone aside': 'Aside · 354 px',
    'phone margin': 'Side margin · 18 px',
    columns: 'Text and Aside side by side from a window of 1066 px',
  });
  // The content width's edges stand at its share of the window.
  assert.match(before, /class="page-sketch-guide" style="--x: 8\.3333%; --w: 0%"/);
  assert.match(before, /class="page-sketch-guide" style="--x: 91\.6667%; --w: 0%"/);
  const after = figures(pageSketch(design({ wide: 1000, narrow: 600 }), words));
  assert.equal(after['wide content'], 'Content width · 1000 px');
  assert.equal(after['wide narrow'], 'Reading width · 600 px');
  assert.equal(after['wide aside'], `Aside · ${Math.round(1000 - 600 - gap)} px`);
  assert.notEqual(after.columns, figures(before).columns);
  assert.match(pageSketch(design({ wide: 1000, narrow: 600 }), words), /class="page-sketch-guide" style="--x: 15\.2778%; --w: 0%"/);
  // A content width wider than the window less its margins is drawn as wide as the window allows.
  assert.equal(figures(pageSketch(design({ wide: 1800, narrow: 720 }), words))['wide content'], 'Content width · 1344 px');
});

test('where the content width leaves no room for the Aside, the sketch shows one column in every window', () => {
  const resolved = design({ wide: 900, narrow: 720 });
  const wide = pageWidths(resolved, 1440);
  assert.equal(wide.columns, 1);
  assert.equal(wide.twoFrom, null);
  assert.deepEqual(readingBoxes(wide, 'end'), { aside: [270, 900], narrow: [270, 720] });
  const shown = figures(pageSketch(resolved, words));
  assert.equal(shown.columns, '');
  assert.equal(shown['wide aside'], 'Aside · 900 px');
  assert.equal(shown['wide aside-min'], undefined);
});
