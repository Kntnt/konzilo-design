import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { derive, validateInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';

const read = (path, encoding = 'utf8') => readFile(new URL(`../${path}`, import.meta.url), encoding);
const generic = /(?:sans-serif|serif|monospace)$/;
const inputs = (changes = {}) => ({ 'brand-colors': { primary: '#168b83' }, ...changes });

test('with nothing chosen, both families are system stacks and labels use the main one', () => {
  const { typefaces, type } = derive(inputs());
  assert.equal(typefaces.main, 'system-ui, sans-serif');
  assert.match(typefaces.monospace, /^ui-monospace,.*monospace$/);
  assert.equal(typefaces.label, typefaces.main);
  assert.equal(type.label.weight, 600);
  assert.equal(type.label['letter-spacing'], 0.06);
});

test('labels can always move to the monospace family, with their own recipe', () => {
  const { typefaces, type } = derive(inputs({ type: { label: 'monospace' } }));
  assert.equal(typefaces.label, typefaces.monospace);
  assert.equal(type.label.weight, 500);
  assert.equal(type.label['letter-spacing'], 0.04);
  assert.match(coreCss(derive(inputs({ type: { label: 'monospace' } }))), /--kn-typeface-label: var\(--kn-typeface-monospace\);/);
});

test('a named family that never loads falls back to the matching system stack', () => {
  const { typefaces } = derive(inputs({ typefaces: { main: 'Mona Sans', monospace: 'Red Hat Mono' } }));
  assert.equal(typefaces.main, 'Mona Sans, system-ui, sans-serif');
  assert.match(typefaces.monospace, /^Red Hat Mono, ui-monospace,.*monospace$/);
  for (const value of Object.values(typefaces)) assert.match(value, generic);
});

test('a stack that already ends in a generic family is kept, so a serif stays a serif', () => {
  const main = '"Source Serif 4", Georgia, serif';
  assert.equal(derive(inputs({ typefaces: { main } })).typefaces.main, main);
});

test('typeface roles accept first heading and refuse unknown roles', () => {
  validateInputs(inputs({ typefaces: { main: 'Georgia, serif', heading: 'Mona Sans', display: 'Playfair', monospace: 'Red Hat Mono' }, type: { label: 'monospace' } }));
  validateInputs(inputs({ typefaces: { 'heading-1': 'Mona Sans' } }));
  for (const name of ['body', 'eyebrow']) {
    assert.throws(() => validateInputs(inputs({ typefaces: { [name]: 'Mona Sans' } })), new RegExp(name));
  }
  assert.throws(() => validateInputs(inputs({ type: { label: 'serif' } })), /label/);
});

test('with one typeface every role follows it, so one line on a site moves them all', () => {
  const css = coreCss(derive(inputs({ typefaces: { main: 'Mona Sans' } })));
  assert.match(css, /--kn-typeface-main: Mona Sans, system-ui, sans-serif;/);
  assert.match(css, /--kn-typeface-heading: var\(--kn-typeface-main\);/);
  assert.match(css, /--kn-typeface-heading-1: var\(--kn-typeface-heading\);/);
  assert.match(css, /--kn-typeface-display: var\(--kn-typeface-heading\);/);
  assert.match(css, /--kn-typeface-label: var\(--kn-typeface-main\);/);
});

test('serif text can have sans-serif headings, and display text follows the headings', () => {
  const { typefaces } = derive(inputs({ typefaces: { main: 'Georgia, serif', heading: 'Mona Sans' } }));
  assert.equal(typefaces.heading, 'Mona Sans, system-ui, sans-serif');
  assert.equal(typefaces.display, typefaces.heading);
  assert.equal(typefaces.label, 'Georgia, serif');
});

test('a display face changes only the display style', () => {
  const { typefaces } = derive(inputs({ typefaces: { main: 'Mona Sans', display: 'Georgia, serif' } }));
  assert.equal(typefaces.display, 'Georgia, serif');
  assert.equal(typefaces.heading, typefaces.main);
});

test('each heading style reads its role, and the first heading can differ with CSS alone', async () => {
  const base = await read('src/components/base.css');
  const ruleOf = (style) => base.match(new RegExp(`\\[data-kn-type="${style}"\\] \\{[^}]*\\}`))[0];
  assert.match(ruleOf('display'), /--kn-typeface-display/);
  assert.match(ruleOf('heading-1'), /--kn-typeface-heading-1/);
  assert.match(ruleOf('heading-1'), /color: var\(--kn-text-heading-1\)/);
  for (const n of [2, 3, 4, 5, 6]) assert.match(ruleOf(`heading-${n}`), /font-family: var\(--kn-typeface-heading\)/);
  const body = await read('src/components/body-text.css');
  assert.match(body, /h1:not\(\[data-kn-type\]\) \{\s*font-family: var\(--kn-typeface-heading-1\);\s*color: var\(--kn-text-heading-1\);/);
  assert.match(coreCss(derive(inputs())), /\[data-kn-surface\] \{ --kn-text-heading-1: var\(--kn-text\); \}/);
});

test('Mona Sans takes its stylistic sets from 20px, by style and fluid window', () => {
  const { type } = derive(inputs({ typefaces: { main: 'Mona Sans' } }));
  assert.equal(type.body.features, undefined, 'always below 20px');
  assert.equal(type.small.features, undefined);
  assert.equal(type.label.features, undefined);
  assert.deepEqual(type['heading-1'].features, { value: '"ss05", "ss07"', 'from-window': 0 }, 'always from 20px');
  const crossing = Object.values(type).filter(({ features }) => features?.['from-window'] > 0);
  assert.ok(crossing.length > 0);
  for (const { size, features } of crossing) {
    const at = (window) => size.min + (size.max - size.min) * (window - 320) / (1440 - 320);
    assert.ok(at(features['from-window']) >= 20);
    assert.ok(at(features['from-window'] - 1) < 20);
  }
  const css = coreCss(derive(inputs({ typefaces: { main: 'Mona Sans' } })));
  assert.match(css, /--kn-type-heading-1-features: "ss05", "ss07";/);
  assert.match(css, /--kn-type-body-features: normal;/);
  const [style, recipe] = Object.entries(type).find(([, { features }]) => features?.['from-window'] > 0);
  assert.match(css, new RegExp(`@media \\(min-width: ${recipe.features['from-window'] / 16}rem\\) \\{\\s*:root \\{ --kn-type-${style}-features: "ss05", "ss07"; \\}`));
});

test('the sets follow the typeface: other families get none, also when spelled with quotes', () => {
  const none = derive(inputs()).type;
  assert.ok(Object.values(none).every(({ features }) => !features));
  assert.ok(derive(inputs({ typefaces: { main: '"Mona Sans", system-ui, sans-serif' } })).type['heading-1'].features);
  const serifHeadings = derive(inputs({ typefaces: { main: 'Mona Sans', heading: 'Georgia, serif' } })).type;
  assert.equal(serifHeadings['heading-1'].features, undefined);
  const monaHeadings = derive(inputs({ typefaces: { main: 'Georgia, serif', heading: 'Mona Sans' } })).type;
  assert.ok(monaHeadings['heading-1'].features);
  assert.equal(monaHeadings.lead.features, undefined);
});

test('labels sit on the type scale, five steps below body text unless changed, and never below 12px', () => {
  assert.equal(derive(inputs()).type.label.size.max, 12);
  const higher = derive(inputs({ type: { steps: { label: 3 } } })).type.label.size;
  assert.deepEqual([higher.min, higher.max], [14, 13]);
  const tiny = derive(inputs({ type: { 'body-size': { min: 13, max: 13 } } })).type;
  assert.equal(tiny.label.size.min, 12);
});

test('every text size reads a type role, or follows its own text in em', async () => {
  const directory = new URL('../src/components/', import.meta.url);
  // These two set the size of an icon, not of text.
  const icons = new Set(['.kn-embed-play', '.kn-header .kn-header-icon-button']);
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.css'))) {
    const source = await readFile(new URL(name, directory), 'utf8');
    for (const [, selector, value] of source.matchAll(/([^{}\n]*)\{[^{}]*?font-size:\s*([^;}]+)/g)) {
      if (icons.has(selector.trim())) continue;
      assert.match(value.trim(), /--kn-type-[a-z0-9-]+-size|^inherit$|^[\d.]+em$/, `${name}: ${selector.trim()}`);
    }
  }
});

test('eyebrows, metadata and category pills use the label style, and no component reads an old typeface', async () => {
  for (const path of ['HeadingGroup', 'Card', 'ContentMetadata']) {
    assert.match(await read(`src/components/${path}.astro`), /data-kn-type="label"/, path);
  }
  const loop = await read('src/components/content-loop.css');
  assert.match(loop.match(/\.kn-pill \{[^}]*\}/)[0], /font-family: var\(--kn-typeface-label\)/);
  const base = await read('src/components/base.css');
  const rule = base.match(/\[data-kn-type="label"\] \{[^}]*\}/)[0];
  assert.match(rule, /text-transform: uppercase/);
  assert.doesNotMatch(base + loop, /--kn-typeface-(?:body|eyebrow)/);
});

test('a table head has the typeface of the rest of the table, not the label style', async () => {
  const table = await read('src/components/table.css');
  assert.match(table, /font-family: var\(--kn-typeface-main\)/);
  assert.doesNotMatch(table, /--kn-typeface-label|--kn-type-label|text-transform/);
});

test('the recommended typefaces ship as unmodified web fonts with their licences', async () => {
  const css = await read('src/fonts/fonts.css');
  const files = [...css.matchAll(/url\("\.\/([^"]+)"\)/g)].map(([, file]) => file);
  assert.deepEqual(files, ['MonaSans-VF.woff2', 'MonaSans-Italic-VF.woff2', 'RedHatMono-VF.woff2']);
  for (const file of files) {
    assert.equal((await read(`src/fonts/${file}`, null)).subarray(0, 4).toString('latin1'), 'wOF2', file);
  }
  assert.match(await read('src/fonts/LICENSE-mona-sans.txt'), /Reserved Font Name "Mona"/);
  assert.match(await read('src/fonts/LICENSE-red-hat-mono.txt'), /Open Font License/);
});
