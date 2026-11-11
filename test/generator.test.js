import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  defaultInputs, resolve, fluid, typeScale, spacing, radii, LEVELS, REFERENCE,
  shadow, shadowsForSurface, hexToRgb, rgbToHex, hexToOklch, oklchToHex,
  fitChroma, inGamut, oklchToLinearRgb, luminance, contrast, ramp, TARGETS,
  canonicalJson, fingerprint, checkFingerprint, validateDesignFile,
} from '../src/generator/index.js';
import { emitCss } from '../src/css/index.js';

const referenceInk = '#202124';
const expectedShadows = {
  header: '0 1px 2px rgb(32 33 36 / 0.06), 0 4px 12px -2px rgb(32 33 36 / 0.1)',
  'header-panel': '0 1px 2px rgb(32 33 36 / 0.03), 0 4px 12px -2px rgb(32 33 36 / 0.05)',
  panel: '0 2px 6px rgb(32 33 36 / 0.025), 0 16px 40px -8px rgb(32 33 36 / 0.09)',
  page: '0 4px 10px rgb(32 33 36 / 0.03), 0 24px 48px -12px rgb(32 33 36 / 0.11)',
  box: '0 1px 2px rgb(32 33 36 / 0.018), 0 6px 16px -4px rgb(32 33 36 / 0.048)',
  'box-lifted': '0 2px 4px rgb(32 33 36 / 0.018), 0 12px 32px -8px rgb(32 33 36 / 0.048)',
};
const shadowSettings = () => ({ ...defaultInputs().shadow, ...REFERENCE });
const surface = { text: referenceInk, colors: { primary: '#168b83' } };
const design = async (inputs = defaultInputs()) => ({ format: 1, inputs, project: {}, resolved: await resolve(inputs) });

test('all six shadows at the reference positions match character for character', () => {
  assert.deepEqual(shadowsForSurface(shadowSettings(), surface), expectedShadows);
});

test('each target disables its own elevations', () => {
  const groups = { header: ['header', 'header-panel'], panel: ['panel'], page: ['page'], box: ['box', 'box-lifted'] };
  for (const [target, names] of Object.entries(groups)) {
    const settings = shadowSettings();
    settings.targets[target] = false;
    const output = shadowsForSurface(settings, surface);
    for (const name of Object.keys(expectedShadows)) assert.equal(output[name], names.includes(name) ? 'none' : expectedShadows[name]);
  }
});

test('shadows are off by default and at strength zero, even at full hardness', async () => {
  assert.ok(Object.values((await resolve(defaultInputs())).shadow).every((s) => s === 'none'));
  assert.equal(shadow(LEVELS.box, { ...REFERENCE, strength: 0, hardness: 100 }, referenceInk), 'none');
});

test('dark Surface default is black at three times opacity; explicit colours stay explicit', () => {
  const settings = shadowSettings();
  const dark = { ...surface, polarity: 'dark', text: '#ffffff' };
  assert.equal(shadowsForSurface(settings, dark).box, '0 1px 2px rgb(0 0 0 / 0.054), 0 6px 16px -4px rgb(0 0 0 / 0.144)');
  assert.equal(shadowsForSurface({ ...settings, color: 'primary' }, dark).box,
    shadowsForSurface({ ...settings, color: 'primary' }, surface).box);
  assert.equal(shadowsForSurface({ ...settings, color: '#ffffff' }, dark).box,
    '0 1px 2px rgb(255 255 255 / 0.018), 0 6px 16px -4px rgb(255 255 255 / 0.048)');
});

test('full hardness is solid, whole-pixel geometry independent of nonzero strength', () => {
  const controls = { ...REFERENCE, hardness: 100, elevation: 47, angle: -45 };
  assert.equal(shadow(LEVELS.box, { ...controls, strength: 1 }, referenceInk), '4px 4px 0 rgb(32 33 36 / 1)');
  assert.equal(shadow(LEVELS.box, { ...controls, strength: 100 }, referenceInk), '4px 4px 0 rgb(32 33 36 / 1)');
});

test('diffusion, elevation and angle retain the ported transformations', () => {
  assert.equal(shadow(LEVELS.header, { ...REFERENCE, hardness: 0 }, '#000'),
    '0 1px 4px rgb(0 0 0 / 0.06), 0 4px 24px -4px rgb(0 0 0 / 0.1)');
  assert.equal(shadow(LEVELS.header, { ...REFERENCE, angle: -90, elevation: 100 }, '#000'),
    '2px 0 4px rgb(0 0 0 / 0.06), 8px 0 24px -4px rgb(0 0 0 / 0.1)');
});

test('units example is exact; constant and descending endpoints remain valid clamps', () => {
  assert.equal(fluid(17, 19), 'clamp(1.0625rem, 1.0268rem + 0.1786vw, 1.1875rem)');
  assert.equal(fluid(15, 15), 'clamp(0.9375rem, 0.9375rem + 0vw, 0.9375rem)');
  assert.equal(fluid(19, 17), 'clamp(1.0625rem, 1.2232rem - 0.1786vw, 1.1875rem)');
});

test('chained type table reproduces all specified rounded endpoints', () => {
  const type = typeScale(defaultInputs().type);
  const expected = { body: [17, 19], lead: [18, 21], small: [15, 15], 'heading-6': [17, 19], 'heading-5': [18, 21], 'heading-4': [19, 24], 'heading-3': [21, 27], 'heading-2': [22, 30], 'heading-1': [27, 43], display: [33, 62] };
  for (const [name, pair] of Object.entries(expected)) assert.deepEqual([type[name].size.min, type[name].size.max], pair);
  const changed = defaultInputs().type;
  changed.steps['heading-6'] = 2;
  assert.equal(typeScale(changed)['heading-5'].size.max, Math.round(19 * 1.125 ** 3));
  changed.steps.small = 12;
  assert.equal(typeScale(changed).small.size.min, 12);
});

test('eight density-scaled steps and shared corner profile preserve comparable geometry', () => {
  const space = spacing(35);
  assert.deepEqual(Object.values(space.steps).map(({ min, max }) => [min, max]), [[5, 7], [9, 10], [12, 14], [17, 20], [24, 27], [27, 34], [31, 41], [34, 54]]);
  assert.deepEqual(space.roles['column-gap'], space.steps[6]);
  assert.ok(spacing(75).roles.band.min > spacing(50).roles.band.min);
  assert.deepEqual(radii(0), { control: 0, card: 0 });
  assert.deepEqual(radii(25), { control: 3, card: 3 });
  assert.deepEqual(radii(100), { control: 12, card: 24 });
});

test('sRGB / OKLCH round trips, gamut fitting and WCAG endpoints', () => {
  for (const hex of ['#ffffff', '#000000', '#168b83', '#ff0000', '#00ff00', '#0000ff', '#ffff00']) {
    const { L, C, H } = hexToOklch(hex);
    assert.equal(oklchToHex(L, C, H), hex);
  }
  assert.deepEqual(hexToRgb('#fff'), [1, 1, 1]);
  assert.equal(rgbToHex([-1, 0.5, 2]), '#0080ff');
  assert.throws(() => hexToRgb('#oops'));
  const c = fitChroma(0.7, 0.4, 40);
  assert.ok(c < 0.4 && inGamut(oklchToLinearRgb(0.7, c, 40)));
  assert.equal(luminance('#000'), 0);
  assert.equal(luminance('#fff'), 1);
  assert.equal(contrast('#000', '#fff'), 21);
  assert.equal(contrast('#168b83', '#168b83'), 1);
});

test('ramps solve contrast with byte-quantisation tolerance and retain exactly one seed anchor', () => {
  const solved = ramp('#168b83', { anchor: false });
  // Ten steps for each mode, eight of them shared: dark mode's own 850 and 975 beside light mode's 900 and 950.
  assert.deepEqual(solved.map(({ step }) => step), [100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950, 975]);
  // Rounding to bytes moves a step by up to a code unit, which costs more contrast the darker the step: as much as about
  // 1.2 per cent at steps 800 and 850, 0.16 at 850's 13.5.
  for (const [i, value] of solved.entries()) assert.ok(Math.abs(value['on-page'] / TARGETS[i] - 1) < 0.015, `step ${value.step}`);
  const anchored = ramp('#168b83');
  assert.equal(anchored.filter((s) => s.anchor).length, 1);
  assert.equal(anchored.find((s) => s.anchor).hex, '#168b83');
  assert.notEqual(ramp('#168b83', { tint: 0.5 })[0].hex, anchored[0].hex);
});

test('canonical fingerprint is SHA-256, independent of object order but sensitive to array order', async () => {
  const a = { z: [3, 2], a: { y: 1, x: 'é' } };
  const b = { a: { x: 'é', y: 1 }, z: [3, 2] };
  assert.equal(canonicalJson(a), '{"a":{"x":"é","y":1},"z":[3,2]}');
  assert.equal(await fingerprint(a), await fingerprint(b));
  assert.equal(await fingerprint(a), createHash('sha256').update(canonicalJson(a)).digest('hex'));
  assert.notEqual(await fingerprint(a), await fingerprint({ ...a, z: [2, 3] }));
  for (const invalid of [undefined, NaN, { x: undefined }, new Date(), Array(2)]) assert.throws(() => canonicalJson(invalid));
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic));
});

test('consumers refuse stale inputs; presentation identity is outside the fingerprint', async () => {
  const file = await design();
  file.project.name = 'Example presentation';
  assert.equal(await checkFingerprint(file), true);
  file.inputs.type['body-size'].max = 20;
  await assert.rejects(checkFingerprint(file), /fingerprint mismatch/);
  await assert.rejects(emitCss(file), /fingerprint mismatch/);
});

test('defaults, explicit colour policies, frame and completed contrast metadata', async () => {
  const inputs = { 'brand-colors': { primary: '#168b83', secondary: '#aa6633' }, shadow: { strength: 50, color: 'secondary' }, frame: { width: 2 } };
  const r = await resolve(inputs);
  assert.equal(r.frame.color, '#aa6633');
  assert.equal(r.frame.width, 2);
  assert.equal(r['contrast-check'].status, 'passed');
  assert.ok(r.shadow.box.includes('rgb(170 102 51'));
  const file = { format: 1, inputs, project: {}, resolved: r };
  assert.equal(validateDesignFile(file), file);
  assert.ok((await emitCss(file)).includes('--kn-frame-width: 2px;'));
  assert.equal(Object.keys(r.surfaces).length, 13); // eight base kinds, four status kinds and tint-secondary
});

test('inputs reject unknown controls, invalid ranges and unavailable colour choices', async () => {
  for (const changes of [{ 'corner-profile': 101 }, { 'density-profile': -1 }, { frame: { width: 4 } }, { shadow: { angle: 91 } }, { type: { steps: { display: 0.5 } } }, { typefaces: { body: 'x; color: red' } }, { tint: 0.5 }, { 'brand-colors': { primary: 'teal' } }, { 'brand-colors': { primary: '#168b83', tertiary: '#123' } }]) {
    await assert.rejects(resolve({ ...defaultInputs(), ...changes }), TypeError);
  }
  await assert.rejects(resolve({ 'brand-colors': { primary: '#168b83' }, shadow: { color: 'tertiary' } }), /Unavailable colour/);
});

test('CSS emits only namespaced identifiers and the five logical width selectors, without root font size', async () => {
  const css = await emitCss(await design());
  const names = [...css.matchAll(/--[a-z][a-z0-9-]*/g)].map(([name]) => name);
  assert.ok(names.length > 80);
  assert.ok(names.every((name) => name.startsWith('--kn-')));
  const attributes = [...css.matchAll(/\[(data-[a-z-]+)/g)].map(([, name]) => name);
  assert.ok(attributes.every((name) => name.startsWith('data-kn-')));
  assert.deepEqual([...css.matchAll(/\[data-kn-width="([a-z-]+)"\]/g)].map(([, value]) => value), ['narrow', 'wide', 'full', 'bleed-start', 'bleed-end']);
  assert.ok(!/\.[a-z][a-z0-9-]*/i.test(css));
  assert.ok(!/font-size\s*:/.test(css));
  assert.match(css, /--kn-background:/);
  assert.ok(css.includes('--kn-radius-card: 0.1875rem;'));
  assert.ok(css.includes('prefers-reduced-motion'));
  for (let i = 1; i <= 8; i++) assert.ok(css.includes(`--kn-space-${i}: clamp(`));
});

test('checked-in neutral example is current, schema-valid and fully reproducible', async () => {
  const example = JSON.parse(await readFile(new URL('../examples/example.design.json', import.meta.url), 'utf8'));
  validateDesignFile(example);
  assert.equal(await checkFingerprint(example), true);
  // The generator's version is the package's, which every release raises, so the example need not follow it.
  const { 'generator-version': version, ...resolved } = await resolve(example.inputs);
  const { 'generator-version': written, ...stored } = example.resolved;
  assert.deepEqual(resolved, stored);
  assert.match(written, /^\d+\.\d+\.\d+$/);
});
