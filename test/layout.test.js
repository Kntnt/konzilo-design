// Layouts that browsers found wanting at larger text sizes and in one engine or another: the real components and CSS,
// in every engine Playwright has here, at 16, 24 and 32px text.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const unscripted = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '');
// A square SVG picture, so a box's shape is its own and not the picture's.
const PICTURE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#999"/></svg>')}`;
let styles;
const browsers = [];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function page(browser, body, { width = 1280, height = 800, text = 16 } = {}) {
  const tab = await browser.newPage({ viewport: { width, height } });
  await tab.setContent(`<!doctype html><html style="font-size: ${text}px"><head><style>${styles}</style></head><body data-kn-surface="page">${body}</body></html>`);
  return tab;
}
// How many items stand in each row of a grid: "4", "2+2" or "1+1+1+1".
const rows = (tab, selector) => tab.$eval(selector, (grid) => {
  const counts = new Map();
  for (const item of grid.children) { const top = Math.round(item.getBoundingClientRect().top); counts.set(top, (counts.get(top) ?? 0) + 1); }
  return [...counts.values()].join('+');
});

test('four Key Figures fall from four columns straight to two, never to three and one, and so does a series of four cards', { timeout: 240000 }, async () => {
  const figures = await render('KeyFigures', { figures: ['1,200', '98 %', '24', '7'].map((value, i) => ({ value, label: `Figure number ${i + 1}` })) });
  // A series from the directives takes its columns from its number of cards (owner, 2026-11-10; docs/spec/directives.md,
  // `cards`): four for four, and two and two where four do not fit. Every count is in test/directives-cards.test.js.
  const cards = (await Promise.all([1, 2, 3, 4].map((n) => render('Card', { heading: `Card ${n}`, text: 'A short text.' })))).join('');
  const body = `<section class="kn-band"><div class="kn-band-content">${figures}<div class="kn-card-grid kn-cards">${unscripted(cards)}</div></div></section>`;
  for (const [name, browser] of browsers) for (const text of [16, 24, 32]) for (const width of [1440, 1280, 1024, 800, 390]) {
    const tab = await page(browser, body, { width, text });
    for (const selector of ['.kn-key-figures', '.kn-cards']) assert.match(await rows(tab, selector), /^(4|2\+2|1\+1\+1\+1)$/, `${selector} in ${name} at ${text}px text and ${width}`);
    if (text === 16 && width >= 1280) for (const selector of ['.kn-key-figures', '.kn-cards']) assert.equal(await rows(tab, selector), '4', `${name} keeps four where four fit`);
    await tab.close();
  }
});

test('a long button label wraps within its column and the window, and its words break before they leave it', { timeout: 120000 }, async () => {
  const button = await render('Button', { href: '#' }, { default: 'Download the complete annual collection overview' });
  const body = `<section class="kn-band"><div class="kn-band-content"><div class="probe" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem"><div>${button}</div><p>Text beside it.</p></div></div></section>`;
  for (const [name, browser] of browsers) for (const text of [16, 32]) {
    const tab = await page(browser, body, { width: 390, height: 844, text });
    const fit = await tab.$eval('.kn-button', (element) => {
      const box = element.getBoundingClientRect();
      const column = element.parentElement.getBoundingClientRect();
      return { inWindow: box.right <= innerWidth + 0.5, inColumn: box.right <= column.right + 0.5, contentFits: element.scrollWidth <= element.clientWidth + 1, centred: getComputedStyle(element).textAlign };
    });
    assert.deepEqual(fit, { inWindow: true, inColumn: true, contentFits: true, centred: 'center' }, `${name} at ${text}px text`);
    await tab.close();
  }
});

test('a Content Card\'s inset picture keeps its ratio in a plated card', { timeout: 120000 }, async () => {
  const card = await render('ContentCard', { title: 'A title', href: '#', surface: 'raised', imageRatio: '2:1', imageInset: true, picture: { src: PICTURE, loading: 'eager' } });
  const body = `<div style="inline-size: 20rem">${card}</div>`;
  for (const [name, browser] of browsers) {
    const tab = await page(browser, body);
    await tab.waitForFunction(() => document.querySelector('.kn-content-picture img').complete);
    const ratio = await tab.$eval('.kn-content-picture', (picture) => { const box = picture.getBoundingClientRect(); return Math.round((box.width / box.height) * 100) / 100; });
    assert.equal(ratio, 2, name);
    await tab.close();
  }
});

test('a checkbox and a radio button have one size in every engine, which follows the text size', { timeout: 120000 }, async () => {
  const field = await render('Field', { name: 'choice', label: 'Choose', type: 'checkbox', options: [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }] });
  for (const text of [16, 24]) {
    const sizes = [];
    for (const [, browser] of browsers) {
      const tab = await page(browser, unscripted(field), { text });
      sizes.push(await tab.$eval('.kn-field-option input', (input) => Math.round(input.getBoundingClientRect().width * 10) / 10));
      await tab.close();
    }
    assert.equal(new Set(sizes).size, 1, `${sizes} at ${text}px text`);
    assert.ok(Math.abs(sizes[0] - 0.9167 * text) < 0.2, `${sizes[0]} at ${text}px text`);
  }
  for (const file of ['src/components/form.css', 'src/konzilo/konzilo.css']) {
    const css = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const [rule] of css.matchAll(/[^{}]*input[^{}]*\{[^}]*inline-size:[^}]*\}/g)) if (/checkbox|radio|option|task-list/.test(rule)) assert.doesNotMatch(rule, /inline-size: [\d.]+em/, `${file}: ${rule.trim().slice(0, 60)}`);
  }
});

test('the megamenu drops its rows above and below where its columns fall to two', { timeout: 120000 }, async () => {
  const items = [1, 2, 3, 4].map((n) => ({ label: `Area ${n}`, href: `#${n}`, children: [{ label: 'Page', href: `#${n}-page` }] }));
  const header = await render('Header', { identity: { label: 'Example', href: '#', name: 'Example' }, menu: items, menuButton: { word: 'Menu' } }, { 'menu-above': '<p>Above</p>', 'menu-below': '<p>Below</p>' });
  for (const [name, browser] of browsers) for (const [width, shown] of [[1440, true], [961, true], [960, false], [600, false]]) {
    // A media query's rem is the browser's text size, not the page's: 60rem is 960px here.
    const tab = await page(browser, unscripted(header).replace(/hidden(?:="")?/g, '').replace(/popover(?:="[^"]*")?/g, ''), { width });
    const display = await tab.$$eval('.kn-megamenu-above, .kn-megamenu-below', (rows) => rows.map((row) => getComputedStyle(row).display !== 'none'));
    assert.deepEqual(display, [shown, shown], `${name} at ${width}`);
    await tab.close();
  }
});

test('a Heading Group stands a column-gap above what follows it in a Band, and the band\'s other content is untouched', { timeout: 120000 }, async () => {
  const group = await render('HeadingGroup', { heading: 'A heading' });
  const body = `<section class="kn-band"><div class="kn-band-content">${group}<p class="next" style="margin: 0">Content after it.</p></div></section><section class="kn-band"><div class="kn-band-content">${group}</div></section>`;
  for (const [name, browser] of browsers) {
    const tab = await page(browser, body);
    const { space, gap, last } = await tab.evaluate(() => {
      const [first, second] = document.querySelectorAll('.kn-heading-group');
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.blockSize = 'var(--kn-space-column-gap)';
      const gap = probe.getBoundingClientRect().height;
      return { space: document.querySelector('.next').getBoundingClientRect().top - first.getBoundingClientRect().bottom, gap, last: getComputedStyle(second).marginBlockEnd };
    });
    assert.ok(gap > 0 && Math.abs(space - gap) < 0.5, `${name}: ${space} against ${gap}`);
    assert.equal(last, '0px', `${name}: nothing follows the second`);
    await tab.close();
  }
});

test('while the consent\'s reopen button shows, the footer\'s last band leaves it room under its content', { timeout: 120000 }, async () => {
  const footer = await render('Footer', { upper: { cells: { a1: { text: 'Brand' } } }, lower: { cells: { a1: { text: 'Address' }, b1: { text: 'Registration' } } } });
  const body = (hidden) => `<div class="kn-page"><main class="kn-page-main"></main>${unscripted(footer)}</div><button class="kn-button kn-consent-reopen" aria-label="Privacy settings"${hidden ? ' hidden' : ''}></button>`;
  for (const [name, browser] of browsers) for (const text of [16, 32]) {
    for (const hidden of [false, true]) {
      const tab = await page(browser, body(hidden), { width: 1024, height: 700, text });
      await tab.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const { overlap, padding } = await tab.evaluate(() => {
        const button = document.querySelector('.kn-consent-reopen').getBoundingClientRect();
        const words = [...document.querySelectorAll('.kn-footer p')].map((element) => element.getBoundingClientRect());
        return { overlap: !!button.width && words.some((word) => word.bottom > button.top && word.top < button.bottom && word.left < button.right && word.right > button.left), padding: parseFloat(getComputedStyle(document.querySelector('.kn-footer-band:last-child')).paddingBlockEnd) };
      });
      assert.equal(overlap, false, `${name} at ${text}px text`);
      if (hidden) assert.equal(padding, 1.25 * text, `${name}: without the button the band keeps its own end`);
      else assert.equal(padding, 4.75 * text, `${name}: with the button, room for it and a gap above it`);
      await tab.close();
    }
  }
});
