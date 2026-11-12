// Visitor Filters with no script (docs/spec/directives.md, `filtered`, and components.md, Visitor Filters): the keys that
// pair a control with an item, the stylesheet's rule a group and alternative a value, and, with JavaScript off in every
// engine Playwright has here, pills and a select that filter at once, by keyboard too, and a form that submits as GET.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { FILTER_GROUPS, FILTER_VALUES, filterGroups, filterKeys, itemMatches } from '../src/components/visitor-filters.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { render } from './helpers/render.js';

const topics = { name: 'topic', label: 'Topic', options: [{ value: 'walks', label: 'Walks' }, { value: 'notes', label: 'Notes' }, { value: 'tools', label: 'Tools' }] };
const year = { name: 'year', label: 'Year', options: [{ value: '', label: 'All years' }, { value: '2026', label: '2026' }, { value: '2025', label: '2025' }] };
const filters = { toggles: [topics], select: year };

test('each control\'s key is its group\'s place and its value\'s, and an item carries the keys of its values', () => {
  const keys = filterKeys(filterGroups(filters));
  assert.deepEqual([...keys.get('topic')], [['walks', '1-1'], ['notes', '1-2'], ['tools', '1-3']]);
  assert.deepEqual([...keys.get('year')], [['2026', '2-1'], ['2025', '2-2']], 'the select comes after the pills, and "All" has no key');
  assert.equal(itemMatches(keys, { topic: ['tools', 'walks'], year: '2025' }), '1-1 1-3 2-2');
  assert.equal(itemMatches(keys, { topic: 'unknown', colour: ['red'] }), '');
  assert.equal(itemMatches(keys), '');
  const many = (count) => ({ name: 'many', options: Array.from({ length: count }, (_, i) => ({ value: `v${i}` })) });
  assert.doesNotThrow(() => filterKeys([many(FILTER_VALUES)]));
  assert.throws(() => filterKeys([many(FILTER_VALUES + 1)]), RangeError);
  assert.throws(() => filterKeys(Array.from({ length: FILTER_GROUPS + 1 }, (_, i) => ({ name: `g${i}`, options: [] }))), RangeError);
});

test('the stylesheet holds one rule a group and one alternative a value, up to the limits, and no script is left', async () => {
  const css = await readFile(new URL('../src/components/visitor-filters.css', import.meta.url), 'utf8');
  for (let g = 1; g <= FILTER_GROUPS; g++) {
    assert.ok(css.includes(`:has(> .kn-visitor-filters [data-kn-match^="${g}-"]:checked) [data-kn-item]:not(`), `group ${g}`);
    for (let v = 1; v <= FILTER_VALUES; v++) assert.ok(css.includes(`:has(> .kn-visitor-filters [data-kn-match="${g}-${v}"]:checked) [data-kn-matches~="${g}-${v}"]`), `${g}-${v}`);
  }
  assert.ok(!css.includes(`"${FILTER_GROUPS + 1}-`) && !css.includes(`-${FILTER_VALUES + 1}"`), 'nothing past the limits');
  assert.doesNotMatch(css, /data-kn-enhanced/);
  const source = await readFile(new URL('../src/components/VisitorFilters.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<script/);
  assert.doesNotMatch(await readFile(new URL('../src/components/visitor-filters.js', import.meta.url), 'utf8'), /document|window|addEventListener/);
});

test('the markup: checkbox pills in a legend\'s group, keyed options, keyed items and a plain count', async () => {
  const tree = parse(await render('VisitorFilters', { for: 'notes', search: { label: 'Find notes' }, toggles: [{ ...topics, values: ['notes'] }], select: { ...year, value: '2026' }, total: 3, countText: '{count} notes' }));
  const form = one(tree, 'form');
  assert.equal(form.attributes.method, 'get');
  for (const gone of ['data-kn-for', 'data-kn-page-size', 'data-kn-count-text']) assert.equal(form.attributes[gone], undefined, gone);
  const pills = all(form, '.kn-pill input[type="checkbox"]');
  assert.equal(all(one(form, 'fieldset.kn-visitor-filter-group'), 'label.kn-pill').length, 3, 'the pills stand in the legend\'s group');
  assert.deepEqual(pills.map((input) => [input.attributes.name, input.attributes.value, input.attributes['data-kn-match'], input.attributes['aria-controls']]), [['topic', 'walks', '1-1', 'notes'], ['topic', 'notes', '1-2', 'notes'], ['topic', 'tools', '1-3', 'notes']]);
  assert.ok('checked' in pills[1].attributes && !('checked' in pills[0].attributes));
  assert.deepEqual(all(form, 'option').map((option) => option.attributes['data-kn-match'] ?? null), [null, '2-1', '2-2']);
  assert.ok('selected' in one(form, 'option[value="2026"]').attributes);
  const count = one(form, '.kn-visitor-filter-count');
  assert.equal(count.attributes.role, undefined, 'no live region: nothing changes it live');
  assert.equal(count.attributes['aria-live'], undefined);
  for (const gone of ['button.kn-pill', '[aria-pressed]', '[data-kn-pagination-host]', '[data-kn-result-count]', '[data-kn-filter-name]']) assert.equal(all(form, gone).length, 0, gone);
  // What the list or the page settles goes with a search as hidden fields, first in the form.
  const settled = parse(await render('VisitorFilters', { search: { label: 'Find notes' }, toggles: [topics], hidden: { type: 'note', category: 'walks' } }));
  assert.deepEqual(one(settled, 'form').children.filter((node) => node.name === 'input').map((input) => [input.attributes.type, input.attributes.name, input.attributes.value]), [['hidden', 'type', 'note'], ['hidden', 'category', 'walks']]);
  // A server pages the list: the controls carry no key and apply only when the form is sent.
  const paged = parse(await render('VisitorFilters', { for: 'notes', toggles: [topics], instant: false }));
  assert.equal(all(paged, '[data-kn-match]').length + all(paged, '[aria-controls]').length, 0);
  await assert.rejects(render('VisitorFilters', { toggles: [{ name: 'many', label: 'Many', options: Array.from({ length: FILTER_VALUES + 1 }, (_, i) => ({ value: `v${i}`, label: `V${i}` })) }] }), RangeError);
  const loop = parse(await render('ContentLoop', { presentation: 'rows', filteredBy: filters, items: [{ title: 'A', href: '/a/', filters: { topic: ['walks', 'tools'], year: ['2025'] } }, { title: 'B', href: '/b/' }] }));
  assert.deepEqual(all(loop, '[data-kn-item]').map((item) => item.attributes['data-kn-matches']), ['1-1 1-3 2-2', '']);
  for (const gone of ['data-kn-filter', 'data-kn-text', 'data-kn-group']) assert.equal(all(loop, `[${gone}]`).length, 0, gone);
});

const BROWSERS = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let styles, markup;
const titles = ['A walk by the river', 'Notes from the bench', 'Tools for the garden', 'A walk with notes', 'The 2025 notebook'];
const values = [{ topic: ['walks'], year: '2026' }, { topic: ['notes'], year: '2026' }, { topic: ['tools'], year: '2026' }, { topic: ['walks', 'notes'], year: '2026' }, { topic: ['notes'], year: '2025' }];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  const items = titles.map((title, i) => ({ title, href: `/notes/${i}/`, filters: values[i] }));
  const rows = `<div id="rows-scope">${await render('VisitorFilters', { for: 'rows', action: 'https://fixture.test/search/', search: { label: 'Search notes' }, ...filters, total: 5, countText: '{count} notes' })}${await render('ContentLoop', { id: 'rows', presentation: 'rows', images: false, items, filteredBy: filters })}</div>`;
  const cards = `<div id="cards-scope">${await render('VisitorFilters', { for: 'cards', toggles: [topics], total: 5, countText: '{count} notes' })}${await render('ContentLoop', { id: 'cards', items, filteredBy: { toggles: [topics] } })}</div>`;
  markup = `${rows}${cards}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function open(browser, { width = 1440, text = 16 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
  const tab = await context.newPage();
  await tab.route('https://fixture.test/**', (route) => route.fulfill({ body: '<!doctype html><title>Fixture</title>', contentType: 'text/html' }));
  await tab.goto('https://fixture.test/');
  await tab.setContent(`<!doctype html><html lang="en" style="font-size: ${text}px"><head><style>${styles}</style></head><body data-kn-surface="page"><main class="kn-page" style="padding: 1rem">${markup}</main></body></html>`);
  return { tab, close: () => context.close() };
}
const shown = (tab, scope) => tab.$$eval(`#${scope} [data-kn-item]`, (items) => items.filter((item) => item.getClientRects().length > 0).map((item) => item.textContent.trim().split('\n')[0].trim()));
const visible = (tab, selector) => tab.$eval(selector, (element) => element.getClientRects().length > 0);
const pill = (scope, value) => `#${scope} input[name="topic"][value="${value}"]`;

test('with no script the pills widen the result, the select narrows it, and the count steps aside while untrue', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    assert.equal(await tab.evaluate(() => [...document.scripts].filter((script) => /visitor-filters|VisitorFilters/i.test(script.src + script.textContent)).length), 0, name);
    assert.equal((await shown(tab, 'rows-scope')).length, 5, name);
    assert.ok(await visible(tab, '#rows-scope .kn-visitor-filter-count'), `${name}: the server's count while it is true`);
    await tab.check(pill('rows-scope', 'walks'));
    assert.deepEqual(await shown(tab, 'rows-scope'), [titles[0], titles[3]], `${name}: walks`);
    assert.equal(await visible(tab, '#rows-scope .kn-visitor-filter-count'), false, `${name}: the count is no longer true`);
    await tab.check(pill('rows-scope', 'notes'));
    assert.deepEqual(await shown(tab, 'rows-scope'), [titles[0], titles[1], titles[3], titles[4]], `${name}: walks or notes`);
    await tab.selectOption('#rows-scope select', '2025');
    assert.deepEqual(await shown(tab, 'rows-scope'), [titles[4]], `${name}: and 2025`);
    await tab.selectOption('#rows-scope select', '');
    await tab.uncheck(pill('rows-scope', 'walks'));
    await tab.uncheck(pill('rows-scope', 'notes'));
    assert.equal((await shown(tab, 'rows-scope')).length, 5, `${name}: all again`);
    assert.ok(await visible(tab, '#rows-scope .kn-visitor-filter-count'), `${name}: and the count with them`);
    // Each form filters only the items beside it.
    await tab.check(pill('cards-scope', 'tools'));
    assert.deepEqual(await shown(tab, 'cards-scope'), [titles[2]], name);
    assert.equal((await shown(tab, 'rows-scope')).length, 5, `${name}: the other list is untouched`);
    // A checked pill is filled from the design's roles, an unchecked one is not.
    const look = await tab.$$eval('#cards-scope .kn-pill', (labels) => labels.map((label) => getComputedStyle(label).backgroundColor));
    assert.equal(new Set(look).size, 2, name);
    assert.notEqual(look[2], 'rgba(0, 0, 0, 0)', name);
    // A form of pills alone needs no button; a search field keeps its own.
    assert.equal(await visible(tab, '#cards-scope .kn-visitor-filter-submit'), false, name);
    assert.ok(await visible(tab, '#rows-scope .kn-visitor-filter-submit'), name);
    await close();
  }
});

test('the keyboard reaches each pill as a native checkbox, with the design\'s focus ring on the pill', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    await tab.focus(pill('cards-scope', 'notes'));
    await tab.keyboard.press('Shift+Tab');
    // WebKit, as Safari, leaves checkboxes out of Tab unless the system's full keyboard access is on.
    if (name !== 'webkit') assert.equal(await tab.evaluate(() => document.activeElement.value), 'walks', `${name}: Tab moves from pill to pill`);
    await tab.focus(pill('cards-scope', 'walks'));
    await tab.keyboard.press('Space');
    assert.equal(await tab.$eval(pill('cards-scope', 'walks'), (input) => input.checked), true, name);
    assert.deepEqual(await shown(tab, 'cards-scope'), [titles[0], titles[3]], name);
    const ring = await tab.$eval('#cards-scope .kn-pill', (label) => getComputedStyle(label).outlineStyle);
    assert.equal(ring, 'solid', `${name}: the focus ring is on the pill`);
    assert.equal(await tab.$eval(pill('cards-scope', 'walks'), (input) => [input.labels[0].textContent.trim(), input.closest('fieldset').querySelector('legend').textContent].join(' / ')), 'Walks / Topic', `${name}: named by its pill, grouped by its legend`);
    await tab.keyboard.press('Space');
    assert.equal((await shown(tab, 'cards-scope')).length, 5, name);
    await close();
  }
});

test('the form submits as an ordinary GET form to the site\'s own page, with the search and every checked value', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const { tab, close } = await open(browser);
    await tab.check(pill('rows-scope', 'notes'));
    await tab.check(pill('rows-scope', 'tools'));
    await tab.fill('#rows-scope input[type="search"]', 'bench');
    const [request] = await Promise.all([tab.waitForRequest((r) => r.url().startsWith('https://fixture.test/search/')), tab.press('#rows-scope input[type="search"]', 'Enter')]);
    const query = new URL(request.url()).searchParams;
    assert.equal(request.method(), 'GET', name);
    assert.deepEqual(query.getAll('topic'), ['notes', 'tools'], name);
    assert.equal(query.get('q'), 'bench', name);
    await close();
  }
});

test('nothing scrolls sideways or clips, on a phone and a wide window, at the default and a large text size', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const width of [390, 1440]) for (const text of [16, 24]) {
    const { tab, close } = await open(browser, { width, text });
    const read = await tab.evaluate(() => ({
      sideways: document.scrollingElement.scrollWidth > innerWidth,
      clipped: [...document.querySelectorAll('.kn-pill, .kn-visitor-filter-panel, select')].filter((element) => element.scrollWidth > element.clientWidth + 1).length,
    }));
    assert.deepEqual(read, { sideways: false, clipped: 0 }, `${name} at ${width} and ${text}px text`);
    await close();
  }
});
