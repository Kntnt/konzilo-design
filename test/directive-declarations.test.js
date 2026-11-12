// The directives' declarations (src/directives/components.json), as a Konzilo site takes them by `componentsFrom`: held to
// the shape the core reads a component in (its src/format/components.js and src/astro/directives.js, restated here, since
// nothing here imports the core), to docs/spec/directives.md's table and Markdown, and to the package's exports, resolved
// as the core resolves a specifier, by Node's require() from the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import components from '../src/directives/components.json' with { type: 'json' };
import { markerAttributes } from '../src/directives/markers.js';
import { DIRECTIVES } from '../src/directives/render/render.js';
import { DESIGN_COMPONENT_CHECKS, DESIGN_COMPONENTS_FROM, DESIGN_DIRECTIVES, DESIGN_PRESENTATIONS } from '../src/konzilo/index.js';
import { renderMarkdown } from './helpers/konzilo-body.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ATTRIBUTE = /^[a-z][a-zA-Z0-9]*$/;
const RESERVED = new Set(['id', 'class', 'content']);
const BODIES = { leaf: ['none', 'text'], container: ['blocks'] };
const TYPES = ['string', 'integer', 'boolean'];
// The core's elements: a component named as one that is no directive is the element `<name>-directive`.
const CORE_ELEMENTS = ['paragraph', 'heading', 'list', 'quote', 'code', 'table', 'footnotes', 'embed', 'image', 'gallery', 'post-list', 'form'];
const CORE_DIRECTIVES = ['post-list', 'form'];
const fits = (type, value) => (type === 'string' ? typeof value === 'string' : type === 'integer' ? Number.isInteger(value) : typeof value === 'boolean');

test('each declaration has the shape the core reads a component in', () => {
  assert.deepEqual(Object.keys(components), [...DIRECTIVES]);
  for (const [name, component] of Object.entries(components)) {
    assert.match(name, NAME, name);
    assert.ok(!CORE_DIRECTIVES.includes(name), `${name} is the core's own directive`);
    assert.deepEqual(Object.keys(component).filter((key) => !['label', 'form', 'body', 'attributes'].includes(key)), [], name);
    assert.equal(typeof component.label, 'string', name);
    assert.ok(component.label.trim(), name);
    assert.ok(BODIES[component.form]?.includes(component.body), `${name}: ${component.form} with ${component.body}`);
    for (const [attribute, setting] of Object.entries(component.attributes ?? {})) {
      const at = `${name}.${attribute}`;
      assert.match(attribute, ATTRIBUTE, at);
      assert.ok(!RESERVED.has(attribute), at);
      assert.deepEqual(Object.keys(setting).filter((key) => !['type', 'label', 'values', 'default', 'pattern', 'refusal', 'required'].includes(key)), [], at);
      assert.ok(TYPES.includes(setting.type), at);
      assert.equal(typeof setting.label, 'string', at);
      if (setting.values) {
        assert.ok(setting.values.length > 0 && setting.values.every((value) => fits(setting.type, value)), at);
        assert.equal(new Set(setting.values).size, setting.values.length, at);
      }
      if (setting.pattern) assert.doesNotThrow(() => new RegExp(setting.pattern, 'u'), at);
      if (Object.hasOwn(setting, 'default')) {
        assert.ok(!setting.required, at);
        assert.ok(fits(setting.type, setting.default), at);
        if (setting.values) assert.ok(setting.values.includes(setting.default), at);
        if (setting.pattern && setting.default !== '') assert.match(String(setting.default), new RegExp(setting.pattern, 'u'), at);
      }
      // Each attribute that takes listed values or a pattern says why it refuses one, with the value.
      if (setting.values || setting.pattern) assert.match(setting.refusal ?? '', /\{value\}/, at);
    }
  }
  // A hero's Surface has no default: left out, it is the design's own.
  assert.equal(Object.hasOwn(components.hero.attributes.surface, 'default'), false);
});

test('only the list is named as an element of the core\'s, so its element is list-directive', () => {
  const elements = Object.keys(components).map((name) => (CORE_ELEMENTS.includes(name) ? `${name}-directive` : name));
  assert.deepEqual(elements, ['hero', 'section', 'aside', 'list-directive', 'cards', 'accordion', 'tabs', 'toc', 'choice', 'eyebrow', 'small', 'breadcrumbs']);
});

test('the markers a list and cards take are what markerAttributes reads', () => {
  const list = new RegExp(components.list.attributes.markers.pattern);
  const cards = new RegExp(components.cards.attributes.markers.pattern);
  const read = (markers) => markers.split('/').every((value, at) => value.trim() === '' || Object.keys(markerAttributes(markers, at + 1, !/^[v✓x✗]$/.test(value))).length > 0);
  for (const value of ['v', '✓', 'x', '✗', '1', '1.', '1)', '(1)', 'a)', 'A.', 'i', 'I.', 'α', 'aa', '1./a)', '1/1.1', '1/1.1/1.1.1', 'A./A.1', '(i)/(a)', 'v/x', '1//a']) {
    assert.match(value, list, value);
    assert.ok(read(value), `markerAttributes reads ${value}`);
  }
  for (const value of ['b', '2', 'vv', '1.b', '(1', '1))', 'check', ' 1', 'A-', '1.)']) assert.doesNotMatch(value, list, value);
  for (const value of ['v', 'x', '1', '1.', 'A.', '(i)', 'aa)']) assert.match(value, cards, value);
  for (const value of ['1/a', '1.1', 'v/x']) assert.doesNotMatch(value, cards, value);
});

test('the exports a site names resolve from the site, as the core finds a package specifier', () => {
  const require = createRequire(join(repo, 'package.json'));
  assert.equal(DESIGN_COMPONENTS_FROM, '@kntnt/konzilo-design/directives/components.json');
  assert.equal(DESIGN_COMPONENT_CHECKS, '@kntnt/konzilo-design/directives/checks');
  assert.equal(require.resolve(DESIGN_COMPONENTS_FROM), join(repo, 'src/directives/components.json'));
  assert.equal(require.resolve(DESIGN_COMPONENT_CHECKS), join(repo, 'src/directives/checks.js'));
  assert.deepEqual(Object.keys(DESIGN_DIRECTIVES), Object.keys(components));
  for (const [name, specifier] of Object.entries(DESIGN_DIRECTIVES)) {
    const file = require.resolve(specifier);
    assert.match(readFileSync(file, 'utf8'), new RegExp(`renderDirective\\('${name}'`), name);
  }
  assert.deepEqual(Object.keys(DESIGN_PRESENTATIONS), ['cards', 'featured', 'filtered']);
  for (const [name, specifier] of Object.entries(DESIGN_PRESENTATIONS)) assert.match(readFileSync(require.resolve(specifier), 'utf8'), new RegExp(`presentationHtml\\('${name}'`), name);
});

// docs/spec/directives.md, The declarations: a row for each directive, its element, form and body, label and attributes.
const doc = readFileSync(join(repo, 'docs/spec/directives.md'), 'utf8');

test('directives.md\'s table of declarations is components.json\'s', () => {
  const lines = doc.slice(doc.indexOf('| Directive | Element |')).split('\n');
  const table = lines.slice(2, lines.findIndex((line) => !line.startsWith('|')));
  const rows = Object.fromEntries(table.map((line) => {
    const cells = line.split(' | ').map((cell) => cell.replace(/^\| ?| ?\|$/g, ''));
    return [cells[0].replaceAll('`', ''), cells];
  }));
  assert.deepEqual(Object.keys(rows), Object.keys(components));
  for (const [name, component] of Object.entries(components)) {
    const [, element, form, label, attributes] = rows[name];
    assert.equal(element, `\`${CORE_ELEMENTS.includes(name) ? `${name}-directive` : name}\``, name);
    assert.equal(form, `${component.form}, ${component.body}`, name);
    assert.equal(label, component.label, name);
    const named = [...attributes.matchAll(/`([a-zA-Z]+)`:/g)].map((match) => match[1]);
    assert.deepEqual(named, Object.keys(component.attributes ?? {}), name);
    for (const [attribute, setting] of Object.entries(component.attributes ?? {})) {
      const cell = attributes.slice(attributes.indexOf(`\`${attribute}\`:`)).split(';')[0];
      for (const value of setting.values ?? []) assert.ok(cell.includes(`\`${value}\``), `${name}.${attribute}: ${value}`);
      assert.ok(Object.hasOwn(setting, 'default') ? cell.includes(`default \`${setting.default}\``) : /no default/.test(cell) || !setting.values, `${name}.${attribute}: its default`);
    }
    if (!component.attributes) assert.equal(attributes, 'none', name);
  }
});

test('the Markdown directives.md gives each directive reads and draws without a warning', () => {
  const examples = [...doc.matchAll(/```markdown\n([\s\S]*?)```/g)].map((match) => match[1]);
  assert.ok(examples.length >= 12, `${examples.length} examples`);
  for (const markdown of examples) {
    const warnings = [];
    const html = renderMarkdown(markdown, { warn: (message) => warnings.push(message), breadcrumbs: [{ name: 'Home', href: '/' }, { name: 'Guides', href: '/guides/' }, { name: 'A page', href: '/guides/a/' }] });
    assert.deepEqual(warnings, [], markdown);
    assert.doesNotMatch(html, /data-directive="(?!post-list|form)/, `every directive of the package's is drawn: ${markdown}`);
  }
});
