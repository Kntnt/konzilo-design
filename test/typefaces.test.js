import test from 'node:test';
import { TYPEFACES, CATEGORIES, shippedIn } from '../src/fonts/catalog.js';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { derive, fitRolesToFaces, validateInputs, sizeAt } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';

const read = (path, encoding = 'utf8') => readFile(new URL(`../${path}`, import.meta.url), encoding);
const generic = /(?:sans-serif|serif|monospace)$/;
const inputs = (changes = {}) => ({ 'brand-colors': { primary: '#168b83' }, ...changes });

test('the catalogue follows the owner\'s list: order, sources, and a display face only for the first heading and larger', () => {
  assert.deepEqual(CATEGORIES.map(([category]) => category), ['sans-serif', 'slab-serif', 'serif', 'display', 'monospace', 'partner']);
  const inCategory = (category) => TYPEFACES.filter((face) => face.category === category).map((face) => face.family);
  assert.deepEqual(inCategory('slab-serif'), ['Bitter', 'Aleo', 'Rokkitt', 'Josefin Slab', 'Roboto Slab']);
  assert.deepEqual(inCategory('display'), ['Cormorant', 'Playfair', 'Bodoni Moda', 'Red Hat Display']);
  assert.deepEqual(inCategory('partner'), ['Red Hat Text', 'Cormorant Garamond']);
  const named = (family) => TYPEFACES.find((face) => face.family === family);
  for (const family of inCategory('display')) assert.deepEqual(named(family).roles, ['heading-1', 'display'], family);
  for (const family of inCategory('partner')) assert.deepEqual(named(family).roles, ['main'], family);
  for (const family of ['Hubot Sans', 'Josefin Sans', 'Josefin Slab']) assert.ok(!named(family).roles.includes('main'), family);
  for (const family of inCategory('monospace')) assert.deepEqual(named(family).roles, ['monospace', 'label'], family);
  assert.match(named('Mona Sans').source, /github\.com\/github\/mona-sans/);
  assert.match(named('Aleo').source, /fonts\.google\.com/, 'its origin has lost glyphs');
  assert.match(named('Red Hat Display').source, /fonts\.google\.com/, 'its origin moved the weights');
  assert.match(named('EB Garamond').source, /e608414f/, 'the build before the current one');
  assert.ok(named('Merriweather').subset === undefined, 'its licence reserves the name');
  for (const { family, source, version, axes } of TYPEFACES) {
    assert.match(source, /^https:\/\/(fonts\.google\.com|github\.com)\//, family);
    assert.doesNotMatch(source, /fontsource/i, family);
    assert.ok(version, family);
    assert.ok(Object.keys(axes).length, `${family} is variable`);
  }
});

test('a role sets its own axes, and nothing else changes', () => {
  const mona = { main: 'Mona Sans' };
  const plain = derive(inputs({ typefaces: mona })).type;
  const set = derive(inputs({ typefaces: mona, type: { roles: {
    display: { weight: 260, 'letter-spacing': -0.03, axes: { wdth: 112, opsz: 100 } },
    label: { weight: 800, 'letter-spacing': 0.06, axes: { wdth: 75, opsz: 0 }, features: ['ss02', 'ss07'] },
  } } }));
  assert.deepEqual([set.type.display.weight, set.type.display['letter-spacing'], set.type.display.stretch, set.type.display.variation], [260, -0.03, 112, { opsz: 100 }]);
  assert.deepEqual(set.type.display.features, plain.display.features, 'the tuning stays');
  assert.deepEqual(set.type.display.size, plain.display.size, 'the type scale stays');
  assert.deepEqual(set.type.label.features, { value: '"ss02", "ss07"', 'from-window': 0 });
  for (const style of ['body', 'lead', 'small', 'mono', 'heading-1', 'heading-3']) assert.deepEqual(set.type[style], plain[style], style);
  const css = coreCss(set);
  assert.match(css, /--kn-type-display-stretch: 112%;/);
  assert.match(css, /--kn-type-display-variation: "opsz" 100;/);
  assert.match(css, /--kn-type-label-features: "ss02", "ss07";/);
  assert.doesNotMatch(coreCss(derive(inputs({ typefaces: mona }))), /-stretch:|-variation:/);

  const body = derive(inputs({ typefaces: mona, type: { roles: { main: { weight: 350 }, heading: { axes: { GRAD: 50 } } } } })).type;
  assert.deepEqual([body.body.weight, body.lead.weight, body.small.weight], [350, 350, 350]);
  assert.deepEqual(body['heading-4'].variation, { GRAD: 50 });
  assert.deepEqual(body['heading-1'].variation, { GRAD: 50 }, 'a first heading follows the headings');
  assert.equal(derive(inputs({ typefaces: mona, type: { roles: { display: { features: [] } } } })).type.display.features, undefined, 'an empty choice turns the tuning off');
  assert.throws(() => validateInputs(inputs({ type: { roles: { footer: {} } } })), /footer/);
  assert.throws(() => validateInputs(inputs({ type: { roles: { label: { features: ['not a tag'] } } } })), /features/);
});

test('a role keeps only what its typeface has, and says what it lost', () => {
  const roles = () => ({
    display: { weight: 260, 'letter-spacing': -0.03, axes: { wdth: 112, opsz: 100 } },
    label: { weight: 800, 'letter-spacing': 0.06, axes: { wdth: 75, opsz: 0 }, features: ['ss02', 'ss10'] },
    main: { features: [] },
  });
  const unchanged = inputs({ typefaces: { main: 'Mona Sans' }, type: { roles: roles() } });
  assert.deepEqual(fitRolesToFaces(unchanged), [], 'Mona Sans has all of it');
  assert.deepEqual(unchanged.type.roles, roles());

  // Inter has a weight axis from 100 to 900 and an optical size from 14 to 32, no width and none of these sets.
  const inter = inputs({ typefaces: { main: 'Inter' }, type: { roles: roles() } });
  assert.deepEqual(fitRolesToFaces(inter), [
    'display: Inter has no wdth axis, so its setting 112 is left out',
    'display: opsz 100 is outside Inter\'s 14 to 32, so it is 32',
    'label: Inter has no wdth axis, so its setting 75 is left out',
    'label: opsz 0 is outside Inter\'s 14 to 32, so it is 14',
    'label: Inter has no ss10, so it is left out',
  ]);
  assert.deepEqual(inter.type.roles, {
    display: { weight: 260, 'letter-spacing': -0.03, axes: { opsz: 32 } },
    label: { weight: 800, 'letter-spacing': 0.06, axes: { opsz: 14 }, features: ['ss02'] },
    main: { features: [] },
  }, 'an empty choice of sets stays, since it turns a tuning off');

  // A typeface the library does not ship has no axes or sets it knows; a role left with nothing goes, and the roles too.
  const own = inputs({ typefaces: { main: 'Georgia, serif', label: 'Lora' }, type: { roles: { display: { axes: { wdth: 112 } }, label: { weight: 900 } } } });
  assert.deepEqual(fitRolesToFaces(own), [
    'display: Georgia is not a typeface the library ships, so it has no known wdth axis, so its setting 112 is left out',
    'label: weight 900 is outside Lora\'s 400 to 700, so it is 700',
  ]);
  assert.deepEqual(own.type.roles, { label: { weight: 700 } });
  const gone = inputs({ typefaces: { main: 'Georgia, serif' }, type: { roles: { display: { features: ['ss01'] } } } });
  fitRolesToFaces(gone);
  assert.equal(gone.type.roles, undefined);
  validateInputs(gone);
  assert.deepEqual(fitRolesToFaces(inputs()), [], 'a design without roles');
});

test('labels can take a typeface of their own', () => {
  const { typefaces } = derive(inputs({ typefaces: { main: 'Mona Sans', label: 'Geist Mono' } }));
  assert.equal(typefaces.label, 'Geist Mono, system-ui, sans-serif');
  assert.match(coreCss(derive(inputs({ typefaces: { main: 'Mona Sans', label: 'Geist Mono' } }))), /--kn-typeface-label: Geist Mono, system-ui, sans-serif;/);
});

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
  assert.match(ruleOf('heading-1'), /font-stretch: var\(--kn-type-heading-1-stretch, normal\)/);
  for (const n of [2, 3, 4, 5, 6]) assert.match(ruleOf(`heading-${n}`), /font-family: var\(--kn-typeface-heading\)/);
  const body = await read('src/components/body-text.css');
  assert.match(body, /h1:not\(\[data-kn-type\]\) \{\s*font-family: var\(--kn-typeface-heading-1\);\s*color: var\(--kn-text-heading-1\);/);
  assert.match(coreCss(derive(inputs())), /\[data-kn-surface\] \{ --kn-text-heading-1: var\(--kn-text\); \}/);
});

test('Mona Sans takes its stylistic sets from 20px, by style and fluid window', () => {
  const { type, 'type-scale': scale } = derive(inputs({ typefaces: { main: 'Mona Sans' } }));
  assert.equal(type.body.features, undefined, 'always below 20px');
  assert.equal(type.small.features, undefined);
  assert.equal(type.label.features, undefined);
  assert.deepEqual(type['heading-1'].features, { value: '"ss05", "ss07"', 'from-window': 0 }, 'always from 20px');
  const crossing = Object.values(type).filter(({ features }) => features?.['from-window'] > 0);
  assert.ok(crossing.length > 0);
  for (const { step, features } of crossing) {
    assert.ok(sizeAt(scale, step, features['from-window']) >= 20);
    assert.ok(sizeAt(scale, step, features['from-window'] - 1) < 20);
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

test('the first heading takes the role the user chooses, at its own size', () => {
  const mona = { main: 'Mona Sans' };
  const display = { weight: 260, axes: { wdth: 112 } };
  const asHeading = derive(inputs({ typefaces: mona, type: { roles: { display } } }));
  assert.equal(asHeading.type['heading-1'].weight, 600);
  assert.equal(asHeading.type['heading-1'].stretch, undefined);
  assert.equal(asHeading.typefaces['heading-1'], undefined, 'the default leaves the resolved typefaces as they were');

  const asDisplay = derive(inputs({ typefaces: mona, type: { 'heading-1-role': 'display', roles: { display } } }));
  assert.deepEqual([asDisplay.type['heading-1'].weight, asDisplay.type['heading-1'].stretch, asDisplay.type['heading-1']['line-height']], [260, 112, 1.1]);
  assert.deepEqual(asDisplay.type['heading-1'].size, asHeading.type['heading-1'].size, 'its own size');
  assert.deepEqual(asDisplay.type['heading-2'], asHeading.type['heading-2'], 'second headings never follow');
  assert.match(coreCss(asDisplay), /--kn-type-heading-1-stretch: 112%;/);

  const adjusted = derive(inputs({ typefaces: mona, type: { 'heading-1-role': 'display', roles: { display, 'heading-1': { axes: { opsz: 40 } } } } }));
  assert.deepEqual([adjusted.type['heading-1'].stretch, adjusted.type['heading-1'].variation], [112, { opsz: 40 }], 'its own setting goes on top');

  const playfair = derive(inputs({ typefaces: { ...mona, display: 'Playfair, Georgia, serif' }, type: { 'heading-1-role': 'display' } }));
  assert.equal(playfair.typefaces['heading-1'], 'Playfair, Georgia, serif');
  assert.equal(playfair.typefaces.heading, playfair.typefaces.main, 'other headings stay');
  assert.match(coreCss(playfair), /--kn-typeface-heading-1: Playfair, Georgia, serif;/);

  const own = derive(inputs({ typefaces: { ...mona, 'heading-1': 'Lora, Georgia, serif' }, type: { 'heading-1-role': 'display' } }));
  assert.equal(own.typefaces['heading-1'], 'Lora, Georgia, serif', 'a typeface chosen for it still holds');
  assert.throws(() => validateInputs(inputs({ type: { 'heading-1-role': 'title' } })), /heading-1-role/);
});

test('labels sit on the type scale, three steps below body text unless changed, and never below 12px', () => {
  // Three since the owner asked for eyebrows a step larger (2026-11-12): five and four steps both gave 12px on a wide
  // screen, where no text goes below 12px.
  const label = derive(inputs()).type.label.size;
  assert.deepEqual([label.min, label.max], [14, 13]);
  const lower = derive(inputs({ type: { steps: { label: 5 } } })).type.label.size;
  assert.deepEqual([lower.min, lower.max], [12, 12]);
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

test('the shipped typefaces are web fonts with a real italic and their licences', async () => {
  const css = await read('src/fonts/fonts.css');
  assert.equal(TYPEFACES.length, 47);
  assert.deepEqual(TYPEFACES.filter((face) => !face.italic && !face.slant).map((face) => face.family), ['Roboto Slab', 'Mona Sans Mono'], 'upright, never slanted by a browser');
  assert.deepEqual(TYPEFACES.filter((face) => face.slant).map((face) => face.family), ['Roboto Flex', 'Google Sans Flex', 'Recursive'], 'italic through an axis');
  for (const { family, upright, italic, weight, licence, category, roles } of TYPEFACES) {
    for (const file of [upright, italic].filter(Boolean)) {
      assert.equal((await read(`src/fonts/${file}`, null)).subarray(0, 4).toString('latin1'), 'wOF2', file);
      assert.ok(css.includes(`font-family: "${family}"; src: url("./${file}") format("woff2"); font-weight: ${weight};`), file);
    }
    assert.match(await read(`src/fonts/${licence}`), /Open Font License|Apache License/, licence);
    assert.ok(roles.length, family);
    assert.ok(CATEGORIES.some(([name]) => name === category), family);
  }
  assert.equal([...css.matchAll(/@font-face/g)].length, TYPEFACES.flatMap((face) => [face.upright, face.italic].filter(Boolean)).length);
  assert.match(css, /"Roboto Flex"[^}]*font-style: oblique 0deg 10deg;/);
  assert.match(css, /"Recursive"[^}]*font-style: oblique 0deg 15deg;/);
  assert.match(await read('src/fonts/LICENSE-mona-sans.txt'), /Reserved Font Name "Mona"/);
  assert.match(await read('src/components/base.css'), /font-synthesis-style: none/);
});

test('a design file value names its shipped typeface, and only used typefaces are found', () => {
  for (const { family, value } of TYPEFACES) {
    assert.deepEqual(shippedIn(derive(inputs({ typefaces: { main: value } })).typefaces).map((face) => face.family), [family]);
  }
  assert.deepEqual(shippedIn(derive(inputs({ typefaces: { main: 'Georgia, serif' } })).typefaces), []);
  assert.deepEqual(
    shippedIn(derive(inputs({ typefaces: { main: 'Lora, Georgia, serif', monospace: 'Red Hat Mono' } })).typefaces).map((face) => face.family),
    ['Lora', 'Red Hat Mono'],
  );
});
