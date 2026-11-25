// A following menu marks the link of the section being read (directives.md, `toc`; the owner, 2026-11-23 and
// 2026-11-25): Chromium by its CSS scroll markers, with no script, and Firefox and WebKit by a polyfill that marks the
// same link at the same scroll positions, loaded only where the browser lacks them. With script off nothing is marked.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { testDesign, treeOf } from './helpers/konzilo-body.js';
import { designPage } from '../src/directives/render/context.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const ORIGIN = 'http://kn.test';
const POLYFILL = 'scroll-markers-polyfill.js';

// Blocks of a fixed height stand for the text, so a page is laid out alike in every engine, and its headings stand where
// a link's rule has something to decide: a section shorter than half the window, and the last ones the page cannot
// scroll to the top of.
const filler = (rem) => `<div class="kn-test-filler" style="block-size: ${rem}rem"></div>`;
const SECTIONS = [['Soil', 30], ['Water', 4], ['Light', 18], ['Seeds', 2], ['Tools', 25], ['Harvest', 10], ['Winter', 6]];
const tocMarkdown = `:::toc\n\nIn depth\n\n${SECTIONS.map(([heading, rem]) => `### ${heading}\n\n${filler(rem)}`).join('\n\n')}\n\n:::`;
const identity = { label: 'Example', href: '#home', name: 'Example' };

// The loader every following menu ends with, word for word, so its text is the same on every page of a build, as the
// Konzilo core's content security policy needs; the test's components give the polyfill's address as Vite would.
const LOADER = '<script data-kn-polyfill="scroll-markers">(function(){const src = "/_astro/scroll-markers-polyfill.js";\nif (!CSS.supports(\'scroll-target-group: auto\')) import(src);})();</script>';
const loaders = (html) => html.split('data-kn-polyfill').length - 1;
const endsWithLoader = (html) => html.replace(/>\s+</g, '><').includes(`</ol>${LOADER}</nav>`);
const HEADINGS = [{ depth: 2, slug: 'soil', text: 'Soil' }, { depth: 3, slug: 'clay', text: 'Clay' }, { depth: 2, slug: 'water', text: 'Water' }];

test('each component that draws a following menu ends it with the polyfill\'s loader, and nothing else writes one', async () => {
  const locals = {};
  designPage({ locals }, { design: testDesign(), title: 'Planning a garden' });
  const tree = treeOf(tocMarkdown);
  const toc = await render('directives/astro/Toc', { content: tree.content, ...tree.attributes }, undefined, { locals });
  assert.ok(endsWithLoader(toc), toc);
  assert.equal(loaders(toc), 1);
  const body = '<p>The lede.</p><h2 id="soil">Soil</h2><p>Words.</p><h2 id="water">Water</h2><p>Words.</p>';
  const article = await render('page-parts/ArticleBody', {}, { default: body }, { locals });
  assert.ok(endsWithLoader(article), article);
  assert.equal(loaders(article), 1);
  // No following menu, no loader: none asked for, an Aside of the type's own, or fewer than two stops.
  assert.equal(loaders(await render('page-parts/ArticleBody', { menu: false }, { default: body }, { locals })), 0);
  assert.equal(loaders(await render('page-parts/ArticleBody', {}, { default: body, aside: '<aside class="kn-aside-block">Facts</aside>' }, { locals })), 0);
  assert.equal(loaders(await render('page-parts/ArticleBody', {}, { default: '<h2 id="soil">Soil</h2>' }, { locals })), 0);
  const following = await render('TableOfContents', { headings: HEADINGS, depth: 3, 'data-kn-follow': true });
  assert.ok(endsWithLoader(following), following);
  assert.equal(loaders(following), 1);
  // A Table of Contents that does not follow is as it was.
  assert.equal(loaders(await render('TableOfContents', { headings: HEADINGS, depth: 3 })), 0);
  assert.equal(loaders(await render('TableOfContents', { headings: HEADINGS.slice(0, 1) })), 0, 'no menu, no loader');
});

async function pages() {
  const css = coreCss(derive(defaultInputs())) + await componentsCss();
  const locals = {};
  designPage({ locals }, { design: testDesign(), title: 'Planning a garden' });
  const tree = treeOf(tocMarkdown);
  const toc = await render('directives/astro/Toc', { content: tree.content, ...tree.attributes }, undefined, { locals });
  const section = (inner, surface) => `<section class="kn-band kn-section"${surface ? ` data-kn-surface="${surface}"` : ''}><div class="kn-band-content"><div class="kn-section-body kn-body-text">${inner}</div></div></section>`;
  const band = (rem, surface) => `<section class="kn-band"${surface ? ` data-kn-surface="${surface}"` : ''}><div class="kn-band-content">${filler(rem)}</div></section>`;
  const header = await render('Header', { identity, menu: [], attachment: 'sticky' });
  const page = async (body, { sticky = true, mode = 'light' } = {}) => `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><title>Menu</title><style>${css}</style></head><body>${
    await render('Page', {}, { ...(sticky ? { header } : {}), default: body })}</body></html>`;
  // A Table of Contents that does not follow, beside a following menu whose polyfill runs on the page.
  const plain = await render('TableOfContents', { headings: SECTIONS.map(([text]) => ({ depth: 2, slug: text.toLowerCase(), text })) });
  const looks = {};
  for (const mode of MODES) for (const surface of SURFACES) looks[`/look-${surface}-${mode}.html`] = await page(band(24) + section(toc, surface === 'page' ? undefined : surface) + band(4), { mode });
  return {
    '/toc.html': await page(band(24, 'brand') + section(toc) + band(4)),
    '/top.html': await page(section(toc), { sticky: false }),
    '/plain.html': await page(section(plain) + section(toc) + band(4)),
    ...looks,
  };
}
const MODES = ['light', 'dark'];
// Surfaces a section, and with it the Aside its menu stands in, may take.
const SURFACES = ['page', 'tint', 'brand', 'inverse'];

const browsers = [];
let files;
before(async () => {
  files = await pages();
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// `lacking`: Chromium told it lacks scroll markers, so the loader fetches the polyfill there too, beside the native marker.
async function open(browser, path, { width = 1280, height = 700, script = true, lacking = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: script, reducedMotion: 'reduce' });
  if (lacking) await context.addInitScript(() => { const supports = CSS.supports.bind(CSS); CSS.supports = (...args) => (String(args.join(':')).replace(/\s/g, '') === 'scroll-target-group:auto' ? false : supports(...args)); });
  const loaded = [];
  await context.route(`${ORIGIN}/**`, async (route) => {
    const file = new URL(route.request().url()).pathname;
    if (file.startsWith('/_astro/')) {
      loaded.push(file.slice(8));
      return route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL(`../src/components/${file.slice(8)}`, import.meta.url), 'utf8') });
    }
    return files[file] ? route.fulfill({ contentType: 'text/html', body: files[file] }) : route.fulfill({ status: 404 });
  });
  const tab = await context.newPage();
  await tab.goto(`${ORIGIN}${path}`);
  await tab.waitForTimeout(200);
  return { tab, loaded, close: () => context.close() };
}

// What each following menu marks: by the native marker, by the polyfill's state, and by its look, the link whose bar on
// the rail is not transparent.
const marks = (tab) => tab.evaluate(() => [...document.querySelectorAll('.kn-toc[data-kn-follow]')].map((menu) => {
  const links = [...menu.querySelectorAll('a')];
  const native = links.filter((link) => { try { return link.matches(':target-current'); } catch { return false; } });
  return {
    native: native.map((link) => link.hash),
    polyfill: links.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.hash),
    look: links.filter((link) => getComputedStyle(link).borderInlineStartColor !== 'rgba(0, 0, 0, 0)').map((link) => link.hash),
  };
}));
const frames = (tab) => tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
const scrollTo = async (tab, y) => { await tab.evaluate((to) => scrollTo(0, to), y); await frames(tab); };

test('in Chromium the CSS alone marks the link of the section being read, with no script loaded for it', { timeout: 120000 }, async () => {
  const [, browser] = browsers.find(([name]) => name === 'chromium') ?? [];
  if (!browser) return;
  const { tab, loaded, close } = await open(browser, '/toc.html');
  try {
    await scrollTo(tab, 0);
    assert.deepEqual(await marks(tab), [{ native: ['#soil'], polyfill: [], look: ['#soil'] }]);
    // Where a click on its link takes the reader: the heading at the reading line, under the header.
    await tab.$eval('#water', (heading) => heading.scrollIntoView());
    await frames(tab);
    assert.deepEqual(await marks(tab), [{ native: ['#water'], polyfill: [], look: ['#water'] }]);
    await scrollTo(tab, 1e6);
    assert.deepEqual(await marks(tab), [{ native: ['#winter'], polyfill: [], look: ['#winter'] }], 'the last at the page\'s end');
    assert.ok(!loaded.includes(POLYFILL), `no polyfill: ${loaded}`);
  } finally { await close(); }
});

// Every scroll position from the top to the end, in steps of 7 to 13 pixels, down and back up, and what each menu marks
// at each, read once the browser has painted it; and, between two positions where the mark moved, the pixel it moved
// at, each way.
const walk = (tab) => tab.evaluate(async () => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const read = () => [...document.querySelectorAll('.kn-toc[data-kn-follow]')].map((menu) => {
    const links = [...menu.querySelectorAll('a')];
    return {
      native: links.filter((link) => { try { return link.matches(':target-current'); } catch { return false; } }).map((link) => link.hash).join(),
      polyfill: links.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.hash).join(),
      look: links.filter((link) => getComputedStyle(link).borderInlineStartColor !== 'rgba(0, 0, 0, 0)').map((link) => link.hash).join(),
    };
  });
  const markOf = (menus) => menus.map(({ native, polyfill }) => native || polyfill).join(' ');
  const root = document.documentElement, end = root.scrollHeight - root.clientHeight, steps = [7, 9, 11, 13], ys = [];
  for (let y = 0, at = 0; y < end; y += steps[at++ % steps.length]) ys.push(y);
  ys.push(end);
  const samples = [], moves = { down: [], up: [] };
  for (const [way, path] of [['down', ys], ['up', ys.toReversed()]]) {
    let last;
    for (const y of path) {
      scrollTo(0, y);
      await frame();
      const menus = read();
      samples.push({ y: scrollY, menus });
      if (last !== undefined && markOf(menus) !== last.mark) {
        const by = way === 'down' ? 1 : -1;
        let at = last.y + by;
        for (; at !== y; at += by) { scrollTo(0, at); await frame(); if (markOf(read()) === markOf(menus)) break; }
        moves[way].push([at, markOf(menus)]);
      }
      last = { y, mark: markOf(menus) };
    }
  }
  return { samples, moves };
});
// Where each heading stands on the page, which must be the same in each engine for their marks to be compared.
const layout = (tab) => tab.evaluate(() => ({
  end: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  headings: [...document.querySelectorAll('.kn-reading-area-flow h3')].map((heading) => Math.round(heading.getBoundingClientRect().top + scrollY)),
}));

test('the polyfill marks the link Chromium marks, at every scroll position, down and up, to the page\'s end, at three widths', { timeout: 240000 }, async () => {
  const [, browser] = browsers.find(([name]) => name === 'chromium') ?? [];
  if (!browser) return;
  for (const [path, width] of [['/toc.html', 1280], ['/toc.html', 768], ['/toc.html', 390], ['/top.html', 1280]]) {
    const { tab, loaded, close } = await open(browser, path, { width, lacking: true });
    try {
      assert.deepEqual(loaded.filter((file) => file === POLYFILL), [POLYFILL], `${path} at ${width}: the polyfill loads once`);
      const { samples } = await walk(tab);
      const differ = samples.filter(({ menus }) => menus.some(({ native, polyfill }) => native !== polyfill));
      assert.deepEqual(differ, [], `${path} at ${width}: ${differ.length} of ${samples.length} positions differ`);
      const marked = new Set(samples.flatMap(({ menus }) => menus.map(({ native }) => native)));
      assert.ok(!marked.has(''), `${path} at ${width}: a link is marked at every position`);
      assert.equal(marked.size, SECTIONS.length, `${path} at ${width}: every link is marked somewhere: ${[...marked]}`);
    } finally { await close(); }
  }
});

test('in Firefox and WebKit the polyfill loads and marks the link Chromium marks, at the same scroll positions, down and up', { timeout: 240000 }, async () => {
  const seen = {};
  for (const [name, browser] of browsers) {
    const { tab, loaded, close } = await open(browser, '/toc.html');
    try {
      const native = name === 'chromium';
      assert.deepEqual(loaded.filter((file) => file === POLYFILL), native ? [] : [POLYFILL], `${name}: ${loaded}`);
      const { samples, moves } = await walk(tab);
      seen[name] = { layout: await layout(tab), moves };
      for (const { y, menus } of samples) for (const { native: marker, polyfill, look } of menus) {
        assert.notEqual(native ? marker : polyfill, '', `${name} at ${y}: a link is marked`);
        assert.equal(native ? polyfill : marker, '', `${name} at ${y}: only ${native ? 'the native marker' : 'the polyfill'} marks`);
        assert.equal(look, native ? marker : polyfill, `${name} at ${y}: the mark is drawn`);
      }
    } finally { await close(); }
  }
  const { chromium: reference, ...others } = seen;
  if (!reference) return;
  for (const [name, found] of Object.entries(others)) {
    // Each engine lays a page out to its own fraction of a pixel, and rounds its end to a whole one, so a mark may move
    // a pixel apart.
    assert.deepEqual(found.layout.headings, reference.layout.headings, `${name}: the page is laid out as in Chromium`);
    assert.ok(Math.abs(found.layout.end - reference.layout.end) <= 1, `${name}: it ends at ${found.layout.end}, in Chromium at ${reference.layout.end}`);
    for (const way of ['down', 'up']) {
      assert.deepEqual(found.moves[way].map(([, mark]) => mark), reference.moves[way].map(([, mark]) => mark), `${name}, ${way}: the same links in turn`);
      const apart = found.moves[way].map(([at, mark], index) => [mark, at - reference.moves[way][index][0]]).filter(([, by]) => Math.abs(by) > 1);
      assert.deepEqual(apart, [], `${name}, ${way}: each mark moves where Chromium's does`);
    }
  }
});

// The colours of a menu's links, with those of the text, the muted text and the accent where the menu stands.
const colours = (tab) => tab.evaluate(() => {
  const menu = document.querySelector('.kn-toc[data-kn-follow]');
  const probe = menu.appendChild(document.createElement('i'));
  const colour = (value) => { probe.style.color = value; return getComputedStyle(probe).color; };
  const roles = { text: colour('var(--kn-text)'), muted: colour('var(--kn-text-muted)'), accent: colour('var(--kn-accent)') };
  probe.remove();
  return { roles, links: [...menu.querySelectorAll('a')].map((link) => ({ href: link.hash, color: getComputedStyle(link).color, bar: getComputedStyle(link).borderInlineStartColor })) };
});
// Firefox with script off calls no animation frame back, not even the test's own, so there the test waits a while instead.
const toWater = async (tab, { script = true } = {}) => { await tab.$eval('#water', (heading) => heading.scrollIntoView()); if (script) await frames(tab); await tab.waitForTimeout(script ? 100 : 300); };

test('the mark is the text colour with an accent bar on the rail, the same in all three engines, in both modes, on each Surface', { timeout: 240000 }, async () => {
  const seen = {};
  for (const [name, browser] of browsers) for (const mode of MODES) for (const surface of SURFACES) {
    const { tab, close } = await open(browser, `/look-${surface}-${mode}.html`);
    try {
      await toWater(tab);
      const { roles, links } = await colours(tab);
      const label = `${name}, ${mode}, ${surface}`;
      assert.notEqual(roles.text, roles.muted, label);
      for (const { href, color, bar } of links) {
        if (href === '#water') assert.deepEqual({ color, bar }, { color: roles.text, bar: roles.accent }, `${label}: the current link`);
        else assert.deepEqual({ color, bar }, { color: roles.muted, bar: 'rgba(0, 0, 0, 0)' }, `${label}: ${href}`);
      }
      (seen[`${mode} ${surface}`] ??= {})[name] = links;
    } finally { await close(); }
  }
  for (const [where, engines] of Object.entries(seen)) {
    const [[first, links], ...rest] = Object.entries(engines);
    for (const [name, other] of rest) assert.deepEqual(other, links, `${where}: ${name} as ${first}`);
  }
});

test('with script off in Firefox nothing is marked and the menu is as it was; a Table of Contents that does not follow is unchanged in every engine', { timeout: 240000 }, async () => {
  const look = (tab) => tab.evaluate(() => [...document.querySelectorAll('.kn-toc')].map((menu) => ({
    follows: menu.hasAttribute('data-kn-follow'),
    height: menu.getBoundingClientRect().height,
    group: getComputedStyle(menu).scrollTargetGroup ?? 'none',
    links: [...menu.querySelectorAll('a')].map((link) => {
      const style = getComputedStyle(link);
      return { current: link.getAttribute('aria-current'), color: style.color, bar: style.borderInlineStartWidth === '0px' ? 'none' : style.borderInlineStartColor };
    }),
  })));
  for (const [name, browser] of browsers) {
    const pages = {};
    for (const script of [true, false]) {
      if (!script && name !== 'firefox') continue;
      const { tab, loaded, close } = await open(browser, '/plain.html', { script });
      try {
        await toWater(tab, { script });
        pages[script] = await look(tab);
        if (!script) assert.ok(!loaded.includes(POLYFILL), `${name}: no polyfill without script`);
      } finally { await close(); }
    }
    const [plain, following] = pages[true];
    assert.deepEqual([plain.follows, following.follows], [false, true], name);
    assert.equal(plain.group, 'none', `${name}: a menu that does not follow is no group of scroll markers`);
    assert.ok(plain.links.every(({ current, bar }) => current === null && bar === 'none'), `${name}: nothing marks a menu that does not follow, and it has no rail: ${JSON.stringify(plain.links)}`);
    assert.equal(following.links.filter(({ bar }) => bar !== 'rgba(0, 0, 0, 0)').length, 1, `${name}: the following menu beside it is marked`);
    if (name !== 'firefox') continue;
    const [plainOff, followingOff] = pages[false];
    assert.deepEqual(plainOff, plain, 'firefox: a menu that does not follow is the same with script and without');
    assert.ok(followingOff.links.every(({ current, color, bar }) => current === null && color === followingOff.links[0].color && bar === 'rgba(0, 0, 0, 0)'), 'firefox without script: nothing marked');
    assert.equal(followingOff.height, following.height, 'firefox: the menu keeps its height');
  }
});
