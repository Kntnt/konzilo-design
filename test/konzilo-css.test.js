// konzilo.css on what the core really writes (test/fixtures/konzilo-page.html: fragments of a built site, with made-up
// content), with a copy of the core's modal.css, in each browser that is there, and beside this library's own components.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright-core';
import { parse, walk } from 'css-tree';
import { derive, defaultInputs, contrast } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { footerFromDesign } from '../src/components/design-props.js';
import { render } from './helpers/render.js';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const read = (path) => readFileSync(here(path), 'utf8');
const css = read('../src/konzilo/konzilo.css');
const modal = read('fixtures/konzilo-modal.css');
const fixture = read('fixtures/konzilo-page.html');
const flat = (file) => read(file).replace(/@import "(.+?)";/g, (_, path) => readFileSync(join(dirname(here(file)), path), 'utf8'));
const resolved = derive(defaultInputs());
const bodyStyles = [coreCss(resolved), flat('../src/konzilo/body-styles.css'), css, modal];
// A site's layout imports the library's components too, and the build may put them after konzilo.css.
const components = await componentsCss();
const onASite = [coreCss(resolved), flat('../src/konzilo/body-styles.css'), css, modal, components];

// Every class of the core's docs/site-design.md, with a name in angle brackets filled in.
const CLASSES = `
  konzilo-gallery
  konzilo-lightbox-open konzilo-modal konzilo-modal-close konzilo-lightbox konzilo-lightbox-strip konzilo-lightbox-step konzilo-lightbox-previous konzilo-lightbox-next konzilo-lightbox-place
  konzilo-embed konzilo-embed-no-script konzilo-embed-question konzilo-embed-storage konzilo-embed-allow
  konzilo-form konzilo-form-preview konzilo-form-fields konzilo-form-field konzilo-form-required konzilo-form-choice konzilo-form-help konzilo-form-problem konzilo-form-outcome konzilo-form-send konzilo-form-trap
  konzilo-form-checkbox konzilo-form-acceptance
  konzilo-form-sent konzilo-form-invalid konzilo-form-too-many konzilo-form-refused konzilo-form-unavailable
  konzilo-consent konzilo-consent-banner konzilo-consent-text konzilo-consent-title konzilo-consent-buttons konzilo-consent-choice konzilo-consent-secondary konzilo-consent-close konzilo-consent-dialog konzilo-consent-head konzilo-consent-introduction konzilo-consent-category konzilo-consent-category-name konzilo-consent-description konzilo-consent-count konzilo-consent-always konzilo-consent-row konzilo-consent-switch konzilo-consent-services konzilo-consent-service konzilo-consent-service-name konzilo-consent-facts konzilo-consent-policies konzilo-consent-controls
  konzilo-declaration konzilo-declaration-consent konzilo-declaration-no-script konzilo-declaration-none konzilo-declaration-services konzilo-declaration-revised konzilo-declaration-category konzilo-declaration-service konzilo-declaration-departures
  konzilo-search-box konzilo-search konzilo-search-preview konzilo-search-status konzilo-search-message konzilo-search-results konzilo-search-result konzilo-search-about konzilo-search-type konzilo-search-snippet konzilo-search-pages
  konzilo-declaration-choice konzilo-pager konzilo-pager-gap konzilo-pager-previous konzilo-pager-next
`.trim().split(/\s+/);
// A kind of field that takes the look of every field.
const PLAIN = ['konzilo-form-text', 'konzilo-form-email', 'konzilo-form-tel', 'konzilo-form-select', 'konzilo-form-textarea', 'konzilo-form-radio', 'konzilo-form-checkboxes'];
// Written by the core's script or a component the footer test renders, and not by the build of this fixture.
const ELSEWHERE = ['konzilo-consent-controls'];

test('every class the core writes has a rule, and the fixture holds it', () => {
  const styled = css + modal;
  for (const name of CLASSES) assert.ok(new RegExp(`\\.${name}(?![\\w-])`).test(styled), `no rule for ${name}`);
  const inFixture = new Set([...fixture.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)).filter((name) => name.startsWith('konzilo-')));
  for (const name of [...CLASSES, ...PLAIN].filter((one) => !ELSEWHERE.includes(one))) assert.ok(inFixture.has(name), `the fixture lacks ${name}`);
  for (const name of inFixture) assert.ok(CLASSES.includes(name) || PLAIN.includes(name), `an unknown class in the fixture: ${name}`);
});

test('the fixture holds nothing but made-up content', () => {
  assert.doesNotMatch(fixture, /youtube|vimeo|google|\/_astro\/|northern valley/i);
  assert.match(fixture, /data-konzilo-form="\{\}"/);
});

test('konzilo.css has a layer of its own after the components, so a site\'s stylesheets may come in any order and a site can override it', () => {
  const tree = parse(css, { parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false });
  const top = tree.children.toArray().filter((node) => node.type !== 'Comment');
  assert.equal(top[0].name, 'layer');
  assert.equal(top[0].prelude.value.replace(/\s/g, ''), 'kn-core,kn-base,kn-components,kn-konzilo');
  assert.deepEqual(top.slice(1).map((node) => [node.name, node.prelude.value]), [['layer', 'kn-components'], ['layer', 'kn-konzilo']]);
  assert.match(read('../src/konzilo/body-styles.css'), /^(?:\/\*[\s\S]*?\*\/\s*)?@layer kn-core, kn-base, kn-components;/);
  const properties = [];
  walk(tree, (node) => { if (node.type === 'Declaration' && node.property.startsWith('--konzilo-lightbox-')) properties.push(node.property); });
  assert.deepEqual(properties.sort(), ['--konzilo-lightbox-control', '--konzilo-lightbox-overlay', '--konzilo-lightbox-text']);
});

const BROWSERS = Object.entries({ firefox, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const rgb = (text) => text.match(/[\d.]+/g).map(Number);
// sRGB colour over another, for words on a see-through overlay.
const over = ([r, g, b, a = 1], [under0, under1, under2]) => [r * a + under0 * (1 - a), g * a + under1 * (1 - a), b * a + under2 * (1 - a)];
const hex = (channels) => `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
const ratio = (one, other) => contrast(hex(one.slice(0, 3)), hex(other.slice(0, 3)));

let scratch;
let documents = 0;
before(async () => { scratch = await mkdtemp(join(tmpdir(), 'kn-konzilo-css-')); });
after(() => rm(scratch, { recursive: true, force: true }));
async function pageFor(browser, { mode = 'light', sheets = onASite, body = fixture, viewport = { width: 1280, height: 800 }, hash = '', javaScriptEnabled = true } = {}) {
  const path = join(scratch, `page-${documents += 1}.html`);
  await writeFile(path, `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><style>${sheets.join('\n')}</style></head><body>${body}</body></html>`);
  const context = await browser.newContext({ viewport, javaScriptEnabled });
  const page = await context.newPage();
  await page.goto(`${pathToFileURL(path).href}${hash}`);
  return page;
}
const close = (page) => page.context().close();

// What the core's scripts do to the build's markup: consent.js, cookie-declaration.js and forms.js.
const showConsent = (page) => page.evaluate(() => {
  document.querySelector('.konzilo-consent-banner').hidden = false;
  for (const button of document.querySelectorAll('button[data-konzilo-consent-action][hidden]')) button.hidden = false;
});
const showDeclaration = (page) => page.evaluate(() => {
  const root = document.querySelector('.konzilo-declaration');
  root.querySelector('.konzilo-declaration-no-script').hidden = true;
  root.querySelector('.konzilo-declaration-choice').hidden = false;
  root.querySelector('[data-konzilo-declaration-id]').textContent = '00000000-0000-4000-8000-000000000000';
  root.querySelector('[data-konzilo-declaration-time]').textContent = '5 November 2026';
});
const markInvalid = (page) => page.evaluate(() => {
  const form = document.getElementById('konzilo-form-contact');
  document.getElementById('konzilo-form-contact-invalid').hidden = false;
  for (const name of ['name', 'email', 'terms']) {
    document.getElementById(`konzilo-form-contact-${name}`).setAttribute('aria-invalid', 'true');
    const problem = document.getElementById(`konzilo-form-contact-${name}-problem`);
    problem.textContent = 'Fill in this field.';
    problem.hidden = false;
  }
  const group = document.getElementById('konzilo-form-contact-time');
  group.setAttribute('aria-invalid', 'true');
  const problem = document.getElementById('konzilo-form-contact-time-problem');
  problem.textContent = 'Choose an option.';
  problem.hidden = false;
  return form.id;
});

// This library's own Form, Field, ConsentBanner, Embed and Pagination, as a site outside Konzilo has them.
async function ownComponents() {
  const field = (props) => render('Field', { name: props.name ?? props.type, label: 'A field', ...props });
  const options = [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }];
  const fields = [
    await field({ name: 'text', type: 'text', help: 'Some help.', required: true, requiredLabel: 'required' }),
    await field({ name: 'invalid', type: 'text', error: 'Fill in this field.' }),
    await field({ name: 'off', type: 'text', disabled: true }),
    await field({ name: 'area', type: 'textarea' }),
    await field({ name: 'pick', type: 'select', options }),
    await field({ name: 'radio', type: 'radio', options }),
  ].join('');
  const banner = await render('ConsentBanner', {
    categories: [{ id: 'necessary', label: 'Necessary', description: 'What the site needs.', required: true, services: [] }, { id: 'statistics', label: 'Statistics', description: 'How many come.', services: [] }],
    texts: { title: 'A title', description: 'Some words.', acceptAll: 'Accept', rejectAll: 'Reject', settings: 'Settings', settingsTitle: 'Settings', settingsDescription: 'Some words.', save: 'Save', close: 'Close', required: 'Always on' },
  });
  const embed = await render('Embed', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'A made-up film' });
  const pages = await render('Pagination', { page: 3, pages: 9, base: '/notes/' });
  const button = await render('Button', {}, { default: 'Send' });
  return `<div class="kn-own"><form class="kn-form"><div class="kn-form-fields">${fields}</div>${button}</form>${banner}${embed}${pages}</div>`;
}


for (const [name, type] of BROWSERS) {
  let browser;
  test.describe(name, () => {
    before(async () => { browser = await type.launch(); });
    after(() => browser.close());

    test('a gallery takes its columns from its number of pictures, as a series of cards does, its caption not counted', async () => {
      const figure = '<figure><button class="konzilo-lightbox-open" type="button"><img alt="A field" width="1600" height="1000" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'1600\' height=\'1000\'/%3E"></button></figure>';
      const gallery = (n) => `<figure class="konzilo-gallery" data-n="${n}">${figure.repeat(n)}<figcaption>Pictures</figcaption></figure>`;
      for (const width of [72, 44, 34, 20]) {
        const body = `<div class="kn-body-text" style="inline-size: ${width}rem">${Array.from({ length: 13 }, (_, i) => gallery(i + 1)).join('')}</div>`;
        const page = await pageFor(browser, { body, viewport: { width: 1280, height: 800 } });
        const found = await page.evaluate(() => {
          const probe = document.body.appendChild(document.createElement('div'));
          probe.style.inlineSize = '12rem';
          const minimum = probe.getBoundingClientRect().width;
          return [...document.querySelectorAll('.konzilo-gallery')].map((grid) => {
            const counts = new Map();
            for (const item of grid.querySelectorAll(':scope > figure')) { const top = Math.round(item.getBoundingClientRect().top); counts.set(top, (counts.get(top) ?? 0) + 1); }
            const caption = grid.querySelector(':scope > figcaption').getBoundingClientRect();
            return { n: Number(grid.dataset.n), rows: [...counts.values()].join('+'), width: grid.clientWidth, gap: Number.parseFloat(getComputedStyle(grid).columnGap), minimum, captionWidth: caption.width };
          });
        });
        for (const { n, rows, width: inner, gap, minimum, captionWidth } of found) {
          const needs = (c) => c * minimum + (c - 1) * gap;
          if ([4, 3, 2].some((c) => Math.abs(inner - needs(c)) < 1)) continue;
          const fit = inner >= needs(4) ? 4 : inner >= needs(3) ? 3 : inner >= needs(2) ? 2 : 1;
          const c = fit === 1 ? 1 : n === 2 || fit === 2 ? 2 : n === 1 || n === 3 || [5, 6, 9].includes(n % 12) ? 3 : fit === 4 ? 4 : n % 6 === 4 ? 2 : 3;
          const expected = [...Array(Math.floor(n / c)).fill(c), ...(n % c ? [n % c] : [])].join('+');
          assert.equal(rows, expected, `${n} pictures in ${width}rem`);
          assert.ok(Math.abs(captionWidth - inner) < 1, 'the caption spans the gallery');
        }
        await close(page);
      }
    });

    test('the pager stands a column gap under the cards of a post list, as a section\'s body spaces its parts', async () => {
      const pager = fixture.match(/<nav class="konzilo-pager".*?<\/nav>/s)[0];
      const cards = '<ul class="kn-card-grid kn-cards">' + '<li><article class="kn-card" data-kn-surface="raised"><h3 class="kn-card-heading">A post</h3></article></li>'.repeat(3) + '</ul>';
      const body = `<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><div class="kn-post-list" id="inside">${cards}${pager}</div><div class="kn-post-list" id="after">${cards}</div>${pager}<p id="next">After.</p></div></div></section>`;
      const page = await pageFor(browser, { body });
      const found = await page.evaluate(() => {
        const probe = document.querySelector('.kn-section-body').appendChild(document.createElement('div'));
        probe.style.inlineSize = 'var(--kn-space-column-gap)';
        const column = probe.getBoundingClientRect().width;
        probe.remove();
        const box = (selector) => document.querySelector(selector).getBoundingClientRect();
        return {
          column,
          inside: box('#inside > .konzilo-pager').top - box('#inside > .kn-cards').bottom,
          end: box('#inside').bottom - box('#inside > .konzilo-pager').bottom,
          after: box('#after + .konzilo-pager').top - box('#after').bottom,
        };
      });
      assert.ok(Math.abs(found.inside - found.column) < 1, `${found.inside} under the cards, against a column gap of ${found.column}`);
      assert.ok(Math.abs(found.end) < 1, 'the list ends with its pager');
      assert.ok(Math.abs(found.after - found.column) < 1, `${found.after} after the list`);
      await close(page);
    });

    for (const mode of ['light', 'dark']) {
      test(`the button that opens a lightbox takes the design's focus ring, as every other control does, ${mode}`, async () => {
        const page = await pageFor(browser, { mode });
        const found = await page.evaluate(() => {
          const button = document.querySelector('figure > button.konzilo-lightbox-open');
          // The design's focus colour where the button stands, as a link focused beside it shows it.
          const probe = button.parentElement.insertAdjacentElement('afterend', document.createElement('a'));
          probe.href = '#probe';
          probe.textContent = 'a link';
          button.focus();
          const style = getComputedStyle(button);
          const ring = { visible: button.matches(':focus-visible'), color: style.outlineColor, style: style.outlineStyle };
          probe.focus();
          return { ring, focus: getComputedStyle(probe).outlineColor };
        });
        assert.equal(found.ring.visible, true);
        assert.equal(found.ring.style, 'solid');
        assert.equal(found.ring.color, found.focus, 'the ring is the design\'s focus colour, not the text\'s');
      });

      test(`a lightbox keeps its own margins and sizes inside body text, and its words stay readable, ${mode}`, async () => {
        const page = await pageFor(browser, { mode });
        const measured = await page.evaluate(() => {
          const single = document.getElementById('konzilo-modal-1');
          const gallery = document.querySelector('.konzilo-gallery + dialog');
          const closed = getComputedStyle(gallery).display;
          const inFigure = single.previousElementSibling.matches('figure') && single.previousElementSibling.querySelector(':scope > button.konzilo-lightbox-open > img') !== null;
          single.showModal();
          // A link cannot be written in a caption, and a site's own markup might still hold one.
          single.querySelector('figcaption').insertAdjacentHTML('beforeend', ' <a href="#source">a link</a>');
          const style = (selector, dialog = single) => getComputedStyle(dialog.querySelector(selector));
          const box = (selector, dialog = single) => dialog.querySelector(selector).getBoundingClientRect();
          const margins = (selector, dialog = single) => { const s = style(selector, dialog); return [s.marginBlockStart, s.marginBlockEnd, s.marginInlineStart, s.marginInlineEnd]; };
          const root = getComputedStyle(document.documentElement);
          const one = {
            ul: { margins: margins('ul'), padding: style('ul').paddingInlineStart, list: style('ul').listStyleType },
            li: margins('li'),
            figure: margins('li > figure'),
            caption: { margins: margins('figcaption'), color: style('figcaption').color, align: style('figcaption').textAlign },
            link: style('figcaption a').color,
            code: { color: style('figcaption code').color, background: style('figcaption code').backgroundColor },
            strong: style('figcaption strong').color,
            image: { radius: style('img').borderTopLeftRadius, width: box('img').width, height: box('img').height },
            close: { width: box('.konzilo-modal-close').width, height: box('.konzilo-modal-close').height, color: style('.konzilo-modal-close').color, background: style('.konzilo-modal-close').backgroundColor },
            svg: { width: box('.konzilo-modal-close svg').width, height: box('.konzilo-modal-close svg').height },
            backdrop: getComputedStyle(single, '::backdrop').backgroundColor,
          };
          single.close();
          gallery.showModal();
          const many = {
            images: [...gallery.querySelectorAll('img')].map((image) => { const r = image.getBoundingClientRect(); return { radius: getComputedStyle(image).borderTopLeftRadius, aspect: getComputedStyle(image).aspectRatio, width: r.width, height: r.height }; }),
            place: { margins: margins('.konzilo-lightbox-place', gallery), color: style('.konzilo-lightbox-place', gallery).color },
            step: { width: box('.konzilo-lightbox-next', gallery).width, previous: style('.konzilo-lightbox-previous', gallery).visibility },
          };
          return { closed, inFigure, view: { width: innerWidth, height: innerHeight }, one, many, overlay: root.getPropertyValue('--konzilo-lightbox-overlay'), control: root.getPropertyValue('--konzilo-lightbox-control') };
        });
        assert.equal(measured.closed, 'none');
        assert.ok(measured.inFigure, 'the core writes an image in a button in its figure, and its dialog after that');
        const { one, many } = measured;
        assert.deepEqual(one.ul.margins, ['0px', '0px', '0px', '0px']);
        assert.equal(one.ul.padding, '0px');
        assert.equal(one.ul.list, 'none');
        assert.deepEqual(one.li, ['0px', '0px', '0px', '0px']);
        assert.deepEqual(one.figure, ['0px', '0px', '0px', '0px']);
        assert.equal(one.caption.margins[1], '0px');
        assert.equal(one.caption.align, 'center');
        assert.equal(many.place.margins[1], '0px');
        for (const color of [one.caption.color, one.link, one.code.color, one.strong, many.place.color]) assert.deepEqual(rgb(color).slice(0, 3), [255, 255, 255], 'words on the overlay, a link\'s and code\'s too, take its colour');
        assert.equal(rgb(one.code.background).at(-1), 0);
        for (const image of [one.image, ...many.images]) {
          assert.equal(image.radius, '0px');
          assert.ok(image.width <= measured.view.width && image.height <= measured.view.height);
          assert.ok(image.width > 0 && image.height > 0);
        }
        for (const image of many.images) assert.match(image.aspect, /^auto/, 'a gallery\'s crop on the page does not reach the image here');
        assert.deepEqual([one.close.width, one.close.height], [48, 48]);
        assert.deepEqual([one.svg.width, one.svg.height], [24, 24]);
        assert.equal(many.step.width, 48);
        // Readable on the overlay, at its lightest: over a white page.
        assert.deepEqual(rgb(one.backdrop), rgb(measured.overlay), 'the backdrop reads the root\'s overlay');
        const overlay = over(rgb(measured.overlay), [255, 255, 255]);
        assert.ok(Math.max(...overlay) < 40, 'a near-black overlay in both modes');
        assert.ok(ratio(rgb(one.caption.color), overlay) >= 7);
        assert.ok(ratio(rgb(one.close.color), rgb(one.close.background)) >= 7);
        await close(page);
      });

      test(`text on what the core writes passes its contrast, ${mode}`, async () => {
        const page = await pageFor(browser, { mode });
        await showConsent(page);
        await showDeclaration(page);
        await markInvalid(page);
        const found = await page.evaluate(() => {
          document.querySelector('.konzilo-consent-dialog').showModal();
          document.querySelectorAll('.konzilo-consent-services').forEach((details) => { details.open = true; });
          const solid = (element) => {
            for (let at = element; at; at = at.parentElement) {
              const channels = getComputedStyle(at).backgroundColor.match(/[\d.]+/g).map(Number);
              if (channels.length === 3 || channels[3] === 1) return getComputedStyle(at).backgroundColor;
            }
            return 'rgb(255, 255, 255)';
          };
          const selectors = ['.konzilo-consent-banner .konzilo-consent-title', '.konzilo-consent-text', '.konzilo-consent-banner a', '.konzilo-consent-banner .konzilo-consent-choice', '.konzilo-consent-banner .konzilo-consent-secondary', '.konzilo-consent-close', '.konzilo-consent-introduction', '.konzilo-consent-category-name', '.konzilo-consent-count', '.konzilo-consent-always', '.konzilo-consent-description', '.konzilo-consent-services summary', '.konzilo-consent-facts dt', '.konzilo-consent-facts a', '[data-fixture="asking"] .konzilo-embed-question', '[data-fixture="asking"] .konzilo-embed-storage', '[data-fixture="asking"] .konzilo-embed-storage a', '[data-fixture="asking"] .konzilo-embed-allow', '[data-fixture="asking"] > a', '.konzilo-embed-no-script', '.konzilo-form-field label', '.konzilo-form-required', '.konzilo-form-help', '.konzilo-form-problem:not([hidden])', '.konzilo-form input[type="text"]', '.konzilo-form select', '.konzilo-form-invalid', '.konzilo-form-preview', '.konzilo-form-send', '.konzilo-form-send:disabled', '.konzilo-pager a:not([aria-current])', '.konzilo-pager a[aria-current]', '.konzilo-pager-gap', '.konzilo-declaration-revised', '.konzilo-declaration dt', '.konzilo-search-status', '.konzilo-search-about', '.konzilo-search-snippet mark', '.konzilo-search form button', '.konzilo-search-result > a', '.kn-body-text figure:not(.konzilo-gallery, .konzilo-embed) > figcaption', 'blockquote cite', '.kn-body-text pre code', '[data-footnotes] li'];
          return selectors.map((selector) => {
            const element = document.querySelector(selector);
            return element ? { selector, color: getComputedStyle(element).color, background: solid(element) } : { selector, missing: true };
          });
        });
        for (const { selector, color, background, missing } of found) {
          assert.ok(!missing, `the fixture has no ${selector}`);
          const value = ratio(rgb(color), rgb(background));
          assert.ok(value >= 4.5, `${selector}: ${color} on ${background} is ${value.toFixed(2)}:1`);
        }
        await close(page);
      });
    }

    test('each state holds: what is hidden stays hidden, an outcome shows by its fragment, the trap is out of sight, a panel loses its padding once it holds its player', async () => {
      const page = await pageFor(browser, { hash: '#konzilo-form-contact-refused' });
      const states = await page.evaluate(() => {
        const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
        const trap = document.querySelector('.konzilo-form-trap').getBoundingClientRect();
        const asking = document.querySelector('[data-fixture="asking"]');
        const loaded = document.querySelector('[data-fixture="loaded"]');
        const fields = document.querySelector('#konzilo-form-contact .konzilo-form-fields');
        fields.hidden = true;
        const sentFields = getComputedStyle(fields).display;
        fields.hidden = false;
        return {
          banner: display('.konzilo-consent-banner'),
          dialog: display('.konzilo-consent-dialog'),
          problem: display('.konzilo-form-problem[hidden]'),
          outcome: display('#konzilo-form-contact-sent'),
          targeted: display('#konzilo-form-contact-refused'),
          fields: sentFields,
          withdraw: display('.konzilo-declaration [data-konzilo-consent-action="withdraw"]'),
          choice: display('.konzilo-declaration-choice'),
          none: display('.konzilo-declaration-none'),
          pages: display('[data-fixture="static"] .konzilo-search-pages'),
          trap: { width: trap.width, height: trap.height },
          template: display('[data-fixture="asking"] > template'),
          asking: { padding: getComputedStyle(asking).paddingBlockStart, height: asking.getBoundingClientRect().height },
          loaded: { padding: getComputedStyle(loaded).paddingBlockStart, background: getComputedStyle(loaded).backgroundColor, player: loaded.querySelector('iframe').getBoundingClientRect().height, width: loaded.getBoundingClientRect().width },
          noScript: getComputedStyle(document.querySelector('.konzilo-embed-no-script')).animationName,
          current: getComputedStyle(document.querySelector('.konzilo-pager a[aria-current]')).backgroundColor,
          gap: getComputedStyle(document.querySelector('.konzilo-pager-gap')).minInlineSize,
          sendDisabled: getComputedStyle(document.querySelector('#konzilo-form-preview .konzilo-form-send')).cursor,
        };
      });
      for (const key of ['banner', 'dialog', 'problem', 'outcome', 'fields', 'withdraw', 'choice', 'none', 'pages', 'template']) assert.equal(states[key], 'none', key);
      assert.equal(states.targeted, 'block');
      assert.ok(states.trap.width <= 1 && states.trap.height <= 1);
      assert.notEqual(states.asking.padding, '0px');
      assert.ok(states.asking.height >= 14 * 16);
      assert.equal(states.loaded.padding, '0px');
      assert.equal(rgb(states.loaded.background).at(-1), 0);
      assert.ok(Math.abs(states.loaded.player - (states.loaded.width * 9) / 16) < 2, 'the player has the panel to itself');
      assert.equal(states.noScript, 'konzilo-embed-late');
      assert.notEqual(rgb(states.current).at(-1), 0, 'the current page has its fill');
      assert.equal(states.gap, '44px');
      assert.equal(states.sendDisabled, 'default');
      await close(page);
    });

    test('words outside a script show where it has not run, and a search message there is in its colour', async () => {
      const page = await pageFor(browser, { javaScriptEnabled: false });
      const shown = await page.evaluate(() => {
        const message = document.querySelector('[data-fixture="static"] .konzilo-search-message');
        const noScript = document.querySelector('.konzilo-declaration-no-script');
        return { message: message && getComputedStyle(message).display, noScript: getComputedStyle(noScript).display, buttons: getComputedStyle(document.querySelector('.konzilo-declaration [data-konzilo-consent-action]')).display };
      });
      assert.equal(shown.message, 'block');
      assert.equal(shown.noScript, 'block');
      assert.equal(shown.buttons, 'none');
      await close(page);
    });

    test('secondary buttons are outlined and every target is one a finger can find, in whatever order the stylesheets come', async () => {
      for (const sheets of [bodyStyles, onASite]) {
        const page = await pageFor(browser, { sheets });
        await showConsent(page);
        const found = await page.evaluate(() => {
          document.querySelector('.konzilo-consent-dialog').showModal();
          const size = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length).map((element) => ({ selector, height: element.getBoundingClientRect().height }));
          return {
            targets: ['.konzilo-consent-choice', '.konzilo-consent-secondary', '.konzilo-consent-close', '.konzilo-consent-switch', '.konzilo-consent-services summary', '.konzilo-form input[type="text"]', '.konzilo-form select', '.konzilo-form-choice', '.konzilo-form-send', '.konzilo-embed-allow', '.konzilo-pager a', '.konzilo-search form button', '.konzilo-search-box button'].flatMap(size),
            secondary: getComputedStyle(document.querySelector('.konzilo-consent-banner .konzilo-consent-secondary')).backgroundColor,
            choice: getComputedStyle(document.querySelector('.konzilo-consent-banner .konzilo-consent-choice')).backgroundColor,
            track: getComputedStyle(document.querySelector('.konzilo-consent-switch:not(:checked)'), '::before').backgroundColor,
            on: getComputedStyle(document.querySelector('.konzilo-consent-switch:checked'), '::before').backgroundColor,
          };
        });
        for (const { selector, height } of found.targets) assert.ok(height >= 44, `${selector} is ${height}`);
        assert.equal(rgb(found.secondary).at(-1), 0);
        assert.notEqual(found.choice, found.secondary);
        assert.notEqual(found.track, found.on);
        await close(page);
      }
    });

    test('in body text what the core writes keeps its own look, whichever stylesheet came last', async () => {
      for (const sheets of [bodyStyles, onASite]) {
        const page = await pageFor(browser, { sheets });
        const found = await page.evaluate(() => {
          const style = (selector) => getComputedStyle(document.querySelector(selector));
          return {
            pager: { color: style('.konzilo-pager a:not([aria-current])').color, line: style('.konzilo-pager a:not([aria-current])').textDecorationLine, item: style('.konzilo-pager li').marginBlockStart, list: style('.konzilo-pager ul').paddingInlineStart },
            results: { padding: style('.konzilo-search-results').paddingInlineStart, item: style('.konzilo-search-result').marginBlockStart, line: style('.konzilo-search-result > a').textDecorationLine },
            text: getComputedStyle(document.querySelector('.kn-body-text')).color,
            help: style('.konzilo-form-help').marginBlockEnd,
          };
        });
        assert.equal(found.pager.color, found.text);
        assert.equal(found.pager.line, 'none');
        assert.equal(found.pager.item, '0px');
        assert.equal(found.pager.list, '0px');
        assert.equal(found.results.padding, '0px');
        assert.equal(found.results.item, '0px');
        assert.equal(found.results.line, 'none');
        assert.equal(found.help, '0px');
        await close(page);
      }
    });

    for (const [size, viewport] of Object.entries({ wide: { width: 1280, height: 800 }, phone: { width: 390, height: 780 } })) {
      test(`nothing runs off the page, and a term never squeezes what it says, ${size}`, async () => {
        const page = await pageFor(browser, { viewport });
        await showDeclaration(page);
        const found = await page.evaluate(() => {
          const term = document.querySelector('.konzilo-declaration-service dt').getBoundingClientRect();
          const said = document.querySelector('.konzilo-declaration-service dd').getBoundingClientRect();
          return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, term: term.width, said: said.width, columns: getComputedStyle(document.querySelector('.konzilo-declaration-service dl')).gridTemplateColumns.split(' ').length };
        });
        assert.equal(found.over, 0);
        assert.equal(found.columns, size === 'phone' ? 1 : 2);
        assert.ok(found.said >= found.term, `${JSON.stringify(found)}`);
        await close(page);
      });
    }

    test('what the core writes looks like this library\'s own Form, Field, ConsentBanner, Embed and Pagination', async () => {
      const own = await ownComponents();
      for (const mode of ['light', 'dark']) {
        const page = await pageFor(browser, { mode, body: `${own}${fixture}` });
        await showConsent(page);
        await markInvalid(page);
        const differences = await page.evaluate(() => {
          for (const element of document.querySelectorAll('.kn-own [hidden]')) element.hidden = false;
          for (const element of document.querySelectorAll('.kn-own .kn-field-error [data-kn-error-text]:empty')) element.closest('.kn-field-error').hidden = true;
          const stage = document.querySelector('.kn-embed-stage');
          for (const hide of stage.querySelectorAll('.kn-embed-thumbnail, .kn-embed-frame')) hide.hidden = true;
          const LOOK = ['color', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing'];
          const BOX = ['paddingBlockStart', 'paddingInlineStart', 'borderBlockStartWidth', 'borderBlockStartStyle', 'borderBlockStartColor', 'borderStartStartRadius', 'backgroundColor'];
          const pairs = [
            ['input', '.kn-own input.kn-field-control', '#konzilo-form-contact-phone', [...LOOK, ...BOX, 'minBlockSize', 'display']],
            ['input, invalid', '.kn-own [aria-invalid="true"].kn-field-control', '#konzilo-form-contact-email', ['borderBlockStartColor']],
            ['textarea', '.kn-own textarea.kn-field-control', '#konzilo-form-contact-message', [...LOOK, ...BOX, 'resize']],
            ['select', '.kn-own select.kn-field-control', '#konzilo-form-contact-subject', [...LOOK, 'paddingBlockStart', 'paddingInlineEnd', 'borderBlockStartWidth', 'borderBlockStartColor', 'borderStartStartRadius', 'backgroundColor', 'appearance', 'minBlockSize']],
            ['field', '.kn-own .kn-field', '#konzilo-form-contact .konzilo-form-text', ['display', 'rowGap', 'marginBlockStart', 'paddingBlockStart', 'borderBlockStartWidth']],
            ['fields', '.kn-own .kn-form-fields', '#konzilo-form-contact .konzilo-form-fields', ['display', 'rowGap']],
            ['label', '.kn-own label.kn-field-label', '#konzilo-form-contact .konzilo-form-tel > label', LOOK],
            ['legend', '.kn-own legend.kn-field-label', '#konzilo-form-contact-time legend', LOOK],
            ['required', '.kn-own .kn-field-required', '.konzilo-form-required', ['color', 'fontSize']],
            ['help', '.kn-own .kn-field-help', '.konzilo-form-help', ['color', 'fontSize', 'lineHeight', 'marginBlockEnd']],
            ['problem', '.kn-own .kn-field-error:not([hidden])', '#konzilo-form-contact-email-problem', ['color', 'fontSize', 'lineHeight', 'marginBlockEnd']],
            ['choice', '.kn-own .kn-field-option', '.konzilo-form-choice', ['display', 'alignItems', 'columnGap', 'minBlockSize']],
            ['choice input', '.kn-own .kn-field-option input', '.konzilo-form-choice input', ['inlineSize', 'blockSize', 'accentColor', 'colorScheme']],
            ['button', '.kn-own .kn-form > .kn-button', '#konzilo-form-contact .konzilo-form-send', [...LOOK, ...BOX, 'boxShadow', 'cursor']],
            ['button in the banner', '.kn-consent-actions > .kn-button', '.konzilo-consent-banner .konzilo-consent-choice', [...LOOK, ...BOX, 'boxShadow', 'whiteSpace']],
            ['outline in the banner', '.kn-consent-actions > .kn-button[data-kn-variant="outline"]', '.konzilo-consent-banner .konzilo-consent-secondary', [...LOOK, 'backgroundColor', 'boxShadow', 'paddingBlockStart']],
            ['banner', '.kn-consent', '.konzilo-consent-banner', ['position', 'zIndex', 'insetBlockEnd', 'insetInlineEnd', 'inlineSize', 'paddingBlockStart', 'paddingInlineStart', 'borderBlockStartWidth', 'borderBlockStartColor', 'borderStartStartRadius', 'boxShadow', 'backgroundColor', 'color']],
            ['actions', '.kn-consent-actions', '.konzilo-consent-banner .konzilo-consent-buttons', ['display', 'rowGap']],
            ['banner title', '.kn-consent > :first-child', '.konzilo-consent-banner .konzilo-consent-title', LOOK],
            ['banner words', '.kn-consent > p', '.konzilo-consent-text', ['fontSize', 'lineHeight', 'color']],
            ['dialog', '.kn-consent-settings', '.konzilo-consent-dialog', ['inlineSize', 'paddingBlockStart', 'borderBlockStartWidth', 'borderBlockStartColor', 'borderStartStartRadius', 'boxShadow', 'color']],
            ['dialog title', '.kn-consent-settings-header > :first-child', '.konzilo-consent-head .konzilo-consent-title', LOOK],
            ['category', '.kn-consent-category', '.konzilo-consent-category', ['backgroundColor', 'borderBlockStartWidth', 'borderBlockStartColor', 'borderStartStartRadius']],
            ['category name', '.kn-consent-category-label', '.konzilo-consent-category-name', ['fontWeight', 'color']],
            ['count', '.kn-consent-category-label > span', '.konzilo-consent-count', ['color', 'fontSize', 'lineHeight', 'fontWeight']],
            ['embed panel', '.kn-embed-consent', '[data-fixture="asking"]', ['display', 'flexDirection', 'alignItems', 'justifyContent', 'rowGap', 'minBlockSize', 'paddingBlockStart', 'paddingInlineStart', 'backgroundColor', 'color']],
            ['embed title', '.kn-embed-title', '[data-fixture="asking"] .konzilo-embed-question', ['fontSize', 'fontWeight', 'lineHeight', 'fontFamily', 'marginBlockStart', 'marginBlockEnd']],
            ['embed words', '.kn-embed-notice', '[data-fixture="asking"] .konzilo-embed-storage', ['color', 'fontSize', 'lineHeight', 'marginBlockEnd']],
            ['embed button', '.kn-embed-consent .kn-button[data-kn-variant="outline"]', '[data-fixture="asking"] .konzilo-embed-allow', [...LOOK, 'backgroundColor', 'boxShadow', 'paddingBlockStart', 'borderStartStartRadius']],
            ['pager list', '.kn-pagination ul', '.konzilo-pager ul', ['display', 'flexWrap', 'alignItems', 'columnGap', 'marginBlockStart', 'paddingInlineStart', 'listStyleType']],
            ['pager link', '.kn-pagination a:not([aria-current])', '.konzilo-pager a:not([aria-current])', ['display', 'color', 'textDecorationLine', 'minInlineSize', 'minBlockSize', 'paddingBlockStart', 'borderStartStartRadius', 'fontSize']],
            ['pager current', '.kn-pagination a[aria-current]', '.konzilo-pager a[aria-current]', ['color', 'backgroundColor', 'textDecorationLine']],
            ['pager gap', '.kn-pagination span[aria-hidden]', '.konzilo-pager-gap', ['minInlineSize', 'minBlockSize', 'paddingBlockStart']],
          ];
          const out = [];
          for (const [name, mine, theirs, properties] of pairs) {
            const a = document.querySelector(mine);
            const b = document.querySelector(theirs);
            if (!a || !b) { out.push(`${name}: no ${a ? theirs : mine}`); continue; }
            const [x, y] = [getComputedStyle(a), getComputedStyle(b)];
            for (const property of properties) if (x[property] !== y[property]) out.push(`${name}.${property}: ${x[property]} here, ${y[property]} on the core's`);
          }
          const part = (properties, selector, pseudo) => { const s = getComputedStyle(document.querySelector(selector), pseudo); return properties.map((p) => s[p]).join(' '); };
          const TRACK = ['inlineSize', 'blockSize', 'borderBlockStartColor', 'borderStartStartRadius', 'backgroundColor'];
          const KNOB = ['inlineSize', 'blockSize', 'borderStartStartRadius', 'backgroundColor'];
          for (const [name, properties, mine, theirs] of [['switch off', TRACK, ['.kn-switch input:not(:checked) + .kn-switch-track'], ['.konzilo-consent-switch:not(:checked)', '::before']], ['switch on', TRACK, ['.kn-switch input:checked + .kn-switch-track'], ['.konzilo-consent-switch:checked', '::before']], ['knob off', KNOB, ['.kn-switch input:not(:checked) + .kn-switch-track', '::before'], ['.konzilo-consent-switch:not(:checked)', '::after']], ['knob on', KNOB, ['.kn-switch input:checked + .kn-switch-track', '::before'], ['.konzilo-consent-switch:checked', '::after']]]) {
            const a = part(properties, ...mine); const b = part(properties, ...theirs);
            if (a !== b) out.push(`${name}: ${a} here, ${b} on the core's`);
          }
          return out;
        });
        assert.deepEqual(differences, [], `${mode}`);
        await close(page);
      }
    });

    test('a slot of the Footer takes its cell\'s alignment: the policies stand as the links at the start, and the buttons as the links at the end', async () => {
      const settings = structuredClone(resolved.footer);
      settings.upper.cells = { a1: false, a2: false, b1: false, b2: false };
      settings.lower.cells = { a1: true, a2: true, b1: true, b2: true };
      const links = (label) => ({ links: [{ label: `${label} one`, href: '#one' }, { label: `${label} two`, href: '#two' }] });
      const footer = await render('Footer', footerFromDesign(settings, { lower: { a1: links('Start'), b1: links('End') } }), {
        // What `<ConsentControls slot="lower-a2" buttons={false} />` and `<ConsentControls slot="lower-b2" links={false} />` write.
        'lower-a2': '<div class="konzilo-consent-controls"><ul class="konzilo-consent-policies"><li><a href="/pages/privacy-policy/">Privacy policy</a></li><li><a href="/pages/cookie-policy/">Cookie policy</a></li></ul></div>',
        'lower-b2': '<div class="konzilo-consent-controls"><div class="konzilo-consent-buttons"><button type="button" class="konzilo-consent-secondary" data-konzilo-consent-action="change">Change privacy settings</button><button type="button" class="konzilo-consent-secondary" data-konzilo-consent-action="withdraw">Withdraw consent</button><button type="button" class="konzilo-consent-secondary" hidden>Not yet shown</button></div></div>',
      });
      const measure = (page) => page.evaluate(() => {
        const box = (selector) => document.querySelector(selector).getBoundingClientRect();
        const last = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length).at(-1).getBoundingClientRect();
        const button = getComputedStyle(document.querySelector('.konzilo-consent-secondary'));
        const link = getComputedStyle(document.querySelector('.kn-footer-links a'));
        return {
          aLink: box('[data-kn-cell="a1"] li a').left,
          aSlot: box('[data-kn-cell="a2"] li a').left,
          aCell: box('[data-kn-cell="a2"]').left,
          bLink: last('[data-kn-cell="b1"] li a').right,
          bSlot: last('[data-kn-cell="b2"] .konzilo-consent-secondary').right,
          bCell: box('[data-kn-cell="b2"]').right,
          bSlotText: box('[data-kn-cell="b2"] .konzilo-consent-secondary:first-child').left,
          button: { background: button.backgroundColor, shadow: button.boxShadow, size: button.fontSize, color: button.color, line: button.textDecorationLine },
          link: { size: link.fontSize, color: link.color, line: link.textDecorationLine },
          hidden: getComputedStyle(document.querySelector('.konzilo-consent-secondary[hidden]')).display,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          oneLine: last('[data-kn-cell="b2"] .konzilo-consent-secondary').top === box('[data-kn-cell="b2"] .konzilo-consent-secondary:first-child').top,
        };
      });
      const wide = await pageFor(browser, { body: footer });
      const atWide = await measure(wide);
      assert.ok(Math.abs(atWide.aSlot - atWide.aLink) < 1 && Math.abs(atWide.aSlot - atWide.aCell) < 1, `start: ${JSON.stringify(atWide)}`);
      assert.ok(Math.abs(atWide.bSlot - atWide.bCell) < 2 && Math.abs(atWide.bSlot - atWide.bLink) < 2, `end: ${JSON.stringify(atWide)}`);
      assert.ok(atWide.oneLine);
      assert.equal(rgb(atWide.button.background).at(-1), 0);
      assert.equal(atWide.button.shadow, 'none');
      assert.deepEqual([atWide.button.size, atWide.button.color, atWide.button.line], [atWide.link.size, atWide.link.color, atWide.link.line]);
      assert.equal(atWide.hidden, 'none');
      assert.equal(atWide.overflow, 0);
      await close(wide);
      // On a narrow screen one column, with every box at the start edge.
      const narrow = await pageFor(browser, { body: footer, viewport: { width: 390, height: 800 } });
      const atNarrow = await measure(narrow);
      assert.ok(Math.abs(atNarrow.aSlot - atNarrow.aLink) < 1);
      assert.ok(Math.abs(atNarrow.bSlotText - atNarrow.aSlot) < 24, `narrow: ${JSON.stringify(atNarrow)}`);
      assert.equal(atNarrow.overflow, 0);
      await close(narrow);
    });
  });
}
