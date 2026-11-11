import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { defaultInputs } from '../src/generator/index.js';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));

const cli = new URL('../bin/konzilo-design.js', import.meta.url).pathname;

test('CLI resolves, checks and exports; stale inputs fail both consumers', async (t) => {
  // Exclusive creation protects any pre-existing file. Cleanup paths are literal and explicit.
  await writeFile(here('cli-fixture.design.json'), JSON.stringify({ inputs: defaultInputs(), project: {} }), { flag: 'wx' });
  t.after(() => unlink(here('cli-fixture.design.json')));
  const before = await readFile(here('cli-fixture.design.json'), 'utf8');
  t.after(() => unlink(here('cli-fixture.design.bak.json')));
  execFileSync(process.execPath, [cli, 'resolve', here('cli-fixture.design.json')]);
  assert.equal(await readFile(here('cli-fixture.design.bak.json'), 'utf8'), before);
  const file = JSON.parse(await readFile(here('cli-fixture.design.json'), 'utf8'));
  assert.ok(file.resolved['inputs-fingerprint']);
  assert.match(execFileSync(process.execPath, [cli, 'check', here('cli-fixture.design.json')], { encoding: 'utf8' }), /fingerprint matches/);
  assert.match(execFileSync(process.execPath, [cli, 'css', here('cli-fixture.design.json')], { encoding: 'utf8' }), /:root/);
  // Create the output path exclusively before allowing the CLI to overwrite our own file.
  await writeFile(here('cli-fixture.css'), '', { flag: 'wx' });
  t.after(() => unlink(here('cli-fixture.css')));
  execFileSync(process.execPath, [cli, 'css', here('cli-fixture.design.json'), '-o', here('cli-fixture.css')]);
  assert.match(await readFile(here('cli-fixture.css'), 'utf8'), /data-kn-width="bleed-end"/);
  execFileSync(process.execPath, [cli, 'components-css', '-o', here('cli-fixture.css')]);
  const components = await readFile(here('cli-fixture.css'), 'utf8');
  assert.match(components, /@layer kn-components/);
  assert.doesNotMatch(components, /@import/);
  file.inputs['density-profile'] = 10;
  await writeFile(here('cli-fixture.design.json'), JSON.stringify(file));
  for (const command of ['check', 'css']) {
    const run = spawnSync(process.execPath, [cli, command, here('cli-fixture.design.json')], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /fingerprint mismatch/);
    assert.equal(run.stdout, '');
  }
});

test('CLI reports incorrect arguments without modifying the design file', () => {
  for (const args of [[], ['tool'], ['tool', '--no-open'], ['tool', '--status', 'example.json'], ['tool', '--stop', '--port', '4174'], ['tool', '--status', '--stop'], ['tool', '--stop', 'a.json', 'b.json'], ['unknown', 'example.json'], ['check', 'example.json', '-o', 'out.css'], ['css', 'example.json', '-o'], ['components-css', '-o'], ['components-css', 'out.css'], ['components-css', '-o', 'out.css', 'extra'], ['fonts'], ['fonts', 'example.json', '-o'], ['fonts', 'example.json', 'out'], ['logos'], ['logos', 'example.json', '-o'], ['logos', 'example.json', 'out']]) {
    const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Usage:/);
  }
});

test('the commands that work on a design file stop and show their usage without one', () => {
  for (const name of ['design-tool', 'design-presentation', 'design-check', 'design-restore', 'design-md']) {
    const run = spawnSync(new URL(`../bin/${name}`, import.meta.url).pathname, [], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, new RegExp(`Usage: ${name} <design-file>`));
  }
});
