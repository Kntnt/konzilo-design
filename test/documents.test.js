// What the documents say of the code, where it can be read from the code: a document that falls out of step fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import schema from '../schema/design-file.schema.json' with { type: 'json' };
import { STEPS } from '../src/generator/index.js';
import { SERVICES } from '../src/directives/actions.js';
import { icons } from '../src/components/icons.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const quoted = (text) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
const rowOf = (document, key) => read(document).split('\n').find((line) => line.startsWith(`| \`${key}\``));

test('names.md gives the hero\'s Surfaces and a ramp\'s steps as the schema and the generator have them', () => {
  const heroSurfaces = schema.$defs['hero-settings'].properties.surface.enum;
  assert.deepEqual(quoted(rowOf('docs/spec/names.md', 'inputs.hero.surface').split('|')[2]), heroSurfaces);
  const steps = rowOf('docs/spec/names.md', '100');
  assert.match(steps, new RegExp(`each ramp's ${{ 9: 'nine', 12: 'twelve' }[STEPS.length]} steps`));
  for (const step of STEPS.filter((one) => one % 100)) assert.ok(steps.split('|')[1].includes(`\`${step}\``), step);
});

test('generator.md names every key of a design file\'s project', () => {
  const text = read('docs/generator.md');
  for (const key of Object.keys(schema.properties.project.properties)) assert.ok(text.includes(`\`project.${key}\``), `project.${key}`);
});

test('generator.md says the tool writes a new design file as it starts', () => {
  assert.doesNotMatch(read('docs/generator.md'), /created on first save/);
});

test('directives.md names the icons of the services as the code has them, none of them still to come', () => {
  const sentence = read('docs/spec/directives.md').split('\n').find((line) => line.startsWith('`SERVICES` today:'));
  for (const [name, { icon }] of Object.entries(SERVICES)) {
    assert.ok(sentence.includes(`\`${name}\``), name);
    assert.ok(sentence.includes(`\`${icon}\``), icon);
    assert.ok(icons[icon], `${icon} is in icons.js`);
  }
  assert.doesNotMatch(sentence, /to be added/);
});
