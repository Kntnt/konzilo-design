// The left side of the tool in a real browser: nothing moves there when a control is pressed, the
// pages keep one order and one menu, every control says what it does and shows what the model holds.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startTool } from '../tool/server.js';
import { failContrastOn, failingColour } from './helpers/failing-contrast.js';

let directory;
let path;
let tool;
let browser;
let STEP_ROWS;
let CHAPTERS;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kn-controls-'));
  path = join(directory, 'controls.design.json');
  tool = await startTool({ designFile: path, port: 0, open: false });
  browser = await chromium.launch();
  // The tool's own lists, as the browser has them: the module's imports only resolve there.
  const page = await browser.newPage();
  await page.goto(tool.url);
  ({ STEP_ROWS, CHAPTERS } = await page.evaluate(async () => {
    const pages = await import('/tool/pages.js');
    return { STEP_ROWS: pages.STEP_ROWS, CHAPTERS: pages.CHAPTERS };
  }));
  await page.close();
}, { timeout: 180000 });
after(async () => {
  await browser?.close();
  await tool?.close();
  await rm(directory, { recursive: true, force: true });
});

const STORE = 'konzilo-tool-ui';
async function opened({ width = 1440, height = 900, stored } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (error) => page.errors.push(error.message));
  await failContrastOn(page);
  if (stored) await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORE, JSON.stringify(stored)]);
  await page.goto(tool.url);
  await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
  // A typeface arriving late changes widths, which is not what is measured here.
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const pagesOf = () => CHAPTERS.flatMap(([chapter, pages]) => pages.map((id) => [chapter, id]));
async function turnTo(page, chapter, id) {
  await page.locator(`.chapter[data-chapter="${chapter}"]`).click();
  await page.locator(`.page-link[data-go="${id}"]`).click();
}
const settled = (page) => page.waitForFunction(() => document.getElementById('status').dataset.state === 'saved');
const onDisk = async () => JSON.parse(await readFile(path, 'utf8'));

// Where every control on the shown page stands, in the document rather than on the screen.
const controlsNow = (page) => page.evaluate(() => {
  const host = document.querySelector('#form > [data-page]:not([hidden])');
  const scroll = document.getElementById('document').scrollTop;
  const name = (node, index) => {
    const { path: p, step, delta, ratio, lineBase, linePx, arrow, go } = node.dataset;
    return p ?? (step && `${step} ${delta}`) ?? (ratio && `menu ${ratio}`) ?? (lineBase && `base ${lineBase}`) ?? (linePx && `width ${linePx}`) ?? (arrow && `arrow ${arrow}`) ?? (go && `next ${go}`) ?? `${node.tagName} ${index}`;
  };
  return Object.fromEntries([...host.querySelectorAll('button, input:not([type="file"]), select, textarea, [role="slider"]')]
    .filter((node) => node.getClientRects().length)
    .map((node, index) => {
      const box = node.getBoundingClientRect();
      return [name(node, index), [box.left, box.top + scroll, box.width, box.height].map((value) => Math.round(value * 10) / 10)];
    }));
});
function assertStill(before, now, what, own = []) {
  assert.deepEqual(Object.keys(now).sort(), Object.keys(before).sort(), what);
  for (const [key, place] of Object.entries(before)) {
    if (own.includes(key)) continue;
    assert.ok(place.every((value, index) => Math.abs(value - now[key][index]) <= 0.5), `${what}: ${key} went from ${place} to ${now[key]}`);
  }
}

test('on the type scale nothing moves, whichever control is pressed or dragged to whichever end, and the samples keep their true size', { timeout: 180000 }, async () => {
  const page = await opened();
  await turnTo(page, 'typography', 'type-scale');
  await page.waitForFunction(() => document.querySelector('[data-arrow="min"]').style.left);
  const start = await controlsNow(page);
  const rows = () => page.locator('[data-page="type-scale"] .step').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  assert.deepEqual(await rows(), STEP_ROWS.map(([, , height]) => height * 16));
  const samplesTrue = async (what) => {
    for (const [key] of STEP_ROWS) {
      const shown = Number.parseInt(await page.locator(`[data-size="${key}"]`).textContent());
      const real = await page.locator(`[data-step-sample="${key}"]`).evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      assert.equal(Math.round(real), shown, `${what}: ${key} is shown at the size it says`);
    }
  };
  await samplesTrue('as it starts');
  // At the design's own sizes every sample stands whole in its row.
  for (const [key] of STEP_ROWS) {
    const [text, row] = await page.locator(`[data-step-sample="${key}"]`).evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return [range.getBoundingClientRect().height, node.getBoundingClientRect().height];
    });
    assert.ok(text <= row, `${key} takes ${text} in a row of ${row}`);
  }
  const still = async (what, own) => {
    assertStill(start, await controlsNow(page), what, own);
    assert.deepEqual(await rows(), STEP_ROWS.map(([, , height]) => height * 16), what);
  };
  const drag = async (locator, targets, what, own) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (const x of targets) {
      await page.mouse.move(x, box.y + box.height / 2, { steps: 4 });
      await still(`${what}, held at ${x}`, own);
      await samplesTrue(`${what}, held at ${x}`);
    }
    await page.mouse.up();
    await still(`${what}, let go`, own);
  };

  // The two body sizes, by the pointer, to both ends and held there.
  for (const end of ['min', 'max']) {
    const slider = page.locator(`[data-path="inputs.type.body-size.${end}"]`);
    const box = await slider.boundingBox();
    await drag(slider, [box.x - 40, box.x + box.width + 40], `body ${end}`);
    assert.equal(await slider.inputValue(), await slider.getAttribute('max'));
    await page.locator('#undo').click();
  }

  // Each stepper, pressed all the way in both directions, by the pointer for the largest and as fast as the rest allow.
  const plus = page.locator('[data-step="display"][data-delta="1"]');
  await plus.click();
  await still('display one step up');
  for (const [key] of STEP_ROWS) {
    for (const delta of [1, -1]) {
      const pressed = await page.evaluate(([style, way]) => {
        const button = document.querySelector(`[data-step="${style}"][data-delta="${way}"]`);
        let count = 0;
        while (!button.disabled && count < 30) {
          button.click();
          count += 1;
        }
        return count;
      }, [key, delta]);
      await still(`${key} ${delta > 0 ? 'up' : 'down'} ${pressed} steps`);
      await samplesTrue(`${key} ${delta > 0 ? 'up' : 'down'}`);
      if (key === 'display' && delta > 0) assert.notEqual(await page.locator('#scale-warning').textContent(), '', 'the warning has come, and moved nothing');
    }
  }

  // The named scales at both ends, and a base of no name.
  for (const end of ['min', 'max']) {
    for (const value of ['1.067', '2']) {
      await page.locator(`[data-ratio="${end}"]`).selectOption(value);
      await still(`menu ${end} on ${value}`);
    }
    for (const typed of ['1', '2', '1.173']) {
      await page.locator(`[data-line-base="${end}"]`).fill(typed);
      await page.keyboard.press('Enter');
      await still(`base ${end} typed ${typed}`);
    }
    assert.equal(await page.locator(`[data-line-name="${end}"]`).textContent(), 'Custom');
    await page.locator(`[data-ratio="${end}"]`).selectOption('1.414');
    await still(`menu ${end} on the longest name`);
    await page.locator(`[data-ratio="${end}"]`).selectOption(end === 'min' ? '1.067' : '1.125');
    await page.waitForTimeout(10);
    await still(`menu ${end} back`);
  }

  // The arrows, each to both ends of the line. Only an arrow's own labels go with it, even past where they would meet.
  const line = await page.locator('[data-line-track]').boundingBox();
  const lineEnds = [line.x - 40, line.x + line.width + 40];
  const ownOf = (end) => [`arrow ${end}`, `base ${end}`, `menu ${end}`, `width ${end}`];
  await drag(page.locator('[data-arrow="min"]'), lineEnds, 'left arrow', ownOf('min'));
  await page.locator('#undo').click();
  await page.locator('[data-arrow="view"]').evaluate((node) => node.focus());
  await drag(page.locator('[data-arrow="view"]'), lineEnds, 'width shown', ['arrow view', 'width view']);
  await page.locator('[data-line-px="view"]').fill('1440');
  await page.keyboard.press('Enter');
  await drag(page.locator('[data-arrow="max"]'), lineEnds, 'right arrow', ownOf('max'));
  await page.locator('#undo').click();

  // The widths typed: the same again.
  await page.locator('[data-line-px="min"]').fill('1400');
  await page.keyboard.press('Enter');
  await still('left width typed', ownOf('min'));
  await page.locator('#undo').click();
  await page.locator('[data-line-px="max"]').fill('1400');
  await page.keyboard.press('Enter');
  await still('right width typed', ownOf('max'));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('what a setting does to a sample or a typeface moves nothing below it on the other pages either', { timeout: 60000 }, async () => {
  const page = await opened();
  const toEnds = async (selector, what) => {
    const start = await controlsNow(page);
    const slider = page.locator(selector);
    const value = await slider.inputValue();
    for (const end of ['min', 'max']) {
      await slider.evaluate((node, name) => {
        node.value = node[name];
        node.dispatchEvent(new Event('input', { bubbles: true }));
      }, end);
      assertStill(start, await controlsNow(page), `${what} at its ${end}`);
    }
    await slider.evaluate((node, was) => {
      node.value = was;
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  await turnTo(page, 'space', 'space');
  await toEnds('[data-path="inputs.density-profile"]', 'density');
  await turnTo(page, 'space', 'corners');
  await toEnds('[data-path="inputs.frame.width"]', 'the frame');
  await toEnds('[data-path="inputs.corner-profile"]', 'the corners');
  await turnTo(page, 'typography', 'main-typeface');
  for (const role of ['main', 'display', 'label']) {
    await page.locator(`[data-role-tab="${role}"]`).click();
    await toEnds('[data-axis="spacing"]', `the spacing of ${role}`);
    await toEnds('[data-axis="wght"]', `the weight of ${role}`);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('every chapter\'s page runs heading, controls, explanation and next, and the first page does too', { timeout: 60000 }, async () => {
  const page = await opened();
  for (const [index, [, id]] of pagesOf().entries()) {
    const order = await page.locator(`[data-page="${id}"]`).evaluate((host) => [...host.children].map((node) => node.className.split(' ')[0]));
    assert.equal(order[0], 'page-head', id);
    const last = pagesOf().length - 1;
    if (index < last) assert.equal(order.at(-1), 'next', `${id} ends with the way on`);
    const firstWhy = order.indexOf('why');
    if (firstWhy >= 0) assert.ok(order.slice(firstWhy).every((name) => name === 'why' || name === 'next'), `${id}: an explanation comes after the controls and examples: ${order}`);
  }
  await page.locator('[data-page="start"] .next').click();
  assert.equal(await page.locator('#form > [data-page]:not([hidden])').getAttribute('data-page'), 'colour-scale');
  await page.context().close();
});

test('the menu has one height on every page at any pane width, and a page\'s heading always stands in the same place', { timeout: 180000 }, async () => {
  const widths = [[1040, 490], [1440, 540], [1900, 700], [1900, 1000]];
  for (const [window, pane] of widths) {
    const page = await opened({ width: window, stored: { controls: pane, atOptimal: false } });
    assert.equal(await page.locator('.controls').evaluate((node) => node.offsetWidth), pane);
    const seen = new Map();
    const links = new Map();
    for (const [chapter, id] of pagesOf()) {
      await turnTo(page, chapter, id);
      const place = await page.evaluate((shown) => {
        const box = (node) => node.getBoundingClientRect();
        return {
          menu: box(document.querySelector('.menu')).height,
          heading: box(document.querySelector(`[data-page="${shown}"] h1`)).top,
          export: box(document.getElementById('design-md')).top,
          firstLink: box(document.querySelector('.page-link')).top,
        };
      }, id);
      const lines = await page.locator('.page-link').evaluateAll((nodes) => new Set(nodes.map((node) => node.getBoundingClientRect().top)).size);
      assert.ok(lines <= 2, `${id} at ${pane}: ${lines} lines of links`);
      seen.set(JSON.stringify(place), id);
      // Becoming current wraps nothing: each link stays where it was and as wide.
      const boxes = await page.locator('.page-link').evaluateAll((nodes) => JSON.stringify(nodes.map((node) => {
        const { left, top, width } = node.getBoundingClientRect();
        return [left, top, width];
      })));
      links.set(chapter, (links.get(chapter) ?? new Set()).add(boxes));
    }
    assert.equal(seen.size, 1, `at ${pane}: ${[...seen.keys()].join(' ')}`);
    for (const [chapter, boxes] of links) assert.equal(boxes.size, 1, `${chapter} at ${pane}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
  // The panes one above the other, in a small window, hold to it as well.
  for (const window of [800, 600]) {
    const page = await opened({ width: window });
    const places = new Set();
    for (const [chapter, id] of pagesOf()) {
      await turnTo(page, chapter, id);
      places.add(await page.evaluate((shown) => {
        document.scrollingElement.scrollTop = 0;
        return document.querySelector(`[data-page="${shown}"] h1`).getBoundingClientRect().top;
      }, id));
    }
    assert.equal(places.size, 1, `in a window of ${window}: ${[...places]}`);
    await page.context().close();
  }
  // A setting that fails the contrast check shows its status in the menu, and that takes no height either.
  for (const width of [1040, 1440, 1900]) {
    const page = await opened({ width, stored: width === 1900 ? { controls: 700, atOptimal: false } : undefined });
    await turnTo(page, 'colour', 'colour-scale');
    const before = await page.locator('.menu').evaluate((node) => node.offsetHeight);
    const chapters = () => page.locator('.chapter').evaluateAll((nodes) => new Set(nodes.map((node) => node.getBoundingClientRect().top)).size);
    await page.locator('[data-hex="primary"]').fill(failingColour);
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
    assert.equal(await page.locator('.menu').evaluate((node) => node.offsetHeight), before);
    assert.equal(await chapters(), 1);
    // With room for them, the words are there.
    if (width === 1900) assert.equal(await page.locator('#status-text').evaluate((node) => node.getBoundingClientRect().width > 20), true);
    await page.locator('#undo').click();
    await settled(page);
    await page.context().close();
  }
});

test('every control has a tooltip, and turning pages leaves none behind', { timeout: 60000 }, async () => {
  const page = await opened();
  const bare = () => page.evaluate(() => [...document.querySelectorAll('#tool button, #tool input:not([type="file"]), #tool select, #tool textarea, #tool [role="slider"]')]
    // What is only a sample of a component is not a control of the tool.
    .filter((node) => !node.closest('.kn-field, .surface-tile'))
    .filter((node) => !document.getElementById(node.closest('[data-g-tooltip]')?.dataset.gTooltip)?.textContent.trim())
    .map((node) => node.outerHTML.slice(0, 80)));
  for (const [chapter] of CHAPTERS) {
    await page.locator(`.chapter[data-chapter="${chapter}"]`).click();
    assert.deepEqual(await bare(), [], chapter);
  }
  await turnTo(page, 'typography', 'main-typeface');
  await page.locator('[data-role-tab="main"]').click();
  assert.ok(await page.locator('[data-axes] [data-set]').count() > 0, 'the typeface has alternate letters');
  assert.deepEqual(await bare(), []);
  const shows = async (locator, words) => {
    await page.mouse.move(0, 0);
    await locator.hover();
    assert.match(await page.locator('.g-control-tip:not([hidden])').textContent(), words);
  };
  await shows(page.locator('.page-link[data-go="type-scale"]'), /The type scale/);
  await shows(page.locator('[data-page="main-typeface"] .next'), /next page: The type scale/);
  // On the words beside the box as well as on the box.
  await shows(page.locator('[data-axes] .axis-sets label').first(), /alternate/);
  await shows(page.locator('[data-axes] [data-set]').first(), /alternate/);
  await page.locator('[data-axes] [data-set]').first().focus();
  assert.match(await page.locator('.g-control-tip:not([hidden])').textContent(), /alternate/);
  // The notice's own button, and the real-size button, whose words follow what it does.
  await shows(page.locator('#fit'), /Scaled so the whole page fits/);
  await page.locator('#fit').click();
  await shows(page.locator('#fit'), /Real size/);
  await page.locator('#fit').click();

  const count = () => page.locator('.g-control-tip').count();
  const tips = await count();
  for (const [chapter] of [...CHAPTERS, ...CHAPTERS]) await page.locator(`.chapter[data-chapter="${chapter}"]`).click();
  for (const role of ['heading', 'label', 'main']) {
    await turnTo(page, 'typography', 'main-typeface');
    await page.locator(`[data-role-tab="${role}"]`).click();
  }
  assert.equal(await count(), tips);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a label stands as far above its control on every page, and group titles and fields keep one size', { timeout: 60000 }, async () => {
  const page = await opened();
  const gaps = [];
  for (const [chapter, id] of pagesOf()) {
    await turnTo(page, chapter, id);
    const found = await page.evaluate((shown) => {
      const host = document.querySelector(`[data-page="${shown}"]`);
      const shownNodes = (selector) => [...host.querySelectorAll(selector)].filter((node) => node.getClientRects().length);
      const textBottom = (node) => {
        const range = document.createRange();
        range.selectNode(node);
        return range.getBoundingClientRect().bottom;
      };
      return {
        gaps: shownNodes('.field').map((field) => textBottom(field.firstChild) - field.lastElementChild.getBoundingClientRect().top),
        titles: shownNodes('.setting-title').map((node) => {
          const style = getComputedStyle(node);
          return `${style.fontSize} ${style.fontWeight}`;
        }),
        heights: shownNodes('.input, .choice select').filter((node) => !node.closest('.small')).map((node) => node.getBoundingClientRect().height),
      };
    }, id);
    for (const gap of found.gaps) gaps.push(gap);
    for (const title of found.titles) assert.equal(title, '13px 600', id);
    for (const height of found.heights) assert.equal(height, 34, id);
  }
  assert.ok(gaps.length > 15, `${gaps.length} labels`);
  assert.equal(new Set(gaps.map((gap) => Math.round(gap))).size, 1, `gaps of ${[...new Set(gaps)]}`);
  await page.context().close();
});

test('the identity has its four controls, none disabled, nothing on the left moves, and the header and footer follow live', { timeout: 120000 }, async () => {
  const page = await opened();
  await turnTo(page, 'frame', 'header');
  const preview = await (await page.locator('#preview').elementHandle()).contentFrame();
  const control = (key) => page.locator(`[data-path="inputs.header.${key}"]`);
  for (const gone of ['brand-align', 'identity-axis', 'identity-align']) assert.equal(await control(gone).count(), 0, `${gone} has gone`);
  const options = (key) => control(key).locator('option').allTextContents();
  assert.deepEqual(await options('identity'), ['Logo', 'Name', 'Logo and name']);
  assert.deepEqual(await options('brand-axis'), ['Side by side', 'Stacked']);
  assert.deepEqual(await options('slogan-place'), ['Beside', 'Below']);
  await page.locator('[data-path="project.slogan"]').fill('Calm and clear');
  await preview.waitForFunction(() => document.querySelector('.kn-header-slogan')?.textContent === 'Calm and clear');
  const start = await controlsNow(page);
  const before = await preview.evaluate(() => {
    window.keptFooter = document.querySelector('.kn-footer');
    return !!window.keptFooter;
  });
  assert.ok(before);
  for (const [identity, logo, name] of [['logo', true, false], ['name', false, true], ['both', true, true]]) {
    for (const place of ['beside', 'below']) {
      for (const axis of ['row', 'column']) {
        await control('identity').selectOption(identity);
        await control('slogan-place').selectOption(place);
        await control('brand-axis').selectOption(axis);
        const what = `${identity} ${place} ${axis}`;
        await preview.waitForFunction(([i, p, a, hasLogo, hasName]) => {
          const link = document.querySelector('.kn-header-identity');
          const a1 = document.querySelector('.kn-footer [data-kn-cell="a1"] .kn-brand');
          return link.dataset.knSloganPlace === p && link.querySelector('.kn-brand').dataset.knAxis === a && !!link.querySelector('.kn-brand-logo') === hasLogo && !!link.querySelector('.kn-brand-name') === hasName && a1?.dataset.knAxis === a && !!a1.querySelector('.kn-brand-logo') === hasLogo && !!a1.querySelector('.kn-brand-name') === hasName;
        }, [identity, place, axis, logo, name]);
        assertStill(start, await controlsNow(page), what);
        for (const key of ['identity', 'brand-axis', 'slogan-place']) assert.equal(await control(key).isDisabled(), false, what);
        assert.equal(await page.locator('[data-path="project.slogan"]').isDisabled(), false, what);
        const seen = await preview.evaluate(() => {
          const rect = (selector) => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box && { left: box.left, right: box.right, top: box.top, bottom: box.bottom, middle: (box.top + box.bottom) / 2 }; };
          const brand = document.querySelector('.kn-header-identity .kn-brand');
          return {
            sameFooter: document.querySelector('.kn-footer') === window.keptFooter,
            slogan: rect('.kn-header-slogan'),
            brand: rect('.kn-header-identity .kn-brand'),
            name: rect('.kn-header-identity .kn-brand-name'),
            logo: rect('.kn-header-identity .kn-brand-logo'),
            contents: getComputedStyle(brand).display === 'contents',
            // What has given way: what the visible row no longer shows.
            collapsed: ['.kn-header-slogan', '.kn-brand-name', '.kn-header-link-menu', '.kn-header-group > .kn-header-cta'].filter((selector) => document.querySelector(`.kn-header-row ${selector}`) && !document.querySelector(`.kn-header-row ${selector}`).getClientRects().length).join(' '),
            bar: document.querySelector('.kn-header-bar').getBoundingClientRect().height,
            // Registered as a length, so the browser gives it in pixels.
            published: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kn-header-height')),
            footerSlogan: !!document.querySelector('.kn-footer .kn-header-slogan'),
          };
        });
        assert.equal(seen.sameFooter, true, `${what}: the footer stays the same element`);
        assert.equal(seen.footerSlogan, false, `${what}: the footer has no slogan`);
        assert.equal(seen.collapsed, '', `${what}: there is room for all of it`);
        assert.ok(Math.abs(seen.bar - seen.published) < 0.1, `${what}: the bar is ${seen.bar}, published as ${seen.published}`);
        const first = name ? seen.name : seen.logo;
        if (place === 'beside') {
          assert.ok(seen.slogan.left > (seen.contents ? first.right : seen.brand.right), `${what}: the slogan stands at the end side`);
          assert.ok(Math.abs(seen.slogan.middle - seen.brand.middle) <= 1, `${what}: slogan and brand share a middle`);
        } else {
          assert.ok(Math.abs(seen.slogan.left - first.left) <= 0.05, `${what}: the slogan starts where the ${name ? 'name' : 'logo'} starts`);
          assert.ok(seen.slogan.top >= first.bottom, `${what}: the slogan stands under it`);
        }
        if (logo && name && axis === 'row') assert.ok(Math.abs(seen.logo.middle - (place === 'below' ? (seen.name.top + seen.slogan.bottom) / 2 : seen.name.middle)) <= 1, `${what}: the logo is centred on what stands beside it`);
        if (logo && name && axis === 'column') assert.ok(Math.abs(seen.logo.left - seen.name.left) <= 0.05, `${what}: logo and name start together`);
      }
    }
  }
  // A change that leaves the logo showing moves the images over, so neither of them blinks.
  await control('brand-axis').selectOption('row');
  await control('slogan-place').selectOption('beside');
  await control('identity').selectOption('logo');
  await preview.waitForFunction(() => !document.querySelector('.kn-footer [data-kn-cell="a1"] .kn-brand-name') && document.querySelector('.kn-header-identity').dataset.knSloganPlace === 'beside');
  await preview.evaluate(() => {
    window.keptImages = [...document.querySelectorAll('.kn-header-identity img, .kn-footer [data-kn-cell="a1"] img')];
  });
  await control('identity').selectOption('both');
  await preview.waitForFunction(() => !!document.querySelector('.kn-footer [data-kn-cell="a1"] .kn-brand-name') && !!document.querySelector('.kn-header-identity .kn-brand-name'));
  const kept = await preview.evaluate(() => {
    const now = [...document.querySelectorAll('.kn-header-identity img, .kn-footer [data-kn-cell="a1"] img')];
    return now.length && now.every((image, index) => image === window.keptImages[index]);
  });
  assert.equal(kept, true, 'the logos are the same elements');
  // An arrangement and a toggle change the header where it stands: the same element, and logos that are neither moved
  // in from another document nor given their address again, so neither loads again.
  await preview.evaluate(() => {
    window.keptHeader = document.querySelector('.kn-page > .kn-header');
    window.keptLogos = [...window.keptHeader.querySelectorAll('img')];
    window.logoLoads = 0;
    for (const image of window.keptLogos) image.addEventListener('load', () => { window.logoLoads += 1; });
  });
  const pick = (value) => page.locator(`[data-pick="inputs.header.arrangement"][data-value="${value}"]`);
  const arrangement = await page.locator('[data-pick="inputs.header.arrangement"][aria-pressed="true"]').getAttribute('data-value');
  const cta = page.locator('[data-flag="inputs.header.cta"]');
  const hasCta = async () => (await cta.getAttribute('aria-pressed')) === 'true';
  const ctaBefore = await hasCta();
  for (const [step, value] of [[() => pick(arrangement === 'B' ? 'C' : 'B').click(), null], [() => cta.click(), !ctaBefore], [() => cta.click(), ctaBefore], [() => pick(arrangement).click(), null]]) {
    await step();
    await preview.waitForFunction(([wanted, shows]) => document.querySelector('.kn-page > .kn-header').dataset.knArrangement === wanted && (shows === null || !!document.querySelector('.kn-header-bar .kn-header-cta') === shows), [await page.locator('[data-pick="inputs.header.arrangement"][aria-pressed="true"]').getAttribute('data-value'), value]);
    const still = await preview.evaluate(() => {
      const header = document.querySelector('.kn-page > .kn-header');
      return { header: header === window.keptHeader, logos: [...header.querySelectorAll('img')].every((image) => window.keptLogos.includes(image)), loads: window.logoLoads };
    });
    assert.deepEqual(still, { header: true, logos: true, loads: 0 }, 'the header changes where it stands');
  }
  // Beside, the slogan goes first. Below a wider name it frees no width, stays until the name goes, and goes with it.
  const narrow = await (await page.locator('#preview-narrow').elementHandle()).contentFrame();
  const name = await page.evaluate(() => document.querySelector('[data-path="project.name"]').value);
  await turnTo(page, 'start', 'start');
  await page.locator('[data-path="project.name"]').fill('A rather long made-up company name');
  await turnTo(page, 'frame', 'header');
  await page.locator('[data-path="project.slogan"]').fill('Calm');
  await narrow.waitForFunction(() => document.querySelector('.kn-header-slogan')?.textContent === 'Calm');
  // A step taken in the visible row: its container query on the slack named for it holds.
  const taken = (step) => narrow.evaluate((step) => getComputedStyle(document.querySelector('.kn-header-row')).getPropertyValue(`--kn-header-gone-${step}`) === '1', step);
  await narrow.waitForFunction(() => getComputedStyle(document.querySelector('.kn-header-row')).getPropertyValue('--kn-header-gone-slogan') === '1');
  assert.ok(await taken('name'));
  await control('slogan-place').selectOption('below');
  // Below a wider name the slogan frees no width: its copy is as wide as the one before it, so its step is taken
  // together with the name's.
  await narrow.waitForFunction(() => document.querySelector('.kn-header-identity').dataset.knSloganPlace === 'below');
  assert.ok(await taken('name'), 'the name still goes');
  assert.equal(await narrow.locator('.kn-header-row .kn-header-slogan').isVisible(), false, 'and the slogan goes with it');
  assert.equal(await narrow.locator('.kn-header-row .kn-header-identity .kn-brand-logo').isVisible(), true, 'the logo stays');
  // Below with no slogan to stand there, logo and name are still centred on each other.
  await page.locator('[data-path="project.slogan"]').fill('');
  await preview.waitForFunction(() => !document.querySelector('.kn-header-slogan') && !!document.querySelector('.kn-header-identity .kn-brand-name'));
  const middles = await preview.evaluate(() => ['.kn-brand-logo', '.kn-brand-name'].map((selector) => { const box = document.querySelector(`.kn-header-identity ${selector}`).getBoundingClientRect(); return (box.top + box.bottom) / 2; }));
  assert.ok(Math.abs(middles[0] - middles[1]) <= 0.5, `logo and name stand at ${middles}`);
  // As it was, for the tests after this one.
  await control('slogan-place').selectOption('beside');
  await control('identity').selectOption('logo');
  await turnTo(page, 'start', 'start');
  await page.locator('[data-path="project.name"]').fill(name);
  await settled(page);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the footer\'s lines are said to end where they end', { timeout: 60000 }, async () => {
  const page = await opened();
  const option = page.locator('[data-path="inputs.footer.rule-extent"] option[value="full"]');
  assert.equal(await option.textContent(), 'At the window\'s edge');
  const id = await page.locator('[data-path="inputs.footer.rule-extent"]').getAttribute('data-g-tooltip');
  assert.match(await page.locator(`#${id}`).textContent(), /edge of the window/);
  await page.context().close();
});

test('undo and redo return to where the change was made on the same page as well', { timeout: 60000 }, async () => {
  const page = await opened({ height: 600 });
  await turnTo(page, 'frame', 'header');
  const far = page.locator('[data-path="inputs.header.search-surface"]');
  const original = await far.inputValue();
  await far.scrollIntoViewIfNeeded();
  const scroll = () => page.locator('#document').evaluate((node) => node.scrollTop);
  const scrolled = await scroll();
  assert.ok(scrolled > 200);
  await far.selectOption('tint');
  await settled(page);
  const inView = () => far.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight;
  });
  const top = () => page.locator('#document').evaluate((node) => { node.scrollTop = 0; });
  await top();
  await page.locator('#undo').click();
  assert.equal(await scroll(), scrolled, 'undone');
  assert.equal(await inView(), true);
  assert.equal((await onDiskSoon(page)).inputs.header['search-surface'], original);
  await top();
  await page.locator('#redo').click();
  assert.equal(await scroll(), scrolled, 'redone');
  assert.equal(await far.inputValue(), 'tint');
  await settled(page);
  // The keys as well, and scrolled further down than the change was made.
  await page.locator('#document').evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await scroll(), scrolled, 'with the key');
  await settled(page);
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // With the panes one above the other, it is the window that scrolls.
  const small = await opened({ width: 800, height: 600 });
  await turnTo(small, 'frame', 'header');
  const low = small.locator('[data-path="inputs.header.search-surface"]');
  const lowOriginal = await low.inputValue();
  await low.scrollIntoViewIfNeeded();
  const windowScroll = () => small.evaluate(() => document.scrollingElement.scrollTop);
  const scrolledThere = await windowScroll();
  assert.ok(scrolledThere > 200);
  await low.selectOption(lowOriginal === 'tint' ? 'raised' : 'tint');
  await settled(small);
  await small.evaluate(() => { document.scrollingElement.scrollTop = 0; });
  await small.locator('#undo').click();
  assert.equal(await windowScroll(), scrolledThere);
  await settled(small);
  await small.context().close();
});
async function onDiskSoon(page) {
  await settled(page);
  await page.waitForTimeout(50);
  return onDisk();
}

test('a colour that fails the contrast check leaves every control showing the model, while the preview keeps the last good design', { timeout: 90000 }, async () => {
  const page = await opened();
  await turnTo(page, 'colour', 'colour-scale');
  const hex = page.locator('[data-hex="primary"]');
  const good = await hex.inputValue();
  const failing = failingColour;
  const failed = () => page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
  const frameCss = () => page.frameLocator('#preview').locator('html').evaluate((node) => getComputedStyle(node).getPropertyValue('--kn-link'));
  const goodLink = await frameCss();
  await hex.fill(failing);
  await failed();
  assert.match(await page.locator('#notice').textContent(), /link-hover/);
  const exact = () => page.locator('[data-ramp="primary"] [data-exact="true"]').evaluate((node) => node.lastElementChild.textContent);
  assert.equal(await exact(), failing, 'the ramp shows the colour it was given');
  assert.equal(await page.locator('[data-path="lch.primary.H"]').inputValue() !== '', true);

  // Controls clicked in this state show their new value at once, on any page.
  await turnTo(page, 'frame', 'footer');
  const cell = page.locator('[data-flag="inputs.footer.upper.cells.a1"]');
  const was = await cell.getAttribute('aria-pressed');
  await cell.click();
  assert.equal(await cell.getAttribute('aria-pressed'), String(was !== 'true'), 'the footer\'s miniature');
  // Each its own step, as no hand could be quicker than a step closes.
  await page.waitForTimeout(30);
  await page.locator('[data-path="inputs.footer.upper.surface"]').selectOption('inverse');
  const onCell = page.locator('[data-flag="inputs.footer.upper.cells.b1"]');
  assert.equal(await onCell.getAttribute('data-kn-surface'), 'inverse', 'its colours');
  await turnTo(page, 'frame', 'header');
  const pick = page.locator('[data-pick="inputs.header.arrangement"][data-value="B"]');
  assert.equal(await pick.getAttribute('aria-pressed'), 'false');
  await pick.click();
  assert.equal(await pick.getAttribute('aria-pressed'), 'true', 'a pick');
  const chip = page.locator('[data-flag="inputs.header.cta"]');
  const chipWas = await chip.getAttribute('aria-pressed');
  await chip.click();
  assert.equal(await chip.getAttribute('aria-pressed'), String(chipWas !== 'true'), 'a chip');
  const mini = page.locator('[data-pick="inputs.header.arrangement"][data-value="B"] [data-mini="cta"]').first();
  assert.equal(await mini.evaluate((node) => node.hasAttribute('data-off')), chipWas === 'true', 'a drawing');
  await turnTo(page, 'space', 'shadow');
  const target = page.locator('[data-target="header"]');
  const targetWas = await target.getAttribute('aria-pressed');
  await target.click();
  assert.equal(await target.getAttribute('aria-pressed'), String(targetWas !== 'true'), 'a shadow target');
  await page.waitForTimeout(30);
  await page.locator('[data-path="shadow-direction"]').evaluate((node) => { node.value = 30; node.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.match(await page.locator('[data-dial]').getAttribute('transform'), /rotate\(-30 /, 'the dial');
  await turnTo(page, 'typography', 'type-scale');
  const stepValue = page.locator('[data-step-value="display"]');
  const stepWas = Number(await stepValue.textContent());
  // Either way will do, and a step at the end of the scale has only one to go.
  const down = page.locator('[data-step="display"][data-delta="-1"]');
  await (await down.isDisabled() ? page.locator('[data-step="display"][data-delta="1"]') : down).click();
  const stepNow = Number(await stepValue.textContent());
  assert.equal(Math.abs(stepNow - stepWas), 1, 'a stepper');
  // The width shown is written from the design too, and must not bring the last good one back.
  await page.locator('[data-line-px="view"]').fill('800');
  await page.keyboard.press('Enter');
  assert.equal(Number(await stepValue.textContent()), stepNow);
  await page.locator('[data-line-px="view"]').fill('1440');
  await page.keyboard.press('Enter');
  await turnTo(page, 'colour', 'colour-scale');
  assert.equal(await hex.inputValue(), failing);

  // The preview keeps the last good design, and is still looked at as chosen.
  assert.equal(await frameCss(), goodLink);
  assert.equal((await onDisk()).inputs['brand-colors'].primary, good, 'never written');
  await page.locator('[data-mode="dark"]').first().click();
  await page.waitForFunction(() => document.getElementById('preview').contentDocument.documentElement.dataset.knMode === 'dark');
  await page.locator('[data-mode="light"]').first().click();
  await failed();
  assert.equal(await page.locator('#design-md').isDisabled(), true);

  // Undoing into it, and out of it: the controls follow each step.
  await page.locator('#undo').click();
  assert.equal(await stepValue.textContent(), String(stepWas), 'undone on a failing state');
  await page.locator('#undo').click();
  await page.locator('#undo').click();
  assert.equal(await target.getAttribute('aria-pressed'), targetWas);
  await page.locator('#undo').click();
  assert.equal(await chip.getAttribute('aria-pressed'), chipWas);
  await page.locator('#undo').click();
  assert.equal(await pick.getAttribute('aria-pressed'), 'false');
  await page.locator('#undo').click();
  assert.equal(await onCell.getAttribute('data-kn-surface'), (await onDisk()).inputs.footer.upper.surface);
  await page.locator('#undo').click();
  assert.equal(await cell.getAttribute('aria-pressed'), was);
  await failed();
  await page.locator('#undo').click();
  await settled(page);
  assert.equal(await hex.inputValue(), good, 'out of it');
  assert.equal(await page.locator('#notice').isHidden(), true);
  await page.locator('#redo').click();
  await failed();
  assert.equal(await hex.inputValue(), failing, 'into it');
  assert.equal(await exact(), failing);
  await page.locator('#redo').click();
  assert.equal(await cell.getAttribute('aria-pressed'), String(was !== 'true'));
  await page.locator('#undo').click();
  await page.locator('#undo').click();
  await settled(page);
  assert.equal((await onDisk()).inputs['brand-colors'].primary, good);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a change waiting for the pause when a setting then fails is not sent, and the notice stays the contrast notice', { timeout: 30000 }, async () => {
  const page = await opened();
  await turnTo(page, 'colour', 'colour-scale');
  const hex = page.locator('[data-hex="primary"]');
  const good = await hex.inputValue();
  await hex.fill('#00be59');
  await hex.fill(failingColour);
  await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'error');
  assert.match(await page.locator('#notice').textContent(), /fails the contrast check/);
  await hex.fill(good);
  await settled(page);
  assert.equal(await page.locator('#notice').isHidden(), true);
  await page.context().close();
});
