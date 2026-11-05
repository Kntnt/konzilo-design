// One general rule from light mode to dark mode (owner, 2026-11-05): docs/spec/plates.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  BAND_MINIMUM, BAND_STEPS, MODES, ROLE_TARGETS, TINT_CEILING, checkContrast, contrast, contrastCheck, defaultInputs, derive, grayChroma, hexToOklch, ramp, ramps, resolve, validateDesignFile,
} from '../src/generator/index.js';
import { coreCss, emitCss } from '../src/css/index.js';

const SEEDS = ['#6366F1', '#168b83', '#ffd400', '#c6e000', '#ff8800', '#e02020', '#16a34a', '#0b2f6b', '#a21caf', '#000000', '#0a0a0a', '#333333', '#808080', '#ffffff', '#f8f8f8', '#ffe9b0', '#00ffff', '#ff00ff', '#1a0033', '#7a3e9d'];
const FURTHER = { secondary: '#7a3e9d', tertiary: '#168b83' };
const cli = fileURLToPath(new URL('../bin/konzilo-design.js', import.meta.url));
const designs = () => SEEDS.flatMap((primary) => [{ primary }, { primary, ...FURTHER }].map((brand) => [`${JSON.stringify(brand)}`, { 'brand-colors': brand }]));
const isPicture = (kind) => kind.startsWith('picture-');
const isBand = (kind) => kind !== 'page' && !isPicture(kind);
const file = async (inputs = defaultInputs()) => ({ format: 1, inputs, project: {}, resolved: await resolve(inputs) });

test('over the seed list, in both modes, every band stands apart from the page and every contrast pair passes', async () => {
  for (const [name, inputs] of designs()) {
    const resolved = await resolve(inputs);
    validateDesignFile({ format: 1, inputs, project: {}, resolved });
    assert.equal(checkContrast(resolved), true, name);
    assert.equal(resolved['contrast-check'].status, 'passed', name);
    for (const [kind, modes] of Object.entries(resolved.surfaces)) for (const mode of MODES) {
      const { pairs } = resolved['contrast-check'].matrix[kind][mode];
      for (const [role, pair] of Object.entries(pairs)) assert.ok(pair.passed && pair.ratio >= pair.target, `${name} ${kind}/${mode}/${role}`);
      const fills = modes[mode].roles;
      if (!isBand(kind)) { assert.equal(pairs['background-page'], undefined, `${kind} has no band pair`); continue; }
      const ratio = contrast(fills.background, resolved.surfaces.page[mode].roles.background);
      assert.ok(ratio >= BAND_MINIMUM, `${name} ${kind}/${mode}: ${ratio} from the page`);
      assert.deepEqual(pairs['background-page'], { foreground: fills.background, background: resolved.surfaces.page[mode].roles.background, ratio, target: BAND_MINIMUM, passed: true, samples: {} });
      assert.notEqual(fills['background-hover'], fills.background, `${name} ${kind}/${mode}: hover shows on the background`);
      assert.notEqual(fills['background-hover'], fills['background-alt'], `${name} ${kind}/${mode}: hover shows on the alternate fill`);
    }
  }
});

test('the page, the light bands and the dark bands stand where the rule says, keeping their family', () => {
  const { surfaces } = derive({ 'brand-colors': { primary: '#168b83', ...FURTHER } });
  const expected = {
    page: ['white', 'gray-950'],
    raised: ['gray-100', 'gray-900'],
    tint: ['primary-100', 'primary-900'],
    'tint-secondary': ['secondary-100', 'secondary-900'],
    'tint-tertiary': ['tertiary-100', 'tertiary-900'],
    'status-info': ['info-100', 'info-900'],
    'status-success': ['success-100', 'success-900'],
    'status-warning': ['warning-100', 'warning-900'],
    'status-error': ['error-100', 'error-900'],
    brand: ['primary-800', 'primary-800'],
    accent: ['primary-700', 'primary-700'],
    inverse: ['gray-950', 'gray-800'],
  };
  for (const [kind, [light, dark]] of Object.entries(expected)) {
    assert.equal(surfaces[kind].light.recipes.background, light, kind);
    assert.equal(surfaces[kind].dark.recipes.background, dark, kind);
  }
  for (const kind of ['brand', 'accent', 'inverse']) for (const mode of MODES) assert.equal(surfaces[kind][mode].polarity, 'dark', kind);
  for (const kind of Object.keys(expected).filter((name) => !['brand', 'accent', 'inverse'].includes(name))) for (const mode of MODES) assert.equal(surfaces[kind][mode].polarity, mode, kind);
});

test('every other role follows the step and polarity of the background, whatever the kind', () => {
  const ROWS = {
    'light/white': { alternate: 100, hover: 200, border: 200, strong: 500 },
    'light/100': { alternate: 'white', hover: 200, border: 200, strong: 500 },
    'dark/700': { alternate: 800, hover: 900, muted: 300, border: 800, strong: 400 },
    'dark/800': { alternate: 900, hover: 950, muted: 200, border: 700, strong: 400 },
    'dark/900': { alternate: 950, hover: 800, muted: 300, border: 800, strong: 400 },
    'dark/950': { alternate: 900, hover: 800, muted: 300, border: 800, strong: 400 },
  };
  const seen = new Set();
  for (const [, inputs] of designs()) {
    const { surfaces } = derive(inputs);
    for (const [kind, modes] of Object.entries(surfaces)) if (!isPicture(kind)) for (const mode of MODES) {
      const { polarity, recipes } = modes[mode];
      const [family, step = recipes.background] = recipes.background === 'white' ? ['gray'] : recipes.background.split('-');
      const row = ROWS[`${polarity}/${step}`];
      assert.ok(row, `${kind}/${mode} stands on ${polarity}/${step}`);
      seen.add(`${polarity}/${step}/${kind}/${mode}`);
      // The family is all a kind adds, and accent's muted text and borders are its one grey family.
      const lines = kind === 'accent' ? 'gray' : family;
      assert.equal(recipes['background-alt'], row.alternate === 'white' ? 'white' : `${family}-${row.alternate}`, `${kind}/${mode}`);
      assert.equal(recipes['background-hover'], `${family}-${row.hover}`, `${kind}/${mode}`);
      assert.equal(recipes['text-muted'], polarity === 'dark' ? `${lines}-${row.muted}` : 'gray-600', `${kind}/${mode}`);
      assert.equal(recipes.border, `${lines}-${row.border}`, `${kind}/${mode}`);
      assert.equal(recipes['border-strong'], `${lines}-${row.strong}`, `${kind}/${mode}`);
    }
  }
  // Two kinds meet on one row: brand and inverse in dark mode, so the rule has not become a list of kinds.
  for (const id of ['dark/800/brand/dark', 'dark/800/inverse/dark', 'dark/950/page/dark', 'dark/950/inverse/light']) assert.ok(seen.has(id), id);
});

test('picture Surfaces stand on no step and keep their recipes', () => {
  const { surfaces } = derive({ 'brand-colors': { primary: '#168b83' } });
  for (const mode of MODES) {
    const light = surfaces['picture-light'][mode].recipes, dark = surfaces['picture-dark'][mode].recipes;
    assert.deepEqual([light.background, light['background-alt'], light['background-hover'], light['text-muted'], light.border, light['border-strong']], ['white', 'white', 'gray-200', 'gray-600', 'gray-200', 'gray-500']);
    assert.deepEqual([dark.background, dark['background-alt'], dark['background-hover'], dark['text-muted'], dark.border, dark['border-strong']], ['black', 'black', 'gray-800', 'gray-300', 'gray-800', 'gray-400']);
  }
});

test('a seed no longer erases a band, and every other seed keeps its anchor', () => {
  // A seed that lies too near a page on a step that carries a band, in any brand rank.
  for (const seed of ['#ffffff', '#fdfdfd', '#f8f8f8', '#f5f5f5', '#1b1b1b', '#1c1c1c']) for (const brand of [{ primary: seed }, { primary: '#168b83', secondary: seed }, { primary: '#168b83', secondary: '#7a3e9d', tertiary: seed }]) {
    const { surfaces, 'contrast-check': check } = derive({ 'brand-colors': brand });
    assert.equal(check.status, 'passed', seed);
    for (const [kind, modes] of Object.entries(surfaces)) if (kind.startsWith('tint')) for (const mode of MODES) {
      const ratio = contrast(modes[mode].roles.background, surfaces.page[mode].roles.background);
      assert.ok(ratio >= BAND_MINIMUM, `${seed} ${kind}/${mode}: ${ratio}`);
      assert.notEqual(modes[mode].roles.background, seed, `${seed} ${kind}/${mode}`);
    }
  }
  assert.equal(ramp('#ffffff').filter((step) => step.anchor).length, 0);
  // The condition reads the actual page: a warm or a cool page moves the same seed over the same line.
  for (let value = 0; value < 256; value++) for (const temperature of [-100, 0, 100]) {
    const channel = value.toString(16).padStart(2, '0');
    const { surfaces } = derive({ 'brand-colors': { primary: `#${channel}${channel}${channel}` }, 'gray-temperature': temperature });
    for (const [kind, modes] of Object.entries(surfaces)) if (isBand(kind)) for (const mode of MODES) {
      assert.ok(contrast(modes[mode].roles.background, surfaces.page[mode].roles.background) >= BAND_MINIMUM, `#${channel}@${temperature} ${kind}/${mode}`);
    }
  }
  // Seeds that leave a band standing keep their exact colour, on a band step or beside one.
  for (const [seed, step] of [['#168b83', 500], ['#ffe9b0', 100], ['#0b2f6b', 800], ['#333333', 800], ['#000000', 950], ['#0a0a0a', 950]]) {
    assert.equal(ramps({ primary: seed }, 0).primary[step], seed, seed);
  }
});

test('the steps that guard the anchor are the steps a band stands on', () => {
  const { surfaces } = derive({ 'brand-colors': { primary: '#168b83' } });
  const steps = new Set();
  for (const [kind, modes] of Object.entries(surfaces)) if (isBand(kind)) for (const mode of MODES) {
    const [family, step] = modes[mode].recipes.background.split('-');
    if (family !== 'gray') steps.add(Number(step));
  }
  assert.deepEqual([...steps].sort((a, b) => a - b), [...BAND_STEPS]);
});

test('a foreground is solved over every fill it is checked on, and moves only where it must', () => {
  const { surfaces, 'contrast-check': check } = derive({ 'brand-colors': { primary: '#ff8800' } });
  assert.equal(check.status, 'passed');
  const surface = surfaces['status-error'].dark;
  assert.deepEqual(surface.adjustments.link, { from: 'primary-300', to: 'primary-200' });
  assert.ok(contrast(surface.roles.link, surface.roles['background-hover']) >= ROLE_TARGETS['link-hover']);
  assert.equal(surfaces.page.dark.adjustments.link, undefined);
  // The same cause on other seeds, surfaces and fills: light seeds anchored at the dark end of a step.
  for (const primary of ['#a4a4a4', '#a5a5a5', '#2fb99a', '#f175f9', '#a7ac3b', '#c69d61']) assert.equal(derive({ 'brand-colors': { primary } })['contrast-check'].status, 'passed', primary);
});

test('check and every export refuse a band that equals the page, or a stale band pair', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-dark-mode-'));
  t.after(() => rm(directory, { recursive: true }));
  const check = async (design, name) => {
    const path = join(directory, `${name}.design.json`);
    await writeFile(path, JSON.stringify(design));
    return spawnSync(process.execPath, [cli, 'check', path], { encoding: 'utf8' });
  };
  assert.equal((await check(await file(), 'whole')).status, 0);
  for (const [kind, mode] of [['tint', 'light'], ['tint', 'dark'], ['raised', 'dark'], ['inverse', 'dark'], ['brand', 'light'], ['status-info', 'dark']]) {
    const design = await file();
    design.resolved.surfaces[kind][mode].roles.background = design.resolved.surfaces.page[mode].roles.background;
    // A report written honestly for that design still fails, like any other contrast failure.
    design.resolved['contrast-check'] = contrastCheck(design.resolved.surfaces);
    assert.equal(design.resolved['contrast-check'].status, 'failed');
    assert.equal(design.resolved['contrast-check'].matrix[kind][mode].pairs['background-page'].ratio, 1);
    assert.equal(design.resolved['contrast-check'].matrix[kind][mode].pairs['background-page'].passed, false);
    const run = await check(design, `${kind}-${mode}`);
    assert.equal(run.status, 1, `${kind}/${mode}`);
    assert.match(run.stderr, /contrast check failed/);
    await assert.rejects(emitCss(design), /contrast check failed/);
  }
  for (const tamper of [
    (r) => { r.surfaces.page.light.roles.background = r.surfaces.tint.light.roles.background; },
    (r) => { r['contrast-check'].matrix.tint.light.pairs['background-page'].ratio += 0.01; },
    (r) => { r['contrast-check'].matrix.tint.light.pairs['background-page'].target = 1.1 + 0.01; },
    (r) => { delete r['contrast-check'].matrix.tint.dark.pairs['background-page']; },
    (r) => { r['contrast-check'].matrix.page.light.pairs['background-page'] = r['contrast-check'].matrix.tint.light.pairs['background-page']; },
  ]) {
    const design = await file();
    tamper(design.resolved);
    await assert.rejects(emitCss(design), /contrast check failed|expected 1.1/);
  }
});

test('the schema and the check share the minimum, and it stays below every band the ramps solve', async () => {
  const schema = (await import('../schema/design-file.schema.json', { with: { type: 'json' } })).default;
  assert.equal(schema.$defs['contrast-background-page'].properties.target.const, BAND_MINIMUM);
  assert.equal(ROLE_TARGETS['background-page'], BAND_MINIMUM);
  assert.ok(BAND_MINIMUM < 1.11 && BAND_MINIMUM >= 1.05);
  for (const seed of SEEDS) for (const temperature of [-100, 0, 100]) {
    const gray = ramps({ primary: '#808080' }, temperature).gray;
    const solved = Object.fromEntries(ramp(seed, { anchor: false, ceiling: TINT_CEILING }).map(({ step, hex }) => [step, hex]));
    assert.ok(contrast(solved[100], '#ffffff') >= BAND_MINIMUM, `${seed} step 100`);
    assert.ok(contrast(solved[900], gray[950]) >= BAND_MINIMUM, `${seed}@${temperature} step 900`);
  }
});

test('the Temperature slider has half its strength: at plus and minus 100 the grey stays at chroma 0.01', () => {
  for (const temperature of [100, -100]) {
    assert.ok(grayChroma(temperature) <= 0.01, `${temperature}`);
    assert.ok(grayChroma(temperature) > 0, `${temperature} still has a temperature`);
    // What the ramp's colours measure: rounding to eight bits a channel moves a dark step by about a thousandth.
    for (const [step, hex] of Object.entries(ramps({ primary: '#168b83' }, temperature).gray)) {
      assert.ok(hexToOklch(hex).C <= 0.01 + 0.0015, `${temperature}, step ${step}: ${hexToOklch(hex).C}`);
    }
  }
  assert.equal(grayChroma(0), 0);
  assert.deepEqual(ramps({ primary: '#168b83' }, 100).gray, Object.fromEntries(ramp('#808080', { chroma: 0.01, hue: 80, anchor: false }).map(({ step, hex }) => [step, hex])));
});

test('in a browser, inverse keeps its dark scheme in both modes while its colours follow the nearest mode', { timeout: 60000 }, async () => {
  const { surfaces, ...rest } = derive({ 'brand-colors': { primary: '#168b83' } });
  const css = coreCss({ surfaces, ...rest });
  // light-dark() would always pick the dark value here, because the kind sets its own colour scheme.
  assert.match(css, /\[data-kn-surface="inverse"\] \{[^}]*--kn-background: var\(--kn-in-light, #[0-9a-f]{6}\) var\(--kn-in-dark, #[0-9a-f]{6}\);/);
  assert.doesNotMatch(css.match(/\[data-kn-surface="inverse"\] \{[^}]*\}/)[0], /light-dark\(/);
  assert.match(css.match(/\[data-kn-surface="tint"\] \{[^}]*\}/)[0], /--kn-background: light-dark\(/);
  const rgb = (hex) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const read = (selector) => page.locator(selector).evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, scheme: style.colorScheme, inherited: getComputedStyle(node.querySelector('i')).getPropertyValue('--kn-background').trim(), muted: style.getPropertyValue('--kn-text-muted').trim() };
    });
    for (const mode of MODES) {
      const other = mode === 'light' ? 'dark' : 'light';
      await page.setContent(`<!doctype html><html data-kn-mode="${mode}"><head><style>${css}</style></head><body>
        <div id="plain" data-kn-surface="inverse"><i></i></div>
        <div data-kn-mode="${other}"><div id="nested" data-kn-surface="inverse"><i></i></div></div>
        <div id="own" data-kn-surface="inverse" data-kn-mode="${other}"><i></i></div>
        <div id="tint" data-kn-surface="tint"><i></i></div>
      </body></html>`);
      const plain = await read('#plain');
      assert.equal(plain.background, rgb(surfaces.inverse[mode].roles.background), `${mode}: plain`);
      assert.equal(plain.inherited, surfaces.inverse[mode].roles.background, `${mode}: inherited`);
      assert.equal(plain.muted, surfaces.inverse[mode].roles['text-muted'], `${mode}: muted`);
      assert.equal(plain.scheme, 'dark', `${mode}: scheme`);
      for (const selector of ['#nested', '#own']) {
        const local = await read(selector);
        assert.equal(local.background, rgb(surfaces.inverse[other].roles.background), `${mode}: ${selector}`);
        assert.equal(local.scheme, 'dark', `${mode}: ${selector} scheme`);
      }
      assert.equal((await read('#tint')).background, rgb(surfaces.tint[mode].roles.background), `${mode}: tint`);
      assert.equal((await read('#tint')).scheme, mode, `${mode}: tint scheme`);
    }
  } finally {
    await browser.close();
  }
});
