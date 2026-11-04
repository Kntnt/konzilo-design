// A design's own photos: files in a folder beside the design file, named after the place they take.
// The folder is the whole record, so a file put there by hand counts too, and nothing goes in the design file.
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { extname, join } from 'node:path';
import { PICTURE_SLOTS } from './src/samples.js';

export const OWN_PICTURES_PATH = '/design-pictures/';
export const PICTURE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
export const picturesFolder = (designFile) => `${designFile.replace(/\.[^/.]+$/, '')}.pictures`;

// The file each place has, by place.
export async function ownPictureFiles(designFile) {
  const found = {};
  let names;
  try {
    names = await readdir(picturesFolder(designFile));
  } catch (error) {
    if (error.code === 'ENOENT') return found;
    throw error;
  }
  for (const name of names.sort()) {
    const extension = extname(name).toLowerCase();
    const slot = name.slice(0, -extension.length);
    if (PICTURE_TYPES[extension] && PICTURE_SLOTS.includes(slot)) found[slot] = name;
  }
  return found;
}
// A version in the address means a replaced photo shows at once, whatever the browser holds.
export async function ownPictureUrls(designFile, { versioned = true } = {}) {
  const urls = {};
  for (const [slot, name] of Object.entries(await ownPictureFiles(designFile))) {
    const version = versioned ? `?v=${Math.round((await stat(join(picturesFolder(designFile), name))).mtimeMs)}` : '';
    urls[slot] = `${OWN_PICTURES_PATH}${name}${version}`;
  }
  return urls;
}
export async function readOwnPicture(designFile, name) {
  if (!Object.values(await ownPictureFiles(designFile)).includes(name)) return null;
  return { bytes: await readFile(join(picturesFolder(designFile), name)), type: PICTURE_TYPES[extname(name).toLowerCase()] };
}
export async function removeOwnPicture(designFile, slot) {
  const name = (await ownPictureFiles(designFile))[slot];
  if (name) await unlink(join(picturesFolder(designFile), name));
}
// The tool has already made the photo a JPEG of a sensible size. A complete sibling file is renamed, so an interrupted upload leaves the old one.
export async function saveOwnPicture(designFile, slot, bytes) {
  if (!PICTURE_SLOTS.includes(slot)) throw new Error(`Unknown picture place: ${slot}`);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Expected a JPEG.');
  const folder = picturesFolder(designFile);
  await mkdir(folder, { recursive: true });
  const temporary = join(folder, `.saving-${randomBytes(6).toString('hex')}`);
  await writeFile(temporary, bytes, { flag: 'wx' });
  await removeOwnPicture(designFile, slot);
  await rename(temporary, join(folder, `${slot}.jpg`));
}
