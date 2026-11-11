import { readFile } from 'node:fs/promises';
import {
  resolve as pathResolve,
  dirname,
  extname,
  isAbsolute,
} from 'node:path';
import {
  resolve,
  defaultInputs,
  validateDesignFile,
  withFormat,
  checkContrast,
} from '../../src/generator/index.js';
import { withDefaults } from '../../src/generator/defaults.js';
import { ownPictureUrls } from '../own-pictures.mjs';
import { copyFor } from '../copy-override.mjs';
export const designPath = process.env.KN_DESIGN_FILE;
const source = withFormat(designPath
  ? JSON.parse(await readFile(designPath, 'utf8'))
  : {
      inputs: {
        ...defaultInputs(),
        typefaces: { ...defaultInputs().typefaces, main: 'Mona Sans' },
      },
      project: { name: 'Example' },
    });
// A build names a design's own photos without a version; the report embeds them from the folder.
export const ownPictures = designPath ? await ownPictureUrls(designPath, { versioned: false }) : {};
export const inputs = withDefaults(source.inputs);
export const resolved = await resolve(source.inputs);
checkContrast(resolved);
validateDesignFile({ ...source, resolved });
export const project = {
  version: '1.0',
  ...source.project,
  name: source.project?.name || 'Example',
};
for (const key of ['logo', 'logo-dark'])
  if (project[key] && !project[key].startsWith('data:')) {
    if (isAbsolute(project[key]) || /^[a-z]+:/i.test(project[key]))
      throw new Error(
        `${key}: use a data URI or a path relative to the design file`,
      );
    const p = pathResolve(dirname(designPath), project[key]);
    const mime =
      extname(p).toLowerCase() === '.svg'
        ? 'image/svg+xml'
        : extname(p).toLowerCase() === '.png'
          ? 'image/png'
          : null;
    if (!mime) throw new Error(`${key}: expected SVG or PNG`);
    project[key] =
      `data:${mime};base64,${(await readFile(p)).toString('base64')}`;
  }
// The design's own words over the English; a key that has left copy.json is ignored, and one that never was stops the build.
export const copy = await copyFor(designPath);
export const t = (key, values = {}) => {
  if (!Object.hasOwn(copy, key)) throw new Error(`Missing copy key: ${key}`);
  return copy[key].replace(
    /\{([\w-]+)\}/g,
    (_, name) => values[name] ?? `{${name}}`,
  );
};
export const num = (n, digits = 2) =>
  new Intl.NumberFormat(copy.lang, { maximumFractionDigits: digits }).format(n);
export const date = new Intl.DateTimeFormat(copy.lang, {
  dateStyle: 'long',
  timeZone: 'UTC',
}).format(
  new Date(process.env.KN_DATE || new Date().toISOString().slice(0, 10)),
);
