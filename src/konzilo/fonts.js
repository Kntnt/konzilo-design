// A design's typefaces, copied beside its file for a site's repository, since the package a site installs holds no fonts.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TYPEFACES, familyOf, shippedIn } from '../fonts/catalog.js';
import { SYSTEM_MONOSPACE, SYSTEM_SANS, SYSTEM_SERIF } from '../generator/defaults.js';
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

// The families a computer has without a font file: CSS's generic ones and those the tool offers as the computer's own.
const SYSTEM = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', ...[SYSTEM_SANS, SYSTEM_MONOSPACE, SYSTEM_SERIF].map(familyOf)]);

// How many letters must change to turn one name into the other, spaces, hyphens and case aside.
function distance(one, other) {
  const [a, b] = [one, other].map((name) => name.toLowerCase().replace(/[\s_-]+/g, ''));
  let row = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

// The families a design's resolved stacks name that the library does not ship and a computer does not have of itself,
// each as the design writes it, with the library's typeface it may have meant, where one is two letters from it or less.
export function unshippedIn(stacks) {
  const names = [...new Set(Object.values(stacks).map((stack) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '')))];
  const shipped = new Set(TYPEFACES.map(({ family }) => family.toLowerCase()));
  return names.filter((name) => !shipped.has(name.toLowerCase()) && !SYSTEM.has(name.toLowerCase())).map((name) => {
    const [nearest] = TYPEFACES.map(({ family }) => [family, distance(name, family)]).filter(([, apart]) => apart <= 2).sort((one, other) => one[1] - other[1]);
    return { name, meant: nearest?.[0] ?? null };
  });
}

// Copies the typefaces the design file uses into the folder, with their licences, which must travel with them, and a
// stylesheet of their @font-face rules, a typeface named in any case. A file of the library's that a design no longer
// uses goes, and nothing else there does, unless the design names a family the library does not ship and a computer does
// not have of itself: that may be a typeface's name misread, so nothing goes then, and the family is returned under
// `unshipped`, with the typeface it may have meant.
export async function copyFonts(designFile, folder) {
  const file = JSON.parse(await readFile(designFile, 'utf8'));
  checkFormat(file);
  await checkFingerprint(file);
  validateDesignFile(file);
  const faces = shippedIn(file.resolved.typefaces);
  const unshipped = unshippedIn(file.resolved.typefaces);
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
  if (!unshipped.length) await Promise.all([...known].filter((name) => !wanted.has(name)).map((name) => rm(join(folder, name), { force: true })));
  if (faces.length) await writeFile(target, `/* ${MARKER}: the typefaces this design uses. */\n${fontFaceRules(css, faces)}\n`);
  else if (!unshipped.length) await rm(target, { force: true });
  return { folder, families: faces.map(({ family }) => family), files: [...wanted].filter((name) => name.endsWith('.woff2')).sort(), unshipped };
}
