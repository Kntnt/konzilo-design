import { withDefaults } from '../src/generator/defaults.js';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve as pathResolve } from 'node:path';
import { resolve, validateDesignFile, withFormat } from '../src/generator/index.js';
import { designMd, MARKER } from '../src/design-md/index.js';

// Writes the design as DESIGN.md beside the design file, or where `output` says. It resolves afresh,
// as the presentation does, and refuses to replace a file it did not write.
export async function writeDesignMd(designFile, output) {
  const source = pathResolve(designFile);
  const file = withFormat(JSON.parse(await readFile(source, 'utf8')));
  const resolved = await resolve(file.inputs);
  validateDesignFile({ ...file, resolved });
  const target = pathResolve(output || join(dirname(source), 'DESIGN.md'));
  const existing = await readFile(target, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing !== null && !existing.includes(MARKER))
    throw new Error(`${target} was not written by this tool, so it is left alone. Move it away, or name another file with -o.`);
  await writeFile(target, designMd({ ...file, inputs: withDefaults(file.inputs), resolved }, basename(source)));
  return target;
}
