// A hero's own height (directives.md, hero): the directive's height is the design's input of the same value, under a
// header that covers the window's top and under a sticky one the page starts under, laid out without script in every
// installed engine.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { render } from './helpers/render.js';
import { renderMarkdown, testDesign } from './helpers/konzilo-body.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const HEIGHTS = ['third', 'half', 'two-thirds', 'full'];
const identity = { label: 'Example Gardens', href: '#home', name: 'Example Gardens' };
const browsers = [];
let styles;
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}${await readFile(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8')}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// A page with a sticky header, which covers the window's top or which the page starts under, and an opening of a few
// words, written with the attributes given, in a design whose own height is the one given.
async function page(start, attributes, height) {
  const hero = renderMarkdown(`::::hero${attributes}\n\nWords.\n\n::::`, { design: testDesign({ hero: { picture: 'none', height } }) });
  const body = await render('Page', {}, { header: await render('Header', { identity, attachment: 'sticky', start }), default: hero });
  return `<!doctype html><html lang="en"><head><style>${styles}</style></head><body>${body}</body></html>`;
}
// The opening's height, the window's, and the header's height that a covering header takes from the window.
const measure = (tab) => tab.evaluate(() => {
  const probe = document.body.appendChild(document.createElement('div'));
  probe.style.blockSize = 'var(--kn-header-height)';
  const header = probe.getBoundingClientRect().height;
  probe.remove();
  return { hero: document.querySelector('.kn-hero').getBoundingClientRect().height, screen: innerHeight, header };
});

test('a hero\'s own height is the design\'s height of the same value, under a covering header and a header the page starts under', { timeout: 240000 }, async () => {
  for (const [name, browser] of browsers) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const tab = await context.newPage();
    try {
      for (const start of ['below', 'under']) {
        const shown = async (attributes, height) => {
          await tab.setContent(await page(start, attributes, height));
          return measure(tab);
        };
        for (const height of HEIGHTS) {
          const design = await shown('', height);
          // In a design of another height, so the attribute and not the design sets it.
          const own = await shown(`{height="${height}"}`, height === 'two-thirds' ? 'third' : 'two-thirds');
          assert.ok(Math.abs(own.hero - design.hero) < 0.5, `${name}, header ${start}, ${height}: ${own.hero} as the design's ${design.hero}`);
        }
        // Words this few leave the share, so the share shows: the window less a covering header, or all of it.
        const full = await shown('{height="full"}', 'two-thirds');
        const screen = start === 'under' ? full.screen : full.screen - full.header;
        assert.ok(full.header > 0, `${name}: the header has a height`);
        assert.ok(Math.abs(full.hero - screen) < 0.5, `${name}, header ${start}: full is ${full.hero}, the screen's ${screen}`);
        const plain = await shown('', 'two-thirds');
        assert.ok(Math.abs(plain.hero - screen * 2 / 3) < 0.5, `${name}, header ${start}: left out, the design's two thirds, ${plain.hero} of ${screen}`);
      }
    } finally {
      await context.close();
    }
  }
});
