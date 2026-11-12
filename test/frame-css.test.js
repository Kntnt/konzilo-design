// The header and the footer in HTML and CSS, in Gecko, WebKit and Chromium, with script and without (header.md and
// footer.md, How it is built). A browser that lacks scroll-driven animations or scroll-state queries gets a polyfill
// that sets the same flags; with script off it lacks only what the polyfill adds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { decodePng } from './helpers/ink.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { FOOTER_CELLS, layoutFooter } from '../src/components/footer.js';
import { footerHtml } from '../src/components/footer-html.js';

const ENGINES = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
const ORIGIN = 'http://kn.test';
const logo = (fill) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="16" fill="${fill}"/></svg>`)}`;
const identity = { label: 'Example', href: '#home', name: 'Example', slogan: 'A made-up slogan', logo: { light: logo('#222222'), dark: logo('#ffffff') } };
const menu = ['Products', 'Services', 'Markets', 'Knowledge'].map((label, i) => ({ label, href: `#m${i}`, linkMenu: i < 3, children: [{ label: `${label} one`, href: `#m${i}a` }] }));
const header = { identity, menu, linkMenu: true, menuButton: { word: 'Menu' }, languages: [{ label: 'English', code: 'en', href: '#en', current: true }, { label: 'Svenska', code: 'sv', href: '#sv' }], search: { action: '#search' }, cta: { label: 'Get in touch', href: '#contact' } };
const footer = { upper: { surface: 'brand', cells: { a1: { text: 'Example' }, b2: { links: [{ label: 'About', href: '#about' }] } } }, lower: { surface: 'inverse', cells: { a1: { text: 'Street 1' }, b2: { links: [{ label: 'Privacy', href: '#privacy' }] } } } };

async function pages() {
  const css = coreCss(derive(defaultInputs())) + await componentsCss();
  const band = async (i, surface) => render('Band', { surface, id: `b${i}` }, { default: `<h2>Band ${i}</h2><p>Some words in band ${i}.</p><p><a href="#b${i}">A link in band ${i}</a></p>` });
  const page = async (headerProps, footerProps = {}, count = 10) => {
    const bands = [];
    for (let i = 0; i < count; i++) bands.push(await band(i, i === 0 ? 'brand' : undefined));
    const body = await render('Page', {}, { header: await render('Header', { ...header, ...headerProps }), default: bands.join(''), footer: await render('Footer', { ...footer, ...footerProps }) });
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frame</title><style>${css}</style></head><body>${body}</body></html>`;
  };
  return {
    '/flow.html': await page({}),
    '/under.html': await page({ attachment: 'sticky', start: 'under' }),
    '/slides.html': await page({ attachment: 'sticky', start: 'under', autohide: true }),
    '/translucent.html': await page({ attachment: 'sticky', start: 'under', autohide: true, translucent: true }),
    '/translucent-below.html': await page({ attachment: 'sticky', translucent: true }),
    '/reveal.html': await page({ attachment: 'sticky' }, { attachment: 'reveal' }),
    // An inline logo, whose width is known as it is parsed; an image's is known only once it has loaded.
    '/painted.html': (await page({ identity: { ...identity, logo: { svg: '<svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="16" fill="currentColor"/></svg>' } } })).replace('</head>', `<script>window.steps=[];(function look(){var h=document.querySelector('.kn-header');steps.push(h?(h.dataset.knStep||'narrow'):'no header');if(steps.length<120)requestAnimationFrame(look)})();</script></head>`),
    '/long-name.html': await page({ identity: { label: 'A rather long made-up company name', href: '#home', name: 'A rather long made-up company name' } }),
    // The search box's settings: no heading with a magnifier in the field; no heading, no close button and no blur.
    '/search-bare.html': await page({ attachment: 'sticky', start: 'under', search: { action: '#search', heading: false, placeholder: 'icon' } }),
    '/search-plain.html': await page({ attachment: 'sticky', start: 'under', search: { action: '#search', heading: false, close: false, blur: false, placeholder: 'none' } }),
  };
}

async function open(type, files, script = true) {
  const browser = await type.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 700 }, javaScriptEnabled: script });
  const loaded = [];
  await context.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/_astro/')) {
      loaded.push(path.slice(8));
      return route.fulfill({ contentType: 'text/javascript', body: await readFile(new URL(`../src/components/${path.slice(8)}`, import.meta.url), 'utf8') });
    }
    return files[path] ? route.fulfill({ contentType: 'text/html', body: files[path] }) : route.fulfill({ status: 404 });
  });
  return { browser, tab: await context.newPage(), loaded };
}
const look = (tab) => tab.evaluate(() => {
  const head = document.querySelector('.kn-header');
  const bar = getComputedStyle(head.querySelector('.kn-header-bar'));
  return { top: Math.round(head.getBoundingClientRect().top), clear: bar.backgroundColor === 'rgba(0, 0, 0, 0)', text: bar.color, line: bar.borderBlockEndColor !== 'rgba(0, 0, 0, 0)' };
});
const scroll = async (tab, by) => { await tab.mouse.move(600, 400); await tab.mouse.wheel(0, by); await tab.waitForTimeout(700); };

test('a sticky header over the page\'s start is clear at the top, opaque and parted by its line after T, in every engine, loading a polyfill only where one is missing', { timeout: 240000 }, async () => {
  const files = await pages();
  const seen = {};
  for (const [name, type] of ENGINES) {
    const { browser, tab, loaded } = await open(type, files);
    try {
      await tab.goto(`${ORIGIN}/under.html`);
      await tab.waitForTimeout(300);
      const top = await look(tab);
      await scroll(tab, 400);
      const down = await look(tab);
      assert.equal(top.clear, true, `${name}: clear at the top`);
      assert.equal(top.line, false, `${name}: no line at the top`);
      assert.equal(down.clear, false, `${name}: opaque past T`);
      assert.equal(down.line, true, `${name}: a line, at shadow strength zero`);
      assert.equal(down.top, 0, `${name}: sticky`);
      seen[name] = { top, down };
      // The polyfill for scroll-driven animations loads where they are missing, and nothing else loads.
      const timelines = await tab.evaluate(() => CSS.supports('animation-timeline: scroll()'));
      assert.deepEqual(loaded.filter((file) => file !== 'header-fit.js'), timelines ? [] : ['scroll-timeline-polyfill.js'], `${name}: ${loaded}`);
      assert.ok(!loaded.includes('header-fit.js'), `${name}: the giving way's script is inline, not fetched`);
      await tab.goto(`${ORIGIN}/flow.html`);
      await tab.waitForTimeout(200);
      assert.deepEqual(loaded.filter((file) => file !== 'header-fit.js'), timelines ? [] : ['scroll-timeline-polyfill.js'], `${name}: a flow header loads no polyfill`);
    } finally { await browser.close(); }
  }
  const [first, ...rest] = Object.values(seen);
  for (const other of rest) assert.deepEqual(other, first, 'every engine looks the same');
});

test('a header that slides away does so on the way down and comes back on the way up, opaque, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  for (const [name, type] of ENGINES) {
    const { browser, tab, loaded } = await open(type, files);
    try {
      await tab.goto(`${ORIGIN}/slides.html`);
      await tab.waitForTimeout(300);
      await scroll(tab, 30);
      assert.deepEqual(await look(tab).then(({ top, clear }) => ({ top, clear })), { top: 0, clear: true }, `${name}: clear on its way down, before its own height`);
      await scroll(tab, 400);
      const away = await look(tab);
      assert.ok(away.top < 0 && away.clear, `${name}: away, still clear`);
      await scroll(tab, -40);
      assert.deepEqual(await look(tab).then(({ top, clear }) => ({ top, clear })), { top: 0, clear: false }, `${name}: back, opaque`);
      // An open panel keeps it.
      await tab.click('.kn-header-row [data-kn-trigger="menu"]');
      await tab.mouse.wheel(0, 300);
      await tab.waitForTimeout(500);
      assert.equal((await look(tab)).top, 0, `${name}: an open panel keeps it`);
      await tab.keyboard.press('Escape');
      const native = await tab.evaluate(() => [CSS.supports('animation-timeline: scroll()'), CSS.supports('container-type: scroll-state')]);
      assert.deepEqual(loaded.filter((file) => file !== 'header-fit.js').sort(), [native[0] ? [] : ['scroll-timeline-polyfill.js'], native[1] ? [] : ['scroll-state-polyfill.js']].flat().sort(), `${name}: ${loaded}`);
    } finally { await browser.close(); }
  }
});

test('the panels open, close and give focus back by pointer and keyboard, under the bar, with script and without, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  for (const [name, type] of ENGINES) {
    for (const script of [true, false]) {
      const { browser, tab } = await open(type, files, script);
      const what = `${name}${script ? '' : ' without script'}`;
      try {
        await tab.goto(`${ORIGIN}/under.html`);
        await scroll(tab, 600);
        const panel = () => tab.evaluate(() => {
          const open = document.querySelector('.kn-header-panel:is([open], :popover-open)');
          const bar = document.querySelector('.kn-header-bar').getBoundingClientRect();
          return open && { name: open.dataset.knPanel, top: Math.round(open.getBoundingClientRect().top), bar: Math.round(bar.bottom), locked: getComputedStyle(document.documentElement).overflow === 'hidden' };
        });
        const trigger = (kind) => `.kn-header-row [data-kn-trigger="${kind}"]`;
        await tab.click(trigger('menu'));
        // Once it has come in: it slides down into place.
        await tab.waitForTimeout(400);
        const megamenu = await panel();
        assert.deepEqual(megamenu, { name: 'menu', top: megamenu.bar, bar: megamenu.bar, locked: true }, `${what}: the megamenu hangs under the bar and locks the page`);
        await tab.keyboard.press('Escape');
        assert.equal(await panel(), null, `${what}: Esc closes it`);
        await tab.click(trigger('menu'));
        await tab.mouse.click(300, 30);
        assert.equal(await panel(), null, `${what}: a click outside it, on the bar, closes it`);
        // Without script the bar shows its narrowest step: the search field and the languages stand in the menu.
        if (!script) {
          await tab.click(trigger('menu'));
          assert.equal(await tab.evaluate(() => [...document.querySelectorAll('.kn-megamenu .kn-header-moved > *')].filter((node) => node.getClientRects().length).length), 3, `${what}: the menu holds the moved items`);
          await tab.keyboard.press('Escape');
        }
        if (script) {
        await tab.click(trigger('search'));
        assert.equal((await panel()).name, 'search');
        assert.equal(await tab.evaluate(() => document.activeElement.name), 'q', `${what}: focus moves to the field`);
        await tab.mouse.click(100, 600);
        assert.equal(await panel(), null, `${what}: a click beside the box closes it`);
        await tab.click(trigger('language'));
        await tab.waitForTimeout(400);
        const list = await tab.evaluate(() => {
          const globe = document.querySelector('.kn-header-row [data-kn-trigger="language"]').getBoundingClientRect();
          const box = document.querySelector('.kn-header-language-list').getBoundingClientRect();
          return { end: Math.round(box.right - globe.right), below: box.top > globe.bottom };
        });
        assert.deepEqual(list, { end: 0, below: true }, `${what}: the list hangs under the globe, its end on the globe's`);
        await tab.keyboard.press('Escape');
        }
        // By the keyboard: the button opens it, and Esc gives focus back to the button.
        await tab.focus(trigger('menu'));
        await tab.keyboard.press('Enter');
        assert.equal((await panel())?.name, 'menu', `${what}: Enter opens it`);
        await tab.keyboard.press('Escape');
        assert.equal(await tab.evaluate(() => document.activeElement.dataset.knTrigger), 'menu', `${what}: focus is back on the button`);
      } finally { await browser.close(); }
    }
  }
});

test('an open megamenu makes a header over the page\'s start opaque, and it is clear again once the menu closes, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  const seen = {};
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      await tab.goto(`${ORIGIN}/under.html`);
      await tab.waitForTimeout(300);
      const top = await look(tab);
      await tab.click('.kn-header-row [data-kn-trigger="menu"]');
      await tab.waitForTimeout(400);
      const opened = await look(tab);
      await tab.keyboard.press('Escape');
      await tab.waitForTimeout(100);
      const closed = await look(tab);
      assert.equal(top.clear, true, `${name}: clear at the top`);
      assert.equal(opened.clear, false, `${name}: opaque while the megamenu is open`);
      assert.notEqual(opened.text, top.text, `${name}: in its own colours, not the first band's`);
      assert.deepEqual(closed, top, `${name}: clear again once it closes`);
      seen[name] = { top, opened, closed };
    } finally { await browser.close(); }
  }
  const [first, ...rest] = Object.values(seen);
  for (const other of rest) assert.deepEqual(other, first, 'every engine looks the same');
});

test('a translucent header shows a hint of the page through its bar and its panels, blurred, and stays clear over the page\'s start, in every engine', { timeout: 240000 }, async () => {
  // The owner's hint of the page under the header and the megamenu (2026-11-12). Headless Firefox and WebKit paint no
  // backdrop-filter, so the blur is read from the computed style; the colours are the generator's checked ones.
  const files = await pages();
  const glass = (tab, selector) => tab.$eval(selector, (element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, blur: style.backdropFilter ?? style.webkitBackdropFilter, role: getComputedStyle(element).getPropertyValue('--kn-background-translucent').trim() };
  });
  const alpha = (colour) => Number(colour.match(/[\d.]+/g)[3] ?? 1);
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      await tab.goto(`${ORIGIN}/translucent.html`);
      await tab.waitForTimeout(300);
      const top = await glass(tab, '.kn-header-bar');
      assert.deepEqual([top.background, top.blur], ['rgba(0, 0, 0, 0)', 'none'], `${name}: clear over the page's start`);
      await scroll(tab, 300);
      await scroll(tab, -60);
      const past = await glass(tab, '.kn-header-bar');
      assert.ok(alpha(past.background) >= 0.85 && alpha(past.background) < 1, `${name}: a hint of the page through the bar, ${past.background}`);
      assert.match(past.blur, /blur\(16px\)/, `${name}: blurred`);
      await tab.click('.kn-header-row [data-kn-trigger="menu"]');
      await tab.waitForTimeout(400);
      const menu = await glass(tab, '.kn-megamenu');
      assert.ok(alpha(menu.background) >= 0.85 && alpha(menu.background) < 1 && /blur\(16px\)/.test(menu.blur), `${name}: and through the megamenu, ${menu.background}`);
      await tab.keyboard.press('Escape');
      // Below the header, opaque at once, and the same in the page's Surface as the role says.
      await tab.goto(`${ORIGIN}/translucent-below.html`);
      await tab.waitForTimeout(300);
      const below = await glass(tab, '.kn-header-bar');
      assert.ok(alpha(below.background) < 1 && /blur/.test(below.blur), `${name}: translucent from the start where the page starts below it`);
      await tab.goto(`${ORIGIN}/under.html`);
      await scroll(tab, 300);
      const opaque = await glass(tab, '.kn-header-bar');
      assert.deepEqual([alpha(opaque.background), opaque.blur], [1, 'none'], `${name}: a header that is not translucent stays opaque`);
    } finally { await browser.close(); }
  }
});

test('the search box fades and blurs the whole window behind it, the header bar included, and closes by Esc and by a click outside it with its close button or without, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  const trigger = '.kn-header-row [data-kn-trigger="search"]';
  const isOpen = (tab) => tab.evaluate(() => document.querySelector('.kn-header-search-overlay').open);
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      // The backdrop that blurs and the layer that fades lie over the whole window: what is under the bar's middle is
      // the dialog, not the bar. The fading layer is the page's background, fixed to the window, which a click passes.
      const behind = () => tab.evaluate(() => {
        const dialog = document.querySelector('.kn-header-search-overlay');
        const backdrop = getComputedStyle(dialog, '::backdrop');
        const fade = getComputedStyle(dialog, '::before');
        const bar = document.querySelector('.kn-header-bar').getBoundingClientRect();
        return {
          blur: [backdrop.position, backdrop.top, backdrop.width === `${innerWidth}px`, backdrop.backdropFilter],
          fade: [fade.position, fade.top, fade.left, fade.opacity, fade.pointerEvents],
          colour: fade.backgroundColor === getComputedStyle(document.documentElement).backgroundColor && fade.backgroundColor.match(/\d+/g).slice(0, 3).map(Number),
          overBar: document.elementFromPoint(bar.left + bar.width / 2, bar.top + bar.height / 2) === dialog,
        };
      });
      // A point of the bar with nothing on it, over the first band, as the screen shows it.
      const pixel = async () => [...decodePng(await tab.screenshot({ clip: { x: 500, y: 32, width: 1, height: 1 } })).pixels.subarray(0, 3)];
      await tab.goto(`${ORIGIN}/under.html`);
      await tab.waitForTimeout(300);
      const band = await pixel();
      await tab.click(trigger);
      await tab.waitForTimeout(400);
      const seen = await behind();
      assert.deepEqual(seen.blur, ['fixed', '0px', true, 'blur(12px)'], `${name}: the whole window blurred`);
      assert.deepEqual(seen.fade, ['fixed', '0px', '0px', '0.62', 'none'], `${name}: the whole window faded`);
      assert.ok(seen.colour, `${name}: in the page's colour`);
      assert.equal(seen.overBar, true, `${name}: the bar under it`);
      const faded = await pixel();
      faded.forEach((value, i) => assert.ok(Math.abs(value - (0.62 * seen.colour[i] + 0.38 * band[i])) <= 4, `${name}: the bar faded to ${faded}, from ${band} towards ${seen.colour}`));
      await tab.mouse.click(300, 30);
      assert.equal(await isOpen(tab), false, `${name}: a click on the bar closes it`);

      // No heading: the close button keeps its room above the field, and the field shows a magnifier until typed in.
      await tab.goto(`${ORIGIN}/search-bare.html`);
      await tab.click(trigger);
      await tab.waitForTimeout(400);
      const field = () => tab.evaluate(() => {
        const box = document.querySelector('.kn-header-search-overlay');
        const input = box.querySelector('input[name="q"]');
        const icon = box.querySelector('.kn-search-field > .kn-icon');
        const close = box.querySelector('.kn-header-search-close')?.getBoundingClientRect();
        const middle = (rect) => rect.top + rect.height / 2;
        return { room: close ? input.getBoundingClientRect().top - close.bottom : null, word: input.getAttribute('placeholder'), icon: icon && getComputedStyle(icon).display !== 'none', centred: icon ? Math.abs(middle(icon.getBoundingClientRect()) - middle(input.getBoundingClientRect())) < 1 : null };
      });
      const empty = await field();
      assert.ok(empty.room >= 8, `${name}: the field begins ${empty.room}px under the close button`);
      assert.deepEqual([empty.word, empty.icon, empty.centred], [' ', true, true], `${name}: a magnifier in the empty field`);
      await tab.keyboard.type('walks');
      assert.equal((await field()).icon, false, `${name}: the magnifier goes as the visitor types`);
      await tab.keyboard.press('Escape');

      // No close button, no blur: Esc closes it and gives focus back to the magnifier, and so does a click beside it.
      await tab.goto(`${ORIGIN}/search-plain.html`);
      await tab.focus(trigger);
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(400);
      assert.equal(await tab.evaluate(() => !document.querySelector('.kn-header-search-close') && document.activeElement.name), 'q', `${name}: no close button, and focus in the field`);
      assert.deepEqual(await behind().then(({ blur, fade, overBar }) => [blur[3], fade[3], overBar]), ['none', '0.62', true], `${name}: only faded, the bar too`);
      assert.equal(await tab.evaluate(() => document.querySelector('.kn-header-search-overlay input[name="q"]').hasAttribute('placeholder')), false, `${name}: nothing in the field`);
      await tab.keyboard.press('Escape');
      assert.deepEqual([await isOpen(tab), await tab.evaluate(() => document.activeElement.dataset.knTrigger)], [false, 'search'], `${name}: Esc closes it, focus on the magnifier`);
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(400);
      await tab.mouse.click(100, 600);
      assert.deepEqual([await isOpen(tab), await tab.evaluate(() => document.activeElement.dataset.knTrigger)], [false, 'search'], `${name}: a click beside the box closes it, focus on the magnifier`);
      await tab.keyboard.press('Enter');
      await tab.waitForTimeout(400);
      await tab.mouse.click(300, 30);
      assert.equal(await isOpen(tab), false, `${name}: and a click on the bar`);
    } finally { await browser.close(); }
  }
});

test('a footer at the edge of the screen lies under the page while it fits in the window, and is in the flow when it does not or without script', { timeout: 300000 }, async () => {
  const files = await pages();
  for (const [name, type] of ENGINES) {
    for (const script of [true, false]) {
      const { browser, tab, loaded } = await open(type, files, script);
      const what = `${name}${script ? '' : ' without script'}`;
      try {
        await tab.goto(`${ORIGIN}/reveal.html`);
        if (script) assert.ok(loaded.includes('footer-fit.js'), `${what}: the footer loads its script`);
        const height = await tab.evaluate(() => document.querySelector('.kn-footer').getBoundingClientRect().height);
        // The window a pixel taller than the footer, as tall, and a pixel shorter; the page scrolled so that the footer's
        // place in the flow starts 40px above the window's bottom edge.
        for (const [room, fits] of [[Math.ceil(height) + 1, true], [Math.ceil(height), true], [Math.floor(height) - 1, false]]) {
          await tab.setViewportSize({ width: 1280, height: room });
          await tab.waitForTimeout(150);
          const seen = await tab.evaluate(() => {
            const footer = document.querySelector('.kn-footer');
            const main = document.querySelector('.kn-page-main');
            scrollTo(0, main.getBoundingClientRect().bottom + scrollY - innerHeight + 40);
            const box = footer.getBoundingClientRect();
            return { bottom: Math.round(box.bottom), top: Math.round(box.top), place: Math.round(main.getBoundingClientRect().bottom), window: innerHeight, fit: footer.dataset.knFit ?? null };
          });
          if (script && fits) assert.equal(seen.bottom, seen.window, `${what}, a window of ${room}px for ${height}px: the footer lies still at the window's bottom edge`);
          else assert.equal(seen.top, seen.place, `${what}, a window of ${room}px for ${height}px: the footer is in the flow`);
          assert.equal(seen.fit, script ? String(fits) : null, `${what}: data-kn-fit`);
        }
        if (!script) continue;
        await tab.setViewportSize({ width: 1280, height: 700 });
        await tab.evaluate(() => scrollTo(0, 0));
        await tab.focus('#b9 a');
        await tab.keyboard.press(name === 'webkit' ? 'Alt+Tab' : 'Tab');
        const focus = await tab.evaluate(() => {
          const node = document.activeElement;
          const box = node.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + 2, box.top + 2);
          return { inFooter: !!node.closest('.kn-footer'), seen: node === hit || node.contains(hit), inside: box.top >= 0 && box.bottom <= innerHeight };
        });
        assert.deepEqual(focus, { inFooter: true, seen: true, inside: true }, `${what}: focus in the footer is shown, not under the page`);
      } finally { await browser.close(); }
    }
  }
});

test('on a phone the upper band stacks column by column and the lower band row by row, in document order, and the wide footer lies as before, in every engine', { timeout: 240000 }, async () => {
  // Every combination of cells under both fills, each written twice: as the footer writes it now, and with its cells
  // in the old order, column by column. Wide, the two must lie alike to the pixel; narrow, the lower band stacks row by
  // row (the owner, 2026-11-11).
  const words = { a1: '12 Example Street, 123 45 Sampleton', b1: 'Registration no. 000000-0000. Registered office: Sampleton, a little longer.', a2: 'Cookie policy and privacy policy', b2: 'Change privacy settings, revoke consents' };
  const combos = [];
  for (let bits = 1; bits < 16; bits++) for (const fill of ['column', 'row']) combos.push({ names: FOOTER_CELLS.filter((_, i) => bits & (1 << i)), fill });
  const footers = combos.map(({ names, fill }, i) => {
    const band = (upper) => ({ surface: upper ? 'brand' : 'inverse', cells: Object.fromEntries(names.map((name) => [name, { text: `${upper ? 'Upper' : 'Lower'} ${name}: ${words[name]}` }])) });
    const props = { upper: band(true), lower: band(false), fill, horizontalRules: true, verticalRule: true };
    const now = layoutFooter(props);
    const before = structuredClone(now);
    for (const each of before.bands) each.cells.sort((one, other) => FOOTER_CELLS.indexOf(one.name) - FOOTER_CELLS.indexOf(other.name));
    return `<section data-combo="${i}"><div data-written="now">${footerHtml(now)}</div><div data-written="before">${footerHtml(before)}</div></section>`;
  });
  const css = coreCss(derive(defaultInputs())) + await componentsCss();
  const files = { '/stacking.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stacking</title><style>${css}</style></head><body>${footers.join('')}</body></html>` };
  const read = (tab) => tab.evaluate(() => [...document.querySelectorAll('section[data-combo]')].map((section) => Object.fromEntries(['now', 'before'].map((written) => {
    const footer = section.querySelector(`[data-written="${written}"] .kn-footer`);
    const top = footer.getBoundingClientRect().top;
    return [written, [...footer.querySelectorAll('.kn-footer-band')].map((band) => ({
      band: band.dataset.knBand,
      written: [...band.querySelectorAll('.kn-footer-cell')].map((cell) => cell.dataset.knCell),
      seen: [...band.querySelectorAll('.kn-footer-cell')].sort((one, other) => one.getBoundingClientRect().top - other.getBoundingClientRect().top).map((cell) => cell.dataset.knCell),
      boxes: Object.fromEntries([...band.querySelectorAll('.kn-footer-cell, .kn-footer-rule, .kn-footer-vertical-rule')].map((node, j) => {
        const box = node.getBoundingClientRect();
        return [node.dataset.knCell ?? `line-${j}`, [box.left, box.top - top, box.width, box.height].map((value) => Math.round(value * 100) / 100)];
      })),
    }))];
  }))));
  const seen = {};
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      await tab.goto(`${ORIGIN}/stacking.html`);
      for (const width of [1280, 820]) {
        await tab.setViewportSize({ width, height: 800 });
        await tab.waitForTimeout(100);
        (await read(tab)).forEach(({ now, before }, i) => {
          const what = `${name} at ${width}px, [${combos[i].names.join(' ')}] ${combos[i].fill}`;
          assert.deepEqual(now.map((band) => Object.entries(band.boxes).filter(([key]) => !key.startsWith('line')).sort()), before.map((band) => Object.entries(band.boxes).filter(([key]) => !key.startsWith('line')).sort()), `${what}: each cell where it was`);
          assert.deepEqual(now.map((band) => Object.entries(band.boxes).filter(([key]) => key.startsWith('line')).map(([, box]) => box).sort()), before.map((band) => Object.entries(band.boxes).filter(([key]) => key.startsWith('line')).map(([, box]) => box).sort()), `${what}: each line where it was`);
        });
      }
      await tab.setViewportSize({ width: 390, height: 800 });
      await tab.waitForTimeout(100);
      (await read(tab)).forEach(({ now }, i) => {
        const { names, fill } = combos[i];
        const what = `${name} at 390px, [${names.join(' ')}] ${fill}`;
        const [upper, lower] = now;
        assert.deepEqual(upper.seen, ['a1', 'a2', 'b1', 'b2'].filter((cell) => names.includes(cell)), `${what}: the upper band column by column`);
        assert.deepEqual(lower.seen, ['a1', 'b1', 'a2', 'b2'].filter((cell) => names.includes(cell)), `${what}: the lower band row by row`);
        for (const band of now) assert.deepEqual(band.written, band.seen, `${what}: written as it stacks`);
      });
      seen[name] = await read(tab);
    } finally { await browser.close(); }
  }
  const orders = (all) => all.map(({ now }) => now.map((band) => band.seen));
  const [first, ...rest] = Object.values(seen);
  for (const other of rest) assert.deepEqual(orders(other), orders(first), 'every engine stacks alike');
});

test('the bar gives way in order as the window narrows, never overflows, and comes back as it widens, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  const order = ['slogan', 'name', 'links', 'word', 'language', 'cta', 'search'];
  const named = {};
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      await tab.goto(`${ORIGIN}/flow.html`);
      named[name] = {};
      await tab.waitForFunction(() => document.querySelector('.kn-header').dataset.knStep);
      for (let width = 320; width <= 1600; width += 40) {
        await tab.setViewportSize({ width, height: 700 });
        // The script measures when the browser says the window has changed, which WebKit says a little later.
        await tab.waitForTimeout(150);
        const { gone, over, scroll } = await tab.evaluate(() => {
          const row = document.querySelector('.kn-header-row');
          const shown = (selector) => !!row.querySelector(selector)?.getClientRects().length;
          const gone = Object.entries({ slogan: '.kn-header-slogan', name: '.kn-brand-name', links: '.kn-header-link-menu', word: '.kn-header-menu-word', language: '.kn-header-group > .kn-header-language', cta: '.kn-header-group > .kn-header-cta', search: '.kn-header-group > .kn-header-search-trigger' }).filter(([, selector]) => !shown(selector)).map(([step]) => step);
          const inner = document.querySelector('.kn-header-inner').getBoundingClientRect();
          const groups = [...row.querySelectorAll(':scope > .kn-header-group')].map((group) => group.getBoundingClientRect());
          return { gone, over: Math.max(...groups.map((box) => box.right)) - inner.right, scroll: document.documentElement.scrollWidth > innerWidth };
        });
        assert.deepEqual(gone, order.slice(0, gone.length), `${name} at ${width}: the steps are taken in order`);
        assert.ok(over <= 0.01 && !scroll, `${name} at ${width}: the bar overflows by ${over}`);
        if ([360, 760, 1040, 1440].includes(width)) named[name][width] = gone.join(' ');
      }
      // Wide again, the whole bar is back, and the menu holds no moved item.
      await tab.setViewportSize({ width: 1600, height: 700 });
      await tab.waitForTimeout(150);
      assert.equal(await tab.evaluate(() => getComputedStyle(document.querySelector('.kn-header-row .kn-header-moved')).display), 'none', name);
      // Narrow, what went from the bar stands at the menu's top. The menu is closed, so its parts are read from style.
      await tab.setViewportSize({ width: 320, height: 700 });
      const moved = await tab.evaluate(() => [...document.querySelectorAll('.kn-header-row .kn-header-moved > *')].filter((node) => getComputedStyle(node).display !== 'none').map((node) => node.dataset.knMoved));
      const left = await tab.evaluate(() => ['search', 'language', 'cta'].filter((item) => !document.querySelector(`.kn-header-row .kn-header-group > .kn-header-${item === 'search' ? 'search-trigger' : item}`).getClientRects().length));
      assert.ok(left.length > 0, `${name}: something has moved at 320`);
      assert.deepEqual(moved, ['search', 'language', 'cta'].filter((item) => left.includes(item)), `${name}: what went from the bar stands at the menu's top`);
    } finally { await browser.close(); }
  }
  const [first, ...rest] = Object.values(named);
  for (const other of rest) assert.deepEqual(other, first, 'every engine gives way alike at the widths that matter');
});

test('at 20rem the last resort wraps a long name to two lines, never cut, with the menu button in the bar, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  const seen = {};
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      await tab.setViewportSize({ width: 320, height: 600 });
      await tab.goto(`${ORIGIN}/long-name.html`);
      await tab.waitForFunction(() => document.querySelector('.kn-header').dataset.knStep);
      seen[name] = await tab.evaluate(() => {
        const row = document.querySelector('.kn-header-row');
        const inner = document.querySelector('.kn-header-inner').getBoundingClientRect();
        const button = row.querySelector('.kn-header-menu-button').getBoundingClientRect();
        const words = row.querySelector('.kn-brand-name > span');
        const bar = document.querySelector('.kn-header-bar').getBoundingClientRect();
        const box = words.getBoundingClientRect();
        const lines = Math.round(box.height / parseFloat(getComputedStyle(words).lineHeight));
        return { scale: getComputedStyle(row).getPropertyValue('--kn-header-identity-scale'), button: button.right <= inner.right + 0.01, lines, whole: words.scrollWidth <= words.clientWidth + 0.5 && box.top >= bar.top && box.bottom <= bar.bottom, size: Math.round(parseFloat(getComputedStyle(words).fontSize)) };
      });
      assert.deepEqual(seen[name], { scale: '0.8', button: true, lines: 2, whole: true, size: 15 }, name);
    } finally { await browser.close(); }
  }
});

test('without script the header shows its narrowest step, and its panels and identity still work, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files, false);
    try {
      for (const [file, width] of [['flow.html', 1600], ['flow.html', 320], ['long-name.html', 320]]) {
        await tab.setViewportSize({ width, height: 700 });
        await tab.goto(`${ORIGIN}/${file}`);
        const seen = await tab.evaluate(() => {
          const row = document.querySelector('.kn-header-row');
          const shown = [...row.querySelectorAll(':scope > .kn-header-group > *')].filter((node) => node.getClientRects().length).map((node) => node.className.split(' ').find((name) => /^kn-header-(identity|menu-button|link-menu|cta|language|search-trigger)$/.test(name)));
          const inner = document.querySelector('.kn-header-inner').getBoundingClientRect();
          const button = row.querySelector('.kn-header-menu-button').getBoundingClientRect();
          return { step: document.querySelector('.kn-header').dataset.knStep ?? null, shown, button: button.right <= inner.right + 0.01 };
        });
        assert.deepEqual(seen, { step: null, shown: ['kn-header-identity', 'kn-header-menu-button'], button: true }, `${name}, ${file} at ${width}px`);
      }
      await tab.click('.kn-header-row [data-kn-trigger="menu"]');
      assert.equal(await tab.evaluate(() => document.querySelector('.kn-megamenu').open), true, `${name}: the menu opens`);
      assert.deepEqual(await tab.evaluate(() => [...document.querySelectorAll('.kn-megamenu .kn-header-moved > *')].filter((node) => node.getClientRects().length).map((node) => node.dataset.knMoved)), ['search', 'language', 'cta'], `${name}: with everything that is not in the bar`);
    } finally { await browser.close(); }
  }
});

test('the header has its step before the page first paints, wide or narrow, in every engine', { timeout: 240000 }, async () => {
  const files = await pages();
  for (const [name, type] of ENGINES) {
    for (const width of [1440, 390]) {
      const { browser, tab } = await open(type, files);
      try {
        await tab.setViewportSize({ width, height: 800 });
        await tab.goto(`${ORIGIN}/painted.html`);
        await tab.waitForTimeout(800);
        // Each animation frame notes the step before it paints: none may paint without one, or with another.
        const steps = (await tab.evaluate(() => window.steps)).filter((step) => step !== 'no header');
        assert.ok(steps.length > 0, name);
        assert.deepEqual([...new Set(steps)], [steps.at(-1)], `${name} at ${width}px: ${[...new Set(steps)]}`);
        assert.notEqual(steps.at(-1), 'narrow', name);
      } finally { await browser.close(); }
    }
  }
});

// A shadow does not show on a dark page, so in dark mode the header, its open menu and the page over the footer keep
// their hairline beside the shadow (owner, 2026-11-11). And at the top, before anything lies under it, a header casts no
// shadow, so a first band of its own colour is parted from it by the line in either mode.
test('in dark mode a hairline stands with every shadow, and a header at the top keeps its line over a band of its colour, in every engine', { timeout: 240000 }, async () => {
  const inputs = defaultInputs();
  inputs.shadow.strength = 60;
  const css = coreCss(derive(inputs)) + await componentsCss();
  const bands = [];
  for (let i = 0; i < 8; i++) bands.push(await render('Band', { id: `b${i}` }, { default: `<h2>Band ${i}</h2><p>Some words in band ${i}.</p>` }));
  const body = await render('Page', { shadow: true }, { header: await render('Header', { ...header, attachment: 'sticky' }), default: bands.join(''), footer: await render('Footer', footer) });
  const doc = (mode) => `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><title>Lines</title><style>${css}</style></head><body>${body}</body></html>`;
  const files = { '/light.html': doc('light'), '/dark.html': doc('dark') };
  const edges = (tab) => tab.evaluate(() => {
    const bar = getComputedStyle(document.querySelector('.kn-header-bar'));
    return { shadow: bar.boxShadow !== 'none', line: bar.borderBlockEndColor !== 'rgba(0, 0, 0, 0)', page: getComputedStyle(document.querySelector('.kn-page-main')).borderBlockEndStyle };
  });
  for (const [name, type] of ENGINES) {
    const { browser, tab } = await open(type, files);
    try {
      for (const mode of ['light', 'dark']) {
        const dark = mode === 'dark';
        await tab.goto(`${ORIGIN}/${mode}.html`);
        await tab.waitForTimeout(300);
        const top = await edges(tab);
        assert.deepEqual([top.shadow, top.line], [false, true], `${name} ${mode}: at the top no shadow, and a line over the first band of its colour`);
        await scroll(tab, 400);
        const down = await edges(tab);
        assert.deepEqual([down.shadow, down.line], [true, dark], `${name} ${mode}: over content the shadow, and the line only in dark mode`);
        assert.equal(down.page, dark ? 'solid' : 'none', `${name} ${mode}: the page's edge over the footer`);
        await tab.locator('[data-kn-trigger="menu"]').first().click();
        await tab.waitForTimeout(300);
        const menu = await tab.evaluate(() => getComputedStyle(document.querySelector('.kn-megamenu')).borderBlockEndStyle);
        assert.equal(menu, dark ? 'solid' : 'none', `${name} ${mode}: the open menu's lower edge`);
        await tab.keyboard.press('Escape');
      }
    } finally { await browser.close(); }
  }
});
