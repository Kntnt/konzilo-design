// A design's typefaces, copied beside its file for a site's repository, since the package a site installs holds no fonts.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TYPEFACES, shippedIn } from '../fonts/catalog.js';
import { checkFingerprint } from '../generator/fingerprint.js';
import { checkFormat, validateDesignFile } from '../generator/validate.js';

export const FONT_CSS = 'fonts.css';
const MARKER = 'Written by konzilo-design fonts';
const shipped = new URL('../fonts/', import.meta.url);

// A typeface's font files: its upright, and its italic where it has one of its own.
export const filesOf = ({ upright, italic }) => [upright, italic].filter(Boolean);

// The @font-face rules of these typefaces, out of the library's fonts.css, whose addresses are already relative.
export function fontFaceRules(css, faces) {
  const families = new Set(faces.map(({ family }) => family));
  return css.split('\n').filter((line) => families.has(line.match(/^@font-face \{ font-family: "([^"]+)"/)?.[1])).join('\n');
}

const known = new Set(TYPEFACES.flatMap((face) => [...filesOf(face), face.licence]));

// Copies the typefaces the design file uses into the folder, with their licences, which must travel with them, and a
// stylesheet of their @font-face rules. A file of the library's that a design no longer uses goes; nothing else there does.
export async function copyFonts(designFile, folder) {
  const file = JSON.parse(await readFile(designFile, 'utf8'));
  checkFormat(file);
  await checkFingerprint(file);
  validateDesignFile(file);
  const faces = shippedIn(file.resolved.typefaces);
  const css = await readFile(new URL('fonts.css', shipped), 'utf8').catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    throw new Error('This copy of the package holds no fonts. Run "konzilo-design fonts" from the design system\'s repository.');
  });
  const target = join(folder, FONT_CSS);
  const present = await readFile(target, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (present !== null && !present.includes(MARKER)) throw new Error(`${target} was not written by this command, so it is left alone. Move it away, or name another folder with -o.`);
  await mkdir(folder, { recursive: true });
  const wanted = new Set(faces.flatMap((face) => [...filesOf(face), face.licence]));
  await Promise.all([...wanted].map((name) => copyFile(new URL(name, shipped), join(folder, name))));
  await Promise.all([...known].filter((name) => !wanted.has(name)).map((name) => rm(join(folder, name), { force: true })));
  if (faces.length) await writeFile(target, `/* ${MARKER}: the typefaces this design uses. */\n${fontFaceRules(css, faces)}\n`);
  else await rm(target, { force: true });
  return { folder, families: faces.map(({ family }) => family), files: [...wanted].filter((name) => name.endsWith('.woff2')).sort() };
}
