// DESIGN.md with the files it names, for an archive: the logos, the font files of the typefaces the design uses with
// their licences and @font-face rules, and the icons the components use with theirs. Everything comes from the design
// file and this repository, so it works offline.
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { logoExtension } from '../components/design-props.js';
import { icons } from '../components/icons.js';
import { shippedIn } from '../fonts/catalog.js';
import { filesOf, fontFaceRules } from '../konzilo/fonts.js';
import { ICONS } from './components.js';
import { designMd } from './index.js';

const repo = new URL('../', import.meta.url);
const LOGOS = ['logo', 'logo-dark'];

function dataUriBytes(uri) {
  const comma = uri.indexOf(',');
  const data = uri.slice(comma + 1);
  return /;base64$/i.test(uri.slice(0, comma)) ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data));
}
async function logoBytes(logo, key, designFile) {
  if (logo.startsWith('data:')) return dataUriBytes(logo);
  if (isAbsolute(logo) || /^[a-z][a-z0-9+.-]*:/i.test(logo)) throw new Error(`${key}: use a data URI or a path relative to the design file, not ${logo}.`);
  return readFile(resolve(dirname(designFile), logo)).catch((error) => {
    if (error.code === 'ENOENT') throw new Error(`${key}: there is no file at ${logo}, from the design file.`);
    throw error;
  });
}
// The icon as a file, as Icon.astro draws it: a 24-unit grid, stroked in the current colour, no fill.
const iconSvg = (markup) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n  ${markup}\n</svg>\n`;

export async function designBundle(file, designFile, sourceName) {
  const entries = [];
  const assets = { logos: {}, fonts: {}, css: 'fonts/fonts.css', icons: { lucide: 'icons/lucide', tabler: 'icons/tabler' } };
  for (const key of LOGOS) {
    const logo = file.project?.[key];
    if (!logo) continue;
    const name = `logos/${key}.${logoExtension(logo)}`;
    entries.push({ name, content: await logoBytes(logo, key, designFile) });
    assets.logos[key] = name;
  }
  const faces = shippedIn(file.resolved.typefaces);
  if (faces.length) {
    const fonts = new URL('fonts/', repo);
    const css = await readFile(new URL('fonts.css', fonts), 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      throw new Error('This copy holds no fonts. Export from the design system\'s repository, or write DESIGN.md alone with -o DESIGN.md.');
    });
    for (const face of faces) {
      for (const name of [...filesOf(face), face.licence]) entries.push({ name: `fonts/${name}`, content: await readFile(new URL(name, fonts)) });
      assets.fonts[face.family] = { files: filesOf(face).map((name) => `fonts/${name}`), licence: `fonts/${face.licence}` };
    }
    entries.push({ name: assets.css, content: `/* The typefaces this design uses, beside their files. */\n${fontFaceRules(css, faces)}\n` });
  }
  for (const [set, licence] of [['lucide', 'LICENSE-lucide.txt'], ['tabler', 'LICENSE-tabler.txt']]) {
    for (const [name, , own = name] of ICONS[set]) {
      if (!icons[own]) throw new Error(`The icon ${own} is not in src/components/icons.js.`);
      entries.push({ name: `${assets.icons[set]}/${name}.svg`, content: iconSvg(icons[own]) });
    }
    entries.push({ name: `${assets.icons[set]}/LICENSE`, content: await readFile(new URL(`components/${licence}`, repo)) });
  }
  return [{ name: 'DESIGN.md', content: designMd(file, sourceName, assets) }, ...entries];
}
