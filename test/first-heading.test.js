import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { chromium } from 'playwright-core';
import { render, textOf } from './helpers/render.js';
import { startTool } from '../tool/server.js';
import { createPresentation } from '../tool/presentation.js';
import { defaultInputs, derive } from '../src/generator/index.js';
import { heroProps, nextHeadingProps } from '../presentation/src/frame.js';

const PLACES = ['hero', 'below'];
const LOOKS = ['heading-1', 'display'];
const hero = async (props, slots) => one(parse(await render('Hero', { heading: 'A heading', eyebrow: 'An eyebrow', deck: 'A deck', ...props }, slots)), '.kn-hero');
const tagOf = (node) => node.name;

test('a Hero can have an H1, a lower heading or no heading at all, and the look stays its own', async () => {
  for (const type of LOOKS) {
    assert.equal(tagOf(one(await hero({ type }), '.kn-heading-group-heading')), 'h1', 'the H1 by default');
    assert.equal(tagOf(one(await hero({ type, level: 2 }), '.kn-heading-group-heading')), 'h2', 'further down a page');
    const plain = await hero({ type, level: false });
    const heading = one(plain, '.kn-heading-group-heading');
    assert.equal(tagOf(heading), 'p');
    assert.equal(heading.attributes['data-kn-type'], type);
    assert.equal(textOf(heading), 'A heading');
    assert.equal(all(plain, 'h1, h2, h3, h4, h5, h6').length, 0);
    assert.equal(all(plain, 'hgroup').length, 0, 'an hgroup needs a heading');
    assert.equal(tagOf(one(plain, '.kn-heading-group')), 'div');
    assert.equal(textOf(one(plain, '.kn-heading-group-eyebrow')), 'An eyebrow', 'the eyebrow stays');
    assert.equal(textOf(one(plain, '.kn-heading-group-deck')), 'A deck');
  }
});

test('a Heading Group follows its level, and a trail placed in the hero stands first, above the eyebrow', async () => {
  const group = parse(await render('HeadingGroup', { heading: 'A heading', level: false, type: 'heading-1' }));
  assert.equal(tagOf(one(group, '.kn-heading-group')), 'div');
  assert.equal(tagOf(one(group, '.kn-heading-group-heading')), 'p');
  assert.equal(tagOf(one(parse(await render('HeadingGroup', { heading: 'A heading' })), '.kn-heading-group')), 'hgroup');
  const text = one(await hero({}, { before: '<nav class="kn-breadcrumbs"></nav>' }), '.kn-hero-text');
  assert.deepEqual(text.children.filter((node) => node.name).map((node) => node.name), ['nav', 'hgroup']);
});

test('the setting says what the hero\'s heading and the next section\'s are', () => {
  const settings = defaultInputs().hero;
  const images = { hero: '/behind.webp', landscapes: ['/beside.webp'] };
  assert.equal(heroProps(settings, images).level, 1);
  assert.deepEqual(nextHeadingProps(settings), { level: 2, type: 'heading-2' });
  const below = { ...settings, h1: 'below' };
  assert.equal(heroProps(below, images).level, false);
  assert.deepEqual(nextHeadingProps(below), { level: 1, type: 'heading-1' });
  assert.equal(heroProps({ ...below, type: 'display' }, images).type, 'display', 'the look is free of the place');
});

test('the trail\'s look is general, and the muted role is checked on every Surface', async () => {
  assert.doesNotMatch(await readFile('src/components/breadcrumbs.css', 'utf8'), /hero/i);
  const { matrix } = derive(defaultInputs())['contrast-check'];
  for (const [kind, modes] of Object.entries(matrix)) for (const [mode, { pairs }] of Object.entries(modes)) {
    const muted = pairs['text-muted'];
    assert.ok(muted.passed && muted.ratio >= 4.5, `${kind}, ${mode}`);
    for (const [sample, ratio] of Object.entries(muted.samples ?? {})) assert.ok(ratio >= 4.5, `${kind}, ${mode}, over ${sample}`);
  }
  for (const kind of ['picture-dark', 'picture-light']) assert.ok(Object.keys(matrix[kind].light.pairs['text-muted'].samples).length, `${kind} is checked over pictures`);
});

let directory;
let tool;
let browser;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kn-first-heading-'));
  tool = await startTool({ designFile: join(directory, 'made-up.design.json'), port: 0, open: false });
  browser = await chromium.launch();
}, { timeout: 240000 });
after(async () => {
  await browser?.close();
  await tool?.close();
  await rm(directory, { recursive: true, force: true });
});

// What a page holds where the hero and what follows it stand, from a browser, for each place.
const outline = () => {
  const hero = document.querySelector('[data-kn-live-hero]');
  const next = hero.nextElementSibling;
  const heading = hero.querySelector('.kn-heading-group-heading');
  const nextHeading = next.querySelector('.kn-heading-group-heading');
  const h1s = [hero, next].flatMap((part) => [...part.querySelectorAll('h1')]);
  const trail = [hero, next].map((part) => part.querySelector('.kn-breadcrumbs')).find(Boolean);
  const eyebrow = hero.querySelector('.kn-heading-group-eyebrow');
  const look = getComputedStyle(heading);
  const after = (first, second) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  const gapRole = document.createElement('div');
  gapRole.style.blockSize = 'var(--kn-space-component-gap)';
  document.body.append(gapRole);
  const gap = gapRole.getBoundingClientRect().height;
  gapRole.remove();
  return {
    h1s: h1s.length,
    heroHeading: heading.localName,
    heroGroup: heading.parentElement.localName,
    heroType: heading.dataset.knType,
    nextHeading: nextHeading.localName,
    nextGroup: nextHeading.parentElement.localName,
    nextType: nextHeading.dataset.knType,
    trailIn: trail && (hero.contains(trail) ? 'hero' : 'next'),
    trailFirst: trail && trail === trail.parentElement.firstElementChild,
    trailBeforeH1: trail && h1s[0].closest('.kn-heading-group') === trail.nextElementSibling,
    trailGapIsTheRole: trail && Math.abs(trail.nextElementSibling.getBoundingClientRect().top - trail.getBoundingClientRect().bottom - gap) < 0.5,
    eyebrowInHero: Boolean(eyebrow),
    order: Boolean(trail) && (!hero.contains(trail) || (after(trail, eyebrow) && after(eyebrow, heading))) && after(heading, hero.querySelector('.kn-heading-group-deck')) && after(hero.querySelector('.kn-heading-group-deck'), hero.querySelector('.kn-button')),
    look: [look.fontFamily, look.fontSize, look.fontWeight, look.lineHeight, look.letterSpacing, look.color, look.marginBlockStart, look.marginBlockEnd, look.textWrapStyle].join(' | '),
  };
};
const wanted = (place, look) => ({
  h1s: 1,
  heroHeading: place === 'hero' ? 'h1' : 'p',
  heroGroup: place === 'hero' ? 'hgroup' : 'div',
  heroType: look,
  nextHeading: place === 'hero' ? 'h2' : 'h1',
  nextGroup: 'hgroup',
  nextType: place === 'hero' ? 'heading-2' : 'heading-1',
  trailIn: place === 'hero' ? 'hero' : 'next',
  trailFirst: true,
  trailBeforeH1: true,
  trailGapIsTheRole: true,
  eyebrowInHero: true,
  order: true,
});
const assertOutline = (shown, place, look, where) => {
  const { look: _, ...rest } = shown;
  assert.deepEqual(rest, wanted(place, look), `${where}: the H1 ${place}, the look ${look}`);
};

// A whole page's headings: one H1, first, and never a level skipped on the way down.
const pageHeadings = () => [...document.querySelectorAll('.kn-page-main :is(h1, h2, h3, h4, h5, h6)')].map((node) => Number(node.localName[1]));
const assertHeadingOrder = (levels, where) => {
  assert.equal(levels.filter((level) => level === 1).length, 1, `${where}: exactly one H1`);
  assert.equal(levels[0], 1, `${where}: the first heading is the H1`);
  levels.forEach((level, index) => assert.ok(!index || level <= levels[index - 1] + 1, `${where}: ${levels.join()}`));
};

test('the Hero page chooses the H1\'s place and the heading\'s look, all four, live, in place and with no control off', { timeout: 300000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Components' }).click();
    const wide = await (await page.$('#preview')).contentFrame();
    const phone = await (await page.$('#preview-narrow')).contentFrame();
    const ends = [wide, phone];
    for (const end of ends) await end.waitForSelector('[data-component="hero"] [data-kn-live-hero]');
    const opening = page.locator('[data-page="opening"]');
    const pick = (name, value) => opening.locator(`[data-pick="inputs.hero.${name}"][data-value="${value}"]`);

    // Beside the look, in short words, each with a tooltip, and the look's says what the place means for it.
    for (const value of PLACES) assert.ok((await pick('h1', value).textContent()).trim().split(/\s+/).length <= 3);
    for (const name of ['h1', 'type']) assert.equal(await opening.locator(`[data-pick="inputs.hero.${name}"]:not([data-g-tooltip])`).count(), 0);
    const tooltip = await page.locator(`#${await pick('type', 'heading-1').getAttribute('data-g-tooltip')}`).textContent();
    assert.match(tooltip, /under the hero/i);
    assert.match(tooltip, /Display often reads better/);
    assert.equal(await pick('h1', 'hero').getAttribute('aria-pressed'), 'true', 'in the hero unless told otherwise');

    // The same documents and the same hero throughout: nothing is rebuilt, and at every frame there is one H1 with the trail before it.
    for (const end of ends) await end.evaluate(() => {
      window.__sameHero = document.querySelector('[data-kn-live-hero]');
      window.__frames = [];
      const watch = () => {
        const parts = [window.__sameHero, window.__sameHero.nextElementSibling];
        const h1s = parts.flatMap((part) => [...part.querySelectorAll('h1')]);
        window.__frames.push(h1s.length === 1 && h1s[0].closest('.kn-heading-group').previousElementSibling?.matches('.kn-breadcrumbs'));
        window.__watching = requestAnimationFrame(watch);
      };
      watch();
    });
    const left = () => opening.locator('.pick').evaluateAll((nodes) => nodes.map((node) => { const { left: x, top: y, width, height } = node.getBoundingClientRect(); return [x, y, width, height]; }));
    await pick('h1', 'hero').scrollIntoViewIfNeeded();
    const held = await left();
    const looks = {};
    for (const place of [...PLACES, 'hero', 'below', 'hero']) for (const look of LOOKS) {
      await pick('h1', place).click();
      await pick('type', look).click();
      for (const end of ends) {
        await end.waitForFunction(([tag, type]) => {
          const heading = document.querySelector('[data-kn-live-hero] .kn-heading-group-heading');
          return heading.localName === tag && heading.dataset.knType === type;
        }, [place === 'hero' ? 'h1' : 'p', look]);
        const shown = await end.evaluate(outline);
        assertOutline(shown, place, look, end === wide ? 'wide' : 'phone');
        // The element has changed and the look has not, whichever the place.
        const key = `${end === wide ? 'wide' : 'phone'} ${look}`;
        looks[key] ??= shown.look;
        assert.equal(shown.look, looks[key], key);
      }
      assert.deepEqual(await left(), held, 'nothing on the left moves');
      assert.equal(await opening.locator(':is(button, select, input, textarea):disabled').count(), 0, 'no control is off');
      assert.equal(await pick('h1', place).getAttribute('aria-pressed'), 'true');
      assert.equal(await pick('type', look).getAttribute('aria-pressed'), 'true');
    }
    for (const end of ends) {
      const { same, always, frames } = await end.evaluate(() => {
        cancelAnimationFrame(window.__watching);
        return { same: window.__sameHero === document.querySelector('[data-kn-live-hero]'), always: window.__frames.every(Boolean), frames: window.__frames.length };
      });
      assert.ok(same, 'the same document and the same hero');
      assert.ok(frames > 0 && always, 'one H1 with the trail before it at every frame');
    }

    // Both are saved, and pass on to what a site reads.
    await pick('h1', 'below').click();
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    await page.waitForFunction(async () => (await (await fetch('/api/state')).json()).inputs.hero.h1 === 'below');
    const saved = JSON.parse(await readFile(tool.path, 'utf8'));
    assert.equal(saved.inputs.hero.h1, 'below');
    assert.equal(saved.resolved.hero.h1, 'below');
    assert.equal(saved.inputs.hero.type, 'display', 'free of the place');
    await pick('h1', 'hero').click();
    await pick('type', 'heading-1').click();
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('the sample page keeps the rule in both places, whatever else its hero shows, and the trail follows its own settings there', { timeout: 300000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Frame' }).click();
    await page.locator('.page-link', { hasText: 'Breadcrumbs' }).click();
    const wide = await (await page.$('#preview')).contentFrame();
    const phone = await (await page.$('#preview-narrow')).contentFrame();
    const ends = [wide, phone];
    for (const end of ends) await end.waitForFunction(() => location.pathname === '/preview.html' && document.querySelector('.kn-page [data-kn-live-hero]'));
    const pick = (name, value) => page.evaluate(([key, choice]) => document.querySelector(`[data-pick="inputs.hero.${key}"][data-value="${choice}"]`).click(), [name, value]);
    const flag = (path) => page.evaluate((name) => document.querySelector(`[data-flag="inputs.${name}"]`).click(), path);
    const settle = (end, place) => end.waitForFunction((tag) => document.querySelector('[data-kn-live-hero] .kn-heading-group-heading').localName === tag, place === 'hero' ? 'h1' : 'p');

    // The second hero is gone: a plain band follows, with the paragraph and the file name, and display text keeps a place further down.
    assert.equal(await wide.locator('.kn-hero').count(), 1);
    const next = wide.locator('[data-kn-live-hero] + .kn-band');
    assert.equal(await next.locator('.kn-heading-group-heading').textContent(), 'Clear next steps');
    assert.equal(await next.locator('.kn-heading-group-deck').count(), 1);
    assert.equal(await next.locator('code').textContent(), 'delivery-plan.pdf');
    assert.equal(await wide.locator('.kn-page-main h2[data-kn-type="display"]').count(), 1);
    assert.equal(await wide.locator('[data-kn-after-hero]').count(), 0);

    for (const picture of ['behind', 'end-bleed', 'none']) {
      await pick('picture', picture);
      for (const place of PLACES) for (const look of LOOKS) {
        await pick('h1', place);
        await pick('type', look);
        for (const end of ends) {
          await settle(end, place);
          await end.waitForFunction((type) => document.querySelector('[data-kn-live-hero] .kn-heading-group-heading').dataset.knType === type, look);
          assertOutline(await end.evaluate(outline), place, look, `${picture}, ${end === wide ? 'wide' : 'phone'}`);
          assertHeadingOrder(await end.evaluate(pageHeadings), `${picture}, ${place}, ${look}`);
          assert.equal(await end.evaluate(() => document.querySelectorAll('h1').length), 1, 'the header and footer hold none');
        }
      }
    }

    // With the H1 under the hero the trail stands there, and comes back there, with its own settings.
    await pick('h1', 'below');
    await pick('picture', 'behind');
    await settle(wide, 'below');
    await flag('breadcrumbs.show');
    await wide.waitForFunction(() => !document.querySelector('.kn-breadcrumbs'));
    assert.equal(await wide.evaluate(() => document.querySelectorAll('.kn-page-main h1').length), 1, 'the rule for the H1 needs no trail');
    await flag('breadcrumbs.show');
    await wide.waitForFunction(() => document.querySelector('[data-kn-live-hero] + .kn-band > .kn-band-content > .kn-breadcrumbs:first-child + hgroup > h1'));
    await page.locator('[data-pick="inputs.breadcrumbs.separator"][data-value="chevron"]').click();
    await wide.waitForSelector('[data-kn-live-hero] + .kn-band .kn-breadcrumbs[data-kn-separator="chevron"]');
    // It moves with its settings, and the Hero page's own sample has them too, though it was built before they were chosen.
    await pick('h1', 'hero');
    await wide.waitForSelector('[data-kn-live-hero] .kn-hero-text > .kn-breadcrumbs[data-kn-separator="chevron"]:first-child');
    await page.locator('.chapter', { hasText: 'Components' }).click();
    await wide.waitForSelector('[data-component="hero"] .kn-hero-text > .kn-breadcrumbs[data-kn-separator="chevron"]:first-child');
    await page.evaluate(() => document.querySelector('[data-pick="inputs.breadcrumbs.separator"][data-value="slash"]').click());
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('the trail is quiet on every Surface in both modes, a little smaller, and its links show themselves on hover', { timeout: 300000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Frame' }).click();
    await page.locator('.page-link', { hasText: 'Breadcrumbs' }).click();
    const wide = await (await page.$('#preview')).contentFrame();
    await wide.waitForFunction(() => location.pathname === '/preview.html' && document.querySelector('.kn-page .kn-breadcrumbs'));
    await wide.waitForFunction(() => document.getElementById('kn-live-core').textContent);
    const resolved = derive((await (await page.request.get(`${tool.url}/api/state`)).json()).inputs);
    for (const mode of ['light', 'dark']) {
      const shown = await wide.evaluate(([kinds, chosen]) => {
        document.documentElement.dataset.knMode = chosen;
        const source = document.querySelector('.kn-breadcrumbs');
        return kinds.map((kind) => {
          const box = document.createElement('div');
          box.dataset.knSurface = kind;
          const trail = source.cloneNode(true);
          const probe = document.createElement('span');
          probe.style.color = 'var(--kn-text-muted)';
          box.append(trail, probe);
          document.body.append(box);
          const colours = {
            muted: getComputedStyle(probe).color,
            link: getComputedStyle(trail.querySelector('a')).color,
            current: getComputedStyle(trail.querySelector('[aria-current]')).color,
            mark: getComputedStyle(trail.querySelector('.kn-breadcrumbs-separator'), '::before').color,
          };
          box.remove();
          return [kind, colours];
        });
      }, [Object.keys(resolved.surfaces), mode]);
      for (const [kind, { muted, link, current, mark }] of shown) {
        assert.equal(link, muted, `${kind}, ${mode}: the links`);
        assert.equal(current, muted, `${kind}, ${mode}: the current page`);
        assert.equal(mark, muted, `${kind}, ${mode}: the marks`);
      }
    }
    await wide.evaluate(() => { document.documentElement.dataset.knMode = 'light'; });

    const sizes = await wide.evaluate(() => {
      const size = (node) => parseFloat(getComputedStyle(node).fontSize);
      const nav = document.querySelector('.kn-breadcrumbs');
      const label = document.createElement('span');
      label.style.fontSize = 'var(--kn-type-label-size)';
      nav.append(label);
      const read = { small: size(nav), trail: size(nav.querySelector('ol')), link: size(nav.querySelector('a')), label: size(label) };
      label.remove();
      return read;
    });
    assert.ok(sizes.trail < sizes.small, 'a little smaller than small text');
    assert.ok(sizes.trail >= sizes.label, 'and never smaller than a label');
    assert.equal(sizes.link, sizes.trail);

    const link = wide.locator('.kn-breadcrumbs a').first();
    await link.hover();
    await wide.waitForFunction(() => getComputedStyle(document.querySelector('.kn-breadcrumbs a')).textDecorationLine === 'underline');
    assert.equal(await link.evaluate((node) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--kn-text)';
      node.append(probe);
      const same = getComputedStyle(probe).color === getComputedStyle(node).color;
      probe.remove();
      return same;
    }), true, 'the normal text colour under the pointer');
  } finally {
    await page.close();
  }
});

test('the report is built under both places, with the rule on its sample page and its hero', { timeout: 300000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const base = JSON.parse(await readFile(tool.path, 'utf8'));
    for (const [place, look] of [['hero', 'heading-1'], ['below', 'display']]) {
      const design = join(directory, `report-${place}.design.json`);
      await writeFile(design, JSON.stringify({ inputs: { ...base.inputs, hero: { ...base.inputs.hero, h1: place, type: look } }, project: base.project }));
      const { html } = await createPresentation(design, join(directory, `report-${place}.zip`), { includeHtml: true });
      const file = join(directory, `report-${place}.html`);
      await writeFile(file, html);
      await page.goto(pathToFileURL(file).href);
      for (const [section, specimen] of [['page', 'preview'], ['opening', 'hero']]) {
        await page.evaluate((id) => { location.hash = id; }, section);
        await page.waitForFunction((id) => document.querySelector('.document-page.is-current')?.id === id, section);
        const selector = `[data-specimen-frame="${specimen}"]`;
        await page.locator(selector).waitFor({ state: 'visible' });
        await page.waitForFunction((target) => {
          const frame = document.querySelector(target);
          return frame?.contentDocument?.querySelector('.sample-root') && frame.contentDocument.readyState === 'complete';
        }, selector);
        const frame = await (await page.locator(selector).elementHandle()).contentFrame();
        assertOutline(await frame.evaluate(outline), place, look, specimen);
        if (specimen === 'preview') assertHeadingOrder(await frame.evaluate(pageHeadings), `the report, ${place}`);
      }
    }
  } finally {
    await page.close();
  }
});
