import { readFile, copyFile, rename, unlink, constants } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { defaultInputs } from '../src/generator/index.js';

const logo = async (name) =>
  `data:image/svg+xml;base64,${(await readFile(new URL(name, import.meta.url))).toString('base64')}`;

// What a new design starts from: deliberately plain, and deliberately in need of replacing. A made-up
// company, Mona Sans for everything and its own monospace for code, one colour for everything, no
// shadows, no frame and square corners. Mona Sans's axes give display text and labels their own look:
// light and open for the one, narrow and heavy with a slab I and a square G for the other.
export async function newDesign() {
  const inputs = defaultInputs();
  inputs['brand-colors'] = { primary: '#6366F1' };
  inputs.typefaces.main = 'Mona Sans';
  inputs.typefaces.monospace = 'Mona Sans Mono';
  inputs.type.roles = {
    display: { weight: 260, 'letter-spacing': -0.03, axes: { wdth: 112, opsz: 100 } },
    label: { weight: 800, 'letter-spacing': 0.06, axes: { wdth: 75, opsz: 0 }, features: ['ss02', 'ss07'] },
  };
  inputs['corner-profile'] = 0;
  return {
    inputs,
    project: {
      name: 'Placeholdr',
      version: '1.0',
      logo: await logo('new-design-logo.svg'),
      'logo-dark': await logo('new-design-logo-dark.svg'),
    },
  };
}

// name.design.json keeps its backup in name.design.bak.json, beside it.
export const backupPath = (path) => `${path.replace(/\.json$/i, '')}.bak.json`;

// Copies the file to its backup path, complete or not at all. A file that does not exist has nothing to keep.
export async function backUp(path) {
  const target = backupPath(path);
  const temporary = `${target}.saving-${randomBytes(6).toString('hex')}`;
  try {
    await copyFile(path, temporary, constants.COPYFILE_EXCL);
    await rename(temporary, target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
