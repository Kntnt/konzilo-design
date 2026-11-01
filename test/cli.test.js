import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { defaultInputs } from '../src/generator/index.js';

const cli = new URL('../bin/konzilo-design.js', import.meta.url).pathname;

test('CLI resolves, checks and exports; stale inputs fail both consumers', async (t) => {
  // Exclusive creation protects any pre-existing file. Cleanup paths are literal and explicit.
  await writeFile('/private/tmp/konzilo-design-cli-test.design.json', JSON.stringify({ inputs: defaultInputs(), project: {} }), { flag: 'wx' });
  t.after(() => unlink('/private/tmp/konzilo-design-cli-test.design.json'));
  execFileSync(process.execPath, [cli, 'resolve', '/private/tmp/konzilo-design-cli-test.design.json']);
  const file = JSON.parse(await readFile('/private/tmp/konzilo-design-cli-test.design.json', 'utf8'));
  assert.ok(file.resolved['inputs-fingerprint']);
  assert.match(execFileSync(process.execPath, [cli, 'check', '/private/tmp/konzilo-design-cli-test.design.json'], { encoding: 'utf8' }), /fingerprint matches/);
  assert.match(execFileSync(process.execPath, [cli, 'css', '/private/tmp/konzilo-design-cli-test.design.json'], { encoding: 'utf8' }), /:root/);
  // Create the output path exclusively before allowing the CLI to overwrite our own file.
  await writeFile('/private/tmp/konzilo-design-cli-test.css', '', { flag: 'wx' });
  t.after(() => unlink('/private/tmp/konzilo-design-cli-test.css'));
  execFileSync(process.execPath, [cli, 'css', '/private/tmp/konzilo-design-cli-test.design.json', '-o', '/private/tmp/konzilo-design-cli-test.css']);
  assert.match(await readFile('/private/tmp/konzilo-design-cli-test.css', 'utf8'), /data-kn-width="bleed-end"/);
  file.inputs['density-profile'] = 10;
  await writeFile('/private/tmp/konzilo-design-cli-test.design.json', JSON.stringify(file));
  for (const command of ['check', 'css']) {
    const run = spawnSync(process.execPath, [cli, command, '/private/tmp/konzilo-design-cli-test.design.json'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /fingerprint mismatch/);
    assert.equal(run.stdout, '');
  }
});

test('CLI reports incorrect arguments without modifying the design file', () => {
  for (const args of [[], ['unknown', 'example.json'], ['check', 'example.json', '-o', 'out.css'], ['css', 'example.json', '-o']]) {
    const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Usage:/);
  }
});
