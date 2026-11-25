// The presentation command builds in a folder of its own for each run, in the system's temporary folder, and
// removes it afterwards, so it only reads the checkout (issue #10). Each test runs the real command in a process
// of its own, with TMPDIR set to a folder the test watches, as two shells or a read-only checkout would.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { inflateRawSync } from 'node:zlib';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('../', import.meta.url));

// The one HTML file a presentation's ZIP holds.
function unzip(bytes) {
  const length = bytes.readUInt16LE(26);
  const offset = 30 + length + bytes.readUInt16LE(28);
  return {
    filename: bytes.subarray(30, 30 + length).toString('utf8'),
    html: inflateRawSync(bytes.subarray(offset, offset + bytes.readUInt32LE(18))).toString('utf8'),
  };
}

// A design file of a made-up company, beside nothing else.
async function design(folder, name) {
  const model = JSON.parse(await readFile(join(repo, 'examples/example.design.json'), 'utf8'));
  model.project.name = name;
  const path = join(folder, `${name.toLowerCase().replace(/\W+/g, '-')}.design.json`);
  await writeFile(path, JSON.stringify(model));
  return path;
}

const presentation = (checkout, designFile, zip, temporary) => run(
  process.execPath,
  [join(checkout, 'bin/konzilo-design.js'), 'presentation', designFile, '-o', zip],
  { env: { ...process.env, TMPDIR: temporary }, timeout: 110000 },
);

// Sets the modes of a folder's files and folders, never through a link: those lead to the real packages.
async function chmodTree(path, mode) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    if (mode.directory & 0o200) await chmod(path, mode.directory);
    for (const name of await readdir(path)) await chmodTree(join(path, name), mode);
    if (!(mode.directory & 0o200)) await chmod(path, mode.directory);
  } else await chmod(path, mode.file);
}

test('a checkout that may not be written to makes a presentation, and leaves nothing in the temporary folder', { timeout: 120000 }, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'kn-presentation-build-'));
  const checkout = join(scratch, 'checkout');
  const temporary = join(scratch, 'tmp');
  t.after(async () => {
    await chmodTree(checkout, { directory: 0o755, file: 0o644 }).catch(() => {});
    await rm(scratch, { recursive: true, force: true });
  });
  // The parts of the checkout the command reads, copied without what Git ignores, and its packages linked one by
  // one, so `node_modules` itself is a folder of the checkout that cannot be written to either.
  const ignored = new Set(['node_modules', 'dist', '.astro', '.DS_Store']);
  for (const part of ['bin', 'src', 'tool', 'presentation', 'schema', 'package.json']) {
    await cp(join(repo, part), join(checkout, part), { recursive: true, filter: (source) => !ignored.has(source.split('/').pop()) });
  }
  await mkdir(join(checkout, 'node_modules'));
  for (const name of await readdir(join(repo, 'node_modules'))) {
    if (!name.startsWith('.')) await symlink(join(repo, 'node_modules', name), join(checkout, 'node_modules', name));
  }
  await chmodTree(checkout, { directory: 0o555, file: 0o444 });
  await mkdir(temporary);
  const zip = join(scratch, 'out.zip');
  await presentation(checkout, await design(scratch, 'Alder Works'), zip, temporary);
  const { filename, html } = unzip(await readFile(zip));
  assert.equal(filename, 'alder-works-design-system.html');
  assert.match(html, /Alder Works/);
  assert.deepEqual(await readdir(temporary), [], 'the run removed its folder');
});

test('two presentations made at once, from two shells, each build in a folder of their own and remove it', { timeout: 120000 }, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'kn-presentation-builds-'));
  const temporary = join(scratch, 'tmp');
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await mkdir(temporary);
  // What the temporary folder holds while the two run.
  const seen = new Set();
  const look = setInterval(async () => {
    for (const name of await readdir(temporary).catch(() => [])) seen.add(name);
  }, 5);
  try {
    const designs = await Promise.all(['Alder Works', 'Birch Works'].map((name) => design(scratch, name)));
    await Promise.all(designs.map((file, index) => presentation(repo, file, join(scratch, `${index}.zip`), temporary)));
  } finally {
    clearInterval(look);
  }
  const [alder, birch] = await Promise.all([0, 1].map(async (index) => unzip(await readFile(join(scratch, `${index}.zip`)))));
  assert.equal(alder.filename, 'alder-works-design-system.html');
  assert.equal(birch.filename, 'birch-works-design-system.html');
  assert.ok(alder.html.includes('Alder Works') && !alder.html.includes('Birch Works'), 'the first holds its own design only');
  assert.ok(birch.html.includes('Birch Works') && !birch.html.includes('Alder Works'), 'the second holds its own design only');
  assert.equal([...seen].filter((name) => name.startsWith('konzilo-presentation-')).length, 2, `a folder each: ${[...seen].join(', ')}`);
  assert.deepEqual(await readdir(temporary), [], 'both removed their folders');
});
