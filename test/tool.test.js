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
  checkContrast,
} from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import {
  absoluteSteps,
  relativeSteps,
  stepLimits,
  changeStep,
  contrastError,
  snapStrength,
  ratioName,
  ratioText,
  typedRatio,
  typedWidth,
  breakpointLimits,
  lineShare,
  lineWidth,
  spreadLabels,
  placeLabels,
  logosOf,
  withoutSavedLogos,
  withKeptLogos,
  KEPT_LOGO,
  optimalControls,
  clampControls,
  dragControls,
  bothSideBySide,
  DIVIDER,
  sizeAt,
  followShare,
  previewScale,
  shortChapter,
} from '../tool/logic.js';
import { loadDesign, saveDesign } from '../tool/server.js';
import { newDesign, backUp, backupPath } from '../tool/new-design.js';
import { writeDesignMd } from '../tool/design-md.js';
import { designMd, MARKER } from '../src/design-md/index.js';
import { defaultPresentationPath } from '../tool/presentation.js';
import { pictures, flatPictures, PICTURE_SLOTS } from '../presentation/src/samples.js';
import { footerContent } from '../presentation/src/frame.js';
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

test('the default design\'s resolved JSON and core CSS change only on purpose', () => {
  const r = derive(defaultInputs());
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  // The generator's version is the package's, which every release raises, so it is left out of the comparison.
  // Changed on purpose 2026-11-11: dark mode's own steps 850 and 975, for a blacker page and lighter plates, while light
  // mode stays as it was (plates.md). Changed on purpose 2026-11-12: a plate's inner space is step 4 (generator.md), and labels
  // stand three steps below body text (components.md); each Surface stores and writes its translucent opacity (generator.md);
  // the design's tabs pass to resolved and the core writes where their line stands (generator.md).
  assert.equal(
    hash(JSON.stringify({ ...r, 'generator-version': '' })),
    '9c4ce79d34b85524167d7e8aacf8914a22c0a0f38f7725d77627949221c002e2',
  );
  assert.equal(
    hash(coreCss(r)),
    'd7a6a089b609dd765b9512a65075a6cf854901a8ce382c4f95df21ace6e0db71',
  );
});

test('sample photos stay in any design, and only the drawn people follow its colour', () => {
  const inputs = defaultInputs();
  const images = pictures(derive(inputs).ramps);
  inputs['brand-colors'].primary = '#c0392b';
  const other = pictures(derive(inputs).ramps);
  assert.deepEqual([other.hero, other.panorama, other.landscapes], [images.hero, images.panorama, images.landscapes]);
  assert.notDeepEqual(other.people, images.people);
  assert.equal(new Set(images.people).size, 4);
  assert.equal(flatPictures(images).length, PICTURE_SLOTS.length);
  for (const svg of images.people.map((uri) => decodeURIComponent(uri.split(',')[1]))) {
    assert.equal([...svg.matchAll(/<circle\b/g)].length, 1);
    assert.equal([...svg.matchAll(/<path\b/g)].length, 1);
  }
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
    const footer = footerContent({ upper: { surface: 'brand' } }, project).upper.a1.content;
    assert.match(
      footer,
      identity.logo ? /<img .*alt="Example"/ : />Example<\/span><\/span>/,
    );
  }
});

test('document version is optional string metadata and leaves generated values unchanged', async () => {
  const file = {
    format: 1,
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
  validateDesignFile({ format: 1, inputs, project: { 'logo-dark': null }, resolved: r });
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

test('a contrast failure names its pair', () => {
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

test('a new design is plain: one typeface, one colour, no shadows, square corners, a made-up company', async () => {
  const { inputs, project } = await newDesign();
  assert.deepEqual(inputs['brand-colors'], { primary: '#6366F1' });
  assert.equal(inputs.typefaces.main, 'Mona Sans');
  assert.equal(inputs.typefaces.monospace, 'Mona Sans Mono');
  assert.equal(inputs.typefaces.heading, undefined);
  assert.equal(inputs.typefaces.display, undefined);
  assert.deepEqual(inputs.type.roles.display, { weight: 260, 'letter-spacing': -0.03, axes: { wdth: 112, opsz: 100 } });
  assert.deepEqual(inputs.type.roles.label, { weight: 800, 'letter-spacing': 0.06, axes: { wdth: 75, opsz: 0 }, features: ['ss02', 'ss07'] });
  assert.equal(inputs.type['heading-1-role'], undefined);
  assert.equal(inputs.shadow.strength, 0);
  assert.equal(inputs.frame.width, 0);
  assert.equal(inputs['corner-profile'], 0);
  assert.equal(project.name, 'Placeholdr');
  for (const key of ['logo', 'logo-dark']) {
    const svg = Buffer.from(project[key].split(',')[1], 'base64').toString();
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /<text|font-family/);
  }
  const resolved = await resolve(inputs);
  checkContrast(resolved);
  validateDesignFile({ format: 1, inputs, project, resolved });
});

test('the backup sits beside the file and is written only for a real change', () =>
  scratch(async (dir) => {
    assert.equal(backupPath('/x/name.design.json'), '/x/name.design.bak.json');
    assert.equal(backupPath('/x/name'), '/x/name.bak.json');
    const path = join(dir, 'name.design.json');
    const model = await newDesign();
    let writes = 0;
    const count = { beforeWrite: () => { writes += 1; } };
    await saveDesign(path, model, count);
    assert.equal(writes, 1);
    await saveDesign(path, model, count);
    assert.equal(writes, 1);
    await backUp(join(dir, 'nothing.design.json'));
    assert.deepEqual(await readdir(dir), ['name.design.json']);
    const original = await readFile(path, 'utf8');
    await backUp(path);
    assert.equal(await readFile(backupPath(path), 'utf8'), original);
    assert.deepEqual((await readdir(dir)).sort(), ['name.design.bak.json', 'name.design.json']);
  }));

test('a design is written as DESIGN.md: exact tokens, in the format\'s order, and no reference left dangling', async () => {
  const model = await newDesign();
  const file = { ...model, project: { ...model.project, brief: 'A calm site for people planning a visit.' }, resolved: await resolve(model.inputs) };
  const text = designMd(file, 'name.design.json');
  const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.match(front, /^version: "alpha"$/m);
  assert.match(front, /^name: "Placeholdr"$/m);
  assert.match(front, /^  primary: "#6366F1"$/m);
  assert.match(front, new RegExp(`^  page-text: "${file.resolved.surfaces.page.light.roles.text}"$`, 'm'));
  assert.match(front, new RegExp(`^  dark-page-text: "${file.resolved.surfaces.page.dark.roles.text}"$`, 'm'));
  assert.match(front, /^  display:\n    fontFamily: "Mona Sans"\n    fontSize: "3.875rem"\n    fontWeight: 260\n/m);
  assert.match(front, /fontVariation: "\\"wdth\\" 112, \\"opsz\\" 100"/);
  assert.match(front, /fontFeature: "\\"ss02\\", \\"ss07\\""/);
  assert.doesNotMatch(text, /undefined|NaN|\[object/);
  const defined = (group) => new Set([...front.split(`\n${group}:\n`)[1].split(/\n[a-z]+:\n/)[0].matchAll(/^  ([\w-]+):/gm)].map(([, name]) => name));
  for (const [, group, name] of front.matchAll(/"\{(\w+)\.([\w-]+)\}"/g)) assert.ok(defined(group).has(name), `${group}.${name}`);
  const sections = [...body.matchAll(/^## (.+)$/gm)].map(([, name]) => name);
  assert.deepEqual(sections, ['Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts"]);
  assert.match(body, /A calm site for people/);
  assert.match(body, /This design has no shadows/);
  assert.match(body, /\*\*Consent Banner:\*\*/);
  assert.ok(body.includes(MARKER));
});

test('the export for AI goes beside the design file as a ZIP, or as DESIGN.md alone, and never replaces what it did not write', () =>
  scratch(async (dir) => {
    const path = join(dir, 'name.design.json');
    await saveDesign(path, await newDesign());
    const zip = join(dir, 'name-design-md.zip');
    assert.equal(await writeDesignMd(path), zip);
    const archive = await readFile(zip);
    assert.equal(archive.readUInt32LE(0), 0x04034b50);
    assert.ok(archive.includes(MARKER), 'its mark is in the archive\'s comment');
    await writeDesignMd(path);
    await writeFile(zip, 'not ours');
    await assert.rejects(writeDesignMd(path), /not written by/);
    assert.equal(await readFile(zip, 'utf8'), 'not ours');
    assert.equal(await writeDesignMd(path, join(dir, 'DESIGN.md')), join(dir, 'DESIGN.md'));
    assert.match(await readFile(join(dir, 'DESIGN.md'), 'utf8'), /^---\nversion: "alpha"/);
    await writeFile(join(dir, 'DESIGN.md'), '# My own notes\n');
    await assert.rejects(writeDesignMd(path, join(dir, 'DESIGN.md')), /not written by/);
    assert.equal(await readFile(join(dir, 'DESIGN.md'), 'utf8'), '# My own notes\n');
    await assert.rejects(writeDesignMd(path, join(dir, 'design.txt')), /Name a \.zip file/);
    assert.equal(await writeDesignMd(path, join(dir, 'other.zip')), join(dir, 'other.zip'));
  }));

test('presentation names stay beside the input', () => {
  assert.equal(defaultPresentationPath('/neutral/example.design.json', '2026-11-02'), '/neutral/example-presentation-2026-11-02.zip');
});

test('the divider has one optimal position per preview mode and catches there', () => {
  assert.equal(optimalControls('both', 1512, 1440), 540);
  assert.equal(optimalControls('desktop', 1512, 1440), 540);
  assert.equal(optimalControls('phone', 1512, 1440), 1063);
  assert.equal(optimalControls('both', 2560, 1440), 673);
  assert.equal(optimalControls('both', 1512, 768), 540);
  assert.deepEqual(dragControls(552, 'both', 1512, 1440), { width: 540, atOptimal: true });
  assert.deepEqual(dragControls(700, 'both', 1512, 1440), { width: 700, atOptimal: false });
  assert.equal(clampControls(100, 'both', 1512), 490);
  assert.equal(clampControls(5000, 'both', 1512), 863);
  assert.equal(clampControls(5000, 'phone', 1512), 1072);
});

test('Both stands the ends side by side only while the desktop end gets 20rem, and otherwise one above the other', () => {
  // A 1024 px window leaves the preview 525 px beside the narrowest controls: a desktop end of 87 px.
  assert.equal(bothSideBySide(1024 - DIVIDER - clampControls(540, 'both', 1024)), false);
  assert.equal(bothSideBySide(1512 - DIVIDER - optimalControls('both', 1512, 1440)), true);
  assert.equal(bothSideBySide(758), true);
  assert.equal(bothSideBySide(757), false);
  assert.equal(bothSideBySide(758, 1.5), false, 'the end and its margins are in rem, and grow with the text');
});

test('at a larger text size the controls and the preview\'s margins need more room, and the frames\' window widths stay real', () => {
  assert.equal(optimalControls('both', 1600, 1440, 1.25), 675);
  assert.equal(optimalControls('both', 2560, 1440, 1.25), 675);
  assert.equal(optimalControls('both', 2800, 1440, 1.25), 901);
  assert.equal(optimalControls('desktop', 2800, 1440, 1.25), 1311);
  assert.equal(optimalControls('phone', 1600, 1440, 1.25), 1052);
  assert.equal(clampControls(100, 'both', 1600, 1.25), 613);
  assert.deepEqual(dragControls(690, 'both', 1600, 1440, 1.25), { width: 675, atOptimal: true });
});

test('each end of the preview reports what it shows and how much a setting reaches it', () => {
  const scale = { breakpoints: { min: 390, max: 1440 }, ratio: { min: 1.067, max: 1.125 }, 'body-size': { min: 17, max: 19 } };
  assert.equal(Math.round(sizeAt(scale, 10, 390)), 33);
  assert.equal(Math.round(sizeAt(scale, 10, 1440)), 62);
  assert.equal(followShare('narrow', 390, scale), 100);
  assert.equal(followShare('narrow', 1440, scale), 0);
  assert.equal(followShare('wide', 390, scale), 0);
  assert.equal(followShare('wide', 915, scale), 50);
  assert.equal(followShare('wide', 1440, scale), 100);
  assert.equal(previewScale(720, 1440, true), 0.5);
  assert.equal(previewScale(2000, 1440, true), 1);
  assert.equal(previewScale(720, 1440, false), 1);
});

test('Strength catches at 50 and keeps any other value', () => {
  assert.equal(snapStrength(47), 50);
  assert.equal(snapStrength(53), 50);
  assert.equal(snapStrength(46), 46);
  assert.equal(snapStrength(54), 54);
  assert.equal(snapStrength(0), 0);
});

test('zero strength and no target casting a shadow come to the same CSS', () => {
  const inputs = defaultInputs();
  const zero = coreCss(derive(inputs));
  inputs.shadow.strength = 50;
  inputs.shadow.targets = { box: false, header: false, panel: false, page: false };
  assert.equal(coreCss(derive(inputs)), zero);
});

test('a base has the name of its scale, or says Custom, and takes what is typed within its limits', () => {
  assert.equal(ratioName(1.2), 'Minor third');
  assert.equal(ratioName(1.173), 'Custom');
  assert.equal(ratioText(1.25), '1.25');
  assert.equal(ratioText(1.067), '1.067');
  assert.equal(ratioText(2), '2.00');
  assert.equal(typedRatio('1,3', 1.25), 1.3);
  assert.equal(typedRatio(' 1.2345 ', 1.25), 1.235);
  assert.equal(typedRatio('7', 1.25), 2);
  assert.equal(typedRatio('0.5', 1.25), 1);
  assert.equal(typedRatio('wide', 1.25), 1.25);
  assert.equal(typedRatio('', 1.25), 1.25);
});

test('the number line runs from 320 to 1920 px, and the left breakpoint may reach the right one and no further', () => {
  assert.equal(lineShare(320), 0);
  assert.equal(lineShare(1920), 1);
  assert.equal(lineWidth(0.5), 1120);
  assert.equal(lineWidth(-1), 320);
  assert.equal(lineWidth(2), 1920);
  assert.equal(lineWidth(lineShare(1443)), 1440, 'a drag catches at a common width');
  assert.equal(lineWidth(lineShare(1450)), 1450);
  assert.deepEqual(breakpointLimits({ min: 690, max: 1440 }, 'min'), [320, 1440]);
  assert.deepEqual(breakpointLimits({ min: 690, max: 1440 }, 'max'), [690, 1920]);
  assert.equal(typedWidth('768 px', 320, 1920, 390), 768);
  assert.equal(typedWidth('2000', 320, 1440, 390), 1440);
  assert.equal(typedWidth('none', 320, 1920, 390), 390);
});

test('two labels on the line stay centred until they would touch, and keep inside its ends', () => {
  assert.deepEqual(spreadLabels(100, 400, 100, 500), [50, 350]);
  assert.deepEqual(spreadLabels(250, 250, 100, 500), [146, 254], 'on one width they part evenly');
  assert.deepEqual(spreadLabels(0, 0, 100, 500), [0, 108], 'at the left end');
  assert.deepEqual(spreadLabels(500, 500, 100, 500), [292, 400], 'at the right end');
});

test('with one arrow moved only its own label goes, and stops short of the other, which keeps its place', () => {
  const at = ({ left, right }) => [left, right];
  const first = placeLabels(undefined, 100, 400, 100, 500);
  assert.deepEqual(at(first), [50, 350], 'centred');
  assert.equal(placeLabels(first, 100, 400, 100, 500), first, 'nothing moved, nothing changes');
  // The left arrow up to the right one and past where the labels would meet: the right label stays.
  const close = placeLabels(first, 380, 400, 100, 500);
  assert.deepEqual(at(close), [242, 350]);
  assert.deepEqual(at(placeLabels(close, 100, 400, 100, 500)), [50, 350], 'and centred again once there is room');
  // The right arrow down to the left one: the left label stays.
  assert.deepEqual(at(placeLabels(first, 100, 110, 100, 500)), [50, 158]);
  // Both moved, or the line itself: they stand as they would from the start.
  assert.deepEqual(at(placeLabels(first, 250, 250, 100, 500)), [146, 254]);
  assert.deepEqual(at(placeLabels(close, 380, 400, 100, 600)), spreadLabels(380, 400, 100, 600));
  // At any place the two keep clear of each other and inside the line.
  let places = placeLabels(undefined, 100, 400, 100, 500);
  for (const [a, b] of [[0, 400], [0, 0], [500, 500], [500, 500], [0, 500], [250, 500], [250, 260], [240, 260]]) {
    places = placeLabels(places, a, b, 100, 500);
    assert.ok(places.left >= 0 && places.right <= 400 && places.left + 108 <= places.right, `${a} and ${b}: ${at(places)}`);
  }
});

test('a save sent as the page goes away leaves behind the logos the server holds, and the server puts them back', () => {
  const big = `data:image/png;base64,${'A'.repeat(100000)}`;
  const model = { inputs: { a: 1 }, project: { name: 'Example', logo: big, version: '1.0', 'logo-dark': null } };
  const light = withoutSavedLogos(model, logosOf(model.project));
  assert.equal(light.project.logo, KEPT_LOGO);
  assert.equal(light.project['logo-dark'], null, 'a removed logo is news');
  assert.ok(JSON.stringify(light).length < 1000);
  assert.equal(model.project.logo, big, 'the model itself keeps it');
  assert.deepEqual(Object.keys(light.project), Object.keys(model.project));
  assert.deepEqual(withKeptLogos(light, model.project), model);
  const changed = { ...model, project: { ...model.project, logo: `${big}B` } };
  assert.equal(withoutSavedLogos(changed, logosOf(model.project)).project.logo, changed.project.logo, 'one the server does not hold goes along');
  assert.deepEqual(withKeptLogos(changed, model.project), changed, 'and what is not the mark is left as it is');
});

test('a long chapter name keeps its last word in the menu', () => {
  assert.equal(shortChapter('Space and shape'), 'Shape');
  assert.equal(shortChapter('Colour'), 'Colour');
});
