// A plate finds its ground by CSS (docs/spec/plates.md, A plate finds its ground): a part the design puts on a plate of
// its own, written with the Surface surfaceOf gives it without its ground, comes out as surfaceOf would have it on the
// ground it stands on, nested three deep on every Surface, in light and dark mode, in Gecko, WebKit and Chromium; and a
// Surface written for its ground keeps the kind it names.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { surfaceOf, sameGroundPlates } from '../src/directives/surfaces.js';
import * as directives from '../src/directives/index.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { comparePlates, plateGroundPage } from './helpers/plate-ground.js';

const PARTS = ['link-card', 'action-card', 'behind-card', 'fact-box', 'choice-answer', 'choice-panel'];
// Three brand colours, so that every Surface kind there is stands as a ground.
const resolved = derive({ ...defaultInputs(), 'brand-colors': { primary: '#168b83', secondary: '#c76532', tertiary: '#8646b0' } });
const core = coreCss(resolved);

test('surfaceOf gives the same Surface without a ground as on the page', () => {
  for (const part of PARTS) {
    assert.equal(surfaceOf(part), surfaceOf(part, undefined), part);
    assert.equal(surfaceOf(part), surfaceOf(part, 'page'), part);
  }
  assert.equal(surfaceOf('card'), null);
  assert.equal(directives.sameGroundPlates, undefined, 'the pairs are the core\'s, not a site\'s');
});

test('the core gives a part on a ground of its own kind the other plate, for exactly the pairs surfaceOf holds, with that plate\'s own declarations', () => {
  const pairs = new Map(PARTS.map((part) => [surfaceOf(part), surfaceOf(part, surfaceOf(part))]).filter(([alone, on]) => alone !== on));
  assert.deepEqual(sameGroundPlates().map(({ ground, surface }) => [ground, surface]), [...pairs]);
  const block = (kind) => core.match(new RegExp(`(?:^|\\n)\\[data-kn-surface="${kind}"\\] \\{\\n([^}]*)\\n\\}`))[1];
  for (const kind of Object.keys(resolved.surfaces)) assert.match(block(kind), new RegExp(`^ {2}--kn-surface-kind: ${kind};$`, 'm'), kind);
  for (const { ground, surface, selector } of sameGroundPlates()) {
    const rule = core.match(new RegExp(`@container style\\(--kn-surface-kind: ${ground}\\) \\{\\n(.*)\\[data-kn-surface="${ground}"\\] \\{\\n([^}]*)\\n\\}\\n\\}`));
    assert.ok(rule, `${ground} on ${ground}`);
    assert.equal(rule[1], selector);
    assert.equal(rule[2], block(surface), `${ground} on ${ground} takes all of ${surface}'s block, its contrast checked`);
  }
  // The kind steers nothing else: only these rules read it.
  assert.deepEqual([...core.matchAll(/--kn-surface-kind(?!: [\w-]+;)[^)]*\)/g)].map(([found]) => found).sort(), sameGroundPlates().map(({ ground }) => `--kn-surface-kind: ${ground})`).sort());
});

const ENGINES = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
let css, names;
const browsers = [];
before(async () => {
  css = `${core}${await componentsCss()}`;
  assert.doesNotMatch(css.slice(core.length), /--kn-surface-kind/, 'no component reads the kind');
  names = [...new Set([...core.matchAll(/(--kn-[\w-]+)\s*:/g)].map(([, name]) => name))];
  for (const [name, type] of ENGINES) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

test('a plate written without its ground comes out as surfaceOf would have it on its ground, nested three deep on every Surface, in light and dark mode, in every engine', { timeout: 600000 }, async () => {
  const kinds = Object.keys(resolved.surfaces);
  for (const mode of ['light', 'dark']) {
    const page = plateGroundPage(css, kinds, mode);
    // What the browser must find: every plate written for its ground, and those whose Surface differs from the one
    // written without it.
    const written = [...page.matchAll(/<div data-case="[^"]*">(<section[^>]*data-version="without"[^>]*>[\s\S]*?<\/section>)(<section[^>]*data-version="with"[^>]*>[\s\S]*?<\/section>)<\/div>/g)]
      .map(([, without, known]) => [without, known].map((band) => [...band.matchAll(/data-kn-surface="([\w-]+)"/g)].slice(band.match(/^<section[^>]*data-kn-surface/) ? 1 : 0).map(([, kind]) => kind)));
    const plates = written.reduce((sum, [, known]) => sum + known.length, 0);
    const turned = written.reduce((sum, [without, known]) => sum + known.filter((kind, i) => kind !== without[i]).length, 0);
    assert.ok(turned > 0 && turned < plates);
    for (const [name, browser] of browsers) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const tab = await context.newPage();
      await tab.setContent(page);
      const found = await tab.evaluate(comparePlates, names);
      await context.close();
      assert.deepEqual(found.problems.slice(0, 12), [], `${name}, ${mode}: ${found.problems.length} problems`);
      assert.deepEqual([found.plates, found.turned], [plates, turned], `${name}, ${mode}`);
    }
  }
});

test('a Surface written for its ground keeps the kind it names, in every fixture of the directives, in every engine', { timeout: 120000 }, async () => {
  for (const fixture of ['directives-section', 'directives-lists', 'directives-cards', 'directives-panels']) {
    const body = await readFile(new URL(`fixtures/${fixture}.html`, import.meta.url), 'utf8');
    for (const [name, browser] of browsers) for (const mode of ['light', 'dark']) {
      const context = await browser.newContext();
      const tab = await context.newPage();
      await tab.setContent(`<!doctype html><html lang="en" data-kn-mode="${mode}"><head><style>${css}</style></head><body data-kn-surface="page">${body}</body></html>`);
      const moved = await tab.$$eval('[data-kn-surface]', (plates) => plates.filter((plate) => getComputedStyle(plate).getPropertyValue('--kn-surface-kind').trim() !== plate.dataset.knSurface).map((plate) => `${plate.className}: ${plate.dataset.knSurface}`));
      await context.close();
      assert.deepEqual(moved, [], `${fixture}, ${name}, ${mode}`);
    }
  }
});
