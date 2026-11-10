import { withDefaults } from '../src/generator/defaults.js';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve as pathResolve } from 'node:path';
import { resolve, validateDesignFile, withFormat } from '../src/generator/index.js';
import { designMd, MARKER } from '../src/design-md/index.js';
import { designBundle } from '../src/design-md/bundle.js';
import { zipFiles } from './archive.js';

// `name.design.json` gives `name-design-md.zip`, beside it.
export const defaultDesignMdPath = (designFile) => join(dirname(designFile), `${basename(designFile).replace(/\.json$/i, '').replace(/\.design$/i, '')}-design-md.zip`);

// Writes the design for AI agents: by default a ZIP beside the design file, with DESIGN.md and the files it names, or
// DESIGN.md alone where `output` ends in .md. It resolves afresh, as the presentation does, and refuses to replace a
// file it did not write: a DESIGN.md holds the marker in its text, and an archive in its comment.
export async function writeDesignMd(designFile, output) {
  const source = pathResolve(designFile);
  const file = withFormat(JSON.parse(await readFile(source, 'utf8')));
  const resolved = await resolve(file.inputs);
  validateDesignFile({ ...file, resolved });
  const target = pathResolve(output || defaultDesignMdPath(source));
  const kind = extname(target).toLowerCase();
  if (kind !== '.zip' && kind !== '.md') throw new Error(`Name a .zip file, for DESIGN.md with its files, or a .md file, for DESIGN.md alone, not ${basename(target)}.`);
  const existing = await readFile(target).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing !== null && !existing.includes(MARKER))
    throw new Error(`${target} was not written by this tool, so it is left alone. Move it away, or name another file with -o.`);
  const design = { ...file, inputs: withDefaults(file.inputs), resolved };
  const name = basename(source);
  await writeFile(target, kind === '.md'
    ? designMd(design, name)
    : zipFiles(await designBundle(design, source, name), { comment: `${MARKER} from ${name}.` }));
  return target;
}
