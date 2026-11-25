// The side of a section's picture (issue #37; docs/spec/directives.md, `section`, The side of the picture): the design's
// `section.picture-side`, written by the core as --kn-section-picture-side, which section.css reads by a style query,
// since a site writes its sections' HTML itself. At the start, as before; alternating from one section with a picture
// beside its text to the next; and alternating with pictures that meet corner to corner, within the content area or out
// to the window's edge. Laid out by the real stylesheet, with no script, in every engine Playwright has here.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { renderMarkdown } from './helpers/konzilo-body.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { derive, defaultInputs, validateInputs } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { designMd } from '../src/design-md/index.js';

const inputs = (section) => ({ 'brand-colors': { primary: '#168b83' }, ...(section ? { section } : {}) });
const SIDES = ['start', 'alternate', 'corners', 'corners-bleed'];

test('a design sets the side of its sections\' pictures, at the start unless told otherwise, and the core CSS carries it', () => {
  assert.deepEqual(defaultInputs().section, { 'picture-side': 'start' });
  assert.deepEqual(derive(inputs()).section, { 'picture-side': 'start' }, 'at the start unless told otherwise, as before');
  for (const side of SIDES) {
    const resolved = derive(inputs({ 'picture-side': side }));
    assert.deepEqual(resolved.section, { 'picture-side': side });
    assert.match(coreCss(resolved), new RegExp(`^  --kn-section-picture-side: ${side};$`, 'm'));
  }
  assert.throws(() => validateInputs(inputs({ 'picture-side': 'end' })), /unsupported value/);
  assert.throws(() => validateInputs(inputs({ side: 'alternate' })), /unknown property side/);
  // A file resolved before the choice existed has no section, and its pictures keep the start.
  const { section, ...before } = derive(inputs({ 'picture-side': 'corners' }));
  assert.match(coreCss(before), /^  --kn-section-picture-side: start;$/m);
});

test('the export for AI says where this design puts a section\'s picture, in the Section\'s recipe', () => {
  const recipe = (side) => {
    const text = designMd({ inputs: withDefaults(inputs(side && { 'picture-side': side })), project: { name: 'Name' }, resolved: derive(inputs(side && { 'picture-side': side })) }, 'name.design.json');
    return text.match(/^- \*\*Section:\*\*[^\n]*(?:\n {2}[^\n]*)*/m)[0];
  };
  const start = recipe();
  assert.match(start, /\*\*The picture's side:\*\* at the start in every section with a picture beside its text\./);
  assert.equal(recipe('start'), start, 'the default is the start');
  const alternate = recipe('alternate');
  assert.match(alternate, /\*\*The picture's side:\*\* alternating: at the start in the first section with a picture beside its text, at the end in the next, and so on, counted in page order over every such section/);
  assert.match(alternate, /a picture a form offers takes its turn too/);
  assert.doesNotMatch(alternate, /corner to corner/);
  const corners = recipe('corners');
  assert.match(corners, /alternating[^\n]*and meeting corner to corner: [^\n]*fills its Band's full height, with no `band` space above or below it, and exactly half the content area, from the content area's edge to its middle, with square corners/);
  assert.match(corners, /The text keeps the `band` space above and below[^\n]*the column gap towards its picture/);
  assert.match(corners, /A caption stands at the foot of the text's column/);
  assert.match(corners, /as at a change of Surface/);
  assert.match(corners, /Below 48rem the picture stands first, at the Band's top edge, as wide as the content area/);
  const bleed = recipe('corners-bleed');
  assert.match(bleed, /from the middle of the content area to the window's edge/);
  assert.match(bleed, /Below 48rem the picture stands first, at the Band's top edge, as wide as the window/);
  for (const text of [start, alternate, corners, bleed]) assert.doesNotMatch(text, /--kn-|data-kn-|\bkn-[a-z]|undefined/);
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const svg = (w, h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="gray"/></svg>`)}`;
const PICTURES = { '/pictures/landscape.svg': svg(1200, 800), '/pictures/portrait.svg': svg(600, 800), '/pictures/badge.svg': svg(200, 200) };
const words = 'Each bed is built from untreated larch, lined against the damp and filled with three layers of soil.';
// A section as an editor writes it, its words made up: a picture first, with a caption where asked, then a heading and
// its text, and a form or a badge where asked.
const section = (anchor, { surface, picture = '/pictures/landscape.svg', caption, badge = false, text = 1, form = false } = {}) => [
  `:::section{anchor="${anchor}"${surface ? ` surface="${surface}"` : ''}}`,
  picture ? `![A shed with tools](${picture})${caption ? `\\\n${caption}` : ''}` : '',
  badge ? '![Award one](/pictures/badge.svg)' : '',
  `## The ${anchor} section`,
  Array.from({ length: text }, () => words).join('\n\n'),
  form ? '::form{name="guide"}' : '',
  ':::',
].filter(Boolean).join('\n\n');
const html = (markdown) => Object.entries(PICTURES).reduce((out, [address, src]) => out.replaceAll(address, src), renderMarkdown(markdown));

const browsers = [];
let components;
before(async () => {
  components = `${await componentsCss()}${await readFile(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8')}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// No script runs: the stylesheet alone lays every section out (principles.md).
async function open(browser, side, body, { width = 1440, height = 900, page = {} } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false });
  const tab = await context.newPage();
  const resolved = derive({ ...inputs(side ? { 'picture-side': side } : undefined), page });
  await tab.setContent(`<!doctype html><html lang="en"><head><style>${coreCss(resolved)}${components}</style></head><body data-kn-surface="page"><main>${body}</main></body></html>`);
  tab.on('close', () => context.close().catch(() => {}));
  return tab;
}

// Each band in order: its edges, its content's, its picture's, its caption's and its text's (the head and the body
// together), in px, and which side its picture stands on.
const bands = (tab) => tab.$$eval('main > .kn-band', (nodes) => nodes.map((band) => {
  const box = (element) => (element ? element.getBoundingClientRect().toJSON() : null);
  const find = (selector) => band.querySelector(selector);
  const picture = box(find('.kn-section-picture')), head = box(find('.kn-section-head')), body = box(find('.kn-section-body'));
  const text = head || body ? {
    top: Math.min(head?.top ?? Infinity, body?.top ?? Infinity), bottom: Math.max(head?.bottom ?? -Infinity, body?.bottom ?? -Infinity),
    left: Math.min(head?.left ?? Infinity, body?.left ?? Infinity), right: Math.max(head?.right ?? -Infinity, body?.right ?? -Infinity),
  } : null;
  const line = getComputedStyle(band, '::before');
  return {
    id: band.id, band: box(band), content: box(find('.kn-band-content')), picture, text, caption: box(find('.kn-section-caption')),
    side: picture && text ? (picture.right <= text.left + 1 ? 'start' : picture.left >= text.right - 1 ? 'end' : 'over') : null,
    radius: find('.kn-section-picture') ? getComputedStyle(find('.kn-section-picture')).borderStartStartRadius : null,
    line: line.content !== 'none' && line.content !== 'normal' && parseFloat(line.borderTopWidth) > 0,
    window: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}));
const close = (actual, expected, what, within = 1) => assert.ok(Math.abs(actual - expected) <= within, `${what}: ${actual} where ${expected} was expected`);
// The design's spaces at the window's width, read from the stylesheet itself.
const spaces = (tab) => tab.evaluate(() => {
  const probe = document.body.appendChild(document.createElement('div'));
  const read = (role) => { probe.style.inlineSize = `var(--kn-space-${role})`; return probe.getBoundingClientRect().width; };
  const found = { band: read('band'), gap: read('column-gap'), component: read('component-gap') };
  probe.remove();
  return found;
});

// Four sections with a picture, a band without one between the second and the third, which does not restart the count.
const RUN = [section('one'), section('two'), section('between', { picture: null }), section('three'), section('four')].join('\n\n');

test('by default every section has its picture at the start, as before; alternating, the sides take turns over every section with a picture', { timeout: 120000 }, async () => {
  const body = html(RUN);
  for (const [name, browser] of browsers) for (const side of [undefined, 'start', 'alternate', 'corners', 'corners-bleed']) {
    const tab = await open(browser, side, body);
    const found = await bands(tab);
    const sides = found.filter((band) => band.picture).map((band) => band.side);
    assert.deepEqual(sides, side === undefined || side === 'start' ? ['start', 'start', 'start', 'start'] : ['start', 'end', 'start', 'end'], `${name}, ${side ?? 'no choice'}`);
    // The text keeps the band's space from the next band's text, in every value (page.md, point 3).
    const { band: space } = await spaces(tab);
    for (const [at, band] of found.slice(1).entries()) assert.ok(band.text.top - found[at].text.bottom >= space - 1, `${name}, ${side}: #${band.id} stands the band's space from the text before it`);
    assert.equal(found[0].overflow, 0, `${name}, ${side}: nothing scrolls sideways`);
    await tab.close();
  }
});

// A run of four sections with a picture on one background, their texts short and long, between two bands without one.
const CORNERS = [
  section('before', { picture: null }),
  section('short'), section('long', { text: 6 }), section('portrait', { picture: '/pictures/portrait.svg' }), section('last', { text: 3 }),
  section('after', { picture: null }),
].join('\n\n');

test('corner to corner, each picture fills its band\'s height and half the content area, square, and touches the next at a corner, while the text keeps the band\'s space', { timeout: 120000 }, async () => {
  const body = html(CORNERS);
  for (const [name, browser] of browsers) for (const side of ['corners', 'corners-bleed']) {
    const tab = await open(browser, side, body);
    const { band: space, gap } = await spaces(tab);
    const found = await bands(tab);
    const [before, ...rest] = found;
    const after = rest.pop();
    // The content area, as a band without a picture has it.
    const area = before.content;
    for (const [at, band] of rest.entries()) {
      const what = `${name}, ${side}, #${band.id}`;
      const middle = area.left + area.width / 2;
      close(band.picture.top, band.band.top, `${what}: the picture starts at the band's edge`);
      close(band.picture.bottom, band.band.bottom, `${what}: and ends at the other`);
      assert.equal(band.radius, '0px', `${what}: with square corners`);
      assert.equal(band.side, at % 2 ? 'end' : 'start', what);
      if (side === 'corners') {
        close(band.picture.width, area.width / 2, `${what}: exactly half the content area`, 0.5);
        close(at % 2 ? band.picture.right : band.picture.left, at % 2 ? area.right : area.left, `${what}: at the content area's edge`, 0.5);
      } else close(at % 2 ? band.picture.right : band.picture.left, at % 2 ? band.window : 0, `${what}: out to the window's edge`, 0.5);
      close(at % 2 ? band.picture.left : band.picture.right, middle, `${what}: from the middle of the content area`, 0.5);
      assert.ok(band.text.top - band.band.top >= space - 1, `${what}: the band's space above the text (${band.text.top - band.band.top})`);
      assert.ok(band.band.bottom - band.text.bottom >= space - 1, `${what}: and below it (${band.band.bottom - band.text.bottom})`);
      close(at % 2 ? band.picture.left - band.text.right : band.text.left - band.picture.right, gap, `${what}: the column gap towards its picture`);
      assert.ok(band.text.left >= area.left - 0.5 && band.text.right <= area.right + 0.5, `${what}: the text within the content area`);
      const next = rest[at + 1];
      if (next) {
        close(next.picture.top, band.picture.bottom, `${what}: the next picture starts where this one ends`);
        close(at % 2 ? next.picture.right : next.picture.left, at % 2 ? band.picture.left : band.picture.right, `${what}: so the two meet corner to corner`, 0.5);
      }
    }
    // The bands around the run meet its pictures as at a change of background: each keeps the band's space towards them.
    assert.ok(rest[0].picture.top - before.content.bottom >= space - 1, `${name}, ${side}: the band before keeps its space`);
    assert.ok(after.content.top - rest.at(-1).picture.bottom >= space - 1, `${name}, ${side}: the band after keeps its space`);
    assert.equal(found[0].overflow, 0, `${name}, ${side}: nothing scrolls sideways`);
    await tab.close();
  }
});

// On a narrow window everything stacks (the assistant's choice, 2026-11-25): the picture first, at its band's start edge
// with square corners, as wide as the content area or the window, and the text under it, the band's space below it.
test('corner to corner on a narrow window, the picture stands first at its band\'s start edge, and the text under it', { timeout: 120000 }, async () => {
  const body = html(CORNERS);
  for (const [name, browser] of browsers) for (const side of ['corners', 'corners-bleed']) for (const width of [390, 700]) {
    const tab = await open(browser, side, body, { width });
    const { band: space, gap } = await spaces(tab);
    const found = await bands(tab);
    const [before, ...rest] = found;
    const after = rest.pop();
    const area = before.content;
    for (const band of rest) {
      const what = `${name}, ${side}, ${width} px, #${band.id}`;
      close(band.picture.top, band.band.top, `${what}: the picture starts at the band's edge`);
      assert.equal(band.radius, '0px', `${what}: with square corners`);
      if (side === 'corners') {
        close(band.picture.left, area.left, `${what}: from the content area's start`, 0.5);
        close(band.picture.right, area.right, `${what}: to its end`, 0.5);
      } else {
        close(band.picture.left, 0, `${what}: from the window's edge`, 0.5);
        close(band.picture.right, band.window, `${what}: to the other`, 0.5);
      }
      close(band.text.top - band.picture.bottom, gap, `${what}: the text the column gap under it`);
      assert.ok(band.text.left >= area.left - 0.5 && band.text.right <= area.right + 0.5, `${what}: the text within the content area`);
      close(band.band.bottom - band.text.bottom, space, `${what}: the band's space below the text`);
    }
    assert.ok(rest[0].picture.top - before.content.bottom >= space - 1, `${name}, ${side}, ${width} px: the band before keeps its space`);
    assert.ok(after.content.top - rest.at(-1).text.bottom >= space - 1, `${name}, ${side}, ${width} px: the band after stands the band's space from the text`);
    assert.equal(found[0].overflow, 0, `${name}, ${side}, ${width} px: nothing scrolls sideways`);
    await tab.close();
  }
});

// A photo's caption (issue #35) stays with the text when its picture meets its neighbours corner to corner, at the foot
// of the text's column, and under the picture where everything stacks (the assistant's choice, 2026-11-25).
test('corner to corner, a photo\'s caption stands at the foot of the text\'s column, and under its picture on a narrow window', { timeout: 120000 }, async () => {
  const caption = 'The shed in May, before the beds were sown.';
  const body = html([section('before', { picture: null }), section('one', { caption }), section('two', { caption, text: 4 }), section('three')].join('\n\n'));
  for (const [name, browser] of browsers) for (const side of ['corners', 'corners-bleed']) {
    let tab = await open(browser, side, body);
    const { band: space, gap } = await spaces(tab);
    let [before, one, two, three] = await bands(tab);
    for (const band of [one, two]) {
      const what = `${name}, ${side}, #${band.id}`;
      close(band.picture.top, band.band.top, `${what}: the picture alone fills its band`);
      close(band.picture.bottom, band.band.bottom, `${what}: to its end`);
      assert.ok(band.caption.left >= band.text.left - 0.5 && band.caption.right <= band.text.right + 0.5, `${what}: the caption stands in the text's column`);
      assert.ok(band.caption.top >= band.text.bottom + gap - 1, `${what}: at least the column gap under the text`);
      close(band.band.bottom - band.caption.bottom, space, `${what}: the band's space under it`);
    }
    close(two.picture.top, one.picture.bottom, `${name}, ${side}: the two pictures meet`);
    close(three.picture.top, two.picture.bottom, `${name}, ${side}: and the next`);
    await tab.close();
    tab = await open(browser, side, body, { width: 390 });
    [before, one, two, three] = await bands(tab);
    for (const band of [one, two]) {
      const what = `${name}, ${side}, 390 px, #${band.id}`;
      const component = (await spaces(tab)).component;
      assert.ok(band.caption.top >= band.picture.bottom - 0.5 && band.caption.bottom <= band.text.top, `${what}: the caption under the picture, above the text`);
      assert.ok(band.caption.left >= before.content.left - 0.5 && band.caption.right <= before.content.right + 0.5, `${what}: within the content area`);
      assert.ok(band.caption.top - band.picture.bottom <= component + 0.5, `${what}: close under the picture`);
    }
    assert.equal(one.overflow, 0, `${name}, ${side}, 390 px: nothing scrolls sideways`);
    await tab.close();
  }
});

// A picture a form offers is shown whole, never cropped, and one with badges stays with them at its own size: each takes
// its turn, but stands in the band's space (the assistant's choice, 2026-11-25).
test('corner to corner, a picture a form offers and one with badges take their turn, and stand in the band\'s space as before', { timeout: 120000 }, async () => {
  const body = html([section('one'), section('offer', { picture: '/pictures/portrait.svg', form: true }), section('badges', { badge: true }), section('four')].join('\n\n'));
  for (const [name, browser] of browsers) for (const side of ['corners', 'corners-bleed']) {
    const tab = await open(browser, side, body);
    const { band: space } = await spaces(tab);
    const [one, offer, badges, four] = await bands(tab);
    assert.deepEqual([one, offer, badges, four].map((band) => band.side), ['start', 'end', 'start', 'end'], `${name}, ${side}: each takes its turn`);
    for (const band of [offer, badges]) {
      const what = `${name}, ${side}, #${band.id}`;
      assert.ok(band.picture.top - band.band.top >= space - 1, `${what}: the picture stands in the band's space`);
      assert.ok(band.picture.right <= band.content.right + 0.5 && band.picture.left >= band.content.left - 0.5, `${what}: within the content area`);
    }
    assert.notEqual(badges.radius, '0px', `${name}, ${side}: a picture with badges keeps the card radius`);
    close(one.picture.bottom, one.band.bottom, `${name}, ${side}: the section before them still meets its edge`);
    assert.ok(offer.picture.top - one.picture.bottom >= space - 1, `${name}, ${side}: and the offer keeps the band's space from it`);
    await tab.close();
  }
});

// With the design's hairline between bands on one background (page.md, point 3), none stands where a picture runs to
// the band's edge: such a band meets the bands around it as at a change of background.
test('with the design\'s hairline, none stands next to a picture that meets its band\'s edge, and plain bands keep theirs', { timeout: 120000 }, async () => {
  const body = html([section('first', { picture: null }), section('second', { picture: null }), section('one'), section('two'), section('after', { picture: null }), section('again', { picture: null })].join('\n\n'));
  for (const [name, browser] of browsers) for (const side of ['alternate', 'corners', 'corners-bleed']) {
    const tab = await open(browser, side, body, { page: { 'band-line': true } });
    const lines = (await bands(tab)).map((band) => band.line);
    assert.deepEqual(lines, side === 'alternate' ? [false, true, true, true, true, true] : [false, true, false, false, false, true], `${name}, ${side}`);
    await tab.close();
  }
});
