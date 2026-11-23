// A design sets its logo's height (issue #24): `inputs.header.logo-height`, in pixels at the default setting as the
// design file's inputs speak, written to the CSS in rem. The width follows, keeping the logo's shape. The bar, the
// footer's brand, the last-resort scale and the 14rem cap follow it as they followed the old constant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { derive, defaultInputs, validateInputs } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { footerBrand } from '../src/components/brand.js';
import { designMd } from '../src/design-md/index.js';
import { render } from './helpers/render.js';

const inputs = (header) => ({ 'brand-colors': { primary: '#168b83' }, header });
const token = (css) => css.match(/--kn-header-logo-height: ([^;]+);/)?.[1];

test('a design without the key keeps the logo 2.25rem tall, and one with it writes its height in rem', () => {
  assert.equal(defaultInputs().header['logo-height'], 36);
  assert.equal(derive({ 'brand-colors': { primary: '#168b83' } }).header['logo-height'], 36);
  assert.equal(token(coreCss(derive({ 'brand-colors': { primary: '#168b83' } }))), '2.25rem');
  assert.equal(token(coreCss(derive(inputs({ 'logo-height': 48 })))), '3rem');
  assert.equal(token(coreCss(derive(inputs({ 'logo-height': 28 })))), '1.75rem');
  // A file resolved before the key existed still renders as before.
  const old = derive({ 'brand-colors': { primary: '#168b83' } });
  delete old.header['logo-height'];
  assert.equal(token(coreCss(old)), '2.25rem');
});

test('validation takes a logo height from 24 to 64 pixels, and nothing else', () => {
  for (const height of [24, 36, 50, 64]) assert.doesNotThrow(() => validateInputs(inputs({ 'logo-height': height })));
  for (const height of [20, 65, '3rem', null]) assert.throws(() => validateInputs(inputs({ 'logo-height': height })), /logo-height/);
});

test('the export for AI gives the logo\'s height in rem, where the brand has a logo', () => {
  const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>')}`;
  const words = (header, project = { name: 'Name', logo: svg }) => designMd({ inputs: withDefaults(inputs(header)), project, resolved: derive(inputs(header)) }, 'name.design.json');
  assert.ok(words({}).includes('A logo is 2.25rem tall'));
  assert.match(words({}), /\*\*Brand:\*\* the logo, 2\.25rem tall, in the header/);
  assert.ok(words({ 'logo-height': 48 }).includes('A logo is 3rem tall'));
  assert.match(words({ 'logo-height': 48, identity: 'both' }), /\*\*Brand:\*\* the logo and the name, side by side, the logo 3rem tall, in the header/);
  assert.match(words({ 'logo-height': 48 }, { name: 'Name' }), /\*\*Brand:\*\* the name, since the design has no logo, in the header/);
});

const ENGINES = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const ORIGIN = 'http://kn.test';
// A logo of the given shape, width to height, in a colour for each mode.
const logo = (ratio, fill) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${36 * ratio} 36" width="${36 * ratio}" height="36"><rect width="${36 * ratio}" height="36" rx="8" fill="${fill}"/></svg>`)}`;
const logos = (ratio) => ({ light: logo(ratio, '#222222'), dark: logo(ratio, '#ffffff') });
const menu = ['Products', 'Services', 'Markets', 'Knowledge'].map((label, i) => ({ label, href: `#m${i}`, linkMenu: i < 3, children: [{ label: `${label} one`, href: `#m${i}a` }] }));

// A page with the full header and a footer whose A1 holds the brand, as a site gives it, for a design's logo height.
async function page(height, { ratio = 1, name } = {}) {
  const css = coreCss(derive(inputs(height === undefined ? {} : { 'logo-height': height }))) + await componentsCss();
  const identity = { label: 'Example', href: '#home', logo: logos(ratio), ...(name ? { name } : {}) };
  const header = await render('Header', { identity, menu, linkMenu: true, menuButton: { word: 'Menu' }, languages: [{ label: 'English', code: 'en', href: '#en', current: true }, { label: 'Svenska', code: 'sv', href: '#sv' }], search: { action: '#search' }, cta: { label: 'Get in touch', href: '#contact' } });
  const brand = footerBrand({ identity: name ? 'both' : 'logo', name: name ?? 'Example', logo: logos(ratio), surface: 'page' });
  const footer = await render('Footer', { upper: { surface: 'page', cells: { a1: { content: brand } } }, lower: { surface: 'inverse', cells: { a1: { text: 'Street 1' } } } });
  const body = await render('Page', {}, { header, default: '<h2>A band</h2><p>Some words.</p>', footer });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Logo</title><style>${css}</style></head><body>${body}</body></html>`;
}

async function open(type, files) {
  const browser = await type.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 700 } });
  await context.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/_astro/')) return route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL(`../src/components/${path.slice(8)}`, import.meta.url), 'utf8') });
    return files[path] ? route.fulfill({ contentType: 'text/html', body: files[path] }) : route.fulfill({ status: 404 });
  });
  return { browser, tab: await context.newPage() };
}

// What the eye measures: the logo shown in the header and in the footer, the bar, and the height the page reads.
const measure = (tab) => tab.evaluate(() => {
  const shown = (scope) => [...document.querySelectorAll(`${scope} .kn-brand-logo img`)].find((image) => image.getClientRects().length).getBoundingClientRect();
  const header = shown('.kn-header .kn-header-row');
  const footer = shown('.kn-footer');
  return {
    header: { width: header.width, height: header.height },
    footer: { width: footer.width, height: footer.height },
    bar: document.querySelector('.kn-header-bar').getBoundingClientRect().height,
    // Registered as a length, so the browser gives it in pixels.
    published: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kn-header-height')),
    step: document.querySelector('.kn-header').dataset.knStep,
  };
});
// The header has its step and its logos have loaded, and the script has fitted the bar to them: a logo image has no
// width until it has loaded, and the script measures again once the browser says the bar has changed, which WebKit
// says a little later, and later still on a busy machine (header.md, Before the first paint). So it waits until the
// step and the groups' widths hold still over two frames 100ms apart.
const ready = async (tab) => {
  await tab.waitForFunction(() => document.querySelector('.kn-header').dataset.knStep && [...document.images].every((image) => image.complete && image.naturalWidth));
  let last;
  for (let tries = 0; tries < 30; tries++) {
    const now = await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(`${document.querySelector('.kn-header').dataset.knStep} ${[...document.querySelectorAll('.kn-header-row > .kn-header-group')].map((group) => group.getBoundingClientRect().width).join(' ')}`)))));
    if (now === last) return;
    last = now;
    await tab.waitForTimeout(100);
  }
  throw new Error(`the header never held still: ${last}`);
};
const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 0.1, `${what}: ${actual}, not ${expected}`);

test('the logo in the header and the footer takes the design\'s height, and the bar follows it, in every engine', { timeout: 240000 }, async () => {
  // The bar: the taller of 4rem and the logo with 0.75rem above and below, and its 1 px hairline.
  const cases = [[undefined, 36, 65], [24, 24, 65], [48, 48, 73], [64, 64, 89]];
  const files = Object.fromEntries(await Promise.all(cases.map(async ([height]) => [`/${height ?? 'none'}.html`, await page(height)])));
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      for (const [height, logoHeight, bar] of cases) {
        const what = `${name}, logo-height ${height ?? 'unset'}`;
        await tab.goto(`${ORIGIN}/${height ?? 'none'}.html`);
        await ready(tab);
        const seen = await measure(tab);
        near(seen.header.height, logoHeight, `${what}: the header's logo`);
        near(seen.header.width, logoHeight, `${what}: a square logo keeps its shape`);
        near(seen.footer.height, logoHeight, `${what}: the footer's logo`);
        near(seen.bar, bar, `${what}: the bar`);
        near(seen.published, bar, `${what}: the height the page reads`);
      }
    } finally { await browser.close(); }
  }
});

test('the last resort scales a taller logo to 0.8, and a wide one stops at 14rem, keeping its shape, in every engine', { timeout: 240000 }, async () => {
  const files = { '/scaled.html': await page(48, { ratio: 5 }), '/wide.html': await page(64, { ratio: 5 }) };
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      // The 14rem cap leaves a logo room beside the menu button at 20rem, so the last resort comes only below it.
      await tab.setViewportSize({ width: 280, height: 600 });
      await tab.goto(`${ORIGIN}/scaled.html`);
      await ready(tab);
      const scaled = await measure(tab);
      assert.equal(scaled.step, 'scale', `${name}: a wide logo in a window under 20rem takes the last resort`);
      // The box is 0.8 of 3rem; the logo may shrink within it, so its painted shape is not measured here.
      near(scaled.header.height, 38.4, `${name}: the scaled logo`);
      near(scaled.footer.height, 48, `${name}: the footer's logo does not scale`);
      await tab.setViewportSize({ width: 1280, height: 700 });
      await tab.goto(`${ORIGIN}/wide.html`);
      await ready(tab);
      const wide = await measure(tab);
      // 5:1 at 4rem would be 20rem wide: it stands 14rem wide, its box 4rem tall, and the image is fitted inside it.
      near(wide.header.width, 224, `${name}: the header's wide logo`);
      near(wide.footer.width, 224, `${name}: the footer's wide logo`);
      near(wide.header.height, 64, `${name}: the wide logo's box`);
    } finally { await browser.close(); }
  }
});

test('a logo of about 2.3:1 at 3rem leaves the menu button in the bar at 20rem and needs no scaling from 24.375rem, in light and dark mode, in every engine', { timeout: 240000 }, async () => {
  const files = { '/logo.html': await page(48, { ratio: 2.3 }) };
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      for (const mode of ['light', 'dark']) {
        for (const width of [320, 390, 768, 1280]) {
          const what = `${name}, ${mode}, ${width}`;
          await tab.setViewportSize({ width, height: 700 });
          await tab.goto(`${ORIGIN}/logo.html`);
          await tab.evaluate((mode) => { document.documentElement.dataset.knMode = mode; }, mode);
          await ready(tab);
          const seen = await measure(tab);
          const { button, over, shownMode } = await tab.evaluate(() => {
            const row = document.querySelector('.kn-header-row');
            const inner = document.querySelector('.kn-header-inner').getBoundingClientRect();
            const box = row.querySelector('.kn-header-menu-button').getBoundingClientRect();
            const groups = [...row.querySelectorAll(':scope > .kn-header-group')].map((group) => group.getBoundingClientRect());
            const shown = [...row.querySelectorAll('.kn-brand-logo img')].find((image) => image.getClientRects().length);
            return { button: box.width > 0 && box.left >= inner.left && box.right <= inner.right + 0.01, over: Math.max(...groups.map((group) => group.right)) - inner.right, shownMode: shown.dataset.knLogo };
          });
          assert.equal(shownMode, mode, `${what}: the logo for the mode shows`);
          assert.ok(button, `${what}: the menu button stands in the bar`);
          assert.ok(over <= 0.01, `${what}: the bar overflows by ${over}`);
          if (width >= 390) {
            assert.notEqual(seen.step, 'scale', `${what}: no scaling`);
            near(seen.header.height, 48, `${what}: the logo`);
            near(seen.header.width, 48 * 2.3, `${what}: the logo keeps its shape`);
          }
        }
      }
    } finally { await browser.close(); }
  }
});
