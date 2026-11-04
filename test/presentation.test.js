import test from 'node:test';
import { derive } from '../src/generator/index.js';
import { shippedIn } from '../src/fonts/catalog.js';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve as pathResolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import { withDefaults } from '../src/generator/defaults.js';
import { layoutFooter } from '../src/components/footer.js';
import { footerHtml } from '../src/components/footer-html.js';
import { footerProps } from '../presentation/src/frame.js';
import { createPresentation } from '../tool/presentation.js';
import { pageList, componentPages, ids } from '../presentation/src/catalog.js';
import { startTool } from '../tool/server.js';
import { validateDesignFile, resolve } from '../src/generator/index.js';
const exec = promisify(execFile);
const root = pathResolve('node_modules/.cache/presentation-tests');
const copy = JSON.parse(await readFile('presentation/copy.json', 'utf8'));

function extractZip(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.equal(bytes.readUInt16LE(8), 8);
  const length = bytes.readUInt16LE(26);
  const offset = 30 + length + bytes.readUInt16LE(28);
  const filename = bytes.subarray(30, 30 + length).toString('utf8');
  const html = inflateRawSync(bytes.subarray(offset, offset + bytes.readUInt32LE(18))).toString('utf8');
  assert.equal(Buffer.byteLength(html), bytes.readUInt32LE(22));
  return { filename, html };
}

async function navigate(page, id) {
  await page.evaluate((id) => { location.hash = id; }, id);
  await page.waitForFunction((id) => document.querySelector('.document-page.is-current')?.id === id, id);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  assert.equal(await page.evaluate(() => scrollY), 0);
}

async function readyFrame(page, id) {
  const frame = page.locator(`[data-specimen-frame="${id}"]`);
  await frame.waitFor({ state: 'visible' });
  await page.waitForFunction((id) => {
    const frame = document.querySelector(`[data-specimen-frame="${id}"]`);
    return frame?.contentDocument?.querySelector('.sample-root') && frame.contentDocument.readyState === 'complete';
  }, id);
  const child = await (await frame.elementHandle()).contentFrame();
  await child.evaluate(() => document.fonts.ready);
  return child;
}

test('catalogue covers the specification and has the requested order', async () => {
  const spec = await readFile('docs/spec/components.md', 'utf8');
  const table = spec.split('## Build now')[1].split('## Not now')[0];
  const names = [...table.matchAll(/^\| [^|]+ \| ([^|]+) \|/gm)].map((match) => match[1].trim()).filter((name) => name !== 'Component');
  for (const name of [...names, 'Page', 'Band', 'Reading Area', 'Header', 'Footer']) {
    assert.ok(componentPages.some(([, names]) => names.includes(name)), name);
  }
  assert.deepEqual(pageList().map((page) => page.id), [
    'start', 'colour-scale', 'colour-together', 'main-typeface', 'type-scale',
    'other-typefaces', 'typography-use', 'space', 'corners', 'shadow',
    'header', 'footer', 'page', 'breadcrumbs', 'opening', 'sections', 'text', 'buttons',
    'cards', 'media', 'finding', 'forms', 'details', 'comments',
  ]);
});

test('copy has no unused keys and all values are strings', async () => {
  const sources = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (['dist', '.scratch', '.astro'].includes(entry.name)) continue;
      const target = join(path, entry.name);
      if (entry.isDirectory()) await visit(target);
      else sources.push(await readFile(target, 'utf8'));
    }
  }
  await visit('presentation/src');
  sources.push(await readFile('tool/presentation.js', 'utf8'), await readFile('tool/pages.js', 'utf8'));
  const source = sources.join('\n');
  const dynamicKeys = new Set([
    ...pageList().flatMap((page) => [`${page.id}.title`, `${page.id}.lead`]),
    ...[...new Set(pageList().map((page) => page.chapter))].map((name) => `chapter.${name}`),
    ...ids.map((name) => `specimen.${name}`),
    ...['page', 'raised', 'tint', 'tint-secondary', 'tint-tertiary', 'brand', 'inverse', 'accent', 'picture-light', 'picture-dark', 'status-info', 'status-success', 'status-warning', 'status-error'].map((name) => `surface.${name}`),
    ...['primary', 'secondary', 'tertiary', 'gray'].map((name) => `colour.${name}`),
    ...['primary', 'secondary', 'tertiary'].map((name) => `colour.${name}.job`),
    ...['display', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6', 'lead', 'body', 'small', 'label', 'before', 'after'].map((name) => `type.${name}`),
    ...['main', 'heading', 'heading-1', 'display', 'label', 'monospace'].map((name) => `role.${name}`),
    ...[100, 200, 300, 400, 500, 600, 700, 800, 900].map((name) => `weight.${name}`),
    ...[1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.6, 1.618, 1.667, 1.778, 1.875, 2].map((name) => `scale.${name}`),
    ...['default', 'hover', 'focus', 'active', 'disabled'].map((name) => `state.${name}`),
    ...['box', 'box-lifted', 'header', 'header-panel', 'panel', 'page'].flatMap((name) => [`shadow.${name}`, `shadow.${name}.job`]),
    ...['radius', 'shadow', 'layout', 'light', 'dark', 'pair', 'ratio', 'target'].map((name) => `details.${name}`),
  ]);
  for (const [key, value] of Object.entries(copy)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(source.includes(`copy.${key}`) || source.includes(`'${key}'`) || source.includes(`"${key}"`) || dynamicKeys.has(key), `Unused copy key: ${key}`);
  }
});

test('project prose is escaped and never changes resolved output', async () => {
  const inputs = JSON.parse(await readFile('examples/example.design.json', 'utf8')).inputs;
  const resolved = await resolve(inputs);
  const project = { introduction: '<script>alert(1)</script>', contact: { name: 'A reader', email: 'review@example.invalid' }, explanations: { colour: 'First paragraph.\n\nSecond paragraph.' } };
  validateDesignFile({ inputs, project, resolved });
  assert.deepEqual(resolved, await resolve(inputs));
  assert.throws(() => validateDesignFile({ inputs, project: { explanations: { unknown: 'x' } }, resolved }));
});

test('offline ZIP reader works from file URLs for normal, primary-only and stress inputs', { timeout: 240000 }, async () => {
  await mkdir(root, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  assert.match(chromium.executablePath(), /(?:chromium|chromium_headless_shell)-1248/);
  try {
    for (const fixture of ['example', 'primary-only', 'stress']) {
      const model = JSON.parse(await readFile(fixture === 'stress' ? 'test/fixtures/stress.design.json' : 'examples/example.design.json', 'utf8'));
      if (fixture === 'example') {
        model.inputs.typefaces.main = 'Mona Sans';
        model.inputs.typefaces.monospace = 'Red Hat Mono';
        model.inputs.type.label = 'monospace';
        model.inputs['brand-colors'].secondary = '#7a3e9d';
        model.inputs.shadow.strength = 50;
      }
      model.project.introduction = 'A short introduction.\n\nA second paragraph with <literal> text.';
      model.project.contact = { name: 'Design owner', email: 'review@example.invalid' };
      model.project.explanations = Object.fromEntries(['colour', 'typefaces', 'type-scale', 'space-shape', 'shadow', 'components'].map((key) => [key, 'A choice made for clear information.\n\nA second reason.']));
      const design = join(root, `${fixture}.design.json`);
      const zip = join(root, `${fixture}.zip`);
      await writeFile(design, JSON.stringify(model));
      const report = await createPresentation(design, zip, { date: '2026-11-02' });
      const { filename, html } = extractZip(await readFile(zip));
      assert.equal(filename, 'example-design-system.html');
      assert.ok(report.htmlBytes < 5 * 1024 * 1024);
      assert.match(html, /&lt;literal&gt;/);
      assert.equal((html.match(/data:font\/woff2;base64/g) || []).length, shippedIn(derive(model.inputs).typefaces).flatMap((face) => [face.upright, face.italic].filter(Boolean)).length);
      try {
        await exec('unzip', ['-t', zip]);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const file = join(root, `${fixture}.html`);
      await writeFile(file, html);
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      const external = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('request', (request) => {
        if (!/^(file|data|about|blob):/.test(request.url())) external.push(request.url());
      });
      const url = pathToFileURL(file).href;
      await page.goto(url);
      assert.equal(await page.locator('[srcdoc]').count(), 0);
      for (const entry of pageList().slice(1)) {
        await page.locator('.is-current .page-turn .next').click();
        await page.waitForFunction((id) => document.querySelector('.is-current')?.id === id, entry.id);
      }
      for (const width of [1440, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const entry of pageList()) {
          await navigate(page, entry.id);
          if (width === 1440) {
            for (const summary of await page.locator('.is-current .variants > summary').all()) await summary.click();
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          assert.ok(overflow <= 1, `${fixture} ${entry.id} ${width}: overflow ${overflow}`);
          assert.equal(await page.locator('.document-page:visible').count(), 1);
        }
      }
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.locator('#menu-toggle').click();
      await page.locator('[data-nav-chapter="frame"] .nav-chapter-link').click();
      await page.waitForFunction(() => document.querySelector('.is-current')?.id === 'header');
      assert.equal(await page.locator('#sidebar').isVisible(), false);
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (const entry of pageList()) {
        if (entry.chapter !== 'comments') await page.locator(`[data-nav-chapter="${entry.chapter}"] .nav-chapter-link`).click();
        await page.locator(`[data-nav-page="${entry.id}"]`).click();
        await page.waitForFunction((id) => document.querySelector('.is-current')?.id === id, entry.id);
      }
      assert.equal(await page.locator('#comment-toggle').isVisible(), false);
      await page.setViewportSize({ width: 1440, height: 700 });
      await navigate(page, 'header');
      assert.equal(await page.locator('#comment-toggle').isVisible(), true);
      assert.equal(await page.locator('.nav-pages:visible').count(), 1);
      assert.equal(await page.locator('#sidebar nav').evaluate((nav) => nav.scrollHeight <= nav.clientHeight), true);
      assert.equal(await page.locator('.nav-comments').isVisible(), true);
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (const entry of pageList()) {
        await page.goto('about:blank');
        await page.goto(`${url}#${entry.id}`);
        await page.waitForFunction((id) => document.querySelector('.is-current')?.id === id, entry.id);
      }
      await navigate(page, 'colour-scale');
      await navigate(page, 'colour-together');
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('.is-current')?.id === 'colour-scale');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.is-current')?.id === 'colour-together');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.querySelector('.is-current')?.id === 'colour-scale');
      await navigate(page, 'colour-together');
      const filledButton = page.locator('.surface-example[data-kn-surface="page"] .kn-button');
      assert.equal(await filledButton.evaluate((button) => getComputedStyle(button).backgroundColor !== getComputedStyle(button.parentElement).backgroundColor), true);
      await navigate(page, 'type-scale');
      const slider = page.locator('#type-window');
      const before = await slider.boundingBox();
      const beforeSize = await page.locator('[data-scale-style="display"]').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      await page.mouse.move(before.x + before.width - 8, before.y + before.height / 2);
      await page.mouse.down();
      await page.mouse.move(before.x + 8, before.y + before.height / 2, { steps: 12 });
      await page.mouse.up();
      const after = await slider.boundingBox();
      const afterSize = await page.locator('[data-scale-style="display"]').evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      assert.deepEqual(after, before);
      assert.ok(beforeSize >= afterSize);
      if (fixture !== 'stress') assert.ok(beforeSize > afterSize);
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.is-current').getAttribute('id'), 'type-scale');
      await navigate(page, 'shadow');
      const shadows = await page.locator('.shadow-object').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).boxShadow));
      assert.ok(shadows.every((value) => model.inputs.shadow.strength ? value !== 'none' : value === 'none'));
      await navigate(page, 'header');
      const header = await readyFrame(page, 'header-a-menu');
      await header.locator('[data-kn-trigger="menu"]').click();
      assert.equal(await header.locator('[data-kn-panel="menu"]').isVisible(), true);
      await header.locator('[data-kn-trigger="search"]').click();
      assert.equal(await header.locator('[data-kn-panel="search"]').isVisible(), true);
      const toolbar = page.locator('#header .page-toolbar');
      const toolbarBefore = await toolbar.boundingBox();
      await toolbar.locator('[data-value="768"]').click();
      assert.equal(await header.evaluate(() => innerWidth), 768);
      await toolbar.locator('[data-value="390"]').click();
      assert.equal(await header.evaluate(() => innerWidth), 390);
      await toolbar.locator('[data-value="dark"]').click();
      assert.equal(await header.locator('html').getAttribute('data-kn-mode'), 'dark');
      assert.deepEqual(await toolbar.boundingBox(), toolbarBefore);
      assert.equal(await page.locator('#header .specimen select').count(), 0);
      if (fixture === 'example') {
        await header.evaluate(() => document.fonts.load('16px "Mona Sans"'));
        const loaded = await header.evaluate(() => [...document.fonts].some((face) => face.family === 'Mona Sans' && face.status === 'loaded'));
        assert.equal(loaded, true);
      }
      await navigate(page, 'forms');
      const consent = await readyFrame(page, 'consent-banner');
      await consent.getByRole('button', { name: 'Open privacy choices' }).click();
      assert.equal(await consent.locator('.kn-consent').isVisible(), true);
      await consent.getByRole('button', { name: 'Customise choices' }).click();
      assert.equal(await consent.locator('dialog').isVisible(), true);
      const optional = consent.locator('input[data-kn-category]:not([disabled])').first();
      await optional.check();
      await consent.locator('button[type="submit"]').click();
      assert.equal(await consent.locator('dialog').isVisible(), false);
      await navigate(page, 'media');
      const embed = await readyFrame(page, 'embed');
      await embed.locator('[data-kn-embed-load]').first().click();
      assert.equal(await embed.locator('iframe').count(), 0);
      await navigate(page, 'text');
      const accordion = await readyFrame(page, 'accordion');
      await accordion.locator('.kn-accordion summary').first().click();
      assert.equal(await accordion.locator('.kn-accordion details[open]').count(), 1);
      if (fixture === 'example') await checkComments(page, url);
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      await context.close();
    }
    const noScript = await browser.newPage({ javaScriptEnabled: false });
    await noScript.goto(pathToFileURL(join(root, 'example.html')).href);
    assert.equal(await noScript.locator('.document-page:visible').count(), pageList().length);
    await noScript.close();
    const memoryOnly = await browser.newPage();
    await memoryOnly.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } }));
    await memoryOnly.goto(`${pathToFileURL(join(root, 'example.html')).href}#colour-scale`);
    await memoryOnly.locator('#comment-toggle').click();
    assert.match(await memoryOnly.locator('#storage-status').textContent(), /before closing/);
    await memoryOnly.locator('#comment-text').fill('Keep this in memory.');
    await memoryOnly.locator('#comment-add').click();
    assert.equal(await memoryOnly.locator('[data-page-count]').textContent(), '1');
    await memoryOnly.close();
  } finally {
    await browser.close();
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/presentation-tests', { recursive: true, force: true });
  }
});

async function checkComments(page, url) {
  await navigate(page, 'header');
  await page.locator('#header [data-specimen-comment]').first().click();
  await page.locator('#comment-text').fill('The menu is easy to find.');
  await page.locator('#comment-add').click();
  assert.equal(await page.locator('[data-page-count]').textContent(), '1');
  await page.locator('#page-comments button').first().click();
  await page.locator('#comment-text').fill('The menu is clear.');
  await page.reload();
  await page.locator('#comment-toggle').click();
  assert.match(await page.locator('#page-comments').textContent(), /The menu is clear/);
  await page.locator('#comment-text').fill('A draft survives a reload.');
  await page.reload();
  await page.locator('#comment-toggle').click();
  assert.equal(await page.locator('#comment-text').inputValue(), 'A draft survives a reload.');
  await page.locator('#comment-add').click();
  await page.locator('#comment-close').click();
  await navigate(page, 'comments');
  await page.locator('#reader-name').fill('A reviewer');
  assert.equal(await page.locator('[data-total-count]').textContent(), '2');
  const mail = decodeURIComponent(await page.locator('#mail-comments').getAttribute('href'));
  assert.match(mail, /mailto:review@example.invalid/);
  assert.match(mail, /The menu is clear/);
  assert.match(mail, /Component: Header/);
  const download = page.waitForEvent('download');
  await page.locator('#save-comments').click();
  const text = await readFile(await (await download).path(), 'utf8');
  assert.match(text, /Example — Design system/);
  assert.match(text, /Version: 1.0/);
  assert.match(text, /A reviewer/);
  assert.match(text, /Page: Header/);
  assert.match(text, /The menu is clear/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedComments = text; } } });
  });
  await page.locator('#copy-comments').click();
  assert.equal(await page.evaluate(() => window.copiedComments), text);
  await page.locator('#all-comments button').first().click();
  await page.locator('#comment-text').fill('Long comment. '.repeat(200));
  await page.locator('#comment-add').click();
  await page.locator('#comment-close').click();
  await navigate(page, 'comments');
  assert.equal(await page.locator('#mail-comments').getAttribute('data-attach'), 'true');
  assert.ok((await page.locator('#mail-comments').getAttribute('href')).length < 1800);
  await page.locator('#mail-comments').evaluate((link) => {
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    link.click();
  });
  assert.match(await page.locator('#comment-feedback').textContent(), /attach/);
  await page.locator('#all-comments .comment-entry button').nth(1).click();
  assert.equal(await page.locator('[data-total-count]').textContent(), '1');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#clear-comments').click();
  assert.equal(await page.locator('[data-total-count]').textContent(), '1');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#clear-comments').click();
  assert.equal(await page.locator('[data-total-count]').textContent(), '0');
  await page.goto(url + '#comments');
  assert.equal(await page.locator('[data-total-count]').textContent(), '0');
}

test('copy overrides reject unknown keys and fall back to English', { timeout: 30000 }, async () => {
  const directory = pathResolve('node_modules/.cache/presentation-copy-tests');
  await mkdir(directory, { recursive: true });
  try {
    const design = join(directory, 'example.design.json');
    await writeFile(design, await readFile('examples/example.design.json'));
    const override = join(directory, 'example.design.copy.json');
    await writeFile(override, JSON.stringify({ lang: 'en-GB', 'document.filename': 'design-guide', 'header.title': 'Navigation' }));
    const output = join(directory, 'example.zip');
    await createPresentation(design, output);
    const { filename, html } = extractZip(await readFile(output));
    assert.equal(filename, 'example-design-guide.html');
    assert.match(html, /lang="en-GB"/);
    assert.match(html, />Navigation</);
    assert.match(html, />The colour scale</);
    await writeFile(override, JSON.stringify({ unknown: 'Not allowed' }));
    await assert.rejects(createPresentation(design, output), /Unknown copy key/);
  } finally {
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/presentation-copy-tests', { recursive: true, force: true });
  }
});

test('tool saves presentation prose, keeps controls still and serves the exported HTML', { timeout: 120000 }, async () => {
  const directory = pathResolve('node_modules/.cache/presentation-tool-tests');
  await mkdir(directory, { recursive: true });
  const tool = await startTool({ designFile: join(directory, 'example.design.json'), port: 0, open: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.waitForFunction(() => document.querySelector('#preview')?.contentDocument?.querySelector('.kn-card'));
    await page.waitForFunction(() => document.querySelector('#preview-narrow')?.contentDocument?.querySelector('.kn-card'));
    const preview = await (await page.locator('#preview').elementHandle()).contentFrame();
    const mobile = await (await page.locator('#preview-narrow').elementHandle()).contentFrame();
    const openPage = async (chapter, name) => {
      await page.locator('.chapter', { hasText: chapter }).click();
      if (name) await page.locator('.page-link', { hasText: name }).click();
    };
    await page.locator('[data-path="project.introduction"]').fill('A useful introduction.');
    await page.locator('[data-path="project.contact.name"]').fill('Design owner');
    await page.locator('[data-path="project.contact.email"]').fill('review@example.invalid');
    await openPage('Colour');
    await page.locator('[data-path="project.explanations.colour"]').fill('Chosen for clarity.');

    // The controls stand above the examples on every page.
    for (const [chapter, name, control, example] of [
      ['Colour', 'The colour scale', '[data-path="lch.primary.H"]', '[data-ramp="primary"]'],
      ['Typography', 'The main typeface', '[data-font="main"]', '.specimen'],
      ['Typography', 'The type scale', '[data-arrow="min"]', '[data-step-sample="display"]'],
      ['Shape', 'Space', '[data-path="inputs.density-profile"]', '.sample-band'],
      ['Shape', 'Corners', '[data-path="inputs.corner-profile"]', '.sample-cards'],
      ['Shape', 'Shadow', '[data-path="inputs.shadow.strength"]', '.shadow-stage'],
    ]) {
      await openPage(chapter, name);
      const scope = page.locator('[data-page]:visible');
      assert.ok((await scope.locator(control).first().boundingBox()).y < (await scope.locator(example).first().boundingBox()).y, name);
    }

    // Each end of the preview answers its own type scale, and nothing moves while dragging.
    await openPage('Typography', 'The type scale');
    const heading = (frame) => frame.locator('.kn-hero h1').evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    const before = { mobile: await heading(mobile), desktop: await heading(preview) };
    await page.locator('[data-line-base="min"]').fill('1.2');
    await page.locator('[data-line-base="min"]').press('Enter');
    await mobile.waitForFunction((size) => parseFloat(getComputedStyle(document.querySelector('.kn-hero h1')).fontSize) > size, before.mobile);
    assert.ok(Math.abs((await heading(preview)) - before.desktop) < 0.5);
    assert.match(await page.locator('[data-end="narrow"] .end-follows').textContent(), /Follows 100 %/);
    assert.match(await page.locator('[data-end="wide"] .end-follows').textContent(), /Follows 0 %/);
    const line = page.locator('[data-line-track]');
    const place = await line.boundingBox();
    const arrow = await page.locator('[data-arrow="view"]').boundingBox();
    await page.mouse.move(arrow.x + arrow.width / 2, arrow.y + arrow.height - 4);
    await page.mouse.down();
    await page.mouse.move(place.x + place.width * 0.1, arrow.y + arrow.height - 4, { steps: 12 });
    assert.deepEqual(await line.boundingBox(), place);
    await page.mouse.up();

    // The frame's settings reach the preview without a build, and the rest of the page stays.
    await openPage('Frame', 'Header');
    const flag = (name) => page.locator(`[data-flag="inputs.${name}"]`);
    await flag('header.search').click();
    await preview.waitForFunction(() => !document.querySelector('.kn-header-search-trigger'));
    assert.equal(await page.locator('.mini-item[data-mini="search"]').first().getAttribute('data-off'), '');
    await flag('header.search').click();
    await page.locator('[data-pick="inputs.header.arrangement"][data-value="C"]').click();
    await preview.waitForFunction(() => document.querySelector('.kn-header-group[data-kn-group="start"] .kn-header-search-trigger'));
    await flag('header.language').click();
    await preview.waitForFunction(() => document.querySelector('.kn-header-bar .kn-header-language'));
    await page.locator('[data-path="inputs.header.menu-button"]').selectOption('icon');
    await preview.waitForFunction(() => !document.querySelector('.kn-header-bar .kn-header-menu-word') && document.querySelector('[data-kn-trigger="menu"]').dataset.knIcon === 'menu');
    await page.locator('[data-path="inputs.header.attachment"]').selectOption('flow');
    assert.equal(await page.locator('[data-path="inputs.header.start"]').isDisabled(), true);
    assert.equal(await flag('header.autohide').isDisabled(), true);
    await preview.waitForFunction(() => document.querySelector('.kn-header').dataset.knAttachment === 'flow');
    await page.locator('[data-path="inputs.header.attachment"]').selectOption('sticky');
    await page.locator('[data-path="project.slogan"]').fill('Calm and clear');
    await preview.waitForFunction(() => document.querySelector('.kn-header-slogan')?.textContent === 'Calm and clear');
    assert.equal(await page.locator('[data-path="project.slogan"]').evaluate((node) => node === document.activeElement), true);

    // The search box can be held open while it is set, and the control keeps the focus.
    const showSearch = page.locator('[data-show-panel="search"]');
    await showSearch.click();
    await preview.waitForFunction(() => !document.querySelector('[data-kn-panel="search"]').hidden);
    await page.waitForFunction(() => document.activeElement?.dataset.showPanel === 'search');
    await page.locator('[data-path="inputs.header.search-surface"]').selectOption('tint');
    await preview.waitForFunction(() => document.querySelector('.kn-header-search-box').dataset.knSurface === 'tint' && !document.querySelector('[data-kn-panel="search"]').hidden);
    await flag('header.search-blur').click();
    await preview.waitForFunction(() => document.querySelector('[data-kn-panel="search"]').dataset.knBlur === 'false');
    await flag('header.search-links').click();
    await preview.waitForFunction(() => !document.querySelector('.kn-header-search-links'));
    await showSearch.click();
    await preview.waitForFunction(() => document.querySelector('[data-kn-panel="search"]').hidden);
    await page.locator('[data-show-panel="menu"]').click();
    await flag('header.numbered').click();
    await preview.waitForFunction(() => !document.querySelector('[data-kn-panel="menu"]').hidden && document.querySelector('.kn-megamenu-number'));
    await page.locator('[data-show-panel="menu"]').click();

    // The footer's model and lines change it where it stands, and what cannot apply is off.
    await openPage('Frame', 'Footer');
    await preview.waitForFunction(() => document.querySelector('.kn-header-panel:not([hidden])') === null);
    const pick = (model) => page.locator(`[data-pick="inputs.footer.model"][data-value="${model}"]`);
    assert.equal(await pick('utility').getAttribute('aria-pressed'), 'true');
    await pick('one').click();
    await preview.waitForFunction(() => document.querySelectorAll('.kn-footer-band').length === 1);
    assert.equal(await page.locator('[data-path="inputs.footer.second-surface"]').isDisabled(), true);
    assert.equal(await flag('footer.horizontal-rules').isDisabled(), true);
    await pick('two').click();
    await flag('footer.horizontal-rules').click();
    await preview.waitForFunction(() => document.querySelectorAll('.kn-footer-rule').length === 1);
    await flag('footer.vertical-rule').click();
    await preview.waitForFunction(() => document.querySelector('.kn-footer-vertical-rule'));
    await page.locator('[data-path="inputs.footer.surface"]').selectOption('page');
    await preview.waitForFunction(() => document.querySelector('.kn-footer-band').dataset.knSurface === 'page');
    await page.locator('[data-path="inputs.footer.attachment"]').selectOption('reveal');
    await preview.waitForFunction(() => document.querySelector('.kn-footer').dataset.knAttachment === 'reveal');
    await page.locator('[data-path="inputs.footer.attachment"]').selectOption('flow');
    await pick('utility').click();

    // The page's widths and the line and shadow where it meets the footer.
    await openPage('Frame', 'Page');
    await page.locator('[data-path="inputs.layout.wide"]').fill('1000');
    await preview.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--kn-layout-wide').trim() === '62.5rem');
    await flag('page.shadow').click();
    await preview.waitForFunction(() => document.querySelector('.kn-page-main').dataset.knShadow === 'true');
    await page.locator('[data-path="inputs.page.fill-light"]').fill('linear-gradient(#ffffff');
    await page.locator('[data-path="inputs.page.fill-light"]').fill('linear-gradient(#ffffff, #eeeeee)');
    await preview.waitForFunction(() => document.querySelector('.kn-page').style.getPropertyValue('--kn-page-fill-light').includes('gradient'));
    await page.locator('[data-path="inputs.page.fill-light"]').fill('');
    await page.locator('[data-path="inputs.layout.wide"]').fill('1200');

    // How the trail shows: where it stands, its mark and first step, and whether it shows at all.
    await openPage('Frame', 'Breadcrumbs');
    const trail = () => document.querySelector('.kn-breadcrumbs');
    await preview.waitForFunction(() => document.querySelector('.kn-hero-text > .kn-breadcrumbs:first-child'));
    await page.locator('[data-path="inputs.breadcrumbs.placement"]').selectOption('own-band');
    await preview.waitForFunction(() => document.querySelector('.kn-page-main > .kn-breadcrumb-band .kn-breadcrumbs') && !document.querySelector('.kn-hero-text > .kn-breadcrumbs'));
    await page.locator('[data-pick="inputs.breadcrumbs.separator"][data-value="chevron"]').click();
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-breadcrumbs-separator'), '::before').content.includes('\u203A'));
    await page.locator('[data-path="inputs.breadcrumbs.home"]').selectOption('icon');
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-breadcrumbs-house')).display !== 'none');
    assert.equal((await preview.locator('.kn-breadcrumbs a').first().textContent()).trim(), 'Home', 'the word stays for those who hear the page');
    await page.locator('[data-path="inputs.breadcrumbs.home"]').selectOption('word');
    await flag('breadcrumbs.current').click();
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-breadcrumbs li:last-child')).display === 'none');
    await flag('breadcrumbs.current').click();
    await page.locator('[data-path="inputs.breadcrumbs.narrow"]').selectOption('parent');
    await mobile.waitForFunction(() => [...document.querySelectorAll('.kn-breadcrumbs li')].filter((item) => getComputedStyle(item).display !== 'none').length === 1);
    assert.ok(await preview.evaluate(() => [...document.querySelectorAll('.kn-breadcrumbs li')].filter((item) => getComputedStyle(item).display !== 'none').length > 1), 'a wide window keeps the whole trail');
    await flag('breadcrumbs.show').click();
    await preview.waitForFunction(() => !document.querySelector('.kn-breadcrumbs'));
    assert.equal(await page.locator('[data-path="inputs.breadcrumbs.placement"]').isDisabled(), true);
    await flag('breadcrumbs.show').click();
    await preview.waitForFunction(trail);

    // Every component has its page, and the preview shows the real ones, in the design as it is.
    await openPage('Components', 'Cards');
    await preview.waitForFunction(() => location.pathname === '/catalogue.html' && document.querySelector('[data-component="card"]') && scrollY > 0);
    await mobile.waitForFunction(() => location.pathname === '/catalogue.html');
    for (const name of ['Opening', 'Sections', 'Text', 'Buttons', 'Cards', 'Media', 'Finding', 'Forms'])
      assert.equal(await page.locator('.page-link', { hasText: name }).count(), 1, name);
    await preview.waitForFunction((core) => document.getElementById('kn-live-core').textContent === core, await page.locator('#kn-live-core').textContent());
    const before2 = await preview.evaluate(() => scrollY);
    await page.locator('[data-show-specimen="card-grid"]').click();
    await preview.waitForFunction((from) => scrollY > from, before2);
    await page.locator('[data-page="cards"] .next').click();
    await page.waitForFunction(() => document.querySelector('.page-link[aria-current="true"]').textContent === 'Media');
    await openPage('Frame', 'Header');
    await preview.waitForFunction(() => location.pathname === '/preview.html' && document.querySelector('.kn-page'));
    await preview.waitForFunction(() => document.querySelector('.kn-header-slogan')?.textContent === 'Calm and clear');
    const savedFrame = await (async () => {
      await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
      return JSON.parse(await readFile(tool.path, 'utf8'));
    })();
    assert.equal(savedFrame.inputs.header.arrangement, 'C');
    assert.equal(savedFrame.inputs.header['search-surface'], 'tint');
    assert.equal(savedFrame.resolved.header.arrangement, 'C');
    assert.equal(savedFrame.inputs.footer.surface, 'page');
    assert.equal(savedFrame.project.slogan, 'Calm and clear');

    // The markup the preview makes for a footer is the one Footer.astro makes.
    const built = await fetch(tool.url + '/preview.html').then((response) => response.text());
    const settings = withDefaults({ 'brand-colors': { primary: '#000000' } }).footer;
    const { bands, ...options } = footerProps(settings, { name: 'Example' });
    const same = await page.evaluate(([astro, live]) => {
      const shape = (node) => [node.tagName, [...node.attributes].filter((attribute) => attribute.name !== 'slot').map((attribute) => `${attribute.name}=${attribute.value.replace(/\s/g, '')}`).sort(), [...node.children].map(shape), node.children.length ? '' : node.textContent.trim()];
      const parse = (html) => new DOMParser().parseFromString(html, 'text/html').querySelector('.kn-footer');
      return JSON.stringify(shape(parse(astro))) === JSON.stringify(shape(parse(live))) || [JSON.stringify(shape(parse(astro))).slice(0, 900), JSON.stringify(shape(parse(live))).slice(0, 900)];
    }, [built.match(/<footer[\s\S]*?<\/footer>/)[0], footerHtml(layoutFooter(bands), options)]);
    assert.equal(same, true, JSON.stringify(same));

    // A change is saved without being asked.
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved' && document.getElementById('status').dataset.state === 'saved');

    // The grey temperature and a third colour both reach the preview.
    await openPage('Colour', 'The colour scale');
    const greyBand = () => preview.locator('[data-preview-section="surfaces"]').evaluate((node) => getComputedStyle(node).backgroundColor);
    const grey = await greyBand();
    await page.locator('[data-path="inputs.gray-temperature"]').fill('90');
    await preview.waitForFunction((before) => getComputedStyle(document.querySelector('[data-preview-section="surfaces"]')).backgroundColor !== before, grey);
    const thirdCard = preview.locator('[data-kn-needs-surface="tint-tertiary"]');
    await thirdCard.waitFor({ state: 'hidden' });
    await page.locator('[data-add-colour]').click();
    await page.locator('[data-add-colour]').click();
    await thirdCard.waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-colour-block="tertiary"]').isVisible(), true);
    await page.locator('[data-remove-colour="tertiary"]').click();
    await thirdCard.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-colour-block="tertiary"]').isVisible(), false);
    await openPage('Colour', 'The colours together');
    assert.equal(await page.locator('[data-surface-case="tint-tertiary"]').isVisible(), false);

    // The arrow points where the shadow falls.
    await openPage('Shape', 'Shadow');
    await page.locator('[data-path="inputs.shadow.strength"]').fill('48');
    assert.equal(await page.locator('[data-path="inputs.shadow.strength"]').inputValue(), '50', 'it catches at 50');
    await page.locator('[data-path="shadow-direction"]').fill('45');
    assert.equal(await page.locator('[data-dial]').getAttribute('transform'), 'rotate(-45 22 22)');
    assert.match(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--kn-shadow-box')), /^\s*0\.\d+px/);
    await page.locator('[data-path="shadow-direction"]').fill('0');

    // A chosen typeface reaches both frames, with its real italic.
    await openPage('Typography', 'The main typeface');
    await page.locator('[data-font="main"]').selectOption('Lora, Georgia, serif');
    for (const frame of [preview, mobile]) {
      await frame.waitForFunction(() => getComputedStyle(document.body).fontFamily.startsWith('Lora'));
      assert.ok(await frame.evaluate(() => document.fonts.load('italic 16px Lora').then((faces) => faces.some((face) => face.style === 'italic'))));
    }
    await page.locator('[data-font="main"]').selectOption('Mona Sans');

    // Dragging touches only what changed: the logo stays the same element, and so does the picture.
    const stable = (frame) => frame.evaluate(() => {
      window.__stable = { hero: document.querySelector('.kn-hero-media img').src.length };
      window.__mutations = 0;
      new MutationObserver((list) => {
        for (const change of list) if (change.type === 'childList' && change.target.id !== 'kn-live-core') window.__mutations += 1;
        for (const change of list) if (change.type === 'attributes' && change.attributeName === 'src') window.__mutations += 1;
      }).observe(document, { subtree: true, childList: true, attributes: true });
    });
    await openPage('Shape', 'Corners');
    await stable(preview);
    await stable(mobile);
    await page.locator('[data-path="inputs.corner-profile"]').fill('60');
    await page.locator('[data-path="inputs.corner-profile"]').fill('40');
    await page.locator('[data-path="inputs.corner-profile"]').fill('25');
    await page.waitForTimeout(250);
    assert.equal(await preview.evaluate(() => window.__mutations), 0);
    assert.equal(await mobile.evaluate(() => window.__mutations), 0);

    // Scrolling one end takes the other to the same section.
    const scrolled = await mobile.locator('.kn-footer').evaluate((node) => {
      window.scrollTo({ top: node.getBoundingClientRect().top + scrollY, behavior: 'instant' });
      return scrollY;
    });
    await new Promise((done) => setTimeout(done, 900));
    await mobile.evaluate((top) => window.scrollTo({ top: top - 40, behavior: 'instant' }), scrolled);
    await preview.waitForFunction(() => scrollY > 200);

    // Light and Dark reach the whole interface.
    const interfaceColour = () => page.locator('.menu').evaluate((node) => getComputedStyle(node).backgroundColor);
    const light = await interfaceColour();
    await page.locator('.menu [data-mode="dark"]').click();
    assert.notEqual(await interfaceColour(), light);
    await preview.locator('html[data-kn-mode="dark"]').waitFor({ state: 'attached' });
    await page.locator('.menu [data-mode="light"]').click();

    // The divider catches at its best position and goes back to it.
    const divider = page.locator('#divider');
    const drag = async (x) => {
      const box = await divider.boundingBox();
      await page.mouse.move(box.x + 4, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      return page.locator('.controls').evaluate((node) => node.getBoundingClientRect().width);
    };
    assert.equal(await drag(700), 696);
    assert.equal(await divider.getAttribute('data-optimal'), 'false');
    assert.equal(await drag(552), 540);
    assert.equal(await divider.getAttribute('data-optimal'), 'true');
    await drag(700);
    await divider.dblclick();
    assert.equal(await page.locator('.controls').evaluate((node) => node.getBoundingClientRect().width), 540);

    // The preview can fill the window, or move to a window of its own and come back.
    await page.locator('#full-window').click();
    assert.equal(await page.locator('.controls').isVisible(), false);
    await page.locator('#full-window').click();
    const [second] = await Promise.all([page.context().waitForEvent('page'), page.locator('#own-window').click()]);
    await second.waitForFunction(() => document.querySelector('#preview')?.contentDocument?.querySelector('.kn-card'));
    assert.equal(await page.locator('#preview-pane').isVisible(), false);
    await second.locator('.preview-end [data-mode="dark"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.knMode === 'dark');
    await page.locator('.menu [data-mode="light"]').click();
    await second.waitForFunction(() => document.documentElement.dataset.knMode === 'light');
    await page.locator('#bring-back').click();
    await page.locator('#preview-pane').waitFor({ state: 'visible' });

    const control = page.locator('[data-path="inputs.corner-profile"]');
    await openPage('Shape', 'Corners');
    await control.scrollIntoViewIfNeeded();
    const held = await control.boundingBox();
    await page.mouse.move(held.x + 8, held.y + held.height / 2);
    await page.mouse.down();
    await page.mouse.move(held.x + held.width * 0.92, held.y + held.height / 2, { steps: 12 });
    await page.mouse.up();
    assert.deepEqual(await control.boundingBox(), held);
    await page.waitForFunction(() => {
      const child = document.querySelector('#preview').contentDocument;
      return parseFloat(child.defaultView.getComputedStyle(child.querySelector('.kn-card')).borderRadius) > 15;
    });
    const response = page.waitForResponse((response) => response.url().endsWith('/api/presentation') && response.request().method() === 'POST');
    await page.locator('#presentation').click();
    const report = await (await response).json();
    assert.match(report.path, /example-presentation-\d{4}-\d{2}-\d{2}\.zip$/);
    const saved = JSON.parse(await readFile(tool.path, 'utf8'));
    assert.equal(saved.project.introduction, 'A useful introduction.');
    assert.equal(saved.project.contact.name, 'Design owner');
    assert.equal(saved.project.explanations.colour, 'Chosen for clarity.');
    const served = await fetch(tool.url + '/api/presentation-file').then((response) => response.text());
    assert.match(served, /Chosen for clarity/);
    assert.equal(await page.locator('#notice a').getAttribute('href'), '/api/presentation-file');
    const refused = await fetch(tool.url + '/api/presentation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(refused.status, 403);
    assert.match(await preview.locator('.kn-header-identity').getAttribute('aria-label'), /Placeholdr/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/presentation-tool-tests', { recursive: true, force: true });
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/konzilo-tool', { recursive: true, force: true });
  }
});

test('each role chooses a typeface and turns the axes that typeface has', { timeout: 120000 }, async () => {
  const directory = pathResolve('node_modules/.cache/presentation-role-tests');
  await mkdir(directory, { recursive: true });
  const tool = await startTool({ designFile: join(directory, 'role.design.json'), port: 0, open: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.waitForFunction(() => document.querySelector('#preview')?.contentDocument?.querySelector('.kn-card'));
    const preview = await (await page.locator('#preview').elementHandle()).contentFrame();
    await page.locator('.chapter', { hasText: 'Typography' }).click();
    const style = (selector, property) => preview.locator(selector).first().evaluate((node, name) => getComputedStyle(node)[name], property);
    const saved = async () => {
      await page.waitForFunction(() => document.querySelector('#status-text').textContent === 'Saved');
      return JSON.parse(await readFile(tool.path, 'utf8')).inputs;
    };
    const drag = (axis, value) => page.locator(`[data-axis="${axis}"]`).evaluate((node, next) => {
      node.value = next;
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const axes = () => page.locator('[data-axis]').evaluateAll((nodes) => nodes.map((node) => node.dataset.axis));

    // A new design: Mona Sans everywhere, its axes giving display text and labels their look.
    assert.deepEqual(await axes(), ['wght', 'wdth', 'opsz', 'spacing']);
    await page.locator('[data-role-tab="display"]').click();
    assert.equal(await page.locator('[data-axis="wght"]').inputValue(), '260');
    assert.equal(await style('.kn-hero h1', 'fontStretch'), '112%');
    assert.equal(await style('[data-kn-type="label"]', 'fontStretch'), '75%');

    // A slider moves the display text, and stays the same element while it does.
    await page.locator('[data-axis="wght"]').evaluate((node) => { window.__slider = node; });
    await drag('wght', '500');
    assert.equal(await page.locator('[data-axis="wght"]').evaluate((node) => node === window.__slider), true);
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-hero h1')).fontWeight === '500');
    assert.equal((await saved()).type.roles.display.weight, 500);
    await page.locator('[data-axis-reset="wght"]').click();
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-hero h1')).fontWeight === '600');
    assert.equal((await saved()).type.roles.display.weight, undefined);

    // The letter spacing shows in the specimen as well as in the preview.
    const spacing = () => page.locator('.specimen-name').evaluate((node) => parseFloat(getComputedStyle(node).letterSpacing));
    const tightest = await spacing();
    const held = await page.locator('[data-axis="spacing"]').boundingBox();
    await drag('spacing', '0.3');
    assert.deepEqual(await page.locator('[data-axis="spacing"]').boundingBox(), held, 'the page heading never breaks to push the slider');
    await page.waitForFunction((before) => parseFloat(getComputedStyle(document.querySelector('.specimen-name')).letterSpacing) > before + 1, tightest);
    await preview.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.kn-hero h1')).letterSpacing) > 1);
    await page.locator('[data-axis-reset="spacing"]').click();

    // Another typeface brings its own axes, and settings it has no axis for go.
    await page.locator('[data-font="display"]').selectOption('Roboto Flex');
    await page.waitForFunction(() => document.querySelector('[data-axis="XTRA"]'));
    assert.ok((await axes()).includes('slnt'));
    assert.equal(await page.locator('[data-axis="wdth"]').getAttribute('max'), '151');
    await drag('XTRA', '500');
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-hero h1')).fontVariationSettings.includes('XTRA'));
    await page.locator('[data-font="display"]').selectOption('Fraunces, Georgia, serif');
    await page.waitForFunction(() => document.querySelector('[data-axis="SOFT"]'));
    const inputs = await saved();
    assert.equal(inputs.typefaces.display, 'Fraunces, Georgia, serif');
    assert.equal(inputs.type.roles.display.axes?.XTRA, undefined);

    // A display typeface is offered only for the first heading and larger.
    await page.locator('[data-role-tab="heading"]').click();
    assert.equal(await page.locator('[data-font="heading"] option', { hasText: 'Playfair' }).count(), 0);
    await page.locator('[data-role-tab="main"]').click();
    assert.equal(await page.locator('[data-font="main"] option', { hasText: 'Playfair' }).count(), 0);
    assert.equal(await page.locator('[data-font="main"] option', { hasText: 'Red Hat Text' }).count(), 1);

    // The first heading follows either role.
    await page.locator('[data-role-tab="heading-1"]').click();
    assert.equal(await page.locator('[data-font="heading-1"] option', { hasText: 'Playfair' }).count(), 1);
    await page.locator('[data-font="heading-1"]').selectOption('@display');
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('.kn-hero h2')).fontFamily.startsWith('Fraunces'));
    assert.equal((await saved()).type['heading-1-role'], 'display');

    // Labels can take any face, a monospace too, and alternate letters come from the face.
    await page.locator('[data-role-tab="label"]').click();
    assert.equal(await page.locator('[data-set="ss02"]').isChecked(), true);
    await page.locator('[data-font="label"]').selectOption('Geist Mono');
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('[data-kn-type="label"]')).fontFamily.includes('Geist Mono'));
    assert.equal((await saved()).typefaces.label, 'Geist Mono');
    await page.locator('[data-font="label"]').selectOption('@monospace');
    await preview.waitForFunction(() => getComputedStyle(document.querySelector('[data-kn-type="label"]')).fontFamily.includes('Mona Sans Mono'));
    assert.equal((await saved()).type.label, 'monospace');

    // A breakpoint takes a named scale from a menu or a base typed by hand, and says Custom off the list.
    await page.locator('.page-link', { hasText: 'The type scale' }).click();
    const list = page.locator('[data-ratio="max"]');
    const base = page.locator('[data-line-base="max"]');
    const name = page.locator('[data-line-name="max"]');
    assert.equal(await list.locator('option:not([hidden])').count(), 13);
    await list.selectOption('1.333');
    assert.equal(await base.inputValue(), '1.333');
    assert.equal(await name.textContent(), 'Perfect fourth');
    assert.equal((await saved()).type.ratio.max, 1.333);
    await base.click();
    assert.equal(await base.evaluate((node) => node.value.slice(node.selectionStart, node.selectionEnd)), '1.333', 'a click selects the figure, ready to be typed over');
    await page.keyboard.type('1,3');
    await page.keyboard.press('Enter');
    assert.equal(await base.inputValue(), '1.30');
    assert.equal(await name.textContent(), 'Custom');
    assert.equal(await list.evaluate((node) => node.selectedOptions[0].textContent), 'Custom (1.30)');
    assert.equal((await saved()).type.ratio.max, 1.3);
    await base.fill('nonsense');
    await base.press('Enter');
    assert.equal(await base.inputValue(), '1.30', 'what is no number changes nothing');
    await base.fill('1.5');
    await base.press('Escape');
    assert.equal(await base.inputValue(), '1.30', 'Escape takes back what was typed');
    await list.selectOption('1.25');
    assert.equal(await list.locator('option[value="custom"]').evaluate((node) => node.hidden), true);
    assert.equal(await name.textContent(), 'Major third');
    assert.equal((await saved()).type.ratio.max, 1.25);

    // The breakpoints go anywhere on the line, as long as left is not above right, and may share a width.
    const track = await page.locator('[data-line-track]').boundingBox();
    const leftX = (width) => track.x + track.width * (width - 320) / 1600;
    const widthField = (key) => page.locator(`[data-line-px="${key}"]`);
    const breakpoints = async () => (await saved()).type.breakpoints;
    assert.deepEqual(await breakpoints(), { min: 390, max: 1440 });
    await widthField('min').fill('690');
    await widthField('min').press('Enter');
    assert.deepEqual(await breakpoints(), { min: 690, max: 1440 });
    await widthField('min').fill('5000');
    await widthField('min').press('Enter');
    assert.equal(await widthField('min').inputValue(), '1440');
    assert.deepEqual(await breakpoints(), { min: 1440, max: 1440 });
    for (const end of ['min', 'max']) {
      const stack = await page.locator(`[data-stack="${end}"]`).boundingBox();
      const other = await page.locator(`[data-stack="${end === 'min' ? 'max' : 'min'}"]`).boundingBox();
      assert.ok(stack.x + stack.width <= other.x || other.x + other.width <= stack.x, 'the labels of one width stand side by side');
    }
    const atLine = await page.locator('[data-arrow="max"]').boundingBox();
    const dragArrow = async (from, to) => {
      await page.mouse.move(from, atLine.y + atLine.height / 2);
      await page.mouse.down();
      await page.mouse.move(to, atLine.y + atLine.height / 2, { steps: 8 });
      await page.mouse.up();
    };
    await dragArrow(leftX(1440), leftX(1024));
    assert.deepEqual(await breakpoints(), { min: 1024, max: 1440 }, 'dragged left, the left one came along');
    await dragArrow(leftX(1024), leftX(1800));
    assert.deepEqual(await breakpoints(), { min: 1440, max: 1440 }, 'the left one stops at the right one');
    await dragArrow(leftX(1440), leftX(1920));
    assert.deepEqual(await breakpoints(), { min: 1440, max: 1920 }, 'dragged right, the right one came along');
    await page.locator('[data-arrow="max"]').focus();
    await page.keyboard.press('Home');
    assert.deepEqual(await breakpoints(), { min: 1440, max: 1440 }, 'the keys keep the same limit');
    assert.equal(await page.locator('[data-arrow="max"]').evaluate((node) => getComputedStyle(node).outlineStyle + getComputedStyle(node.querySelector('svg')).outlineStyle), 'nonenone', 'an arrow has no focus ring');
    // Name, base and width stay centred on an arrow, also at the very ends of the line.
    await widthField('min').fill('320');
    await widthField('min').press('Enter');
    await widthField('max').fill('1920');
    await widthField('max').press('Enter');
    const centre = async (selector) => {
      const place = await page.locator(selector).boundingBox();
      return place.x + place.width / 2;
    };
    for (const end of ['min', 'max']) {
      const at = await centre(`[data-arrow="${end}"]`);
      for (const part of [`.line-stack[data-stack="${end}"] .line-name`, `[data-line-base="${end}"]`, `[data-line-label="${end}"]`])
        assert.ok(Math.abs(await centre(part) - at) < 1, `${part} on the arrow`);
    }
    await widthField('max').fill('1440');
    await widthField('max').press('Enter');
    await widthField('min').fill('390');
    await widthField('min').press('Enter');
    await breakpoints();

    // The hollow arrow says which width the rows show; it changes nothing in the design.
    const shown = (key) => page.locator(`[data-step-sample="${key}"]`).evaluate((node) => parseFloat(node.style.fontSize));
    const wide = await shown('display');
    await widthField('view').fill('390');
    await widthField('view').press('Enter');
    assert.ok(await shown('display') < wide);
    assert.equal(await page.locator('[data-size="lead"]').textContent(), `${Math.round(await shown('lead'))} px`);
    await widthField('view').fill('1440');
    await widthField('view').press('Enter');

    // However large the scale, a row shows its whole text, and a step leaves the button under the pointer.
    await page.locator('[data-ratio="min"]').selectOption('1.25');
    await list.selectOption('1.5');
    await page.waitForFunction(() => parseFloat(document.querySelector('[data-step-sample="display"]').style.fontSize) > 150);
    for (const key of ['display', 'heading-1', 'heading-2']) {
      const [font, height] = await page.locator(`[data-step-sample="${key}"]`).evaluate((node) => [parseFloat(getComputedStyle(node).fontSize), node.getBoundingClientRect().height]);
      assert.ok(height >= font * 1.2, `${key}: ${height} for ${font}`);
      assert.ok((await page.locator('.step', { has: page.locator(`[data-step-sample="${key}"]`) }).boundingBox()).height > height, key);
    }
    const plus = page.locator('[data-step="heading-1"][data-delta="1"]');
    await plus.scrollIntoViewIfNeeded();
    const before = await plus.boundingBox();
    await plus.click();
    await page.waitForTimeout(200);
    assert.deepEqual(await plus.boundingBox(), before);

    const file = JSON.parse(await readFile(tool.path, 'utf8'));
    validateDesignFile(file);
    assert.deepEqual(file.resolved, await resolve(file.inputs));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/presentation-role-tests', { recursive: true, force: true });
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/konzilo-tool', { recursive: true, force: true });
  }
});

test('the menu never runs its two parts together, and a restarted tool keeps the work in a window', { timeout: 180000 }, async () => {
  const directory = pathResolve('node_modules/.cache/presentation-restart-tests');
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'one.design.json');
  const other = join(directory, 'other.design.json');
  await Promise.all([path, other].map((file) => rm(file, { force: true })));
  const browser = await chromium.launch();
  try {
    const first = await startTool({ designFile: path, port: 0, open: false });
    const port = first.server.address().port;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(first.url);
    await page.locator('.chapter', { hasText: 'Shape' }).click();
    await page.locator('.page-link', { hasText: 'Corners' }).click();

    // Words in the status take room, and the left part goes to two lines rather than under the right part.
    const apart = () => page.evaluate(() => {
      const [row] = document.querySelectorAll('.menu-row');
      const left = document.getElementById('chapters').getBoundingClientRect();
      const right = row.querySelector('.menu-end').getBoundingClientRect();
      const inside = [...document.querySelectorAll('#chapters .chapter')].every((button) => button.getBoundingClientRect().right <= right.left + 0.5);
      return { inside, separate: left.right <= right.left + 0.5, height: row.getBoundingClientRect().height };
    });
    const oneLine = await apart();
    assert.deepEqual([oneLine.inside, oneLine.separate], [true, true]);
    await page.evaluate(() => {
      document.getElementById('status').dataset.state = 'error';
      document.getElementById('status-text').textContent = 'A long message about the save';
    });
    const twoLines = await apart();
    assert.deepEqual([twoLines.inside, twoLines.separate], [true, true]);
    assert.ok(twoLines.height > oneLine.height, 'the row grows for its second line');
    await page.evaluate(() => {
      document.getElementById('status').dataset.state = 'saved';
      document.getElementById('status-text').textContent = 'Saved';
    });

    await first.close();
    const second = await startTool({ designFile: path, port, open: false });
    const corners = page.locator('[data-path="inputs.corner-profile"]');
    await corners.fill('40');
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved' && document.getElementById('status').dataset.state === 'saved');
    await page.waitForTimeout(100);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).inputs['corner-profile'], 40, 'the new session took over');
    await second.close();

    const third = await startTool({ designFile: other, port, open: false });
    const untouched = await readFile(other, 'utf8');
    await corners.fill('60');
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
    assert.match(await page.locator('#notice').textContent(), /another design open/);
    assert.equal(await readFile(other, 'utf8'), untouched, 'another design is not overwritten');
    assert.equal(JSON.parse(await readFile(path, 'utf8')).inputs['corner-profile'], 40);
    await third.close();
  } finally {
    await browser.close();
  }
});

test('the tool makes a missing file, writes nothing on opening, and backs up once before the first change', { timeout: 120000 }, async () => {
  const directory = pathResolve('node_modules/.cache/presentation-backup-tests');
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'name.design.json');
  const backup = join(directory, 'name.design.bak.json');
  const browser = await chromium.launch();
  try {
    const first = await startTool({ designFile: path, port: 0, open: false });
    assert.equal(first.created, true);
    const original = await readFile(path, 'utf8');
    await assert.rejects(readFile(backup, 'utf8'), { code: 'ENOENT' });
    const taken = first.server.address().port;
    await assert.rejects(startTool({ designFile: path, port: taken, open: false }), /Port \d+ is in use/);
    await first.close();

    const tool = await startTool({ designFile: path, port: 0, open: false });
    try {
      assert.equal(tool.created, false);
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(tool.url);
      await page.waitForFunction(() => document.querySelector('#preview')?.contentDocument?.querySelector('.kn-card'));
      await page.waitForTimeout(800);
      assert.equal(await readFile(path, 'utf8'), original);
      await assert.rejects(readFile(backup, 'utf8'), { code: 'ENOENT' });

      const change = async (text) => {
        await page.locator('[data-path="project.introduction"]').fill(text);
        await page.waitForFunction(() => document.querySelector('#status-text').textContent === 'Saved');
      };
      await change('First change.');
      assert.equal(await readFile(backup, 'utf8'), original);
      assert.equal(JSON.parse(await readFile(path, 'utf8')).project.introduction, 'First change.');
      await change('Second change.');
      assert.equal(await readFile(backup, 'utf8'), original);
      assert.equal(JSON.parse(await readFile(path, 'utf8')).project.introduction, 'Second change.');
    } finally {
      await tool.close();
    }
  } finally {
    await browser.close();
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/presentation-backup-tests', { recursive: true, force: true });
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/konzilo-tool', { recursive: true, force: true });
  }
});
