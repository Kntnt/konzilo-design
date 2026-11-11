// The trail on a phone when the design chooses as much as fits, from the end (`narrow: 'fit'`): one line that keeps its
// end in view, whole steps hidden from the start behind an ellipsis at the start edge, a short trail whole at the start,
// the order untouched and nothing sideways, by CSS alone, in every engine and at a large text size too.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { render } from './helpers/render.js';

const BROWSERS = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const steps = (...labels) => labels.map((label, i) => (i === labels.length - 1 ? { label } : { label, href: `#step-${i}` }));
const LONG = ['Home', 'Services', 'Planning and design', 'Gardens', 'A clear next step for you'];
const SHORT = ['Home', 'Services'];
const TOO_LONG = ['Home', 'Services', 'A page whose title is far longer than the whole line on any phone'];
// As the core writes it (directives.md, `breadcrumbs`): whitespace between the steps.
const CORE = `<nav class="kn-breadcrumbs" aria-label="Breadcrumb" data-kn-type="small" data-kn-separator="slash" data-kn-home="word" data-kn-current="true" data-kn-narrow="fit">
  <ol role="list">
    ${LONG.slice(0, -1).map((label, i) => `<li>${i ? '<span class="kn-breadcrumbs-separator" aria-hidden="true"></span>' : ''}<a href="#core-${i}"><span class="kn-breadcrumbs-label">${label}</span></a></li>`).join('\n    ')}
    <li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><span aria-current="page">${LONG.at(-1)}</span></li>
  </ol>
</nav>`;
const browsers = [];
let styles, cases, keyboard;
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  const trail = async (labels, props = {}) => render('Breadcrumbs', { items: steps(...labels), narrow: 'fit', ...props });
  const block = (id, html, attributes = '') => `<div id="${id}" ${attributes} style="margin-block-end: 1rem">${html}</div>`;
  cases = [
    block('long', await trail(LONG)),
    block('short', await trail(SHORT)),
    block('icon', await trail(LONG, { home: 'icon', separator: 'chevron' })),
    block('above', await trail([...LONG, 'The page itself'], { current: false })),
    block('too-long', await trail(TOO_LONG)),
    block('core', CORE),
    block('rtl', await trail(LONG), 'dir="rtl"'),
    block('whole', await trail(LONG, { narrow: 'trail' })),
  ].join('');
  keyboard = `<a id="before" href="#before">Before</a>${await trail(LONG)}<a id="after" href="#after">After</a>`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function open(browser, { width = 390, text = 16, body = cases } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1200 } });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en" style="font-size: ${text}px"><head><style>${styles}</style></head><body data-kn-surface="page"><main class="kn-page" style="padding: 1rem">${body}</main></body></html>`);
  return { tab, close: () => context.close() };
}
// Each step that shows, by the list's own box, which clips the rest: a step that shows lies wholly inside it, and a hidden
// one wholly outside.
const read = (tab, id) => tab.$eval(`#${id} .kn-breadcrumbs`, (nav) => {
  const list = nav.querySelector('ol');
  const box = list.getBoundingClientRect();
  const inside = (r) => r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5 && r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
  const outside = (r) => r.bottom <= box.top + 0.5 || r.top >= box.bottom - 0.5 || r.right <= box.left + 0.5 || r.left >= box.right - 0.5;
  const steps = [...list.children].filter((item) => getComputedStyle(item).display !== 'none').map((item) => {
    const r = item.getBoundingClientRect();
    const label = item.lastElementChild;
    return { text: item.textContent.trim(), left: r.left, right: r.right, top: r.top, inside: inside(r), outside: outside(r), cut: label.scrollWidth > label.clientWidth + 1 };
  });
  const style = getComputedStyle(list);
  return {
    steps, box: { left: box.left, right: box.right, height: box.height }, nav: nav.getBoundingClientRect().left,
    line: parseFloat(style.lineHeight), em: parseFloat(style.fontSize), reserve: parseFloat(style.paddingInlineStart),
    order: [...list.children].map((item) => item.textContent.trim()),
  };
});
// Whether the ellipsis shows, at the start edge and anywhere: the same strip drawn with it and without it.
async function ellipsis(tab, id, rtl = false) {
  const { x, y, width, height, em } = await tab.$eval(`#${id} .kn-breadcrumbs > ol`, (list) => {
    const r = list.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, em: parseFloat(getComputedStyle(list).fontSize) };
  });
  const strips = { start: { x: rtl ? x + width - em : x, y, width: em, height }, whole: { x, y, width, height } };
  const shoot = async () => Object.fromEntries(await Promise.all(Object.entries(strips).map(async ([name, clip]) => [name, await tab.screenshot({ clip, animations: 'disabled' })])));
  const shown = await shoot();
  const hiding = await tab.addStyleTag({ content: `#${id} .kn-breadcrumbs > ol::after { visibility: hidden !important; }` });
  const hidden = await shoot();
  await hiding.evaluate((style) => style.remove());
  return { start: !shown.start.equals(hidden.start), whole: !shown.whole.equals(hidden.whole) };
}
const texts = (list) => list.map((step) => step.text);

test('a long trail keeps one line and its end, hides whole steps from the start, and shows an ellipsis at the start edge', { timeout: 180000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) {
    const { tab, close } = await open(browser, { text });
    const at = `${name} at ${text}px text`;
    for (const [id, labels] of [['long', LONG], ['icon', LONG], ['core', LONG], ['above', LONG], ['too-long', TOO_LONG]]) {
      const r = await read(tab, id);
      const shown = r.steps.filter((step) => step.inside);
      assert.ok(r.steps.every((step) => step.inside !== step.outside), `${at}, ${id}: every step shows whole or not at all, ${JSON.stringify(r.steps)}`);
      assert.ok(Math.abs(r.box.height - r.line) < 1, `${at}, ${id}: one line, ${r.box.height} for ${r.line}`);
      assert.deepEqual(texts(shown), texts(r.steps.slice(r.steps.length - shown.length)), `${at}, ${id}: the steps shown are the last ones`);
      assert.equal(shown.at(-1).text, labels.at(-1), `${at}, ${id}: the end is in view`);
      assert.ok(shown.length < r.steps.length, `${at}, ${id}: something is hidden`);
      assert.ok(shown.every((step, i) => !i || step.left >= shown[i - 1].right - 0.5), `${at}, ${id}: shown in the order of the markup`);
      assert.ok(Math.abs(shown[0].left - (r.box.left + r.reserve)) < 1 && r.reserve > 0.9 * r.em, `${at}, ${id}: the shown steps start after room for the ellipsis`);
      assert.deepEqual(await ellipsis(tab, id), { start: true, whole: true }, `${at}, ${id}: the ellipsis shows at the start edge`);
      // Only a step longer than the whole line is ever cut, at its end.
      assert.deepEqual(shown.map((step) => step.cut), shown.map((step, i) => id === 'too-long' && i === shown.length - 1), `${at}, ${id}: no step is cut but one longer than the line`);
    }
    const scroll = await tab.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    assert.ok(scroll <= 0, `${at}: nothing scrolls sideways, ${scroll}`);
    await close();
  }
});

test('a short trail shows whole at the start, with no ellipsis', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) {
    const { tab, close } = await open(browser, { text });
    const at = `${name} at ${text}px text`;
    const r = await read(tab, 'short');
    assert.ok(r.steps.every((step) => step.inside), `${at}: every step shows, ${JSON.stringify(r.steps)}`);
    assert.ok(Math.abs(r.steps[0].left - r.nav) < 1, `${at}: it starts at the start edge, ${r.steps[0].left} for ${r.nav}`);
    assert.ok(r.steps.every((step) => step.top === r.steps[0].top), `${at}: on one line`);
    assert.deepEqual(await ellipsis(tab, 'short'), { start: false, whole: false }, `${at}: no ellipsis`);
    await close();
  }
});

test('the markup keeps its order, right to left mirrors the trail, and a wide window shows it whole', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser, { text: 24 });
    assert.deepEqual((await read(tab, 'long')).order, LONG, `${name}: the steps stay in the order of the markup`);
    // Right to left, the end stands at the left and the ellipsis at the right, the start edge.
    const rtl = await read(tab, 'rtl');
    const shown = rtl.steps.filter((step) => step.inside);
    assert.equal(shown.at(-1).text, LONG.at(-1), name);
    assert.ok(shown.length < rtl.steps.length && shown.every((step, i) => !i || step.right <= shown[i - 1].left + 0.5), `${name}: right to left, in order, ${JSON.stringify(shown)}`);
    assert.ok(Math.abs(shown[0].right - (rtl.box.right - rtl.reserve)) < 1, `${name}: room for the ellipsis at the right`);
    assert.deepEqual(await ellipsis(tab, 'rtl', true), { start: true, whole: true }, `${name}: the ellipsis at the right`);
    // The other choices stay as they were: the whole trail wraps.
    const whole = await read(tab, 'whole');
    assert.ok(whole.steps.every((step) => step.inside) && new Set(whole.steps.map((step) => step.top)).size > 1, `${name}: the whole trail wraps`);
    await close();
    const wide = await open(browser, { width: 1024 });
    for (const id of ['long', 'too-long']) assert.ok((await read(wide.tab, id)).steps.every((step) => step.inside && !step.cut), `${name}, ${id}: a wide window shows the whole trail`);
    await wide.close();
  }
});

test('a keyboard focus on a hidden step shows the whole trail, a pointer does not, and assistive technology has every step', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser, { body: keyboard });
    // Safari's Tab passes over links unless full keyboard access is on; Option-Tab reaches them.
    const tabKey = name === 'webkit' ? 'Alt+Tab' : 'Tab';
    const trail = () => tab.$eval('.kn-breadcrumbs', (nav) => {
      const box = nav.getBoundingClientRect();
      const list = nav.querySelector('ol');
      return {
        whole: [...list.children].every((item) => { const r = item.getBoundingClientRect(); return r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5; }),
        clipped: getComputedStyle(list).overflow !== 'visible',
      };
    });
    assert.deepEqual(await trail(), { whole: false, clipped: true }, `${name}: one line shown, the rest out of sight`);
    // Every step is there for a screen reader, in order, and the ellipsis is not read.
    const heard = await tab.locator('.kn-breadcrumbs').ariaSnapshot();
    assert.match(heard, new RegExp(LONG.slice(0, -1).map((label) => `link "${label}"`).join('[\\s\\S]*')), `${name}: ${heard}`);
    assert.doesNotMatch(heard, /…|\.\.\./, name);
    await tab.focus('#before');
    await tab.keyboard.press(tabKey);
    const focused = () => tab.evaluate(() => document.activeElement.textContent.trim());
    assert.equal(await focused(), 'Home', `${name}: the hidden first step takes the focus`);
    assert.deepEqual(await trail(), { whole: true, clipped: false }, `${name}: and the whole trail shows, wrapping`);
    for (let step = 1; step < LONG.length - 1; step++) await tab.keyboard.press(tabKey);
    assert.equal(await focused(), LONG.at(-2), name);
    await tab.keyboard.press(tabKey);
    assert.equal(await tab.evaluate(() => document.activeElement.id), 'after', name);
    assert.deepEqual(await trail(), { whole: false, clipped: true }, `${name}: one line again once the focus leaves`);
    await close();
    // A tap on a step that shows changes nothing before the link is followed.
    const pointer = await open(browser, { body: keyboard });
    await pointer.tab.click('.kn-breadcrumbs a[href="#step-3"]');
    assert.equal(await pointer.tab.$eval('.kn-breadcrumbs > ol', (list) => getComputedStyle(list).overflow !== 'visible'), true, `${name}: a pointer leaves it on one line`);
    await pointer.close();
  }
});
