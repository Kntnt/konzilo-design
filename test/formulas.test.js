// Formulas in body text (issue #33): the MathML the Konzilo core writes, made by Temml (gallery/src/formula-samples.js),
// drawn by a site's own stylesheets, as fromDesign names them, and its fonts folder, as the fonts command writes it. In
// STIX Two Math, inline at the size of the text round it, a block formula centred in the reading column and scrolling in
// its own box where it is wider, in the text colour of its Surface, in every engine Playwright has here.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright-core';
import { DESIGN_FORMAT, defaultInputs, derive, resolve } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { copyFonts } from '../src/konzilo/fonts.js';
import { renderMarkdown } from './helpers/konzilo-body.js';
import { BLOCK, INLINE } from '../gallery/src/formula-samples.js';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const read = (path) => readFileSync(here(path), 'utf8');
const flat = (file) => read(file).replace(/@import "(.+?)";/g, (_, path) => readFileSync(join(dirname(here(file)), path), 'utf8'));
const konzilo = read('../src/konzilo/konzilo.css');
const resolved = derive(defaultInputs());
const KINDS = Object.keys(resolved.surfaces).filter((kind) => resolved.surfaces[kind]);
const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const MATH_FONT = 'STIXTwoMath-Regular.woff2';

// A site's stylesheets, in the order fromDesign names them, with the library's components, which a site's layout imports
// too, and its fonts folder served beside its pages, as the fonts command writes it.
let styles, scratch, server, base;
const browsers = [];
const documents = new Map();
before(async () => {
  styles = [coreCss(resolved), flat('../src/konzilo/body-styles.css'), konzilo, await componentsCss()].join('\n');
  scratch = await mkdtemp(join(tmpdir(), 'kn-formulas-'));
  const inputs = defaultInputs();
  await writeFile(join(scratch, 'site.design.json'), JSON.stringify({ format: DESIGN_FORMAT, inputs, project: {}, resolved: await resolve(inputs) }));
  await copyFonts(join(scratch, 'site.design.json'), join(scratch, 'fonts'));
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://local').pathname;
    try {
      if (documents.has(path)) {
        response.setHeader('Content-Type', 'text/html');
        response.end(documents.get(path));
      } else {
        if (!/^\/fonts\/[\w.-]+$/.test(path)) throw new Error('Not served');
        response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'font/woff2');
        response.end(await readFile(join(scratch, 'fonts', basename(path))));
      }
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(async () => {
  await Promise.all(browsers.map(([, browser]) => browser.close()));
  await new Promise((done) => server.close(done));
  await rm(scratch, { recursive: true, force: true });
});

// A page of the site holding a body: its stylesheets, then the fonts folder's, as a site's build links them.
let pages = 0;
async function open(browser, body, { width = 1280, mode = 'light', media = 'screen', dir = 'ltr' } = {}) {
  const path = `/page-${pages += 1}`;
  documents.set(path, `<!doctype html><html lang="en" dir="${dir}" data-kn-mode="${mode}"><head><meta charset="utf-8"><style>${styles}</style><link rel="stylesheet" href="/fonts/fonts.css"></head><body data-kn-surface="page">${body}</body></html>`);
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: true });
  const tab = await context.newPage();
  const requests = [];
  tab.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await tab.emulateMedia({ media });
  await tab.goto(base + path);
  await tab.evaluate(() => document.fonts.ready);
  tab.on('close', () => context.close().catch(() => {}));
  return { tab, requests };
}

// An article's body, as a template places it: a Band, and Body Text in the Narrow column.
const article = (blocks, surface = 'page') => `<main class="kn-page-main"><section class="kn-band" data-kn-surface="${surface}"><div class="kn-band-content"><div class="kn-body-text" data-kn-width="narrow" id="column">${blocks}</div></div></section></main>`;
const BODY = `<p id="before">Euler's identity, ${INLINE.euler}, holds, and so does ${INLINE.derivative} for a function of ${INLINE.reals}; the length is ${INLINE.root}, and half of it ${INLINE.half}.</p>
${Object.entries(BLOCK).map(([name, box]) => box.replace('<div class="konzilo-math">', `<div class="konzilo-math" id="${name}">`)).join('\n<p>A paragraph between two formulas.</p>\n')}
<p id="after">A paragraph after the formulas.</p>`;

for (const [name] of BROWSERS) {
  const browser = () => browsers.find(([one]) => one === name)[1];

  test(`in ${name} a formula in a body is drawn in STIX Two Math, at the size of the text round it, and a block formula stands a paragraph's space from the text`, { timeout: 120000 }, async () => {
    const { tab } = await open(browser(), article(BODY));
    const read = await tab.evaluate(() => {
      const style = (element) => getComputedStyle(element);
      const inline = document.querySelector('#before math');
      const block = document.querySelector('#integral math');
      const font = [...document.fonts].find((face) => face.family.replace(/"/g, '') === 'STIX Two Math');
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const integral = box('integral');
      return {
        inline: style(inline).fontFamily, block: style(block).fontFamily, status: font?.status,
        sizes: [style(inline).fontSize, style(document.getElementById('before')).fontSize, style(block).fontSize, style(document.getElementById('column')).fontSize],
        above: integral.top - box('before').bottom, below: document.getElementById('integral').nextElementSibling.getBoundingClientRect().top - integral.bottom,
        em: parseFloat(style(document.getElementById('column')).fontSize),
      };
    });
    assert.match(read.inline, /^"?STIX Two Math"?,/, 'inline');
    assert.match(read.block, /^"?STIX Two Math"?,/, 'block');
    assert.equal(read.status, 'loaded', 'the font is the one drawn');
    assert.equal(new Set(read.sizes).size, 1, `one size: ${read.sizes}`);
    assert.ok(Math.abs(read.above - read.em) < 1 && Math.abs(read.below - read.em) < 1, `1em above and below: ${read.above}, ${read.below}`);
    await tab.close();
  });

  // konzilo.css writes Temml's lengths in ex in em, at this x-height, so they are Temml's to a hair.
  test(`in ${name} STIX Two Math's x-height is 0.473em, at which konzilo.css writes Temml's lengths in ex`, { timeout: 120000 }, async () => {
    const { tab } = await open(browser(), article(`<p id="before">A formula, ${INLINE.euler}.</p>`));
    const height = await tab.evaluate(() => {
      const probe = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'mrow');
      probe.style.cssText = 'display: block; padding-block-start: 100ex;';
      document.querySelector('#before math semantics').append(probe);
      return parseFloat(getComputedStyle(probe).paddingBlockStart) / 100 / parseFloat(getComputedStyle(probe).fontSize);
    });
    assert.ok(Math.abs(height - 0.473) < 0.001, `${height}em`);
    await tab.close();
  });

  test(`in ${name} a block formula is centred in the reading column, in an article's body and in a section's`, { timeout: 120000 }, async () => {
    const section = renderMarkdown(`:::section\n\n## Formulas\n\nThe section's deck.\n\nThe words before it.\n\n${BLOCK.quotient.replace('<div class="konzilo-math">', '<div class="konzilo-math" id="in-section">')}\n\nThe words after it.\n\n:::`);
    for (const body of [article(BODY), `<main class="kn-page-main">${section}</main>`]) {
      const { tab } = await open(browser(), body);
      const centres = await tab.evaluate(() => [...document.querySelectorAll('.konzilo-math')].filter((box) => box.id !== 'wide').map((box) => {
        const middle = (rect) => rect.left + rect.width / 2;
        const words = box.previousElementSibling.getBoundingClientRect();
        // The formula itself, the first child of its semantics, whatever the width of its math element.
        return { id: box.id, formula: middle(box.querySelector('semantics > :first-child').getBoundingClientRect()), column: middle(words), box: box.getBoundingClientRect().width, words: words.width };
      }));
      assert.ok(centres.length > 0);
      for (const one of centres) {
        assert.ok(Math.abs(one.formula - one.column) < 1, `${one.id}: its middle at ${one.formula}, the column's at ${one.column}`);
        assert.ok(Math.abs(one.box - one.words) < 1, `${one.id}: its box is the column's width, ${one.box} and ${one.words}`);
      }
      await tab.close();
    }
  });

  test(`in ${name}, on a phone, a formula wider than its column scrolls in its own box, left to right and right to left, and the page is no wider than the window`, { timeout: 120000 }, async () => {
    for (const dir of ['ltr', 'rtl']) {
    const { tab } = await open(browser(), article(BODY), { width: 390, dir });
    const read = await tab.evaluate(() => {
      const box = document.getElementById('wide');
      const column = document.getElementById('column').getBoundingClientRect();
      // The formula's ends, its box scrolled as far left and as far right as it goes, in either direction: it can be
      // read whole.
      const formula = box.querySelector('semantics > :first-child');
      box.scrollLeft = -box.scrollWidth;
      const left = formula.getBoundingClientRect().left - box.getBoundingClientRect().left;
      box.scrollLeft = box.scrollWidth;
      const right = box.getBoundingClientRect().right - formula.getBoundingClientRect().right;
      box.scrollLeft = 0;
      return {
        left, right,
        scrolls: box.scrollWidth > box.clientWidth + 1, overflow: getComputedStyle(box).overflowX,
        within: box.getBoundingClientRect().right <= column.right + 0.5 && box.getBoundingClientRect().left >= column.left - 0.5,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        narrow: document.getElementById('integral').scrollWidth - document.getElementById('integral').clientWidth,
      };
    });
    assert.ok(read.scrolls, `${dir}: the wide formula is wider than its box`);
    assert.ok(read.left > -0.5 && read.right > -0.5, `${dir}: the formula is read whole, from one end to the other: ${read.left}, ${read.right}`);
    assert.equal(read.overflow, 'auto');
    assert.ok(read.within, `${dir}: its box stays in the column`);
    assert.equal(read.page, 0, `${dir}: the page does not widen`);
    assert.equal(read.narrow, 0, `${dir}: a formula that fits does not scroll`);
    await tab.close();
    }
  });

  test(`in ${name} a formula takes the text colour of the Surface it stands on, in both modes and on every Surface`, { timeout: 120000 }, async () => {
    const bands = KINDS.map((kind) => article(`<p>A formula, ${INLINE.euler}, in the text.</p>${BLOCK.integral}<p style="color: var(--kn-text)" class="probe">The Surface's text.</p>`, kind)).join('');
    for (const mode of ['light', 'dark']) {
      const { tab } = await open(browser(), bands, { mode });
      const colours = await tab.evaluate(() => [...document.querySelectorAll('.kn-band')].map((band) => ({
        kind: band.dataset.knSurface,
        text: getComputedStyle(band.querySelector('.probe')).color,
        formulas: [...band.querySelectorAll('math, math mi, math mo')].map((element) => getComputedStyle(element).color),
      })));
      for (const { kind, text, formulas } of colours) for (const colour of formulas) assert.equal(colour, text, `${mode}, ${kind}`);
      await tab.close();
    }
  });

  test(`in ${name} a page without a formula does not fetch the formulas' font, and a page with one does`, { timeout: 120000 }, async () => {
    const without = await open(browser(), article('<p>Words, and no formula.</p><h2>A heading</h2><p>More words.</p>'));
    assert.ok(without.requests.includes('/fonts/fonts.css'), 'the page has the fonts folder\'s stylesheet');
    assert.ok(!without.requests.some((path) => path.endsWith(MATH_FONT)), `no request for the font: ${without.requests}`);
    await without.tab.close();
    const withOne = await open(browser(), article(`<p>A formula, ${INLINE.euler}.</p>`));
    assert.ok(withOne.requests.some((path) => path.endsWith(MATH_FONT)), `a request for the font: ${withOne.requests}`);
    await withOne.tab.close();
  });

  test(`in ${name}, in print, a block formula shows whole and is kept on one page`, { timeout: 120000 }, async () => {
    const { tab } = await open(browser(), article(BODY), { width: 390, media: 'print' });
    const read = await tab.evaluate(() => [...document.querySelectorAll('.konzilo-math')].map((box) => ({ overflow: getComputedStyle(box).overflowX, breaks: getComputedStyle(box).breakInside })));
    for (const one of read) assert.deepEqual(one, { overflow: 'visible', breaks: 'avoid' });
    await tab.close();
  });
}

// What Temml's MathML relies on, in its own stylesheet for STIX Two Math (Temml 0.14.0, dist/Temml-STIX2.css): every class
// it styles, but its equation numbers, which the design does not draw, and none of its font rules.
const TEMML_CLASSES = `mathscr tml-prime menclose tml-cancelto tml-right tml-left tml-shift-left tml-jot tml-small tml-vec ff-narrow
  ff-nudge-left ff-squash tml-sml-pad tml-med-pad tml-lrg-pad wbk-acc wbk-sml wbk-sml-acc wbk-sml-vec wbk-med wbk-med-acc
  wbk-med-vec wbk-lrg wbk-lrg-acc wbk-lrg-vec chr-sml chr-sml-vec chr-med chr-med-vec chr-lrg chr-lrg-vec tml-overline
  tml-underline tml-cancel upstrike downstrike sout tml-xcancel longdiv-top longdiv-arc phasor-bottom phasor-angle tml-fbox
  circle-pad textcircle actuarial tml-tilde-2 tml-tilde-3 tml-tilde-4 tml-hat-1 tml-hat-2 tml-hat-3 tml-hat-4`.split(/\s+/);

test('konzilo.css holds Temml\'s rules for each class its MathML may hold, without its font rules or its equation numbers', () => {
  for (const name of TEMML_CLASSES) assert.match(konzilo, new RegExp(`\\.${name}(?![\\w-])`), name);
  assert.doesNotMatch(konzilo, /@font-face|font-family: STIX2|tml-eqn|tmlEqnNo/);
  assert.deepEqual([...konzilo.matchAll(/font-family:\s*([^;}]+)/g)].map(([, family]) => family.trim()).filter((family) => /math/i.test(family)), ['"STIX Two Math", math']);
});
