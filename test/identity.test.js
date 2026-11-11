// The owner's rules for the identity, 2026-11-05: which parts show, where the slogan stands, that the
// footer follows the header, and, measured in the browsers' own pixels, that it all lines up as the eye sees it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright-core';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { derive, defaultInputs, validateInputs } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { brandParts, footerBrand } from '../src/components/brand.js';
import { footerFromDesign, layoutFooter } from '../src/components/footer.js';
import { footerHtml } from '../src/components/footer-html.js';
import { footerContent, identityProps } from '../presentation/src/frame.js';
import { designMd } from '../src/design-md/index.js';
import { decodePng, inkBounds } from './helpers/ink.js';
import { render } from './helpers/render.js';

const repo = new URL('..', import.meta.url).pathname;
const IDENTITIES = ['logo', 'name', 'both'];
const PLACES = ['beside', 'below'];
const inputs = (header) => ({ 'brand-colors': { primary: '#168b83' }, header });

test('a new design shows its logo alone, with the slogan beside it, and the logos are symbols', async () => {
  const { header } = defaultInputs();
  assert.deepEqual([header.identity, header['brand-axis'], header['slogan-place']], ['logo', 'row', 'beside']);
  for (const name of ['new-design-logo.svg', 'new-design-logo-dark.svg']) {
    const svg = await readFile(join(repo, 'tool', name), 'utf8');
    const [, width, height] = svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
    assert.equal(width, height, `${name} has a square viewBox`);
    assert.equal([...svg.matchAll(/<path\b/g)].length, 1, `${name} is the star and nothing else`);
  }
});

test('validation refuses the removed alignments and any other place for the slogan', () => {
  for (const key of ['brand-align', 'identity-axis', 'identity-align']) {
    assert.throws(() => validateInputs(inputs({ [key]: key === 'identity-axis' ? 'row' : 'center' })), new RegExp(`unknown property ${key}`));
  }
  for (const place of PLACES) assert.equal(derive(inputs({ 'slogan-place': place })).header['slogan-place'], place);
  assert.throws(() => validateInputs(inputs({ 'slogan-place': 'above' })));
  assert.throws(() => validateInputs(inputs({ identity: 'neither' })));
});

test('every value of identity shows what it says, and a design with no logo shows the name', () => {
  assert.deepEqual(brandParts('logo', true), { logo: true, name: false });
  assert.deepEqual(brandParts('name', true), { logo: false, name: true });
  assert.deepEqual(brandParts('both', true), { logo: true, name: true });
  for (const identity of IDENTITIES) assert.deepEqual(brandParts(identity, false), { logo: false, name: true });
  const header = withDefaults(inputs({})).header;
  const project = { name: 'Name', logo: 'data:light', 'logo-dark': 'data:dark', slogan: 'Words' };
  for (const identity of IDENTITIES) for (const place of PLACES) {
    const props = identityProps({ ...header, identity, 'slogan-place': place }, project);
    assert.equal(!!props.logo, identity !== 'name');
    assert.equal(!!props.name, identity !== 'logo');
    assert.equal(props.sloganPlace, place);
    assert.equal(props.slogan, 'Words');
    assert.deepEqual(Object.keys(props).sort(), ['brandAxis', 'href', 'label', 'logo', 'name', 'slogan', 'sloganPlace']);
  }
});

test('the header writes the place on the identity and the axis on the brand, for every combination', async () => {
  const logo = { light: 'data:image/svg+xml,light', dark: 'data:image/svg+xml,dark' };
  for (const identity of IDENTITIES) for (const place of PLACES) for (const axis of ['row', 'column']) {
    const html = await render('HeaderIdentity', { identity: { label: 'Name', href: '#home', slogan: 'Words', sloganPlace: place, brandAxis: axis, name: identity === 'logo' ? undefined : 'Name', logo: identity === 'name' ? undefined : logo } });
    assert.match(html, new RegExp(`data-kn-slogan-place="${place}"`));
    assert.match(html, new RegExp(`class="kn-brand" data-kn-axis="${axis}"`));
    assert.equal(html.includes('kn-brand-logo'), identity !== 'name');
    assert.equal(html.includes('kn-brand-name'), identity !== 'logo');
    assert.match(html, /kn-header-slogan[^>]*><span>Words<\/span><\/span>/);
    assert.doesNotMatch(html, /data-kn-align/);
  }
});

test('the footer\'s brand follows the header, with no slogan, and the right logo for the band\'s Surface', () => {
  const project = { name: 'A & B', logo: 'data:light', 'logo-dark': 'data:dark', slogan: 'Words' };
  const a1 = (identity, surface = 'brand', axis = 'row') => footerContent({ upper: { surface } }, project, { identity, 'brand-axis': axis, 'slogan-place': 'below' }).upper.a1.content;
  assert.match(a1('logo'), /<img src="data:dark" alt="A &amp; B">/);
  assert.doesNotMatch(a1('logo'), /kn-brand-name/);
  assert.doesNotMatch(a1('name'), /<img/);
  assert.match(a1('name'), /<span class="kn-brand-name"><span>A &amp; B<\/span><\/span>/);
  assert.match(a1('both'), /<img src="data:dark" alt="">.*kn-brand-name/, 'beside the name the logo says nothing more');
  assert.match(a1('both', 'brand', 'column'), /data-kn-axis="column"/);
  for (const identity of IDENTITIES) assert.doesNotMatch(a1(identity), /Words|slogan/);
  assert.match(a1('logo', 'inverse'), /data:dark/);
  assert.doesNotMatch(a1('logo', 'inverse'), /data:light/);
  for (const surface of ['page', 'raised', 'tint']) {
    assert.match(a1('logo', surface), /class="kn-footer-logo" data-kn-logo="light" src="data:light".*class="kn-footer-logo" data-kn-logo="dark" src="data:dark"/);
  }
  assert.match(footerBrand({ identity: 'both', name: 'A', logo: { light: 'data:one' }, surface: 'page' }), /<img src="data:one" alt="">/, 'one logo serves both modes');
  assert.match(footerBrand({ identity: 'logo', name: 'A', logo: { light: null, dark: null } }), /kn-brand-name/, 'without a logo there is the name');
});

test('Footer.astro and the preview write one markup for the brand, in every combination', async () => {
  const normal = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/>\s+</g, '><').replace(/&#x26;/g, '&amp;').trim();
  const footer = withDefaults(inputs({})).footer;
  const project = { name: 'Name', logo: 'data:light', 'logo-dark': 'data:dark' };
  for (const identity of IDENTITIES) for (const axis of ['row', 'column']) {
    const props = footerFromDesign(footer, footerContent(footer, project, { identity, 'brand-axis': axis }));
    assert.equal(normal(await render('Footer', props)), normal(footerHtml(layoutFooter(props), props)), `${identity} ${axis}`);
  }
});

test('the export for AI says what the brand is and where the slogan stands', () => {
  const words = (header) => designMd({ inputs: withDefaults(inputs(header)), project: { name: 'Name' }, resolved: derive(inputs(header)) }, 'name.design.json');
  assert.match(words({ identity: 'both', 'brand-axis': 'column', 'slogan-place': 'below' }), /\*\*Brand:\*\* the logo and the name, stacked[^\n]*below the name/);
  assert.match(words({}), /\*\*Brand:\*\* the logo, in the header and in the footer alike[^\n]*beside the brand/);
});

// The geometry, in each browser that is there. A line of words stands on its baseline up to its cap height, so
// these capitals' ink is what the optical middle is defined by, and the logo's ink fills its box.
const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const FACES = { 'Mona Sans': 'Mona Sans', 'Source Serif 4': '"Source Serif 4", Georgia, serif' };
const WORDS = 'HEH';
const SCALE = 4;
const LIMIT = 1;
let server, base;
const documents = new Map();
before(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://local').pathname;
    try {
      if (documents.has(path)) {
        response.setHeader('Content-Type', 'text/html');
        response.end(documents.get(path));
      } else {
        if (!/^\/src\/fonts\/[A-Za-z0-9-]+\.(?:css|woff2)$/.test(path)) throw new Error('Not served');
        response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'font/woff2');
        response.end(await readFile(join(repo, path)));
      }
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((done) => server.close(done)));

async function documentFor(face, direction) {
  const logo = `data:image/svg+xml;base64,${(await readFile(join(repo, 'tool/new-design-logo.svg'))).toString('base64')}`;
  const design = defaultInputs();
  design.typefaces.main = FACES[face];
  const rows = [];
  for (const identity of IDENTITIES) for (const place of PLACES) for (const axis of ['row', 'column']) {
    const html = await render('HeaderIdentity', { identity: { label: WORDS, href: '#home', slogan: WORDS, sloganPlace: place, brandAxis: axis, name: identity === 'logo' ? undefined : WORDS, logo: identity === 'name' ? undefined : { light: logo, dark: logo } } });
    rows.push(`<header class="kn-header" data-kn-step="none" id="${identity}-${place}-${axis}"><div class="kn-header-bar"><div class="kn-header-inner"><div class="kn-header-group" data-kn-group="start">${html}</div></div></div></header>`);
  }
  return `<!doctype html><html lang="en" dir="${direction}"><head><link rel="stylesheet" href="/src/fonts/fonts.css"><style>${coreCss(derive(design))}${await componentsCss()}
    .measuring .kn-header * { visibility: hidden; }
    .measuring .kn-header [data-measure], .measuring .kn-header [data-measure] * { visibility: visible; }
    .measuring .kn-header .kn-header-slogan::after { visibility: hidden; }
    .measuring-line .kn-header .kn-header-slogan::after { visibility: visible; border-color: #000; }
    .measuring-line .kn-header .kn-header-slogan > span { visibility: hidden; }
  </style></head><body data-kn-surface="page">${rows.join('')}</body></html>`;
}

// Each part's own ink and box, in CSS pixels, with everything else hidden.
async function measure(page, row, selector, { line = false } = {}) {
  const part = page.locator(`#${row} ${selector}`);
  await part.evaluate((node, asLine) => {
    document.querySelectorAll('[data-measure]').forEach((other) => other.removeAttribute('data-measure'));
    node.setAttribute('data-measure', '');
    document.body.classList.add('measuring');
    document.body.classList.toggle('measuring-line', asLine);
  }, line);
  const bar = await page.locator(`#${row} .kn-header-bar`).boundingBox();
  const shot = decodePng(await page.screenshot({ clip: bar }));
  const ink = inkBounds(shot, 64);
  const box = await part.boundingBox();
  assert.ok(ink, `${row} ${selector} has ink`);
  const at = (edge, origin) => origin + edge / SCALE;
  return {
    ink: { top: at(ink.top, bar.y), bottom: at(ink.bottom, bar.y), left: at(ink.left, bar.x), right: at(ink.right, bar.x) },
    middle: (at(ink.top, bar.y) + at(ink.bottom, bar.y)) / 2,
    box,
  };
}

for (const [name, type] of BROWSERS) {
  test(`in ${name} the identity's parts line up within a pixel, in two typefaces and both directions`, { timeout: 120000 }, async (t) => {
    const browser = await type.launch();
    try {
      for (const face of Object.keys(FACES)) for (const direction of ['ltr', 'rtl']) {
        const path = `/${face.replaceAll(' ', '-')}-${direction}`;
        documents.set(path, await documentFor(face, direction));
        const context = await browser.newContext({ viewport: { width: 900, height: 1600 }, deviceScaleFactor: SCALE });
        const page = await context.newPage();
        await page.goto(base + path);
        const family = await page.evaluate(async () => {
          const name = getComputedStyle(document.querySelector('.kn-brand-name'));
          await document.fonts.load(`${name.fontWeight} 24px ${name.fontFamily}`);
          await document.fonts.load(`16px ${getComputedStyle(document.body).fontFamily}`);
          await document.fonts.ready;
          return name.fontFamily;
        });
        assert.ok(family.includes(face), `the name is set in ${face}, not ${family}`);
        const close = (a, b, what, limit = LIMIT) => assert.ok(Math.abs(a - b) <= limit, `${name}, ${face}, ${direction}: ${what}: ${a} and ${b}`);
        const startOf = (box) => (direction === 'ltr' ? box.x : box.x + box.width);

        // Beside: logo, name, slogan and the hairline, all on one line, the slogan at the end side.
        const logo = await measure(page, 'both-beside-row', '.kn-brand-logo');
        const brandName = await measure(page, 'both-beside-row', '.kn-brand-name');
        const slogan = await measure(page, 'both-beside-row', '.kn-header-slogan');
        const line = await measure(page, 'both-beside-row', '.kn-header-slogan', { line: true });
        const report = `${face} ${direction}: logo ${logo.middle.toFixed(2)}, name ${brandName.middle.toFixed(2)}, slogan ${slogan.middle.toFixed(2)}, line ${line.middle.toFixed(2)}`;
        t.diagnostic(report);
        close(logo.middle, brandName.middle, 'logo and name');
        close(logo.middle, slogan.middle, 'logo and slogan');
        close(logo.middle, line.middle, 'logo and hairline');
        assert.ok(direction === 'ltr' ? slogan.box.x > brandName.box.x + brandName.box.width : slogan.box.x + slogan.box.width < brandName.box.x, `${report}: the slogan stands at the end side`);
        assert.equal(logo.box.height, 36);
        close(brandName.box.height, brandName.ink.bottom - brandName.ink.top, 'the name\'s box is as tall as its capitals');

        // Logo alone and name alone, the slogan beside.
        close((await measure(page, 'logo-beside-row', '.kn-brand-logo')).middle, (await measure(page, 'logo-beside-row', '.kn-header-slogan')).middle, 'logo alone and slogan');
        close((await measure(page, 'name-beside-row', '.kn-brand-name')).middle, (await measure(page, 'name-beside-row', '.kn-header-slogan')).middle, 'name alone and slogan');

        // Below, with both: the logo beside the two lines, the slogan from the name's start edge.
        const belowLogo = await measure(page, 'both-below-row', '.kn-brand-logo');
        const belowName = await measure(page, 'both-below-row', '.kn-brand-name');
        const belowSlogan = await measure(page, 'both-below-row', '.kn-header-slogan');
        close(belowLogo.middle, (belowName.ink.top + belowSlogan.ink.bottom) / 2, 'the logo and the two lines');
        close(startOf(belowName.box), startOf(belowSlogan.box), 'the boxes of name and slogan start together', 0.05);
        assert.ok(belowSlogan.ink.top > belowName.ink.bottom, `${report}: the slogan stands under the name`);
        assert.ok(direction === 'ltr' ? belowName.box.x >= belowLogo.box.x + belowLogo.box.width : belowName.box.x + belowName.box.width <= belowLogo.box.x, `${report}: the logo stands beside them`);

        // Below, with one of them: from its start edge.
        for (const [row, part] of [['logo-below-row', '.kn-brand-logo'], ['name-below-row', '.kn-brand-name']]) {
          const first = await measure(page, row, part);
          const under = await measure(page, row, '.kn-header-slogan');
          close(startOf(first.box), startOf(under.box), `${row}: the slogan starts where it starts`, 0.05);
          assert.ok(under.ink.top > first.ink.bottom, `${row}: the slogan stands under it`);
        }

        // Stacked: all from one start edge, the slogan following them when below.
        const stackedLogo = await measure(page, 'both-below-column', '.kn-brand-logo');
        const stackedName = await measure(page, 'both-below-column', '.kn-brand-name');
        const stackedSlogan = await measure(page, 'both-below-column', '.kn-header-slogan');
        close(startOf(stackedLogo.box), startOf(stackedName.box), 'stacked logo and name', 0.05);
        close(startOf(stackedName.box), startOf(stackedSlogan.box), 'stacked name and slogan', 0.05);
        assert.ok(stackedLogo.ink.bottom < stackedName.ink.top && stackedName.ink.bottom < stackedSlogan.ink.top, `${report}: the stack runs logo, name, slogan`);

        // What the bar reads for its height is what the identity takes, with nothing shifted past it.
        const identity = await page.locator('#both-below-column .kn-brand').boundingBox();
        close(identity.height, stackedName.ink.bottom - stackedLogo.ink.top, 'a stack\'s box is as tall as its ink');
        for (const row of ['both-beside-row', 'both-below-row', 'logo-below-row']) {
          const bar = await page.locator(`#${row} .kn-header-bar`).boundingBox();
          const whole = await page.locator(`#${row} .kn-header-identity`).evaluate((node) => { const { height } = node.getBoundingClientRect(); return height - 16; });
          assert.ok(bar.height <= Math.max(64, whole + 24) + 1, `${row}: the bar is ${bar.height} for an identity of ${whole}`);
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  });
}
