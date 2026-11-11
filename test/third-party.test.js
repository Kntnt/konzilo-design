// What the design system installs leaves it free: every package in the lock is under
// a licence that lets Kntnt give Konzilo Design any terms, and a licence outside the
// list fails here, so that taking one in is a decision and no accident of an install.
// The published package needs none of them, and what Konzilo Design is built on is
// named: every package in THIRD-PARTY.md, each direct dependency in ACKNOWLEDGEMENTS.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { render } from '../scripts/third-party.js';

const text = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const read = (name) => JSON.parse(text(name));
const lock = read('package-lock.json');
const manifest = read('package.json');

// A permissive licence asks for its notice, and nothing of the work around it.
const PERMISSIVE = ['0BSD', 'Apache-2.0', 'BlueOak-1.0.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'ISC', 'MIT', 'MIT-0'];

// These bind the library and not the work that uses it, while the library is a
// package of its own and used as it is.
const AS_LIBRARY = ['LGPL-3.0-or-later', 'MPL-2.0'];

const allowed = new Set([...PERMISSIVE, ...AS_LIBRARY]);

// An expression of the forms the lock holds: names joined by AND, where each must
// be allowed, or by OR, where one is enough, in brackets or not. Anything else is
// refused.
const fits = (expression) =>
  expression
    .replace(/^\((.*)\)$/, '$1')
    .split(' OR ')
    .some((choice) => choice.split(' AND ').every((name) => allowed.has(name)));

test('reads a licence expression, and refuses what is not on the list', () => {
  assert.ok(fits('MIT'));
  assert.ok(fits('(MPL-2.0 OR Apache-2.0)'));
  assert.ok(fits('Apache-2.0 AND LGPL-3.0-or-later AND MIT'));
  assert.ok(fits('GPL-3.0-only OR MIT'));
  assert.ok(!fits('GPL-3.0-or-later'));
  assert.ok(!fits('AGPL-3.0-or-later'));
  assert.ok(!fits('MIT AND GPL-2.0-only'));
  assert.ok(!fits('(MIT OR Apache-2.0) AND GPL-3.0-only'));
  assert.ok(!fits('SEE LICENSE IN LICENSE.txt'));
});

test('every installed package is under a licence that leaves the design system free', () => {
  const refused = Object.entries(lock.packages)
    .filter(([path]) => path !== '')
    .filter(([, { license }]) => typeof license !== 'string' || !fits(license))
    .map(([path, { license }]) => `${path}: ${license ?? 'no licence'}`);
  assert.deepEqual(refused, []);
});

test('the package names its own licence', () => {
  assert.equal(manifest.license, 'AGPL-3.0-or-later');
});

test('the published package has no runtime dependencies, as THIRD-PARTY.md says', () => {
  assert.equal(manifest.dependencies, undefined);
  const runtime = Object.entries(lock.packages)
    .filter(([path, { dev }]) => path !== '' && dev !== true)
    .map(([path]) => path);
  assert.deepEqual(runtime, []);
});

test('THIRD-PARTY.md names every package of the lock, as scripts/third-party.js writes it', () => {
  assert.equal(text('THIRD-PARTY.md'), render(lock), 'run `node scripts/third-party.js`, and commit what it writes');
});

test('ACKNOWLEDGEMENTS.md names every package the design system depends on directly', () => {
  const direct = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies });
  const acknowledgements = text('ACKNOWLEDGEMENTS.md');
  assert.deepEqual(direct.filter((name) => !acknowledgements.includes(`\`${name}\``)), []);
});
