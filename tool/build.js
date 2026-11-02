import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { inlineBuild } from '../presentation/inline.mjs';
export const repo = fileURLToPath(new URL('../', import.meta.url));
let pending = Promise.resolve();
export function buildPresentation({ designFile, output, date } = {}) {
  const job = async () => {
    const directory = resolve(
      output || resolve(repo, 'node_modules/.cache/konzilo-presentation'),
    );
    await new Promise((done, fail) => {
      const child = spawn(
        process.execPath,
        [
          resolve(repo, 'node_modules/astro/bin/astro.mjs'),
          'build',
          '--root',
          resolve(repo, 'presentation'),
        ],
        {
          cwd: repo,
          env: {
            ...process.env,
            ASTRO_TELEMETRY_DISABLED: '1',
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
    return { directory, ...(await inlineBuild(directory)) };
  };
  const result = pending.then(job, job);
  pending = result.catch(() => {});
  return result;
}
