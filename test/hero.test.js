import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'ultrahtml';
import { querySelector as one } from 'ultrahtml/selector';
import { chromium } from 'playwright-core';
import { render } from './helpers/render.js';
import { startTool } from '../tool/server.js';

const hero = async (props) => one(parse(await render('Hero', { heading: 'A heading', ...props })), '.kn-hero');
const heading = (node) => one(node, '.kn-heading-group-heading').attributes['data-kn-type'];

test('a hero\'s background and heading are free of each other', async () => {
  const plain = await hero({});
  assert.equal(plain.attributes['data-kn-surface'], undefined, 'without a surface it shows what lies beneath');
  assert.equal(heading(plain), 'heading-1');
  assert.equal(heading(await hero({ type: 'display' })), 'display');
  const coloured = await hero({ surface: 'brand', type: 'display' });
  assert.equal(coloured.attributes['data-kn-surface'], 'brand');
  assert.equal(heading(coloured), 'display');
  const white = await hero({ surface: 'page' });
  assert.equal(white.attributes['data-kn-surface'], 'page');
});

test('a picture lies behind on a picture Surface and otherwise stands beside the text', async () => {
  const behind = await hero({ surface: 'picture-dark', picture: '/a.webp' });
  assert.match(behind.attributes.style, /--kn-picture-image/);
  assert.equal(behind.attributes['data-kn-picture'], undefined);
  assert.ok(!one(behind, '.kn-hero-media'));
  const beside = await hero({ surface: 'brand', picture: '/a.webp', alt: '' });
  assert.equal(beside.attributes['data-kn-picture'], 'beside');
  assert.equal(one(beside, '.kn-hero-media img').attributes.src, '/a.webp');
  await assert.rejects(hero({ picture: '/a.webp' }), /requires alternative text/);
});

test('a hero says how much of the screen it takes and where its text stands', async () => {
  const plain = await hero({});
  assert.equal(plain.attributes['data-kn-height'], undefined);
  assert.equal(plain.attributes['data-kn-place'], undefined);
  const tall = await hero({ height: 'two-thirds', place: 'bottom' });
  assert.equal(tall.attributes['data-kn-height'], 'two-thirds');
  assert.equal(tall.attributes['data-kn-place'], 'bottom');
});

test('a hero takes half of the screen too', async () => {
  assert.equal((await hero({ height: 'half' })).attributes['data-kn-height'], 'half');
});

test('the tool chooses the design\'s hero, and over a picture the overlay has its full strength where the text begins', { timeout: 240000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-hero-'));
  const tool = await startTool({ designFile: join(directory, 'client.design.json'), port: 0, open: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Components' }).click();
    const preview = await (await page.$('#preview')).contentFrame();
    await preview.waitForSelector('[data-component="hero"] [data-kn-live-hero]');
    const pick = (name, value) => page.locator(`[data-pick="inputs.hero.${name}"][data-value="${value}"]`);
    const measure = () => preview.locator('[data-component="hero"] .kn-hero').evaluate((node) => {
      const content = node.querySelector('.kn-hero-content');
      const before = getComputedStyle(content, '::before');
      const box = node.getBoundingClientRect();
      const text = node.querySelector('.kn-hero-text').getBoundingClientRect();
      const fade = parseFloat(before.top) * -1;
      return {
        height: box.height,
        spaceBelowText: box.bottom - text.bottom,
        spaceAboveText: text.top - box.top,
        strongFrom: content.getBoundingClientRect().top + parseFloat(before.top) + fade,
        textTop: text.top,
        gradient: before.backgroundImage,
        image: getComputedStyle(node).backgroundImage,
      };
    });
    const settled = (height, place) => preview.waitForFunction(([wanted, at]) => {
      const node = document.querySelector('[data-component="hero"] .kn-hero');
      return node.dataset.knHeight === wanted && (node.dataset.knPlace ?? 'center') === at;
    }, [height, place]);
    const screen = 1440 * 0.625;
    for (const [height, share] of [['half', 1 / 2], ['two-thirds', 2 / 3], ['full', 1]]) {
      await pick('height', height).click();
      await pick('place', 'center').click();
      await settled(height, 'center');
      const centred = await measure();
      assert.ok(centred.height >= screen * share - 1, `${height}: at least its share`);
      assert.ok(Math.abs(centred.spaceAboveText - centred.spaceBelowText) < 2, `${height}: centred`);
      assert.match(centred.image, /linear-gradient/, `${height}: centred has an even overlay on the band`);
      await pick('place', 'bottom').click();
      await settled(height, 'bottom');
      const bottom = await measure();
      assert.doesNotMatch(bottom.image, /linear-gradient/, `${height}: at the bottom the even overlay is gone`);
      assert.match(bottom.gradient, /0\.57\)/, `${height}: the fade ends at the Surface's tested strength`);
      assert.ok(bottom.strongFrom <= bottom.textTop + 1, `${height}: full strength by the top line`);
      assert.ok(bottom.spaceBelowText < bottom.spaceAboveText, `${height}: the text stands at the bottom`);
    }

    // A longer text moves the fade with it.
    await pick('height', 'full').click();
    await settled('full', 'bottom');
    const short = await measure();
    await preview.locator('[data-component="hero"] .kn-heading-group-deck').evaluate((node) => { node.textContent = node.textContent.repeat(8); });
    const long = await measure();
    assert.ok(long.textTop < short.textTop - 20);
    assert.ok(long.strongFrom <= long.textTop + 1);

    // At a third the text fills the height, so it stays centred, whatever was chosen before.
    await pick('height', 'third').click();
    await settled('third', 'center');
    assert.equal(await pick('place', 'bottom').isDisabled(), true);
    assert.equal(await pick('place', 'center').getAttribute('aria-pressed'), 'true');
    await pick('height', 'half').click();
    await settled('half', 'bottom');
    assert.equal(await pick('place', 'bottom').isDisabled(), false);

    // The sample's grey bars stand for what follows, within the screen, and no words of their own.
    const rest = preview.locator('[data-component="hero"] .hero-rest');
    assert.equal(await rest.getAttribute('aria-hidden'), 'true');
    assert.equal((await rest.textContent()).trim(), '');
    assert.ok(await rest.locator('i').count() > 3);

    // Background and heading.
    assert.equal(await page.locator('[data-path="inputs.hero.surface"]').isDisabled(), true);
    await page.locator('[data-path="inputs.hero.overlay"]').selectOption('light');
    await preview.waitForSelector('[data-component="hero"] .kn-hero[data-kn-surface="picture-light"]');
    await pick('picture', 'beside').click();
    await preview.waitForSelector('[data-component="hero"] .kn-hero[data-kn-picture="beside"] > .kn-hero-content > .kn-hero-media img[src]');
    assert.equal(await page.locator('[data-path="inputs.hero.overlay"]').isDisabled(), true);
    assert.equal(await preview.locator('[data-component="hero"] .kn-hero').evaluate((node) => node.style.getPropertyValue('--kn-picture-image')), '');
    await pick('height', 'two-thirds').click();
    const beside = await preview.locator('[data-component="hero"] .kn-hero').evaluate((node) => ({ hero: node.getBoundingClientRect().height, picture: node.querySelector('.kn-hero-media').getBoundingClientRect().height }));
    assert.ok(beside.picture > beside.hero * 0.6, 'the picture takes the height of a tall hero');
    await page.locator('[data-path="inputs.hero.surface"]').selectOption('brand');
    await preview.waitForSelector('[data-component="hero"] .kn-hero[data-kn-surface="brand"]');
    await pick('picture', 'none').click();
    await preview.waitForFunction(() => !document.querySelector('[data-component="hero"] .kn-hero-media'));
    await pick('type', 'display').click();
    await preview.waitForSelector('[data-component="hero"] .kn-heading-group-heading[data-kn-type="display"]');
    await page.locator('[data-path="inputs.hero.surface"]').selectOption('none');
    await preview.waitForFunction(() => !document.querySelector('[data-component="hero"] .kn-hero').hasAttribute('data-kn-surface'));

    // The choice is the design's, so it is saved.
    await page.waitForFunction(() => document.querySelector('#status-text').textContent === 'Saved');
    assert.equal(JSON.parse(await readFile(tool.path, 'utf8')).inputs.hero.type, 'display');

    // Outside a sample's made-up screen, the share is of the window, and tall content grows past it.
    const direct = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await direct.goto(`${tool.url}/catalogue.html`);
    const real = await direct.locator('[data-component="hero"] .kn-hero').evaluate((node) => {
      node.dataset.knHeight = 'full';
      document.body.prepend(node);
      return { full: node.getBoundingClientRect().height, window: innerHeight };
    });
    assert.equal(Math.round(real.full), real.window);
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});
