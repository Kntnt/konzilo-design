// The Reading Area in CSS alone (docs/spec/page.md, The Reading Area): the window from which two columns fit, as the
// CSS emitter works it out, checked against the clamps by brute force and in every engine against the browser's own
// arithmetic, and the two-column layout of Aside Blocks, Sidenotes and Breakouts, with script and without.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { derive, defaultInputs, readingColumnWindows, readingColumnQueries, fluidLine } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

// Designs at the ends of what the tool allows (schema: Narrow 480–960, Wide 800–1800) and one between.
const DESIGNS = {
  default: {},
  small: { layout: { narrow: 480, wide: 800 }, 'density-profile': 0 },
  large: { layout: { narrow: 960, wide: 1800 }, 'density-profile': 100 },
  measure: { layout: { narrow: 560, wide: 1440 }, 'density-profile': 40 },
  never: { layout: { narrow: 720, wide: 900 } },
  bounded: { layout: { narrow: 720, wide: 1003 }, 'density-profile': 100 },
};
const design = (inputs) => derive({ ...defaultInputs(), ...inputs });

// The same arithmetic straight from page.md's words, in px at a 16px root, with the clamps' own endpoints
// unrounded: the side margin 16–48 and the column gap over 320–1440, the content area min(window − 2 × margin, Wide).
function roomAt(r, px) {
  const fluid = ({ min, max }) => Math.min(Math.max(min, max), Math.max(Math.min(min, max), min + (max - min) * (px - 320) / 1120));
  const content = Math.min(px - 2 * fluid({ min: 16, max: 48 }), r.layout.wide);
  return content - fluid(r.space.roles['column-gap']) - r.layout.narrow - r.layout['aside-min'];
}

test('two columns start, and end where they do, exactly where the clamps leave room for Narrow, the gap and the Aside', () => {
  for (const [name, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    const windows = readingColumnWindows(r.layout, r.space.roles['column-gap']);
    // Every window wide enough, from a phone to a very wide screen, in steps of a hundredth of a rem.
    const fits = [];
    for (let px = 320; px <= 3200; px += 0.16) fits.push([px / 16, roomAt(r, px) >= 0]);
    const expected = [];
    for (let i = 0; i < fits.length; i++) {
      if (fits[i][1] && !fits[i - 1]?.[1]) expected.push({ from: fits[i][0] });
      if (!fits[i][1] && fits[i - 1]?.[1]) expected.at(-1).to = fits[i][0];
    }
    assert.equal(windows.length, expected.length, `${name}: ${JSON.stringify(windows)} for ${JSON.stringify(expected)}`);
    windows.forEach((window, i) => {
      assert.ok(Math.abs(window.from - expected[i].from) < 0.02, `${name}: from ${window.from} for ${expected[i].from}`);
      if (expected[i].to === undefined) assert.equal(window.to, null, name);
      else assert.ok(Math.abs(window.to - expected[i].to) < 0.02, `${name}: to ${window.to} for ${expected[i].to}`);
    });
  }
  assert.deepEqual(readingColumnWindows(design({}).layout, design({}).space.roles['column-gap']), [{ from: 66.5775, to: null }]);
  assert.deepEqual(readingColumnWindows(design(DESIGNS.never).layout, design(DESIGNS.never).space.roles['column-gap']), []);
  assert.equal(readingColumnWindows(design(DESIGNS.bounded).layout, design(DESIGNS.bounded).space.roles['column-gap']).length, 1);
  assert.notEqual(readingColumnWindows(design(DESIGNS.bounded).layout, design(DESIGNS.bounded).space.roles['column-gap'])[0].to, null);
});

test('the core writes one column, and the switch to two as a media query in rem on screens, and nothing else of the layout', () => {
  const css = coreCss(design({}));
  assert.match(css, /--kn-reading-columns: 1;/);
  assert.match(css, /@media screen and \(width >= 66\.5775rem\) \{\n {2}:root \{ --kn-reading-columns: 2; \}\n\}/);
  assert.equal([...css.matchAll(/--kn-reading-columns: 2/g)].length, 1);
  assert.equal(readingColumnQueries([{ from: 60, to: 80.5 }])[0], '(width >= 60rem) and (width < 80.5rem)');
  assert.match(coreCss(design(DESIGNS.bounded)), /@media screen and \(width >= 67\.2031rem\) and \(width < 84\.1702rem\)/);
  assert.doesNotMatch(coreCss(design(DESIGNS.never)), /--kn-reading-columns: 2/);
  assert.throws(() => fluidLine('1rem'), /not a fluid clamp/);
});

test('Reading Area writes no script and no count of columns', async () => {
  const html = await render('ReadingArea', { side: 'start', stack: 'after' }, { default: '<p>Words.</p>', aside: '<aside class="kn-aside-block"><p>Beside.</p></aside>' });
  assert.doesNotMatch(html, /<script|data-kn-columns/);
  assert.ok(html.indexOf('kn-reading-area-flow') < html.indexOf('kn-reading-area-aside'));
});

const BROWSERS = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let components;
before(async () => {
  components = await componentsCss();
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

const words = 'We followed the path past the old bridge and stopped where the trees opened onto a meadow. Each person noticed something different, and back at the table these small observations became sketches.';
const picture = '<svg viewBox="0 0 40 20" role="img" aria-label="Hills"><rect width="40" height="20" fill="#8a8"/></svg>';
const figure = (width, caption = 'A caption at the reading line.') => `<figure class="kn-figure" data-kn-width="${width}"><div class="kn-figure-media">${picture}</div><figcaption class="kn-figure-caption" data-kn-type="small">${caption}</figcaption></figure>`;
const note = (text) => `<aside class="kn-sidenote" data-kn-type="small"><p>${text}</p></aside>`;
const block = (sticky = false, length = 1) => `<aside class="kn-aside-block"${sticky ? ' data-kn-sticky="true"' : ''} data-kn-surface="tint"><h3 data-kn-type="heading-6">In this notebook</h3>${`<p>${words}</p>`.repeat(length)}</aside>`;
// The areas the cases need: notes and Breakouts with the Aside at the end and at the start, blocks after the flow,
// a plain one and a sticky one.
const AREAS = `
<section class="kn-band" id="notes"><div class="kn-band-content"><div class="kn-reading-area" data-kn-side="end" data-kn-stack="before">
  <div class="kn-reading-area-aside">${block()}</div>
  <div class="kn-reading-area-flow kn-body-text"><h3 id="first">A first heading</h3><p id="anchor-1">${words}</p>${note('A first note, longer than its one sentence of anchor, to stand beside the text that follows it.')}<p id="anchor-2">A short one.</p>${note('A second note, close after the first.')}${figure('wide')}<p>${words}</p><p>${words}</p><p>${words}</p><p>${words}</p><p>${words}</p>${figure('wide')}${figure('full')}<p id="anchor-3">${words}</p>${note('The last note, which may hang below the flow.<br>It has two lines at least.<br>And a third.<br>And a fourth.')}</div>
</div></div></section>
<section class="kn-band" id="start"><div class="kn-band-content"><div class="kn-reading-area" data-kn-side="start" data-kn-stack="before">
  <div class="kn-reading-area-aside">${block()}</div>
  <div class="kn-reading-area-flow kn-body-text"><p>${words}</p>${note('A note at the start side.')}<p>${words}</p>${figure('bleed-start')}<p>${words}</p><p>${words}</p><p>${words}</p><p>${words}</p>${figure('wide')}<p>${words}</p></div>
</div></div></section>
<section class="kn-band" id="after"><div class="kn-band-content"><div class="kn-reading-area" data-kn-side="end" data-kn-stack="after">
  <div class="kn-reading-area-flow kn-body-text"><p>${words}</p>${note('A note.')}<p>${words}</p></div>
  <div class="kn-reading-area-aside">${block()}</div>
</div></div></section>
<section class="kn-band" id="plain"><div class="kn-band-content"><div class="kn-reading-area" data-kn-side="end" data-kn-stack="before">
  <div class="kn-reading-area-aside">${block()}</div>
  <div class="kn-reading-area-flow kn-body-text">${`<p>${words}</p>`.repeat(3)}</div>
</div></div></section>
<section class="kn-band" id="sticky"><div class="kn-band-content"><div class="kn-reading-area" data-kn-side="end" data-kn-stack="before">
  <div class="kn-reading-area-aside">${block(true, 3)}</div>
  <div class="kn-reading-area-flow kn-body-text">${`<p>${words}</p>`.repeat(30)}</div>
</div></div></section>
<section class="kn-band" id="next"><div class="kn-band-content"><p>The next band.</p></div></section>`;

// A true text size where the engine has one for a page: Firefox's preference, Chromium's default font size. Both
// move the media query's rem with the root's, as a reader's setting does.
async function open(name, browser, { width = 1440, height = 900, text = 16, script = true, inputs = {}, print = false } = {}) {
  const own = text !== 16 && name === 'firefox' ? await firefox.launch({ firefoxUserPrefs: { 'font.size.variable.x-western': text } }) : null;
  const context = await (own ?? browser).newContext({ viewport: { width, height }, javaScriptEnabled: script });
  const tab = await context.newPage();
  if (text !== 16 && name === 'chromium') {
    const session = await context.newCDPSession(tab);
    await session.send('Page.setFontSizes', { fontSizes: { standard: text, fixed: Math.round(text * 0.8125) } });
  }
  if (print) await tab.emulateMedia({ media: 'print' });
  // No classic scrollbar, so the window the media query reads is the one the content area is cut from.
  await tab.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${coreCss(design(inputs))}${components}:root { scrollbar-width: none; }</style></head><body data-kn-surface="page"><main>${AREAS}</main></body></html>`);
  return { tab, close: async () => { await context.close(); await own?.close(); } };
}

// Where each part of an area stands, in px from the window's start edge.
const geometry = (tab, id) => tab.evaluate((id) => {
  const area = document.querySelector(`#${id} .kn-reading-area`);
  const box = (element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width }; };
  const probe = document.createElement('div');
  probe.style.cssText = 'position: absolute; box-sizing: content-box; inline-size: var(--kn-layout-narrow); padding-inline-start: var(--kn-space-column-gap); block-size: var(--kn-layout-aside-min);';
  area.append(probe);
  const { width: narrowAndGap, height: asideMin } = probe.getBoundingClientRect();
  const narrow = parseFloat(getComputedStyle(probe).inlineSize);
  probe.remove();
  return {
    area: box(area), narrow, gap: narrowAndGap - narrow, asideMin, window: document.documentElement.clientWidth,
    aside: area.querySelector('.kn-reading-area-aside') && box(area.querySelector('.kn-reading-area-aside')),
    flow: box(area.querySelector('.kn-reading-area-flow')),
    text: [...area.querySelectorAll('.kn-reading-area-flow p')].map(box),
    notes: [...area.querySelectorAll('.kn-sidenote')].map((note) => ({ ...box(note), anchor: box(note.previousElementSibling) })),
    figures: [...area.querySelectorAll('.kn-figure')].map((figure) => ({ ...box(figure), media: box(figure.querySelector('.kn-figure-media')), caption: box(figure.querySelector('figcaption')) })),
  };
}, id);
const twoColumns = (g) => Boolean(g.aside) && g.aside.top < g.flow.bottom && g.flow.top < g.aside.bottom && (g.aside.left >= g.text[0].right || g.aside.right <= g.text[0].left);
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

test('the browser switches to two columns at the window the emitter worked out, for designs at both ends, at two text sizes', { timeout: 300000 }, async () => {
  for (const [name, browser] of browsers) for (const [design_, inputs] of Object.entries(DESIGNS)) {
    const r = design(inputs);
    const windows = readingColumnWindows(r.layout, r.space.roles['column-gap']);
    const texts = design_ === 'default' && name !== 'webkit' ? [16, 24] : [16];
    for (const text of texts) {
      const at = (rem) => rem * text;
      const label = `${name}, ${design_}, ${text}px text`;
      if (!windows.length) {
        const { tab, close } = await open(name, browser, { width: 2400, inputs, text });
        assert.equal(twoColumns(await geometry(tab, 'plain')), false, `${label}: one column at any width`);
        await close();
        continue;
      }
      const { from, to } = windows[0];
      const cases = [[Math.floor(at(from)) - 1, false], [Math.ceil(at(from)) + 1, true]];
      if (to !== null) cases.push([Math.floor(at(to)) - 1, true], [Math.ceil(at(to)) + 1, false]);
      for (const [width, two] of cases) {
        const { tab, close } = await open(name, browser, { width, inputs, text });
        const g = await geometry(tab, 'plain');
        assert.equal(twoColumns(g), two, `${label} at ${width}px`);
        // The Aside is its minimum plus the room the arithmetic finds at this window, as the browser's clamps make it.
        if (two) {
          const expected = g.asideMin + roomAt(r, width * 16 / text) * text / 16;
          assert.ok(near(g.aside.width, expected, 0.75), `${label} at ${width}px: the Aside is ${g.aside.width} for ${expected}`);
        }
        await close();
      }
    }
  }
});

test('Sidenotes stand in the Aside below the blocks and one another, after their anchors, and the area holds the last', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(name, browser);
    const g = await geometry(tab, 'notes');
    const readingEnd = g.text[0].right;
    assert.ok(near(g.text[0].width, g.narrow), `${name}: the text keeps Narrow`);
    g.notes.forEach((n, i) => {
      assert.ok(n.left >= readingEnd + g.gap - 1 && near(n.right, g.area.right), `${name}: note ${i} in the Aside`);
      assert.ok(n.top >= n.anchor.bottom - 1, `${name}: note ${i} after its anchor`);
      if (i) assert.ok(n.top >= g.notes[i - 1].bottom, `${name}: note ${i} below the one before`);
    });
    assert.ok(g.notes[0].top >= g.aside.bottom, `${name}: below the Aside Block`);
    assert.ok(g.area.bottom >= g.notes.at(-1).bottom - 0.5, `${name}: the area holds the last note`);
    const next = await tab.$eval('#next', (band) => band.getBoundingClientRect().top + scrollY);
    assert.ok(next >= g.notes.at(-1).bottom, `${name}: the next band starts after it`);
    await close();
  }
});

test('a Breakout beside a float keeps Narrow, and elsewhere wide takes the content area and full the window, its caption at the reading line', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(name, browser);
    const g = await geometry(tab, 'notes');
    const [beside, wide, full] = g.figures;
    assert.ok(near(beside.width, g.narrow) && near(beside.left, g.area.left), `${name}: beside the block, ${beside.width} for ${g.narrow}`);
    assert.ok(near(wide.width, g.area.width) && near(wide.left, g.area.left), `${name}: wide, ${wide.width} for ${g.area.width}`);
    assert.ok(near(full.media.left, 0) && near(full.media.width, g.window), `${name}: full reaches both edges`);
    for (const figure of g.figures) assert.ok(near(figure.caption.left, g.area.left) && figure.caption.width <= g.narrow + 1, `${name}: a caption at the reading line`);
    // Mirrored, with the Aside at the start.
    const s = await geometry(tab, 'start');
    const [bleed, wideStart] = s.figures;
    assert.ok(near(s.text[0].right, s.area.right) && near(s.text[0].width, s.narrow), `${name}: the text at the end`);
    assert.ok(s.notes[0].right <= s.text[0].left - s.gap + 1, `${name}: the note at the start`);
    assert.ok(near(wideStart.width, s.area.width), `${name}: wide below the floats`);
    assert.ok(near(bleed.width, s.narrow) || near(bleed.media.left, 0), `${name}: a one-sided Breakout is Narrow beside a float, or reaches its edge`);
    for (const figure of s.figures) assert.ok(near(figure.caption.right, s.area.right, 1.5) || near(figure.caption.left, s.text[0].left, 1.5), `${name}: its caption at the reading line`);
    await close();
  }
});

test('blocks written after a flow with notes stand after it at the reading line, and a plain area puts them beside it', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(name, browser);
    const g = await geometry(tab, 'after');
    assert.ok(g.aside.top >= Math.max(g.flow.bottom, ...g.notes.map((n) => n.bottom)) - 1 && near(g.aside.left, g.area.left) && near(g.aside.width, g.narrow), `${name}: ${JSON.stringify(g.aside)}`);
    assert.equal(twoColumns(await geometry(tab, 'plain')), true, name);
    await close();
  }
});

test('a sticky Aside Block stays under the header, and one taller than the window scrolls inside itself', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const height of [900, 300]) {
    const { tab, close } = await open(name, browser, { height });
    const found = await tab.evaluate(() => {
      const block = document.querySelector('#sticky .kn-aside-block');
      const flow = document.querySelector('#sticky .kn-reading-area-flow');
      scrollTo(0, flow.getBoundingClientRect().top + scrollY + 300);
      const inset = parseFloat(getComputedStyle(block).insetBlockStart);
      const box = block.getBoundingClientRect();
      return { position: getComputedStyle(block).position, atInset: Math.abs(box.top - inset) < 1.5, inside: box.bottom <= innerHeight + 0.5, scrolls: block.scrollHeight > block.clientHeight + 1 };
    });
    assert.deepEqual(found, { position: 'sticky', atInset: true, inside: true, scrolls: height === 300 }, `${name} at ${height}px high`);
    // Where notes or Breakouts reach into the Aside nothing sticks.
    assert.equal(await tab.$eval('#notes .kn-aside-block', (b) => getComputedStyle(b).position), 'static', name);
    await close();
  }
});

test('the page is laid out at first paint: the same with script and without, and no window scrolls sideways', { timeout: 300000 }, async () => {
  for (const [name, browser] of browsers) {
    for (const width of [390, 768, 1024, 1440]) {
      const seen = [];
      for (const script of [true, false]) {
        const { tab, close } = await open(name, browser, { width, script });
        seen.push(await tab.evaluate(() => [...document.querySelectorAll('.kn-sidenote, .kn-figure, .kn-aside-block, #next')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width)]; })));
        await close();
      }
      assert.deepEqual(seen[1], seen[0], `${name} at ${width}`);
    }
    for (const text of name === 'webkit' ? [16] : [16, 24]) for (const width of [390, 768, 1024, 1440]) {
      const { tab, close } = await open(name, browser, { width, text });
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${name} at ${width}, ${text}px text`);
      await close();
    }
  }
});

test('on paper a Reading Area is one column in document order', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(name, browser, { print: true });
    for (const id of ['notes', 'plain']) assert.equal(twoColumns(await geometry(tab, id)), false, `${name}: ${id}`);
    await close();
  }
});
