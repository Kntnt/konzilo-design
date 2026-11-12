// What CSS and the browser now do without this package's script (docs/spec/principles.md, HTML and CSS, not
// JavaScript): forms are checked by the browser itself, and tabs, choice, a section's head, the Reading Area, the
// header and the footer have no runtime left. The header's and the footer's behaviour is tested in frame-css.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright-core';
import { render } from './helpers/render.js';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

const GONE = ['form', 'tabs', 'choice', 'section', 'reading-area'];

test('the runtimes CSS replaced are gone, and nothing imports them', async () => {
  for (const name of GONE) assert.equal(existsSync(new URL(`../src/components/${name}.js`, import.meta.url)), false, name);
  const roots = ['../src/', '../gallery/src/', '../presentation/src/', '../tool/'];
  for (const root of roots) {
    const files = (await readdir(new URL(root, import.meta.url), { recursive: true })).filter((file) => /\.(js|mjs|astro|ts)$/.test(file));
    for (const file of files) {
      const source = await readFile(new URL(`${root}${file}`, import.meta.url), 'utf8');
      const inComponents = root === '../src/' && file.startsWith('components/');
      for (const name of GONE) assert.doesNotMatch(source, new RegExp(`components/${name}\\.js${inComponents ? `|['"]\\./${name}\\.js['"]` : ''}`), `${root}${file} imports ${name}.js`);
      assert.doesNotMatch(source, /setup(Forms|Tabs|Choices|Sections|ReadingAreas|Headers|Footers)\b/, `${root}${file}`);
    }
  }
});

test('the header and the footer keep only their build-time helpers, and each polyfill names its feature and its end', async () => {
  for (const name of ['header', 'footer']) {
    const source = await readFile(new URL(`../src/components/${name}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(?:document|window|addEventListener|ResizeObserver|requestAnimationFrame)\b/, `${name}.js touches no page`);
    assert.doesNotMatch(source, /schedule\.js/, `${name}.js schedules nothing`);
  }
  // The scroll timelines' stands in also where the browser's style queries miss what they set, as Firefox's do.
  for (const [file, guard] of [['scroll-timeline-polyfill.js', "const timelines = CSS.supports('animation-timeline: scroll()');\nif (!timelines || !follows()) {"], ['scroll-state-polyfill.js', "if (!CSS.supports('container-type: scroll-state')) {"]]) {
    const source = await readFile(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /^\/\/ Polyfill for /, `${file} says what it stands in for`);
    assert.match(source, /Delete this file once every engine has/, `${file} says when it goes`);
    assert.ok(source.includes(guard), `${file} does nothing where the browser has the feature`);
    assert.ok(source.split('\n').length <= 45, `${file} is small`);
    // Its test of the browser tries two elements of its own, in a shadow tree, and removes them at once.
    const follows = source.match(/^const follows = .*$/m)?.[0] ?? '';
    if (follows) assert.match(follows, /attachShadow\(.*document\.documentElement\.append\(host\);.*host\.remove\(\);/);
    // Else it sets a flag or an attribute and nothing else: no style but custom properties, no markup, no class.
    const rest = source.replace(follows, '');
    assert.doesNotMatch(rest, /\.style\.(?!setProperty\(|getPropertyValue\()|classList|innerHTML|createElement/, file);
    assert.doesNotMatch(rest, /setProperty\((?!flag)/, file);
  }
});

test('Form writes no script, and a field is still described by its help and its error, each once', async () => {
  const form = await render('Form', { action: '/contact/' }, { default: await render('Field', { name: 'email', label: 'Email', type: 'email', required: true, help: 'We answer within a day.' }) });
  assert.doesNotMatch(form, /<script/);
  const [, ids] = form.match(/<input[^>]*aria-describedby="([^"]+)"/);
  assert.deepEqual(ids.split(' ').map((id) => id.replace(/^.*-(help|error)$/, '$1')), ['help', 'error']);
});

test('the browser checks a form on submit, with script and without, and a field left wrong takes the error colour', { timeout: 120000 }, async () => {
  const styles = `${coreCss(derive(defaultInputs()))}${await componentsCss()}`;
  const form = await render('Form', { action: '#sent', method: 'get' }, { default: await render('Field', { name: 'email', label: 'Email', type: 'email', required: true }), actions: '<button type="submit">Send</button>' });
  for (const [name, type] of Object.entries({ firefox, webkit, chromium })) {
    if (!existsSync(type.executablePath())) continue;
    const browser = await type.launch();
    try {
      for (const script of [true, false]) {
        const context = await browser.newContext({ javaScriptEnabled: script });
        const tab = await context.newPage();
        await tab.setContent(`<!doctype html><html lang="en"><head><style>${styles}</style></head><body data-kn-surface="page">${form}<p id="error" style="color: var(--kn-error)">x</p></body></html>`);
        const before = tab.url();
        const control = tab.locator('input[type="email"]');
        const border = () => control.evaluate((input) => getComputedStyle(input).borderBlockStartColor);
        const error = await tab.$eval('#error', (p) => getComputedStyle(p).color);
        assert.notEqual(await border(), error, `${name}: untouched, no error`);
        await control.fill('not an address');
        await tab.click('button[type="submit"]');
        assert.equal(tab.url(), before, `${name}${script ? '' : ' without script'}: the browser held the submission back`);
        assert.equal(await border(), error, `${name}${script ? '' : ' without script'}: the field takes the error colour`);
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
});
