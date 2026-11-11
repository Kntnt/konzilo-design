import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { footerFromDesign, footerSpans, layoutFooter } from '../src/components/footer.js';
import { footerHtml } from '../src/components/footer-html.js';
import { render } from './helpers/render.js';

const cells = (names) => Object.fromEntries(names.split(' ').filter(Boolean).map((name) => [name, true]));
const spans = (names, fill) => footerSpans(cells(names), fill).map(({ cell, wide, tall }) => `${cell}${wide ? ' wide' : ''}${tall ? ' tall' : ''}`).join(', ');

// Every combination of four cells: what each filled cell covers beyond itself, under `fill: column` and
// `fill: row`. `wide` is its whole row, `tall` its whole column, and both together all four cells.
const TABLE = [
  ['', '', ''],
  // One: it spans all four.
  ['a1', 'a1 wide tall', 'a1 wide tall'],
  ['a2', 'a2 wide tall', 'a2 wide tall'],
  ['b1', 'b1 wide tall', 'b1 wide tall'],
  ['b2', 'b2 wide tall', 'b2 wide tall'],
  // Two in one column: the other column is gone, and each spans its row.
  ['a1 a2', 'a1 wide, a2 wide', 'a1 wide, a2 wide'],
  ['b1 b2', 'b1 wide, b2 wide', 'b1 wide, b2 wide'],
  // Two in one row: the other row has no height, and they keep their own columns.
  ['a1 b1', 'a1 tall, b1 tall', 'a1 tall, b1 tall'],
  ['a2 b2', 'a2 tall, b2 tall', 'a2 tall, b2 tall'],
  // Two diagonally: `fill` decides.
  ['a1 b2', 'a1 tall, b2 tall', 'a1 wide, b2 wide'],
  ['a2 b1', 'a2 tall, b1 tall', 'a2 wide, b1 wide'],
  // Three: the cell below or above the empty one fills its column, or the cell beside it fills its row.
  ['a2 b1 b2', 'a2 tall, b1, b2', 'a2, b1 wide, b2'],
  ['a1 b1 b2', 'a1 tall, b1, b2', 'a1, b1, b2 wide'],
  ['a1 a2 b2', 'a1, a2, b2 tall', 'a1 wide, a2, b2'],
  ['a1 a2 b1', 'a1, a2, b1 tall', 'a1, a2 wide, b1'],
  // Four: nothing to fill.
  ['a1 a2 b1 b2', 'a1, a2, b1, b2', 'a1, a2, b1, b2'],
];

test('the table holds every combination of cells', () => {
  assert.equal(TABLE.length, 16);
  assert.equal(new Set(TABLE.map(([names]) => names)).size, 16);
});
for (const [names, column, row] of TABLE) {
  test(`cells [${names}] fill as decided`, () => {
    assert.equal(spans(names, 'column'), column);
    assert.equal(spans(names, 'row'), row);
  });
}
test('a cell left out, set to false or set to true is read as empty or filled, and fill defaults to column', () => {
  assert.equal(footerSpans({ a1: true, a2: false, b1: { text: 'x' }, b2: undefined }).map(({ cell }) => cell).join(), 'a1,b1');
  assert.deepEqual(footerSpans(cells('a1 b2')), footerSpans(cells('a1 b2'), 'column'));
});

const place = (names, fill = 'column') => layoutFooter({ upper: { cells: cells(names) }, fill }).bands[0];
const placement = (band) => band.cells.map((cell) => `${cell.name}:${cell.column}${cell.columns}:${cell.row}`).join(' ');

test('an empty band is not rendered, and no filled cell at all means no footer', () => {
  assert.deepEqual(layoutFooter({ upper: { cells: {} }, lower: { cells: {} } }).bands, []);
  assert.deepEqual(layoutFooter().bands, []);
  assert.equal(footerHtml(layoutFooter()), '');
  assert.deepEqual(layoutFooter({ upper: { cells: {} }, lower: { cells: cells('a1') } }).bands.map((band) => band.name), ['lower']);
});

test('the cells keep their own column and come in stacking order, A before B, whatever they cover', () => {
  assert.equal(placement(place('a1 b1 a2 b2')), 'a1:A1:1 a2:A1:2 b1:B1:1 b2:B1:2');
  assert.equal(place('a1 b1 a2 b2').rows, 2);
  assert.equal(placement(place('b2')), 'b2:B2:all');
  assert.equal(placement(place('a2 b2')), 'a2:A1:all b2:B1:all', 'row 1 has no height, so there is one row');
  assert.equal(place('a2 b2').rows, 1);
  assert.equal(placement(place('b1 b2')), 'b1:B2:1 b2:B2:2');
  assert.equal(placement(place('a1 b2')), 'a1:A1:all b2:B1:all');
  assert.equal(place('a1 b2').rows, 1);
  assert.equal(placement(place('a1 b2', 'row')), 'a1:A2:1 b2:B2:2');
  assert.equal(placement(place('a2 b1 b2')), 'a2:A1:all b1:B1:1 b2:B1:2');
  assert.equal(place('a2 b1 b2').rows, 2);
  assert.equal(placement(place('a2 b1 b2', 'row')), 'a2:A1:2 b1:B2:1 b2:B1:2');
});

test('the bands default to the dark brand colour and nearly black, and a cell carries its content', () => {
  const { bands } = layoutFooter({ upper: { cells: { a1: { text: 'Words' } } }, lower: { cells: { b2: { links: [{ label: 'L', href: '#l' }] } } } });
  assert.deepEqual(bands.map((band) => band.surface), ['brand', 'inverse']);
  assert.equal(bands[0].cells[0].text, 'Words');
  assert.equal(bands[1].cells[0].links[0].label, 'L');
});

test('a hairline stops at a merged cell and never runs between two colours', () => {
  const lines = (names, more = {}) => {
    const band = layoutFooter({ upper: { cells: cells(names) }, horizontalRules: true, verticalRule: true, ...more }).bands[0];
    return [band.horizontal, band.vertical];
  };
  assert.deepEqual(lines('a1 a2 b1 b2'), ['both', 'all']);
  assert.deepEqual(lines('a2 b1 b2'), ['b', 'all'], 'a tall cell in A leaves the line to B');
  assert.deepEqual(lines('a1 a2 b2'), ['a', 'all'], 'a tall cell in B leaves the line to A');
  assert.deepEqual(lines('a2 b1 b2', { fill: 'row' }), ['both', '2'], 'a cell across row 1 leaves the line between columns to row 2');
  assert.deepEqual(lines('a1 a2 b1', { fill: 'row' }), ['both', '1']);
  assert.deepEqual(lines('a1 a2'), ['both', null], 'no line can run through a cell in each row');
  assert.deepEqual(lines('a1 b1'), [null, 'all'], 'one row has nothing to part');
  assert.deepEqual(lines('a1'), [null, null]);
  const twoColours = layoutFooter({ upper: { cells: cells('a1') }, lower: { cells: cells('a1') }, horizontalRules: true });
  assert.equal(twoColours.bands[1].join, undefined);
  assert.equal(twoColours.bands[0].joined, undefined);
  const oneColour = layoutFooter({ upper: { surface: 'brand', cells: cells('a1') }, lower: { surface: 'brand', cells: cells('a1') }, horizontalRules: true });
  assert.equal(oneColour.bands[1].join, true);
  assert.ok(oneColour.bands.every((band) => band.joined));
  assert.equal(layoutFooter({ upper: { surface: 'brand', cells: cells('a1') }, lower: { surface: 'brand', cells: cells('a1') } }).bands[1].join, false);
  const off = layoutFooter({ upper: { cells: cells('a1 a2 b1 b2') } }).bands[0];
  assert.deepEqual([off.horizontal, off.vertical], [null, null]);
});

test('a design\'s settings and a site\'s content make a Footer, and a cell that is off stays empty', () => {
  const settings = {
    attachment: 'reveal', fill: 'row', 'horizontal-rules': true, 'vertical-rule': false, 'rule-extent': 'full',
    upper: { surface: 'tint', cells: { a1: true, b1: false, a2: false, b2: false } },
    lower: { surface: 'page', cells: { a1: true, b1: true, a2: false, b2: false } },
  };
  const props = footerFromDesign(settings, { upper: { a1: { text: 'A' }, b1: { text: 'not shown' } } });
  assert.deepEqual(props.upper, { surface: 'tint', cells: { a1: { text: 'A' }, a2: false, b1: false, b2: false } });
  assert.deepEqual(props.lower.cells, { a1: true, a2: false, b1: true, b2: false }, 'without content, the cell waits for its slot');
  assert.deepEqual([props.fill, props.attachment, props.rules, props.horizontalRules, props.verticalRule], ['row', 'reveal', 'full', true, false]);
});

test('the preview\'s markup writes a cell, its box and its lines', () => {
  const props = { upper: { cells: { a1: { heading: 'H', level: 3, text: 'A & B', links: [{ label: 'L', href: '#l', consentOpen: true }], content: '<b>C</b>' }, b2: true } }, horizontalRules: true, verticalRule: true, fill: 'row', attachment: 'reveal', rules: 'full' };
  const html = footerHtml(layoutFooter(props), props);
  assert.match(html, /^<footer class="kn-footer" data-kn-attachment="reveal" data-kn-rules="full">/);
  assert.match(html, /<div class="kn-footer-band" data-kn-band="upper" data-kn-surface="brand" data-kn-rows="2">/);
  assert.match(html, /<div class="kn-footer-cell" data-kn-cell="a1" data-kn-column="A" data-kn-columns="2" data-kn-row="1"><div class="kn-footer-box"><h3 data-kn-type="heading-5">H<\/h3><p class="kn-footer-muted">A &amp; B<\/p>/);
  assert.match(html, /<a href="#l" data-kn-consent-open="true">L<\/a>/);
  assert.match(html, /<b>C<\/b><\/div><\/div>/);
  assert.match(html, /data-kn-cell="b2" data-kn-column="B" data-kn-columns="2" data-kn-row="2"/);
  assert.equal([...html.matchAll(/kn-footer-rule/g)].length, 1);
  assert.doesNotMatch(html, /kn-footer-vertical-rule/, 'a cell across each row leaves no room for the line');
});

test('only a footer at the edge of the screen loads the script that says whether it fits, and writes its bands once', async () => {
  const props = { upper: { cells: { a1: { text: 'A' }, b1: { text: 'B' } } } };
  const reveal = await render('Footer', { ...props, attachment: 'reveal' });
  assert.equal([...reveal.matchAll(/class="kn-footer-band"/g)].length, 1);
  assert.match(reveal, /<script type="module" src="\/_astro\/footer-fit\.js" data-kn-footer-fit><\/script>\s*<\/footer>/);
  assert.doesNotMatch(await render('Footer', { ...props, attachment: 'flow' }), /<script/);
  const source = await readFile(new URL('../src/components/footer-fit.js', import.meta.url), 'utf8');
  assert.ok(source.trim().split('\n').length <= 20, 'it is small');
  assert.match(source, /footer\.dataset\.knFit = value/);
  assert.doesNotMatch(source, /\.style\b|classList|innerHTML|scrollTo/, 'it sets the one state and nothing else');
});

const normal = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/>\s+</g, '><').trim();
test('the component and the preview write the same markup, in any combination of cells, colours and lines', async () => {
  const content = { heading: 'H', level: 3, text: 'A & B', links: [{ label: 'L', href: '#l', consentOpen: true, current: true }], content: '<b>C</b>' };
  for (const [upper, lower, more] of [
    ['a1 a2 b1 b2', 'a1 a2 b1 b2', {}],
    ['a1 b2', 'b1', { fill: 'row', horizontalRules: true, verticalRule: true }],
    ['a2 b1 b2', 'a1 a2', { horizontalRules: true, verticalRule: true, rules: 'full', attachment: 'reveal' }],
    ['a1', 'a1', { surfaces: ['brand', 'brand'], horizontalRules: true }],
    ['b2', '', { surfaces: ['page', 'page'] }],
    ['', '', {}],
  ]) {
    const band = (names, surface) => ({ surface, cells: Object.fromEntries(names.split(' ').filter(Boolean).map((name) => [name, content])) });
    const { surfaces = ['brand', 'inverse'], ...options } = more;
    const props = { upper: band(upper, surfaces[0]), lower: band(lower, surfaces[1]), ...options };
    assert.equal(normal(await render('Footer', props)), normal(footerHtml(layoutFooter(props), props)));
  }
});

test('a site fills a cell from its slot, and a cell set to false stays empty whatever it is given', async () => {
  const html = await render('Footer', { upper: { surface: 'tint', cells: { b1: false, a2: true } }, lower: { cells: { a1: { text: 'Address' } } } }, { 'upper-a1': '<p>Logo</p>', 'upper-b1': '<p>Not shown</p>', 'upper-a2': '<p>Statement</p>', 'lower-b2': '<p>Links</p>' });
  assert.match(html, /data-kn-cell="a1"[^>]*>\s*<div class="kn-footer-box">\s*<p>Logo<\/p>/);
  assert.match(html, /data-kn-cell="a2"[^>]*>\s*<div class="kn-footer-box">\s*<p>Statement<\/p>/);
  assert.doesNotMatch(html, /Not shown/);
  assert.match(html, /data-kn-band="lower"[\s\S]*Address[\s\S]*<p>Links<\/p>/);
  assert.equal(await render('Footer', { upper: { cells: {} } }).then((text) => text.includes('<footer')), false, 'without a filled cell there is no footer');
});

test('the layout is logical, so right-to-left mirrors it, and hairlines stop at the content', async () => {
  const css = await readFile(new URL('../src/components/footer.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(?:left|right)\b|margin-(?:top|bottom)|padding-(?:top|bottom)/);
  // A hairline over column B alone starts at the content, not at the column (decided 2026-11-02).
  assert.match(css, /\.kn-footer-rule\[data-kn-only="b"\] \{ grid-column: bc-start \/ b-end; \}/);
  assert.match(css, /\[data-kn-column="B"\]\) \{ grid-column: bc-start \/ b-end; justify-content: flex-end; \}/);
  assert.match(css, /\.kn-footer-box \{[^}]*text-align: start/);
});
