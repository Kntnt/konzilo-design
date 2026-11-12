// Sections, the hero's additions, text roles, the trail and an article's opening (docs/spec/directives.md): the module's
// pure functions, and the fixture's markup in every engine Playwright has here, laid out by the real stylesheet.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parse } from 'ultrahtml';
import { querySelectorAll as all } from 'ultrahtml/selector';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { sectionParts, DECK_LINE, surfaceOf, iconHtml } from '../src/directives/index.js';
import { icons } from '../src/components/icons.js';

const blocks = (...kinds) => kinds.map((kind) => (typeof kind === 'string' ? { kind, text: kind === 'paragraph' ? 'A short paragraph.' : undefined } : kind));

test('sectionParts groups media, head, deck and body by the rules of the contract', () => {
  assert.deepEqual(sectionParts(blocks('picture', 'picture', 'eyebrow', 'heading', 'paragraph', 'actions', 'other')),
    { media: [0, 1], head: [2, 3, 4, 5], deck: 4, body: [6], deckLong: false });
  // Nothing but paragraphs after the heading: no deck.
  assert.deepEqual(sectionParts(blocks('heading', 'paragraph', 'paragraph')), { media: [], head: [0], deck: null, body: [1, 2], deckLong: false });
  assert.deepEqual(sectionParts(blocks('heading', 'paragraph')).deck, null);
  // A form or a choice among the section's blocks: no deck.
  assert.deepEqual(sectionParts(blocks('heading', 'paragraph', 'form')), { media: [], head: [0], deck: null, body: [1, 2], deckLong: false });
  assert.equal(sectionParts(blocks('heading', 'paragraph', 'other', 'choice')).deck, null);
  // Actions right after the heading join the head; after something else they stand in the body.
  assert.deepEqual(sectionParts(blocks('heading', 'actions', 'paragraph', 'form')).head, [0, 1]);
  assert.deepEqual(sectionParts(blocks('heading', 'paragraph', 'actions', 'form')).body, [1, 2, 3]);
  // Eyebrows not followed by a heading are labels in the body, and there is no head.
  assert.deepEqual(sectionParts(blocks('eyebrow', 'paragraph', 'heading')), { media: [], head: [], deck: null, body: [0, 1, 2], deckLong: false });
  assert.deepEqual(sectionParts(blocks('paragraph', 'picture')), { media: [], head: [], deck: null, body: [0, 1], deckLong: false });
  assert.deepEqual(sectionParts([]), { media: [], head: [], deck: null, body: [], deckLong: false });
});

test('a deck is long when its text, its white space collapsed, passes DECK_LINE', () => {
  assert.equal(DECK_LINE, 70);
  const deck = (text) => sectionParts([{ kind: 'heading' }, { kind: 'paragraph', text }, { kind: 'other' }]).deckLong;
  assert.equal(deck('a'.repeat(70)), false);
  assert.equal(deck('a'.repeat(71)), true);
  assert.equal(deck(`  ${'word '.repeat(13)}word\n\n   `), false);
  assert.equal(deck(`${'word  \n '.repeat(14)}word`), true);
});

test('surfaceOf gives each part its plate, and another on a ground of the same kind', () => {
  const table = { 'link-card': ['raised', 'page'], 'action-card': ['tint', 'raised'], 'behind-card': ['picture-dark', 'picture-dark'], 'fact-box': ['tint', 'raised'], 'choice-answer': ['raised', 'page'], 'choice-panel': ['raised', 'page'] };
  for (const [part, [surface, same]] of Object.entries(table)) {
    assert.equal(surfaceOf(part, undefined), surface, part);
    assert.equal(surfaceOf(part, 'page'), surface, part);
    assert.equal(surfaceOf(part, 'inverse'), surface, part);
    assert.equal(surfaceOf(part, surface), same, part);
  }
  assert.equal(surfaceOf('card'), null);
  assert.equal(surfaceOf('toString'), null);
});

test('iconHtml writes what Icon writes', async () => {
  for (const name of Object.keys(icons)) {
    assert.equal(iconHtml(name), (await render('Icon', { name })).trim(), name);
    assert.equal(iconHtml(name, 'kn-card-arrow'), (await render('Icon', { name, class: 'kn-card-arrow' })).trim(), name);
  }
  assert.throws(() => iconHtml('no-such-icon'), TypeError);
});

test('Breadcrumbs counts only the steps it shows', async () => {
  const items = (n) => Array.from({ length: n }, (_, i) => ({ label: `Step ${i + 1}`, href: i < n - 1 ? `/${i}/` : undefined }));
  assert.equal((await render('Breadcrumbs', { items: items(2), current: false })).trim(), '');
  const hidden = await render('Breadcrumbs', { items: items(3), current: false });
  assert.match(hidden, /data-kn-current="false"/);
  assert.equal((hidden.match(/<li>/g) ?? []).length, 3, 'the hidden level stays in the markup');
  assert.notEqual((await render('Breadcrumbs', { items: items(2) })).trim(), '');
});

test('the fixture is the contract\'s markup: no inline style, no <style>, and pictures with their alt', async () => {
  const html = await readFile(new URL('./fixtures/directives-section.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /\sstyle=|<style/);
  const images = all(parse(html), 'img');
  assert.ok(images.length > 10);
  for (const image of images) assert.ok('alt' in image.attributes, image.attributes.src);
});

const BROWSERS = Object.entries({ chromium, firefox, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const svg = (w, h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="gray"/></svg>`)}`;
const PICTURES = { picture: svg(1200, 800), portrait: svg(600, 800), badge: svg(200, 200), logo: svg(400, 120) };
// Only a viewBox, as many an SVG file has: it has no size of its own.
const bare = (w, h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="gray"/></svg>`)}`;
PICTURES.badgeBare = bare(300, 200);
PICTURES.logoBare = bare(400, 120);
let styles, fixture;
const browsers = [];
before(async () => {
  styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}${await readFile(new URL('../src/konzilo/konzilo.css', import.meta.url), 'utf8')}`;
  fixture = await readFile(new URL('./fixtures/directives-section.html', import.meta.url), 'utf8');
  for (const [name, src] of Object.entries(PICTURES)) fixture = fixture.replaceAll(`{{${name}}}`, src);
  for (const [name, type] of BROWSERS) browsers.push([name, await type.launch()]);
}, { timeout: 120000 });
after(() => Promise.all(browsers.map(([, browser]) => browser.close())));

// No script runs: the stylesheet alone lays every section out (principles.md).
async function open(browser, { width = 1440, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false });
  const tab = await context.newPage();
  await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}</style></head><body data-kn-surface="page"><main>${fixture}</main></body></html>`);
  tab.on('close', () => context.close().catch(() => {}));
  return tab;
}
// For each section, how its groups stand: beside (media or head and body side by side, sharing some height) or stacked, and the head's alignment.
const layout = (tab) => tab.$$eval('main > .kn-section', (sections) => Object.fromEntries(sections.map((section) => {
  const box = (selector) => section.querySelector(`:scope > .kn-band-content > ${selector}`)?.getBoundingClientRect();
  const head = box('.kn-section-head'), body = box('.kn-section-body'), media = box('.kn-section-media');
  const beside = (a, b) => Boolean(a && b) && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const element = section.querySelector('.kn-section-head');
  const deck = section.querySelector('.kn-section-head .kn-heading-group-deck')?.getBoundingClientRect();
  const heading = section.querySelector('.kn-section-head .kn-heading-group-heading')?.getBoundingClientRect();
  return [section.id, {
    beside: beside(media, head ?? body) || beside(head, body),
    centred: element ? getComputedStyle(element).textAlign === 'center' : false,
    deckBeside: beside(heading, deck),
  }];
})));

test('a section\'s layout follows the first of the six rules that matches, and stacks on a narrow window', { timeout: 240000 }, async () => {
  const wide = {
    offer: { beside: true, centred: false, deckBeside: false }, // 1: a picture first
    guide: { beside: true, centred: false, deckBeside: false }, // 1, with a form
    contact: { beside: true, centred: false, deckBeside: false }, // 2: a heading and a form
    end: { beside: false, centred: true, deckBeside: false }, // 3: another form
    questions: { beside: true, centred: false, deckBeside: false }, // 4: a head and an accordion
    story: { beside: true, centred: false, deckBeside: false }, // 5: a head and paragraphs
    reasons: { beside: false, centred: true, deckBeside: false }, // 6: reasons
    pair: { beside: false, centred: true, deckBeside: false }, // 6: two cards
    plans: { beside: false, centred: false, deckBeside: true }, // 6: a long deck over six cards with pictures
    news: { beside: false, centred: false, deckBeside: false }, // 6: otherwise the head above
    other: { beside: false, centred: false, deckBeside: false }, // anything else
  };
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    assert.deepEqual(await layout(tab), wide, `${name} at 1440`);
    await tab.close();
    for (const width of [390, 768]) {
      const narrow = await open(browser, { width });
      const found = await layout(narrow);
      for (const id of ['questions', 'story', 'plans']) assert.equal(found[id].beside || found[id].deckBeside, false, `${name} at ${width}: ${id}`);
      if (width === 390) for (const [id, facts] of Object.entries(found)) assert.equal(facts.beside, false, `${name} at 390: ${id}`);
      assert.equal(await narrow.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${name} at ${width} scrolls sideways`);
      await narrow.close();
    }
  }
});

test('a head beside its accordion stays in view by CSS alone, and one taller than the window scrolls inside itself', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    assert.deepEqual(await tab.$$eval('main > .kn-section', (sections) => sections.filter((section) => getComputedStyle(section.querySelector('.kn-section-head') ?? section).position === 'sticky').map((section) => section.id)), ['questions'], name);
    const place = () => tab.evaluate(() => {
      const head = document.querySelector('#questions .kn-section-head');
      const inset = parseFloat(getComputedStyle(head).insetBlockStart);
      const box = head.getBoundingClientRect();
      return { inset, top: box.top, bottom: box.bottom, window: innerHeight, scrolls: head.scrollHeight > head.clientHeight + 1 };
    });
    await tab.evaluate(() => {
      const body = document.querySelector('#questions .kn-section-body');
      window.scrollTo(0, body.getBoundingClientRect().top + window.scrollY + 40);
    });
    let found = await place();
    assert.ok(Math.abs(found.top - found.inset) < 1.5, `${name}: the head stays at the inset (${found.top} for ${found.inset})`);
    assert.equal(found.scrolls, false, `${name}: a head that fits does not scroll`);
    // A window too short for the head: it still stays, ends inside the window and scrolls inside itself to its end.
    await tab.setViewportSize({ width: 1440, height: 160 });
    await tab.evaluate(() => {
      const body = document.querySelector('#questions .kn-section-body');
      window.scrollTo(0, body.getBoundingClientRect().top + window.scrollY + 40);
    });
    found = await place();
    assert.ok(Math.abs(found.top - found.inset) < 1.5 && found.bottom <= found.window + 0.5, `${name}: ${JSON.stringify(found)}`);
    assert.equal(found.scrolls, true, `${name}: the head scrolls inside itself`);
    const end = await tab.evaluate(() => {
      const head = document.querySelector('#questions .kn-section-head');
      head.scrollTop = head.scrollHeight;
      const last = head.lastElementChild.getBoundingClientRect();
      return last.bottom <= head.getBoundingClientRect().bottom + 0.5;
    });
    assert.equal(end, true, `${name}: the head's end can be reached`);
    await tab.close();
  }
});

test('the hero\'s logo, actions and fine print, the trail with its level hidden, and an article\'s meta line', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const width of [390, 1440]) {
    const tab = await open(browser, { width });
    const facts = await tab.evaluate(() => {
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      const logo = box('#hero .kn-hero-logo'), group = box('#hero .kn-heading-group'), actions = box('#hero .kn-actions'), note = box('#hero .kn-fine-print');
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const gap = parseFloat(getComputedStyle(document.querySelector('#hero .kn-fine-print')).marginBlockStart);
      const after = [...document.querySelectorAll('#opening .kn-article-meta > span')].map((span) => getComputedStyle(span, '::after').content);
      // The owner's meta line (2026-11-12): the core's sentence, then the topics as pills, each a link, after a bullet.
      const meta = document.querySelector('#opening .kn-article-meta');
      const line = meta.querySelector('.kn-article-line').getBoundingClientRect(), pills = [...meta.querySelectorAll('.kn-article-topics > a.kn-pill')];
      const style = (element) => getComputedStyle(element);
      return {
        logoAbove: logo.bottom <= group.top,
        logoSmall: logo.height <= 4 * rem + 0.5,
        noteUnder: note.top >= actions.bottom && gap < parseFloat(getComputedStyle(document.querySelector('#hero .kn-actions')).marginBlockStart),
        current: document.querySelector('#hero .kn-breadcrumbs li:last-child').getClientRects().length,
        separators: after.map((content) => content !== 'none' && content !== 'normal'),
        bullet: after[0].includes('•'),
        links: [...meta.querySelectorAll('.kn-article-byline a, a.kn-article-category')].map((link) => style(link).textDecorationLine),
        pills: pills.map((pill) => [style(pill).textTransform, style(pill).textDecorationLine, style(pill).backgroundColor === style(pill).borderTopColor]),
        after: ((pill) => pill.left >= line.right - 1 || pill.top > line.top + 1)(pills[0].getBoundingClientRect()),
      };
    });
    assert.deepEqual(facts, { logoAbove: true, logoSmall: true, noteUnder: true, current: 0, separators: [true, false], bullet: true, links: ['underline', 'underline'], pills: [['uppercase', 'none', true], ['uppercase', 'none', true]], after: true }, `${name} at ${width}`);
    await tab.close();
  }
});

test('a live preview\'s data-konzilo-block on every block changes no layout, in any directive\'s fixture', { timeout: 240000 }, async () => {
  for (const file of ['section', 'cards', 'lists', 'panels']) {
    let html = await readFile(new URL(`./fixtures/directives-${file}.html`, import.meta.url), 'utf8');
    html = html.replace(/\{\{\w+\}\}/g, PICTURES.picture);
    for (const [name, browser] of browsers) for (const width of [390, 1440]) {
      const tab = await browser.newPage({ viewport: { width, height: 900 } });
      await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}</style></head><body data-kn-surface="page"><main>${html}</main></body></html>`);
      const moved = await tab.evaluate(() => {
        const elements = [...document.querySelectorAll('main *')];
        const boxes = () => elements.map((element) => { const { x, y, width, height } = element.getBoundingClientRect(); return [x, y, width, height].map(Math.round).join(); });
        const was = boxes();
        // Paths within containers and lists, as the core writes them, on every element a block could be.
        elements.forEach((element, index) => element.setAttribute('data-konzilo-block', `${index % 7}.${index % 3}`));
        const now = boxes();
        return elements.filter((_, index) => was[index] !== now[index]).map((element) => element.outerHTML.slice(0, 80));
      });
      assert.deepEqual(moved, [], `${file} in ${name} at ${width}`);
      await tab.close();
    }
  }
});

test('a section body: parts a column gap apart, a label at the component gap over its part, a heading group close over its text', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) for (const width of [390, 1440]) {
    const tab = await open(browser, { width });
    const facts = await tab.evaluate(() => {
      const probe = (length) => { const element = document.createElement('div'); element.style.inlineSize = length; document.querySelector('#other .kn-section-body').append(element); const size = element.getBoundingClientRect().width; element.remove(); return size; };
      const column = probe('var(--kn-space-column-gap)'), component = probe('var(--kn-space-component-gap)');
      const gap = (a, b) => document.querySelector(b).getBoundingClientRect().top - document.querySelector(a).getBoundingClientRect().bottom;
      const near = (value, target) => Math.abs(value - target) < 1.5;
      return {
        fineToLabel: near(gap('#other .kn-fine-print', '#other-terms-label'), column),
        labelToTerms: near(gap('#other-terms-label', '#other-terms'), component),
        termsToLabel: near(gap('#other-terms', '#other-values-label'), column),
        labelToValues: near(gap('#other-values-label', '#other-values'), component),
        valuesToActions: near(gap('#other-values', '#other-actions'), column),
        actionsToGroup: near(gap('#other-actions', '#other-group'), column),
        groupToText: gap('#other-group', '#other-after-group') > 2 && gap('#other-group', '#other-after-group') < component,
        formToTerms: near(gap('#konzilo-form-end', '#end .kn-fine-print'), Math.max(component, parseFloat(getComputedStyle(document.querySelector('#konzilo-form-end')).marginBlockEnd))),
      };
    });
    assert.deepEqual(facts, Object.fromEntries(Object.keys(facts).map((key) => [key, true])), `${name} at ${width}`);
    await tab.close();
  }
});

test('a fact box in a section\'s body stands in the reading column, and in the middle of a centred section', { timeout: 120000 }, async () => {
  const box = '<aside class="kn-fact-box" data-kn-surface="tint"><p class="kn-fact-box-label" data-kn-type="label">In short</p><h3 class="kn-fact-box-heading" data-kn-type="heading-5">Three things</h3><ul><li>One thing that is said at some length, so the box would take all the room it is given.</li></ul></aside>';
  for (const [name, browser] of browsers) for (const width of [390, 1440]) {
    const tab = await open(browser, { width });
    const found = await tab.evaluate((html) => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.inlineSize = 'var(--kn-layout-narrow)';
      const narrow = probe.getBoundingClientRect().width;
      return ['#other', '#end'].map((id) => {
        const body = document.querySelector(`${id} .kn-section-body`);
        body.insertAdjacentHTML('beforeend', html);
        const fact = body.lastElementChild.getBoundingClientRect(), room = body.getBoundingClientRect();
        return { id, width: fact.width, room: room.width, narrow, start: fact.left - room.left, end: room.right - fact.right };
      });
    }, box);
    for (const { id, width: inner, room, narrow, start, end } of found) {
      assert.ok(Math.abs(inner - Math.min(room, narrow)) < 1, `${name} at ${width}: ${id}'s fact box is ${inner} wide, the reading column ${narrow}, its room ${room}`);
      if (id === '#end') assert.ok(Math.abs(start - end) < 1, `${name} at ${width}: in the middle of a centred section`);
      else assert.ok(start < 1, `${name} at ${width}: at the start`);
    }
    await tab.close();
  }
});

test('in a centred section a form reads down one edge, its button and its terms with it', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    const facts = await tab.evaluate(() => {
      const form = document.querySelector('#konzilo-form-end').getBoundingClientRect();
      const send = document.querySelector('#konzilo-form-end .konzilo-form-send').getBoundingClientRect();
      return {
        centred: getComputedStyle(document.querySelector('#end .kn-section-head')).textAlign,
        button: Math.round(send.left - form.left),
        terms: getComputedStyle(document.querySelector('#end .kn-fine-print')).textAlign,
      };
    });
    assert.deepEqual(facts, { centred: 'center', button: 0, terms: 'start' }, name);
    await tab.close();
  }
});

test('a badge and a hero\'s logo with only a viewBox are drawn at the recipe\'s height, whole', { timeout: 120000 }, async () => {
  for (const [name, browser] of browsers) {
    const tab = await open(browser);
    const sizes = await tab.evaluate(() => [document.querySelector('#hero .kn-hero-logo'), document.querySelector('#offer .kn-section-badges li:last-child img')].map((image) => {
      const { width, height } = image.getBoundingClientRect();
      return Math.round(width / height * 100) / 100;
    }));
    // 400 by 120 and 300 by 200, each at its own proportions.
    assert.deepEqual(sizes, [3.33, 1.5], name);
    await tab.close();
  }
});

test('the contract\'s trail is what Breadcrumbs writes with the design\'s settings', async () => {
  const contract = await readFile(new URL('../docs/spec/directives.md', import.meta.url), 'utf8');
  const start = contract.indexOf('<nav class="kn-breadcrumbs" aria-label');
  const example = parse(contract.slice(start, contract.indexOf('</nav>', start) + 6).replace(/ …>…<\/svg>/, '></svg>'));
  const written = parse(await render('Breadcrumbs', { items: [{ label: 'Home', href: '/' }, { label: 'Guides', href: '/guides/' }, { label: 'This page' }], separator: 'slash', home: 'word', current: false, narrow: 'trail' }));
  const nav = (tree) => all(tree, 'nav')[0].attributes;
  assert.deepEqual(nav(written), nav(example));
  assert.equal(all(written, '.kn-breadcrumbs-house').length, all(example, '.kn-breadcrumbs-house').length);
  assert.equal(all(written, 'li').length, all(example, 'li').length);
});
