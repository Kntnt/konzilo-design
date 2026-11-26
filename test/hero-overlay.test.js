// How strong a picture hero's overlay is, row by row, in Gecko, WebKit and Chromium: read from a screenshot of a hero
// whose picture is flat white, along a column free of text (components.md, Band compositions; issue #28).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { decodePng } from './helpers/ink.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { breadcrumbProps } from '../src/components/design-props.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const resolved = derive(defaultInputs());
const { color, opacity } = resolved.surfaces['picture-dark'].light.scrim;
const ink = parseInt(color.slice(1, 3), 16);
// The windows the owner looked at, a tall one where the reach meets its cap, and a phone.
const WINDOWS = [[1512, 900], [2560, 1300], [1440, 1600], [390, 844]];
// The fade's reach: 36 % of the window's height, at least 8rem and at most 32rem (the owner, 2026-11-25).
const reachOf = (height) => Math.min(Math.max(0.36 * height, 128), 512);

let styles;
let trail;
const browsers = [];
before(async () => {
  // The header takes its room but draws nothing, so the column shows the overlay behind it.
  styles = `${coreCss(resolved)}${await componentsCss()} .kn-header { visibility: hidden; }`;
  trail = await render('Breadcrumbs', breadcrumbProps({ separator: 'slash', current: true, narrow: 'trail' }, { name: 'Example' }, { trail: [{ label: 'Services', href: '#services' }, { label: 'A clear next step' }] }));
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// The picture is flat white, so a pixel's darkening is the overlay's strength there.
const WHITE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#fff"/></svg>')}`;
const heroHtml = (props) => render('Hero', { heading: 'Make the next step clear', eyebrow: 'A clear direction', deck: 'Practical support, useful information and a straightforward way to get started.', surface: 'picture-dark', picture: WHITE, height: 'full', ...props }, { before: trail, default: '<p>A note under the deck.</p>' });
async function pageHtml(hero, { header = false } = {}) {
  const next = await render('Band', {}, { default: '<h2>What follows</h2><p>Some words.</p>' });
  const slots = { default: `${hero}${next}` };
  if (header) slots.header = await render('Header', { identity: { label: 'Example', href: '#home', name: 'Example' }, menu: [{ label: 'Products', href: '#products' }], linkMenu: true, attachment: 'sticky', start: 'under' });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hero</title><style>${styles}</style></head><body>${await render('Page', {}, slots)}</body></html>`;
}
// The overlay's strength on each row of the window, read one pixel in from its start edge, and where the hero's parts stand.
async function shoot(browser, html, [width, height]) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false });
  try {
    const tab = await context.newPage();
    await tab.setContent(html);
    const parts = await tab.evaluate(() => {
      const top = (selector) => document.querySelector(selector)?.getBoundingClientRect().top;
      const hero = document.querySelector('.kn-hero').getBoundingClientRect();
      const text = document.querySelector('.kn-hero-text').getBoundingClientRect();
      return { heroTop: hero.top, heroBottom: hero.bottom, textTop: text.top, textBottom: text.bottom, heading: top('.kn-heading-group-heading'), header: document.querySelector('.kn-header')?.getBoundingClientRect().bottom ?? 0 };
    });
    const png = decodePng(await tab.screenshot());
    const strength = Array.from({ length: png.height }, (_, row) => (png.pixels[(row * png.width + 1) * png.channels] - 255) / (ink - 255));
    // The rows wholly inside the hero: on a hero's bottom edge between two pixels its loading colour shows a little.
    return { ...parts, strength, inside: strength.slice(Math.ceil(parts.heroTop), Math.floor(parts.heroBottom)), at: (y) => strength[Math.round(y)] };
  } finally {
    await context.close();
  }
}
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual.toFixed(3)}, not ${expected.toFixed(3)}`);

test('with the text at the bottom of a picture, the overlay is whole from the top of the main heading down and fades in above it over 36svh, between 8rem and 32rem', { timeout: 240000 }, async () => {
  const html = await pageHtml(await heroHtml({ place: 'bottom' }));
  for (const [name, browser] of browsers) for (const window of WINDOWS) {
    const shot = await shoot(browser, html, window);
    const label = `${name} ${window.join(' × ')}`;
    const reach = reachOf(window[1]);
    for (let row = Math.ceil(shot.heading) + 1; row < Math.floor(shot.heroBottom) - 1; row++) near(shot.strength[row], opacity, 0.01, `${label}: row ${row}, under the heading's top, has the whole strength`);
    assert.ok(Math.max(...shot.inside) <= opacity + 0.01, `${label}: nowhere stronger than tested`);
    near(shot.at(shot.heading - reach / 2), opacity / 2, 0.02, `${label}: half of it halfway up the reach`);
    near(shot.at(shot.heading - reach - 3), 0, 0.01, `${label}: and the picture is clear above the reach`);
    assert.ok(shot.at(shot.textTop + 4) < opacity - 0.02, `${label}: the trail above the heading stands in the fade, at ${shot.at(shot.textTop + 4).toFixed(3)}`);
  }
});

test('with the text at the top, the overlay is whole from the hero\'s top through the text\'s last line and fades out below it over the same reach', { timeout: 240000 }, async () => {
  for (const header of [false, true]) {
    const html = await pageHtml(await heroHtml({ place: 'top' }), { header });
    for (const [name, browser] of browsers) for (const window of WINDOWS) {
      const shot = await shoot(browser, html, window);
      const label = `${name} ${window.join(' × ')}${header ? ' under a header' : ''}`;
      const reach = reachOf(window[1]);
      for (let row = Math.ceil(shot.heroTop); row < Math.floor(shot.textBottom); row++) near(shot.strength[row], opacity, 0.01, `${label}: row ${row}, above the text's last line`);
      assert.ok(Math.max(...shot.inside) <= opacity + 0.01, `${label}: nowhere stronger than tested`);
      near(shot.at(shot.textBottom + reach / 2), opacity / 2, 0.02, `${label}: half of it halfway down the reach`);
      if (shot.textBottom + reach + 3 < shot.heroBottom) near(shot.at(shot.textBottom + reach + 3), 0, 0.01, `${label}: and the picture is clear below it`);
    }
  }
});

test('a hero without a heading keeps the overlay whole from its text\'s first line, under a sticky header too', { timeout: 240000 }, async () => {
  const hero = (await heroHtml({ place: 'bottom' })).replace(/<h1 class="kn-heading-group-heading"[^>]*>[^<]*<\/h1>/, '');
  assert.doesNotMatch(hero, /kn-heading-group-heading/);
  for (const header of [false, true]) {
    const html = await pageHtml(hero, { header });
    for (const [name, browser] of browsers) {
      const shot = await shoot(browser, html, [1512, 900]);
      const label = `${name}${header ? ' under a header' : ''}`;
      for (let row = Math.ceil(shot.textTop) + 1; row < Math.floor(shot.heroBottom) - 1; row++) near(shot.strength[row], opacity, 0.01, `${label}: row ${row}, under the text's top`);
      near(shot.at(shot.textTop - reachOf(900) / 2), opacity / 2, 0.02, `${label}: half of it halfway up the reach`);
      assert.ok(Math.max(...shot.inside) <= opacity + 0.01, `${label}: nowhere stronger than tested`);
    }
  }
});

test('under a sticky header starting over the hero, the header\'s words and the heading down keep the whole strength, and the fade adds nothing past it', { timeout: 240000 }, async () => {
  for (const height of ['full', 'half']) {
    const html = await pageHtml(await heroHtml({ place: 'bottom', height }), { header: true });
    for (const [name, browser] of browsers) for (const window of WINDOWS) {
      const shot = await shoot(browser, html, window);
      const label = `${name} ${window.join(' × ')} ${height}`;
      const reach = reachOf(window[1]);
      assert.ok(Math.abs(shot.heroTop) < 1 && shot.header > 50, `${label}: the header lies over the hero's top`);
      for (let row = 0; row < Math.floor(shot.header); row++) near(shot.strength[row], opacity, 0.01, `${label}: row ${row}, behind the header's words`);
      for (let row = Math.ceil(shot.heading) + 1; row < Math.floor(shot.heroBottom) - 1; row++) near(shot.strength[row], opacity, 0.01, `${label}: row ${row}, under the heading's top`);
      assert.ok(Math.max(...shot.inside) <= opacity + 0.01, `${label}: where the two meet, nowhere stronger than tested`);
      // The header's own overlay clears 6rem below it; past that the fade is the hero's alone.
      if (shot.heading - reach / 2 > shot.header + 100) near(shot.at(shot.heading - reach / 2), opacity / 2, 0.02, `${label}: half of it halfway up the reach`);
      if (shot.heading - reach - 3 > shot.header + 100) near(shot.at(shot.heading - reach - 3), 0, 0.01, `${label}: and the picture clear between the header and the reach`);
    }
  }
});
