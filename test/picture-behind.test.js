// A picture behind a band's text (directives.md, Rules for every directive; konzilo.md, A band's picture; issue #40):
// an <img> after the band's content, with the srcset and sizes it is given, so a browser loads a version near the band's
// width, where a CSS background loaded the widest. Its address is written as given, as every other picture's is, and
// it keeps the alt text it came with.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright-core';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { htmlToHast } from 'satteri';
import { render } from './helpers/render.js';
import { decodePng } from './helpers/ink.js';
import { serve } from './helpers/serve.js';
import { testDesign } from './helpers/konzilo-body.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { pageContext } from '../src/directives/render/context.js';
import { renderDirective } from '../src/directives/render/render.js';
import { articleOpening } from '../src/page-parts/parts.js';
import { pictureSizes } from '../src/konzilo/images.js';

// The band's own children, in order, by their tags and classes.
const childrenOf = (section) => section.children.filter((node) => node.type === 1).map((node) => `${node.name}.${node.attributes.class}`);
const sectionOf = (html) => one(parse(html), 'section');
const pictureOf = (section) => section.children.find((node) => node.type === 1 && node.name === 'img');

test('a band on a picture Surface draws its picture as an <img> after its content, its address as given and alt text empty unless given', async () => {
  for (const address of ['/media/beds.webp', 'media/beds.webp', '../media/beds.webp', 'https://example.com/beds.webp']) {
    const band = sectionOf(await render('Band', { surface: 'picture-dark', picture: address }, { default: '<p>Words.</p>' }));
    assert.equal(band.attributes.style, undefined, `${address}: no style`);
    assert.deepEqual(childrenOf(band), ['div.kn-band-content', 'img.kn-band-picture'], address);
    const image = pictureOf(band).attributes;
    assert.equal(image.src, address);
    assert.equal(image.alt, '', `${address}: decorative unless the template says what it shows`);
    assert.equal(image.loading, 'eager');
  }
  const given = pictureOf(sectionOf(await render('Band', { surface: 'picture-light', picture: '/beds-2520.webp', alt: 'Raised beds', srcset: '/beds-509.webp 509w, /beds-1018.webp 1018w', sizes: '100vw' }))).attributes;
  assert.deepEqual([given.src, given.srcset, given.sizes, given.alt], ['/beds-2520.webp', '/beds-509.webp 509w, /beds-1018.webp 1018w', '100vw', 'Raised beds']);
  // Given the picture's width and height, as getImage() gives them, and no sizes, a band as tall as its text says the
  // window's width, which is all a sizes can know of it.
  const measured = pictureOf(sectionOf(await render('Band', { surface: 'picture-dark', picture: '/beds-2520.webp', srcset: '/beds-509.webp 509w', pictureWidth: 2520, pictureHeight: 1680 }))).attributes;
  assert.deepEqual([measured.sizes, measured.width, measured.height], ['100vw', '2520', '1680']);
  // A site's own style stays the band's.
  assert.equal(sectionOf(await render('Band', { surface: 'picture-dark', picture: '/a.webp', style: 'outline: 0' })).attributes.style, 'outline: 0');
  // Only a picture Surface shows a picture behind, as only it has the scrim the text is checked on.
  assert.equal(all(sectionOf(await render('Band', { surface: 'brand', picture: '/a.webp' })), 'img').length, 0);
  assert.equal(all(sectionOf(await render('Band', {})), 'img').length, 0);
});

test('a Hero with its picture behind gives the band its picture, its alt text, srcset and sizes', async () => {
  const hero = (props) => render('Hero', { heading: 'A heading', surface: 'picture-dark', picture: '/beds.webp', ...props });
  const plain = sectionOf(await hero({}));
  assert.equal(plain.attributes.style, undefined);
  assert.deepEqual(childrenOf(plain), ['div.kn-band-content kn-hero-content', 'img.kn-band-picture']);
  assert.equal(pictureOf(plain).attributes.alt, '');
  const given = pictureOf(sectionOf(await hero({ alt: 'Raised beds', srcset: '/beds-509.webp 509w', sizes: '100vw' }))).attributes;
  assert.deepEqual([given.src, given.srcset, given.sizes, given.alt, given.loading], ['/beds.webp', '/beds-509.webp 509w', '100vw', 'Raised beds', 'eager']);
  // With no sizes, the Hero works it out from its height and the picture's proportions: it covers a band at least half
  // the window's height, so a picture of 3:2 is drawn as wide as 75% of the window's height where that is wider; one of
  // unknown proportions is taken as 16:9; with no height the band is as tall as its text.
  const sized = async (props) => pictureOf(sectionOf(await hero({ srcset: '/beds-509.webp 509w', ...props }))).attributes.sizes;
  assert.equal(await sized({ height: 'half', pictureWidth: 2400, pictureHeight: 1600 }), 'max(100vw, 75vh)');
  assert.equal(await sized({ height: 'full' }), 'max(100vw, 177.7778vh)');
  assert.equal(await sized({ pictureWidth: 2400, pictureHeight: 1600 }), '100vw');
  assert.equal(await sized({ height: 'half', sizes: '50vw' }), '50vw', 'a sizes given is written as it is');
});

test('the hero directive draws its picture behind as an <img> with the core\'s srcset, the band\'s sizes and the picture\'s own alt text', () => {
  // The tree a site's reader hands the component, the picture as the core writes it, with the body's sizes.
  const opening = (src, picture, mark = '') => {
    const tree = htmlToHast(`<p>Start small.</p><figure${mark}><img src="${src}" srcset="/_astro/beds_360.webp 360w, /_astro/beds_509.webp 509w, /_astro/beds_2520.webp 2520w" sizes="(min-width: 48.6363rem) 45rem, calc(94.2858vw - 0.8572rem)" alt="Raised beds" width="2520" height="1680" loading="lazy" decoding="async"></figure>`, { fragment: true });
    return renderDirective('hero', {}, tree, pageContext({ design: testDesign({ hero: { picture } }), title: 'Planning a garden', warn: () => {} }));
  };
  const band = sectionOf(opening('/_astro/beds.webp', 'behind', ' data-konzilo-block="2"'));
  assert.equal(band.attributes.style, undefined);
  assert.deepEqual(childrenOf(band), ['div.kn-band-content kn-hero-content', 'img.kn-band-picture']);
  const image = pictureOf(band).attributes;
  assert.equal(image.src, '/_astro/beds.webp');
  assert.equal(image.srcset, '/_astro/beds_360.webp 360w, /_astro/beds_509.webp 509w, /_astro/beds_2520.webp 2520w');
  // The band is as wide as the window, and at least half its height, the design's, so a picture of 3:2 is drawn as wide
  // as 75% of the window's height where that is wider.
  assert.equal(image.sizes, 'max(100vw, 75vh)');
  assert.equal(image.sizes, pictureSizes(testDesign({ hero: { picture: 'behind' } }).resolved, 'band', { height: 'half', ratio: 1.5 }));
  assert.equal(image.alt, 'Raised beds', 'the alt text the picture came with');
  assert.equal(image.loading, 'eager');
  assert.deepEqual([image.width, image.height, image.decoding], ['2520', '1680', 'async']);
  assert.equal(image['data-konzilo-block'], '2', 'the block\'s mark stays on its picture');
  // A relative address is written as given, as beside the text.
  assert.equal(pictureOf(sectionOf(opening('media/beds.webp', 'behind'))).attributes.src, 'media/beds.webp');
  assert.match(opening('media/beds.webp', 'end'), /<div class="kn-hero-media"><img src="media\/beds\.webp"/);
});

test('an article\'s opening draws its main image behind as an <img> with the srcset and sizes it is given', () => {
  const picture = { src: '/_astro/soil.webp', srcset: '/_astro/soil_800.webp 800w, /_astro/soil_1200.webp 1200w', sizes: '100vw', width: 1600, height: 1067, alt: 'A spade in soil', loading: 'lazy', decoding: 'async' };
  const opening = (design, given = picture) => articleOpening(pageContext({ design: testDesign({ hero: design }), title: 'Know your soil', warn: () => {} }), { picture: given });
  const band = sectionOf(opening({ picture: 'behind' }));
  assert.equal(band.attributes.style, undefined);
  assert.deepEqual(childrenOf(band), ['div.kn-band-content kn-hero-content', 'img.kn-band-picture']);
  const image = pictureOf(band).attributes;
  assert.deepEqual([image.src, image.srcset, image.sizes, image.alt, image.loading], [picture.src, picture.srcset, '100vw', 'A spade in soil', 'eager']);
  assert.equal(pictureOf(sectionOf(opening({ picture: 'behind' }, { src: 'media/soil.webp', alt: '' }))).attributes.src, 'media/soil.webp');
});

// ---------- In the browser ----------

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
// A phone and a wide screen.
const WINDOWS = [[390, 844], [1440, 900]];
const HEIGHTS = ['third', 'half', 'two-thirds', 'full'];
// In the middle the even scrim covers the picture; at the top and the bottom the overlay fades.
const PLACES = ['center', 'top', 'bottom'];
const MODES = ['light', 'dark'];
// The presentation's own photo, 1920 × 1281, so a phone's band crops its sides and a wide one its top and bottom.
const PICTURE = '/hero.webp';
// The hero directive's and an article opening's, at the default design's height and one more, in the middle and at the
// bottom, in light mode: the same band, drawn by the renderers in place of Hero.
const DRAWN_BY = ['directive', 'opening'];
const DRAWN_HEIGHTS = ['half', 'full'];
const DRAWN_PLACES = ['center', 'bottom'];

let server;
const browsers = [];
before(async () => {
  const styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  const pages = new Map();
  const next = await render('Band', {}, { default: '<h2>What follows</h2><p>Some words.</p>' });
  const document = (page, mode) => `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><title>Hero</title><style>${styles}</style></head><body>${page}</body></html>`;
  for (const height of HEIGHTS) for (const place of PLACES) {
    const hero = await render('Hero', { heading: 'Make the next step clear', eyebrow: 'A clear direction', deck: 'Practical support, useful information and a straightforward way to get started.', surface: 'picture-dark', picture: PICTURE, alt: 'A garden', height, place }, { default: '<p>A note under the deck.</p>' });
    const page = await render('Page', {}, { default: `${hero}${next}` });
    for (const mode of MODES) pages.set(`/${height}-${place}-${mode}.html`, document(page, mode));
  }
  // The hero directive from a body's tree, its picture as the core writes it, and an article's opening of its main image,
  // each with the sizes it writes, as wide as the band draws the picture: with the band's width alone, WebKit draws a
  // picture taller in its proportions than its band from a version it has scaled down to the band's width, and soft.
  const image = `<img src="${PICTURE}" srcset="${PICTURE} 1920w" sizes="100vw" alt="A garden" width="1920" height="1281">`;
  for (const height of DRAWN_HEIGHTS) for (const place of DRAWN_PLACES) {
    const ctx = pageContext({ design: testDesign({ hero: { picture: 'behind', height, place } }), title: 'Make the next step clear', warn: () => {} });
    const directive = renderDirective('hero', { height }, htmlToHast(`<p>Practical support, useful information and a straightforward way to get started.</p><figure>${image}</figure>`, { fragment: true }), ctx);
    const opening = articleOpening(ctx, { data: { headline: 'Make the next step clear', standfirst: 'Practical support, useful information and a straightforward way to get started.' }, picture: { src: PICTURE, srcset: `${PICTURE} 1920w`, sizes: pictureSizes(ctx.design.resolved, 'band', { height, ratio: 1920 / 1281 }), width: 1920, height: 1281, alt: 'A garden' } });
    for (const [by, hero] of [['directive', directive], ['opening', opening]]) pages.set(`/${by}-${height}-${place}-light.html`, document(await render('Page', {}, { default: `${hero}${next}` }), 'light'));
  }
  server = await serve(fileURLToPath(new URL('../presentation/pictures/', import.meta.url)), { pages });
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(async () => {
  await Promise.all(browsers.map(([, browser]) => browser.close()));
  await server?.close();
});

// How far apart two screenshots are, square by square of BLOCK pixels: the largest difference of a square's mean in a
// channel, in levels of 255. An engine samples a picture a little differently as an <img> and as a background, a few
// levels at a pixel, which a square's mean evens out, while a picture moved by a single pixel moves every edge in it.
// The three engines draw the two within about three levels of each other (measured 2026-11-26), and a missing or a
// second scrim, or text under the picture, tens of levels apart.
const BLOCK = 16;
const LIMIT = 4;
function apart(one, other) {
  assert.deepEqual([one.width, one.height], [other.width, other.height], 'the same box');
  let worst = 0;
  for (let top = 0; top + BLOCK <= one.height; top += BLOCK) for (let left = 0; left + BLOCK <= one.width; left += BLOCK) {
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0;
      for (let y = top; y < top + BLOCK; y++) for (let x = left; x < left + BLOCK; x++) {
        sum += one.pixels[(y * one.width + x) * one.channels + channel] - other.pixels[(y * other.width + x) * other.channels + channel];
      }
      worst = Math.max(worst, Math.abs(sum) / BLOCK ** 2);
    }
  }
  return worst;
}

// That a page's hero, `/<page>.html`, draws its picture behind its text as its CSS background did, in each engine at a
// phone's and a wide window: the same box, crop and place, under the scrim and the text.
async function fillsAsBackground(t, pages) {
  for (const [name, browser] of browsers) for (const [width, height] of WINDOWS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const tab = await context.newPage();
    try {
      for (const page of pages) {
        const label = `${name} ${width} × ${height}, ${page}`;
        await tab.goto(`${server.origin}/${page}.html`);
        // WebKit decodes a large picture apart from the page and draws it once it is done.
        await tab.evaluate(() => document.querySelector('.kn-band-picture').decode());
        const drawn = await tab.evaluate(() => {
          const hero = document.querySelector('.kn-hero');
          const image = hero.querySelector('.kn-band-picture');
          const box = (node) => {
            const { left, top, width, height } = node.getBoundingClientRect();
            return { left, top, width, height };
          };
          const heading = hero.querySelector('.kn-heading-group-heading').getBoundingClientRect();
          const { objectFit, objectPosition } = getComputedStyle(image);
          const met = document.elementFromPoint(heading.left + 4, heading.top + heading.height / 2);
          return {
            hero: box(hero), image: box(image), objectFit, objectPosition, onTop: Boolean(met?.closest('.kn-heading-group-heading')),
            // Covering the band, the picture runs past it across or down, whichever its proportions are narrower in.
            across: image.naturalWidth / image.naturalHeight > hero.clientWidth / hero.clientHeight,
          };
        });
        for (const side of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(drawn.image[side] - drawn.hero[side]) < 0.5, `${label}: the picture's ${side} is the band's, ${drawn.image[side]}, not ${drawn.hero[side]}`);
        assert.equal(drawn.objectFit, 'cover', label);
        assert.equal(drawn.objectPosition, '50% 50%', label);
        assert.ok(drawn.onTop, `${label}: the heading stands over the picture`);
        const now = decodePng(await tab.locator('.kn-hero').screenshot({ animations: 'disabled' }));
        // The same hero with its picture as the CSS background it was until issue #40: the Surface's even scrim over the
        // picture in the middle, the picture alone under the fade at the top and the bottom, covering the band from its
        // centre. An engine starts a background at a whole pixel and may start an <img> between two, so the background is
        // also drawn up to half a pixel either way along the picture's run past the band, by quarters.
        await tab.evaluate(() => document.querySelector('.kn-hero .kn-band-picture').remove());
        let distance = Infinity;
        for (const shift of [0, 0.25, -0.25, 0.5, -0.5]) {
          await tab.evaluate(([source, offset, across]) => {
            const hero = document.querySelector('.kn-hero');
            const even = (hero.dataset.knPlace ?? 'center') === 'center';
            hero.style.backgroundImage = `${even ? 'linear-gradient(var(--kn-scrim), var(--kn-scrim)), ' : ''}url("${source}")`;
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = across ? `calc(50% + ${offset}px) 50%` : `50% calc(50% + ${offset}px)`;
          }, [PICTURE, shift, drawn.across]);
          // Two frames, so WebKit has drawn the background at its new place.
          await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          distance = Math.min(distance, apart(now, decodePng(await tab.locator('.kn-hero').screenshot({ animations: 'disabled' }))));
          if (distance <= LIMIT) break;
        }
        t.diagnostic(`${label}: ${distance.toFixed(2)}`);
        assert.ok(distance <= LIMIT, `${label}: a square of the hero is ${distance.toFixed(2)} levels from the background's`);
      }
    } finally {
      await context.close();
    }
  }
}

test('a picture behind a hero\'s text fills the band exactly as its CSS background did, under the scrim and the text, at every height and place, in both modes', { timeout: 600000 }, async (t) => {
  await fillsAsBackground(t, HEIGHTS.flatMap((share) => PLACES.flatMap((place) => MODES.map((mode) => `${share}-${place}-${mode}`))));
});

test('the hero directive\'s and an article opening\'s picture behind the text fill the band as Hero\'s does', { timeout: 600000 }, async (t) => {
  await fillsAsBackground(t, DRAWN_BY.flatMap((by) => DRAWN_HEIGHTS.flatMap((share) => DRAWN_PLACES.map((place) => `${by}-${share}-${place}-light`))));
});

// A browser prints an <img> whether or not it prints backgrounds, which it does not by default, and the scrim is a
// background: so the band prints its colours as they are, the scrim, its Surface and its text's colour with the picture,
// and the text stays readable on it (konzilo.md, A band's picture).
test('in print a picture behind the text shows, with its scrim and the text\'s colours', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await tab.emulateMedia({ media: 'print' });
      for (const place of PLACES) {
        await tab.goto(`${server.origin}/half-${place}-light.html`);
        const printed = await tab.evaluate(() => {
          const hero = document.querySelector('.kn-hero');
          const adjust = (style) => style.printColorAdjust || style.webkitPrintColorAdjust;
          return { band: adjust(getComputedStyle(hero)), scrim: adjust(getComputedStyle(hero, '::after')), text: adjust(getComputedStyle(hero.querySelector('.kn-heading-group-heading'))), shown: hero.querySelector('.kn-band-picture').getBoundingClientRect().height > 0 };
        });
        assert.deepEqual(printed, { band: 'exact', scrim: 'exact', text: 'exact', shown: true }, `${name}, ${place}`);
      }
    } finally {
      await tab.close();
    }
  }
});
