import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  resolve, defaultInputs, contrast, KINDS, STATUS_KINDS, MODES, ROLES, ROLE_TARGETS, STEPS, kindsFor, TINT_CEILING, ramps, hexToOklch,
  solveRole, checkContrast, validateDesignFile, shadowsForSurface, pictureContrast,
} from '../src/generator/index.js';
import { emitCss } from '../src/css/index.js';

const design = async (inputs = defaultInputs()) => ({ inputs, project: {}, resolved: await resolve(inputs) });

test('every kind and mode passes all required pairs for the example, yellow and near-black brands', async () => {
  const example = JSON.parse(await readFile(new URL('../examples/example.design.json', import.meta.url)));
  for (const inputs of [example.inputs, { 'brand-colors': { primary: '#fff066' } }, { 'brand-colors': { primary: '#101016', secondary: '#c76532' } }]) {
    const file = await design(inputs);
    validateDesignFile(file);
    assert.equal(checkContrast(file.resolved), true);
    assert.equal(file.resolved['contrast-check'].status, 'passed');
    const kinds = kindsFor(inputs['brand-colors']);
    assert.deepEqual(Object.keys(file.resolved.surfaces), kinds);
    for (const kind of kinds) for (const mode of MODES) {
      const surface = file.resolved.surfaces[kind][mode];
      assert.deepEqual(Object.keys(surface.roles), ROLES);
      assert.equal(surface.polarity, ['page', 'raised'].includes(kind) || (kind.startsWith('tint') || kind.startsWith('status-')) ? mode : kind === 'picture-light' ? 'light' : 'dark');
      for (const [role, pair] of Object.entries(file.resolved['contrast-check'].matrix[kind][mode].pairs)) {
        assert.equal(pair.target, ROLE_TARGETS[role]);
        assert.ok(pair.passed && pair.ratio >= pair.target, `${kind}/${mode}/${role}`);
        if (!surface.scrim || role === 'button-text' || role === 'button-text-hover' || (role.endsWith('-alt') || ['text-hover', 'link-hover'].includes(role))) assert.equal(pair.ratio, contrast(pair.foreground, pair.background));
      }
    }
    assert.ok((await emitCss(file)).includes('[data-kn-surface="picture-dark"]'));
  }
});

test('recipes preserve rank use; each further brand colour adds its own tint and changes nothing else', async () => {
  const inputs = { 'brand-colors': { primary: '#168b83', secondary: '#c76532' } };
  const two = await resolve(inputs);
  const three = await resolve({ 'brand-colors': { ...inputs['brand-colors'], tertiary: '#8646b0' } });
  for (const kind of KINDS) for (const mode of MODES) {
    const a = two.surfaces[kind][mode], b = three.surfaces[kind][mode];
    assert.match(a.recipes.link, /^primary-/);
    assert.match(a.recipes.accent, /^secondary-/);
    assert.match(a.recipes.focus, /^secondary-/);
    for (const role of ROLES) assert.equal(a.roles[role], b.roles[role]);
  }
  assert.deepEqual(Object.keys(two.surfaces), [...KINDS, ...STATUS_KINDS, 'tint-secondary']);
  assert.deepEqual(Object.keys(three.surfaces), [...KINDS, ...STATUS_KINDS, 'tint-secondary', 'tint-tertiary']);
  assert.deepEqual(Object.keys((await resolve(defaultInputs())).surfaces), [...KINDS, ...STATUS_KINDS]);
  for (const [kind, rank] of [['tint', 'primary'], ['tint-secondary', 'secondary'], ['tint-tertiary', 'tertiary']]) {
    assert.equal(three.surfaces[kind].light.recipes.background, `${rank}-100`);
    assert.equal(three.surfaces[kind].dark.recipes.background, `${rank}-900`);
    assert.equal(three.surfaces[kind].light.recipes.border, `${rank}-200`);
    assert.match(three.surfaces[kind].light.recipes.link, /^primary-/);
    assert.match(three.surfaces[kind].light.recipes.focus, /^secondary-/);
  }
  assert.match((await resolve(defaultInputs())).surfaces.page.light.recipes.focus, /^primary-/);
});

test('solver selects the nearest passing ordered step, records adjustments and leaves impossible recipes failed', async () => {
  const palette = { primary: Object.fromEntries(STEPS.map((step) => [step, '#888888'])) };
  palette.primary[400] = '#000000';
  palette.primary[700] = '#ffffff';
  const ratio = (hex) => contrast(hex, '#ffffff');
  assert.deepEqual(solveRole('primary-500', palette, 4.5, ratio, 'light'), { recipe: 'primary-400', color: '#000000' });
  assert.equal(solveRole('primary-500', palette, 22, ratio, 'light').recipe, 'primary-500');
  assert.equal(solveRole('white', palette, 4.5, ratio, 'light').color, '#ffffff');
  const { resolved } = await design();
  let adjustments = 0;
  for (const kind of KINDS) for (const mode of MODES) {
    const surface = resolved.surfaces[kind][mode];
    assert.deepEqual(resolved['contrast-check'].matrix[kind][mode].adjustments, surface.adjustments);
    for (const [role, { from, to }] of Object.entries(surface.adjustments)) {
      adjustments++;
      assert.equal(from, surface.recipes[role]);
      const [rank, step] = to.split('-');
      if (resolved.ramps[rank]) assert.equal(surface.roles[role], resolved.ramps[rank][step]);
    }
  }
  assert.ok(adjustments > 0);
});

test('picture scrims use both image extrema and the worst ratio, in both modes', async () => {
  const { resolved } = await design();
  for (const kind of ['picture-light', 'picture-dark']) for (const mode of MODES) {
    const surface = resolved.surfaces[kind][mode];
    assert.ok(surface.scrim.opacity > 0 && surface.scrim.opacity < 1);
    for (const [role, pair] of Object.entries(resolved['contrast-check'].matrix[kind][mode].pairs)) {
      if (role === 'button-text' || role === 'button-text-hover' || (role.endsWith('-alt') || ['text-hover', 'link-hover'].includes(role))) {
        assert.deepEqual(pair.samples, {});
        assert.equal(pair.ratio, contrast(pair.foreground, pair.background));
        continue;
      }
      assert.deepEqual(Object.keys(pair.samples), ['#000000', '#ffffff']);
      for (const image of Object.keys(pair.samples)) assert.equal(pair.samples[image], pictureContrast(surface.roles[role], surface.scrim, image));
      assert.equal(pair.ratio, Math.min(...Object.values(pair.samples)));
    }
    const weaker = { ...surface.scrim, opacity: surface.scrim.opacity - 0.01 };
    assert.ok(Object.entries(ROLE_TARGETS).filter(([role]) => !['button-text', 'button-text-hover'].includes(role) && !(role.endsWith('-alt') || ['text-hover', 'link-hover'].includes(role))).some(([role, target]) => Math.min(...['#000000', '#ffffff'].map((image) => pictureContrast(surface.roles[role], weaker, image))) < target));
  }
});

test('exports refuse failed status, a tampered failing pair, altered roles and stale successful reports', async () => {
  for (const tamper of [
    (r) => { r['contrast-check'].status = 'failed'; },
    (r) => { r['contrast-check'].matrix.page.light.pairs.text.ratio = 1; },
    (r) => { r['contrast-check'].matrix.page.light.pairs.text.passed = false; },
    (r) => { r.surfaces.page.light.roles.text = '#ffffff'; },
    (r) => { r['contrast-check'].matrix.page.light.pairs.text.ratio += 0.1; },
    (r) => { r.surfaces['picture-dark'].light.scrim.opacity = 0; },
  ]) {
    const file = await design();
    tamper(file.resolved);
    await assert.rejects(emitCss(file), /contrast check failed/);
  }
  const file = await design();
  delete file.resolved['contrast-check'].matrix.brand.dark.pairs.focus;
  assert.throws(() => validateDesignFile(file), /missing focus/);
});

test('Surface shadows follow polarity and frames take ink before the dark exception', async () => {
  for (const shadowColor of ['default', 'secondary', '#abc']) {
    const inputs = defaultInputs();
    inputs['brand-colors'].secondary = '#c76532';
    inputs.shadow.strength = 50;
    inputs.shadow.color = shadowColor;
    inputs.frame.width = 2;
    const file = await design(inputs);
    validateDesignFile(file);
    for (const kind of KINDS) for (const mode of MODES) {
      const surface = file.resolved.surfaces[kind][mode];
      const colors = { ...inputs['brand-colors'], gray: file.resolved.ramps.gray[500] };
      assert.deepEqual(surface.shadow, shadowsForSurface(inputs.shadow, { polarity: surface.polarity, text: surface.roles.text, colors }));
      assert.equal(surface['frame-color'], shadowColor === 'default' ? surface.roles.text : shadowColor === 'secondary' ? colors.secondary : shadowColor);
    }
    const css = await emitCss(file);
    assert.ok(!css.includes('undefined'));
    if (shadowColor === 'default') assert.match(css, /light-dark\(rgb\([^)]*\), rgb\(0 0 0 \/ 0\.054\)\)/);
  }
});

test('CSS mode selection inherits independently of fixed polarity, and Surface contexts are complete', async () => {
  const css = await emitCss(await design());
  assert.match(css, /:where\(:root\) \{\s*--kn-mode: light;/);
  for (const mode of MODES) assert.ok(css.includes(`:where([data-kn-mode="${mode}"]) {\n  --kn-mode: ${mode};\n  color-scheme: ${mode};`));
  // Each local declaration replaces the inherited mode, at any depth, including
  // the root. A Surface reads that mode directly, never an ancestor selector.
  assert.ok(!/data-kn-mode[^}]+\[data-kn-surface/s.test(css));
  for (const kind of kindsFor({ primary: true })) {
    const body = css.match(new RegExp(`\\[data-kn-surface="${kind}"\\] \\{([^}]+)\\}`))[1];
    for (const role of ROLES) assert.match(body, new RegExp(`--kn-${role}:`));
    for (const name of ['header', 'header-panel', 'panel', 'page', 'box', 'box-lifted']) assert.match(body, new RegExp(`--kn-shadow-${name}:`));
    assert.ok(body.includes('background: var(--kn-background);'));
    assert.ok(body.includes('color: var(--kn-text);'));
    if (['page', 'raised'].includes(kind) || (kind.startsWith('tint') || kind.startsWith('status-'))) {
      assert.match(body, /--kn-polarity: var\(--kn-mode\);/);
      assert.match(body, /color-scheme: var\(--kn-mode\);/);
      assert.match(body, /--kn-background: light-dark\(/);
    } else assert.match(body, new RegExp(`color-scheme: ${kind === 'picture-light' ? 'light' : 'dark'};`));
    if (kind.startsWith('picture-')) assert.match(body, /background-image: linear-gradient\(rgb\(from #[a-f0-9]{6} r g b \/ [\d.]+\)/);
  }
  assert.match(css, /:root,\s*\[data-kn-surface="page"\]/);
  assert.ok([...css.matchAll(/--[a-z][a-z0-9-]*/g)].every(([name]) => name.startsWith('--kn-')));
  assert.ok([...css.matchAll(/\[(data-[a-z-]+)/g)].every(([, name]) => name.startsWith('data-kn-')));
});

test('the tint steps of brand ramps have a chroma ceiling; steps 300 and 800 and the grays keep theirs', () => {
  const loud = ramps({ primary: '#168b83', secondary: '#d9a514' }, 0);
  for (const name of ['primary', 'secondary']) for (const [step, cap] of Object.entries(TINT_CEILING)) {
    assert.ok(hexToOklch(loud[name][step]).C <= cap + 0.002, `${name}-${step}`);
  }
  assert.ok(hexToOklch(loud.primary[300]).C > TINT_CEILING[200]);
  // A loud blue's dark tint is calm, while the brand Surface on step 800 keeps its colour.
  const blue = ramps({ primary: '#1d4ed8' }, 0);
  assert.ok(hexToOklch(blue.primary[900]).C <= TINT_CEILING[900] + 0.002);
  assert.ok(hexToOklch(blue.primary[800]).C > 0.15);
  // A muted seed's light steps lie under the ceiling and do not change.
  const calm = ramps({ primary: '#3a4f7a' }, 0);
  for (const step of [100, 200]) assert.ok(hexToOklch(calm.primary[step]).C < TINT_CEILING[step]);
});

test('the CSS carries every rank tint present, and only those', async () => {
  const css = await emitCss(await design({ 'brand-colors': { primary: '#168b83', secondary: '#c76532' } }));
  assert.ok(css.includes('[data-kn-surface="tint-secondary"]'));
  assert.ok(!css.includes('[data-kn-surface="tint-tertiary"]'));
});
