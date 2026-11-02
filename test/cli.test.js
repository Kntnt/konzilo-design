import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { defaultInputs } from '../src/generator/index.js';

const cli = new URL('../bin/konzilo-design.js', import.meta.url).pathname;

test('CLI resolves, checks and exports; stale inputs fail both consumers', async (t) => {
  // Exclusive creation protects any pre-existing file. Cleanup paths are literal and explicit.
  await writeFile('/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json', JSON.stringify({ inputs: defaultInputs(), project: {} }), { flag: 'wx' });
  t.after(() => unlink('/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json'));
  execFileSync(process.execPath, [cli, 'resolve', '/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json']);
  const file = JSON.parse(await readFile('/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json', 'utf8'));
  assert.ok(file.resolved['inputs-fingerprint']);
  assert.match(execFileSync(process.execPath, [cli, 'check', '/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json'], { encoding: 'utf8' }), /fingerprint matches/);
  assert.match(execFileSync(process.execPath, [cli, 'css', '/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json'], { encoding: 'utf8' }), /:root/);
  // Create the output path exclusively before allowing the CLI to overwrite our own file.
  await writeFile('/Users/thomas/Projects/konzilo-design/test/cli-fixture.css', '', { flag: 'wx' });
  t.after(() => unlink('/Users/thomas/Projects/konzilo-design/test/cli-fixture.css'));
  execFileSync(process.execPath, [cli, 'css', '/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json', '-o', '/Users/thomas/Projects/konzilo-design/test/cli-fixture.css']);
  assert.match(await readFile('/Users/thomas/Projects/konzilo-design/test/cli-fixture.css', 'utf8'), /data-kn-width="bleed-end"/);
  execFileSync(process.execPath, [cli, 'components-css', '-o', '/Users/thomas/Projects/konzilo-design/test/cli-fixture.css']);
  const components = await readFile('/Users/thomas/Projects/konzilo-design/test/cli-fixture.css', 'utf8');
  assert.match(components, /@layer kn-components/);
  assert.doesNotMatch(components, /@import/);
  file.inputs['density-profile'] = 10;
  await writeFile('/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json', JSON.stringify(file));
  for (const command of ['check', 'css']) {
    const run = spawnSync(process.execPath, [cli, command, '/Users/thomas/Projects/konzilo-design/test/cli-fixture.design.json'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /fingerprint mismatch/);
    assert.equal(run.stdout, '');
  }
});

test('CLI reports incorrect arguments without modifying the design file', () => {
  for (const args of [[], ['unknown', 'example.json'], ['check', 'example.json', '-o', 'out.css'], ['css', 'example.json', '-o'], ['components-css', '-o'], ['components-css', 'out.css'], ['components-css', '-o', 'out.css', 'extra']]) {
    const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Usage:/);
  }
});
