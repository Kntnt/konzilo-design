// The space between Bands (page.md, point 3; issue #30, the owner, 2026-11-25): two adjacent Bands on one background
// share one Band's space, unless the design parts them with a hairline, when each keeps its own; and the footer's own
// row gaps (footer.md). Laid out by the real stylesheet, with no script, in every engine Playwright has here.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { renderMarkdown, testDesign } from './helpers/konzilo-body.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { layoutFooter } from '../src/components/footer.js';
import { footerHtml } from '../src/components/footer-html.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let components;
before(async () => {
  components = await componentsCss();
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

const design = (page = {}) => { const inputs = defaultInputs(); Object.assign(inputs.page, page); return derive(inputs); };
const md = (strings, ...values) => String.raw({ raw: strings }, ...values);
// A section as an editor writes it, its words made up.
const section = (heading, surface) => `:::section${surface ? `{surface="${surface}"}` : ''}

## ${heading}

A few words of the band's own.

:::`;
// A body as the core renders it: two sections on the page, two on tint, and one on the page after them.
const BODY = [section('First on the page'), section('Second on the page'), section('First on tint', 'tint'), section('Second on tint', 'tint'), section('On the page again')].join('\n\n');

async function open(browser, resolved, body, { width = 1440 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en"><head><style>${coreCss(resolved)}${components}</style></head><body data-kn-surface="page"><main>${body}</main></body></html>`);
  tab.on('close', () => context.close().catch(() => {}));
  return tab;
}
// Each band in order: its edges, its content's edges, and the hairline drawn at its start, if any, in px.
const bands = (tab) => tab.$$eval('main > .kn-band', (nodes) => nodes.map((band) => {
  const box = band.getBoundingClientRect();
  const content = band.querySelector('.kn-band-content').getBoundingClientRect();
  const line = getComputedStyle(band, '::before');
  const drawn = line.content !== 'none' && line.content !== 'normal' && parseFloat(line.borderTopWidth) > 0 && line.borderTopStyle !== 'none';
  return {
    top: box.top, bottom: box.bottom, contentTop: content.top, contentBottom: content.bottom, contentLeft: content.left, contentWidth: content.width,
    line: drawn ? { top: band.getBoundingClientRect().top + parseFloat(line.top), width: parseFloat(line.width), left: box.left + parseFloat(line.left) + parseFloat(line.marginLeft), thickness: parseFloat(line.borderTopWidth), colour: line.borderTopColor } : null,
    border: getComputedStyle(band).getPropertyValue('--kn-border').trim(),
  };
}));
const close = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 1, `${what}: ${actual} where ${expected} was expected`);

test('two sections on one background stand one band apart, the page\'s and a tint\'s alike, and a change of background keeps both spaces', { timeout: 120000 }, async () => {
  const body = renderMarkdown(BODY);
  for (const [name, browser] of browsers) {
    const tab = await open(browser, design(), body);
    const [page1, page2, tint1, tint2, page3] = await bands(tab);
    // 5rem, the band space at a wide window.
    close(page2.contentTop - page1.contentBottom, 80, `${name}: two on the page`);
    close(tint2.contentTop - tint1.contentBottom, 80, `${name}: two on tint`);
    close(page1.bottom, page1.contentBottom, `${name}: the first keeps no end space`);
    close(page2.contentTop - page2.top, 80, `${name}: the second starts with the band space`);
    close(tint1.contentTop - page2.contentBottom, 160, `${name}: a change of background keeps both`);
    close(page3.contentTop - tint2.contentBottom, 160, `${name}: and back`);
    for (const band of [page1, page2, tint1, tint2, page3]) assert.equal(band.line, null, `${name}: no hairline without the design's`);
    await tab.close();
  }
});

test('with the design\'s hairline, two sections on one background each keep their space, parted by a hairline at the content area\'s width, and none stands at a change of background', { timeout: 120000 }, async () => {
  const body = renderMarkdown(BODY);
  for (const [name, browser] of browsers) for (const width of [1440, 390]) {
    const tab = await open(browser, design({ 'band-line': true }), body, { width });
    const [page1, page2, tint1, tint2, page3] = await bands(tab);
    const what = `${name} at ${width}px`;
    const space = page2.contentTop - page2.top;
    if (width === 1440) close(space, 80, `${what}: the band space`);
    for (const [first, second, ground] of [[page1, page2, 'the page'], [tint1, tint2, 'tint']]) {
      close(second.contentTop - first.contentBottom, 2 * space, `${what}: two on ${ground}, each with its own space`);
      close(first.bottom - first.contentBottom, space, `${what}: the first keeps its end space`);
      assert.ok(second.line, `${what}: a hairline between two on ${ground}`);
      close(second.line.top, second.top, `${what}: where the two meet, on ${ground}`);
      close(second.line.left, second.contentLeft, `${what}: from the content area's start, on ${ground}`);
      close(second.line.width, second.contentWidth, `${what}: as wide as the content area, on ${ground}`);
      assert.equal(second.line.thickness, 1, `${what}: a hairline`);
    }
    // In the Surface's own border colour.
    assert.notEqual(page2.line.colour, tint2.line.colour, `${what}: each in its Surface's border colour`);
    for (const band of [page1, tint1, page3]) assert.equal(band.line, null, `${what}: no hairline at a change of background or at the top`);
    close(tint1.contentTop - page2.contentBottom, 2 * space, `${what}: a change of background as before`);
    await tab.close();
  }
});

// A band of logos alone stands as far from the band before it as from the band after it (directives.md, `list`), which
// the shared space gives it as it gives every band, and the hairline parts it as it parts any other.
test('a band of logos alone shares its space as any band does, and the hairline parts it as any other', { timeout: 120000 }, async () => {
  const logos = md`:::section

::::list{type="logos" label="Trusted by"}
- ![A name](data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20120%22%20width%3D%22400%22%20height%3D%22120%22%2F%3E)
::::

:::`;
  const body = renderMarkdown(`${section('Before the logos')}\n\n${logos}\n\n${section('After the logos')}`);
  assert.match(body, /class="kn-logos"/);
  for (const [name, browser] of browsers) for (const line of [false, true]) {
    const tab = await open(browser, design({ 'band-line': line }), body);
    const [before, band, next] = await bands(tab);
    const what = `${name}${line ? ', with the hairline' : ''}`;
    close(band.contentTop - before.contentBottom, line ? 160 : 80, `${what}: above the logos`);
    close(next.contentTop - band.contentBottom, line ? 160 : 80, `${what}: below them`);
    if (line) for (const [first, second] of [[before, band], [band, next]]) close(second.line?.top, first.bottom, `${what}: a hairline where they meet`);
    await tab.close();
  }
});

// A Hero keeps the band space under its text at every height (hero.css), so the band after it on its background starts
// with none of its own, and the two share one band's space all the same (the assistant's choice, 2026-11-25).
const HERO = md`:::hero

# A title

Words.

:::`;
const heroDesign = { hero: { picture: 'none', surface: 'none' } };

test('a section after a Hero on the Hero\'s background stands one band from the Hero\'s text', { timeout: 120000 }, async () => {
  const body = renderMarkdown(`${HERO}\n\n${section('After the hero')}\n\n${section('On tint', 'tint')}`, { design: testDesign(heroDesign) });
  for (const [name, browser] of browsers) {
    const tab = await open(browser, design(), body);
    const [hero, after, tint] = await bands(tab);
    close(hero.bottom - hero.contentBottom, 80, `${name}: the Hero keeps its end space`);
    close(after.contentTop - hero.contentBottom, 80, `${name}: one band between them`);
    close(tint.contentTop - after.contentBottom, 160, `${name}: a change of background keeps both`);
    await tab.close();
    const parted = await open(browser, design({ 'band-line': true }), body);
    const [hero2, after2] = await bands(parted);
    close(after2.contentTop - hero2.contentBottom, 160, `${name}, with the hairline: each its own space`);
    assert.ok(after2.line, `${name}: a hairline under the Hero`);
    close(after2.line.top, hero2.bottom, `${name}: where the two meet`);
    await parted.close();
  }
});

// The footer's own spacing (footer.md, Space; the owner, 2026-11-25): its bands never take a band's space from each
// other, and its rows stand the component gap apart in the upper band and 0.5rem in the lower, twice that with the
// design's hairline between them in the middle.
const words = { a1: 'Brand words', b1: 'A row of links', a2: 'A short statement of what the brand does.', b2: 'Navigation links' };
const footerProps = (lower, horizontalRules) => ({
  upper: { surface: 'brand', cells: Object.fromEntries(Object.entries(words).map(([cell, text]) => [cell, { text }])) },
  lower: { surface: lower, cells: Object.fromEntries(Object.entries(words).map(([cell, text]) => [cell, { text: `Lower: ${text}` }])) },
  horizontalRules,
});

test('the footer\'s rows stand their own gap apart, twice it round a hairline, and two bands of one colour stand twice the upper gap apart', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const lower of ['inverse', 'brand']) for (const rules of [false, true]) {
    const props = footerProps(lower, rules);
    const tab = await open(browser, design(), footerHtml(layoutFooter(props), props));
    const read = await tab.evaluate(() => {
      const band = (which) => document.querySelector(`[data-kn-band="${which}"]`);
      const cell = (which, name) => band(which).querySelector(`[data-kn-cell="${name}"]`).getBoundingClientRect();
      const rule = (which, join) => [...band(which).querySelectorAll(`.kn-footer-rule${join ? '[data-kn-join]' : ':not([data-kn-join])'}`)].map((node) => node.getBoundingClientRect().top)[0] ?? null;
      const of = (which) => ({ top: band(which).getBoundingClientRect().top, bottom: band(which).getBoundingClientRect().bottom, row1: Math.max(cell(which, 'a1').bottom, cell(which, 'b1').bottom), row2: Math.min(cell(which, 'a2').top, cell(which, 'b2').top), first: Math.min(cell(which, 'a1').top, cell(which, 'b1').top), last: Math.max(cell(which, 'a2').bottom, cell(which, 'b2').bottom), rule: rule(which), join: rule(which, true) });
      return { upper: of('upper'), lower: of('lower') };
    });
    const what = `${name}, ${lower === 'brand' ? 'one colour' : 'two colours'}, ${rules ? 'with' : 'without'} hairlines`;
    const { upper, lower: low } = read;
    // At a wide window the component gap is 1.25rem, 20 px.
    close(upper.row2 - upper.row1, rules ? 40 : 20, `${what}: the upper band's rows`);
    close(low.row2 - low.row1, rules ? 16 : 8, `${what}: the lower band's rows`);
    if (rules) {
      close(upper.rule, (upper.row1 + upper.row2) / 2, `${what}: the upper hairline in the middle`);
      close(low.rule, (low.row1 + low.row2) / 2, `${what}: the lower hairline in the middle`);
    } else assert.deepEqual([upper.rule, low.rule], [null, null], what);
    if (lower === 'brand') {
      close(low.first - upper.last, 40, `${what}: twice the upper band's gap between the bands`);
      close(upper.bottom, upper.last, `${what}: the upper band keeps no end space`);
      if (rules) close(low.join, (upper.last + low.first) / 2, `${what}: the joining hairline in the middle`);
      else assert.equal(low.join, null, what);
    } else {
      close(upper.bottom - upper.last, 80, `${what}: the upper band's end space, the band space`);
      close(low.first - low.top, 20, `${what}: the lower band's start space, 1.25rem`);
      assert.equal(low.join, null, `${what}: never a hairline between two colours`);
    }
    await tab.close();
  }
});

test('on a phone, where the footer draws no hairline, its stacked cells keep the single gap', { timeout: 120000 }, async () => {
  const props = footerProps('inverse', true);
  for (const [name, browser] of browsers) {
    const tab = await open(browser, design(), footerHtml(layoutFooter(props), props), { width: 390 });
    const gaps = await tab.evaluate(() => Object.fromEntries(['upper', 'lower'].map((which) => {
      const cells = [...document.querySelectorAll(`[data-kn-band="${which}"] .kn-footer-cell`)].map((cell) => cell.getBoundingClientRect());
      return [which, cells.slice(1).map((cell, i) => cell.top - cells[i].bottom)];
    })));
    // 1.125rem, the component gap at its narrow end, and 0.5rem.
    for (const gap of gaps.upper) close(gap, 18, `${name}: the upper band's cells`);
    for (const gap of gaps.lower) close(gap, 8, `${name}: the lower band's cells`);
    await tab.close();
  }
});
