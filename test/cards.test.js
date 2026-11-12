// Cards in the browser, in every engine Playwright has here: the links of a Content Loop in body text, which keep their
// own look as a Card's do, an eyebrow that stands closer to its heading than the heading to what follows it, and one
// behaviour under the pointer for every card that leads somewhere.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { render } from './helpers/render.js';

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const browsers = [];
let components, markup;
before(async () => {
  components = await componentsCss();
  const items = [{ title: 'A note on the river', href: '#a', meta1: [{ text: 'Walks' }], excerpt: 'Where the path meets the water.' }, { title: 'Tools for the bench', href: '#b' }];
  const rows = await render('ContentLoop', { id: 'loop-rows', presentation: 'rows', images: false, items });
  const cards = await render('ContentLoop', { id: 'loop-cards', presentation: 'cards', images: false, surface: 'raised', items });
  const eyebrowed = await render('Card', { id: 'eyebrowed', surface: 'raised', eyebrow: 'Field notes', heading: 'A walk by the river', text: 'Where the path meets the water.', href: '#d' });
  const linked = await render('Card', { id: 'linked', surface: 'raised', heading: 'Plans', text: 'Where this page leads.', href: '#e' });
  const open = await render('Card', { id: 'open', heading: 'Plans', text: 'Where this page leads.', href: '#f' });
  const teaser = await render('ContentLoop', { id: 'teaser', presentation: 'cards', images: false, surface: 'raised', items: [{ title: 'A walk by the river', href: '#g' }] });
  const group = await render('HeadingGroup', { id: 'grouped', eyebrow: 'Field notes', heading: 'A walk by the river', deck: 'Where the path meets the water.' });
  markup = `<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text">
    <p>A paragraph with <a id="body-link" href="#c">a link of its own</a>.</p>${rows}${cards}</div></div></section>
    <section class="kn-band"><div class="kn-band-content">${group}<div class="kn-card-grid" data-kn-columns="3">${eyebrowed}${linked}${open}</div>${teaser}</div></section>`;
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

async function page(browser, inputs = defaultInputs(), options = {}) {
  const tab = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
  await tab.setContent(`<!doctype html><html lang="en"><head><style>${coreCss(derive(inputs))}${components}</style></head><body data-kn-surface="page"><div class="kn-page">${markup}</div></body></html>`);
  return tab;
}
const looks = (tab, selector) => tab.$eval(selector, (element) => ({ color: getComputedStyle(element).color, line: getComputedStyle(element).textDecorationLine, text: getComputedStyle(element.closest('.kn-band')).color }));

test('a Content Loop in body text keeps its own links: its titles are not drawn as body links', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    const body = await looks(tab, '#body-link');
    assert.equal(body.line, 'underline', `${name}: a body link is underlined`);
    for (const loop of ['loop-rows', 'loop-cards']) {
      const title = await looks(tab, `#${loop} .kn-content-link`);
      assert.deepEqual([title.color, title.line], [title.text, 'none'], `${name}: ${loop}'s title is in the text colour, not underlined`);
      await tab.hover(`#${loop} .kn-content-link`);
      const hovered = await looks(tab, `#${loop} .kn-content-link`);
      assert.deepEqual([hovered.color, hovered.line], [body.color, 'underline'], `${name}: ${loop}'s title turns link and underlined under the pointer`);
      await tab.mouse.move(0, 0);
    }
    await tab.close();
  }
});

test('an eyebrow stands closer to its heading than the heading to what follows it, in a heading group and in a card', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await page(browser);
    for (const [scope, eyebrow, heading, next] of [['#grouped', '.kn-heading-group-eyebrow', '.kn-heading-group-heading', '.kn-heading-group-deck'], ['#eyebrowed', '.kn-card-eyebrow', '.kn-card-heading', '.kn-card-text']]) {
      const [above, below] = await tab.$eval(scope, (root, [a, b, c]) => {
        const box = (selector) => root.querySelector(selector).getBoundingClientRect();
        return [box(b).top - box(a).bottom, box(c).top - box(b).bottom];
      }, [eyebrow, heading, next]);
      assert.ok(above >= 0 && above < below / 1.5, `${name}: ${scope} has ${above}px above its heading and ${below}px below it`);
    }
    await tab.close();
  }
});

// The shadows on, at the reference positions.
const shadows = () => { const inputs = defaultInputs(); inputs.shadow.strength = 50; inputs.shadow.hardness = 20; return inputs; };
async function hovered(tab, selector, part) {
  const look = () => tab.$eval(selector, (card, part) => ({ top: card.getBoundingClientRect().top + scrollY, shadow: getComputedStyle(card).boxShadow, line: getComputedStyle(card.querySelector(part)).textDecorationLine, arrow: card.querySelector('.kn-card-arrow')?.getBoundingClientRect().left ?? null }), part);
  await tab.mouse.move(0, 0);
  await tab.waitForTimeout(300);
  const before = await look();
  await tab.hover(`${selector} ${part}`);
  await tab.waitForTimeout(300);
  return [before, await look()];
}

test('every card that leads somewhere underlines its heading and, where it casts a shadow, rises a hair with its shadow; its mark stays still', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    let tab = await page(browser, shadows());
    for (const [selector, part] of [['#linked', '.kn-card-link'], ['#teaser .kn-content-card', '.kn-content-link']]) {
      const [rest, under] = await hovered(tab, selector, part);
      assert.equal(under.line, 'underline', `${name}: ${selector}'s heading is underlined`);
      assert.equal(Math.round((rest.top - under.top) * 100) / 100, 2, `${name}: ${selector} rises 0.125rem`);
      assert.notEqual(under.shadow, rest.shadow, `${name}: ${selector}'s shadow lifts with it`);
      assert.equal(under.arrow === null ? null : under.arrow - (rest.arrow ?? 0), rest.arrow === null ? null : 0, `${name}: ${selector}'s mark stays still`);
    }
    // Without a Surface a card casts no shadow, and does not move.
    const [open, openUnder] = await hovered(tab, '#open', '.kn-card-link');
    assert.deepEqual([openUnder.line, openUnder.top], ['underline', open.top], `${name}: an open card is underlined and stays`);
    await tab.close();
    // A design without shadows: the heading is underlined, and nothing moves.
    tab = await page(browser);
    const [flat, flatUnder] = await hovered(tab, '#linked', '.kn-card-link');
    assert.deepEqual([flatUnder.line, flatUnder.top], ['underline', flat.top], `${name}: no shadow, no rise`);
    await tab.close();
    // Reduced motion: no rise, but the shadow still lifts.
    tab = await page(browser, shadows(), { reducedMotion: 'reduce' });
    const [still, stillUnder] = await hovered(tab, '#linked', '.kn-card-link');
    assert.equal(stillUnder.top, still.top, `${name}: with reduced motion the card does not move`);
    assert.notEqual(stillUnder.shadow, still.shadow, `${name}: and its shadow lifts`);
    await tab.close();
  }
});

// Issue #1 (the owner, 2026-11-12): the two arrows outside a card stand still under the pointer and on a press, as a
// card's mark does, and their word is underlined instead.
test('a Button\'s arrow and the lone action after a series keep their arrow still under the pointer and on a press, and underline their word', { timeout: 120000 }, async () => {
  const arrow = await render('Button', { href: '#more', variant: 'arrow', id: 'arrow' }, { default: 'See every plan' });
  const series = `<div class="kn-card-grid kn-cards"><article class="kn-card"><h3 class="kn-card-heading">One</h3></article><article class="kn-card"><h3 class="kn-card-heading">Two</h3></article></div><ul class="kn-actions" role="list"><li><a class="kn-action" id="more" href="#all" data-kn-main>All plans</a></li></ul>`;
  for (const [name, browser] of browsers) for (const dir of ['ltr', 'rtl']) {
    const tab = await browser.newPage({ viewport: { width: 1024, height: 700 } });
    await tab.setContent(`<!doctype html><html lang="en" dir="${dir}"><head><style>${coreCss(derive(defaultInputs()))}${components}</style></head><body data-kn-surface="page"><section class="kn-band"><div class="kn-band-content"><div class="kn-link-group">${arrow}</div></div></section><section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text">${series}</div></div></section></body></html>`);
    const look = () => tab.evaluate(() => {
      const button = document.getElementById('arrow'), more = document.getElementById('more');
      return {
        arrow: button.querySelector('.kn-button-arrow').getBoundingClientRect().left, arrowLine: getComputedStyle(button).textDecorationLine,
        more: getComputedStyle(more, '::after').transform, moreLine: getComputedStyle(more).textDecorationLine,
        moreBox: more.getBoundingClientRect().right,
      };
    });
    const rest = await look();
    assert.deepEqual([rest.arrowLine, rest.moreLine], ['none', 'none'], `${name} ${dir}: no line at rest`);
    for (const [id, line, still] of [['#arrow', 'arrowLine', 'arrow'], ['#more', 'moreLine', 'more']]) {
      await tab.hover(id);
      await tab.waitForTimeout(400);
      const under = await look();
      assert.equal(under[line], 'underline', `${name} ${dir}: ${id}'s word is underlined under the pointer`);
      assert.equal(under[still], rest[still], `${name} ${dir}: ${id}'s arrow stands still under the pointer`);
      await tab.mouse.down();
      await tab.waitForTimeout(400);
      const pressed = await look();
      assert.equal(pressed[still], rest[still], `${name} ${dir}: ${id}'s arrow stands still on a press`);
      assert.equal(pressed[line], 'underline', `${name} ${dir}: ${id}'s word is underlined on a press`);
      await tab.mouse.up();
      await tab.mouse.move(0, 0);
    }
    await tab.close();
  }
});
