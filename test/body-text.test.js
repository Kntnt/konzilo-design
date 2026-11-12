// Body text in the browser, in every engine Playwright has here: a quotation that looks as Quotation does, its source
// under it, so it cannot be taken for the text round it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { render } from './helpers/render.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let styles, markup;
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  const quotation = await render('Quotation', { name: 'A. Grower', context: 'the allotments' }, { default: '<p>The soil decides almost everything.</p>' });
  // A quotation as Markdown writes one, its source alone in its last paragraph, as the Konzilo core's reader does.
  markup = `<div class="kn-body-text" id="flow"><p>A paragraph before it.</p><blockquote><p>The soil decides almost everything.</p><p><cite>A. Grower, the allotments</cite></p></blockquote><p>A paragraph after it.</p>
    <article class="kn-card" data-kn-surface="raised"><h3 class="kn-card-heading" data-kn-type="heading-5">A card</h3><blockquote id="small"><p>Quoted small.</p></blockquote></article></div>${quotation}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

test('a quotation in body text looks as Quotation does, its source under it in small, muted type', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: { width: 1024, height: 900 } });
    await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}</style></head><body data-kn-surface="page">${markup}</body></html>`);
    const read = await tab.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector));
      const pick = (s) => ({ size: s.fontSize, weight: s.fontWeight, color: s.color, rule: `${s.borderInlineStartWidth} ${s.borderInlineStartColor}` });
      return {
        body: pick(style('#flow > p')), words: pick(style('#flow > blockquote > p')), rule: pick(style('#flow > blockquote')),
        source: pick(style('#flow > blockquote p:last-child')), cite: style('#flow cite').fontStyle,
        quotation: pick(style('.kn-quotation-text')), figure: pick(style('.kn-quotation')), attribution: pick(style('.kn-quotation-attribution')),
        small: style('#small').fontSize, card: style('#small').parentElement && getComputedStyle(document.querySelector('#small p')).fontSize,
      };
    });
    assert.deepEqual([read.words.size, read.words.weight, read.words.color], [read.quotation.size, read.quotation.weight, read.quotation.color], `${name}: its words as Quotation's`);
    assert.notEqual(read.words.size, read.body.size, `${name}: not the body text's size`);
    assert.equal(read.rule.rule, read.figure.rule, `${name}: the same rule as Quotation's, in the accent`);
    assert.deepEqual([read.source.size, read.source.color], [read.attribution.size, read.attribution.color], `${name}: its source as Quotation's attribution`);
    assert.equal(read.cite, 'normal', `${name}: the source is not in italics`);
    assert.notEqual(read.small, read.words.size, `${name}: in a card a quotation keeps the card's size`);
    await tab.close();
  }
});

// Tables as the Konzilo core writes them in a body: bare, at the top of the body text and in a part.
const WIDE = '<table><thead><tr><th>Service</th><th>What it holds</th><th>Price</th><th>Term</th></tr></thead><tbody><tr><td>Planning</td><td>A plan for the beds over a whole season</td><td style="text-align:right">1200</td><td>Monthly</td></tr></tbody></table>';
const NARROW = '<table><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Small</td><td>10</td></tr></tbody></table>';
const tables = (table) => `<div class="kn-body-text" id="flow" style="inline-size: min(100%, 40rem)">${table.replace('<table', '<table id="top"')}
  <aside class="kn-fact-box" data-kn-surface="raised"><p class="kn-fact-box-label" data-kn-type="label">In short</p>${table.replace('<table', '<table id="fact"')}</aside>
  <details class="kn-tabs-item" name="tabs" open><summary class="kn-tabs-tab">A tab</summary><div class="kn-tabs-panel">${table.replace('<table', '<table id="tab"')}</div></details>
  <article class="kn-card" data-kn-surface="raised"><h3 class="kn-card-heading" data-kn-type="heading-5">A card</h3>${table.replace('<table', '<table id="card"')}</article>
</div>`;
const konzilo = readFileSync(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8');
const measureTables = (tab) => tab.evaluate(() => Object.fromEntries(['top', 'fact', 'tab', 'card'].map((id) => {
  const table = document.getElementById(id);
  const port = id === 'wrapped' ? table.parentElement : table;
  const room = port.parentElement.getBoundingClientRect().width - Number.parseFloat(getComputedStyle(port.parentElement).paddingInlineStart) - Number.parseFloat(getComputedStyle(port.parentElement).paddingInlineEnd);
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const cells = [...table.querySelectorAll('th, td')].map((cell) => cell.getBoundingClientRect().width / rem);
  const row = table.querySelector('tr').getBoundingClientRect().width;
  return [id, { room, port: port.clientWidth, scrolls: port.scrollWidth > port.clientWidth + 1, least: Math.min(...cells), row, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }];
})));

test('a table at a phone\'s width scrolls in its own box, in a part too, and squeezes no column under 6rem', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}${konzilo}</style></head><body data-kn-surface="page" style="padding-inline: 1rem">${tables(WIDE)}</body></html>`);
    for (const [id, found] of Object.entries(await measureTables(tab))) {
      assert.equal(found.page, 0, `${name}: the page does not scroll sideways for ${id}`);
      assert.ok(found.scrolls, `${name}: ${id} scrolls inside its box`);
      assert.ok(found.port <= found.room + 1, `${name}: ${id}'s box keeps to its column`);
      assert.ok(found.least >= 5.99, `${name}: ${id}'s narrowest column is ${found.least}rem`);
    }
    await tab.close();
  }
});
