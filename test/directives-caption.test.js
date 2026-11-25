// A section's photo with its caption (issue #35; docs/spec/directives.md, `section`): the renderer's HTML for each case
// of rule 1, laid out without script by the real stylesheet in every installed engine, wide and narrow, in both modes and
// on every Surface. The caption stands under the picture, the component gap below it, small and `text-muted`, and stays
// with the picture where it grows to the text's height, is cropped, and stays in view beside long text.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { renderMarkdown } from './helpers/konzilo-body.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const svg = (w, h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="gray"/></svg>`)}`;
const PICTURES = { '/pictures/landscape.svg': svg(1200, 800), '/pictures/portrait.svg': svg(600, 800), '/pictures/badge.svg': svg(200, 200) };
const SURFACES = ['page', 'raised', 'tint', 'brand', 'inverse', 'accent'];

const words = 'Each bed is built from untreated larch, lined against the damp and filled with three layers of soil.';
const paragraphs = (count) => Array.from({ length: count }, () => words).join('\n\n');
const photo = (src = '/pictures/landscape.svg') => `![A shed with tools](${src})\\\nThe shed in May, before the beds were sown.`;
const section = (anchor, { surface, picture = photo(), badge = false, text = 1, form = false } = {}) => [
  `:::section{anchor="${anchor}"${surface ? ` surface="${surface}"` : ''}}`,
  picture,
  badge ? '![Award one](/pictures/badge.svg)' : '',
  `## The ${anchor} section`,
  paragraphs(text),
  form ? '::form{name="guide"}' : '',
  ':::',
].filter(Boolean).join('\n\n');
const MARKDOWN = [
  section('short'),
  section('cropped', { text: 5 }),
  section('long', { text: 40 }),
  section('badges', { badge: true }),
  section('offer', { picture: photo('/pictures/portrait.svg'), form: true }),
  section('bare', { picture: '![A shed with tools](/pictures/landscape.svg)', text: 5 }),
  ...SURFACES.map((surface) => section(`on-${surface}`, { surface })),
].join('\n\n');

const browsers = [];
let styles, html;
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}${await readFile(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8')}`;
  html = renderMarkdown(MARKDOWN);
  for (const [address, src] of Object.entries(PICTURES)) html = html.replaceAll(address, src);
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// No script runs: the stylesheet alone lays every section out (principles.md).
async function open(browser, { width = 1440, height = 900, mode = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en" data-kn-mode="${mode}"><head><style>${styles}</style></head><body data-kn-surface="page"><main>${html}</main></body></html>`);
  tab.on('close', () => context.close().catch(() => {}));
  return tab;
}

// Where each part of a section stands, and how its caption looks against the band.
const measure = (tab, id) => tab.evaluate((id) => {
  const section = document.getElementById(id);
  const find = (selector) => section.querySelector(selector);
  const box = (element) => (element ? element.getBoundingClientRect().toJSON() : null);
  const content = find('.kn-band-content');
  const probe = (set) => {
    const element = content.appendChild(document.createElement('p'));
    set(element);
    const style = getComputedStyle(element);
    const found = { width: element.getBoundingClientRect().width, colour: style.color, size: style.fontSize };
    element.remove();
    return found;
  };
  const ground = (element) => {
    for (let at = element; at; at = at.parentElement) {
      const colour = getComputedStyle(at).backgroundColor;
      if (colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent') return colour;
    }
    return 'rgb(255, 255, 255)';
  };
  const picture = find('.kn-section-picture'), caption = find('.kn-section-caption');
  const style = caption && getComputedStyle(caption);
  return {
    section: box(section), media: box(find('.kn-section-media')), figure: box(find('.kn-section-figure')), picture: box(picture),
    caption: box(caption), head: box(find('.kn-section-head')), body: box(find('.kn-section-body')), badges: box(find('.kn-section-badges')),
    // The top of the caption's words: its box less its padding and border, so a margin and a padding read alike.
    words: caption ? caption.getBoundingClientRect().top + parseFloat(style.paddingBlockStart) + parseFloat(style.borderBlockStartWidth) : null,
    colour: style?.color, size: style?.fontSize, ground: ground(section),
    muted: probe((element) => { element.style.color = 'var(--kn-text-muted)'; }).colour,
    small: probe((element) => { element.dataset.knType = 'small'; }).size,
    gap: probe((element) => { element.style.inlineSize = 'var(--kn-space-component-gap)'; }).width,
    natural: picture.naturalHeight / picture.naturalWidth,
    fit: getComputedStyle(picture).objectFit,
    window: innerHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, id);
const scrollTo = (tab, id, at) => tab.evaluate(([id, at]) => {
  const box = document.getElementById(id).getBoundingClientRect();
  window.scrollTo(0, window.scrollY + box.top + at * box.height);
}, [id, at]);

const luminance = (colour) => {
  const [r, g, b] = colour.match(/[\d.]+/g).slice(0, 3).map((value) => {
    const v = Number(value) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (one, other) => {
  const [a, b] = [luminance(one), luminance(other)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};
const near = (one, other, what, within = 1.5) => assert.ok(Math.abs(one - other) <= within, `${what}: ${one} and ${other}`);

// What holds for every captioned photo: under its picture, the component gap below it, at its start edge, in the media,
// small and muted, readable on the band.
function underItsPicture(found, what) {
  assert.ok(found.figure && found.caption, `${what}: a figure with its caption`);
  near(found.words - found.picture.bottom, found.gap, `${what}: the caption's words stand the component gap under the picture`);
  assert.ok(found.caption.top >= found.picture.bottom - 0.5, `${what}: the caption stands under the picture`);
  assert.ok(found.caption.bottom <= found.media.bottom + 0.5, `${what}: the caption stands in the media`);
  assert.ok(found.caption.left >= found.media.left - 0.5 && found.caption.right <= found.media.right + 0.5, `${what}: in the media's column`);
  assert.equal(found.colour, found.muted, `${what}: the caption is text-muted`);
  assert.equal(found.size, found.small, `${what}: the caption is small`);
  assert.ok(contrast(found.colour, found.ground) >= 4.5, `${what}: the caption reads on ${found.ground} (${contrast(found.colour, found.ground).toFixed(2)}:1)`);
  assert.equal(found.overflow, 0, `${what}: nothing scrolls sideways`);
}

test('wide, a caption stands under the picture in the media column, beside the head and body', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) for (const mode of ['light', 'dark']) {
    const tab = await open(browser, { mode });
    for (const id of ['short', 'cropped', 'badges', 'offer']) {
      const found = await measure(tab, id), what = `${name}, ${mode}, #${id}`;
      underItsPicture(found, what);
      assert.ok(found.caption.right <= Math.min(found.head.left, found.body.left), `${what}: beside the head and the body`);
      if (id !== 'offer') near(found.caption.left, found.picture.left, `${what}: at the picture's start edge`);
    }
    // Beside short text the picture keeps its own proportions, and the head and body stand in the middle of picture and caption.
    const short = await measure(tab, 'short');
    near(short.picture.height, short.picture.width * short.natural, `${name}, ${mode}: the short section's picture keeps its proportions`);
    near((short.head.top + short.body.bottom) / 2, (short.figure.top + short.figure.bottom) / 2, `${name}, ${mode}: the text stands in the middle of the photo and its caption`);
    // With badges, the caption stays with its picture and the badges follow it.
    const badges = await measure(tab, 'badges');
    near(badges.badges.top - badges.caption.bottom, badges.gap, `${name}, ${mode}: the badges stand the component gap under the caption`);
    near(badges.picture.height, badges.picture.width * badges.natural, `${name}, ${mode}: a picture with badges keeps its proportions`);
    // The picture a form offers is shown whole, and its caption under it the same way.
    const offer = await measure(tab, 'offer');
    near(offer.picture.height, offer.picture.width * offer.natural, `${name}, ${mode}: the offer is shown whole`);
    assert.ok(offer.caption.left >= offer.picture.left - 0.5 && offer.caption.right <= offer.picture.right + 0.5, `${name}, ${mode}: the offer's caption is no wider than its picture`);
    await tab.close();
  }
});

test('wide, where the text is taller, the picture grows to its height less the caption and is cropped, as a photo without a caption grows to it whole', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    const found = await measure(tab, 'cropped'), what = `${name}, #cropped`;
    underItsPicture(found, what);
    assert.ok(found.picture.height > found.picture.width * found.natural + 2, `${what}: the picture grew past its proportions (${found.picture.height} for ${found.picture.width})`);
    assert.equal(found.fit, 'cover', `${what}: and is cropped to fill`);
    near(found.figure.top, found.head.top, `${what}: the photo starts with the text`);
    near(found.caption.bottom, found.body.bottom, `${what}: and its caption ends with it`);
    assert.ok(found.figure.height <= found.figure.width + 0.5, `${what}: the picture with its caption is a square at the most`);
    const bare = await measure(tab, 'bare');
    assert.equal(bare.figure, null, `${name}: a photo without a caption has no figure`);
    near(bare.picture.bottom, bare.body.bottom, `${name}: a photo without a caption grows to the text's height, as before`);
    await tab.close();
  }
});

test('wide, beside long text the picture and its caption stay in view together, and end with the text', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) for (const height of [900, 560]) {
    const tab = await open(browser, { height });
    const what = `${name} at 1440 by ${height}, #long`;
    let found = await measure(tab, 'long');
    underItsPicture(found, what);
    near(found.figure.top, found.media.top, `${what}: the photo starts at the top of its column`);
    assert.ok(found.figure.height <= 0.85 * found.window + 0.5, `${what}: the picture with its caption is no taller than 85svh (${found.figure.height})`);
    assert.ok(found.figure.height <= found.figure.width + 0.5, `${what}: and a square at the most`);
    await scrollTo(tab, 'long', 0.5);
    found = await measure(tab, 'long');
    near(found.figure.top, found.gap, `${what}: halfway down the text the photo stays at the top of the window`);
    assert.ok(found.caption.bottom <= found.window + 0.5, `${what}: with its caption in view (${found.caption.bottom} in ${found.window})`);
    near(found.words - found.picture.bottom, found.gap, `${what}: and still under the picture`);
    await scrollTo(tab, 'long', 0.98);
    found = await measure(tab, 'long');
    near(found.caption.bottom, found.media.bottom, `${what}: at the text's end the caption ends with the media`);
    await tab.close();
  }
});

test('narrow, a caption stands under the picture and above the head', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) for (const mode of ['light', 'dark']) for (const width of [390, 700]) {
    const tab = await open(browser, { width, mode });
    for (const id of ['short', 'cropped', 'long', 'badges', 'offer']) {
      const found = await measure(tab, id), what = `${name}, ${mode}, ${width}, #${id}`;
      underItsPicture(found, what);
      assert.ok(found.media.bottom <= found.head.top + 0.5 && found.caption.bottom <= found.head.top, `${what}: above the head`);
      if (id === 'offer') assert.ok(found.caption.left >= found.picture.left - 0.5 && found.caption.right <= found.picture.right + 0.5, `${what}: no wider than the offer`);
      else {
        near(found.picture.width, found.media.width, `${what}: the picture fills the column`);
        near(found.picture.height, found.picture.width * found.natural, `${what}: at its own proportions`);
        near(found.caption.left, found.picture.left, `${what}: at the picture's start edge`);
      }
    }
    await tab.close();
  }
});

test('on every Surface, in both modes, a caption is the band\'s text-muted and reads on it', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) for (const mode of ['light', 'dark']) for (const width of [390, 1440]) {
    const tab = await open(browser, { width, mode });
    for (const surface of SURFACES) underItsPicture(await measure(tab, `on-${surface}`), `${name}, ${mode}, ${width}, on ${surface}`);
    await tab.close();
  }
});
