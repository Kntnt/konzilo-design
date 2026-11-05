// konzilo.css on made-up markup in the form the core writes (test/fixtures/konzilo-page.html), with a copy of the core's
// modal.css, in each browser that is there.
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
// What no rule need name: a kind of field that takes the look of every field, or an element named by its element.
const PLAIN = ['konzilo-form-text', 'konzilo-form-email', 'konzilo-form-tel', 'konzilo-form-select', 'konzilo-form-textarea', 'konzilo-form-radio', 'konzilo-form-checkboxes'];

test('every class the core writes has a rule, and the fixture holds it', () => {
  const styled = css + modal;
  for (const name of CLASSES) assert.ok(new RegExp(`\\.${name}(?![\\w-])`).test(styled), `no rule for ${name}`);
  const inFixture = new Set([...fixture.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)).filter((name) => name.startsWith('konzilo-')));
  for (const name of [...CLASSES, ...PLAIN]) assert.ok(inFixture.has(name), `the fixture lacks ${name}`);
  for (const name of inFixture) assert.ok(CLASSES.includes(name) || PLAIN.includes(name), `an unknown class in the fixture: ${name}`);
});

test('konzilo.css stands in the components layer, with the order of the layers first, so a site can override it', () => {
  const tree = parse(css, { parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false });
  const top = tree.children.toArray().filter((node) => node.type !== 'Comment');
  assert.equal(top[0].name, 'layer');
  assert.equal(top[0].prelude.value.replace(/\s/g, ''), 'kn-core,kn-base,kn-components');
  assert.deepEqual(top.slice(1).map((node) => [node.name, node.prelude.value]), [['layer', 'kn-components']]);
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
const documents = new Map();
before(async () => { scratch = await mkdtemp(join(tmpdir(), 'kn-konzilo-css-')); });
after(() => rm(scratch, { recursive: true, force: true }));
async function pageFor(browser, { mode = 'light', sheets = bodyStyles, body = fixture, viewport = { width: 1280, height: 800 }, hash = '' } = {}) {
  const key = `${mode}-${documents.size}.html`;
  const path = join(scratch, key);
  documents.set(key, path);
  await writeFile(path, `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><style>${sheets.join('\n')}</style></head><body>${body}</body></html>`);
  const page = await browser.newPage({ viewport });
  await page.goto(`${pathToFileURL(path).href}${hash}`);
  return page;
}

for (const [name, type] of BROWSERS) {
  let browser;
  test.describe(name, () => {
    before(async () => { browser = await type.launch(); });
    after(() => browser.close());

    for (const mode of ['light', 'dark']) {
      test(`the lightbox keeps its own margins and sizes inside body text, and its words stay readable, ${mode}`, async () => {
        const page = await pageFor(browser, { mode });
        const measured = await page.evaluate(() => {
          const dialog = document.getElementById('konzilo-modal-2');
          const closed = getComputedStyle(dialog).display;
          dialog.showModal();
          const strip = dialog.querySelector('ul');
          strip.scrollTo({ left: strip.clientWidth, behavior: 'instant' });
          const style = (selector) => getComputedStyle(dialog.querySelector(selector));
          const box = (selector) => dialog.querySelector(selector).getBoundingClientRect();
          const margins = (selector) => { const s = style(selector); return [s.marginBlockStart, s.marginBlockEnd, s.marginInlineStart, s.marginInlineEnd]; };
          const images = [...dialog.querySelectorAll('img')].map((image) => { const r = image.getBoundingClientRect(); return { radius: getComputedStyle(image).borderTopLeftRadius, aspect: getComputedStyle(image).aspectRatio, width: r.width, height: r.height }; });
          const root = getComputedStyle(document.documentElement);
          return {
            closed,
            view: { width: innerWidth, height: innerHeight },
            ul: { margins: margins('ul'), padding: style('ul').paddingInlineStart, list: style('ul').listStyleType },
            li: margins('li'),
            figure: margins('li > figure'),
            caption: { margins: margins('figcaption'), color: style('figcaption').color, align: style('figcaption').textAlign },
            place: { margins: margins('.konzilo-lightbox-place'), color: style('.konzilo-lightbox-place').color },
            link: { color: style('figcaption a').color, outline: style('figcaption a').outlineStyle },
            code: { color: style('figcaption code').color, background: style('figcaption code').backgroundColor },
            images,
            close: { width: box('.konzilo-modal-close').width, height: box('.konzilo-modal-close').height, color: style('.konzilo-modal-close').color, background: style('.konzilo-modal-close').backgroundColor },
            svg: { width: box('.konzilo-modal-close svg').width, height: box('.konzilo-modal-close svg').height },
            overlay: root.getPropertyValue('--konzilo-lightbox-overlay'),
            text: root.getPropertyValue('--konzilo-lightbox-text'),
            control: root.getPropertyValue('--konzilo-lightbox-control'),
            backdrop: getComputedStyle(dialog, '::backdrop').backgroundColor,
          };
        });
        assert.equal(measured.closed, 'none');
        assert.deepEqual(measured.ul.margins, ['0px', '0px', '0px', '0px']);
        assert.equal(measured.ul.padding, '0px');
        assert.equal(measured.ul.list, 'none');
        assert.deepEqual(measured.li, ['0px', '0px', '0px', '0px']);
        assert.deepEqual(measured.figure, ['0px', '0px', '0px', '0px']);
        assert.equal(measured.caption.margins[1], '0px');
        assert.equal(measured.caption.align, 'center');
        assert.equal(measured.place.margins[1], '0px');
        assert.deepEqual(rgb(measured.caption.color).slice(0, 3), [255, 255, 255]);
        assert.deepEqual(rgb(measured.link.color).slice(0, 3), [255, 255, 255], 'a link in a caption takes the words\' colour, not the page\'s');
        assert.deepEqual(rgb(measured.code.color).slice(0, 3), [255, 255, 255]);
        for (const image of measured.images) {
          assert.equal(image.radius, '0px');
          assert.match(image.aspect, /^auto/, 'a gallery\'s crop on the page does not reach the image here');
          assert.ok(image.width <= measured.view.width && image.height <= measured.view.height);
          assert.ok(image.width > 0 && image.height > 0);
        }
        assert.deepEqual([measured.close.width, measured.close.height], [48, 48]);
        assert.deepEqual([measured.svg.width, measured.svg.height], [24, 24]);
        // Readable on the overlay, at its lightest: over a white page.
        assert.deepEqual(rgb(measured.backdrop), rgb(measured.overlay), 'the backdrop reads the root\'s overlay');
        const overlay = over(rgb(measured.overlay), [255, 255, 255]);
        assert.ok(Math.max(...overlay) < 40, 'a near-black overlay in both modes');
        assert.ok(ratio(rgb(measured.caption.color), overlay) >= 7);
        assert.ok(ratio(rgb(measured.close.color), rgb(measured.close.background)) >= 7);
        await page.close();
      });

      test(`text on what the core writes passes its contrast, ${mode}`, async () => {
        const page = await pageFor(browser, { mode });
        const found = await page.evaluate(() => {
          document.querySelector('.konzilo-consent-dialog').showModal();
          const solid = (element) => {
            for (let at = element; at; at = at.parentElement) {
              const color = getComputedStyle(at).backgroundColor;
              const channels = color.match(/[\d.]+/g).map(Number);
              if (channels.length === 3 || channels[3] === 1) return color;
            }
            return 'rgb(255, 255, 255)';
          };
          const selectors = ['.konzilo-consent-banner .konzilo-consent-title', '.konzilo-consent-text', '.konzilo-consent-banner a', '.konzilo-consent-banner .konzilo-consent-choice', '.konzilo-consent-banner .konzilo-consent-secondary', '.konzilo-consent-close', '.konzilo-consent-introduction', '.konzilo-consent-category-name', '.konzilo-consent-count', '.konzilo-consent-always', '.konzilo-consent-description', '.konzilo-consent-services summary', '.konzilo-consent-facts dt', '.konzilo-consent-facts a', '.konzilo-embed-question', '.konzilo-embed-storage', '.konzilo-embed-storage a', '.konzilo-embed-allow', '.konzilo-form-field label', '.konzilo-form-required', '.konzilo-form-help', '.konzilo-form-problem:not([hidden])', '.konzilo-form input[type="text"]', '.konzilo-form select', '.konzilo-form-invalid', '.konzilo-form-preview', '.konzilo-form-send', '.konzilo-form-send:disabled', '.konzilo-pager a:not([aria-current])', '.konzilo-pager a[aria-current]', '.konzilo-pager-gap', '.konzilo-declaration-no-script', '.konzilo-declaration-revised', '.konzilo-search-status', '.konzilo-search-about', '.konzilo-search-snippet mark', '.konzilo-search form button', '.kn-body-text figure:not(.konzilo-gallery, .konzilo-embed) figcaption', 'blockquote cite', '.kn-body-text pre code', '[data-footnotes] li'];
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
        await page.close();
      });
    }

    test('each state holds: what is hidden stays hidden, an outcome shows by its fragment, the trap is out of sight', async () => {
      const page = await pageFor(browser, { hash: '#konzilo-form-fixture-refused' });
      const states = await page.evaluate(() => {
        const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
        const trap = document.querySelector('.konzilo-form-trap').getBoundingClientRect();
        const asking = document.getElementById('fixture-embed-asking');
        const loaded = document.getElementById('fixture-embed-loaded');
        return {
          problem: display('.konzilo-form-problem[hidden]'),
          outcome: display('#konzilo-form-fixture-sent'),
          targeted: display('#konzilo-form-fixture-refused'),
          fields: display('#konzilo-form-sent-fixture .konzilo-form-fields'),
          withdraw: display('.konzilo-declaration [data-konzilo-consent-action="withdraw"]'),
          controls: display('#fixture-controls [data-konzilo-consent-action="withdraw"]'),
          choice: display('.konzilo-declaration-choice[hidden]'),
          none: display('.konzilo-declaration-none'),
          pages: display('.konzilo-search-pages[hidden]'),
          trap: { width: trap.width, height: trap.height },
          template: display('#fixture-embed-asking > template'),
          asking: { padding: getComputedStyle(asking).paddingBlockStart, height: asking.getBoundingClientRect().height },
          loaded: { padding: getComputedStyle(loaded).paddingBlockStart, background: getComputedStyle(loaded).backgroundColor, player: loaded.querySelector('iframe').getBoundingClientRect().height, width: loaded.getBoundingClientRect().width },
          noScript: getComputedStyle(document.querySelector('.konzilo-embed-no-script')).animationName,
          current: getComputedStyle(document.querySelector('.konzilo-pager a[aria-current]')).backgroundColor,
          invalid: getComputedStyle(document.querySelector('#fixture-email')).borderInlineStartColor,
          disabled: getComputedStyle(document.querySelector('#fixture-preview-name')).backgroundColor,
          sendDisabled: getComputedStyle(document.querySelector('#konzilo-form-preview-fixture .konzilo-form-send')).cursor,
        };
      });
      for (const key of ['problem', 'outcome', 'fields', 'withdraw', 'controls', 'choice', 'none', 'pages', 'template']) assert.equal(states[key], 'none', key);
      assert.equal(states.targeted, 'block');
      assert.ok(states.trap.width <= 1 && states.trap.height <= 1);
      assert.notEqual(states.asking.padding, '0px');
      assert.ok(states.asking.height >= 14 * 16);
      assert.equal(states.loaded.padding, '0px');
      assert.equal(rgb(states.loaded.background).at(-1), 0);
      assert.ok(Math.abs(states.loaded.player - (states.loaded.width * 9) / 16) < 2, 'the player has the panel to itself');
      assert.equal(states.noScript, 'konzilo-embed-late');
      assert.notEqual(rgb(states.current).at(-1), 0, 'the current page has its fill');
      assert.notEqual(states.invalid, 'rgb(0, 0, 0)');
      assert.equal(states.sendDisabled, 'default');
      await page.close();
    });

    test('secondary buttons are outlined and every target is one a finger can find', async () => {
      const page = await pageFor(browser);
      const found = await page.evaluate(() => {
        document.querySelector('.konzilo-consent-dialog').showModal();
        const size = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length).map((element) => ({ selector, height: element.getBoundingClientRect().height }));
        return {
          targets: ['.konzilo-consent-choice', '.konzilo-consent-secondary', '.konzilo-consent-close', '.konzilo-consent-switch', '.konzilo-consent-services summary', '#fixture-controls a', '.konzilo-form input[type="text"]', '.konzilo-form select', '.konzilo-form-choice', '.konzilo-form-send', '.konzilo-embed-allow', '.konzilo-pager a', '.konzilo-search form button', '.konzilo-search-box button'].flatMap(size),
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
      await page.close();
    });

    test('a slot of the Footer takes its cell\'s alignment: the policies stand as the links at the start, and the buttons as the links at the end', async () => {
      const settings = structuredClone(resolved.footer);
      settings.upper.cells = { a1: false, a2: false, b1: false, b2: false };
      settings.lower.cells = { a1: true, a2: true, b1: true, b2: true };
      const links = (label) => ({ links: [{ label: `${label} one`, href: '#one' }, { label: `${label} two`, href: '#two' }] });
      const footer = await render('Footer', footerFromDesign(settings, { lower: { a1: links('Start'), b1: links('End') } }), {
        // What `<ConsentControls slot="lower-a2" buttons={false} />` and `<ConsentControls slot="lower-b2" links={false} />` write.
        'lower-a2': '<div class="konzilo-consent-controls"><ul class="konzilo-consent-policies"><li><a href="#privacy">Privacy policy</a></li><li><a href="#cookies">Cookie policy</a></li></ul></div>',
        'lower-b2': '<div class="konzilo-consent-controls"><div class="konzilo-consent-buttons"><button type="button" class="konzilo-consent-secondary" data-konzilo-consent-action="change">Change privacy settings</button><button type="button" class="konzilo-consent-secondary" data-konzilo-consent-action="withdraw">Withdraw consent</button><button type="button" class="konzilo-consent-secondary" hidden>Not yet shown</button></div></div>',
      });
      const sheets = [coreCss(resolved), await componentsCss(), css, modal];
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
      const wide = await pageFor(browser, { sheets, body: footer });
      const atWide = await measure(wide);
      assert.ok(Math.abs(atWide.aSlot - atWide.aLink) < 1 && Math.abs(atWide.aSlot - atWide.aCell) < 1, `start: ${JSON.stringify(atWide)}`);
      assert.ok(Math.abs(atWide.bSlot - atWide.bCell) < 2 && Math.abs(atWide.bSlot - atWide.bLink) < 2, `end: ${JSON.stringify(atWide)}`);
      assert.ok(atWide.oneLine);
      assert.equal(rgb(atWide.button.background).at(-1), 0);
      assert.equal(atWide.button.shadow, 'none');
      assert.deepEqual([atWide.button.size, atWide.button.color, atWide.button.line], [atWide.link.size, atWide.link.color, atWide.link.line]);
      assert.equal(atWide.hidden, 'none');
      assert.equal(atWide.overflow, 0);
      await wide.close();
      // On a narrow screen one column, with every box at the start edge.
      const narrow = await pageFor(browser, { sheets, body: footer, viewport: { width: 390, height: 800 } });
      const atNarrow = await measure(narrow);
      assert.ok(Math.abs(atNarrow.aSlot - atNarrow.aLink) < 1);
      assert.ok(Math.abs(atNarrow.bSlotText + 0 - atNarrow.aSlot) < 24, `narrow: ${JSON.stringify(atNarrow)}`);
      assert.equal(atNarrow.overflow, 0);
      await narrow.close();
    });
  });
}
