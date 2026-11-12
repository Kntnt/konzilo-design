import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'ultrahtml';
import { querySelectorAll as all, querySelector as one } from 'ultrahtml/selector';
import { arrangementGroups, givingWaySteps, GIVING_WAY_ORDER } from '../src/components/header.js';
import { render } from './helpers/render.js';

test('arrangements fix group and document order, omitting absent items', () => {
  const all = Object.fromEntries(['links', 'menu', 'search', 'language', 'cta'].map((key) => [key, true]));
  assert.deepEqual(arrangementGroups('A', all), [['identity'], ['search', 'language', 'links', 'menu', 'cta']]);
  assert.deepEqual(arrangementGroups('B', all), [['identity', 'links'], ['search', 'language', 'menu', 'cta']]);
  assert.deepEqual(arrangementGroups('C', all), [['identity', 'links', 'search'], ['language', 'menu', 'cta']]);
  assert.deepEqual(arrangementGroups('C'), [['identity'], []]);
  assert.throws(() => arrangementGroups('D'));
});

test('giving way keeps the required order and leaves out steps with nothing to take', () => {
  const everything = { slogan: true, logo: true, name: true, links: true, word: true, language: true, cta: true, search: true };
  assert.deepEqual(givingWaySteps(everything), GIVING_WAY_ORDER);
  assert.deepEqual(givingWaySteps({ ...everything, logo: false }), GIVING_WAY_ORDER.filter((step) => step !== 'name'), 'a name without a logo never goes');
  assert.deepEqual(givingWaySteps({ name: true, logo: true, cta: true }), ['name', 'cta']);
  assert.deepEqual(givingWaySteps(), []);
});

const identity = { label: 'Example', href: '/', name: 'Example', slogan: 'Slogan', logo: { light: '/light.svg', dark: '/dark.svg' } };
const menu = [{ label: 'One', href: '/one' }, { label: 'Two', href: '/two', children: [{ label: 'Two A', href: '/two/a' }] }];
const everything = { identity, menu, linkMenu: true, menuButton: { word: 'Menu' }, languages: [{ label: 'English', code: 'en', href: '/', current: true }, { label: 'Svenska', code: 'sv', href: '/sv/' }], search: { action: '/search/' }, cta: { label: 'Contact', href: '/contact/' } };

test('a header writes its bar once, with the giving-way steps it can take for its script to measure', async () => {
  const tree = parse(await render('Header', everything));
  const header = one(tree, '.kn-header');
  assert.equal(header.attributes['data-kn-steps'], GIVING_WAY_ORDER.join(' '));
  assert.ok(!('data-kn-step' in header.attributes), 'no step is written: without the script the bar shows its narrowest');
  assert.equal(all(tree, '.kn-header-row').length, 1);
  assert.equal(all(tree, '.kn-header-identity').length, 1);
  assert.equal(all(tree, '.kn-header-link-menu').length, 1);
  assert.equal(all(tree, '[inert], .kn-header-copy, .kn-header-probe, .kn-header-slack').length, 0, 'no hidden copy of the bar');
  const row = one(tree, '.kn-header-row');
  assert.ok(one(row, 'dialog.kn-megamenu') && one(row, 'dialog.kn-header-search-overlay'), 'the panels lie in the row');
  // The giving-way script inline, as the header's last child but the polyfill loaders, so it runs before the page paints.
  const scripts = all(tree, 'script[data-kn-header-fit]');
  assert.equal(scripts.length, 1);
  assert.ok(!('src' in scripts[0].attributes) && !('type' in scripts[0].attributes), 'a classic inline script');
  const code = scripts[0].children.map((node) => node.value).join('');
  assert.match(code, /^\(\(\) => \{/, 'wrapped, so two headers on a page share no global names');
  assert.match(code, /window\.knHeaderFit \?\?= setup\(\)/, 'and set up once');
  assert.match(code, /document\.currentScript\?\.closest\('\.kn-header\[data-kn-steps\]'\)/, 'each fitting its own header');
  assert.doesNotMatch(code, /^\s*\/\//m, 'without its comments');
  const children = header.children.filter((node) => node.type === 1);
  assert.equal(children.find((node) => node.name === 'script').attributes['data-kn-header-fit'] !== undefined, true);
  const plain = parse(await render('Header', { identity: { label: 'Name', href: '/', name: 'Name' } }));
  assert.equal(one(plain, '.kn-header').attributes['data-kn-steps'], '', 'a name without a logo never goes, and nothing else is there');
});

test('the panels open with no script: dialogs by the invoker command, the languages by a popover', async () => {
  const tree = parse(await render('Header', everything));
  const row = one(tree, '.kn-header-row');
  const menuButton = one(row, '[data-kn-trigger="menu"]');
  const search = one(row, '[data-kn-trigger="search"]');
  for (const trigger of [menuButton, search]) {
    assert.equal(trigger.name, 'button');
    assert.equal(trigger.attributes.command, 'show-modal');
    assert.equal(trigger.attributes['aria-haspopup'], 'dialog');
    assert.equal(trigger.attributes.commandfor, trigger.attributes['aria-controls']);
    const dialog = one(tree, `#${trigger.attributes.commandfor}`);
    assert.equal(dialog.name, 'dialog');
    assert.equal(dialog.attributes.closedby, 'any');
    assert.ok(!('aria-expanded' in trigger.attributes), 'no state written that the browser does not keep');
  }
  assert.ok('autofocus' in one(tree, '.kn-header-search-overlay input[name="q"]').attributes);
  assert.equal(one(tree, '.kn-header-search-dismiss').attributes.command, 'close');
  const globe = one(row, '[data-kn-trigger="language"]');
  assert.equal(one(tree, `#${globe.attributes.popovertarget}`).attributes.popover, 'auto');
  const cta = await render('Header', { ...everything, cta: { label: 'Write to us', dialog: 'contact' } });
  assert.match(cta, /<button[^>]*commandfor="contact"[^>]*command="show-modal"[^>]*class="[^"]*kn-header-cta/);
});

test('the search box writes its close button and what its empty field shows as the site asks, and closes without the button too', async () => {
  const fields = (tree) => all(tree, '.kn-search-field').map((field) => ({ placeholder: one(field, 'input').attributes.placeholder, icon: !!one(field, 'svg.kn-icon'), shows: field.attributes['data-kn-placeholder'], surface: field.attributes['data-kn-surface'] }));
  // By default, as before: the close button, and the label as the word in the empty field, in the box and in the menu.
  const plain = parse(await render('Header', { ...everything, search: { action: '/search/', label: 'Search the site' } }));
  assert.ok(one(plain, '.kn-header-search-overlay [data-kn-close]'));
  assert.deepEqual(fields(plain), Array(2).fill({ placeholder: 'Search the site', icon: false, shows: 'word', surface: 'page' }));
  // The site's own word, which the label still names.
  const word = parse(await render('Header', { ...everything, search: { action: '/search/', label: 'Sök på webbplatsen', word: 'Sök' } }));
  assert.deepEqual(fields(word).map(({ placeholder }) => placeholder), ['Sök', 'Sök']);
  assert.equal(one(word, '.kn-header-search-overlay input').attributes['aria-label'], 'Sök på webbplatsen');
  // A magnifier, with a placeholder of one space for the CSS to tell an empty field by; or nothing.
  const icon = parse(await render('Header', { ...everything, search: { action: '/search/', placeholder: 'icon' } }));
  assert.deepEqual(fields(icon), Array(2).fill({ placeholder: ' ', icon: true, shows: 'icon', surface: 'page' }));
  assert.equal(one(icon, '.kn-search-field svg').attributes['aria-hidden'], 'true');
  const none = parse(await render('Header', { ...everything, search: { action: '/search/', placeholder: 'none', close: false } }));
  assert.deepEqual(fields(none).map(({ placeholder, icon: shown }) => [placeholder, shown]), [[undefined, false], [undefined, false]]);
  // Without the close button, Esc closes the dialog as before, and a click beside the box lands on the dismissing button.
  assert.equal(one(none, '[data-kn-close]'), undefined);
  assert.equal(one(none, '.kn-header-search-dismiss').attributes.command, 'close');
  assert.equal(one(none, '.kn-header-search-overlay').attributes.closedby, 'any');
});

test('only a sticky header loads a polyfill, and only one that slides away loads the scroll-state one', async () => {
  const scripts = async (props) => all(parse(await render('Header', { ...everything, ...props })), 'script').map((script) => script.attributes['data-kn-polyfill']);
  const polyfills = async (props) => (await scripts(props)).filter(Boolean);
  assert.deepEqual(await polyfills({}), []);
  assert.deepEqual(await polyfills({ autohide: true }), [], 'a flow header neither sticks nor slides away');
  assert.deepEqual(await polyfills({ attachment: 'sticky' }), ['scroll-timeline']);
  assert.deepEqual(await polyfills({ attachment: 'sticky', autohide: true }), ['scroll-timeline', 'scroll-state']);
  const loader = await render('Header', { ...everything, attachment: 'sticky', autohide: true });
  // The scroll timelines' polyfill also where the browser's style queries miss what they set, as Firefox's do, which the
  // loader tests as the polyfill does, word for word.
  assert.match(loader, /\nif \(!CSS\.supports\('animation-timeline: scroll\(\)'\) \|\| !follows\(\)\) import\(src\);/);
  const polyfill = await readFile(new URL('../src/components/scroll-timeline-polyfill.js', import.meta.url), 'utf8');
  assert.ok(loader.includes(`\n${polyfill.match(/^const follows = .*$/m)[0]}\n`), 'the loader\'s test is the polyfill\'s');
  assert.match(loader, /if \(!CSS\.supports\('container-type: scroll-state'\)\) import\(src\);/);
  const flow = parse(await render('Header', { ...everything, start: 'under', autohide: true }));
  assert.equal(one(flow, '.kn-header').attributes['data-kn-start'], 'below', 'page start and sliding away are a sticky header\'s only');
  assert.equal(one(flow, '.kn-header').attributes['data-kn-autohide'], 'false');
  // A translucent header says so on itself, for its CSS (the owner, 2026-11-12).
  assert.equal(one(flow, '.kn-header').attributes['data-kn-translucent'], 'false');
  assert.equal(one(parse(await render('Header', { ...everything, translucent: true })), '.kn-header').attributes['data-kn-translucent'], 'true');
});
