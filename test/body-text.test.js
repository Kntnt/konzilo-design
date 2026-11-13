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
import { renderMarkdown } from './helpers/konzilo-body.js';

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

// Tables as the Konzilo core writes them in a body: bare, at the top of the body text and in a part, and in the wrapper
// it is asked to write, `.konzilo-table` (konzilo.css).
const WIDE = '<table><thead><tr><th>Service</th><th>What it holds</th><th>Price</th><th>Term</th></tr></thead><tbody><tr><td>Planning</td><td>A plan for the beds over a whole season</td><td style="text-align:right">1200</td><td>Monthly</td></tr></tbody></table>';
const NARROW = '<table><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Small</td><td>10</td></tr></tbody></table>';
const tables = (table) => `<div class="kn-body-text" id="flow" style="inline-size: min(100%, 40rem)">${table.replace('<table', '<table id="top"')}
  <aside class="kn-fact-box" data-kn-surface="raised"><p class="kn-fact-box-label" data-kn-type="label">In short</p>${table.replace('<table', '<table id="fact"')}</aside>
  <details class="kn-tabs-item" name="tabs" open><summary class="kn-tabs-tab">A tab</summary><div class="kn-tabs-panel">${table.replace('<table', '<table id="tab"')}</div></details>
  <article class="kn-card" data-kn-surface="raised"><h3 class="kn-card-heading" data-kn-type="heading-5">A card</h3>${table.replace('<table', '<table id="card"')}</article>
  <div class="konzilo-table">${table.replace('<table', '<table id="wrapped"')}</div></div>`;
const konzilo = readFileSync(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8');
const measureTables = (tab) => tab.evaluate(() => Object.fromEntries(['top', 'fact', 'tab', 'card', 'wrapped'].map((id) => {
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

test('a narrow table in the core\'s wrapper takes the whole column, as the library\'s Table does; a bare one keeps its own width', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: { width: 1024, height: 900 } });
    await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}${konzilo}</style></head><body data-kn-surface="page">${tables(NARROW)}</body></html>`);
    const found = await measureTables(tab);
    assert.ok(Math.abs(found.wrapped.row - found.wrapped.room) < 1, `${name}: the wrapped table is ${found.wrapped.row} of ${found.wrapped.room}`);
    assert.equal(found.wrapped.scrolls, false, name);
    assert.ok(found.top.row < found.top.room - 100, `${name}: a bare table keeps its own width in every engine alike`);
    await tab.close();
  }
});

// A body's table in each place it may stand, as the core renders the body: in the body text between paragraphs, under a
// heading and over one, alone; in a fact box, a tab, an answer, a choice's panel and a card, between paragraphs and alone.
const TABLE = '| Service | What it holds | Price | Term |\n| --- | --- | ---: | --- |\n| Planning | A plan for the beds | 1200 | Monthly |';
const PLACES = {
  flow: `Words before.\n\n${TABLE}\n\nWords after.`,
  headings: `## A heading\n\n${TABLE}\n\n### Another heading\n\nWords.`,
  alone: TABLE,
  'fact box': `Words.\n\n:::aside\n\n::eyebrow[In short]\n\n${TABLE}\n\nWords in the box.\n\n:::\n\nWords.`,
  'fact box, alone': `Words.\n\n:::aside\n\n${TABLE}\n\n:::\n\nWords.`,
  tab: `Words.\n\n:::tabs\n\n### Small\n\nWords before.\n\n${TABLE}\n\nWords after.\n\n### Large\n\nWords.\n\n:::\n\nWords.`,
  'tab, alone': `:::tabs\n\n### Small\n\n${TABLE}\n\n### Large\n\nWords.\n\n:::`,
  answer: `:::accordion{first="open"}\n\n### What does it cost?\n\nWords before.\n\n${TABLE}\n\nWords after.\n\n### How long?\n\nWords.\n\n:::`,
  'answer, alone': `:::accordion{first="open"}\n\n### What does it cost?\n\n${TABLE}\n\n### How long?\n\nWords.\n\n:::\n\nWords.`,
  choice: `:::choice\n\n### Yes\n\nWords before.\n\n${TABLE}\n\nWords after.\n\n### No\n\nWords.\n\n:::`,
  'choice, alone': `:::choice\n\n### Yes\n\n${TABLE}\n\n### No\n\nWords.\n\n:::`,
  card: `:::cards\n\n### A card\n\nWords before.\n\n${TABLE}\n\nWords after.\n\n:::`,
  'card, last': `:::cards\n\n### A card\n\nWords.\n\n${TABLE}\n\n:::`,
};
// Where each table's box stands in its place: its top, the space under it to what follows, and the place's height.
const placeOfTables = (tab, port) => tab.evaluate((port) => Object.fromEntries([...document.querySelectorAll('[data-place]')].flatMap((place) => {
  const edge = place.getBoundingClientRect();
  return [...place.querySelectorAll(port)].map((box, at) => {
    const own = box.getBoundingClientRect();
    const next = box.nextElementSibling?.getBoundingClientRect().top ?? box.parentElement.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(box.parentElement).paddingBlockEnd);
    return [`${place.dataset.place} ${at + 1}`, { top: own.top - edge.top, under: next - own.bottom, height: edge.height }];
  });
})), port);

test('a table in the core\'s wrapper stands where the bare table stood, in body text, a fact box, a tab, an answer, a choice and a card', { timeout: 180000 }, async () => {
  // Each place's own names, so that opening one <details> closes none in another, and a choice's first answer chosen.
  const bare = Object.entries(PLACES).map(([place, markdown], at) => `<div data-place="${place}" style="display: flow-root"><div class="kn-body-text">${
    renderMarkdown(markdown).replace(/="(accordion|tabs|choice)-1"/g, `="$1-${at}"`).replace(/<details class="kn-choice-item"/, '$& open')}</div></div>`).join('');
  const boxed = bare.replace(/<table/g, '<div class="konzilo-table"><table').replace(/<\/table>/g, '</table></div>');
  assert.equal(boxed.match(/class="konzilo-table"/g).length, Object.keys(PLACES).length);
  for (const [name, browser] of browsers) {
    for (const width of [1280, 390]) {
      const tab = await browser.newPage({ viewport: { width, height: 900 } });
      const placed = async (body, port) => {
        await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}${konzilo}</style></head><body data-kn-surface="page" style="padding-inline: 1rem"><main style="inline-size: min(100%, 40rem); margin-inline: auto">${body}</main></body></html>`);
        return placeOfTables(tab, port);
      };
      const before = await placed(bare, 'table');
      const after = await placed(boxed, '.konzilo-table');
      assert.deepEqual(Object.keys(after), Object.keys(before), name);
      const moved = Object.entries(before).flatMap(([at, was]) => ['top', 'under', 'height']
        .filter((measure) => Math.abs(after[at][measure] - was[measure]) >= 0.5)
        .map((measure) => `${at}: its ${measure} ${after[at][measure].toFixed(2)}, the bare one's ${was[measure].toFixed(2)}`));
      assert.deepEqual(moved, [], `${name} at ${width}px`);
      await tab.close();
    }
  }
});
