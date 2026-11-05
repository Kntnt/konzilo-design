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
import english from '../copy.json';
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
export let copy = { ...english };
if (designPath) {
  const override = designPath.replace(/\.[^/.]+$/, '') + '.copy.json';
  try {
    const custom = JSON.parse(await readFile(override, 'utf8'));
    if (!custom || Array.isArray(custom) || typeof custom !== 'object')
      throw new Error('Copy override must be an object');
    for (const [key, value] of Object.entries(custom)) {
      // Words for what the document no longer shows do no harm in an older file.
      if (['specimen.headers', 'specimen.footer-simple'].includes(key) || key.startsWith('specimen.hero-')) continue;
      if (!Object.hasOwn(english, key))
        throw new Error(`Unknown copy key: ${key}`);
      if (typeof value !== 'string')
        throw new Error(`Copy key ${key} must be a string`);
    }
    copy = { ...copy, ...custom };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
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
