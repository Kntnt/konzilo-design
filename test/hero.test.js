import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'ultrahtml';
import { querySelector as one } from 'ultrahtml/selector';
import { chromium } from 'playwright-core';
import { render } from './helpers/render.js';
import { startTool } from '../tool/server.js';
import { defaultInputs } from '../src/generator/index.js';
import { heroProps } from '../presentation/src/frame.js';
import { heroAttributes } from '../src/components/hero-attributes.js';

const PICTURES = ['none', 'behind', 'start-bleed', 'end-bleed', 'start', 'end'];
const PLACES = ['top', 'center', 'bottom'];
const HEIGHTS = ['third', 'half', 'two-thirds', 'full'];
const ALIGNS = ['start', 'center', 'end'];

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

test('a picture lies behind on a picture Surface and otherwise stands on its side', async () => {
  const behind = await hero({ surface: 'picture-dark', picture: '/a.webp' });
  assert.match(behind.attributes.style, /--kn-picture-image/);
  assert.equal(behind.attributes['data-kn-picture'], undefined);
  assert.ok(!one(behind, '.kn-hero-media'));
  const beside = await hero({ surface: 'brand', picture: '/a.webp', alt: '' });
  assert.equal(beside.attributes['data-kn-picture'], 'end', 'it stands at the end unless told otherwise');
  assert.equal(one(beside, '.kn-hero-media img').attributes.src, '/a.webp');
  await assert.rejects(hero({ picture: '/a.webp' }), /requires alternative text/);
});

test('a hero says how much of the screen it takes and where its text stands', async () => {
  const plain = await hero({});
  assert.equal(plain.attributes['data-kn-height'], undefined);
  assert.equal(plain.attributes['data-kn-place'], undefined);
  assert.equal(plain.attributes['data-kn-align'], undefined);
  const tall = await hero({ height: 'two-thirds', place: 'bottom' });
  assert.equal(tall.attributes['data-kn-height'], 'two-thirds');
  assert.equal(tall.attributes['data-kn-place'], 'bottom');
});

test('every picture, place and size of a design becomes the same attributes in the component and the live sample', async () => {
  const images = { hero: '/behind.webp', landscapes: ['/beside.webp'] };
  for (const picture of PICTURES) for (const place of PLACES) for (const height of HEIGHTS) {
    const settings = { ...defaultInputs().hero, picture, place, height };
    const props = heroProps(settings, images);
    const node = await hero(props);
    const name = `${picture} ${place} ${height}`;
    const side = picture === 'none' || picture === 'behind' ? undefined : picture;
    assert.equal(node.attributes['data-kn-picture'], side, name);
    assert.equal(node.attributes['data-kn-height'], height, name);
    assert.equal(node.attributes['data-kn-place'], place === 'center' ? undefined : place, name);
    assert.equal(node.attributes['data-kn-surface'], picture === 'behind' ? 'picture-dark' : undefined, name);
    assert.equal(Boolean(one(node, '.kn-hero-media')), Boolean(side), name);
    assert.equal(Boolean(node.attributes.style?.includes('--kn-picture-image')), picture === 'behind', name);
    // The live sample writes what the helper says, and the helper says what the component wrote.
    const written = heroAttributes(props);
    for (const key of ['data-kn-picture', 'data-kn-height', 'data-kn-place', 'data-kn-align']) assert.equal(written[key], node.attributes[key], `${name}: ${key}`);
  }
});

test('where the text block stands across is an attribute of its own, at every picture', async () => {
  const images = { hero: '/behind.webp', landscapes: ['/beside.webp'] };
  for (const picture of PICTURES) {
    const align = async (value) => (await hero(heroProps({ ...defaultInputs().hero, picture, align: value }, images))).attributes['data-kn-align'];
    assert.equal(await align('start'), undefined, picture);
    assert.equal(await align('center'), 'center', picture);
    assert.equal(await align('end'), 'end', picture);
  }
});

const measureHero = (node) => {
  const rect = (part) => {
    const { left, right, top, bottom, width, height } = part.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  };
  const content = node.querySelector('.kn-hero-content');
  const media = node.querySelector('.kn-hero-media');
  const before = getComputedStyle(content, '::before');
  const box = rect(node);
  const inside = rect(content);
  const text = rect(node.querySelector('.kn-hero-text'));
  return {
    hero: box,
    text,
    media: media && rect(media),
    heading: rect(node.querySelector('.kn-heading-group-heading')),
    deck: rect(node.querySelector('.kn-heading-group-deck')),
    mask: before.maskImage,
    scrim: before.backgroundColor,
    pseudo: before.content,
    // Where the pseudo-element's edges stand, from the offsets it was given.
    pseudoTop: inside.top + parseFloat(before.top),
    pseudoBottom: inside.bottom - parseFloat(before.bottom),
    fadeLength: parseFloat(getComputedStyle(node).getPropertyValue('--kn-scrim-fade-length')) || 0,
    paddingTop: parseFloat(getComputedStyle(node).paddingBlockStart),
    paddingBottom: parseFloat(getComputedStyle(node).paddingBlockEnd),
    image: getComputedStyle(node).backgroundImage,
  };
};
// The rail is the content width: the grid's two middle tracks, whatever the window's width.
const railOf = (node) => {
  const probe = document.createElement('div');
  probe.style.cssText = 'inline-size: var(--kn-layout-content-area); margin-inline: auto; block-size: 1px;';
  node.parentElement.append(probe);
  const { left, right } = probe.getBoundingClientRect();
  probe.remove();
  return { left, right };
};

// One tool for both tests below, since each start builds the preview in a folder that every test file shares.
let directory;
let tool;
let browser;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kn-hero-'));
  tool = await startTool({ designFile: join(directory, 'client.design.json'), port: 0, open: false });
  browser = await chromium.launch();
}, { timeout: 240000 });
after(async () => {
  await browser?.close();
  await tool?.close();
  await rm(directory, { recursive: true, force: true });
});

test('the tool chooses the design\'s hero with nothing disabled, and the overlay follows the text', { timeout: 300000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Components' }).click();
    const preview = await (await page.$('#preview')).contentFrame();
    const phone = await (await page.$('#preview-narrow')).contentFrame();
    for (const end of [preview, phone]) await end.waitForSelector('[data-component="hero"] [data-kn-live-hero]');
    const opening = page.locator('[data-page="opening"]');
    const pick = (name, value) => page.locator(`[data-pick="inputs.hero.${name}"][data-value="${value}"]`);
    const liveHero = '[data-component="hero"] .kn-hero';
    // Waits until the sample shows the choice, so a measurement never reads the one before.
    const settled = (end, { picture, place, height, align }) => end.waitForFunction(([selector, wanted]) => {
      const { dataset } = document.querySelector(selector);
      return (wanted.picture === undefined || (dataset.knPicture ?? '') === wanted.picture)
        && (wanted.place === undefined || (dataset.knPlace ?? 'center') === wanted.place)
        && (wanted.height === undefined || dataset.knHeight === wanted.height)
        && (wanted.align === undefined || (dataset.knAlign ?? 'start') === wanted.align);
    }, [liveHero, { picture: picture === 'behind' || picture === 'none' ? '' : picture, place, height, align }]);
    const choose = async (values) => {
      for (const [name, value] of Object.entries(values)) await pick(name, value).click();
      await Promise.all([preview, phone].map((end) => settled(end, values)));
    };
    const measure = (end = preview) => end.locator(liveHero).evaluate(measureHero);
    const rail = (end = preview) => end.locator(liveHero).evaluate(railOf);

    // The settings run in the owner's order, and every choice is short, drawn and explained.
    assert.deepEqual(await opening.locator('.setting-title').allTextContents(), ['Size', 'Picture', 'Text', 'Behind the text', 'Heading', 'On this page']);
    const groups = await opening.locator('.picks').evaluateAll((lists) => lists.map((list) => [...list.querySelectorAll('[data-pick]')].map((button) => `${button.dataset.pick.split('.').pop()}:${button.dataset.value}`)));
    assert.deepEqual(groups.slice(0, 4), [
      HEIGHTS.map((value) => `height:${value}`),
      PICTURES.map((value) => `picture:${value}`),
      PLACES.map((value) => `place:${value}`),
      ALIGNS.map((value) => `align:${value}`),
    ]);
    const controls = opening.locator('[data-pick], select');
    assert.ok(await controls.count() >= 18);
    for (const control of await controls.all()) {
      const described = await control.getAttribute('aria-describedby');
      assert.ok(described?.startsWith('tip-'), 'every control has a tooltip');
      assert.ok((await page.locator(`[id="${described}"]`).textContent()).length > 15);
    }
    const words = await opening.locator('.pick-word').allTextContents();
    assert.ok(words.every((word) => word.length <= 11), `short choices: ${words}`);

    // Nothing is ever disabled, and no control moves, whatever is pressed. Every combination reaches the sample.
    const places = () => controls.evaluateAll((nodes) => nodes.filter((node) => node.getClientRects().length).map((node) => { const { left, top, width, height } = node.getBoundingClientRect(); return [left, top, width, height]; }));
    const still = await places();
    for (const picture of PICTURES) for (const place of PLACES) for (const height of HEIGHTS) {
      await choose({ picture, place, height });
      assert.equal(await opening.locator(':disabled, [aria-disabled="true"]').count(), 0, `${picture} ${place} ${height}: nothing disabled`);
      assert.equal(await pick('place', place).getAttribute('aria-pressed'), 'true', 'the choice shows as it was made, also at a third');
    }
    assert.deepEqual(await places(), still);

    // Over a picture behind the text the overlay follows the text.
    await pick('picture', 'behind').click();
    const screen = 1440 * 0.625;
    for (const [height, share] of [['half', 1 / 2], ['two-thirds', 2 / 3], ['full', 1]]) {
      await choose({ picture: 'behind', height, place: 'center' });
      const centred = await measure();
      assert.ok(centred.hero.height >= screen * share - 1, `${height}: at least its share`);
      assert.ok(Math.abs((centred.text.top - centred.hero.top) - (centred.hero.bottom - centred.text.bottom)) < 2, `${height}: in the middle`);
      assert.match(centred.image, /linear-gradient/, `${height}: in the middle the even overlay covers all of the picture`);
      assert.equal(centred.pseudo, 'none', `${height}: and no fade stands on the text`);

      await choose({ picture: 'behind', height, place: 'bottom' });
      const bottom = await measure();
      assert.doesNotMatch(bottom.image, /linear-gradient/, `${height}: at the bottom the even overlay is gone`);
      assert.doesNotMatch(bottom.mask, /^linear-gradient\((?:to top|0deg)/, `${height}: at the bottom it fades in going down`);
      assert.match(bottom.scrim, /0\.57\)/, `${height}: to the Surface's tested strength`);
      assert.ok(bottom.pseudoTop + bottom.fadeLength <= bottom.text.top + 1, `${height}: full strength by the top line`);
      assert.ok(bottom.pseudoBottom >= bottom.hero.bottom - 1, `${height}: and on to the hero's bottom`);
      assert.ok(bottom.hero.bottom - bottom.text.bottom < bottom.text.top - bottom.hero.top, `${height}: the text stands at the bottom`);

      await choose({ picture: 'behind', height, place: 'top' });
      const top = await measure();
      assert.doesNotMatch(top.image, /linear-gradient/, `${height}: at the top the even overlay is gone`);
      assert.match(top.mask, /^linear-gradient\((?:to top|0deg), /, `${height}: at the top it fades away going down`);
      assert.match(top.scrim, /0\.57\)/, `${height}: from the Surface's tested strength`);
      assert.ok(top.pseudoTop <= top.hero.top + 1, `${height}: full strength from the hero's top`);
      assert.ok(top.pseudoBottom - top.fadeLength >= top.text.bottom - 1, `${height}: and through the last line`);
      assert.ok(top.pseudoBottom > top.text.bottom + 20, `${height}: and it fades away below`);
      assert.ok(top.text.top - top.hero.top < top.hero.bottom - top.text.bottom, `${height}: the text stands at the top`);
    }

    // A longer text moves the fade with it, both ways.
    const deck = preview.locator('[data-component="hero"] .kn-heading-group-deck');
    await choose({ picture: 'behind', height: 'full', place: 'bottom' });
    const short = await measure();
    const original = await deck.textContent();
    await deck.evaluate((node) => { node.textContent = node.textContent.repeat(8); });
    const long = await measure();
    assert.ok(long.text.top < short.text.top - 20);
    assert.ok(long.pseudoTop + long.fadeLength <= long.text.top + 1);
    await choose({ picture: 'behind', height: 'full', place: 'top' });
    const longTop = await measure();
    assert.ok(longTop.pseudoBottom - longTop.fadeLength >= longTop.text.bottom - 1);
    await deck.evaluate((node, words) => { node.textContent = words; }, original);

    // Across: the block moves, its lines still begin together, and a picture at the side leaves the control without effect.
    for (const picture of ['behind', 'none']) {
      await choose({ picture, height: 'two-thirds', place: 'center', align: 'start' });
      const { left, right } = await rail();
      const start = await measure();
      assert.ok(Math.abs(start.text.left - left) < 1, `${picture}: at the start of the content width`);
      await choose({ picture, align: 'center' });
      const centre = await measure();
      assert.ok(Math.abs((centre.text.left + centre.text.right) / 2 - (left + right) / 2) < 1, `${picture}: in the centre of the content width`);
      assert.ok(Math.abs(centre.heading.left - centre.text.left) < 1 && Math.abs(centre.deck.left - centre.text.left) < 1, `${picture}: the lines begin together`);
      assert.equal(await preview.locator(`${liveHero} .kn-hero-text`).evaluate((node) => getComputedStyle(node).textAlign), 'start');
      await choose({ picture, align: 'end' });
      const end = await measure();
      assert.ok(Math.abs(end.text.right - right) < 1, `${picture}: at the end of the content width`);
      assert.ok(Math.abs(end.heading.left - end.text.left) < 1, `${picture}: the lines still begin together`);
      assert.ok(Math.abs(end.text.width - start.text.width) < 1, `${picture}: the block keeps its measure as it moves`);
    }
    await choose({ picture: 'end', align: 'start' });
    const unaligned = await measure();
    await choose({ picture: 'end', align: 'end' });
    assert.deepEqual((await measure()).text, unaligned.text, 'a picture at the side gives the text its half');
    await choose({ picture: 'end', align: 'start' });

    // A picture at the side: the text on the opposite side, the picture in the content width or out to the window.
    for (const place of PLACES) for (const height of ['half', 'full']) {
      await choose({ picture: 'end', place, height });
      const { left, right } = await rail();
      const end = await measure();
      assert.ok(Math.abs(end.text.left - left) < 1, 'a picture on the right has the text on the left');
      assert.ok(end.media.left > end.text.right - 1);
      assert.ok(Math.abs(end.media.right - right) < 1, 'inside the content width');
      assert.ok(Math.abs(end.media.top - (end.hero.top + end.paddingTop)) < 1, 'with the hero\'s padding above');
      assert.ok(Math.abs(end.media.bottom - (end.hero.bottom - end.paddingBottom)) < 1, 'and below');

      await choose({ picture: 'start', place, height });
      const start = await measure();
      assert.ok(Math.abs(start.media.left - left) < 1 && Math.abs(start.text.right - right) < 2, 'a picture on the left has the text on the right');

      await choose({ picture: 'end-bleed', place, height });
      const endBleed = await measure();
      assert.ok(Math.abs(endBleed.text.left - left) < 1);
      assert.ok(endBleed.media.right >= endBleed.hero.right - 1, 'out to the window\'s edge');
      assert.ok(endBleed.media.top <= endBleed.hero.top + 1, 'to the hero\'s top');
      assert.ok(endBleed.media.bottom >= endBleed.hero.bottom - 1, 'and its bottom');
      assert.ok(Math.abs((endBleed.media.left + start.media.right) - 1440) < 2, 'the halves of the content width meet where they do without the bleed');

      await choose({ picture: 'start-bleed', place, height });
      const startBleed = await measure();
      assert.ok(startBleed.media.left <= startBleed.hero.left + 1);
      assert.ok(Math.abs(startBleed.text.right - right) < 2);
      assert.ok(startBleed.media.top <= startBleed.hero.top + 1 && startBleed.media.bottom >= startBleed.hero.bottom - 1);

      // The place moves the text within its half.
      const gapAbove = startBleed.text.top - startBleed.hero.top;
      const gapBelow = startBleed.hero.bottom - startBleed.text.bottom;
      if (height === 'full' && place === 'top') assert.ok(gapAbove < gapBelow, 'text at the top of its half');
      if (height === 'full' && place === 'bottom') assert.ok(gapBelow < gapAbove, 'text at the bottom of its half');
      if (height === 'full' && place === 'center') assert.ok(Math.abs(gapAbove - gapBelow) < 2, 'text in the middle of its half');

      // On a phone the picture stands above the text, bleeding if the setting bleeds.
      const narrow = await measure(phone);
      assert.ok(narrow.media.bottom <= narrow.text.top + 1, 'the picture above the text');
      assert.ok(narrow.media.left <= narrow.hero.left + 1 && narrow.media.right >= narrow.hero.right - 1 && narrow.media.top <= narrow.hero.top + 1, 'out to the edges');
      await choose({ picture: 'start', place, height });
      const inset = await measure(phone);
      assert.ok(inset.media.bottom <= inset.text.top + 1, 'the picture above the text');
      assert.ok(inset.media.left > inset.hero.left + 1 && inset.media.right < inset.hero.right - 1 && inset.media.top > inset.hero.top + 1, 'inside the content width');
    }

    // The values are logical: right to left, the start is on the right, and the block moves the other way.
    await preview.locator(liveHero).evaluate((node) => { node.dir = 'rtl'; });
    await choose({ picture: 'start-bleed', place: 'center', height: 'half' });
    const rtl = await measure();
    assert.ok(rtl.media.right >= rtl.hero.right - 1, 'a picture at the start bleeds to the right');
    assert.ok(rtl.text.right <= rtl.media.left + 1, 'with the text on the left');
    await choose({ picture: 'none', align: 'end' });
    const rtlBlock = await measure();
    assert.ok(Math.abs(rtlBlock.text.left - (await rail()).left) < 1, 'and the end of the content width is on the left');
    assert.ok(Math.abs(rtlBlock.heading.right - rtlBlock.text.right) < 1, 'with its lines beginning at the right');
    await choose({ picture: 'none', align: 'start' });
    await preview.locator(liveHero).evaluate((node) => node.removeAttribute('dir'));

    // A hero that fills the screen keeps the space under its text, though the next band has no colour of its own either.
    await choose({ picture: 'none', height: 'full', place: 'bottom' });
    const fold = await measure();
    assert.ok(fold.hero.bottom - fold.text.bottom > 20, 'the text does not touch the fold');

    // The sample's grey bars stand for what follows the next section's real heading, within the screen, and have no words of their own.
    const rest = preview.locator('[data-component="hero"] .hero-rest-bars');
    assert.equal(await rest.getAttribute('aria-hidden'), 'true');
    assert.equal((await rest.textContent()).trim(), '');
    assert.ok(await rest.locator('i').count() > 3);
    assert.equal(await preview.locator('[data-component="hero"] .hero-rest h2').count(), 1);

    // Background and heading, in any combination, with no control off.
    await choose({ picture: 'behind', height: 'two-thirds', place: 'bottom' });
    await page.locator('[data-path="inputs.hero.overlay"]').selectOption('light');
    await preview.waitForSelector(`${liveHero}[data-kn-surface="picture-light"]`);
    // With a picture behind the text there is an overlay to choose, otherwise a colour, in the same place.
    const colour = page.locator('[data-path="inputs.hero.surface"]');
    const overlay = page.locator('[data-path="inputs.hero.overlay"]');
    assert.deepEqual([await colour.isVisible(), await overlay.isVisible()], [false, true]);
    const place = await overlay.boundingBox();
    await pick('picture', 'end-bleed').click();
    assert.deepEqual([await colour.isVisible(), await overlay.isVisible()], [true, false]);
    assert.deepEqual(await colour.boundingBox(), place, 'one control stands in the place of the other');
    await colour.selectOption('brand');
    await preview.waitForSelector(`${liveHero}[data-kn-picture="end-bleed"] > .kn-hero-content > .kn-hero-media img[src]`);
    await preview.waitForSelector(`${liveHero}[data-kn-surface="brand"]`);
    assert.equal(await preview.locator(liveHero).evaluate((node) => node.style.getPropertyValue('--kn-picture-image')), '');
    const media = preview.locator(`${liveHero} .kn-hero-media`);
    await media.evaluate((node) => { node.dataset.same = 'yes'; });
    await pick('picture', 'start').click();
    await preview.waitForSelector(`${liveHero}[data-kn-picture="start"]`);
    assert.equal(await media.getAttribute('data-same'), 'yes', 'moving the picture does not rebuild it');
    await pick('picture', 'none').click();
    await preview.waitForFunction(() => !document.querySelector('[data-component="hero"] .kn-hero-media'));
    await pick('type', 'display').click();
    await preview.waitForSelector('[data-component="hero"] .kn-heading-group-heading[data-kn-type="display"]');
    await page.locator('[data-path="inputs.hero.surface"]').selectOption('none');
    await preview.waitForFunction(() => !document.querySelector('[data-component="hero"] .kn-hero').hasAttribute('data-kn-surface'));

    // The choice is the design's, so it is saved.
    await choose({ picture: 'behind' });
    await page.locator('[data-path="inputs.hero.overlay"]').selectOption('dark');
    await choose({ picture: 'none', align: 'center' });
    await page.waitForFunction(() => document.querySelector('#status-text').textContent === 'Saved');
    const saved = JSON.parse(await readFile(tool.path, 'utf8'));
    assert.equal(saved.inputs.hero.type, 'display');
    assert.equal(saved.inputs.hero.align, 'center');
    assert.equal(saved.resolved.hero.align, 'center');
    assert.deepEqual(errors, []);

    // Outside a sample's made-up screen, the share is of the window, and tall content grows past it.
    const direct = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await direct.goto(`${tool.url}/catalogue.html`);
    const real = await direct.locator('[data-component="hero"] .kn-hero').evaluate((node) => {
      node.dataset.knHeight = 'full';
      document.body.prepend(node);
      return { full: node.getBoundingClientRect().height, window: innerHeight };
    });
    assert.equal(Math.round(real.full), real.window);
    await direct.close();
  } finally {
    await page.close();
  }
});

// What a picture above the text adds to a hero on a phone, from what shows: its 16:9 share and the gap under it, less the padding a bleeding one reaches through.
const leastPicture = ({ media, text, paddingTop }, picture) => media.width * 9 / 16 + (text.top - media.bottom) - (picture.endsWith('-bleed') ? paddingTop : 0);
// A hero's choices made from any page, since the controls need not be on the one showing.
const pickHero = (page, name, value) => page.evaluate(([key, wanted]) => document.querySelector(`[data-pick="inputs.hero.${key}"][data-value="${wanted}"]`).click(), [name, value]);
const shownAs = (end, selector, { picture, place, height }) => end.waitForFunction(([within, wanted]) => {
  const { dataset } = document.querySelector(within);
  return (dataset.knPicture ?? '') === wanted.picture && (dataset.knPlace ?? 'center') === wanted.place && dataset.knHeight === wanted.height;
}, [selector, { picture: ['none', 'behind'].includes(picture) ? '' : picture, place, height }]);

test('the chosen height holds unless the text needs more, and the space above and below the text is even', { timeout: 300000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Components' }).click();
    const preview = await (await page.$('#preview')).contentFrame();
    const phone = await (await page.$('#preview-narrow')).contentFrame();
    for (const end of [preview, phone]) await end.waitForSelector('[data-component="hero"] [data-kn-live-hero]');
    const liveHero = '[data-component="hero"] .kn-hero';
    const SHARES = { third: 1 / 3, half: 1 / 2, 'two-thirds': 2 / 3, full: 1 };
    const screen = (end) => end.evaluate(() => innerWidth * (innerWidth <= 640 ? 2.16 : 0.625));
    const shorten = (end) => end.locator(liveHero).evaluate((node) => {
      for (const part of node.querySelectorAll('.kn-heading-group-eyebrow, .kn-heading-group-deck, .kn-button')) part.style.display = 'none';
      node.querySelector('.kn-heading-group-heading').textContent = 'Short';
    });
    const check = async (end, label, { picture, place, height }, wholeShare) => {
      const shown = await end.locator(liveHero).evaluate(measureHero);
      const above = shown.text.top - shown.hero.top;
      const below = shown.hero.bottom - shown.text.bottom;
      const name = `${label} ${picture} ${place} ${height}`;
      const narrow = await end.evaluate(() => innerWidth <= 640);
      assert.ok(Math.abs(shown.paddingTop - shown.paddingBottom) < 1, `${name}: even padding`);
      const wanted = (await screen(end)) * SHARES[height];
      // Beside the text a picture adds nothing. Above it, on a phone, it adds its least height and a gap, a bleeding one less the padding it reaches through.
      const stacked = narrow && !['none', 'behind'].includes(picture);
      const least = stacked ? leastPicture(shown, picture) : 0;
      const needed = shown.text.height + 2 * shown.paddingBottom + least;
      assert.ok(Math.abs(shown.hero.height - Math.max(wanted, needed)) < 1, `${name}: ${shown.hero.height} is the chosen ${wanted} or what the text and any picture above it need, ${needed}`);
      if (wholeShare && !stacked) assert.ok(Math.abs(shown.hero.height - wanted) < 1, `${name}: short text leaves the chosen height`);
      assert.ok(below >= shown.paddingBottom - 1 && above >= shown.paddingTop - 1, `${name}: the text keeps the padding`);
      // On a phone a picture above the text takes the rest, so the text stands at the bottom whatever the place.
      if (narrow && !['none', 'behind'].includes(picture)) return assert.ok(Math.abs(below - shown.paddingBottom) < 1, `${name}: at the hero's foot`);
      if (place === 'top') assert.ok(Math.abs(above - shown.paddingTop) < 1, `${name}: at the top`);
      if (place === 'bottom') assert.ok(Math.abs(below - shown.paddingBottom) < 1, `${name}: at the bottom`);
      if (place === 'center') assert.ok(Math.abs(above - below) < 2, `${name}: truly in the middle, ${above} and ${below}`);
    };
    const each = async (label, wholeShare) => {
      for (const picture of PICTURES) for (const height of HEIGHTS) for (const place of PLACES) {
        const values = { picture, place, height };
        await pickHero(page, 'picture', picture);
        await pickHero(page, 'height', height);
        await pickHero(page, 'place', place);
        await Promise.all([preview, phone].map((end) => shownAs(end, liveHero, values)));
        await check(preview, `${label} desktop`, values, wholeShare);
        await check(phone, `${label} phone`, values, wholeShare);
      }
    };
    await each('sample', false);
    await Promise.all([preview, phone].map(shorten));
    await each('short', true);
    // A picture beside short text still takes the row it is given, and on a phone what the text leaves.
    await pickHero(page, 'picture', 'end');
    await pickHero(page, 'height', 'third');
    await pickHero(page, 'place', 'center');
    await Promise.all([preview, phone].map((end) => shownAs(end, liveHero, { picture: 'end', place: 'center', height: 'third' })));
    const beside = await preview.locator(liveHero).evaluate(measureHero);
    assert.ok(Math.abs(beside.media.height - (beside.hero.height - 2 * beside.paddingBottom)) < 1, 'the picture fills the row between the padding');
  } finally {
    await page.close();
  }
});

test('on a phone a chosen picture never vanishes: it keeps a 16:9 share of its width, and the hero grows for it when it must', { timeout: 120000 }, async () => {
  const images = { hero: '/behind.webp', landscapes: ['/beside.webp'] };
  const selector = '[data-component="hero"] .kn-hero';
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${tool.url}/catalogue.html`);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const screen = width * 2.16;
      const shares = { third: 1 / 3, half: 1 / 2, 'two-thirds': 2 / 3, full: 1 };
      const heights = {};
      for (const picture of ['start', 'end', 'start-bleed', 'end-bleed']) for (const height of HEIGHTS) {
        const settings = { ...defaultInputs().hero, picture, height, place: 'center' };
        await page.evaluate((hero) => window.postMessage({ type: 'kn-design', hero }, '*'), { settings, images });
        await shownAs(page, selector, { picture, place: 'center', height });
        const shown = await page.locator(selector).evaluate(measureHero);
        const name = `${width} px ${picture} ${height}`;
        assert.ok(shown.media.height >= shown.media.width * 9 / 16 - 1, `${name}: ${shown.media.height} high and ${shown.media.width} wide`);
        assert.ok(shown.media.bottom <= shown.text.top - 1, `${name}: above the text, with a gap`);
        const needed = shown.text.height + 2 * shown.paddingBottom + leastPicture(shown, picture);
        assert.ok(Math.abs(shown.hero.height - Math.max(screen * shares[height], needed)) < 1, `${name}: ${shown.hero.height} is its share or what text and picture need, ${needed}`);
        if (screen * shares[height] > needed + 1) assert.ok(shown.media.height > shown.media.width * 9 / 16 + 1, `${name}: past that the picture takes what the text leaves`);
        (heights[picture] ??= []).push(shown.hero.height);
      }
      for (const [picture, grown] of Object.entries(heights)) assert.ok(grown.at(-1) > grown[0], `${width} px ${picture}: a larger share still makes a taller hero`);
    }
  } finally {
    await page.close();
  }
});

// How strong an overlay is on a screenshot of a picture of one flat value, read along a column free of text.
const strengthOf = async (reader, png, flat, colour) => reader.evaluate(async ([data, base, over]) => {
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const { data: pixels } = context.getImageData(1, 0, 1, image.height);
  // The last row may be the next band's, once the shot is scaled.
  return Array.from({ length: image.height - 1 }, (_, row) => (pixels[row * 4] - base) / (over - base));
}, [png.toString('base64'), flat, colour]);

test('no point of a picture is darker or lighter than its overlay\'s tested strength, under a transparent header too', { timeout: 240000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reader = await browser.newPage();
  try {
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Frame' }).click();
    await page.locator('[data-path="inputs.header.start"]').selectOption('under');
    const preview = await (await page.$('#preview')).contentFrame();
    const first = '.kn-page-main > .kn-hero:first-child';
    await preview.waitForSelector(`.kn-page[data-kn-header-start="under"] > ${first}`);
    await pickHero(page, 'picture', 'behind');
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    const { resolved } = JSON.parse(await readFile(tool.path, 'utf8'));
    // Dark last, as the tests after this one find it.
    for (const [overlay, flat] of [['light', 0], ['dark', 255]]) {
      const { color, opacity } = resolved.surfaces[`picture-${overlay}`].light.scrim;
      const colour = parseInt(color.slice(1, 3), 16);
      await page.locator('[data-path="inputs.hero.overlay"]').evaluate((select, value) => {
        select.value = value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
      }, overlay);
      await preview.waitForSelector(`${first}[data-kn-surface="picture-${overlay}"]`);
      for (const place of PLACES) for (const height of HEIGHTS) {
        await pickHero(page, 'place', place);
        await pickHero(page, 'height', height);
        await shownAs(preview, first, { picture: 'behind', place, height });
        await preview.locator(first).evaluate((node, value) => node.style.setProperty('--kn-picture-image', `linear-gradient(rgb(${value} ${value} ${value}), rgb(${value} ${value} ${value}))`), flat);
        const strengths = await strengthOf(reader, await preview.locator(first).screenshot(), flat, colour);
        const name = `${overlay} ${place} ${height}`;
        assert.ok(Math.max(...strengths) <= opacity + 0.005, `${name}: ${Math.max(...strengths)} passes ${opacity}`);
        assert.ok(Math.abs(strengths[0] - opacity) <= 0.005, `${name}: the header's words stand on its whole strength, not ${strengths[0]}`);
        // Text at the bottom of a tall hero leaves the picture clear between the header and the fade.
        if (place === 'bottom' && height === 'full') assert.ok(Math.min(...strengths) <= 0.005, `${name}: and it clears, to ${Math.min(...strengths)}`);
      }
    }
  } finally {
    await reader.close();
    await page.close();
  }
});

test('under a transparent header the words keep the overlay\'s strength, and text at the top clears the header', { timeout: 240000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(tool.url);
    await page.locator('.chapter', { hasText: 'Frame' }).click();
    await page.locator('[data-path="inputs.header.start"]').selectOption('under');
    const preview = await (await page.$('#preview')).contentFrame();
    await preview.waitForSelector('.kn-page[data-kn-header-start="under"] > .kn-page-main > .kn-hero:first-child');
    // The hero's controls are on another page, and a choice there reaches this sample all the same.
    const choose = async (name, value) => {
      await page.evaluate(([key, wanted]) => document.querySelector(`[data-pick="inputs.hero.${key}"][data-value="${wanted}"]`).click(), [name, value]);
    };
    const look = () => preview.evaluate(() => {
      const node = document.querySelector('.kn-page-main > .kn-hero');
      const content = node.querySelector('.kn-hero-content');
      const before = getComputedStyle(content, '::before');
      const media = node.querySelector('.kn-hero-media');
      return {
        headerBottom: document.querySelector('.kn-header').getBoundingClientRect().bottom,
        heroTop: node.getBoundingClientRect().top,
        heroBottom: node.getBoundingClientRect().bottom,
        textTop: node.querySelector('.kn-hero-text').getBoundingClientRect().top,
        contentTop: content.getBoundingClientRect().top,
        pseudoTop: parseFloat(before.top),
        pseudo: before.content,
        scrim: before.backgroundColor,
        masks: before.maskImage.match(/linear-gradient/g)?.length ?? 0,
        image: getComputedStyle(node).backgroundImage,
        media: media && { top: media.getBoundingClientRect().top, bottom: media.getBoundingClientRect().bottom },
        mediaOver: media && getComputedStyle(media, '::after').backgroundImage,
      };
    });
    const showing = (place) => preview.waitForFunction((wanted) => (document.querySelector('.kn-page-main > .kn-hero').dataset.knPlace ?? 'center') === wanted, place);

    await choose('height', 'two-thirds');
    await choose('picture', 'behind');
    await choose('place', 'top');
    await showing('top');
    const top = await look();
    assert.ok(top.textTop >= top.headerBottom + 10, 'text at the top clears the header');
    assert.ok(top.contentTop + top.pseudoTop <= top.heroTop + 1, 'full strength right behind the header\'s words');
    assert.doesNotMatch(top.image, /linear-gradient/, 'and no second overlay above it, which would pass the tested strength');
    assert.match(top.scrim, /0\.57\)/);

    await choose('place', 'bottom');
    await showing('bottom');
    const bottom = await look();
    assert.doesNotMatch(bottom.image, /linear-gradient/, 'at the bottom the overlay is one layer, not a second one over the first');
    assert.equal(bottom.masks, 2, 'with the header keeping its strength by a mask of its own beside the fade');
    assert.match(bottom.scrim, /0\.57\)/);

    await choose('place', 'center');
    await showing('center');
    const centred = await look();
    assert.match(centred.image, /linear-gradient/, 'in the middle the even overlay lies under the header too');
    assert.equal(centred.pseudo, 'none');

    for (const [picture, place] of [['end-bleed', 'top'], ['start-bleed', 'bottom']]) {
      await choose('picture', picture);
      await choose('place', place);
      await preview.waitForSelector(`.kn-page-main > .kn-hero[data-kn-picture="${picture}"]`);
      await showing(place);
      const bleed = await look();
      assert.ok(bleed.textTop >= bleed.headerBottom + 10, `${picture}: the text clears the header`);
      assert.ok(bleed.media.top <= bleed.heroTop + 1, `${picture}: the picture runs under the header to the hero's top`);
      assert.ok(bleed.media.bottom >= bleed.heroBottom - 1, `${picture}: and to its bottom`);
      assert.match(bleed.mediaOver, /linear-gradient/, `${picture}: and the header's words get the hero's colour to stand on`);
    }

    await choose('picture', 'end');
    await choose('place', 'top');
    await preview.waitForSelector('.kn-page-main > .kn-hero[data-kn-picture="end"]');
    await showing('top');
    const inset = await look();
    assert.ok(inset.media.top >= inset.headerBottom + 10, 'a picture inside the content width stays below the header');
    assert.equal(inset.mediaOver, 'none');
  } finally {
    await page.close();
  }
});
