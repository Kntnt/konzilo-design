// A client's own menu and footer: typed or pasted on the tool's Start page, kept in the design file's `project` as what
// they come to, and shown in place of the samples wherever the tool's preview and the presentation show the menu and the
// footer, cell by cell. None of it is design. The content here is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { chromium, firefox } from 'playwright-core';
import { parseMenu, menuText, parseList, parseText, parseNetworks, parseOwn, ownText, setOwn, ownValue, outlineText, OWN_FOOTER_CELLS } from '../tool/logic.js';
import { footerProps, headerProps, menuOf } from '../presentation/src/frame.js';
import { menu as sampleMenu, footer as sampleFooter } from '../presentation/src/samples.js';
import { resolve, validateDesignFile, fingerprint } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { coreCss } from '../src/css/index.js';
import { loadDesign, saveDesign, startTool } from '../tool/server.js';
import { createPresentation } from '../tool/presentation.js';

const EXAMPLE = 'examples/example.design.json';
const OWN_MENU = [
  { label: 'Lamps', items: [{ label: 'Desk lamps', description: 'For the late hours' }, { label: 'Floor lamps' }] },
  { label: 'Workshop', items: [{ label: 'Repairs', description: 'Old lamps made new', items: [{ label: 'Rewiring' }] }] },
  { label: 'Öppettider' },
];
const OWN_FOOTER = {
  upper: { b1: ['Instagram', 'Mastodon'], a2: 'Lamps for reading & <rest>.' },
  lower: { a1: '1 Lantern Row\n999 99 Nowhere', a2: ['Lamp care'] },
};

test('the menu reads an outline indented by spaces or tabs, with descriptions after a dash, and skips blank lines', () => {
  assert.deepEqual(parseMenu('Lamps\n  Desk lamps - For the late hours\n  Floor lamps\n\n\nWorkshop\n\tRepairs – Old lamps made new\n\t\tRewiring\nÖppettider\r\n'), OWN_MENU);
  // However wide a level is set in, a line set in further is a child, and one set in less goes back up.
  assert.deepEqual(parseMenu('A\n      B\n      C\n   D\nE'), [{ label: 'A', items: [{ label: 'B' }, { label: 'C' }, { label: 'D' }] }, { label: 'E' }]);
  assert.deepEqual(parseMenu('A\n    B\n        C\n  D'), [{ label: 'A', items: [{ label: 'B', items: [{ label: 'C' }] }, { label: 'D' }] }]);
  assert.deepEqual(parseMenu('A — the long dash\nB - \nSpare-parts\n  Ask   us  -  now'), [{ label: 'A', description: 'the long dash' }, { label: 'B -' }, { label: 'Spare-parts', items: [{ label: 'Ask us', description: 'now' }] }]);
  assert.deepEqual(parseMenu(''), []);
  assert.deepEqual(parseMenu('\n  \n\t\n'), []);
});

test('pasted bullets, numbers and drawn trees count as indentation, so an outline or a site map keeps its levels', () => {
  const lamps = [{ label: 'Lamps', items: [{ label: 'Desk lamps' }, { label: 'Floor lamps' }] }, { label: 'Workshop' }];
  // A document's bullets, Word's plain text with its tabs, Markdown, numbers and a terminal's tree.
  for (const outline of [
    '• Lamps\n\to\tDesk lamps\n\to\tFloor lamps\n• Workshop',
    '- Lamps\n  - Desk lamps\n  - Floor lamps\n- Workshop',
    '* Lamps\n    * Desk lamps\n    * Floor lamps\n* Workshop',
    '1. Lamps\n   1.1 Desk lamps\n   1.2 Floor lamps\n2. Workshop',
    '1. Lamps\n   a) Desk lamps\n   b) Floor lamps\n2. Workshop',
    '├── Lamps\n│   ├── Desk lamps\n│   └── Floor lamps\n└── Workshop',
    '|-- Lamps\n|   |-- Desk lamps\n|   `-- Floor lamps\n`-- Workshop',
    // A heading with its items bulleted under it, as one writes it without indenting.
    'Lamps\n- Desk lamps\n- Floor lamps\nWorkshop',
  ]) assert.deepEqual(parseMenu(outline), lamps, outline);
  // A number that is part of the words stays.
  assert.deepEqual(parseMenu('2026 Catalogue\n3D prints'), [{ label: '2026 Catalogue' }, { label: '3D prints' }]);
  // A line of bullets alone is no item.
  assert.deepEqual(parseMenu('Lamps\n  -\n  •\n  Desk lamps'), [{ label: 'Lamps', items: [{ label: 'Desk lamps' }] }]);
});

test('the menu is written back two spaces a level, and reads again as it was', () => {
  const text = menuText(OWN_MENU);
  assert.equal(text, 'Lamps\n  Desk lamps - For the late hours\n  Floor lamps\nWorkshop\n  Repairs - Old lamps made new\n    Rewiring\nÖppettider');
  assert.deepEqual(parseMenu(text), OWN_MENU);
  assert.equal(menuText([]), '');
  assert.equal(outlineText([{ depth: 0, words: 'Lamps' }, { depth: 1, words: 'Desk lamps' }, { depth: 2, words: 'Bulbs' }]), 'Lamps\n  Desk lamps\n    Bulbs');
});

test('links are one a line, text keeps its lines, and networks go by their names or addresses', () => {
  assert.deepEqual(parseList('• Lamp care\n\n- Returns\n  Terms | Privacy · Cookies\n'), ['Lamp care', 'Returns', 'Terms', 'Privacy', 'Cookies']);
  assert.deepEqual(parseList(''), []);
  assert.equal(parseText('  1 Lantern   Row \n\n\t999 99 Nowhere\n'), '1 Lantern Row\n999 99 Nowhere');
  assert.equal(parseText(' \n '), '');
  assert.deepEqual(parseNetworks('linkedin\nTWITTER\nhttps://www.instagram.com/lantern.row\nyoutu.be/abc\nopen.spotify.com/show/1\nm.facebook.com/lantern\nhello@lantern.invalid\nmailto:shop@lantern.invalid\nhttps://lantern.invalid/feed\nE-post\nMastodon\nLinkedIn'),
    ['LinkedIn', 'X', 'Instagram', 'YouTube', 'Spotify', 'Facebook', 'Email', 'RSS', 'Mastodon']);
  for (const [, , kind] of OWN_FOOTER_CELLS) assert.ok(['networks', 'text', 'links'].includes(kind));
  assert.deepEqual(OWN_FOOTER_CELLS.map(([band, cell]) => `${band}.${cell}`), ['upper.b1', 'upper.a2', 'upper.b2', 'lower.a1', 'lower.b1', 'lower.a2', 'lower.b2'], 'the order of the Footer page\'s miniature, without the brand');
  // What a field shows reads again as what the file holds.
  for (const [kind, value] of [['menu', OWN_MENU], ['networks', ['LinkedIn', 'Mastodon']], ['links', ['Lamp care']], ['text', 'One\nTwo']]) assert.deepEqual(parseOwn(kind, ownText(kind, value)), value);
  assert.equal(ownText('text', undefined), '');
  assert.equal(ownText('links', undefined), '');
});

test('what is emptied leaves the project, with any group it leaves empty, so an old file stays as it was', () => {
  const project = { name: 'Lantern Row' };
  setOwn(project, 'footer.lower.a1', '');
  assert.deepEqual(project, { name: 'Lantern Row' }, 'nothing to keep makes no group');
  setOwn(project, 'menu', OWN_MENU);
  setOwn(project, 'footer.lower.a1', 'One');
  setOwn(project, 'footer.upper.b1', ['Instagram']);
  assert.deepEqual(project, { name: 'Lantern Row', menu: OWN_MENU, footer: { lower: { a1: 'One' }, upper: { b1: ['Instagram'] } } });
  assert.equal(ownValue(project, 'footer.upper.b1')[0], 'Instagram');
  assert.equal(ownValue(project, 'footer.upper.a2'), undefined);
  setOwn(project, 'footer.lower.a1', '');
  assert.deepEqual(project.footer, { upper: { b1: ['Instagram'] } });
  setOwn(project, 'footer.upper.b1', []);
  setOwn(project, 'menu', []);
  assert.deepEqual(project, { name: 'Lantern Row' });
});

test('the design file keeps the content structured beside the other project text, and it is no part of the design', async () => {
  const file = JSON.parse(await readFile(EXAMPLE, 'utf8'));
  assert.equal(file.project.menu, undefined);
  assert.equal(file.project.footer, undefined);
  validateDesignFile(file);
  const resolved = await resolve(file.inputs);
  const own = { ...file, project: { ...file.project, menu: OWN_MENU, footer: OWN_FOOTER }, resolved };
  validateDesignFile(own);
  for (const project of [
    { menu: [{ title: 'Lamps' }] },
    { menu: [{ label: '' }] },
    { menu: [{ label: 'Lamps', href: '#lamps' }] },
    { menu: [{ label: 'Lamps', items: [{ label: 'Desk', url: '/desk' }] }] },
    { menu: 'Lamps' },
    { footer: { upper: { a1: 'The brand comes from the identity' } } },
    { footer: { lower: { a2: 'Lamp care' } } },
    { footer: { lower: { a1: ['1 Lantern Row'] } } },
    { footer: { lower: { b2: [''] } } },
    { footer: { middle: {} } },
  ]) assert.throws(() => validateDesignFile({ ...file, project: { ...file.project, ...project }, resolved }), JSON.stringify(project));
  // The resolved values, the fingerprint and the CSS come from the inputs alone.
  assert.equal(await fingerprint(own.inputs), await fingerprint(file.inputs));
  assert.equal(coreCss(own.resolved), coreCss(await resolve(file.inputs)));
});

test('an old design file loads and saves as it was, and one with content keeps it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-own-'));
  try {
    const old = join(directory, 'old.design.json');
    await copyFile(EXAMPLE, old);
    const model = await loadDesign(old);
    assert.equal(model.project.menu, undefined);
    assert.equal(model.project.footer, undefined);
    const saved = await saveDesign(old, model);
    assert.deepEqual(Object.keys(saved.project).sort(), Object.keys({ version: '1.0', ...JSON.parse(await readFile(EXAMPLE, 'utf8')).project }).sort());
    const own = join(directory, 'own.design.json');
    await saveDesign(own, { ...model, project: { ...model.project, menu: OWN_MENU, footer: OWN_FOOTER } });
    const again = await loadDesign(own);
    assert.deepEqual([again.project.menu, again.project.footer], [OWN_MENU, OWN_FOOTER]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the frame shows the design\'s own menu and footer where it has them, and the sample cell by cell where it has not', () => {
  const settings = withDefaults({ 'brand-colors': { primary: '#168b83' } });
  // Without content, the sample, exactly.
  assert.equal(menuOf({ name: 'A' }), sampleMenu);
  assert.equal(headerProps(settings.header, { name: 'A' }).menu, sampleMenu);
  // The design's own: every top item in the link menu, a third level among the second in order, and the descriptions.
  const menu = headerProps(settings.header, { name: 'A', menu: OWN_MENU }).menu;
  assert.deepEqual(menu, [
    { label: 'Lamps', href: '#lamps', children: [{ label: 'Desk lamps', href: '#desk-lamps', description: 'For the late hours' }, { label: 'Floor lamps', href: '#floor-lamps' }] },
    { label: 'Workshop', href: '#workshop', children: [{ label: 'Repairs', href: '#repairs', description: 'Old lamps made new' }, { label: 'Rewiring', href: '#rewiring' }] },
    { label: 'Öppettider', href: '#öppettider' },
  ]);

  const sample = footerProps(settings.footer, { name: 'A' }, settings.header);
  const own = footerProps(settings.footer, { name: 'A', menu: OWN_MENU, footer: OWN_FOOTER }, settings.header);
  // Upper B1: a network the library has is its icon, any other its name, escaped.
  assert.deepEqual([...own.upper.cells.b1.content.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]), ['Instagram']);
  assert.match(own.upper.cells.b1.content, /<a href="#mastodon">Mastodon<\/a>/);
  assert.equal(own.upper.cells.a2.text, 'Lamps for reading & <rest>.');
  // Upper B2 has no links of its own here, so it is the top level of the menu shown, the design's own.
  assert.deepEqual(own.upper.cells.b2.links.map((link) => link.label), ['Lamps', 'Workshop', 'Öppettider']);
  assert.deepEqual(sample.upper.cells.b2.links.map((link) => link.label), sampleMenu.map((item) => item.label));
  // A text of several lines keeps them, escaped.
  assert.equal(own.lower.cells.a1.content, '<p class="kn-footer-muted">1 Lantern Row<br>999 99 Nowhere</p>');
  assert.deepEqual(own.lower.cells.a2.links, [{ label: 'Lamp care', href: '#lamp-care' }]);
  // The cells it leaves empty keep the sample's.
  assert.equal(own.lower.cells.b1.text, sampleFooter.lower.b1);
  assert.deepEqual(own.lower.cells.b2, sample.lower.cells.b2);
  assert.ok(own.lower.cells.b2.links.every((link) => link.consentOpen));
  // Links of its own for navigation take the menu's place, and an empty list is as none.
  const links = footerProps(settings.footer, { name: 'A', menu: OWN_MENU, footer: { upper: { b2: ['Shop', 'Visit'] }, lower: { a2: [] } } }, settings.header);
  assert.deepEqual(links.upper.cells.b2.links.map((link) => link.label), ['Shop', 'Visit']);
  assert.deepEqual(links.lower.cells.a2, sample.lower.cells.a2);
  // A cell turned off stays off, whatever the design has for it.
  const off = footerProps({ ...settings.footer, lower: { ...settings.footer.lower, cells: { ...settings.footer.lower.cells, a1: false } } }, { name: 'A', footer: OWN_FOOTER }, settings.header);
  assert.equal(off.lower.cells.a1, false);
});

// The preview's frames: the page at each end, and the large menu held open under it.
const ends = async (page, selector) => Promise.all(['#view-wide', '#view-narrow'].map(async (view) => (await page.locator(`${view} ${selector}`).elementHandle()).contentFrame()));
const inAll = (frames, check, arg) => Promise.all(frames.map((frame) => frame.waitForFunction(check, arg, { timeout: 15000 })));

test('the Start page takes the client\'s own menu and footer, saves them with undo, and the preview follows as they are typed', { timeout: 240000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-own-tool-'));
  const path = join(directory, 'lantern.design.json');
  await copyFile(EXAMPLE, path);
  const tool = await startTool({ designFile: path, port: 0, open: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    const onDisk = async () => JSON.parse(await readFile(path, 'utf8'));
    const settled = async () => {
      await page.waitForFunction(() => document.getElementById('status').dataset.state === 'saved');
      return onDisk();
    };
    // Opening writes nothing, and each field says the sample shows, with the sample in grey.
    assert.equal(await readFile(path, 'utf8'), await readFile(EXAMPLE, 'utf8'));
    const field = (path) => page.locator(`[data-own="${path}"]`);
    const state = (path) => page.locator(`[data-own-state="${path}"]`);
    assert.equal(await field('menu').inputValue(), '');
    assert.match(await field('menu').getAttribute('placeholder'), /^Products\n {2}Compact series - For where space is short\n/);
    assert.match(await state('menu').textContent(), /sample/i);
    assert.equal(await state('footer.lower.a1').textContent(), 'Sample');
    assert.equal(await field('footer.lower.a1').getAttribute('placeholder'), sampleFooter.lower.a1);
    assert.equal(await field('footer.upper.b2').getAttribute('placeholder'), sampleMenu.map((item) => item.label).join('\n'));
    assert.equal(await page.locator('[data-own="footer.upper.a1"]').count(), 0, 'the brand has no field');
    // Every field says what it takes.
    for (const own of await page.locator('[data-own]').all()) assert.ok((await page.locator(`#${await own.getAttribute('data-g-tooltip')}`).textContent()).length > 40);

    const pages = await Promise.all(['#preview', '#preview-narrow'].map(async (selector) => (await page.locator(selector).elementHandle()).contentFrame()));
    const menus = await ends(page, '[data-panel-frame="menu"]');
    await inAll(menus, () => document.querySelector('.kn-page > .kn-header dialog[data-kn-panel="menu"]')?.matches(':modal'));

    // The menu, with a tab and pasted bullets, takes effect as it is typed: in the link menu and the large menu.
    await field('menu').click();
    await page.keyboard.type('Lamps\n\t- Desk lamps - For the late hours\n\t- Floor lamps\nWorkshop\n  Repairs');
    await inAll(pages, () => [...document.querySelectorAll('.kn-page > .kn-header .kn-header-link-menu a')].map((link) => link.textContent).join() === 'Lamps,Workshop');
    await inAll(menus, () => {
      const columns = [...document.querySelectorAll('.kn-page > .kn-header .kn-megamenu-column')];
      return columns.map((column) => column.querySelector('.kn-megamenu-heading').textContent.replace(/^\d+ \//, '')).join() === 'Lamps,Workshop'
        && columns[0].querySelector('.kn-megamenu-description')?.textContent === 'For the late hours'
        && columns[0].querySelectorAll('li').length === 2 && columns[1].querySelectorAll('li').length === 1
        && document.querySelector('dialog[data-kn-panel="menu"]').matches(':modal');
    });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.own), 'menu', 'the large menu opening took no focus');
    // The footer's links for navigation follow the menu where the design has none of its own.
    await inAll(pages, () => [...document.querySelectorAll('.kn-footer [data-kn-band="upper"] [data-kn-cell="b2"] a')].map((link) => link.textContent).join() === 'Lamps,Workshop');
    assert.equal(await state('footer.upper.b2').textContent(), 'From the menu');
    assert.equal(await field('footer.upper.b2').getAttribute('placeholder'), 'Lamps\nWorkshop');

    // A footer cell of the client's, of two lines; the others keep the sample.
    await field('footer.lower.a1').click();
    await page.keyboard.type('1 Lantern Row\n999 99 Nowhere');
    await field('footer.upper.b1').click();
    await page.keyboard.type('instagram\nMastodon');
    await page.locator('[data-page="start"] h1').click();
    let saved = await settled();
    assert.deepEqual(saved.project.menu, [{ label: 'Lamps', items: [{ label: 'Desk lamps', description: 'For the late hours' }, { label: 'Floor lamps' }] }, { label: 'Workshop', items: [{ label: 'Repairs' }] }]);
    assert.deepEqual(saved.project.footer, { lower: { a1: '1 Lantern Row\n999 99 Nowhere' }, upper: { b1: ['Instagram', 'Mastodon'] } });
    // The inputs are the example's, as the tool writes any design's, with its defaults, and the fingerprint theirs.
    assert.deepEqual(saved.inputs, withDefaults(JSON.parse(await readFile(EXAMPLE, 'utf8')).inputs));
    assert.equal(saved.resolved['inputs-fingerprint'], await fingerprint(saved.inputs));
    await inAll(pages, () => {
      const cell = (band, name) => document.querySelector(`.kn-footer [data-kn-band="${band}"] [data-kn-cell="${name}"]`);
      return cell('lower', 'a1')?.innerHTML.includes('1 Lantern Row<br>999 99 Nowhere')
        && cell('lower', 'b1')?.textContent.includes('Registration no.')
        && cell('upper', 'b1')?.querySelector('a[aria-label="Instagram"] svg') && cell('upper', 'b1')?.textContent.includes('Mastodon')
        && cell('upper', 'a2')?.textContent.includes('Clear information');
    });
    // Left, a field shows what it came to: the bullets and the tab gone, a network by its name.
    assert.equal(await field('menu').inputValue(), 'Lamps\n  Desk lamps - For the late hours\n  Floor lamps\nWorkshop\n  Repairs');
    assert.equal(await field('footer.upper.b1').inputValue(), 'Instagram\nMastodon');
    assert.equal(await state('menu').textContent(), 'The client’s own, in the header and the large menu');
    assert.equal(await state('footer.lower.a1').textContent(), 'Client’s');

    // Undo takes each burst back, field and file and preview; redo brings it again.
    await page.locator('#undo').click();
    saved = await settled();
    assert.equal(saved.project.footer.upper, undefined);
    assert.equal(await field('footer.upper.b1').inputValue(), '');
    await page.locator('#undo').click();
    saved = await settled();
    assert.equal(saved.project.footer, undefined);
    await inAll(pages, () => document.querySelector('.kn-footer [data-kn-band="lower"] [data-kn-cell="a1"]')?.textContent.includes('Example Street'));
    await page.locator('#undo').click();
    saved = await settled();
    assert.equal(saved.project.menu, undefined);
    assert.equal(await field('menu').inputValue(), '');
    await inAll(pages, () => [...document.querySelectorAll('.kn-page > .kn-header .kn-header-link-menu a')].map((link) => link.textContent).join() === 'Products,Services,Markets');
    await page.locator('#redo').click();
    saved = await settled();
    assert.equal(saved.project.menu.length, 2);
    assert.match(await field('menu').inputValue(), /^Lamps\n/);

    // An outline pasted from a document or a site comes as a list, and keeps its levels as indentation.
    await field('menu').fill('');
    await field('menu').focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Lamps\nDesk lamps\nWorkshop');
      data.setData('text/html', '<meta charset="utf-8"><ul><li><a href="/lamps">Lamps</a><ul><li><span>Desk lamps</span></li><li>Floor <b>lamps</b></li></ul></li><li>Workshop</li></ul>');
      document.querySelector('[data-own="menu"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await field('menu').inputValue(), 'Lamps\n  Desk lamps\n  Floor lamps\nWorkshop');
    // A Google Docs list says each item's level, and Word writes its levels in a style, its bullets in a span it ignores.
    for (const html of [
      '<ul><li aria-level="1"><p><span>Lamps</span></p></li><ul><li aria-level="2"><p><span>Desk lamps</span></p></li></ul><li aria-level="1"><p><span>Workshop</span></p></li></ul>',
      '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span> </span></span>Lamps</p><p class="MsoListParagraph" style="margin-left:1in;mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o<span> </span></span>Desk lamps</p><p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·</span>Workshop</p>',
      // A site's large menu, its headings over lists.
      '<div><h2><a>Lamps</a></h2><ul><li><a><span>Desk lamps</span></a></li></ul><h2>Workshop</h2></div>',
    ]) {
      await field('menu').fill('');
      await page.evaluate((markup) => {
        const data = new DataTransfer();
        data.setData('text/html', markup);
        document.querySelector('[data-own="menu"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      }, html);
      assert.equal(await field('menu').inputValue(), 'Lamps\n  Desk lamps\nWorkshop', html);
    }
    // Plain text, with no list in it, is pasted as the browser pastes it.
    await field('menu').fill('');
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/html', '<p>Just words</p>');
      const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      document.querySelector('[data-own="menu"]').dispatchEvent(event);
      window.knPasteTaken = event.defaultPrevented;
    });
    assert.equal(await page.evaluate(() => window.knPasteTaken), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

// Opening the large menu in its frame took the focus from the tool in Firefox, a moment later, and what was typed
// meanwhile was lost; the Start page opens it as it arrives, where a field may already be in use.
test('keys typed on the Start page as the large menu opens under it all arrive, in Firefox too', { timeout: 240000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-own-focus-'));
  const path = join(directory, 'lantern.design.json');
  await copyFile(EXAMPLE, path);
  const tool = await startTool({ designFile: path, port: 0, open: false });
  try {
    for (const engine of [firefox, chromium]) {
      const browser = await engine.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        await page.goto(tool.url);
        await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
        for (const round of [1, 2, 3]) {
          await page.locator('.chapter[data-chapter="colour"]').click();
          await page.locator('.chapter[data-chapter="start"]').click();
          const menu = page.locator('[data-own="menu"]');
          await menu.click();
          await page.keyboard.press('ControlOrMeta+a');
          const typed = `Round ${round}\n  Typed at once - as the menu opens\nAnother`;
          await page.keyboard.type(typed);
          await page.waitForTimeout(600);
          assert.equal(await menu.inputValue(), typed, `${engine.name()}, round ${round}`);
        }
        await inAll(await ends(page, '[data-panel-frame="menu"]'), () => document.querySelector('.kn-page > .kn-header dialog[data-kn-panel="menu"]')?.matches(':modal'));
      } finally {
        await browser.close();
      }
    }
  } finally {
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

function extractZip(bytes) {
  const length = bytes.readUInt16LE(26);
  const offset = 30 + length + bytes.readUInt16LE(28);
  return inflateRawSync(bytes.subarray(offset, offset + bytes.readUInt32LE(18))).toString('utf8');
}

test('the presentation shows the client\'s menu and footer in the header, the footer, the page, the sample page and the shadow scenes', { timeout: 300000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-own-presentation-'));
  const browser = await chromium.launch();
  try {
    const model = JSON.parse(await readFile(EXAMPLE, 'utf8'));
    model.project = { ...model.project, name: 'Lantern Row', menu: OWN_MENU, footer: OWN_FOOTER };
    // The sample page is in the page's flow, so its frame shows the footer once scrolled; the scenes are short.
    model.inputs.shadow = { ...model.inputs.shadow, strength: 50 };
    const design = join(directory, 'lantern.design.json');
    await writeFile(design, JSON.stringify(model));
    const zip = join(directory, 'lantern.zip');
    await createPresentation(design, zip, { date: '2026-11-11' });
    const html = join(directory, 'lantern.html');
    await writeFile(html, extractZip(await readFile(zip)));
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(html).href);
    const specimen = async (pageId, id) => {
      await page.evaluate((target) => { location.hash = target; }, pageId);
      const frame = page.locator(`[data-specimen-frame="${id}"]`);
      await frame.waitFor({ state: 'visible' });
      await page.waitForFunction((name) => document.querySelector(`[data-specimen-frame="${name}"]`)?.contentDocument?.querySelector('.sample-root'), id);
      return (await frame.elementHandle()).contentFrame();
    };
    const read = (frame) => frame.evaluate(() => {
      const words = (selector) => [...document.querySelectorAll(selector)].map((node) => node.textContent.replace(/^\d+ \//, '').trim());
      const cell = (band, name) => document.querySelector(`.kn-footer [data-kn-band="${band}"] [data-kn-cell="${name}"]`);
      return {
        links: words('.kn-header-link-menu a'),
        headings: words('.kn-megamenu-heading'),
        items: words('.kn-megamenu-column li > a > span:first-child'),
        descriptions: words('.kn-megamenu-description'),
        footer: cell('lower', 'a1') && {
          address: cell('lower', 'a1').querySelector('.kn-footer-box').innerHTML,
          registration: cell('lower', 'b1')?.textContent,
          networks: [...cell('upper', 'b1').querySelectorAll('a')].map((link) => link.getAttribute('aria-label') ?? link.textContent),
          statement: cell('upper', 'a2').textContent,
          navigation: words('.kn-footer [data-kn-band="upper"] [data-kn-cell="b2"] a'),
          policies: words('.kn-footer [data-kn-band="lower"] [data-kn-cell="a2"] a'),
          consent: words('.kn-footer [data-kn-band="lower"] [data-kn-cell="b2"] a'),
        },
      };
    });
    const ownFooter = {
      address: '<p class="kn-footer-muted">1 Lantern Row<br>999 99 Nowhere</p>',
      registration: sampleFooter.lower.b1,
      networks: ['Instagram', 'Mastodon'],
      statement: 'Lamps for reading & <rest>.',
      navigation: ['Lamps', 'Workshop', 'Öppettider'],
      policies: ['Lamp care'],
      consent: sampleFooter.lower.b2,
    };
    const ownMenu = { links: ['Lamps', 'Workshop', 'Öppettider'], headings: ['Lamps', 'Workshop', 'Öppettider'], items: ['Desk lamps', 'Floor lamps', 'Repairs', 'Rewiring'], descriptions: ['For the late hours', 'Old lamps made new'] };

    const header = await read(await specimen('header', 'header-a-menu'));
    assert.deepEqual({ ...header, footer: undefined }, { ...ownMenu, footer: undefined });
    assert.deepEqual((await read(await specimen('footer', 'footer'))).footer, ownFooter);
    for (const id of ['page-layout', 'preview']) {
      const shown = await read(await specimen('page', id));
      assert.deepEqual(shown.links, ownMenu.links, id);
      assert.deepEqual(shown.footer, ownFooter, id);
    }
    // The shadow scenes' short menu is the first three of the client's, two links to a column and no descriptions.
    const scene = await read(await specimen('shadow', 'shadow-panel'));
    assert.deepEqual([scene.links, scene.headings, scene.items, scene.descriptions], [ownMenu.links, ownMenu.headings, ownMenu.items, []]);
    assert.deepEqual((await read(await specimen('shadow', 'shadow-page'))).footer, ownFooter);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});
