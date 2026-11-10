// Lists, markers and actions (docs/spec/directives.md, `list` and Task lists): the module's pure functions, and the
// fixture's markup in every engine Playwright has here, laid out by the real stylesheet, at 16 and 24px text.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { markerAttributes, serviceOf, SERVICES, iconHtml } from '../src/directives/index.js';
import { icons } from '../src/components/icons.js';

test('markerAttributes reads a sign for bullets and a numbering for a numbered level', () => {
  assert.deepEqual(markerAttributes('v', 1, false), { 'data-kn-sign': 'check' });
  assert.deepEqual(markerAttributes('✓', 1, false), { 'data-kn-sign': 'check' });
  assert.deepEqual(markerAttributes('x', 1, false), { 'data-kn-sign': 'cross' });
  assert.deepEqual(markerAttributes('✗', 1, false), { 'data-kn-sign': 'cross' });
  const numbering = { 1: 'decimal', a: 'lower-latin', A: 'upper-latin', i: 'lower-roman', I: 'upper-roman', α: 'lower-greek', aa: 'double-latin' };
  for (const [value, name] of Object.entries(numbering)) {
    assert.deepEqual(markerAttributes(value, 1, true), { 'data-kn-numbering': name }, value);
    assert.deepEqual(markerAttributes(`${value}.`, 1, true), { 'data-kn-numbering': name, 'data-kn-punctuation': 'period' }, value);
    assert.deepEqual(markerAttributes(`${value})`, 1, true), { 'data-kn-numbering': name, 'data-kn-punctuation': 'parenthesis' }, value);
    assert.deepEqual(markerAttributes(`(${value})`, 1, true), { 'data-kn-numbering': name, 'data-kn-punctuation': 'brackets' }, value);
  }
});

test('markerAttributes gives a dotted value below the first level, the nearest level above of its kind, and nothing else', () => {
  // The contract's example: 1/1.1 numbers a third level 2.1.1.
  assert.deepEqual(markerAttributes('1/1.1', 1, true), { 'data-kn-numbering': 'decimal' });
  assert.deepEqual(markerAttributes('1/1.1', 2, true), { 'data-kn-numbering': 'decimal', 'data-kn-dotted': '' });
  assert.deepEqual(markerAttributes('1/1.1', 3, true), { 'data-kn-numbering': 'decimal', 'data-kn-dotted': '' });
  assert.deepEqual(markerAttributes('A/A.1)', 2, true), { 'data-kn-numbering': 'decimal', 'data-kn-punctuation': 'parenthesis', 'data-kn-dotted': '' });
  assert.deepEqual(markerAttributes('1.a', 2, true), { 'data-kn-numbering': 'lower-latin', 'data-kn-dotted': '' }, 'a level below the first takes the first, dot and all');
  assert.deepEqual(markerAttributes('1.a', 1, true), { 'data-kn-numbering': 'lower-latin' }, 'no dot on the first level');
  assert.deepEqual(markerAttributes('1./a)', 1, true), { 'data-kn-numbering': 'decimal', 'data-kn-punctuation': 'period' });
  assert.deepEqual(markerAttributes('1./a)', 2, true), { 'data-kn-numbering': 'lower-latin', 'data-kn-punctuation': 'parenthesis' });
  assert.deepEqual(markerAttributes('1./a)', 3, true), { 'data-kn-numbering': 'lower-latin', 'data-kn-punctuation': 'parenthesis' });
  // A level of the other kind passes over a value above for the nearest of its own.
  assert.deepEqual(markerAttributes('v/1', 3, false), { 'data-kn-sign': 'check' });
  assert.deepEqual(markerAttributes('v/1', 3, true), { 'data-kn-numbering': 'decimal' });
  // A value of the other kind on the level itself gives it none; an empty value takes the one above.
  assert.deepEqual(markerAttributes('1', 1, false), {});
  assert.deepEqual(markerAttributes('v', 1, true), {});
  assert.deepEqual(markerAttributes('1/v', 2, true), {});
  assert.deepEqual(markerAttributes('1//', 3, true), { 'data-kn-numbering': 'decimal' });
  assert.deepEqual(markerAttributes(' 1 / a ', 2, true), { 'data-kn-numbering': 'lower-latin' });
  for (const nothing of [undefined, '', 'z', 'b.', '1.b', '((1))']) assert.deepEqual(markerAttributes(nothing, 1, true), {}, String(nothing));
});

test('serviceOf knows each service by its host and the host\'s subdomains, and nothing else', () => {
  assert.deepEqual(Object.keys(SERVICES), ['linkedin', 'facebook', 'instagram', 'youtube', 'x']);
  const known = {
    'https://www.linkedin.com/company/example': ['linkedin', 'linkedin'],
    'https://linkedin.com/in/someone': ['linkedin', 'linkedin'],
    'https://m.facebook.com/example': ['facebook', 'facebook'],
    'https://www.instagram.com/example/': ['instagram', 'instagram'],
    'https://www.youtube.com/@example': ['youtube', 'youtube'],
    'https://youtu.be/abc': ['youtube', 'youtube'],
    'https://x.com/example': ['x', 'brand-x'],
    'http://twitter.com/example': ['x', 'brand-x'],
    'https://WWW.LinkedIn.COM./x': ['linkedin', 'linkedin'],
  };
  for (const [href, [service, icon]] of Object.entries(known)) assert.deepEqual(serviceOf(href), { service, icon }, href);
  for (const href of ['https://notlinkedin.com/', 'https://linkedin.com.example.net/', 'https://example.com/x.com', 'mailto:someone@x.com', '/linkedin', '', undefined, 'not a link'])
    assert.equal(serviceOf(href), null, String(href));
  for (const { icon } of Object.values(SERVICES)) {
    assert.ok(Object.hasOwn(icons, icon), icon);
    assert.match(iconHtml(icon), /^<svg class="kn-icon" viewBox="0 0 24 24"/);
  }
  assert.notEqual(icons['brand-x'], icons.x, 'the close mark stays as it is');
});

test('the list stylesheets read only the design: no colour, image or typeface of their own', async () => {
  for (const name of ['markers', 'description-list', 'value-list', 'logos', 'actions']) {
    const css = (await readFile(new URL(`../src/components/${name}.css`, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|url\(|font-family:(?!\s*var\()/i, name);
  }
  const index = await readFile(new URL('../src/components/index.css', import.meta.url), 'utf8');
  for (const name of ['markers', 'description-list', 'value-list', 'logos', 'actions']) assert.match(index, new RegExp(`@import "\\./${name}\\.css";`));
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const logo = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#999"/></svg>`;
const LOGOS = { 'logo-wide.svg': logo(400, 100), 'logo-square.svg': logo(100, 100), 'logo-tall.svg': logo(100, 160) };
let styles;
let fixture;
const browsers = [];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}${await readFile(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8')}`;
  fixture = await readFile(new URL('./fixtures/directives-lists.html', import.meta.url), 'utf8');
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function open(browser, { width = 1024, text = 16, surface } = {}) {
  const tab = await browser.newPage({ viewport: { width, height: 900 } });
  const body = surface ? fixture.replaceAll('<section class="kn-band kn-section"', `<section class="kn-band kn-section" data-kn-surface="${surface}"`) : fixture;
  const html = `<!doctype html><html lang="en" style="font-size: ${text}px"><head><meta charset="utf-8"><style>${styles}</style></head><body data-kn-surface="page"><div class="kn-page">${body}</div></body></html>`;
  await tab.route('**/*', (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    if (LOGOS[file]) return route.fulfill({ contentType: 'image/svg+xml', body: LOGOS[file] });
    return file ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ contentType: 'text/html', body: html });
  });
  await tab.goto('http://lists.test/');
  await tab.waitForFunction(() => [...document.images].every((image) => image.complete));
  return tab;
}

test('numbered levels stay real lists, numbered by this package\'s counter styles, each list counting from its start', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    const read = await tab.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector));
      return {
        nested: style('.probe-nested').listStyleType,
        sub: style('.probe-nested ol').listStyleType,
        roman: style('.probe-roman').listStyleType,
        latin: style('.probe-latin').listStyleType,
        dotted: style('.probe-dotted ol').listStyleType,
        // Each list resets the browser's own count, which its counters would otherwise take the place of.
        reset: style('.probe-nested').counterReset,
        start: style('.probe-mixed').counterReset,
        plain: style('.probe-plain').listStyleType,
        tags: [...document.querySelectorAll('[data-kn-numbering]')].every((list) => list.tagName === 'OL'),
      };
    });
    assert.equal(read.nested, 'kn-decimal-period', name);
    assert.equal(read.sub, 'kn-lower-latin-parenthesis', name);
    assert.equal(read.roman, 'kn-lower-roman-brackets', name);
    assert.equal(read.latin, 'kn-lower-latin', name);
    assert.equal(read.dotted, 'none', `${name}: a dotted level draws its numbers itself`);
    assert.match(read.reset, /list-item 0\b/, name);
    assert.match(read.start, /list-item 2\b/, `${name}: start="3"`);
    assert.equal(read.plain, 'disc', `${name}: a plain list keeps the design's bullets`);
    assert.ok(read.tags, name);
    await tab.close();
  }
});

test('a dotted level hangs its numbers where a marker would, and they grow with the depth', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) {
    const tab = await open(browser, { width: 390, text });
    const read = await tab.evaluate(() => {
      const before = (li) => getComputedStyle(li, '::before');
      const items = [...document.querySelectorAll('.probe-dotted [data-kn-dotted] > li')];
      return items.map((li) => ({ position: before(li).position, width: parseFloat(before(li).width), left: li.getBoundingClientRect().left }));
    });
    assert.ok(read.length === 5 && read.every((item) => item.position === 'absolute' && item.width > 0), `${name} at ${text}px`);
    assert.ok(read.every((item) => item.left - item.width >= 0), `${name} at ${text}px: within the window`);
    await tab.close();
  }
});

test('a sign stands before each item, inside the list\'s room, with the item\'s words lined up', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    const read = await tab.evaluate(() => ['.probe-check', '.probe-cross'].map((selector) => {
      const list = document.querySelector(selector);
      const li = list.querySelector('li');
      const text = document.createRange();
      text.selectNodeContents(li);
      const mark = getComputedStyle(li, '::before');
      return { list: list.getBoundingClientRect().left, text: text.getClientRects()[0].left, style: getComputedStyle(list).listStyleType, mark: mark.content, size: parseFloat(mark.height), colour: mark.borderInlineStartColor || mark.borderRightColor };
    }));
    for (const sign of read) {
      assert.equal(sign.style, 'none', name);
      assert.equal(sign.mark, '""', name);
      assert.ok(sign.size > 0, name);
      assert.ok(sign.text - sign.list >= 16, `${name}: room for the mark`);
    }
    await tab.close();
  }
});

test('a task box stands in place of the bullet, item by item, on the first line', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) {
    const tab = await open(browser, { width: 390, text });
    const read = await tab.evaluate(() => {
      const list = document.querySelector('.probe-tasks');
      return [...list.children].map((li) => {
        const box = li.querySelector('input')?.getBoundingClientRect();
        const first = li.getBoundingClientRect();
        return { task: !!box, marker: getComputedStyle(li).listStyleType, box: box && { left: box.left, right: box.right, middle: (box.top + box.bottom) / 2 }, li: { left: first.left, top: first.top, line: parseFloat(getComputedStyle(li).lineHeight) } };
      });
    });
    const [question, done, plain] = read;
    for (const item of [question, done]) {
      assert.equal(item.marker, 'none', name);
      assert.ok(item.box.right <= item.li.left && item.box.left >= 0, `${name} at ${text}px: the box hangs before the words`);
      assert.ok(Math.abs(item.box.middle - (item.li.top + item.li.line / 2)) < 2, `${name} at ${text}px: centred on the first line`);
    }
    assert.equal(plain.task, false);
    assert.equal(plain.marker, 'disc', `${name}: an item that is no task keeps its bullet`);
    assert.equal(plain.li.left, question.li.left, `${name}: the words line up`);
    await tab.close();
  }
});

test('terms stand beside their descriptions and above them when narrow; values side by side; logos under their label', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const width of [1024, 390]) {
    const tab = await open(browser, { width });
    const read = await tab.evaluate(() => {
      const box = (element) => element.getBoundingClientRect();
      const item = document.querySelector('.kn-description-list-item');
      const [dt, dd] = [box(item.querySelector('dt')), box(item.querySelector('dd'))];
      const values = [...document.querySelectorAll('.kn-value-list-item')].map((element) => Math.round(box(element).top));
      const label = box(document.querySelector('.kn-logos-label'));
      const logos = [...document.querySelectorAll('.kn-logos-list img')].map(box);
      return { beside: dd.left >= dt.right && Math.abs(dd.top - dt.top) < 12, above: dd.top >= dt.bottom, values, label, heights: logos.map((logo) => Math.round(logo.height)), logoTop: Math.min(...logos.map((logo) => logo.top)), centre: (Math.min(...logos.map((logo) => logo.left)) + Math.max(...logos.map((logo) => logo.right))) / 2, labelCentre: (label.left + label.right) / 2 };
    });
    if (width === 1024) {
      assert.ok(read.beside, `${name}: the term beside`);
      assert.equal(new Set(read.values).size, 1, `${name}: the values side by side`);
    } else {
      assert.ok(read.above, `${name}: the term above`);
    }
    assert.equal(new Set(read.heights).size, 1, `${name}: logos of one height`);
    assert.ok(read.logoTop > read.label.bottom, `${name}: under their label`);
    assert.ok(Math.abs(read.centre - read.labelCentre) < 2, `${name}: centred under it at ${width}`);
    await tab.close();
  }
});

test('actions: the main one filled, the others outlined, a service as its icon, and a lone main one after a series as more of it', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const surface of [undefined, 'accent']) {
    const tab = await open(browser, { surface });
    const read = await tab.evaluate(() => {
      const style = (element) => getComputedStyle(element);
      const [main, other, service] = document.querySelectorAll('.probe-actions .kn-action');
      const label = service.querySelector('.kn-action-label');
      const icons = [...document.querySelectorAll('.probe-icons .kn-action')];
      const more = document.querySelector('.probe-more');
      const link = more.querySelector('.kn-action');
      const box = (element) => element.getBoundingClientRect();
      return {
        main: { background: style(main).backgroundColor, decoration: style(main).textDecorationLine, fill: style(main).getPropertyValue('--kn-button-background') },
        other: { background: style(other).backgroundColor, ring: style(other).boxShadow },
        heights: [main, other, service].map((element) => Math.round(box(element).height)),
        service: { width: box(service).width, labelHidden: style(label).clipPath, labelText: label.textContent, icon: !!service.querySelector('svg.kn-icon') },
        icons: icons.map((element) => ({ ring: style(element).boxShadow, background: style(element).backgroundColor, target: Math.min(box(element).width, box(element).height) })),
        more: { background: style(link).backgroundColor, colour: style(link).color, linkColour: style(link).getPropertyValue('--kn-link').trim(), centred: Math.abs((box(link).left + box(link).right) / 2 - (box(more).left + box(more).right) / 2) < 1, arrow: getComputedStyle(link, '::after').content, ring: style(link).boxShadow },
      };
    });
    const where = `${name}${surface ? ` on ${surface}` : ''}`;
    assert.notEqual(read.main.background, 'rgba(0, 0, 0, 0)', `${where}: the main action is filled`);
    assert.equal(read.main.decoration, 'none', where);
    assert.equal(read.other.background, 'rgba(0, 0, 0, 0)', `${where}: the others are outlined`);
    assert.match(read.other.ring, /inset/, where);
    assert.ok(Math.max(...read.heights) - Math.min(...read.heights) <= 1, `${where}: one height in a row, ${read.heights}`);
    assert.equal(read.service.labelHidden, 'inset(50%)', `${where}: the words kept for a screen reader`);
    assert.equal(read.service.labelText, 'LinkedIn');
    assert.ok(read.service.icon && read.service.width < 60, where);
    for (const icon of read.icons) {
      assert.equal(icon.ring, 'none', `${where}: a row of icons has no box`);
      assert.equal(icon.background, 'rgba(0, 0, 0, 0)', where);
      assert.ok(icon.target >= 44 - 0.5, `${where}: a target a finger can find`);
    }
    assert.equal(read.more.background, 'rgba(0, 0, 0, 0)', `${where}: more of the series is no filled button`);
    assert.equal(read.more.ring, 'none', where);
    assert.ok(read.more.centred, `${where}: under the series, in the middle`);
    assert.equal(read.more.arrow, '""', where);
    await tab.close();
  }
});

test('no list leaves the window or scrolls it sideways, at a phone\'s width and larger text', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) for (const text of [16, 24]) for (const width of [390, 768, 1440]) {
    const tab = await open(browser, { width, text });
    const read = await tab.evaluate(() => ({
      scroll: document.documentElement.scrollWidth > innerWidth + 0.5,
      out: [...document.querySelectorAll('.kn-section-body *')].filter((element) => { const box = element.getBoundingClientRect(); return box.width && (box.right > innerWidth + 0.5 || box.left < -0.5); }).map((element) => element.tagName),
    }));
    assert.deepEqual(read, { scroll: false, out: [] }, `${name} at ${text}px and ${width}`);
    await tab.close();
  }
});
