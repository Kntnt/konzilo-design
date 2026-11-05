import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startTool } from '../tool/server.js';
import { createPresentation } from '../tool/presentation.js';
import { componentPages, FRAME_PAGES, ids } from '../presentation/src/catalog.js';
import { TOOL_PAGES, lookDefaults } from '../presentation/src/looks.js';

// What shows of each component whatever is chosen: the sample's own root, once. A list or a grid is a real multiple
// and counts as one, and the three fields of a Field's state are its kinds, the same in every state.
const SHOWS = {
  opening: { hero: { '.kn-hero': 1 } },
  sections: { band: { '.kn-band': 1 }, 'text-image': { '.kn-text-image': 1 }, 'cta-band': { '.kn-cta-band': 1, '.kn-key-figures': 1 } },
  text: {
    'body-text': { '.kn-heading-group': 1, '.kn-body-text': 1 },
    'reading-area': { '.kn-reading-area': 1, '.kn-toc': 1 },
    accordion: { '.kn-accordion': 1, '.kn-quotation': 1 },
    callout: { '.kn-callout': 1 },
    table: { '.kn-table-scroll': 1 },
  },
  buttons: { buttons: { '.kn-button': 1 }, 'button-default': { '.kn-link-group': 1 }, links: { a: 1 }, icon: { '.sample-icons': 1 } },
  cards: { card: { '.kn-card': 1 }, 'content-card': { '.kn-content-card': 1 }, 'card-grid': { '.kn-card-grid': 1 } },
  media: { figure: { '.kn-figure:not(.kn-video)': 1, '.kn-video': 1 }, embed: { '.kn-embed': 1 } },
  finding: { 'content-loop': { '.kn-content-loop': 1 }, 'visitor-filters': { '.kn-content-loop': 1 }, pagination: { '.kn-pagination': 1 } },
  forms: { form: { '.kn-form': 1 }, 'form-states': { '.kn-field': 3 }, 'consent-banner': { '[data-open-banner]': 1 } },
};
const NAMES = { opening: 'Opening', sections: 'Sections', text: 'Text', buttons: 'Buttons', cards: 'Cards', media: 'Media', finding: 'Finding', forms: 'Forms' };

// What each end shows of a section: the visible elements with what tells them apart.
const shows = (section) => {
  const visible = [...section.querySelectorAll('*')].filter((node) => node.getClientRects().length);
  return visible.map((node) => [node.tagName, [...node.attributes].filter(({ name }) => name === 'class' || name === 'src' || name.startsWith('data-kn')).map(({ name, value }) => `${name}=${value}`), node.children.length ? '' : node.textContent.trim()]);
};
const counts = (section, wanted) => Object.fromEntries(Object.keys(wanted).map((selector) => [selector, [...section.querySelectorAll(selector)].filter((node) => node.getClientRects().length).length]));

let directory;
let tool;
let browser;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kn-looks-'));
  tool = await startTool({ designFile: join(directory, 'looks.design.json'), port: 0, open: false });
  browser = await chromium.launch();
}, { timeout: 240000 });
after(async () => {
  await browser?.close();
  await tool?.close();
  await rm(directory, { recursive: true, force: true });
});

async function openTool(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const writes = [];
  page.on('request', (request) => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.goto(tool.url);
  await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
  await page.locator('.chapter', { hasText: 'Components' }).click();
  const ends = [await (await page.$('#preview')).contentFrame(), await (await page.$('#preview-narrow')).contentFrame()];
  for (const end of ends) await end.waitForSelector('[data-component="hero"] [data-kn-live-hero]');
  return { context, page, ends, errors, writes };
}
const openPage = async (page, id) => {
  await page.locator('.page-link', { hasText: NAMES[id] }).click();
  await page.locator(`[data-page="${id}"]`).waitFor({ state: 'visible' });
};
const chosen = (ends, key, value) => Promise.all(ends.map((end) => end.waitForSelector(`[data-look~="${key}:${value}"][data-look-on]`, { state: 'attached' })));

test('the tool\'s pages are the report\'s, and every look has a variation on the page for each of its choices', async () => {
  assert.deepEqual(Object.keys(TOOL_PAGES), componentPages.map(([page]) => page).filter((page) => !FRAME_PAGES.includes(page)));
  const components = Object.values(TOOL_PAGES).flat();
  assert.equal(new Set(components.map(({ id }) => id)).size, components.length, 'a component has one place');
  const shown = components.flatMap(({ specimens }) => Object.keys(specimens));
  for (const specimen of shown) assert.ok(ids.includes(specimen), specimen);
  assert.equal(new Set(shown).size, shown.length, 'a specimen is shown once');
  // The report's one specimen that is not here is the first of Callout's, which callout-more holds too.
  assert.deepEqual(componentPages.filter(([page]) => !FRAME_PAGES.includes(page)).flatMap(([, , defaults, variants]) => [...defaults, ...variants]).filter((specimen) => !shown.includes(specimen)), ['callout']);
  const looks = components.flatMap(({ looks = [] }) => looks);
  assert.equal(new Set(looks.map(([key]) => key)).size, looks.length, 'a look belongs to one component');
  for (const [, label, choices] of looks) {
    assert.ok(choices.length >= 2, label);
    for (const [, word, help] of choices) assert.ok(word.length <= 20 && help.length > word.length, word);
  }
  assert.deepEqual(Object.keys(lookDefaults()), looks.map(([key]) => key));

  const html = await fetch(`${tool.url}/catalogue.html`).then((response) => response.text());
  const marks = new Set([...html.matchAll(/data-look="([^"]+)"/g)].flatMap(([, mark]) => mark.split(' ')));
  const known = new Set(looks.flatMap(([key, , choices]) => choices.map(([value]) => `${key}:${value}`)));
  assert.deepEqual([...known].filter((mark) => !marks.has(mark)), [], 'every choice has something to show');
  assert.deepEqual([...marks].filter((mark) => !known.has(mark)), [], 'every variation has a choice');
});

test('on every component page each component shows once, at both ends and whatever is chosen', { timeout: 180000 }, async () => {
  const { context, page, ends, errors, writes } = await openTool();
  try {
    const designBefore = await readFile(tool.path, 'utf8');
    for (const [id, components] of Object.entries(SHOWS)) {
      await openPage(page, id);
      const form = page.locator(`[data-page="${id}"]`);
      // The rows have no disabled control and every choice says what it does, and only a component with variations has a row.
      const titles = await form.locator('.setting:has(.look) .setting-title').allTextContents();
      assert.deepEqual(titles, TOOL_PAGES[id].filter(({ looks }) => looks).map(({ name, title = name }) => title), id);
      assert.equal(await form.locator('[data-look-key]:disabled').count(), 0);
      assert.equal(await form.locator('[data-look-key]:not([data-g-tooltip])').count(), 0);
      assert.equal(await form.locator('[data-look-key]').count(), TOOL_PAGES[id].flatMap(({ looks = [] }) => looks).flatMap(([, , choices]) => choices).length, id);

      const check = async (label) => {
        for (const [component, wanted] of Object.entries(components)) for (const end of ends) {
          const section = end.locator(`[data-component-page="${id}"] [data-component="${component}"]`);
          assert.equal(await section.count(), 1, `${component} has one place`);
          assert.deepEqual(await section.evaluate(counts, wanted), wanted, `${component}, ${label}`);
        }
      };
      await check('at first');

      // Nothing moves on the left, and only what was asked for changes on the right.
      const places = () => form.locator('.pick, .look-name, .setting-title, .next').evaluateAll((nodes) => nodes.map((node) => { const { x, y, width, height } = node.getBoundingClientRect(); return [x, y, width, height].join(); }));
      const standing = await places();
      for (const end of ends) await end.evaluate(() => { window.sameFrame = true; });
      for (const { id: component, looks = [] } of TOOL_PAGES[id]) for (const [key, , choices] of looks) {
        const section = (end) => end.locator(`[data-component="${component}"]`);
        for (const [value] of [...choices.slice(1), choices[0]]) {
          const before = await Promise.all(ends.map((end) => section(end).evaluate(shows)));
          const button = form.locator(`[data-look-key="${key}"][data-look-value="${value}"]`);
          await button.click();
          await chosen(ends, key, value);
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
          assert.equal(await form.locator(`[data-look-key="${key}"][aria-pressed="true"]`).count(), 1);
          for (const [index, end] of ends.entries()) assert.notDeepEqual(await section(end).evaluate(shows), before[index], `${key}:${value} changes what shows`);
          await check(`${key}:${value}`);
          assert.deepEqual(await places(), standing, `${key}:${value} moves nothing on the left`);
        }
      }
      for (const end of ends) assert.equal(await end.evaluate(() => window.sameFrame), true, 'nothing is reloaded');
    }
    await page.waitForTimeout(1200);
    assert.deepEqual(writes, [], 'a look writes nothing');
    assert.equal(await readFile(tool.path, 'utf8'), designBefore, 'and the design file stands as it was');
    assert.equal(await page.locator('#undo').isDisabled(), true, 'and adds no step to undo');
    assert.equal(await page.locator('#redo').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

// Everything computed on each part that shows. Transitions are off while the tool tunes a design, so they say nothing of a state.
const computed = (scope) => [...scope.querySelectorAll('*')].filter((node) => node.getClientRects().length).map((node) => {
  const style = getComputedStyle(node);
  return Object.fromEntries([...style].filter((name) => !name.startsWith('--') && !name.startsWith('transition')).map((name) => [name, style.getPropertyValue(name)]));
});

test('every state on offer changes something computed, in both modes and on every kind and field it is offered for', { timeout: 180000 }, async () => {
  const { context, page, ends: [wide], errors } = await openTool();
  const look = (key, value) => page.locator(`[data-look-key="${key}"][data-look-value="${value}"]`);
  const choose = async (key, value) => {
    await look(key, value).click();
    await chosen([wide], key, value);
  };
  try {
    const offered = Object.fromEntries(Object.values(TOOL_PAGES).flat().flatMap(({ looks = [] }) => looks).map(([key, , choices]) => [key, choices.map(([value]) => value)]));
    assert.deepEqual(offered['button-state'], ['default', 'hover', 'focus', 'active']);
    assert.deepEqual(offered['link-state'], ['default', 'hover', 'focus']);
    assert.deepEqual(offered['field-state'], ['default', 'focus', 'disabled']);
    for (const mode of ['light', 'dark']) {
      await page.locator(`.menu [data-mode="${mode}"]`).click();
      await wide.locator(`html[data-kn-mode="${mode}"]`).waitFor({ state: 'attached' });
      await openPage(page, 'buttons');
      for (const kind of offered['button-kind']) {
        await choose('button-kind', kind);
        const section = wide.locator('[data-component="buttons"]');
        await choose('button-state', 'default');
        const rest = await section.evaluate(computed);
        for (const state of offered['button-state'].slice(1)) {
          await choose('button-state', state);
          assert.notDeepEqual(await section.evaluate(computed), rest, `${mode}: a ${kind} button's ${state}`);
        }
        await choose('button-state', 'default');
      }
      const link = wide.locator('[data-component="links"]');
      await choose('link-state', 'default');
      const linkRest = await link.evaluate(computed);
      for (const state of offered['link-state'].slice(1)) {
        await choose('link-state', state);
        assert.notDeepEqual(await link.evaluate(computed), linkRest, `${mode}: a link's ${state}`);
      }
      await choose('link-state', 'default');

      await openPage(page, 'forms');
      // Each of the three fields on its own, so that a state showing on one of them does not pass for all.
      const fields = () => wide.locator('[data-component="form-states"]').evaluate((section, read) => [...section.querySelectorAll('.kn-field')].filter((field) => field.getClientRects().length).map((field) => new Function('scope', `return (${read})(scope)`)(field)), computed.toString());
      await choose('field-state', 'default');
      const fieldRest = await fields();
      assert.equal(fieldRest.length, 3);
      for (const state of offered['field-state'].slice(1)) {
        await choose('field-state', state);
        const now = await fields();
        for (const index of fieldRest.keys()) assert.notDeepEqual(now[index], fieldRest[index], `${mode}: field ${index}'s ${state}`);
      }
      await choose('field-state', 'default');
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }

  // And the pointer itself: what the Link's Hover shows is what a real one does.
  const direct = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await direct.goto(`${tool.url}/catalogue.html`);
    const link = direct.locator('[data-look~="link-colour:page"] [data-look~="link-state:default"] a');
    const thickness = () => link.evaluate((node) => getComputedStyle(node).textDecorationThickness);
    const atRest = await thickness();
    await link.hover();
    assert.notEqual(await thickness(), atRest);
  } finally {
    await direct.close();
  }
});

test('a number field follows its Surface like the other fields, in both modes', { timeout: 120000 }, async () => {
  const { context, page, ends } = await openTool();
  try {
    await openPage(page, 'forms');
    await page.locator('[data-look-key="form-sample"][data-look-value="more"]').click();
    await chosen(ends, 'form-sample', 'more');
    const colours = (end, selector) => end.locator(`[data-look~="form-sample:more"] ${selector}`).evaluate((node) => {
      const { colorScheme, backgroundColor, color, borderBlockStartColor } = getComputedStyle(node);
      return { colorScheme, backgroundColor, color, borderBlockStartColor };
    });
    for (const mode of ['light', 'dark']) {
      await page.locator(`.menu [data-mode="${mode}"]`).click();
      for (const end of ends) {
        await end.locator(`html[data-kn-mode="${mode}"]`).waitFor({ state: 'attached' });
        const number = await colours(end, 'input[type="number"]');
        assert.deepEqual(number, await colours(end, 'input[type="tel"]'), mode);
        assert.equal(number.colorScheme, mode);
      }
    }
  } finally {
    await context.close();
  }
});

test('the Band sample holds the same content in each colour, so choosing one moves nothing', { timeout: 120000 }, async () => {
  const { context, page, ends } = await openTool();
  try {
    await openPage(page, 'sections');
    const band = (end) => end.locator('[data-component="band"] .kn-band[data-look-on]').evaluate((node) => ({ height: node.getBoundingClientRect().height, text: node.textContent.replace(/\s+/g, ' ').trim() }));
    const first = await Promise.all(ends.map(band));
    for (const value of ['brand', 'inverse', 'tint']) {
      await page.locator(`[data-look-key="band-colour"][data-look-value="${value}"]`).click();
      await chosen(ends, 'band-colour', value);
      assert.deepEqual(await Promise.all(ends.map(band)), first, value);
    }
  } finally {
    await context.close();
  }
});

test('the catalogue, with its Reading Area, scrolls no phone sideways', { timeout: 60000 }, async () => {
  for (const width of [390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try {
      await page.goto(`${tool.url}/catalogue.html`);
      await page.waitForSelector('.kn-reading-area-measure', { state: 'attached' });
      const overflow = await page.evaluate(() => {
        scrollTo(9999, 0);
        return { scrolled: scrollX, beyond: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      assert.deepEqual(overflow, { scrolled: 0, beyond: 0 }, `${width} px`);
    } finally {
      await page.close();
    }
  }
});

test('a choice brings its component into view, and leaves one in view where it stands', { timeout: 120000 }, async () => {
  const { context, page, ends } = await openTool();
  try {
    await openPage(page, 'text');
    await Promise.all(ends.map((end) => end.waitForFunction(() => scrollY > 0)));
    for (const end of ends) await end.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.locator('[data-look-key="table-colour"][data-look-value="brand"]').click();
    await chosen(ends, 'table-colour', 'brand');
    for (const end of ends) {
      await end.waitForFunction(() => {
        const box = document.querySelector('[data-component="table"]').getBoundingClientRect();
        return box.top >= -1 && box.bottom <= innerHeight + 1;
      });
    }
    const stood = await Promise.all(ends.map((end) => end.evaluate(() => scrollY)));
    await page.locator('[data-look-key="table-colour"][data-look-value="page"]').click();
    await chosen(ends, 'table-colour', 'page');
    await page.waitForTimeout(300);
    assert.deepEqual(await Promise.all(ends.map((end) => end.evaluate(() => scrollY))), stood, 'in view it stays');

    // Nor does a frame's width of difference between two variations move the page.
    await page.locator('[data-look-key="callout-style"][data-look-value="outlined"]').click();
    await chosen(ends, 'callout-style', 'outlined');
    await page.waitForTimeout(300);
    const flush = await Promise.all(ends.map((end) => end.evaluate(() => {
      const section = document.querySelector('[data-component="callout"]');
      scrollTo({ top: scrollY + section.getBoundingClientRect().bottom - innerHeight, behavior: 'instant' });
      return scrollY;
    })));
    await page.locator('[data-look-key="callout-style"][data-look-value="filled"]').click();
    await chosen(ends, 'callout-style', 'filled');
    await page.locator('[data-look-key="callout-style"][data-look-value="outlined"]').click();
    await chosen(ends, 'callout-style', 'outlined');
    await page.waitForTimeout(300);
    assert.deepEqual(await Promise.all(ends.map((end) => end.evaluate(() => scrollY))), flush);
  } finally {
    await context.close();
  }
});

test('a look lasts while the window is open, and the preview\'s own window follows', { timeout: 120000 }, async () => {
  const { context, page, ends } = await openTool();
  try {
    await openPage(page, 'text');
    await page.locator('[data-look-key="callout-status"][data-look-value="warning"]').click();
    await chosen(ends, 'callout-status', 'warning');

    // A turn of the page, even to one on the other sample, comes back to the same choice.
    await page.locator('.chapter', { hasText: 'Frame' }).click();
    await Promise.all(ends.map((end) => end.waitForFunction(() => location.pathname === '/preview.html')));
    await page.locator('.chapter', { hasText: 'Components' }).click();
    await openPage(page, 'text');
    await Promise.all(ends.map((end) => end.waitForFunction(() => location.pathname === '/catalogue.html' && document.querySelector('.kn-callout[data-look~="callout-status:warning"][data-look-on]'))));
    assert.equal(await page.locator('[data-look-key="callout-status"][data-look-value="warning"]').getAttribute('aria-pressed'), 'true');

    const [own] = await Promise.all([context.waitForEvent('page'), page.locator('#own-window').click()]);
    const inOwn = (selector) => own.waitForFunction((wanted) => [...document.querySelectorAll('iframe')].every((frame) => frame.contentDocument?.querySelector(wanted)), selector);
    await inOwn('.kn-callout[data-look~="callout-status:warning"][data-look-on]');
    await page.locator('[data-look-key="callout-style"][data-look-value="outlined"]').click();
    await inOwn('.kn-callout[data-look~="callout-status:warning"][data-look~="callout-style:outlined"][data-look-on]');
    await page.locator('#bring-back').click();
    await page.locator('#preview-pane').waitFor({ state: 'visible' });

    // A window opened again starts from what the page first shows.
    await page.reload();
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    assert.equal(await page.locator('[data-look-key="callout-status"][data-look-value="info"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-look-key="callout-style"][data-look-value="filled"]').getAttribute('aria-pressed'), 'true');
  } finally {
    await context.close();
  }
});

test('the report still shows all its variants, side by side as before', { timeout: 180000 }, async () => {
  const design = join(directory, 'report.design.json');
  await writeFile(design, await readFile('examples/example.design.json', 'utf8'));
  const zip = join(directory, 'report.zip');
  await createPresentation(design, zip, { date: '2026-11-05' });
  const bytes = await readFile(zip);
  const length = bytes.readUInt16LE(26);
  const offset = 30 + length + bytes.readUInt16LE(28);
  const file = join(directory, 'report.html');
  await writeFile(file, inflateRawSync(bytes.subarray(offset, offset + bytes.readUInt32LE(18))));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`file://${file}`);
    for (const [id, specimens] of Object.entries({
      sections: { band: { '.kn-band': 3 }, 'text-image-start': { '.kn-text-image': 1 } },
      text: { 'callout-more': { '.kn-callout': 8 }, 'accordion-more': { '.kn-accordion': 1 }, 'table-more': { '.kn-table-scroll': 1 } },
      buttons: { 'button-default': { '.kn-button': 6, 'a:not(.kn-button)': 2 }, buttons: { '.kn-button': 24, '[data-kn-type="label"]': 8 }, links: { 'a': 12, '[data-kn-type="label"]': 12 } },
      cards: { card: { '.kn-card': 3 }, 'card-unplated': { '.kn-card': 3 }, 'card-person': { '.kn-card': 3 }, 'content-card': { '.kn-content-card': 3 }, 'card-grid': { '.kn-card-grid': 2, '.kn-card': 6, '.grid-caption': 2 } },
      media: { embed: { '.kn-embed': 2, '.grid-caption': 2 } },
      finding: { 'content-loop': { '.kn-content-loop': 2 } },
      forms: { 'form-states': { '.kn-field': 9, '[data-kn-type="label"]': 3 } },
    })) {
      await page.evaluate((target) => { location.hash = target; }, id);
      await page.waitForFunction((target) => document.querySelector('.document-page.is-current')?.id === target, id);
      const disclosure = page.locator(`#${id} details.variants > summary`);
      if (await disclosure.count()) await disclosure.click();
      for (const [specimen, wanted] of Object.entries(specimens)) {
        const frame = page.locator(`#${id} [data-specimen-frame="${specimen}"]`);
        await frame.waitFor({ state: 'visible' });
        await page.waitForFunction((name) => {
          const inner = document.querySelector(`[data-specimen-frame="${name}"]`);
          return inner?.contentDocument?.querySelector('.sample-root') && inner.contentDocument.readyState === 'complete';
        }, specimen);
        const child = await (await frame.elementHandle()).contentFrame();
        assert.deepEqual(await child.locator('body').evaluate(counts, wanted), wanted, specimen);
        assert.equal(await child.locator('[data-look-on]').count(), 0, 'the marks mean nothing here');
      }
    }
  } finally {
    await page.close();
  }
});
