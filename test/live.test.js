import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { derive, resolve, defaultInputs, MODES, ROLES, contrast, checkContrast, validateDesignFile } from '../src/generator/index.js';
import { coreCss, emitCss } from '../src/css/index.js';

test('synchronous derivation matches resolution except for its fingerprint, without Web Crypto', async () => {
  const inputs = defaultInputs();
  const resolved = await resolve(inputs);
  const { 'inputs-fingerprint': fingerprint, ...values } = resolved;
  assert.ok(fingerprint);
  assert.deepEqual(derive(inputs), values);
  assert.equal(coreCss(resolved), await emitCss({ format: 1, inputs, project: {}, resolved }));
  assert.match(coreCss(resolved), /@layer kn-core, kn-base, kn-components;\s*@layer kn-core \{/);
  const script = `import { derive, defaultInputs } from './src/generator/index.js';
    import { coreCss } from './src/css/index.js';
    Object.defineProperty(globalThis, 'crypto', { value: undefined });
    if (!coreCss(derive(defaultInputs())).includes('--kn-button-text:')) throw new Error('Missing button role');`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  const space = derive(inputs).space;
  assert.deepEqual(space.roles.plate, space.steps[6]);
  assert.notEqual(space.roles.plate, space.roles['column-gap']);
});

test('fixed button recipes and all three contrast pairs pass every kind and mode across varied seeds and ranks', async () => {
  for (const primary of ['#0f766e', '#facc15', '#1d4ed8', '#dc2626', '#111111']) for (const ranked of [false, true]) {
    const inputs = { 'brand-colors': { primary, ...(ranked ? { secondary: '#c76532', tertiary: '#8646b0' } : {}) } };
    const resolved = await resolve(inputs);
    validateDesignFile({ format: 1, inputs, project: {}, resolved });
    assert.equal(checkContrast(resolved), true);
    for (const [kind, modes] of Object.entries(resolved.surfaces)) for (const mode of MODES) {
      const surface = modes[mode];
      assert.deepEqual(Object.keys(surface.roles), ROLES);
      const dark = surface.polarity === 'dark';
      const recipes = { 'button-background': dark ? 'white' : 'primary-700', 'button-text': dark ? 'primary-700' : 'white', 'button-background-hover': dark ? 'primary-100' : 'primary-800' };
      for (const [role, recipe] of Object.entries(recipes)) {
        assert.equal(surface.recipes[role], recipe, `${primary}/${kind}/${mode}/${role}`);
        assert.equal(surface.roles[role], recipe === 'white' ? '#ffffff' : resolved.ramps.primary[recipe.split('-')[1]]);
        assert.equal(surface.adjustments[role], undefined);
      }
      const pairs = resolved['contrast-check'].matrix[kind][mode].pairs;
      for (const [name, background, target] of [['button-background', 'background', 3], ['button-text', 'button-background', 4.5], ['button-text-hover', 'button-background-hover', 4.5]]) {
        const pair = pairs[name];
        assert.equal(pair.foreground, surface.roles[name === 'button-text-hover' ? 'button-text' : name]);
        assert.equal(pair.background, surface.roles[background]);
        assert.equal(pair.target, target);
        assert.ok(pair.passed && pair.ratio >= target);
        if (surface.scrim && name === 'button-background') assert.equal(Object.keys(pair.samples).length, 2);
        else { assert.deepEqual(pair.samples, {}); assert.equal(pair.ratio, contrast(pair.foreground, pair.background)); }
      }
    }
  }
});

test('export refuses edited button fills and text, failed pairs and stale button reports', async () => {
  for (const tamper of [
    (r) => { r.surfaces.page.light.roles['button-background'] = '#ffffff'; },
    (r) => { r.surfaces.accent.dark.roles['button-text'] = '#ffffff'; },
    (r) => { r.surfaces.page.light.roles['button-background-hover'] = r.ramps.primary[900]; },
    (r) => { r['contrast-check'].matrix.page.light.pairs['button-text-hover'].ratio += 0.01; },
    (r) => { delete r['contrast-check'].matrix.brand.dark.pairs['button-background']; },
  ]) {
    const inputs = defaultInputs();
    const file = { format: 1, inputs, project: {}, resolved: await resolve(inputs) };
    tamper(file.resolved);
    await assert.rejects(emitCss(file), /contrast check failed|missing button-background/);
  }
});
