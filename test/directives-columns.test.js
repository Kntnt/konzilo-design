// A section's paired body: the core's Markdown path and this package's real post-list presentation, laid out without
// script in every installed engine. Ordinary lists keep their columns; only a paired body's lone teaser fills its half.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { emitCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { pageContext } from '../src/directives/render/context.js';
import { presentationHtml } from '../src/presentations/teasers.js';
import { renderMarkdown } from './helpers/konzilo-body.js';
import { landscape } from '../gallery/src/samples.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let design, styles;
before(async () => {
  design = JSON.parse(await readFile(new URL('../examples/example.design.json', import.meta.url), 'utf8'));
  styles = `${await emitCss(design)}${await componentsCss()}${await readFile(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8')}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

const quotation = '> We used to walk straight through the courtyard. Now we stop to see what has grown.\n>\n> <cite>A. Gardener, resident and volunteer</cite>';
const list = '::post-list{type="article" number="1" presentation="cards"}';
const markdown = (reverse = false, paired = true) => `:::section{anchor="courtyard" surface="raised"${paired ? ' body="columns"' : ''}}\n\n## A courtyard made for growing\n\n${reverse ? `${quotation}\n\n${list}` : `${list}\n\n${quotation}`}\n\n:::`;
const post = (index) => ({ entry: { id: `garden-${index}`, data: { title: 'From paving to planting', excerpt: 'How one shared courtyard became a garden for everyone around it.', eyebrow: 'Case study', image: { src: landscape, alt: 'Raised beds in a sheltered courtyard' } } }, url: `/gardens/${index}/` });
const pager = { label: 'Pages', items: [{ number: 1, url: '/', label: 'Page 1', current: true }, { number: 2, url: '/page/2/', label: 'Page 2', current: false }], next: { url: '/page/2/', label: 'Next page' } };

async function fixture({ reverse = false, paired = true, count = 1, pages = false } = {}) {
  const posts = await presentationHtml('cards', { posts: Array.from({ length: count }, (_, index) => post(index)), options: {}, empty: 'No case studies yet.', pager: pages ? pager : undefined }, pageContext({ design, title: 'Shared gardens' }));
  return renderMarkdown(markdown(reverse, paired), { design }).replace(/<div class="test-post-list"[^>]*><\/div>/, posts);
}
async function open(browser, { width = 1440, root = 16, mode = 'light', dir = 'ltr', ...options } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: false });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en" dir="${dir}" data-kn-mode="${mode}" style="font-size:${root}px"><head><style>${styles}</style></head><body data-kn-surface="page"><main>${await fixture(options)}</main></body></html>`);
  tab.on('close', () => context.close().catch(() => {}));
  return tab;
}
const geometry = (tab) => tab.evaluate(() => {
  const body = document.querySelector('.kn-section-body'), head = document.querySelector('.kn-section-head');
  const box = (element) => { const { x, y, width, height, right, bottom } = element.getBoundingClientRect(); return { x, y, width, height, right, bottom }; };
  const first = body.firstElementChild, second = body.lastElementChild;
  const source = body.querySelector('cite'), quote = body.querySelector('blockquote'), card = body.querySelector('.kn-card');
  const probe = body.appendChild(document.createElement('div'));
  probe.style.inlineSize = 'var(--kn-space-column-gap)';
  const gap = probe.getBoundingClientRect().width;
  probe.remove();
  return {
    body: box(body), head: box(head), first: box(first), second: box(second), list: box(body.querySelector('.kn-post-list')),
    quote: box(quote), source: box(source), card: card ? box(card) : null, gap,
    align: getComputedStyle(head).textAlign,
    sourceSize: parseFloat(getComputedStyle(source).fontSize), quoteSize: parseFloat(getComputedStyle(quote).fontSize),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    order: [...body.children].map((element) => element.tagName),
  };
});
const near = (one, other, words) => assert.ok(Math.abs(one - other) < 1.5, `${words}: ${one} and ${other}`);

test('a paired body has two equal columns under a start-aligned head, and stacks with narrow windows or larger text', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const options of [
    { width: 1440, beside: true },
    { width: 390, beside: false },
    { width: 768, root: 24, beside: false },
    { width: 1440, dir: 'rtl', beside: true },
    { width: 390, mode: 'dark', beside: false },
    { width: 1440, mode: 'dark', reverse: true, beside: true },
  ]) {
    const tab = await open(browser, options), found = await geometry(tab), label = `${name}: ${JSON.stringify(options)}`;
    assert.equal(found.align, 'start', label);
    assert.ok(found.head.bottom <= found.body.y, `${label}: the head stands above both`);
    near(found.head.x, found.body.x, `${label}: head and body share the start edge`);
    near(found.card.width, found.list.width, `${label}: the lone card fills its column`);
    assert.deepEqual(found.order, options.reverse ? ['BLOCKQUOTE', 'DIV'] : ['DIV', 'BLOCKQUOTE'], label);
    near(found.first.width, found.second.width, `${label}: equal widths`);
    if (options.beside) {
      near(found.first.y + found.first.height / 2, found.second.y + found.second.height / 2, `${label}: centred vertically`);
      near(options.dir === 'rtl' ? found.first.x - found.second.right : found.second.x - found.first.right, found.gap, `${label}: column gap`);
    } else {
      near(found.first.width, found.body.width, `${label}: full width`);
      near(found.second.y - found.first.bottom, found.gap, `${label}: stacked at the column gap`);
    }
    assert.ok(found.sourceSize < found.quoteSize && found.source.bottom <= found.quote.bottom + 1, `${label}: the source fits under the quotation`);
    assert.equal(found.overflow, 0, label);
    await tab.close();
  }
});

test('the list keeps several teasers, its pager and its empty text in its own column', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const width of [390, 1440]) for (const count of [0, 2, 4]) {
    const tab = await open(browser, { width, count, pages: count > 0 }), found = await geometry(tab);
    assert.equal(await tab.locator('.kn-post-list .kn-card').count(), count, `${name}: ${count} cards at ${width}`);
    if (count === 0) assert.equal(await tab.locator('.kn-post-list').textContent(), 'No case studies yet.');
    else assert.equal(await tab.locator('.kn-post-list > .konzilo-pager').count(), 1);
    assert.equal(found.overflow, 0, `${name}: ${count} cards at ${width} fit`);
    if (width === 1440) near(found.first.width, found.second.width, `${name}: ${count} cards still take half the body`);
    else assert.ok(found.second.y >= found.first.bottom, `${name}: ${count} cards stack before their quotation`);
    await tab.close();
  }
});

test('an ordinary section keeps its list above the quotation and its lone teaser at the series width', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser, { paired: false }), found = await geometry(tab);
    assert.ok(found.second.y >= found.first.bottom, `${name}: ordinary blocks stay stacked`);
    assert.ok(found.card.width < found.list.width / 2, `${name}: an ordinary lone teaser keeps its existing column`);
    assert.equal(await tab.locator('[data-kn-body]').count(), 0);
    await tab.close();
  }
});
