// The tool's component pages: the panel holds only what the design file saves, and each page's preview is a document
// of its own that shows its own components, each with every variant a site chooses per use, side by side and named.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startTool } from '../tool/server.js';
import { createPresentation } from '../tool/presentation.js';
import { componentPages, FRAME_PAGES, ids } from '../presentation/src/catalog.js';
import { CATALOGUE, cataloguePath, sectionId, sectionName } from '../presentation/src/catalogue.js';
import { questions } from '../presentation/src/samples.js';

const ON = ['On the page colour', 'On the tint', 'On the brand colour', 'On a dark background'];
const CALLOUTS = ['Filled', 'Outlined'].flatMap((style) => ['Info', 'Success', 'Warning', 'Error'].map((status) => `${status} · ${style}`));
// What each section shows at a desktop's width: the captions that name its variants, in order, and what it holds.
// A grid of variants names its columns once, above its first row, there; a phone names each cell.
const SHOWS = {
  opening: { hero: [[], { '.kn-hero': 1 }] },
  sections: {
    band: [['Tint', 'Brand colour', 'Dark'], { '.kn-band': 3 }],
    'text-and-image': [['Picture right', 'Picture left'], { '.kn-text-image': 2, '.kn-text-image[data-kn-image-side="start"]': 1 }],
    'cta-band-and-key-figures': [[], { '.kn-cta-band': 1, '.kn-key-figures': 1 }],
  },
  text: {
    'body-text-and-heading-group': [[], { '.kn-heading-group': 1, '.kn-body-text': 1 }],
    'reading-area-and-table-of-contents': [[], { '.kn-reading-area': 1, '.kn-toc': 1 }],
    accordion: [['Hairlines', 'Boxes'], { '.kn-accordion': 2, '.kn-accordion[data-kn-variant="boxes"]': 1, '.kn-accordion details': 6, '.kn-quotation': 0 }],
    quotation: [[], { '.kn-quotation': 1, '.kn-accordion': 0 }],
    callout: [CALLOUTS, { '.kn-callout': 8, '.kn-callout[data-kn-style="outlined"]': 4, '.kn-callout[data-kn-variant="warning"]': 2 }],
    table: [['Plain rows · On the page colour', 'Alternating rows · On the brand colour'], { '.kn-table-scroll': 2, '.kn-table-scroll[data-kn-striped]': 1 }],
    tabs: [[], { '.kn-tabs': 1, '.kn-tabs-tab': 3, '.kn-value-list': 1 }],
  },
  buttons: {
    'button-and-link-group': [[
      ...[ON[0], ON[2]].flatMap((surface) => [surface, 'Filled', 'Default', 'Hover', 'Focus', 'Active', 'Outline', 'Arrow']),
      'Link Group · On the page colour', 'Link Group · On the brand colour',
    ], { '.kn-button': 30, '.kn-button.is-hover': 6, '.kn-button[data-kn-variant="arrow"]': 10, '.kn-link-group': 2 }],
    link: [[ON[0], 'Default', 'Hover', 'Focus', ...ON.slice(1)], { '.kn-body-text a': 12, 'a.is-focus': 4 }],
    icon: [[], { '.kn-icon': 12 }],
  },
  cards: {
    card: [['Link · On a plate', 'Link · No plate', 'Person · On a plate', 'Person · No plate'], { '.kn-card': 4, '.kn-card[data-kn-variant="person"]': 2, '.kn-card[data-kn-surface]': 2 }],
    'content-card-and-content-row': [['Content Card', 'Content Row'], { '.kn-content-card': 3, '.kn-content-row': 2 }],
    'card-grid': [['2 columns', '3 columns', '4 columns'], { '.kn-card-grid': 3, '.kn-card': 9 }],
  },
  media: {
    'figure-and-video-player': [[], { '.kn-figure:not(.kn-video)': 1, '.kn-video': 1 }],
    embed: [['Before permission', 'With a local picture'], { '.kn-embed': 2 }],
  },
  finding: {
    'content-loop': [['Cards', 'Rows'], { '.kn-content-loop': 2, '.kn-content-loop[data-kn-presentation="rows"]': 1 }],
    'visitor-filters': [['Filters', 'Search results'], { '.kn-visitor-filters': 1, '.search-results-composition': 1 }],
    pagination: [[], { '.kn-pagination': 1 }],
  },
  forms: {
    form: [['Contact · On the page colour', 'Contact · On the brand colour', 'More fields'], { '.kn-form': 3 }],
    field: [['Default', 'Focus', 'Disabled'], { '.kn-field': 9 }],
    'consent-banner': [[], { '[data-open-banner]': 1 }],
  },
};
const PAGES = Object.keys(SHOWS);

// What a section shows: the captions that can be seen, and how many of each thing can be seen.
const read = (section, wanted) => {
  const seen = (node) => node.getClientRects().length > 0;
  return {
    captions: [...section.querySelectorAll('.catalogue-caption')].filter(seen).map((node) => node.textContent.trim()),
    counts: Object.fromEntries(Object.keys(wanted).map((selector) => [selector, [...section.querySelectorAll(selector)].filter(seen).length])),
  };
};

let directory;
let tool;
let browser;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kn-catalogue-'));
  tool = await startTool({ designFile: join(directory, 'catalogue.design.json'), port: 0, open: false });
  browser = await chromium.launch();
}, { timeout: 240000 });
after(async () => {
  await browser?.close();
  await tool?.close();
  await rm(directory, { recursive: true, force: true });
});

async function openTool(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const writes = [];
  page.on('request', (request) => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.goto(tool.url);
  await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
  const ends = [await (await page.$('#preview')).contentFrame(), await (await page.$('#preview-narrow')).contentFrame()];
  return { context, page, ends, errors, writes };
}
const turnTo = async (page, id) => {
  await page.locator('.chapter[data-chapter="components"]').click();
  await page.locator(`.page-link[data-go="${id}"]`).click();
  await page.locator(`[data-page="${id}"]`).waitFor({ state: 'visible' });
};

test('each section holds one or two of its page\'s components, as the report lists them and in that order', () => {
  const pages = componentPages.filter(([page]) => !FRAME_PAGES.includes(page));
  assert.deepEqual(Object.keys(CATALOGUE), pages.map(([page]) => page));
  assert.deepEqual(PAGES, Object.keys(CATALOGUE));
  for (const [page, names] of pages) {
    assert.deepEqual(CATALOGUE[page].flatMap(({ components }) => components), names, page);
    assert.deepEqual(CATALOGUE[page].map(sectionId), Object.keys(SHOWS[page]), page);
  }
  // Every specimen of the report's component pages shows in the tool, but those whose variants another holds side by side.
  const shown = Object.values(CATALOGUE).flat().flatMap(({ specimens }) => specimens.map(([id]) => id));
  assert.equal(new Set(shown).size, shown.length, 'a specimen shows once');
  const report = pages.flatMap(([, , defaults, variants]) => [...defaults, ...variants]);
  assert.deepEqual(report.filter((id) => !shown.includes(id)).sort(), ['callout', 'card-person', 'card-unplated']);
  assert.deepEqual(shown.filter((id) => !ids.includes(id)), ['content-row'], 'and one the tool alone has');
  assert.equal(cataloguePath('text'), '/catalogue/text.html');
});

test('every component page holds no control but its way on, and Text the tabs\' line, opening a page aside, and lists the sections its preview shows', { timeout: 180000 }, async () => {
  const { context, page, ends, errors, writes } = await openTool();
  try {
    const designBefore = await readFile(tool.path, 'utf8');
    for (const id of PAGES) {
      await turnTo(page, id);
      const form = page.locator(`[data-page="${id}"]`);
      const listed = await form.locator('.component-list dt').allTextContents();
      assert.deepEqual(listed, CATALOGUE[id].map(sectionName), id);
      const controls = await form.locator('input, select, textarea, button:not(.next), [data-path], [data-pick], [data-flag]').count();
      if (id === 'opening') assert.ok(controls > 0, 'the hero keeps its settings');
      else if (id === 'text') {
        // Where the line across the tabs stands is the design's (the owner, 2026-11-12), and the one control here.
        assert.equal(controls, 1, 'text has one control');
        assert.deepEqual(await form.locator('[data-path="inputs.tabs.rule-place"] option').evaluateAll((options) => options.map((option) => option.value)), ['below', 'above']);
        assert.match(await form.locator('.component-note').first().textContent(), /A site chooses among the variants each time it uses a component[^]*Where the line across the tabs stands is the design's own/);
      } else {
        assert.equal(controls, 0, `${id} has no control`);
        assert.match(await form.locator('.component-note').first().textContent(), /each with its variants side by side and named\. A site chooses among the variants each time it uses a component/);
      }
      for (const end of ends) {
        await end.waitForFunction((path) => location.pathname === path && document.readyState === 'complete', cataloguePath(id));
        assert.deepEqual(await end.locator('[data-component-page]').evaluateAll((nodes) => nodes.map((node) => node.dataset.componentPage)), [id], 'its own page and no other');
        assert.deepEqual(await end.locator('[data-component]').evaluateAll((nodes) => nodes.map((node) => node.dataset.component)), CATALOGUE[id].map(sectionId), `${id}: only its own sections`);
        assert.deepEqual(await end.locator('.catalogue-name').allTextContents(), listed, `${id}: named as the panel names them`);
      }
    }
    await page.waitForTimeout(1200);
    assert.deepEqual(writes, [], 'turning the pages writes nothing');
    assert.equal(await readFile(tool.path, 'utf8'), designBefore);
    assert.equal(await page.locator('#undo').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('the Text page sets where the line across the tabs stands, and the preview follows it at once, at both ends', { timeout: 180000 }, async () => {
  const { context, page, ends, errors } = await openTool();
  try {
    await turnTo(page, 'text');
    const line = (end) => end.locator('[data-component="tabs"] .kn-tabs').evaluate((tabs) => ({
      above: getComputedStyle(tabs.querySelector('.kn-tabs-tab'), '::before').borderTopWidth,
      panel: getComputedStyle([...tabs.querySelectorAll('.kn-tabs-panel')].find((panel) => panel.checkVisibility())).borderTopWidth,
    }));
    for (const end of ends) {
      await end.waitForFunction((path) => location.pathname === path && document.readyState === 'complete', cataloguePath('text'));
      assert.deepEqual(await line(end), { above: '0px', panel: '1px' }, 'below by default');
    }
    await page.locator('[data-path="inputs.tabs.rule-place"]').selectOption('above');
    for (const end of ends) {
      await end.waitForFunction(() => getComputedStyle(document.querySelector('[data-component="tabs"] .kn-tabs-tab'), '::before').borderTopWidth === '1px');
      assert.deepEqual(await line(end), { above: '1px', panel: '0px' });
    }
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    assert.deepEqual(JSON.parse(await readFile(tool.path, 'utf8')).inputs.tabs, { 'rule-place': 'above' }, 'saved in the design file');
    await page.locator('#undo').click();
    for (const end of ends) await end.waitForFunction(() => getComputedStyle(document.querySelector('[data-component="tabs"] .kn-tabs-tab'), '::before').borderTopWidth === '0px');
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('each section shows every variant at once, each named, at a desktop\'s width and a phone\'s', { timeout: 180000 }, async () => {
  for (const id of PAGES) for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(`${tool.url}${cataloguePath(id)}`);
      await page.waitForLoadState('load');
      for (const [section, [captions, counts]] of Object.entries(SHOWS[id])) {
        const found = await page.locator(`[data-component="${section}"]`).evaluate(read, counts);
        assert.deepEqual(found.counts, counts, `${id}/${section} at ${width} px`);
        if (width === 1440) assert.deepEqual(found.captions, captions, `${id}/${section}`);
        else assert.deepEqual([...new Set(found.captions)].sort(), [...new Set(captions)].sort(), `${id}/${section} on a phone`);
      }
    } finally {
      await page.close();
    }
  }
});

test('on a phone each cell of a grid of variants has its name, and no catalogue scrolls a phone sideways', { timeout: 120000 }, async () => {
  for (const width of [390, 320]) for (const id of PAGES) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    try {
      await page.goto(`${tool.url}${cataloguePath(id)}`);
      await page.waitForLoadState('load');
      const overflow = await page.evaluate(() => {
        scrollTo(9999, 0);
        return { scrolled: scrollX, beyond: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      assert.deepEqual(overflow, { scrolled: 0, beyond: 0 }, `${id} at ${width} px`);
      if (id === 'buttons') {
        const unnamed = await page.locator('.catalogue-cell').evaluateAll((cells) => cells.filter((cell) => !cell.querySelector(':scope > .catalogue-caption')?.getClientRects().length).length);
        assert.equal(unnamed, 0, `every cell named at ${width} px`);
      }
    } finally {
      await page.close();
    }
  }
});

// Everything computed on a part and what it holds, where it shows. Transitions are off while the tool tunes a design, so
// they say nothing of a state.
const computed = (scope) => [scope, ...scope.querySelectorAll('*')].filter((node) => node.getClientRects().length).map((node) => {
  const style = getComputedStyle(node);
  return Object.fromEntries([...style].filter((name) => !name.startsWith('--') && !name.startsWith('transition')).map((name) => [name, style.getPropertyValue(name)]));
});

test('every state shown differs from rest in something computed, in both modes and on every kind and field it stands for', { timeout: 180000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    for (const mode of ['light', 'dark']) {
      await page.goto(`${tool.url}${cataloguePath('buttons')}`);
      await page.evaluate((wanted) => { document.documentElement.dataset.knMode = wanted; document.documentElement.toggleAttribute('data-kn-tuning', true); }, mode);
      // A row of cells, each a state: every state but rest computes otherwise than rest.
      const rows = await page.locator('.catalogue-row').evaluateAll((list, read) => list.map((row) => [...row.querySelectorAll(':scope > .catalogue-cell')].map((cell) => new Function('scope', `return (${read})(scope)`)(cell.querySelector('.kn-button, a')))), computed.toString());
      assert.equal(rows.length, 6 + 4, 'three kinds on two Surfaces, and a link on four');
      for (const [index, [rest, ...states]] of rows.entries()) {
        for (const [state, look] of states.entries()) assert.notDeepEqual(look, rest, `${mode}: row ${index}, state ${state + 1}`);
      }
      await page.goto(`${tool.url}${cataloguePath('forms')}`);
      await page.evaluate((wanted) => { document.documentElement.dataset.knMode = wanted; }, mode);
      // Each of the three fields on its own, so that a state showing on one of them does not pass for all.
      const fields = await page.locator('[data-component="field"] .sample-state-row > div').evaluateAll((columns, read) => columns.map((column) => [...column.querySelectorAll('.kn-field')].map((field) => new Function('scope', `return (${read})(scope)`)(field))), computed.toString());
      assert.equal(fields.length, 3);
      for (const state of [1, 2]) for (const index of [0, 1, 2]) assert.notDeepEqual(fields[state][index], fields[0][index], `${mode}: field ${index}, state ${state}`);
    }
    // And the pointer itself: what the Link's Hover shows is what a real one does.
    await page.goto(`${tool.url}${cataloguePath('buttons')}`);
    const link = page.locator('[data-component="link"] .catalogue-row[data-kn-surface="page"] a.is-default');
    const thickness = () => link.evaluate((node) => getComputedStyle(node).textDecorationThickness);
    const atRest = await thickness();
    await link.hover();
    assert.notEqual(await thickness(), atRest);
  } finally {
    await page.close();
  }
});

test('a number field follows its Surface like the other fields, and the bands hold the same content in each colour', { timeout: 120000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`${tool.url}${cataloguePath('forms')}`);
    const colours = (selector) => page.locator(`[data-catalogue-specimen="form-more"] ${selector}`).evaluate((node) => {
      const { colorScheme, backgroundColor, color, borderBlockStartColor } = getComputedStyle(node);
      return { colorScheme, backgroundColor, color, borderBlockStartColor };
    });
    for (const mode of ['light', 'dark']) {
      await page.evaluate((wanted) => { document.documentElement.dataset.knMode = wanted; }, mode);
      const number = await colours('input[type="number"]');
      assert.deepEqual(number, await colours('input[type="tel"]'), mode);
      assert.equal(number.colorScheme, mode);
    }
    await page.goto(`${tool.url}${cataloguePath('sections')}`);
    const bands = await page.locator('[data-component="band"] .kn-band').evaluateAll((nodes) => nodes.map((node) => ({ height: node.getBoundingClientRect().height, text: node.textContent.replace(/\s+/g, ' ').trim() })));
    assert.deepEqual(bands, Array(3).fill(bands[0]));
  } finally {
    await page.close();
  }
});

test('the accordion has three questions, the quotation a section of its own, and the report has both so too', { timeout: 180000 }, async () => {
  assert.ok(questions.length >= 3);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`${tool.url}${cataloguePath('text')}`);
    const sections = await page.locator('[data-component]').evaluateAll((nodes) => nodes.map((node) => [node.dataset.component, node.querySelectorAll('.kn-accordion').length, node.querySelectorAll('.kn-quotation').length]));
    assert.deepEqual(sections.filter(([, accordions, quotations]) => accordions || quotations), [['accordion', 2, 0], ['quotation', 0, 1]]);
    for (const accordion of await page.locator('.kn-accordion').all()) assert.equal(await accordion.locator('details').count(), questions.length);
  } finally {
    await page.close();
  }

  // The report keeps its pages and disclosures; its accordion lost the quotation, which has a specimen of its own.
  const design = join(directory, 'report.design.json');
  await writeFile(design, await readFile('examples/example.design.json', 'utf8'));
  const zip = join(directory, 'report.zip');
  await createPresentation(design, zip, { date: '2026-11-11' });
  const bytes = await readFile(zip);
  const offset = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
  const file = join(directory, 'report.html');
  await writeFile(file, inflateRawSync(bytes.subarray(offset, offset + bytes.readUInt32LE(18))));
  const html = await readFile(file, 'utf8');
  assert.doesNotMatch(html, /data-look|data-report-only|class=\\?"catalogue-/, 'nothing of the tool\'s in the report\'s pages');
  const report = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await report.goto(`file://${file}`);
    for (const [id, specimens] of Object.entries({
      sections: { band: { '.kn-band': 3 }, 'text-image-start': { '.kn-text-image': 1 } },
      text: { accordion: { '.kn-accordion': 1, 'details': 3, '.kn-quotation': 0 }, quotation: { '.kn-quotation': 1, '.kn-accordion': 0 }, 'callout-more': { '.kn-callout': 8 }, 'accordion-more': { '.kn-accordion': 1, 'details': 3 }, 'table-more': { '.kn-table-scroll': 1 } },
      buttons: { 'button-default': { '.kn-button': 6, 'a:not(.kn-button)': 2 }, buttons: { '.kn-button': 24, '[data-kn-type="label"]': 8 }, links: { 'a': 12, '[data-kn-type="label"]': 12 } },
      cards: { card: { '.kn-card': 3 }, 'card-unplated': { '.kn-card': 3 }, 'card-person': { '.kn-card': 3 }, 'content-card': { '.kn-content-card': 3 }, 'card-grid': { '.kn-card-grid': 2, '.kn-card': 6, '.grid-caption': 2 } },
      media: { embed: { '.kn-embed': 2, '.grid-caption': 2 } },
      finding: { 'content-loop': { '.kn-content-loop': 2 } },
      forms: { 'form-states': { '.kn-field': 9, '[data-kn-type="label"]': 3 } },
    })) {
      await report.evaluate((target) => { location.hash = target; }, id);
      await report.waitForFunction((target) => document.querySelector('.document-page.is-current')?.id === target, id);
      const disclosure = report.locator(`#${id} details.variants > summary`);
      if (await disclosure.count()) await disclosure.click();
      for (const [specimen, wanted] of Object.entries(specimens)) {
        const frame = report.locator(`#${id} [data-specimen-frame="${specimen}"]`);
        await frame.waitFor({ state: 'visible' });
        await report.waitForFunction((name) => {
          const inner = document.querySelector(`[data-specimen-frame="${name}"]`);
          return inner?.contentDocument?.querySelector('.sample-root') && inner.contentDocument.readyState === 'complete';
        }, specimen);
        const child = await (await frame.elementHandle()).contentFrame();
        const counts = await child.locator('.sample-root').evaluate((root, selectors) => Object.fromEntries(selectors.map((selector) => [selector, root.querySelectorAll(selector).length])), Object.keys(wanted));
        assert.deepEqual(counts, wanted, `${id}/${specimen}`);
      }
    }
    assert.equal(await report.locator('#text [data-specimen-frame="quotation"]').count(), 1);
  } finally {
    await report.close();
  }
});

test('a window that remembers looks or a held panel from an earlier version opens without them, and forgets them', { timeout: 60000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await context.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('konzilo-tool-ui', JSON.stringify({ page: 'text', looks: { 'callout-status': 'warning' }, panel: 'search', mode: 'light' }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    await page.locator('[data-page="text"]').waitFor({ state: 'visible' });
    await page.locator('.page-link[data-go="buttons"]').click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('konzilo-tool-ui')));
    assert.equal(stored.page, 'buttons');
    assert.deepEqual(['looks', 'panel'].filter((key) => key in stored), []);
    assert.equal(await page.locator('[data-look-key], [data-show-panel]').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

// An arrow button has no box, so its focus ring needs room of its own: off the word and the arrow, pressed too, with the
// word still at the edge of its column, where the button at rest has it.
test('the focus ring keeps off an arrow button\'s word and arrow, and the word stays where it was', { timeout: 120000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`${tool.url}${cataloguePath('buttons')}`);
    const measure = (state) => page.locator(`.kn-button.is-${state}[data-kn-variant="arrow"]`).first().evaluate((button) => {
      const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const range = document.createRange();
      range.selectNodeContents(text);
      const word = range.getBoundingClientRect();
      const arrow = button.querySelector('svg').getBoundingClientRect();
      const box = button.getBoundingClientRect();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const style = getComputedStyle(button);
      return { start: (word.left - box.left) / rem, end: (box.right - arrow.right) / rem, margin: Number.parseFloat(style.marginInlineStart) / rem, outline: style.outlineStyle };
    });
    const focus = await measure('focus');
    assert.equal(focus.outline, 'solid');
    assert.ok(focus.start >= 0.25 && focus.end >= 0.25, `the ring has ${focus.start}rem before the word and ${focus.end}rem after the arrow`);
    // What the box gains at its start, the margin gives back, so the word stands where the column starts.
    assert.ok(Math.abs(focus.start + focus.margin) < 0.01);
    const active = await measure('active');
    assert.ok(active.end >= 0.1, `a pressed arrow keeps ${active.end}rem from the end of its box`);
  } finally {
    await page.close();
  }
});
