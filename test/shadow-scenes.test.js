// The Shadow page shows each shadow where a site has it, in a scene of its own: the header over content scrolled under
// it, an open panel, the page over its footer, cards on three Surfaces, and a card at rest and under the pointer. Each
// follows the design: a target switched off casts nothing, strength zero casts nothing anywhere, and Light and Dark apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { createPresentation } from '../tool/presentation.js';
import { SHADOW_SCENES } from '../presentation/src/catalog.js';

const root = resolve('node_modules/.cache/shadow-scenes-tests');
const copy = JSON.parse(await readFile('presentation/copy.json', 'utf8'));

function html(bytes) {
  const offset = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
  return inflateRawSync(bytes.subarray(offset, offset + bytes.readUInt32LE(18))).toString('utf8');
}

// What each scene holds and the shadows of the parts it names, as the browser draws them.
async function readScenes(page) {
  const scenes = {};
  for (const name of SHADOW_SCENES) {
    const id = `shadow-${name}`;
    await page.waitForFunction((id) => {
      const frame = document.querySelector(`[data-specimen-frame="${id}"]`);
      return frame?.contentDocument?.querySelector('.sample-root') && frame.contentDocument.readyState === 'complete';
    }, id);
    const frame = await (await page.$(`[data-specimen-frame="${id}"]`)).contentFrame();
    await frame.evaluate(() => document.fonts.ready);
    scenes[name] = await frame.evaluate(() => {
      const shown = (node) => !!node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0;
      const shadow = (node) => (node ? getComputedStyle(node).boxShadow : null);
      const cards = [...document.querySelectorAll('.kn-card')];
      return {
        mode: document.documentElement.dataset.knMode,
        header: shown(document.querySelector('.kn-header')),
        panel: shown(document.querySelector('.kn-megamenu')),
        footer: shown(document.querySelector('.kn-footer')),
        surfaces: cards.map((card) => card.dataset.knSurface),
        bar: shadow(document.querySelector('.kn-header-bar')),
        menu: shadow(document.querySelector('.kn-megamenu')),
        main: shadow(document.querySelector('.kn-page-main')),
        cards: cards.map(shadow),
      };
    });
    scenes[name].caption = await page.locator(`[data-specimen="${id}"] .specimen-note`).textContent();
    scenes[name].title = await page.locator(`[data-specimen-frame="${id}"]`).getAttribute('title');
  }
  return scenes;
}

test('the Shadow page shows each shadow in a scene of its own, and a target switched off casts none', { timeout: 300000 }, async () => {
  await mkdir(root, { recursive: true });
  const example = JSON.parse(await readFile('examples/example.design.json', 'utf8'));
  const designs = {
    on: { strength: 60, targets: { box: true, header: true, panel: true, page: true } },
    off: { strength: 60, targets: { box: false, header: false, panel: true, page: true } },
    zero: { strength: 0, targets: { box: true, header: true, panel: true, page: true } },
  };
  const files = {};
  for (const [name, shadow] of Object.entries(designs)) {
    const model = structuredClone(example);
    Object.assign(model.inputs.shadow, shadow);
    // The page casts its shadow on the footer only where the design gives it one (page.css).
    model.inputs.page = { shadow: true, 'edge-line': false };
    const design = join(root, `${name}.design.json`);
    const zip = join(root, `${name}.zip`);
    await writeFile(design, JSON.stringify(model));
    await createPresentation(design, zip, { date: '2026-11-11' });
    files[name] = join(root, `${name}.html`);
    await writeFile(files[name], html(await readFile(zip)));
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const open = async (name) => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${pathToFileURL(files[name]).href}#shadow`);
      await page.waitForFunction(() => document.querySelector('.document-page.is-current')?.id === 'shadow');
      return { page, errors };
    };

    const on = await open('on');
    const scenes = await readScenes(on.page);
    // Each scene shows the part it names, and no two show the same.
    assert.deepEqual(
      Object.fromEntries(Object.entries(scenes).map(([name, s]) => [name, [s.header, s.panel, s.footer, s.surfaces.join(' ')]])),
      {
        header: [true, false, false, ''],
        panel: [true, true, false, ''],
        page: [false, false, true, ''],
        box: [false, false, false, 'raised tint brand'],
        'box-lifted': [false, false, false, 'raised raised'],
      },
    );
    // Each is named by the copy that named the shadow before, and says what the shadow does.
    for (const name of SHADOW_SCENES) {
      assert.equal(scenes[name].title, copy[`shadow.${name}`]);
      assert.equal(scenes[name].caption, copy[`shadow.${name}.job`]);
    }
    // With every target on, each casts its shadow, and the card under the pointer lifts.
    assert.notEqual(scenes.header.bar, 'none', 'the header over content');
    assert.notEqual(scenes.panel.menu, 'none', 'the open panel');
    assert.notEqual(scenes.page.main, 'none', 'the page over its footer');
    assert.ok(scenes.box.cards.every((value) => value !== 'none'), 'the cards');
    assert.notEqual(scenes['box-lifted'].cards[0], 'none');
    assert.notEqual(scenes['box-lifted'].cards[1], scenes['box-lifted'].cards[0], 'the lifted card');
    // Dark mode from the page's toolbar reaches the scenes, and a dark page's shadow is inked anew.
    assert.equal(scenes.header.mode, 'light');
    await on.page.locator('#shadow [data-frame-mode] [data-value="dark"]').click();
    const dark = await readScenes(on.page);
    assert.ok(SHADOW_SCENES.every((name) => dark[name].mode === 'dark'));
    assert.notEqual(dark.header.bar, scenes.header.bar);
    assert.deepEqual(on.errors, []);
    await on.page.close();

    const off = await open('off');
    const without = await readScenes(off.page);
    assert.equal(without.header.bar, 'none', 'a header that casts none');
    assert.ok([...without.box.cards, ...without['box-lifted'].cards].every((value) => value === 'none'), 'cards that cast none');
    assert.notEqual(without.panel.menu, 'none', 'the panel still casts its own');
    assert.notEqual(without.page.main, 'none', 'and the page its own');
    // Where the design has shadows but this one casts none, its caption says so, and only there.
    for (const name of SHADOW_SCENES) {
      assert.equal(without[name].caption.includes(copy['shadow.none']), ['header', 'box', 'box-lifted'].includes(name), name);
    }
    assert.deepEqual(off.errors, []);
    await off.page.close();

    const zero = await open('zero');
    const none = await readScenes(zero.page);
    assert.ok(Object.values(none).every((s) => [s.bar, s.menu, s.main, ...s.cards].every((value) => value === null || value === 'none')), 'strength zero casts nothing anywhere');
    assert.ok(Object.values(none).every((s) => !s.caption.includes(copy['shadow.none'])), 'and the page says so once, above the scenes');
    assert.equal(await zero.page.locator('#shadow .page-content > p.prose').textContent(), copy['shadow.off']);
    assert.deepEqual(zero.errors, []);
    await zero.page.close();
  } finally {
    await browser.close();
    await rm(root, { recursive: true, force: true });
  }
});
