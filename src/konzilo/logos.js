// A design's logos as files, for a site's public folder. A design file holds them as data URIs, or as paths relative to
// itself, and that serves the tool and the presentation; the Konzilo core's content security policy allows an image from the
// site's own host and never one at a data: address. Unlike the fonts, this holds in the package a site installs.
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { logoExtension } from '../components/design-props.js';
import { checkFormat } from '../generator/validate.js';

export const DEFAULT_FOLDER = './public/logos';
const KEYS = ['logo', 'logo-dark'];

// Each logo the project has, by its key, with the file it is written to.
export const logoFiles = (project) => KEYS.filter((key) => project?.[key]).map((key) => ({ key, filename: `${key}.${logoExtension(project[key])}` }));

function dataUriBytes(uri) {
  const comma = uri.indexOf(',');
  const data = uri.slice(comma + 1);
  return /;base64$/i.test(uri.slice(0, comma)) ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data));
}

// Writes the design file's logos into the folder as `logo.<ext>` and `logo-dark.<ext>`. A logo of the kind written here that
// the design no longer has, or has in another type, goes; nothing else there does.
export async function writeLogos(designFile, folder) {
  const { project } = checkFormat(JSON.parse(await readFile(designFile, 'utf8')));
  const files = logoFiles(project);
  await mkdir(folder, { recursive: true });
  for (const { key, filename } of files) {
    const logo = project[key];
    if (logo.startsWith('data:')) await writeFile(join(folder, filename), dataUriBytes(logo));
    else if (isAbsolute(logo) || /^[a-z][a-z0-9+.-]*:/i.test(logo)) throw new Error(`${key}: use a data URI or a path relative to the design file, not ${logo}.`);
    else await copyFile(resolve(dirname(designFile), logo), join(folder, filename)).catch((error) => {
      if (error.code === 'ENOENT') throw new Error(`${key}: there is no file at ${logo}, from the design file.`);
      throw error;
    });
  }
  const wanted = new Set(files.map(({ filename }) => filename));
  const earlier = (await readdir(folder)).filter((name) => /^logo(-dark)?\.[a-z0-9]+$/.test(name) && !wanted.has(name));
  await Promise.all(earlier.map((name) => rm(join(folder, name))));
  return { folder, files: [...wanted] };
}
