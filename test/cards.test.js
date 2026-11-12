// Cards in the browser, in every engine Playwright has here: the links of a Content Loop in body text, which keep their
// own look as a Card's do.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { render } from './helpers/render.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let components, markup;
before(async () => {
  components = await componentsCss();
  const items = [{ title: 'A note on the river', href: '#a', meta1: [{ text: 'Walks' }], excerpt: 'Where the path meets the water.' }, { title: 'Tools for the bench', href: '#b' }];
  const rows = await render('ContentLoop', { id: 'loop-rows', presentation: 'rows', images: false, items });
  const cards = await render('ContentLoop', { id: 'loop-cards', presentation: 'cards', images: false, surface: 'raised', items });
  markup = `<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text">
    <p>A paragraph with <a id="body-link" href="#c">a link of its own</a>.</p>${rows}${cards}</div></div></section>`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function page(browser, inputs = defaultInputs()) {
  const tab = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await tab.setContent(`<!doctype html><html lang="en"><head><style>${coreCss(derive(inputs))}${components}</style></head><body data-kn-surface="page"><div class="kn-page">${markup}</div></body></html>`);
  return tab;
}
const looks = (tab, selector) => tab.$eval(selector, (element) => ({ color: getComputedStyle(element).color, line: getComputedStyle(element).textDecorationLine, text: getComputedStyle(element.closest('.kn-band')).color }));

test('a Content Loop in body text keeps its own links: its titles are not drawn as body links', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const body = await looks(tab, '#body-link');
    assert.equal(body.line, 'underline', `${name}: a body link is underlined`);
    for (const loop of ['loop-rows', 'loop-cards']) {
      const title = await looks(tab, `#${loop} .kn-content-link`);
      assert.deepEqual([title.color, title.line], [title.text, 'none'], `${name}: ${loop}'s title is in the text colour, not underlined`);
      await tab.hover(`#${loop} .kn-content-link`);
      const hovered = await looks(tab, `#${loop} .kn-content-link`);
      assert.deepEqual([hovered.color, hovered.line], [body.color, 'underline'], `${name}: ${loop}'s title turns link and underlined under the pointer`);
      await tab.mouse.move(0, 0);
    }
    await tab.close();
  }
});
