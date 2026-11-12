// How a Konzilo site takes its design, in its astro.config.mjs:
//
//   konzilo({ ...await fromDesign('./design/site.design.json'), presentations: { ... } })
//
// A site depends on this package and the core on neither, so nothing here imports the core: this returns what the
// integration already takes. A site without a design file never calls it.
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFormat, validateDesignFile } from '../generator/validate.js';
import { checkFingerprint } from '../generator/fingerprint.js';
import { checkContrast } from '../generator/surface.js';
import { coreCss } from '../css/index.js';
import { shippedIn } from '../fonts/catalog.js';
import { FONT_CSS, filesOf } from './fonts.js';
import { DEFAULT_FOLDER, logoFiles } from './logos.js';

export { DESIGN_COMPONENT_CHECKS, DESIGN_COMPONENTS_FROM, DESIGN_DIRECTIVES, DESIGN_PRESENTATIONS } from './directives.js';

const PACKAGE = '@kntnt/konzilo-design';
const pathOf = (place) => (place instanceof URL ? fileURLToPath(place) : String(place));
// The integration reads `./` or `../` from the site's root as a file there, and anything else as a package's stylesheet.
function fromRoot(root, path) {
  const way = relative(root, path).split(sep).join('/');
  return way.startsWith('../') ? way : `./${way}`;
}
const readable = async (path) => readFile(path, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});

// A file resolved when it was last changed, of a format this version reads, whose values pass every check.
async function checkedDesign(path, name) {
  const text = await readable(path);
  if (text === null) throw new Error(`There is no design file at ${name}. A site without a design file does not call fromDesign.`);
  let file;
  try {
    file = JSON.parse(text);
  } catch (error) {
    throw new Error(`${name} is not a design file, as it is not JSON: ${error.message}`);
  }
  const resolving = `Run "konzilo-design resolve ${name}", or make a change to it in the design tool.`;
  try {
    checkFormat(file);
  } catch (error) {
    throw new Error(`${name}: ${error.message}`);
  }
  try {
    await checkFingerprint(file);
  } catch {
    throw new Error(`${name} is out of date: its inputs have changed since its values were made, so its fingerprint does not match them. ${resolving}`);
  }
  try {
    validateDesignFile(file);
  } catch (error) {
    throw new Error(`${name} does not hold what a design file holds (${error.message}). ${resolving}`);
  }
  try {
    checkContrast(file.resolved);
  } catch (error) {
    throw new Error(`${name} does not pass the contrast check, so a site cannot use it (${error.message}). Change its colours in the design tool.`);
  }
  return file;
}

// The stylesheet of the typefaces the design uses, or null if it uses none. The fonts are not in this package.
async function fontStylesheet(file, folder, name, way) {
  const faces = shippedIn(file.resolved.typefaces);
  if (!faces.length) return null;
  const css = await readable(join(folder, FONT_CSS));
  const there = (font) => access(join(folder, font)).then(() => true, () => false);
  const missing = [];
  for (const face of faces) {
    const present = await Promise.all(filesOf(face).map(there));
    if (present.includes(false) || !css?.includes(`font-family: "${face.family}"`)) missing.push(face.family);
  }
  if (missing.length) throw new Error(`${name} uses ${missing.join(', ')}, which ${way} does not hold. Run "konzilo-design fonts ${name} -o ${way}" from the design system's repository, and keep the folder in the site's repository.`);
  return join(folder, FONT_CSS);
}

// A design's logos are served as files, which the core's content security policy allows whether or not a site lets it
// take an image at a data: address (its security.dataImages).
async function checkLogos(file, folder, name, way) {
  for (const { filename } of logoFiles(file.project)) {
    if (!await access(join(folder, filename)).then(() => true, () => false)) {
      throw new Error(`${name} has a logo, but ${way} does not hold ${filename}. Run "konzilo-design logos ${name} -o ${way}", and keep the folder in the site's repository.`);
    }
  }
}

// Writes the file only when it changes, whole, so a running dev server is not disturbed by a config loaded again.
async function writeCached(path, css) {
  if (await readable(path) === css) return;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}`;
  await writeFile(temporary, css);
  await rename(temporary, path);
}

// `options.root` is the site's root, the working directory by default, which is where Astro runs a site's config from.
// `options.fonts` is the folder of the design's typefaces, `fonts` beside the design file by default, and `options.logos`
// is the folder of its logos, from the root, `./public/logos` by default.
export async function fromDesign(path, { root = process.cwd(), fonts, logos = DEFAULT_FOLDER } = {}) {
  const site = resolve(pathOf(root));
  const designFile = resolve(site, pathOf(path));
  const name = pathOf(path);
  const file = await checkedDesign(designFile, name);
  const folder = fonts === undefined ? join(dirname(designFile), 'fonts') : resolve(site, pathOf(fonts));
  const fontCss = await fontStylesheet(file, folder, name, fromRoot(site, folder));
  const logoFolder = resolve(site, pathOf(logos));
  await checkLogos(file, logoFolder, name, fromRoot(site, logoFolder));
  const cached = join(site, 'node_modules', '.cache', 'konzilo-design', `${basename(designFile).replace(/(\.design)?\.json$/, '')}.core.css`);
  await writeCached(cached, coreCss(file.resolved));
  return {
    bodyStyles: [
      fromRoot(site, cached),
      `${PACKAGE}/body-styles.css`,
      `${PACKAGE}/konzilo.css`,
      ...(fontCss ? [fromRoot(site, fontCss)] : []),
    ],
    tokens: { colors: { primary: '--kn-theme-primary', base: '--kn-theme-base' } },
  };
}
