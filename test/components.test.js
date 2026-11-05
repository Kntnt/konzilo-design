import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse, walk, lexer, generate } from 'css-tree';
import { derive, defaultInputs } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { icons } from '../src/components/icons.js';

const directory = new URL('../src/components/', import.meta.url);
const physical = /^(?:(?:min-|max-)?(?:width|height)|left|right|top|bottom|(?:margin|padding|inset)-(?:left|right|top|bottom)|border-(?:left|right|top|bottom)(?:-(?:width|style|color))?|border-(?:top|bottom)-(?:left|right)-radius)$/;
const colorFunctions = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)$/i;

test('component CSS uses only logical properties, role reads and permitted drawing units', async () => {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.css'));
  const css = await Promise.all(files.map((name) => readFile(new URL(name, directory), 'utf8')));
  const withRoles = { ...defaultInputs(), typefaces: { main: 'Mona Sans', monospace: 'Mona Sans Mono' } };
  const axes = { axes: { wdth: 100, opsz: 20 } };
  withRoles.type = { ...withRoles.type, roles: { main: axes, heading: axes, 'heading-1': axes, display: axes, label: axes, monospace: axes } };
  const emitted = new Set([defaultInputs(), withRoles].flatMap((inputs) => [...coreCss(derive(inputs)).matchAll(/(--kn-[\w-]+)\s*:/g)].map(([, name]) => name)));
  // Band sets the picture in its markup, for the Surface and a component to read.
  const shared = new Set(['--kn-picture-image', ...css.flatMap((source) => [...source.matchAll(/(--kn-[\w-]+)\s*:/g)].map(([, name]) => name))]);
  for (const [i, source] of css.entries()) {
    const name = files[i];
    const ast = parse(source, { parseCustomProperty: true });
    const local = new Set();
    walk(ast, { visit: 'Declaration', enter(node) { if (node.property.startsWith('--kn-')) local.add(node.property); } });
    assert.doesNotMatch(source, /--kn-space-[1-8]\b/, name);
    assert.doesNotMatch(source, /\b(?:if|style)\(/, name);
    for (const [, role] of source.matchAll(/var\(\s*(--kn-[\w-]+)/g)) assert.ok(emitted.has(role) || shared.has(role) || local.has(role), `${name}: unknown role ${role}`);
    walk(ast, { visit: 'Declaration', enter(declaration) {
      assert.ok(!physical.test(declaration.property), `${name}: physical property ${declaration.property}`);
      if (declaration.property === 'line-height') assert.doesNotMatch(generate(declaration.value), /\d(?:px|rem|em|%)/, name);
      walk(declaration.value, (node) => {
        assert.notEqual(node.type, 'Hash', `${name}: literal colour`);
        if (node.type === 'Function') assert.ok(!colorFunctions.test(node.name), `${name}: literal colour function ${node.name}`);
        if (node.type === 'Identifier' && !['currentcolor', 'transparent'].includes(node.name.toLowerCase())) {
          assert.ok(!lexer.matchType('color', node).matched, `${name}: literal colour ${node.name}`);
        }
        if (node.type === 'Dimension' && node.unit === 'px') {
          assert.ok(['1', '2'].includes(node.value), `${name}: non-drawing pixel length`);
          assert.match(declaration.property, /^(?:border|outline|box-shadow|text-decoration-thickness)/, `${name}: pixels outside a drawn line`);
        }
      });
    } });
    if (name !== 'index.css') assert.match(source, new RegExp(`@layer ${name === 'base.css' ? 'kn-base' : 'kn-components'}\\s*\\{`), name);
  }
});

test('the plain HTML stylesheet flattens the component entry point and preserves layer order', async () => {
  const css = await componentsCss();
  assert.doesNotMatch(css, /@import/);
  assert.match(css, /^@layer kn-core, kn-base, kn-components;/);
  for (const component of ['body-text', 'heading-group', 'icon', 'button', 'link-group', 'card', 'card-grid', 'page', 'band', 'reading-area', 'aside-block', 'sidenote', 'figure', 'hero', 'text-image', 'cta-band', 'key-figures', 'header', 'footer', 'footer-band', 'footer-cell', 'table', 'accordion', 'quotation', 'callout', 'breadcrumbs', 'toc', 'content-loop', 'content-card', 'content-row', 'search-box', 'switch', 'visitor-filters', 'pagination', 'video', 'embed', 'form', 'consent']) assert.ok(css.includes(`.kn-${component}`));
  assert.equal(execFileSync(process.execPath, [new URL('../bin/konzilo-design.js', import.meta.url).pathname, 'components-css'], { encoding: 'utf8' }), css);
});

test('every component has a typed wrapper; seven library runtimes and only the declared client entries', async () => {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.astro'));
  for (const name of names) {
    const source = await readFile(new URL(name, directory), 'utf8');
    assert.match(source, /interface Props/);
    assert.doesNotMatch(source, /import\s+['"][^'"]+\.css|client:/);
    const entry = { 'ReadingArea.astro': 'reading-area', 'Header.astro': 'header', 'Footer.astro': 'footer', 'ContentLoop.astro': 'embed', 'Embed.astro': 'embed', 'VisitorFilters.astro': 'visitor-filters', 'Form.astro': 'form', 'ConsentBanner.astro': 'consent' }[name];
    if (entry) assert.match(source, new RegExp(`<script>[\\s\\S]*${entry}\\.js`));
    else if (name === 'Accordion.astro') {
      assert.equal([...source.matchAll(/<script/g)].length, 1);
      assert.match(source, /<script type="application\/ld\+json" is:inline set:html=/);
    } else assert.doesNotMatch(source, /<script/);
    assert.doesNotMatch(source, /<h[1-6]\b/);
  }
  assert.equal(Object.keys(icons).length, 28);
  for (const markup of Object.values(icons)) assert.doesNotMatch(markup, /<svg|<script|\bhref=/);
  assert.match(await readFile(new URL('LICENSE-lucide.txt', directory), 'utf8'), /ISC License/);
  assert.match(await readFile(new URL('LICENSE-tabler.txt', directory), 'utf8'), /MIT License/);
});

test('bands join each supported identical Surface with CSS adjacency in both directions', async () => {
  const source = await readFile(new URL('band.css', directory), 'utf8');
  for (const kind of ['page', 'raised', 'tint', 'tint-secondary', 'tint-tertiary', 'brand', 'inverse', 'accent', 'picture-light', 'picture-dark', 'status-info', 'status-success', 'status-warning', 'status-error']) {
    const selector = `.kn-band[data-kn-surface="${kind}"]`;
    assert.ok(source.includes(`${selector}:has(+ ${selector}) { padding-block-end: 0; }`));
    assert.ok(source.includes(`${selector} + ${selector} { padding-block-start: var(--kn-space-band-run); }`));
  }
  assert.match(source, /:not\(\[data-kn-surface\]\):has\(\+ /);
  assert.match(source, /:not\(\[data-kn-surface\]\) \+ /);
});

test('Body Text leaves headings with an explicit visual type alone', async () => {
  const css = await readFile(new URL('../src/components/body-text.css', import.meta.url), 'utf8');
  for (const level of [1, 2, 3, 4, 5, 6]) assert.ok(css.includes(`.kn-body-text h${level}:not([data-kn-type])`), `h${level}`);
});

test('the browser-drawn parts of form controls stay light on every Surface, and only the parts', async () => {
  const css = await readFile(new URL('../src/components/form.css', import.meta.url), 'utf8');
  assert.match(css, /\.kn-field-option input, \.kn-field-control\[type="number"\]::-webkit-inner-spin-button \{ color-scheme: light; \}/);
  assert.doesNotMatch(css, /\.kn-field-control(?:\[type="number"\])?(?:,[^{]*)? \{[^}]*color-scheme/);
});

