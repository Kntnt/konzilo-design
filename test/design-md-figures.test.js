// DESIGN.md's section on figures (issue #34): how a figure with text in it is drawn for this design, so that a person or
// an agent need not guess. Every number in it is the design's own, so these compare it with the resolved design, for the
// default design and for others, and draw a sample figure by it in a browser.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { designMd } from '../src/design-md/index.js';
import { decodePng, inkBounds } from './helpers/ink.js';

// Made-up designs: three colours, a serif, its own monospace, a narrower Narrow and a type scale that starts at 360 px;
// and one whose type scale has a single breakpoint, wider than any phone.
const SERIF = { 'brand-colors': { primary: '#8a3ffc', secondary: '#d4622b', tertiary: '#2b8ad4' }, typefaces: { main: 'Source Serif 4', heading: 'Inter', monospace: 'JetBrains Mono' }, layout: { narrow: 640 }, type: { breakpoints: { min: 360, max: 1280 }, 'body-size': { min: 16, max: 20 } } };
const ONE_STEP = { 'brand-colors': { primary: '#b8860b' }, type: { breakpoints: { min: 800, max: 800 } } };

const exported = (inputs) => {
  const resolved = derive(inputs);
  const text = designMd({ inputs: withDefaults(inputs), project: { name: 'Example' }, resolved }, 'example.design.json');
  const section = text.match(/\n### Figures\n([\s\S]*?)\n##/)?.[1];
  return { resolved, text, section };
};
// A bullet of the section by its lead, with what is nested under it.
const bullet = (section, lead) => section.match(new RegExp(`^- \\*\\*${lead}:?\\*\\*:? ([\\s\\S]*?)(?=\\n- \\*\\*|\\n\\n|(?![\\s\\S]))`, 'm'))?.[1];

// The format's own sections are fixed, so figures are a subsection of Layout, after where running text stands.
test('DESIGN.md has a section on figures, the last under Layout', () => {
  const { text, section } = exported(defaultInputs());
  assert.ok(section, 'a subsection headed Figures');
  assert.ok(!text.includes('\n## Figures\n'), 'no section of its own');
  assert.ok(text.indexOf('\n### Figures\n') > text.indexOf('**Where running text stands.**'));
  assert.ok(text.indexOf('\n### Figures\n') > text.indexOf('\n## Layout\n'));
  assert.ok(text.indexOf('\n### Figures\n') < text.indexOf('\n## Elevation & Depth\n'));
});

test('the default design\'s figures: Narrow, the column on a phone and the labels that stay legible there', () => {
  const { resolved: r, section } = exported(defaultInputs());
  // Worked by hand: Narrow is 720 px. In a 390 px window, the type scale's first breakpoint, the side margin is
  // 16 + 32 × 70 / 1120 = 18 px, so the column is 390 − 36 = 354 px, and a figure drawn at Narrow shows at 354 / 720,
  // 49%. No text is under 12 px, so its smallest label is 12 × 720 / 354 = 24.41, 24.5 px. Labels at the body size, 19,
  // and the small size, 15, stay legible up to 354 × 15 / 12 = 442.5, 442 px: on a phone 19 × 354 / 442 = 15.2 px and
  // 15 × 354 / 442 = 12 px, by text of 17 px. Wider, they grow by the width over 442: at Narrow 30.95 and 24.43 px.
  assert.equal(r.layout.narrow, 720);
  assert.match(bullet(section, 'Width'), /^at most Narrow, 720 px \(45rem\)/);
  const phone = bullet(section, 'On a phone');
  assert.match(phone, /a 390 px window, the design's smallest/);
  assert.match(phone, /the column is 354 px \(22\.125rem\) wide/);
  assert.match(phone, /one drawn at Narrow to 49% of its size/);
  assert.match(phone, /smaller than 12 px \(0\.75rem\)/);
  assert.match(phone, /in a figure drawn at Narrow the smallest label is 24\.5 px/);
  assert.match(phone, /12 × W \/ 354 px/);
  const labels = bullet(section, 'Labels');
  assert.match(labels, /main labels at the body size, 19 px, and secondary ones[^.]*at the small size, 15 px/);
  assert.match(labels, /in a figure at most 442 px \(27\.625rem\) wide/);
  assert.match(labels, /where the text is 17 px, a main label shows at 15\.2 px and a secondary one at 12 px/);
  assert.match(labels, /at Narrow, main labels at 31 px and secondary ones at 24\.5 px/);
});

test('another design\'s figures follow its own Narrow, smallest window and type sizes', () => {
  const { resolved: r, section } = exported(SERIF);
  // Worked by hand: Narrow 640 px. At 360 px, the first breakpoint, the margin is 16 + 32 × 40 / 1120 = 17.14 px and
  // the column 360 − 34.29 = 325.71, 326 px, 51% of Narrow; the smallest label at Narrow 12 × 640 / 326 = 23.56, 23.6 px.
  // The body is 16 to 20 px and the small size 14 to 16: labels of 20 and 16 px stay legible up to 326 × 16 / 12 =
  // 434.67, 434 px, where a phone shows them at 15 and 12 px by text of 16; at Narrow they are 29.49 and 23.59 px.
  assert.equal(r.layout.narrow, 640);
  assert.deepEqual([r.type.body.size.min, r.type.body.size.max, r.type.small.size.max], [16, 20, 16]);
  assert.match(bullet(section, 'Width'), /^at most Narrow, 640 px \(40rem\)/);
  const phone = bullet(section, 'On a phone');
  assert.match(phone, /a 360 px window, the design's smallest/);
  assert.match(phone, /the column is 326 px \(20\.375rem\) wide/);
  assert.match(phone, /one drawn at Narrow to 51% of its size/);
  assert.match(phone, /the smallest label is 23\.6 px, and in one W px wide, 12 × W \/ 326 px/);
  const labels = bullet(section, 'Labels');
  assert.match(labels, /main labels at the body size, 20 px, and secondary ones[^.]*at the small size, 16 px/);
  assert.match(labels, /in a figure at most 434 px \(27\.125rem\) wide/);
  assert.match(labels, /where the text is 16 px, a main label shows at 15 px and a secondary one at 12 px/);
  assert.match(labels, /at Narrow, main labels at 29\.5 px and secondary ones at 23\.6 px/);
});

test('a design whose type scale starts wider than a phone still sizes its figures for a phone', () => {
  const { section } = exported(ONE_STEP);
  // 390 px is narrower than its breakpoint at 800 px; the column there is 354 px, as in the default design.
  assert.match(bullet(section, 'On a phone'), /in a 390 px window, a phone's, narrower than the type scale's first breakpoint at 800 px, the column is 354 px/);
});

test('a figure\'s labels take the design\'s main typeface and weights, and code and values its monospace', () => {
  for (const [inputs, main, mono] of [[defaultInputs(), 'system-ui', 'ui-monospace'], [SERIF, 'Source Serif 4', 'JetBrains Mono']]) {
    const { resolved: r, section } = exported(inputs);
    assert.ok(r.typefaces.main.startsWith(main) && r.typefaces.monospace.startsWith(mono), 'the design\'s own typefaces');
    const words = bullet(section, 'Typeface');
    assert.ok(words.startsWith(`labels in the main typeface, ${main}`), words);
    assert.ok(words.includes(`at weight ${r.type.body.weight}, and at ${r.type['heading-6'].weight}, the emphasis weight, for a title`), words);
    assert.ok(words.includes(`code and values in the monospace, ${mono}`), words);
    assert.ok(words.includes(`at weight ${r.type.mono.weight} and the size of the label they stand in`), words);
  }
  assert.match(bullet(exported(defaultInputs()).section, 'Typeface'), /^labels in the main typeface, system-ui \(the system's own\), /);
  assert.match(bullet(exported(SERIF).section, 'Typeface'), /^labels in the main typeface, Source Serif 4, /);
});

test('the section says to turn an SVG\'s text into outlines, and why, and how to save a figure', () => {
  const { section } = exported(defaultInputs());
  const outlines = bullet(section, 'Text in an SVG is outlines.');
  assert.match(outlines, /loads nothing from outside itself, so it cannot use the site's fonts/);
  assert.match(outlines, /a Konzilo site refuses an SVG with a font embedded in it, since the only thing it lets an SVG hold at a `data:` address is a still image/);
  assert.match(outlines, /convert every label to outlines/);
  assert.match(outlines, /alternative text/);
  const file = bullet(section, 'File');
  assert.match(file, /^SVG for diagrams and graphs, with its own `width` and `height`/);
  assert.match(file, /`width="442" height="240" viewBox="0 0 442 240"`/, 'an example at the width labels stay legible in');
  assert.match(file, /an SVG with only a `viewBox` has no size of its own and is stretched to the column/);
  assert.match(file, /A raster figure, such as a screenshot, is saved at the size it is shown/);
  assert.match(exported(SERIF).section, /`width="434" height="240" viewBox="0 0 434 240"`/);
});

test('a figure does not follow dark mode:it stands on a light plate of the page\'s roles, or keeps to colours that hold on both pages', () => {
  const PLATE = ['background', 'text', 'text-muted', 'border', 'border-strong', 'button-background', 'button-text', 'accent', 'background-alt'];
  // The steps with at least 3:1 against white and against the dark page's #0d0d0d, and those under white text at 4.5:1,
  // as a contrast checker gives them: #8f8f8f has 3.23:1 on white and 6.01:1 on #0d0d0d, #727272 4.81:1 and 4.04:1. The
  // nearest to text on both is the step whose lower ratio is highest: #168b83, 4.15:1 and 4.68:1, over #727272's 4.04:1.
  const both = {
    default: ['primary-400 #359f97', 'primary-500 #168b83', 'primary-600 #007069', 'gray-400 #8f8f8f', 'gray-500 #727272', 'gray-600 #636363'],
    serif: ['primary-400 #a176ff', 'primary-500 #8a3ffc', 'primary-600 #7f2ded', 'secondary-400 #d4622b', 'secondary-500 #c05012', 'secondary-600 #aa4200', 'tertiary-400 #2b8ad4', 'tertiary-500 #0a77bf', 'tertiary-600 #0066a8', 'gray-400 #8f8f8f', 'gray-500 #727272', 'gray-600 #636363'],
  };
  const fills = { default: ['primary-600', 'gray-500', 'gray-600'], serif: ['primary-500', 'primary-600', 'secondary-500', 'secondary-600', 'tertiary-500', 'tertiary-600', 'gray-500', 'gray-600'] };
  const nearest = { default: '`primary-500` #168b83, has 4.1:1 and 4.6:1',serif: '`tertiary-500` #0a77bf, has 4.7:1 and 4.0:1' };
  for (const [name, inputs] of [['default', defaultInputs()], ['serif', SERIF]]) {
    const { resolved: r, section } = exported(inputs);
    const words = bullet(section, 'Colours');
    assert.match(words, /^a figure does not follow dark mode/, name);
    const plate = words.match(/\n {2}- \*\*On a light plate of its own:\*\* (.*)/)?.[1];
    const held = words.match(/\n {2}- \*\*In colours that hold in both modes:\*\* (.*)/)?.[1];
    assert.ok(plate && held, `${name}: both ways`);
    for (const role of PLATE) assert.ok(plate.includes(`\`${role}\` ${r.surfaces.page.light.roles[role]}`), `${name}: ${role} on the plate`);
    assert.ok(held.includes(`against both page backgrounds, ${r.surfaces.page.light.roles.background} and ${r.surfaces.page.dark.roles.background}:`), name);
    const steps = held.match(/both page backgrounds, [^:]+: ([^.]+)\./)[1];
    assert.deepEqual([...steps.matchAll(/`([a-z]+-\d+)` (#[0-9a-f]{6})/g)].map(([, step, hex]) => `${step} ${hex}`), both[name], `${name}: the steps that hold`);
    for (const step of both[name]) {
      const [ramp, rest] = step.split('-');
      const [level, hex] = rest.split(' ');
      assert.equal(r.ramps[ramp][level], hex, `${step} is the design's`);
    }
    assert.ok(held.includes(`the nearest, ${nearest[name]}`), name);
    const under = held.match(/on a step that gives it 4\.5:1: ([^.]+)\./)[1];
    assert.deepEqual([...under.matchAll(/`([a-z]+-\d+)`/g)].map(([, step]) => step), fills[name], `${name}: the fills that carry text`);
  }
});

// What the colours that hold in both modes are is computed from the design's own two pages, so it says what holds for any
// dark page: here a made-up purple with the dark page set to pure black, and two darker greys as the dark page.
test('the colours that hold in both modes are worked out from the design\'s own pages, and never end in an empty list', () => {
  const inputs = { 'brand-colors': { primary: '#8c64b8' } };
  const held = (dark) => {
    const resolved = derive(inputs);
    resolved.surfaces.page.dark.roles.background = dark;
    const text = designMd({ inputs: withDefaults(inputs), project: { name: 'Example' }, resolved }, 'example.design.json');
    const words = bullet(text.match(/\n### Figures\n([\s\S]*?)\n##/)[1], 'Colours');
    assert.doesNotMatch(words, /:\s*\.|:\s*$/, `${dark}: no empty list`);
    return words.match(/\n {2}- \*\*In colours that hold in both modes:\*\* (.*)/)[1];
  };
  // Worked with a contrast checker: on #ffffff and #000000, #8c64b8 has 4.54:1 and 4.63:1, so text may stand in it on
  // either page; #a67ed4 3.20:1 and 6.56:1, #7850a3 6.04:1 and 3.48:1, #8f8f8f 3.23:1 and 6.49:1, #727272 4.81:1 and
  // 4.37:1, #636363 6.01:1 and 3.50:1; white text has 4.5:1 on the four darkest.
  const black = held('#000000');
  assert.match(black, /against both page backgrounds, #ffffff and #000000: `primary-400` #a67ed4, `primary-500` #8c64b8, `primary-600` #7850a3, `gray-400` #8f8f8f, `gray-500` #727272 and `gray-600` #636363\./);
  assert.doesNotMatch(black, /No colour has 4\.5:1 against both/);
  assert.match(black, /Text needs 4\.5:1 against both, which only `primary-500` #8c64b8 has: text in it may stand on the page itself\./);
  assert.match(black, /Text in another colour stands on a fill of its own, in #ffffff, on a step that gives it 4\.5:1: `primary-500`, `primary-600`, `gray-500` and `gray-600`\./);
  // On #555555 no step has 3:1 against both pages, so a figure stands on a light plate.
  const grey = held('#555555');
  assert.match(grey, /No step of this design's has 3:1 against both page backgrounds, #ffffff and #555555, which every line, mark and fill needs: the nearest, `[a-z]+-\d+` #[0-9a-f]{6}, has \d+\.\d:1 and \d+\.\d:1\. So draw a figure on a light plate\./);
  // On #3d3d3d only #a67ed4 and #8f8f8f hold, 3.20:1 and 3.39:1, 3.23:1 and 3.36:1, and neither carries white text at 4.5:1.
  const dim = held('#3d3d3d');
  assert.match(dim, /#ffffff and #3d3d3d: `primary-400` #a67ed4 and `gray-400` #8f8f8f\./);
  assert.match(dim, /So text needs a light plate: none of these steps gives #ffffff text 4\.5:1\./);
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
before(async () => {
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// A sample figure drawn by the section alone: its size from the file's example, its plate, labels and typeface from the
// section's words. Its labels stay live text in the main typeface, which an image may take from the system, so their
// ink can be measured beside the page's text; outlined, the same glyphs draw the same ink.
function sample(section, width = null) {
  const [, w, h] = section.match(/`width="(\d+)" height="(\d+)" viewBox="0 0 \d+ \d+"`/);
  const main = Number(section.match(/main labels at the body size, ([\d.]+) px/)[1]);
  const secondary = Number(section.match(/at the small size, ([\d.]+) px/)[1]);
  const face = section.match(/labels in the main typeface, (.+?)(?: \(the system's own\))?, at weight/)[1];
  const plate = bullet(section, 'Colours').match(/\*\*On a light plate of its own:\*\* (.*)/)[1];
  const colour = (role) => plate.match(new RegExp(`\`${role}\` (#[0-9a-f]{6})`))[1];
  const across = width ?? Number(w);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${across}" height="${h}" viewBox="0 0 ${across} ${h}"><rect width="${across}" height="${h}" fill="${colour('background')}"/><text x="20" y="${h * 0.35}" font-family="${face}" font-size="${main}" fill="${colour('text')}">HHHHHHHH</text><text x="20" y="${h * 0.8}" font-family="${face}" font-size="${secondary}" fill="${colour('text-muted')}">HHHHHHHH</text></svg>`;
  return { svg, width: across };
}

test('a sample figure drawn by the section shows its labels about the size of the text around it, at Narrow and on a phone', { timeout: 240000 }, async () => {
  const r = derive(defaultInputs());
  const { section } = exported(defaultInputs());
  const figure = sample(section);
  // The same labels in a figure drawn at Narrow, which the section says shrink too far on a phone.
  const wide = sample(section, r.layout.narrow);
  const uri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const konzilo = readFileSync(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8');
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${coreCss(r)}${await componentsCss()}${konzilo}:root { scrollbar-width: none; }</style></head><body data-kn-surface="page"><main>
    <section class="kn-band"><div class="kn-band-content"><div class="kn-reading-area"><div class="kn-reading-area-flow kn-body-text">
      <p><span id="text">HHHHHHHH</span> stands in the running text beside the figure, in the body style.</p>
      <figure><img id="figure" src="${uri(figure.svg)}" alt="A sample figure"><figcaption><span id="small">HHHHHHHH</span> in the caption.</figcaption></figure>
      <figure><img id="wide" src="${uri(wide.svg)}" alt="The same figure drawn at Narrow"></figure>
    </div></div></div></section></main></body></html>`;
  // The width of a run of capitals' ink, in CSS pixels: a measure of a text's size that the same typeface gives alike
  // in the page and in the image.
  const inkWidth = async (tab, clip) => {
    const bounds = inkBounds(decodePng(await tab.screenshot({ clip })));
    return (bounds.right - bounds.left) / 2;
  };
  for (const [name, browser] of browsers) for (const [window, at] of [[1440, 'Narrow'], [390, 'a phone']]) {
    const context = await browser.newContext({ viewport: { width: window, height: 2000 }, deviceScaleFactor: 2 });
    const tab = await context.newPage();
    await tab.setContent(page);
    await tab.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    const box = (id) => tab.evaluate((id) => { const { x, y, width, height } = document.getElementById(id).getBoundingClientRect(); return { x, y, width, height }; }, id);
    const size = (id) => tab.evaluate((id) => parseFloat(getComputedStyle(document.getElementById(id)).fontSize), id);
    const [text, small, shown, narrow] = await Promise.all([box('text'), box('small'), box('figure'), box('wide')]);
    const label = `${name} at ${at}`;
    // Never enlarged, at most the column: its own size at Narrow, the column's on a phone, as the section says.
    if (window === 1440) assert.equal(Math.round(shown.width), figure.width, `${label}: shown at its own size`);
    else assert.ok(Math.abs(shown.width - 354) < 1 && Math.abs(narrow.width - 354) < 1, `${label}: ${shown.width} and ${narrow.width} for a 354 px column`);
    const half = (rect, part) => ({ x: rect.x, y: rect.y + rect.height * (part ? 0.5 : 0), width: rect.width, height: rect.height / 2 });
    const [body, caption, main, secondary, mainAtNarrow] = await Promise.all([inkWidth(tab, text), inkWidth(tab, small), inkWidth(tab, half(shown, 0)), inkWidth(tab, half(shown, 1)), inkWidth(tab, half(narrow, 0))]);
    const [bodySize, smallSize] = await Promise.all([size('text'), size('small')]);
    // About the size: within a quarter of the text's, either way.
    const about = (ratio) => ratio >= 0.75 && ratio <= 1.25;    assert.ok(about(main / body), `${label}: main labels at ${(main / body).toFixed(2)} of the body text's ${bodySize}px`);
    assert.ok(about(secondary / caption), `${label}: secondary labels at ${(secondary / caption).toFixed(2)} of the caption's ${smallSize}px`);
    assert.ok(secondary / body * bodySize > 11.5, `${label}: no label shows under 12 px, ${(secondary / body * bodySize).toFixed(1)}`);
    if (window === 390) assert.ok(mainAtNarrow / body < 0.6, `${label}: drawn at Narrow, the same labels shrink to ${(mainAtNarrow / body).toFixed(2)} of the text`);
    await context.close();
  }
});
