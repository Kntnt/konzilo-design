import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { inlineBuild } from '../presentation/inline.mjs';
import { mkdtemp, readdir, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { resolve as resolveDesign, defaultInputs } from '../src/generator/index.js';
export const repo = fileURLToPath(new URL('../', import.meta.url));

// Each build has a folder of its own in the system's temporary folder, removed when it ends (issue #10). It is Astro's
// root and working folder, and holds what Astro writes: its `.astro/`, its caches, the pages it renders with, and the
// built pages unless `output` names their folder. So a build only reads the checkout, a checkout that may not be
// written to builds, and builds at once, from two shells or in one process, never share a folder. No cache outlives
// its run, since none made a second build faster (tool/README.md).
export async function buildPresentation({ designFile, output, date } = {}) {
  // The folder's real path, which is what the working folder reports, so every path in the build spells it one way.
  const run = await realpath(await mkdtemp(join(tmpdir(), 'konzilo-presentation-')));
  try {
    // The checkout's entries, linked into the folder: Astro takes a file outside its root for an address under it,
    // so the sources are reached through these links, which the configuration keeps as written. Removing the
    // folder removes the links, never what they lead to.
    for (const name of await readdir(repo)) if (!name.startsWith('.')) await symlink(join(repo, name), join(run, name));
    const directory = resolve(output || join(run, 'dist'));
    await new Promise((done, fail) => {
      const child = spawn(
        process.execPath,
        [
          resolve(repo, 'node_modules/astro/bin/astro.mjs'),
          'build',
          '--root',
          run,
          '--config',
          'presentation/astro.config.mjs',
        ],
        {
          cwd: run,
          env: {
            ...process.env,
            ASTRO_TELEMETRY_DISABLED: '1',
            // Astro's command keeps Node's compile cache in the system's temporary folder for later runs; none is kept.
            NODE_DISABLE_COMPILE_CACHE: '1',
            KN_DESIGN_FILE: designFile || '',
            KN_OUTPUT: directory,
            KN_DATE: date || '',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let log = '';
      child.stdout.on('data', (chunk) => (log += chunk));
      child.stderr.on('data', (chunk) => (log += chunk));
      child.on('error', fail);
      child.on('exit', (code) => (code === 0 ? done() : fail(new Error(log))));
    });
    const inputs = designFile ? JSON.parse(await readFile(designFile, 'utf8')).inputs : { ...defaultInputs(), typefaces: { ...defaultInputs().typefaces, main: 'Mona Sans' } };
    return await inlineBuild(directory, await resolveDesign(inputs), designFile);
  } finally {
    await rm(run, { recursive: true, force: true });
  }
}
