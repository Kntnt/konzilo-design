// Package C of the directives (docs/spec/directives.md, `cards` and `::post-list`): contactOf, and the readings the
// stylesheet makes of the markup in test/fixtures/directives-cards.html, in every engine Playwright has here.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { contactOf } from '../src/directives/cards.js';
import * as directives from '../src/directives/index.js';

test('contactOf finds a number or an address that is the text of its own link', () => {
  assert.equal(contactOf('tel:+442079460000', '+44 20 7946 0000'), 'phone');
  assert.equal(contactOf('tel:+15550100', '(555) 0100'), 'phone');
  assert.equal(contactOf('TEL:112', '112'), 'phone');
  assert.equal(contactOf(' tel:08-123 45', '08–123 45'), 'phone', 'a dash and white space round the address');
  assert.equal(contactOf('mailto:office@example.com', 'office@example.com'), 'email');
  assert.equal(contactOf('MAILTO:office@example.com?subject=Hi', ' office@example.com '), 'email');
  for (const [href, text] of [
    ['tel:+442079460000', 'Call us'],
    ['tel:+442079460000', 'Call +44 20 7946 0000'],
    ['tel:12', '12'],
    ['mailto:office@example.com', 'Write to us'],
    ['mailto:office@example.com', 'office at example.com'],
    ['https://example.com/', '+44 20 7946 0000'],
    ['https://example.com/', 'office@example.com'],
    ['/contact', 'office@example.com'],
    [undefined, '112'],
    ['tel:112', undefined],
  ]) assert.equal(contactOf(href, text), null, `${href} ${text}`);
  assert.equal(directives.contactOf, contactOf, 'the directives module exports it');
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="#888"/></svg>';
let styles, fixture;
const browsers = [];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  fixture = await readFile(new URL('./fixtures/directives-cards.html', import.meta.url), 'utf8');
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function page(browser, { width = 1440, text = 16 } = {}) {
  const tab = await browser.newPage({ viewport: { width, height: 900 } });
  // The fixture names its pictures, and an origin of its own serves them.
  await tab.route('https://fixture.test/**', (route) => route.request().url().endsWith('.svg')
    ? route.fulfill({ body: PICTURE, contentType: 'image/svg+xml' })
    : route.fulfill({ body: '<!doctype html><title>Fixture</title>', contentType: 'text/html' }));
  await tab.goto('https://fixture.test/');
  await tab.setContent(`<!doctype html><html lang="en" style="font-size: ${text}px"><head><base href="https://fixture.test/"><style>${styles}</style></head><body data-kn-surface="page"><div class="kn-page">${fixture}</div></body></html>`, { waitUntil: 'load' });
  return tab;
}

// How many columns a series of n takes where `fit` columns of the minimum width fit: the owner's rule at four, and
// the same choice between three and two where four do not fit.
function columns(n, fit) {
  if (fit === 1) return 1;
  if (n === 2) return 2;
  if (fit === 2) return 2;
  if (n === 1 || n === 3 || [5, 6, 9].includes(n % 12)) return 3;
  if (fit === 4) return 4;
  return n % 6 === 4 ? 2 : 3;
}
const expectedRows = (n, c) => [...Array(Math.floor(n / c)).fill(c), ...(n % c ? [n % c] : [])].join('+');

test('the owner\'s rule, as the contract gives it: three or four columns, whichever leaves the last row fuller', () => {
  assert.deepEqual(Array.from({ length: 13 }, (_, i) => columns(i + 1, 4)), [3, 2, 3, 4, 3, 3, 4, 4, 3, 4, 4, 4, 4]);
  for (let n = 4; n <= 40; n++) {
    const last = (c) => n % c || c;
    const best = last(3) > last(4) ? 3 : 4;
    assert.equal(columns(n, 4), best, `${n} cards`);
  }
  // Where four do not fit: never three and one, and two only where it leaves the last row fuller than three.
  assert.deepEqual([4, 7, 8, 10, 11, 12, 13].map((n) => columns(n, 3)), [2, 3, 3, 2, 3, 3, 3]);
});

// Each series, its items' rows ("4+4+1"), its own width, its gap and the minimum card width, all in pixels.
const measure = (tab) => tab.evaluate(() => {
  const probe = document.body.appendChild(document.createElement('div'));
  probe.style.inlineSize = '15rem';
  const minimum = probe.getBoundingClientRect().width;
  probe.remove();
  return [...document.querySelectorAll('.kn-cards, .kn-timeline, .kn-reasons')].map((grid) => {
    const counts = new Map();
    const shown = [...grid.children].filter((item) => !item.hidden);
    for (const item of shown) { const top = Math.round(item.getBoundingClientRect().top); counts.set(top, (counts.get(top) ?? 0) + 1); }
    const style = getComputedStyle(grid);
    return { id: grid.closest('section').id, n: shown.length, rows: [...counts.values()].join('+'), width: grid.clientWidth - parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd), gap: parseFloat(style.columnGap), minimum, first: shown[0]?.getBoundingClientRect().width };
  });
});

test('every series, of one to thirteen cards, steps and reasons, takes its columns from its number at every width and text size', { timeout: 300000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) for (const width of [1440, 1024, 768, 390]) {
    const tab = await page(browser, { width, text });
    const series = await measure(tab);
    assert.ok(series.filter(({ id }) => id.startsWith('count-')).length === 13, 'the fixture holds thirteen counts');
    for (const { id, n, rows, width: inner, gap, minimum, first } of series) {
      const needs = (c) => c * minimum + (c - 1) * gap;
      // A width within a pixel of a switch may round either way, as the 0.99 in the rule allows.
      if ([4, 3, 2].some((c) => Math.abs(inner - needs(c)) < 1)) continue;
      const fit = inner >= needs(4) ? 4 : inner >= needs(3) ? 3 : inner >= needs(2) ? 2 : 1;
      const c = columns(n, fit);
      assert.equal(rows, expectedRows(n, c), `${id} in ${name} at ${text}px text and ${width}`);
      // Every item, a lone one too, has its column's share.
      const share = (inner - (c - 1) * gap) / c;
      assert.ok(Math.abs(first - share) < 2, `${id}: ${first} against ${share} in ${name} at ${text}px text and ${width}`);
    }
    assert.ok(await tab.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `no horizontal scroll in ${name} at ${text}px text and ${width}`);
    await tab.close();
  }
});

test('a filtered series counts only the cards that show', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const rows = async () => (await measure(tab)).find(({ id }) => id === 'posts-filtered').rows;
    assert.equal(await rows(), '4+3', name);
    await tab.evaluate(() => [...document.querySelectorAll('#posts-1 > .kn-card')].slice(0, 2).forEach((card) => { card.hidden = true; }));
    assert.equal(await rows(), '3+2', `${name}: five show, so three and two`);
    await tab.evaluate(() => [...document.querySelectorAll('#posts-1 > .kn-card')].slice(0, 3).forEach((card) => { card.hidden = true; }));
    assert.equal(await rows(), '4', `${name}: four show, so four`);
    assert.equal(await tab.$eval('#posts-1 > .kn-card[hidden]', (card) => getComputedStyle(card).display), 'none');
    await tab.close();
  }
});

test('featured posts: the latest large over two columns and two rows, the next two beside it, the rest after', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const [width, shape] of [[1440, 'three'], [768, 'two'], [390, 'one']]) {
    const tab = await page(browser, { width });
    const boxes = await tab.$$eval('#posts-featured .kn-featured > .kn-card', (cards) => cards.map((card) => { const box = card.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), bottom: Math.round(box.bottom) }; }));
    const [first, second, third, fourth] = boxes;
    if (shape === 'three') {
      assert.ok(first.w > 1.9 * second.w, `${name}: the latest is two columns wide`);
      assert.equal(second.x, third.x, `${name}: the next two stand in one column`);
      assert.ok(second.x > first.x + first.w && second.y === first.y && third.bottom === first.bottom, `${name}: beside it, as tall together`);
      assert.ok(fourth.y > first.bottom && fourth.w === second.w, `${name}: the rest after it, as the small ones`);
    } else if (shape === 'two') {
      assert.ok(first.w > 1.9 * second.w && second.y === third.y && second.y > first.bottom, `${name}: the latest across both columns, the next two under it`);
    } else {
      assert.ok(boxes.every((box) => box.x === first.x && box.w === first.w), `${name}: one column`);
    }
    await tab.close();
  }
});

test('a card whose heading\'s link is its only link is a link as a whole; an open card is not', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const hits = await tab.evaluate(() => [...document.querySelectorAll('#cards-kinds .kn-card')].map((card) => {
      const text = card.querySelector('.kn-card-text').getBoundingClientRect();
      return document.elementFromPoint(text.left + 2, text.top + text.height / 2)?.closest('a')?.className ?? null;
    }));
    assert.deepEqual(hits, ['kn-card-link', null, null], name);
    const link = await tab.$eval('#cards-kinds .kn-card-link', (element) => ({ color: getComputedStyle(element).color, decoration: getComputedStyle(element).textDecorationLine, heading: getComputedStyle(element.parentElement).color }));
    assert.deepEqual([link.color, link.decoration], [link.heading, 'none'], `${name}: body text does not draw the card's link as a link`);
    await tab.close();
  }
});

test('a number or an address alone in its paragraph is drawn as one, and "Call us" stays an ordinary link', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const [phone, email, call] = await tab.$$eval('#cards-kinds .kn-card-text a', (links) => links.map((link) => ({ size: parseFloat(getComputedStyle(link).fontSize), weight: getComputedStyle(link).fontWeight, numbers: getComputedStyle(link).fontVariantNumeric })));
    assert.ok(phone.size > call.size && email.size > call.size, `${name}: larger than the paragraph's small type`);
    assert.ok(Number(phone.weight) > Number(call.weight), `${name}: heavier than a plain link`);
    assert.equal(phone.numbers, 'tabular-nums', name);
    await tab.close();
  }
});

test('the picture fills a card behind its text, under the picture Surface\'s checked scrim; a card without one is ordinary', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const width of [1440, 390]) {
    const tab = await page(browser, { width });
    const cards = await tab.$$eval('#behind .kn-card', (all) => all.map((card) => {
      const box = card.getBoundingClientRect();
      const picture = card.querySelector('.kn-card-picture')?.getBoundingClientRect();
      const scrim = getComputedStyle(card, '::before');
      const words = [...card.querySelectorAll('h3, p')].map((element) => element.getBoundingClientRect());
      return {
        covered: !!picture && picture.width >= box.width - 8 && picture.height >= box.height - 8,
        scrim: scrim.content !== 'none' && getComputedStyle(card).getPropertyValue('--kn-scrim').trim() !== '' && !/rgba\(0, 0, 0, 0\)|transparent/.test(scrim.backgroundColor),
        inside: words.every((word) => word.top >= box.top && word.bottom <= box.bottom),
      };
    }));
    assert.deepEqual(cards.map(({ covered, scrim, inside }) => [covered, scrim, inside]), [[true, true, true], [true, true, true], [true, true, true], [false, false, true]], `${name} at ${width}`);
    await tab.close();
  }
});

test('a symbol keeps its proportions in a box the same on every card for its place', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    for (const place of ['item', 'heading']) {
      const boxes = await tab.$$eval(`#symbol-${place} .kn-card-symbol`, (symbols) => symbols.map((symbol) => { const box = symbol.getBoundingClientRect(); return `${Math.round(box.width)}x${Math.round(box.height)}`; }));
      assert.equal(new Set(boxes).size, 1, `${name}, ${place}: ${boxes}`);
      const fits = await tab.$$eval(`#symbol-${place} .kn-card-symbol > *`, (images) => images.map((image) => getComputedStyle(image).objectFit));
      assert.deepEqual([...new Set(fits)], ['contain'], `${name}, ${place}`);
    }
    await tab.close();
  }
});

test('marks and numbers: a check or a cross before each heading, and steps numbered as written', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const marks = await tab.evaluate(() => ['#reasons-check .kn-reason-heading', '#reasons-cross .kn-reason-heading', '#cards-signed .kn-card-heading'].map((selector) => {
      const heading = document.querySelector(selector);
      const mark = getComputedStyle(heading, '::before');
      const probe = heading.appendChild(document.createElement('i'));
      probe.style.color = 'var(--kn-accent)';
      const accent = getComputedStyle(probe).color;
      probe.style.color = 'var(--kn-text-muted)';
      const muted = getComputedStyle(probe).color;
      probe.remove();
      return { shown: parseFloat(mark.width) > 0 && mark.clipPath !== 'none', colour: mark.backgroundColor === accent ? 'accent' : mark.backgroundColor === muted ? 'muted' : mark.backgroundColor };
    }));
    assert.deepEqual(marks, [{ shown: true, colour: 'accent' }, { shown: true, colour: 'muted' }, { shown: true, colour: 'accent' }], name);
    // The mark hangs: a reason's heading and its text share one edge.
    const edges = await tab.$eval('#reasons-check .kn-reason', (reason) => {
      const range = document.createRange();
      range.selectNodeContents(reason.querySelector('h3'));
      return [Math.round(range.getClientRects()[0].left), Math.round(reason.querySelector('p').getBoundingClientRect().left)];
    });
    assert.ok(Math.abs(edges[0] - edges[1]) <= 1, `${name}: ${edges}`);
    const numbers = await tab.evaluate(() => ['steps-decimal', 'steps-latin', 'steps-roman', 'steps-double'].map((id) => getComputedStyle(document.querySelector(`#${id} .kn-timeline-item`), '::before').content.replace(/(^|\s)""(?=\s|$)/g, '').trim()));
    for (const [content, style, before, after] of [[numbers[0], 'kn-decimal', '', ''], [numbers[1], 'kn-upper-latin', '', '.'], [numbers[2], 'kn-lower-roman', '(', ')'], [numbers[3], 'kn-double-latin', '', '']]) {
      assert.match(content, new RegExp(`counter\\(kn-timeline, ${style}\\)`), `${name}: ${content}`);
      assert.ok(content.startsWith(before ? `"${before}"` : 'counter') && content.endsWith(after ? `"${after}"` : ')'), `${name}: ${content}`);
    }
    await tab.close();
  }
});

test('a lone main action after cards that lead on shows more of them, as after any series', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const read = await tab.$eval('#navigation-more .kn-action', (link) => ({ background: getComputedStyle(link).backgroundColor, arrow: getComputedStyle(link, '::after').content }));
    assert.deepEqual(read, { background: 'rgba(0, 0, 0, 0)', arrow: '""' }, name);
    await tab.close();
  }
});

test('a filtered post list stays put when Visitor Filters starts: no "Show" and no empty pagination row before it', { timeout: 120000 }, async () => {
  const runtime = `${await readFile(new URL('../src/components/visitor-filters.js', import.meta.url), 'utf8')}\nsetupVisitorFilters();`;
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const top = () => tab.$eval('#posts-1', (grid) => Math.round(grid.getBoundingClientRect().top + scrollY));
    const was = await top();
    await tab.addScriptTag({ type: 'module', content: runtime });
    await tab.waitForSelector('#posts-filtered .kn-visitor-filters[data-kn-enhanced]', { state: 'attached' });
    assert.equal(await top(), was, name);
    await tab.close();
  }
});
