// Body text in the browser, in every engine Playwright has here: a quotation that looks as Quotation does, its source
// under it, so it cannot be taken for the text round it.
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
