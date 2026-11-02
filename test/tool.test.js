import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile,
  mkdir,
  mkdtemp,
  rm,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve as pathResolve } from 'node:path';
import {
  defaultInputs,
  derive,
  resolve,
  validateInputs,
  validateDesignFile,
} from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import {
  absoluteSteps,
  relativeSteps,
  stepLimits,
  changeStep,
  ratioOptions,
  preset,
  contrastError,
} from '../tool/logic.js';
import { loadDesign, saveDesign } from '../tool/server.js';
import { defaultPresentationPath } from '../tool/presentation.js';
import { pictures, footerBands } from '../presentation/src/samples.js';
import { context } from '../presentation/src/specimens/context.js';
const cache = pathResolve('node_modules/.cache/konzilo-tests');
async function scratch(fn) {
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(join(cache, 'run-'));
  try {
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('legacy resolved JSON and core CSS remain byte-identical without new inputs', () => {
  const r = derive(defaultInputs());
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(
    hash(JSON.stringify(r)),
    '1c052ade285bb37f1930cdb5bc5b4f60c123705baacc2ec2b02613939c59c532',
  );
  assert.equal(
    hash(coreCss(r)),
    '2af33197eb223c8a2e5ce29307cacb23ce00a4b7121238ef868f21387eec6d10',
  );
});

test('pictures use quiet primary and gray ramps regardless of other brand colours', () => {
  const inputs = defaultInputs();
  const r = derive(inputs);
  const images = pictures(r.ramps);
  inputs['brand-colors'].secondary = '#7a3e9d';
  inputs['brand-colors'].tertiary = '#fa6600';
  assert.deepEqual(pictures(derive(inputs).ramps), images);
  for (const kind of ['landscapes', 'portraits', 'people']) {
    assert.equal(new Set(images[kind]).size, 4);
    for (const uri of images[kind]) {
      const svg = decodeURIComponent(uri.split(',')[1]);
      const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
      const allowed =
        kind === 'people'
          ? [100, 200, 300].map((step) => r.ramps.primary[step])
          : [100, 200, 300]
              .flatMap((step) => [r.ramps.primary[step], r.ramps.gray[step]])
              .concat(r.ramps.primary[500]);
      assert.ok(fills.every((fill) => allowed.includes(fill)));
      assert.ok(fills.filter((fill) => fill === r.ramps.primary[500]).length <= 1);
      if (kind === 'people') {
        assert.equal([...svg.matchAll(/<circle\b/g)].length, 1);
        assert.equal([...svg.matchAll(/<path\b/g)].length, 1);
      }
    }
  }
  const dark = decodeURIComponent(images.dark.split(',')[1]);
  const darkFills = [...dark.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
  const allowedDark = [
    r.ramps.primary[800],
    r.ramps.primary[900],
    r.ramps.primary[950],
    r.ramps.gray[900],
  ];
  assert.ok(darkFills.every((fill) => allowedDark.includes(fill)));
});

test('specimen identity uses a labelled logo alone, or the supplied name', () => {
  const resolved = derive(defaultInputs());
  for (const project of [
    { name: 'Example' },
    { name: 'Example', logo: 'data:image/svg+xml,logo' },
    { name: 'Example', 'logo-dark': 'data:image/svg+xml,dark' },
  ]) {
    const { identity } = context(project, resolved);
    assert.equal(identity.label, 'Example');
    assert.equal(identity.name, identity.logo ? undefined : 'Example');
    const footer = footerBands(project)[0].cells[0].content;
    assert.match(
      footer,
      identity.logo ? /<img .*alt="Example"/ : />Example<\/p>/,
    );
  }
});

test('document version is optional string metadata and leaves generated values unchanged', async () => {
  const file = {
    inputs: defaultInputs(),
    project: {},
    resolved: await resolve(defaultInputs()),
  };
  validateDesignFile(file);
  file.project.version = '2.4-review';
  validateDesignFile(file);
  assert.deepEqual(file.resolved, await resolve(file.inputs));
  file.project.version = 2.4;
  assert.throws(() => validateDesignFile(file), /version/);
});

test('first-heading choices follow, override and tune only their own role', async () => {
  const inputs = defaultInputs();
  inputs.typefaces.main = 'Mona Sans';
  inputs.typefaces['heading-1'] = 'Georgia, serif';
  let r = derive(inputs);
  assert.equal(r.typefaces['heading-1'], 'Georgia, serif');
  assert.equal(r.type['heading-1'].features, undefined);
  assert.ok(r.type['heading-2'].features);
  assert.match(coreCss(r), /--kn-typeface-heading-1: Georgia, serif;/);
  inputs.typefaces.main = 'Georgia, serif';
  inputs.typefaces['heading-1'] = 'Mona Sans';
  r = derive(inputs);
  assert.ok(r.type['heading-1'].features);
  assert.equal(r.type['heading-2'].features, undefined);
  inputs.type['heading-1-color'] = 'accent';
  r = await resolve(inputs);
  assert.match(
    coreCss(r),
    /\[data-kn-surface\] \{ --kn-text-heading-1: var\(--kn-accent\); \}/,
  );
  validateDesignFile({ inputs, project: { 'logo-dark': null }, resolved: r });
  inputs.type['heading-1-color'] = 'literal';
  assert.throws(() => validateInputs(inputs), /heading-1-color/);
});

test('absolute steppers retain every other style and obey both relative neighbours', () => {
  const steps = defaultInputs().type.steps,
    absolute = absoluteSteps(steps);
  assert.deepEqual(relativeSteps(absolute), steps);
  for (const key of Object.keys(steps)) {
    const [min, max] = stepLimits(steps, key);
    for (const value of [min - 5, min, max, max + 5]) {
      const changed = changeStep(steps, key, value),
        a = absoluteSteps(changed);
      assert.ok(a[key] >= min && a[key] <= max);
      for (const other of Object.keys(steps))
        if (other !== key) assert.equal(a[other], absolute[other]);
      for (const n of Object.values(changed)) assert.ok(n >= 0 && n <= 12);
    }
  }
});

test('presets are independent choices, and an unlisted ratio is retained', () => {
  const inputs = defaultInputs();
  inputs.type.ratio.max = 1.173;
  inputs.frame.width = 2;
  for (const key of ['one', 'mono', 'serif', 'display']) {
    const p = preset(key, inputs);
    assert.equal(p.type.ratio.max, 1.173);
    assert.equal(p.frame.width, 2);
  }
  assert.equal(preset('mono', inputs).typefaces.monospace, 'Red Hat Mono');
  assert.equal(preset('mono', inputs).type.label, 'monospace');
  assert.equal(preset('serif', inputs).typefaces.heading, 'Mona Sans');
  assert.equal(preset('display', inputs).typefaces.display, 'Georgia, serif');
  assert.deepEqual(ratioOptions(1.173).at(-1), [1.173, 'Custom (1.173)']);
  assert.equal(ratioOptions(1.25).length, 8);
  assert.equal(
    contrastError({
      status: 'failed',
      matrix: {
        page: {
          light: { pairs: { text: { passed: false, ratio: 2, target: 4.5 } } },
        },
      },
    }),
    'page, light: text 2.00:1; needs 4.5:1.',
  );
});

test('missing files start with Mona Sans and saves include fresh validated output', () =>
  scratch(async (dir) => {
    const path = join(dir, 'example.design.json');
    const model = await loadDesign(path);
    assert.equal(model.inputs.typefaces.main, 'Mona Sans');
    assert.equal(model.project.version, '1.0');
    assert.equal((await readdir(dir)).length, 0);
    await saveDesign(path, model);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    validateDesignFile(saved);
    assert.deepEqual(saved.resolved, await resolve(model.inputs));
    assert.equal((await readdir(dir)).length, 1);
  }));

test('presentation names stay beside the input', () => {
  assert.equal(defaultPresentationPath('/neutral/example.design.json', '2026-11-02'), '/neutral/example-presentation-2026-11-02.zip');
});
