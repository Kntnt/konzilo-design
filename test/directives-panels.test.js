// Package D of the directives (docs/spec/directives.md): accordion, tabs, choice, toc, an article's following menu
// and a fact box. Their facts and decisions in Node, and their markup, stylesheet and runtimes in every engine
// Playwright has here, with script and without.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { allQuestions, panelParts } from '../src/directives/index.js';
import { tabMove } from '../src/components/tabs.js';
import { currentStop } from '../src/components/table-of-contents.js';
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

test('the arrow keys move along the tabs, wrapping and in the direction the text runs, and Home and End to the ends', () => {
  assert.equal(tabMove('ArrowRight', 0, 3), 1);
  assert.equal(tabMove('ArrowRight', 2, 3), 0);
  assert.equal(tabMove('ArrowLeft', 0, 3), 2);
  assert.equal(tabMove('ArrowLeft', 0, 3, true), 1);
  assert.equal(tabMove('ArrowRight', 0, 3, true), 2);
  assert.equal(tabMove('Home', 2, 3), 0);
  assert.equal(tabMove('End', 0, 3), 2);
  assert.equal(tabMove('ArrowDown', 0, 3), null);
  assert.equal(tabMove('Enter', 0, 3), null);
});

test('the current stop is the last past the reading line, the first before any has, and none without a box', () => {
  assert.equal(currentStop([100, 400, 900], 80), 0);
  assert.equal(currentStop([-300, 79, 900], 80), 1);
  assert.equal(currentStop([-900, -400, 80], 80), 2);
  assert.equal(currentStop([null, 200, null], 80), 1);
  assert.equal(currentStop([-500, null, 300], 80), 0);
  assert.equal(currentStop([null, null], 80), -1);
  assert.equal(currentStop([], 80), -1);
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const source = (name) => readFile(new URL(`../src/components/${name}.js`, import.meta.url), 'utf8');
let styles, fixture, runtimes;
const browsers = [];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  fixture = await readFile(new URL('fixtures/directives-panels.html', import.meta.url), 'utf8');
  // One module each, with the scheduler a runtime imports standing before it.
  const schedule = await source('schedule');
  const bare = async (name) => (await source(name)).replace(/^import .*$/m, '');
  runtimes = [
    `${await source('tabs')}\nsetupTabs();`,
    `${await source('choice')}\nsetupChoices();`,
    `${schedule}\n${await bare('table-of-contents')}\nsetupFollowingMenus();`,
    `${schedule}\n${await bare('reading-area')}\nsetupReadingAreas();`,
  ];
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function open(browser, { width = 1280, height = 800, text = 16, script = true, run = true, dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: script });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en" dir="${dir}" style="font-size: ${text}px"><head><style>${styles}</style></head><body data-kn-surface="page">${fixture}<div style="block-size: 100vh"></div></body></html>`);
  if (script && run) await start(tab);
  return { tab, close: () => context.close() };
}
async function start(tab) {
  for (const content of runtimes) await tab.addScriptTag({ type: 'module', content });
  await tab.waitForSelector('.kn-tabs[data-kn-enhanced]', { state: 'attached' });
  await tab.waitForSelector('.kn-toc a[aria-current]', { state: 'attached' });
}
const shown = (tab, selector) => tab.$$eval(selector, (elements) => elements.map((element) => element.getClientRects().length > 0));

test('before the runtimes run only the first tab shows and no answer\'s panel, so nothing below moves when they do', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser, { run: false });
    assert.deepEqual(await shown(tab, '.kn-tabs-panel'), [true, false, false], name);
    assert.deepEqual(await shown(tab, '.kn-choice-panel'), [false, false], name);
    const below = () => tab.$eval('#guide', (element) => element.getBoundingClientRect().top + scrollY);
    const was = await below();
    await start(tab);
    assert.equal(await below(), was, `${name}: the band after the tabs and the choice stays put`);
    assert.deepEqual(await tab.$$eval('.kn-tabs-panel', (panels) => panels.map((panel) => panel.hidden)), [false, true, true], name);
    assert.deepEqual(await tab.$$eval('.kn-choice-panel', (panels) => panels.map((panel) => panel.hidden)), [true, true], name);
    await close();
  }
});

test('tabs follow the ARIA pattern: a click or a key selects, with a roving tabindex, logical in right-to-left', { timeout: 120000 }, async () => {
  const state = (tab) => tab.evaluate(() => ({
    selected: [...document.querySelectorAll('.kn-tabs-tab')].findIndex((button) => button.getAttribute('aria-selected') === 'true'),
    focused: [...document.querySelectorAll('.kn-tabs-tab')].indexOf(document.activeElement),
    stops: [...document.querySelectorAll('.kn-tabs-tab')].map((button) => button.tabIndex),
    shown: [...document.querySelectorAll('.kn-tabs-panel')].map((panel) => panel.getClientRects().length > 0),
  }));
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    await tab.focus('#tabs-1-tab-1');
    await tab.keyboard.press('ArrowRight');
    assert.deepEqual(await state(tab), { selected: 1, focused: 1, stops: [-1, 0, -1], shown: [false, true, false] }, name);
    await tab.keyboard.press('End');
    assert.deepEqual((await state(tab)).selected, 2, name);
    await tab.keyboard.press('ArrowRight');
    assert.deepEqual((await state(tab)).selected, 0, `${name}: wraps`);
    await tab.keyboard.press('ArrowLeft');
    assert.deepEqual((await state(tab)).selected, 2, name);
    await tab.keyboard.press('Home');
    assert.deepEqual(await state(tab), { selected: 0, focused: 0, stops: [0, -1, -1], shown: [true, false, false] }, name);
    await tab.click('#tabs-1-tab-2');
    assert.deepEqual((await state(tab)).shown, [false, true, false], `${name}: a click`);
    // A link to something in a panel not shown shows that panel.
    await tab.click('#tabs-1-tab-1');
    await tab.evaluate(() => { location.hash = '#large-details'; });
    await tab.waitForFunction(() => document.querySelector('#tabs-1-tab-2').getAttribute('aria-selected') === 'true');
    await close();
    const rtl = await open(browser, { dir: 'rtl' });
    await rtl.tab.focus('#tabs-1-tab-1');
    await rtl.tab.keyboard.press('ArrowLeft');
    assert.equal((await state(rtl.tab)).selected, 1, `${name}: in right-to-left the left arrow goes on`);
    await rtl.close();
  }
});

test('a choice has no answer chosen beforehand, and a click shows that answer\'s panel alone and keeps it', { timeout: 120000 }, async () => {
  const state = (tab) => tab.evaluate(() => ({
    expanded: [...document.querySelectorAll('.kn-choice-answer')].map((answer) => answer.getAttribute('aria-expanded')),
    shown: [...document.querySelectorAll('.kn-choice-panel')].map((panel) => panel.getClientRects().length > 0),
  }));
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    assert.deepEqual(await state(tab), { expanded: ['false', 'false'], shown: [false, false] }, name);
    await tab.click('.kn-choice-answer >> nth=1');
    assert.deepEqual(await state(tab), { expanded: ['false', 'true'], shown: [false, true] }, name);
    await tab.click('.kn-choice-answer >> nth=1');
    assert.deepEqual(await state(tab), { expanded: ['false', 'true'], shown: [false, true] }, `${name}: kept`);
    await tab.click('.kn-choice-answer >> nth=0');
    assert.deepEqual(await state(tab), { expanded: ['true', 'false'], shown: [true, false] }, name);
    await close();
  }
});

test('a live preview\'s konzilo-preview-show opens the tab and the answer that hold the block, and moves nothing else', { timeout: 120000 }, async () => {
  const show = (tab, selector) => tab.evaluate((selector) => {
    const block = document.querySelector(selector);
    block.setAttribute('data-konzilo-block', '2.1');
    const scrolled = scrollY;
    block.dispatchEvent(new CustomEvent('konzilo-preview-show', { bubbles: true }));
    return scrollY === scrolled;
  }, selector);
  const state = (tab) => tab.evaluate(() => ({
    tab: [...document.querySelectorAll('.kn-tabs-tab')].findIndex((button) => button.getAttribute('aria-selected') === 'true'),
    answers: [...document.querySelectorAll('.kn-choice-answer')].map((answer) => answer.getAttribute('aria-expanded')),
  }));
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    assert.equal(await show(tab, '#large-details'), true, `${name}: the preview, not the runtime, scrolls`);
    assert.deepEqual(await state(tab), { tab: 1, answers: ['false', 'false'] }, `${name}: a block in the second tab`);
    await show(tab, '#konzilo-form-join');
    assert.deepEqual(await state(tab), { tab: 1, answers: ['false', 'true'] }, `${name}: a block in the second answer`);
    await show(tab, '#choice-1-answer-1 h3');
    assert.deepEqual(await state(tab), { tab: 1, answers: ['true', 'false'] }, `${name}: a block in the first answer`);
    await show(tab, '#questions .kn-accordion');
    assert.deepEqual(await state(tab), { tab: 1, answers: ['true', 'false'] }, `${name}: a block outside them changes nothing`);
    await close();
  }
});

test('the tabs and choice runtimes listen on the document only where their components are', { timeout: 120000 }, async () => {
  const [, browser] = browsers[0];
  const context = await browser.newContext();
  const tab = await context.newPage();
  const capture = (sources) => tab.evaluate(async (sources) => {
    const seen = [];
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) { seen.push(type); return add.call(this, type, ...rest); };
    for (const source of sources) await import(`data:text/javascript,${encodeURIComponent(`${source}\n// ${Math.random()}`)}`);
    EventTarget.prototype.addEventListener = add;
    return seen;
  }, sources);
  await tab.setContent('<!doctype html><html lang="en"><body><p>Nothing to enhance.</p></body></html>');
  assert.deepEqual(await capture([runtimes[0], runtimes[1]]), []);
  // The same capture sees the listener where there is something to enhance.
  await tab.setContent(`<!doctype html><html lang="en"><body>${fixture}</body></html>`);
  assert.equal((await capture([runtimes[0], runtimes[1]])).filter((type) => type === 'konzilo-preview-show').length, 2);
  await context.close();
});

test('the following menu marks the stop last past the reading line, a fact box among them, and only colours change', { timeout: 120000 }, async () => {
  const current = (tab) => tab.$eval('.kn-article-body .kn-toc', (menu) => menu.querySelector('a[aria-current="true"]')?.getAttribute('href'));
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser, { width: 1440, height: 900 });
    assert.equal(await current(tab), '#a-crosshead', `${name}: the first before any has passed`);
    const box = await tab.$eval('.kn-article-body .kn-toc', (menu) => menu.getBoundingClientRect().height);
    for (const [target, expected] of [['#in-short', '#in-short'], ['#another-crosshead', '#another-crosshead'], ['#a-crosshead', '#a-crosshead']]) {
      await tab.click(`.kn-article-body .kn-toc a[href="${target}"]`);
      await tab.waitForFunction((href) => document.querySelector(`.kn-article-body .kn-toc a[href="${href}"]`).getAttribute('aria-current') === 'true', expected);
      assert.equal(await tab.$$eval('.kn-article-body .kn-toc a[aria-current]', (links) => links.length), 1, name);
    }
    assert.equal(await tab.$eval('.kn-article-body .kn-toc', (menu) => menu.getBoundingClientRect().height), box, `${name}: the menu keeps its height`);
    await close();
  }
});

test('without script nothing is lost: every panel shows under its tab\'s or its answer\'s name', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser, { script: false });
    assert.deepEqual(await shown(tab, '.kn-tabs-panel'), [true, true, true], name);
    assert.deepEqual(await shown(tab, '.kn-choice-panel'), [true, true], name);
    const order = await tab.evaluate(() => {
      const top = (selector) => document.querySelector(selector).getBoundingClientRect().top;
      return [top('#tabs-1-tab-1') < top('#tabs-1-panel-1'), top('#tabs-1-panel-1') < top('#tabs-1-tab-2'), top('#tabs-1-tab-2') < top('#tabs-1-panel-2'), top('#tabs-1-panel-2') < top('#tabs-1-tab-3'),
        top('[aria-controls="choice-1-answer-1"]') < top('#choice-1-answer-1'), top('#choice-1-answer-1') < top('[aria-controls="choice-1-answer-2"]'), top('[aria-controls="choice-1-answer-2"]') < top('#choice-1-answer-2')];
    });
    assert.deepEqual(order, order.map(() => true), name);
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
