import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile,
  mkdir,
  mkdtemp,
  rm,
  stat,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve as pathResolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@astrojs/compiler-rs';
import { chromium } from 'playwright-core';
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
import {
  defaultPdfPath,
  exactPageSize,
  prepareDocument,
  inspectDocument,
} from '../tool/pdf.js';
import { componentPages, pageList } from '../presentation/src/catalog.js';
import { pictures, footerBands } from '../presentation/src/samples.js';
import { context } from '../presentation/src/specimens/context.js';
const exec = promisify(execFile);
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
        assert.equal([...svg.matchAll(/<ellipse\b/g)].length, 1);
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

test('PDF names stay beside the input; exact paper normalization preserves byte offsets', () => {
  assert.equal(
    defaultPdfPath('/neutral/example.design.json', '2026-11-02'),
    '/neutral/example-design-system-2026-11-02.pdf',
  );
  const source = Buffer.from('/MediaBox [0 0 1080 607.91998]\n/Offset 123');
  const output = exactPageSize(source);
  assert.equal(output.length, source.length);
  assert.match(output.toString(), /1080 607.5 +\]/);
  assert.throws(
    () => exactPageSize(Buffer.from('/MediaBox [0 0 300 200]')),
    /Unexpected/,
  );
});

test('document catalogue covers every Build now component and the whole frame', async () => {
  const spec = await read('docs/spec/components.md');
  const table = spec.split('## Build now')[1].split('## Not now')[0];
  const names = [...table.matchAll(/^\| [^|]+ \| ([^|]+) \|/gm)]
    .map((m) => m[1].trim())
    .filter((n) => n !== 'Component');
  for (const name of [
    ...names,
    'Header',
    'Footer',
    'Page',
    'Band',
    'Reading Area',
  ])
    assert.ok(
      componentPages.some(([, names]) => names.includes(name)),
      `Missing ${name}`,
    );
  const list = pageList(derive(defaultInputs()));
  const twoColours = defaultInputs();
  twoColours['brand-colors'].secondary = '#b66c32';
  assert.ok(
    pageList(derive(twoColours)).length >= 55 &&
      pageList(derive(twoColours)).length <= 65,
  );
  assert.deepEqual(
    list.slice(0, 3).map((p) => p.id),
    ['cover', 'contents', 'overview'],
  );
  assert.equal(list.at(-1).id, 'next');
});

test('new source folders use generic content and keep document prose in copy or samples', async () => {
  async function walk(path) {
    const entries = await readdir(path, { withFileTypes: true });
    return (
      await Promise.all(
        entries
          .filter((e) => !['dist', '.astro', 'node_modules'].includes(e.name))
          .map((e) =>
            e.isDirectory() ? walk(join(path, e.name)) : join(path, e.name),
          ),
      )
    ).flat();
  }
  for (const path of await walk('tool').then(async (files) =>
    files.concat(await walk('presentation')),
  )) {
    const text = await readFile(path, 'utf8');
    assert.doesNotMatch(
      text,
      /\/Users\/|(?:[A-Z][a-z]+\s+){1,3}(?:Ltd|LLC|Inc\.|GmbH)\b/,
      path,
    );
    assert.doesNotMatch(
      text,
      /Juniper Atlas|Meadow Media|Garden Counts|River Charts/,
      path,
    );
  }
  const page = (await read('presentation/src/pages/index.astro'))
    .split('---')
    .slice(2)
    .join('---');
  const ast = parse(page).ast;
  function check(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText' && /[A-Za-z]/.test(node.value))
      assert.match(
        node.value.trim(),
        /^--kn-/,
        `Hardcoded document prose: ${node.value}`,
      );
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(check);
      else if (value && typeof value === 'object') check(value);
    }
  }
  check(ast);
  const copy = JSON.parse(await read('presentation/copy.json'));
  assert.equal(copy.lang, 'en');
  assert.ok(Object.values(copy).every((value) => typeof value === 'string'));
  assert.match(copy['buttons.title'], /four states/);
  assert.doesNotMatch(copy['buttons.text'] + copy['links.text'], /disabled/);
  assert.equal(
    JSON.parse(await read('examples/example.design.json')).project.name,
    'Example',
  );
});

test('CLI rejects malformed tool and PDF arguments', async () => {
  for (const args of [
    ['pdf'],
    ['pdf', 'examples/example.design.json', '--unknown'],
    ['tool', '--port', 'invalid'],
    ['tool', '--unknown'],
  ])
    await assert.rejects(
      exec(process.execPath, ['bin/konzilo-design.js', ...args]),
      (error) => Boolean(error.stderr),
    );
});

test(
  'PDF command builds example, stress and primary-only designs without overflow',
  { timeout: 120000 },
  () =>
    scratch(async (dir) => {
      for (const [input, name] of [
        ['examples/example.design.json', 'example'],
        ['test/fixtures/stress.design.json', 'stress'],
        [join(dir, 'primary-only.design.json'), 'primary-only'],
      ]) {
        if (name === 'primary-only') {
          const model = JSON.parse(await read('examples/example.design.json'));
          delete model.inputs['brand-colors'].secondary;
          delete model.inputs['brand-colors'].tertiary;
          model.inputs.typefaces.main = 'Mona Sans';
          await writeFile(input, JSON.stringify(model));
        }
        const output = join(dir, `${name}.pdf`);
        const { stdout } = await exec(
          process.execPath,
          ['bin/konzilo-design.js', 'pdf', input, '-o', output],
          { maxBuffer: 5 * 1024 * 1024 },
        );
        const report = JSON.parse(stdout);
        assert.equal(report.path, output);
        assert.deepEqual(
          report.pages.find((p) => p.id === 'responsive').viewports,
          [390],
        );
        assert.deepEqual(report.warnings, []);
        assert.ok((await stat(output)).size > 50000);
        for (const [, names] of componentPages)
          for (const name of names)
            assert.ok(
              report.pages.some((p) => p.catalog.includes(name)),
              name,
            );
        if (name !== 'stress')
          assert.deepEqual(report.pages.filter((p) => p.zoom !== 1), []);
        try {
          const { stdout: info } = await exec('pdfinfo', [output]);
          assert.match(info, /Tagged:\s+yes/);
          assert.match(info, /Page size:\s+1080 x 607.5 pts/);
          assert.equal(
            Number(info.match(/Pages:\s+(\d+)/)[1]),
            report.pages.length,
          );
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        try {
          const { stdout: fonts } = await exec('pdffonts', [output]);
          const lines = fonts.trim().split('\n').slice(2);
          assert.ok(lines.length > 0);
          for (const line of lines) assert.match(line, /\s+yes\s+yes\s+/);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        try {
          const { stdout: xml } = await exec(
            'pdftohtml',
            ['-xml', '-stdout', output],
            { maxBuffer: 15 * 1024 * 1024 },
          );
          const outline = xml.slice(xml.indexOf('<outline>'));
          assert.equal(
            [...outline.matchAll(/<item page=/g)].length,
            report.pages.length,
          );
          assert.doesNotMatch(
            outline,
            />Light mode<|>A practical partnership</,
          );
          const text = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
            .map((m) => m[1].replace(/<[^>]+>/g, ''))
            .join('');
          assert.ok(
            text.includes('Good decisions begin with clear information.'),
            'Component text must stay vector and extractable',
          );
          assert.ok(/Version\s+1\.0/i.test(text), 'Default document version');
          assert.ok(!/Version\s+0\.2\.0/i.test(text), 'No generator version');
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
      }
    }),
);

test(
  'copy overrides set language, fall back per key and reject unknown keys',
  { timeout: 60000 },
  () =>
    scratch(async (dir) => {
      const design = join(dir, 'example.design.json');
      const model = JSON.parse(await read('examples/example.design.json'));
      model.inputs['corner-profile'] = 30;
      model.inputs.frame.width = 1.5;
      model.inputs.typefaces.main = 'Mona Sans';
      model.inputs['brand-colors'].secondary = '#7a3e9d';
      model.inputs.shadow.strength = 50;
      model.inputs.shadow.hardness = 20;
      model.project.version = '2.4-review';
      model.project.logo = 'logo.svg';
      model.project['logo-dark'] = 'logo-dark.svg';
      await writeFile(design, JSON.stringify(model));
      const light =
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#123456"/></svg>';
      const dark = light.replace('#123456', '#ffffff');
      await writeFile(join(dir, 'logo.svg'), light);
      await writeFile(join(dir, 'logo-dark.svg'), dark);
      await writeFile(
        join(dir, 'example.design.copy.json'),
        JSON.stringify({ lang: 'en-GB', 'next.title': 'Review the next step' }),
      );
      const { buildPresentation } = await import('../tool/build.js');
      let built = await buildPresentation({
        designFile: design,
        output: join(dir, 'html'),
        date: '2026-11-02',
      });
      assert.match(built.html, /<html lang="en-GB"/);
      assert.match(built.html, /Review the next step/);
      assert.match(built.html, /A clear direction/);
      assert.ok(built.html.includes(Buffer.from(dark).toString('base64')));
      assert.ok(built.html.includes(Buffer.from(light).toString('base64')));
      assert.ok(built.html.includes('2 November 2026'));
      assert.ok(built.html.includes('3.6 px'));
      assert.ok(built.html.includes('1.5 px'));
      assert.doesNotMatch(built.html, /src="logo(?:-dark)?\.svg"/);
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 810 },
        });
        await page.goto(pathToFileURL(join(built.directory, 'index.html')).href);
        await prepareDocument(page);
        const report = await inspectDocument(page);
        assert.deepEqual(report.warnings, []);
        assert.deepEqual(
          report.pages.filter((p) => p.zoom !== 1),
          [],
        );
        assert.match(
          await page.locator('#shadow').innerText(),
          /discreet, with soft edges/,
        );
        const feet = await page.locator('.page-foot').allTextContents();
        assert.ok(feet.every((text) =>
          text.includes('Version 2.4-review') && !text.includes('0.2.0'),
        ));
        assert.match(
          await page.locator('#cover').innerText(),
          /Version 2\.4-review/i,
        );
        for (const frame of page.frames().slice(1)) {
          const id = await frame.locator('body').getAttribute('data-specimen');
          if (['headers', 'header-a-search'].includes(id)) {
            assert.equal(await frame.locator('.kn-header-name').count(), 0);
            assert.equal(
              await frame.locator('.kn-header-identity').first()
                .getAttribute('aria-label'),
              'Example',
            );
          }
          if (['header-a-search', 'consent-settings'].includes(id))
            assert.equal(await frame.locator(':focus-visible').count(), 0);
          if (['buttons', 'links'].includes(id)) {
            assert.equal(await frame.locator('.is-disabled').count(), 0);
            assert.equal(
              await frame.locator('.sample-state-row > div').first()
                .evaluate((n) => n.parentElement.children.length),
              4,
            );
            assert.ok(await frame.locator('.is-focus').count() > 0);
            assert.equal(
              await frame.locator('.is-focus').first()
                .evaluate((n) => getComputedStyle(n).outlineStyle),
              'solid',
            );
          }
          if (id === 'band') {
            assert.deepEqual(
              await frame.locator('.kn-band').evaluateAll((nodes) =>
                nodes.map((n) => n.dataset.knSurface)),
              ['tint', 'brand', 'inverse'],
            );
            const height = await frame.locator('.sample-bands')
              .evaluate((n) => n.getBoundingClientRect().height);
            assert.equal(Math.round(height), 562);
          }
          if (id === 'callout') {
            const boxes = await frame.locator('.kn-callout').evaluateAll((nodes) =>
              nodes.map((n) => ({ x: n.offsetLeft, y: n.offsetTop })),
            );
            assert.equal(boxes[0].y, boxes[4].y);
            assert.ok(boxes[0].x < boxes[4].x);
            assert.ok(boxes[3].y > boxes[0].y);
          }
          if (id === 'form-states') {
            assert.equal(
              await frame.locator('input:disabled,select:disabled').count(),
              3,
            );
            const select = frame.locator('select:disabled');
            const normal = frame.locator('select').first();
            assert.notDeepEqual(
              await select.screenshot(),
              await normal.screenshot(),
            );
          }
        }
        const closing = await page.locator('#next .closing ol').boundingBox();
        const stage = await page.locator('#next [data-fit-area]').boundingBox();
        assert.ok(closing.y > stage.y + stage.height / 2);
        // A design may supply only the dark-background logo.
        model.project.logo = null;
        await writeFile(design, JSON.stringify(model));
        const darkOnly = await buildPresentation({
          designFile: design,
          output: join(dir, 'dark-only'),
        });
        await page.goto(pathToFileURL(join(darkOnly.directory, 'index.html')).href);
        await prepareDocument(page);
        const footer = page.frameLocator('#footer-simple iframe');
        assert.equal(await footer.locator('.kn-footer img').count(), 2);
        assert.equal(
          await footer.locator('.kn-footer [data-kn-type="heading-3"]').count(),
          0,
        );
      } finally {
        await browser.close();
      }
      await writeFile(
        join(dir, 'example.design.copy.json'),
        JSON.stringify({ 'unknown.title': 'Invalid' }),
      );
      await assert.rejects(
        buildPresentation({ designFile: design, output: join(dir, 'bad') }),
        /Unknown copy key: unknown.title/,
      );
    }),
);

test(
  'headless tool keeps control boxes still while dragging, saves and creates a PDF',
  { timeout: 120000 },
  () =>
    scratch(async (dir) => {
      const path = join(dir, 'tool.design.json');
      const child = spawn(
        process.execPath,
        ['bin/konzilo-design.js', 'tool', path, '--no-open', '--port', '0'],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let browser;
      let stderr = '';
      child.stderr.on('data', (chunk) => (stderr += chunk));
      const exited = new Promise((done) => child.once('exit', done));
      try {
        const url = await new Promise((done, fail) => {
          let text = '';
          child.stdout.on('data', (chunk) => {
            text += chunk;
            const match = text.match(/http:\/\/127\.0\.0\.1:\d+/);
            if (match) done(match[0]);
          });
          child.on('error', fail);
          child.on('exit', (code) =>
            fail(new Error(`Tool exited ${code}: ${stderr}`)),
          );
        });
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({
          viewport: { width: 1400, height: 1000 },
        });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(url);
        await page.waitForFunction(() =>
          document
            .getElementById('status')
            .textContent.startsWith('Contrast passed'),
        );
        assert.deepEqual(errors, []);
        const version = page.locator('[data-path="project.version"]');
        assert.equal(await version.inputValue(), '1.0');
        await version.fill('3.1');
        assert.ok(
          (await page
            .locator('.toolbar')
            .evaluate((node) => node.clientHeight)) <= 140,
        );
        assert.ok(
          (await page
            .locator('.controls')
            .evaluate((node) => node.scrollHeight)) < 3400,
        );
        const hex = page.locator('[data-hex="inputs.brand-colors.primary"]');
        await hex.fill('#516a81');
        assert.equal(
          await page
            .locator('[data-path="inputs.brand-colors.primary"]')
            .inputValue(),
          '#516a81',
        );
        const fontSelect = page.locator('[data-font="heading"]');
        const fontBox = await fontSelect.boundingBox();
        const followingRow = await page
          .locator('[data-font="heading-1"]')
          .boundingBox();
        await fontSelect.selectOption('other');
        assert.deepEqual(await fontSelect.boundingBox(), fontBox);
        assert.deepEqual(
          await page.locator('[data-font="heading-1"]').boundingBox(),
          followingRow,
        );
        assert.equal(
          await page.locator('[data-other="heading"]').isVisible(),
          true,
        );
        await fontSelect.selectOption('');
        assert.equal(
          await page.locator('[data-other="heading"]').isVisible(),
          false,
        );
        const logo = {
          name: 'logo.svg',
          mimeType: 'image/svg+xml',
          buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#345fa0"/></svg>',
          ),
        };
        await page.locator('[data-logo="logo"]').setInputFiles(logo);
        await page.waitForFunction(
          () =>
            document.querySelector('[data-logo-status="logo"]').textContent ===
            'Logo embedded',
        );
        await page.locator('[data-remove="logo"]').click();
        assert.equal(await page.locator('[data-logo="logo"]').inputValue(), '');
        await page
          .frameLocator('#preview')
          .locator('.kn-header-name')
          .waitFor({ state: 'visible' });
        await page.locator('[data-logo="logo"]').setInputFiles(logo);
        await page.waitForFunction(
          () =>
            document.querySelector('[data-logo-status="logo"]').textContent ===
            'Logo embedded',
        );
        await page
          .locator('[data-logo="logo-dark"]')
          .setInputFiles({ ...logo, name: 'logo-dark.svg' });
        await page.waitForFunction(
          () =>
            document.querySelector('[data-logo-status="logo-dark"]')
              .textContent === 'Logo embedded',
        );
        const identity = page
          .frameLocator('#preview')
          .locator('.kn-header-identity');
        assert.equal(await identity.locator('.kn-header-name').count(), 0);
        assert.equal(await identity.getAttribute('aria-label'), 'Example');
        await page
          .locator('[data-path="inputs.brand-colors.primary"]')
          .evaluate((c) => {
            c.value = '#345fa0';
            c.dispatchEvent(new Event('input', { bubbles: true }));
          });
        await page.locator('[data-path="shadow-enabled"]').check();
        const slider = page.locator('[data-path="inputs.corner-profile"]');
        await slider.scrollIntoViewIfNeeded();
        const boxes = () =>
          page
            .locator('.controls input,.controls select,.controls button')
            .evaluateAll((nodes) =>
              nodes.map((n) => {
                const b = n.getBoundingClientRect();
                return { x: b.x, y: b.y, width: b.width, height: b.height };
              }),
            );
        const pane = () =>
          page.evaluate(() => ({
            scroll: window.scrollY,
            height: document.querySelector('aside').clientHeight,
            toolbar: document.querySelector('.toolbar').getBoundingClientRect()
              .top,
          }));
        assert.deepEqual(await pane(), { scroll: 0, height: 1000, toolbar: 0 });
        const before = await boxes();
        const box = await slider.boundingBox();
        await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, {
          steps: 12,
        });
        const after = await boxes();
        await page.mouse.up();
        assert.deepEqual(after, before);
        assert.deepEqual(await pane(), { scroll: 0, height: 1000, toolbar: 0 });
        const response = page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/pdf') && r.request().method() === 'POST',
        );
        await page.locator('#pdf').click();
        const report = await (await response).json();
        assert.deepEqual(report.warnings, []);
        assert.ok((await stat(report.path)).size > 50000);
        await page.waitForFunction(() =>
          document.getElementById('result').textContent.includes('PDF ready'),
        );
        const saved = JSON.parse(await readFile(path, 'utf8'));
        assert.equal(saved.inputs['brand-colors'].primary, '#345fa0');
        assert.ok(saved.inputs['corner-profile'] > 70);
        assert.equal(saved.inputs.typefaces.main, 'Mona Sans');
        assert.equal(saved.inputs.shadow.strength, 50);
        assert.equal(saved.inputs.shadow.hardness, 20);
        assert.equal(saved.project.version, '3.1');
        assert.match(saved.project.logo, /^data:image\/svg\+xml;base64,/);
        assert.match(
          saved.project['logo-dark'],
          /^data:image\/svg\+xml;base64,/,
        );
        assert.deepEqual(errors, []);
        const foreign = await fetch(url + '/api/save', {
          method: 'POST',
          headers: {
            Origin: 'http://example.invalid',
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        assert.equal(foreign.status, 403);
      } finally {
        await browser?.close();
        child.kill('SIGTERM');
        await exited;
      }
    }),
);
