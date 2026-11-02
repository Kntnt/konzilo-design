import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve as pathResolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
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
    'header', 'footer', 'page', 'opening', 'sections', 'text', 'buttons',
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
  sources.push(await readFile('tool/presentation.js', 'utf8'));
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
    ...[400, 500, 600].map((name) => `weight.${name}`),
    ...[1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618].map((name) => `scale.${name}`),
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
      assert.equal((html.match(/data:font\/woff2;base64/g) || []).length, 3);
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
      await page.locator('[data-nav-chapter="components"] .nav-chapter-link').click();
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
      await page.locator('#header .variants > summary').click();
      assert.equal(await page.locator('#header .variants').getAttribute('open'), '');
      await readyFrame(page, 'headers');
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

test('tool saves presentation prose, keeps controls still and serves the exported HTML', { timeout: 60000 }, async () => {
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
    const preview = await (await page.locator('#preview').elementHandle()).contentFrame();
    await page.locator('[data-path="project.introduction"]').fill('A useful introduction.');
    await page.locator('[data-path="project.contact.name"]').fill('Design owner');
    await page.locator('[data-path="project.contact.email"]').fill('review@example.invalid');
    await page.locator('[data-path="project.explanations.colour"]').fill('Chosen for clarity.');
    const control = page.locator('[data-path="inputs.corner-profile"]');
    await control.scrollIntoViewIfNeeded();
    const before = await control.boundingBox();
    await page.mouse.move(before.x + 8, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width * 0.92, before.y + before.height / 2, { steps: 12 });
    await page.mouse.up();
    assert.deepEqual(await control.boundingBox(), before);
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
    assert.equal(await page.locator('#result a').getAttribute('href'), '/api/presentation-file');
    const refused = await fetch(tool.url + '/api/presentation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(refused.status, 403);
    assert.match(await preview.locator('.kn-header-identity').getAttribute('aria-label'), /Example/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/presentation-tool-tests', { recursive: true, force: true });
    await rm('/Users/thomas/Projects/konzilo-design/node_modules/.cache/konzilo-tool', { recursive: true, force: true });
  }
});
