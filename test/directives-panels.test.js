// Package D of the directives (docs/spec/directives.md): accordion, tabs, choice, toc, an article's following menu
// and a fact box. Their facts and decisions in Node, and their markup and stylesheet in every engine Playwright has
// here, with script and without: none of them runs one (docs/spec/principles.md).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { allQuestions, panelParts } from '../src/directives/index.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

test('an accordion is of questions where every heading, trimmed, ends in a question mark', () => {
  assert.equal(allQuestions(['How long does it take?', ' Can I come along? ']), true);
  assert.equal(allQuestions(['Wie lange dauert es？', 'هل يمكنني المجيء؟']), true);
  assert.equal(allQuestions(['How long does it take?', 'Opening hours']), false);
  assert.equal(allQuestions([]), false);
  assert.equal(allQuestions(['Is it?!']), false);
});

test('a tab\'s panel is text and then components, both there, or it keeps its order', () => {
  const blocks = (...kinds) => kinds.map((kind) => ({ component: kind === 'c' }));
  assert.deepEqual(panelParts(blocks('t', 't', 'c')), { text: [0, 1], parts: [2] });
  assert.deepEqual(panelParts(blocks('t', 'c', 'c')), { text: [0], parts: [1, 2] });
  for (const kinds of [['t', 't'], ['c', 'c'], ['c', 't'], ['t', 'c', 't'], []]) assert.equal(panelParts(blocks(...kinds)), null, kinds.join(''));
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
let styles, fixture;
const browsers = [];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  fixture = await readFile(new URL('fixtures/directives-panels.html', import.meta.url), 'utf8');
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function open(browser, { width = 1280, height = 800, text = 16, script = true, dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: script });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en" dir="${dir}" style="font-size: ${text}px"><head><style>${styles}</style></head><body data-kn-surface="page">${fixture}<div style="block-size: 100vh"></div></body></html>`);
  return { tab, close: () => context.close() };
}
const shown = (tab, selector) => tab.$$eval(selector, (elements) => elements.map((element) => element.checkVisibility()));
const opened = (tab, selector) => tab.$$eval(selector, (items) => items.map((item) => item.open));
const tabs = '#plans .kn-tabs-item', answers = '#start .kn-choice-item';

test('tabs and a choice need no script: the first tab open and no answer, and the page is the same without script', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const pages = [];
    for (const script of [true, false]) {
      const { tab, close } = await open(browser, { script });
      pages.push(await tab.evaluate(() => ({
        tabs: [...document.querySelectorAll('.kn-tabs-panel')].map((panel) => panel.checkVisibility()),
        answers: [...document.querySelectorAll('.kn-choice-panel')].map((panel) => panel.checkVisibility()),
        below: document.querySelector('#guide').getBoundingClientRect().top + scrollY,
      })));
      await close();
    }
    assert.deepEqual(pages[0], { ...pages[0], tabs: [true, false, false], answers: [false, false] }, name);
    assert.deepEqual(pages[1], pages[0], `${name}: nothing moves without script`);
  }
});

test('tabs stand in a row over the open panel; a click or Enter opens one and closes the others, and a click on the open tab keeps it', { timeout: 120000 }, async () => {
  const geometry = (tab) => tab.evaluate(() => {
    const summaries = [...document.querySelectorAll('#plans .kn-tabs-tab')].map((summary) => summary.getBoundingClientRect());
    const panel = [...document.querySelectorAll('#plans .kn-tabs-panel')].find((element) => element.checkVisibility()).getBoundingClientRect();
    return { row: summaries.every((box) => Math.abs(box.top - summaries[0].top) < 1), below: summaries.every((box) => box.bottom <= panel.top + 0.5), order: summaries.map((box) => Math.round(box.left)) };
  });
  for (const [name, browser] of browsers) for (const script of [true, false]) {
    const label = `${name}${script ? '' : ' without script'}`;
    const { tab, close } = await open(browser, { script });
    let found = await geometry(tab);
    assert.equal(found.row && found.below, true, `${label}: ${JSON.stringify(found)}`);
    assert.ok(found.order[0] < found.order[1] && found.order[1] < found.order[2], label);
    await tab.click('#plans .kn-tabs-tab >> nth=1');
    assert.deepEqual(await opened(tab, tabs), [false, true, false], label);
    assert.deepEqual(await shown(tab, '#plans .kn-tabs-panel'), [false, true, false], label);
    assert.equal((await geometry(tab)).below, true, label);
    await tab.click('#plans .kn-tabs-tab >> nth=1', { force: true });
    assert.deepEqual(await opened(tab, tabs), [false, true, false], `${label}: a click on the open tab keeps it`);
    await tab.focus('#plans .kn-tabs-tab >> nth=2');
    await tab.keyboard.press('Enter');
    assert.deepEqual(await opened(tab, tabs), [false, false, true], `${label}: Enter`);
    await close();
  }
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser, { dir: 'rtl' });
    const { order } = await geometry(tab);
    assert.ok(order[0] > order[1] && order[1] > order[2], `${name}: in right-to-left the row runs from the right`);
    await close();
  }
});

test('Tab reaches every tab, each followed by what its open panel holds, and the tabs are buttons that say whether they are open', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    await tab.focus('#plans .kn-tabs-tab >> nth=0');
    const seen = [];
    for (let i = 0; i < 8; i++) {
      seen.push(await tab.evaluate(() => document.activeElement.matches('.kn-tabs-tab') ? `tab ${[...document.querySelectorAll('#plans .kn-tabs-tab')].indexOf(document.activeElement)}` : document.activeElement.closest('.kn-tabs-panel') ? 'panel' : 'after'));
      await tab.keyboard.press('Tab');
    }
    const order = seen.filter((stop, i) => stop !== seen[i - 1]);
    assert.deepEqual(order.slice(0, 4), ['tab 0', 'panel', 'tab 1', 'tab 2'], `${name}: ${seen.join(', ')}`);
    if (name === 'chromium') {
      // What a screen reader is told, from the browser's own accessibility tree.
      const session = await tab.context().newCDPSession(tab);
      const { nodes } = await session.send('Accessibility.getFullAXTree');
      const state = (label) => nodes.filter((node) => node.name?.value === label && !node.ignored).map((node) => [node.role.value, node.properties?.find((property) => property.name === 'expanded')?.value.value]);
      const found = [state('Small'), state('Large'), state('Yes')].map((list) => list.find(([, expanded]) => expanded !== undefined));
      assert.ok(found.every(([role]) => role.startsWith('DisclosureTriangle')), `${name}: ${JSON.stringify(found)}`);
      assert.deepEqual(found.map(([, expanded]) => expanded), [true, false, false], name);
    }
    await close();
  }
});

test('a tab\'s text and its components stand in two columns where both fit, and above one another where not', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const [width, beside] of [[1280, true], [390, false]]) {
    const { tab, close } = await open(browser, { width });
    const found = await tab.evaluate(() => {
      const text = document.querySelector('#plans .kn-tabs-text').getBoundingClientRect(), parts = document.querySelector('#plans .kn-tabs-parts').getBoundingClientRect();
      return text.top < parts.bottom && parts.top < text.bottom && text.right <= parts.left;
    });
    assert.equal(found, beside, `${name} at ${width}`);
    await close();
  }
});

test('a choice has no answer open beforehand, and a click opens that answer\'s panel under the answers alone and keeps it', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const script of [true, false]) {
    const label = `${name}${script ? '' : ' without script'}`;
    const { tab, close } = await open(browser, { script });
    assert.deepEqual(await opened(tab, answers), [false, false], label);
    await tab.click('#start .kn-choice-answer >> nth=1');
    assert.deepEqual(await shown(tab, '#start .kn-choice-panel'), [false, true], label);
    const placed = await tab.evaluate(() => {
      const [a, b] = [...document.querySelectorAll('#start .kn-choice-answer')].map((answer) => answer.getBoundingClientRect());
      const panel = document.querySelectorAll('#start .kn-choice-panel')[1].getBoundingClientRect();
      return { beside: Math.abs(a.top - b.top) < 1, under: b.bottom <= panel.top + 0.5, across: panel.left <= a.left + 0.5 && panel.right >= b.right - 0.5 };
    });
    assert.deepEqual(placed, { beside: true, under: true, across: true }, label);
    await tab.click('#start .kn-choice-answer >> nth=1', { force: true });
    assert.deepEqual(await opened(tab, answers), [false, true], `${label}: kept`);
    await tab.click('#start .kn-choice-answer >> nth=0');
    assert.deepEqual(await opened(tab, answers), [true, false], label);
    await close();
  }
});

test('a link to something in a closed panel opens it, and a live preview\'s own opening of a <details> shows its panel alone', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    await tab.evaluate(() => { location.hash = '#large-details'; });
    await tab.waitForFunction(() => document.querySelectorAll('#plans .kn-tabs-item')[1].open);
    assert.deepEqual(await opened(tab, tabs), [false, true, false], `${name}: the browser opens what holds a link's target`);
    // The core opens the <details> that holds a selected block itself (directives.md, Behaviour in a live preview).
    await tab.evaluate(() => { document.querySelector('#konzilo-form-join').closest('details').open = true; });
    assert.deepEqual(await shown(tab, '#start .kn-choice-panel'), [false, true], name);
    await tab.evaluate(() => { document.querySelector('#start .kn-choice-panel h3').closest('details').open = true; });
    assert.deepEqual(await opened(tab, answers), [true, false], `${name}: the other answer closes`);
    await close();
  }
});

test('on paper every panel shows, each under its tab\'s or its answer\'s name', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    await tab.emulateMedia({ media: 'print' });
    assert.deepEqual(await shown(tab, '.kn-tabs-panel'), [true, true, true], name);
    assert.deepEqual(await shown(tab, '.kn-choice-panel'), [true, true], name);
    const order = await tab.evaluate(() => [...document.querySelectorAll('.kn-tabs-item, .kn-choice-item')].every((item) => item.querySelector('summary').getBoundingClientRect().bottom <= item.querySelector(':scope > div').getBoundingClientRect().top + 0.5));
    assert.equal(order, true, name);
    await close();
  }
});

test('the following menu runs no script and marks nothing, in every engine alike', { timeout: 120000 }, async () => {
  const marked = (tab) => tab.$$eval('.kn-article-body .kn-toc a', (links) => links.filter((link) => getComputedStyle(link).borderInlineStartColor !== 'rgba(0, 0, 0, 0)').map((link) => link.getAttribute('href')));
  for (const [name, browser] of browsers) {
    // The page's other runtimes run, as on a site; none of them is the menu's.
    const { tab, close } = await open(browser, { width: 1440, height: 900 });
    const box = await tab.$eval('.kn-article-body .kn-toc', (menu) => menu.getBoundingClientRect().height);
    // Chromium's scroll markers could mark the section being read, and no other engine's, so they are not used.
    assert.equal(await tab.$eval('.kn-article-body .kn-toc', (menu) => getComputedStyle(menu).scrollTargetGroup ?? 'none'), 'none', name);
    // No rule above it, and its label level with the text beside it (the owner, 2026-11-12).
    const block = await tab.$eval('.kn-article-body .kn-aside-block', (aside) => ({ line: getComputedStyle(aside).borderBlockStartWidth, top: aside.querySelector('.kn-toc-label').getBoundingClientRect().top, text: aside.closest('.kn-reading-area').querySelector('.kn-reading-area-flow > :first-child').getBoundingClientRect().top }));
    assert.equal(block.line, '0px', `${name}: no rule above the menu`);
    assert.ok(Math.abs(block.top - block.text) < 8, `${name}: the menu's label stands level with the text, ${block.top} and ${block.text}`);
    await tab.click('.kn-article-body .kn-toc a[href="#another-crosshead"]');
    await tab.waitForTimeout(300);
    assert.deepEqual(await marked(tab), [], `${name}: no mark, and nothing in its place`);
    assert.equal(await tab.$$eval('.kn-toc [aria-current]', (links) => links.length), 0, `${name}: nothing writes aria-current`);
    assert.equal(await tab.$eval('.kn-article-body .kn-toc', (menu) => menu.getBoundingClientRect().height), box, `${name}: the menu keeps its height`);
    await close();
  }
});

test('nothing scrolls sideways or clips, from a phone to a wide window, at the default and a large text size', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) for (const width of [390, 768, 1024, 1440]) {
    const { tab, close } = await open(browser, { width, text });
    await tab.click('.kn-choice-answer >> nth=0');
    const fit = await tab.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped: [...document.querySelectorAll('.kn-tabs-tab, .kn-choice-answer, .kn-accordion-label, .kn-toc a, .kn-fact-box > *')].filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className),
    }));
    assert.deepEqual(fit, { overflow: 0, clipped: [] }, `${name} at ${width} and ${text}px text`);
    await close();
  }
});

test('fine print after a choice is its terms, at the component gap under the answers', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    const [gap, component] = await tab.evaluate(() => {
      const probe = document.createElement('div'); probe.style.inlineSize = 'var(--kn-space-component-gap)'; document.querySelector('#start .kn-section-body').append(probe);
      const size = probe.getBoundingClientRect().width; probe.remove();
      return [document.querySelector('#choice-terms').getBoundingClientRect().top - document.querySelector('#start .kn-choice').getBoundingClientRect().bottom, size];
    });
    assert.ok(Math.abs(gap - component) < 1.5, `${name}: ${gap} for ${component}`);
    await close();
  }
});
