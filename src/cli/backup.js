import { copyFile, rename, unlink, constants } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

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
