import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFooter, revealEligible } from '../src/components/footer.js';
const cell = (id, column, extra = {}) => ({ id, column, ...extra });
const band = (surface, cells, extra = {}) => ({ surface, cells, ...extra });

test('reveal requires a nonempty footer that fits, including at the boundary, and always falls back for print', () => {
  const base = { attachment: 'reveal', footerHeight: 600, viewportHeight: 600 };
  assert.equal(revealEligible(base), true);
  for (const change of [{ footerHeight: 601 }, { footerHeight: 0 }, { attachment: 'flow' }, { print: true }]) assert.equal(revealEligible({ ...base, ...change }), false);
});

test('empty bands disappear and same-Surface neighbours become one run', () => {
  const result = layoutFooter([band('page', [cell('a1', 'A'), cell('b1', 'B')]), band('brand', []), band('page', [cell('a3', 'A'), cell('b3', 'B')]), band('inverse', [cell('a4', 'A')])]);
  assert.deepEqual(result.bands.map(({ row, run, runStart, runEnd, ownB }) => [row, run, runStart, runEnd, ownB]), [[1, 0, true, false, false], [3, 0, false, true, false], [4, 1, true, true, true]]);
  assert.deepEqual(result.cells.map(({ id }) => id), ['a1', 'a3', 'b1', 'b3', 'a4']);
  assert.equal(result.topLine, true);
  assert.equal(layoutFooter([band('page', [cell('a', 'A')])], { pageShadow: true }).topLine, false);
  assert.equal(layoutFooter([]).topLine, false);
});

test('wide rows form independent stacking units in the actual document order', () => {
  const result = layoutFooter([band('brand', [cell('a1', 'A'), cell('b1', 'B')]), band('brand', [cell('wide', 'A', { columns: 2 })]), band('brand', [cell('a3', 'A'), cell('b3', 'B')]), band('brand', [cell('a4', 'A'), cell('b4', 'B')])]);
  assert.deepEqual(result.cells.map(({ id }) => id), ['a1', 'b1', 'wide', 'a3', 'a4', 'b3', 'b4']);
  assert.deepEqual(result.cells.filter((c) => c.stackFirst).map((c) => c.id), ['a1']);
  assert.deepEqual(result.cells.filter((c) => c.stackLast).map((c) => c.id), ['b4']);
});

test('hairlines stop at merged columns, never cross Surfaces or wide rows, and stop at content', () => {
  const rules = { rule: true, verticalRule: true };
  const result = layoutFooter([band('brand', [cell('a', 'A', { rows: 2 }), cell('b1', 'B')], rules), band('brand', [cell('b2', 'B')], rules), band('brand', [cell('wide', 'A', { columns: 2 })], rules), band('inverse', [cell('a4', 'A'), cell('b4', 'B')], rules)]);
  assert.deepEqual(result.bands.map((b) => b.horizontal), [null, 'b', 'both', null]);
  assert.deepEqual(result.bands.map((b) => b.vertical), [true, true, false, true]);
  assert.equal(result.bands[1].stopBottom, true);
  assert.equal(result.cells.find((c) => c.id === 'a').edgeTop, true);
  assert.equal(result.cells.find((c) => c.id === 'a').edgeBottom, false);
  const b = layoutFooter([band('page', [cell('b', 'B', { rows: 2 }), cell('a1', 'A')]), band('page', [cell('a2', 'A')], rules)]);
  assert.equal(b.bands[1].horizontal, 'a');
  assert.equal(b.cells.find((c) => c.id === 'b').edgeBottom, true);
});

test('footer layout rejects overlaps, colour-crossing spans, excessive bands and invalid spans', () => {
  for (const data of [Array.from({ length: 5 }, () => band('page', [])), [band('page', [cell('a', 'A', { rows: 2 })])], [band('page', [cell('a', 'A'), cell('again', 'A')])], [band('page', [cell('a', 'A', { rows: 2 })]), band('brand', [cell('b', 'B')])], [band('page', [cell('b', 'B', { columns: 2 })])]]) assert.throws(() => layoutFooter(data), RangeError);
});

test('a hairline over column B alone starts at the content, not at the column', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/components/footer-band.css', import.meta.url), 'utf8');
  assert.match(css, /\.kn-footer-rule\[data-kn-only="b"\] \{ grid-column: bc-start \/ b-end; \}/);
});

