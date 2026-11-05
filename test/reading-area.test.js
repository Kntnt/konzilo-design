import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { readingColumns, breakoutBesideBlock, placeSidenotes, readingExtent, stickyEligible, setupReadingAreas } from '../src/components/reading-area.js';
import { render } from './helpers/render.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

test('columns follow the supplied measure, gap and Aside minimum, including the exact boundary', () => {
  const geometry = { narrow: 720, gap: 40, asideMin: 224 };
  assert.equal(readingColumns({ ...geometry, width: 983 }), 1);
  assert.equal(readingColumns({ ...geometry, width: 984 }), 2);
  assert.equal(readingColumns({ ...geometry, width: 984, side: 'start' }), 2);
  assert.equal(readingColumns({ ...geometry, width: 2000, side: 'none' }), 1);
  assert.equal(readingColumns({ narrow: 900, gap: 70, asideMin: 300, width: 1269 }), 1);
});

test('notes align to their anchors and later notes move below earlier notes and blocks', () => {
  assert.deepEqual(placeSidenotes({ gap: 16, notes: [{ anchor: 10, height: 80 }, { anchor: 20, height: 50 }, { anchor: 400, height: 60 }] }), [
    { top: 10, bottom: 90 }, { top: 106, bottom: 156 }, { top: 400, bottom: 460 },
  ]);
  assert.deepEqual(placeSidenotes({ gap: 16, blockBottom: 200, notes: [{ anchor: 10, height: 80 }] }), [{ top: 216, bottom: 296 }]);
});

test('a collision moves a whole note below a Breakout, including chained obstacles', () => {
  const breakouts = [{ top: 260, bottom: 400 }, { top: 100, bottom: 230 }];
  assert.deepEqual(placeSidenotes({ gap: 16, breakouts, notes: [{ anchor: 50, height: 80 }, { anchor: 300, height: 40 }] }), [
    { top: 416, bottom: 496 }, { top: 512, bottom: 552 },
  ]);
  assert.deepEqual(breakouts, [{ top: 260, bottom: 400 }, { top: 100, bottom: 230 }]);
  assert.deepEqual(placeSidenotes({ gap: 16, breakouts: [{ top: 100, bottom: 200 }], notes: [{ anchor: 0, height: 84 }, { anchor: 216, height: 10 }] }), [{ top: 0, bottom: 84 }, { top: 216, bottom: 226 }]);
});

test('an occupied Aside row keeps a Breakout narrow and does not invent an obstacle', () => {
  assert.equal(breakoutBesideBlock({ top: 100, blockBottom: 120, gap: 16 }), true);
  assert.equal(breakoutBesideBlock({ top: 135, blockBottom: 120, gap: 16 }), true);
  assert.equal(breakoutBesideBlock({ top: 136, blockBottom: 120, gap: 16 }), false);
  assert.equal(breakoutBesideBlock({ top: 0, blockBottom: 0, gap: 16 }), false);
  assert.deepEqual(placeSidenotes({ blockBottom: 120, gap: 16, notes: [{ anchor: 100, height: 20 }] }), [{ top: 136, bottom: 156 }]);
});

test('the final note extends the area, while a longer flow or Aside keeps its natural height', () => {
  assert.equal(readingExtent({ flowHeight: 500, notes: [{ bottom: 640 }] }), 640);
  assert.equal(readingExtent({ flowHeight: 800, notes: [{ bottom: 640 }] }), 800);
  assert.equal(readingExtent({ flowHeight: 50, blockBottom: 200 }), 200);
});

test('stickiness requires a fitting block and an Aside without notes or Breakouts', () => {
  const fitting = { columns: 2, height: 400, viewportHeight: 440, inset: 20, gap: 20 };
  assert.equal(stickyEligible(fitting), true);
  for (const change of [{ columns: 1 }, { height: 401 }, { notes: 1 }, { breakouts: 1 }]) assert.equal(stickyEligible({ ...fitting, ...change }), false);
});

test('the runtime measures roles, applies placement, responds to resize and restores inline flow on disposal', () => {
  const globals = ['document', 'window', 'getComputedStyle', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  function element(top = 0, height = 0) {
    const attributes = new Set();
    return {
      dataset: {}, style: new Map(), parentElement: { closest: () => null },
      getBoundingClientRect: () => ({ top, height }),
      setAttribute: (name) => attributes.add(name),
      removeAttribute: (name) => attributes.delete(name),
      hasAttribute: (name) => attributes.has(name),
      toggleAttribute(name, force) { if (force) attributes.add(name); else attributes.delete(name); },
      remove() { this.removed = true; },
    };
  }
  const area = element();
  let width = 1000;
  area.getBoundingClientRect = () => ({ top: 0, width });
  area.dataset.knSide = 'end';
  const flow = element(0, 400), block = element(0, 120);
  block.dataset.knSticky = 'true';
  const notes = [element(0, 80), element(0, 80)];
  notes.forEach((note, i) => { note.previousElementSibling = element(10 + 10 * i); });
  const breakouts = [element(80, 100), element(240, 100)];
  flow.querySelectorAll = (selector) => selector === '.kn-sidenote' ? notes : breakouts;
  area.querySelector = () => flow;
  area.querySelectorAll = () => [block];
  let measure;
  area.append = (child) => { measure = child; };
  for (const node of [area, ...notes]) {
    node.style.setProperty = node.style.set.bind(node.style);
    node.style.removeProperty = node.style.delete.bind(node.style);
  }
  let resized, disconnected = false, pending;
  const observed = [], listeners = new Map();
  try {
    globalThis.document = { documentElement: { clientHeight: 800 }, querySelectorAll: () => [area], createElement: () => element() };
    globalThis.window = { addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: (type) => listeners.delete(type) };
    globalThis.getComputedStyle = (node) => node === document.documentElement ? { fontSize: '16px' }
      : node === measure ? { inlineSize: '720px', blockSize: '224px', paddingInlineStart: '40px', paddingBlockStart: '16px' }
        : { insetBlockStart: '16px' };
    globalThis.ResizeObserver = class {
      constructor(callback) { resized = callback; }
      observe(node) { observed.push(node); }
      disconnect() { disconnected = true; }
    };
    globalThis.requestAnimationFrame = (callback) => { pending = callback; return 1; };
    globalThis.cancelAnimationFrame = () => { pending = undefined; };
    const dispose = setupReadingAreas();
    pending();
    assert.equal(area.dataset.knColumns, '2');
    assert.equal(observed.length, 8);
    assert.equal(breakouts[0].hasAttribute('data-kn-beside-block'), true);
    assert.equal(breakouts[1].hasAttribute('data-kn-beside-block'), false);
    assert.equal(notes[0].style.get('--kn-sidenote-position'), '8.5rem');
    assert.equal(notes[1].style.get('--kn-sidenote-position'), '22.25rem');
    assert.equal(area.style.get('--kn-reading-min-block-size'), '27.25rem');
    assert.equal(block.hasAttribute('data-kn-sticky-active'), false);
    width = 983;
    resized();
    pending();
    assert.equal(area.dataset.knColumns, '1');
    assert.equal(notes[0].style.has('--kn-sidenote-position'), false);
    assert.equal(breakouts[0].hasAttribute('data-kn-beside-block'), false);
    assert.equal(area.style.has('--kn-reading-min-block-size'), false);
    dispose();
    assert.equal(disconnected, true);
    assert.equal(listeners.size, 0);
    assert.equal(measure.removed, true);
  } finally {
    for (const key of globals) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else delete globalThis[key];
    }
  }
});

test('a Reading Area on a phone scrolls no one sideways, and its measure still measures', { timeout: 60000 }, async () => {
  const area = await render('ReadingArea', {}, { default: '<p>Words in the reading column.</p>', aside: '<aside class="kn-aside-block"><p>Words beside it.</p></aside>' });
  const script = `${await readFile(new URL('../src/components/reading-area.js', import.meta.url), 'utf8')}\nsetupReadingAreas();`;
  const browser = await chromium.launch();
  try {
    for (const dir of ['ltr', 'rtl']) {
      const page = await browser.newPage();
      await page.setContent(`<!doctype html><html dir="${dir}"><head><style>${coreCss(derive(defaultInputs()))}${await componentsCss()}</style></head><body data-kn-surface="page">${area.replace(/<script[\s\S]*?<\/script>/g, '')}</body></html>`);
      await page.addScriptTag({ type: 'module', content: script });
      await page.waitForSelector('.kn-reading-area-measure', { state: 'attached' });
      const narrow = await page.evaluate(() => {
        const probe = document.body.appendChild(document.createElement('div'));
        probe.style.cssText = 'position: fixed; inline-size: var(--kn-layout-narrow);';
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return width;
      });
      const look = () => page.evaluate(() => {
        const root = document.documentElement;
        const { inlineSize } = getComputedStyle(document.querySelector('.kn-reading-area-measure'));
        scrollTo(root.dir === 'rtl' ? -9999 : 9999, 0);
        const scrolled = scrollX;
        scrollTo(0, 0);
        return { overflow: root.scrollWidth - root.clientWidth, scrolled, measured: parseFloat(inlineSize), columns: document.querySelector('.kn-reading-area').dataset.knColumns };
      });
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForFunction(() => document.querySelector('.kn-reading-area').dataset.knColumns === '1');
        assert.deepEqual(await look(), { overflow: 0, scrolled: 0, measured: narrow, columns: '1' }, `${dir} at ${width} px`);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(() => document.querySelector('.kn-reading-area').dataset.knColumns === '2');
      assert.deepEqual(await look(), { overflow: 0, scrolled: 0, measured: narrow, columns: '2' }, `${dir} wide`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
