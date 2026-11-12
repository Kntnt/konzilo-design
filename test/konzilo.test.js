// How a Konzilo site takes its design: the format version, fromDesign, the fonts command and the tarball.
// docs/spec/konzilo.md holds the contract. Nothing here reads the core: the contract is what is tested.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse, walk } from 'css-tree';
import { DESIGN_FORMAT, checkFormat, defaultInputs, derive, resolve, validateDesignFile, withFormat } from '../src/generator/index.js';
import { coreCss, emitCss } from '../src/css/index.js';
import { shippedIn } from '../src/fonts/catalog.js';
import { fromDesign } from '../src/konzilo/index.js';
import { copyFonts } from '../src/konzilo/fonts.js';
import { writeLogos } from '../src/konzilo/logos.js';
import { breadcrumbProps, footerBrand, footerFromDesign, headerProps, heroProps, identityProps, logoAddresses, logoExtension, menuProps, nextHeadingProps, pageProps } from '../src/components/design-props.js';
import { render } from './helpers/render.js';
import { loadDesign, saveDesign } from '../tool/server.js';
import { newDesign } from '../tool/new-design.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const cli = join(repo, 'bin/konzilo-design.js');
const manifest = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
let scratch;
before(async () => { scratch = await mkdtemp(join(tmpdir(), 'kn-konzilo-')); });
after(() => rm(scratch, { recursive: true, force: true }));

// A site's folder with a design file in `design/`, in the form the tool writes.
let sites = 0;
async function site(inputs = defaultInputs(), change = (file) => file) {
  const root = join(scratch, `site-${sites += 1}`);
  await mkdir(join(root, 'design'), { recursive: true });
  const file = change({ format: DESIGN_FORMAT, inputs, project: { name: 'Example' }, resolved: await resolve(inputs) });
  await writeFile(join(root, 'design/site.design.json'), JSON.stringify(file));
  return root;
}
const typefaces = (over) => {
  const inputs = defaultInputs();
  Object.assign(inputs.typefaces, over);
  return inputs;
};
const NEWER = DESIGN_FORMAT + 1;
const withoutFormat = ({ format, ...file }) => file;

test('the format is a required whole number, and the words for a missing or newer one name both numbers and what to do', async () => {
  assert.equal(DESIGN_FORMAT, 1);
  const inputs = defaultInputs();
  const file = { format: DESIGN_FORMAT, inputs, project: {}, resolved: await resolve(inputs) };
  assert.equal(validateDesignFile(file), file);
  assert.equal(checkFormat(file), file);
  assert.throws(() => checkFormat(withoutFormat(file)), /no format number.*reads format 1.*konzilo-design resolve/);
  assert.throws(() => checkFormat({ ...file, format: NEWER }), new RegExp(`format ${NEWER}.*reads format 1.*Upgrade @kntnt/konzilo-design`));
  assert.throws(() => checkFormat({ ...file, format: '1' }), /"1".*reads format 1.*Set "format" to 1/);
  assert.throws(() => checkFormat({ ...file, format: 0 }), /0.*reads format 1/);
  for (const broken of [withoutFormat(file), { ...file, format: NEWER }]) {
    assert.throws(() => validateDesignFile(broken), /format/);
    await assert.rejects(emitCss(broken), /format/);
  }
});

test('writing fills in a missing format, first in the file, and never lowers a newer one', async () => {
  const file = { inputs: defaultInputs(), project: {} };
  assert.deepEqual(Object.keys(withFormat(file)), ['format', 'inputs', 'project']);
  assert.equal(withFormat({ inputs: {}, format: DESIGN_FORMAT }).format, DESIGN_FORMAT);
  assert.throws(() => withFormat({ format: NEWER }), /Upgrade/);
  assert.equal((await newDesign()).format, DESIGN_FORMAT);
});

test('the commands refuse a missing or newer format, and resolve writes a missing one', async () => {
  const root = await site();
  const path = join(root, 'design/site.design.json');
  const file = JSON.parse(await readFile(path, 'utf8'));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.match(run('check', path).stdout, /Format 1\./);

  await writeFile(path, JSON.stringify(withoutFormat(file)));
  for (const command of ['check', 'css']) {
    const refused = run(command, path);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /no format number.*reads format 1/);
  }
  assert.equal(run('resolve', path).status, 0);
  const written = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(Object.keys(written)[0], 'format');
  assert.equal(written.format, DESIGN_FORMAT);
  assert.equal(run('check', path).status, 0);

  await writeFile(path, JSON.stringify({ ...file, format: NEWER }));
  for (const command of ['check', 'css', 'resolve']) {
    const refused = run(command, path);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, new RegExp(`format ${NEWER}.*reads format 1`));
  }
  assert.equal(JSON.parse(await readFile(path, 'utf8')).format, NEWER, 'a refused file stays as it was');
});

test('the tool opens a file without a format and fills it in at its next save, and refuses a newer one', async () => {
  const root = await site();
  const path = join(root, 'design/site.design.json');
  const file = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify(withoutFormat(file)));
  const before = await readFile(path, 'utf8');
  const model = await loadDesign(path);
  assert.equal(await readFile(path, 'utf8'), before, 'opening a file never writes to it');
  await saveDesign(path, model);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(Object.keys(saved)[0], 'format');
  assert.equal(saved.format, DESIGN_FORMAT);
  await writeFile(path, JSON.stringify({ ...file, format: NEWER }));
  await assert.rejects(loadDesign(path), new RegExp(`format ${NEWER}.*reads format 1`));
});

test('fromDesign refuses, in words naming the file and what to do: no file, not JSON, no format, a newer format, a stale fingerprint, a failed contrast check', async () => {
  const refused = async (message, change) => {
    const root = await site(defaultInputs(), change);
    await assert.rejects(fromDesign('./design/site.design.json', { root }), message);
    assert.equal(existsSync(join(root, 'node_modules')), false, 'a refused design writes nothing');
  };
  await assert.rejects(fromDesign('./nowhere.design.json', { root: await site() }), /no design file at \.\/nowhere\.design\.json/);
  const broken = await site();
  await writeFile(join(broken, 'design/site.design.json'), '{ not json');
  await assert.rejects(fromDesign('./design/site.design.json', { root: broken }), /not JSON/);
  await refused(/site\.design\.json: This design file has no format number, and this version of the design system reads format 1\. Run "konzilo-design resolve/, withoutFormat);
  await refused(new RegExp(`site\\.design\\.json: This design file is format ${NEWER}, and this version of the design system reads format 1\\. Upgrade @kntnt/konzilo-design`), (file) => ({ ...file, format: NEWER }));
  await refused(/out of date.*fingerprint.*konzilo-design resolve \.\/design\/site\.design\.json/, (file) => {
    file.inputs['density-profile'] = 10;
    return file;
  });
  await refused(/contrast check/, (file) => {
    file.resolved.surfaces.page.light.roles.text = file.resolved.surfaces.page.light.roles.background;
    return file;
  });
  await refused(/does not hold what a design file holds/, (file) => {
    delete file.resolved.theme;
    return file;
  });
});

test('fromDesign returns only the body styles and the tokens, each style relative or a package\'s, and each one there', async () => {
  const root = await site(typefaces({ main: 'Mona Sans' }));
  await copyFonts(join(root, 'design/site.design.json'), join(root, 'design/fonts'));
  const given = await fromDesign('./design/site.design.json', { root });
  assert.deepEqual(Object.keys(given), ['bodyStyles', 'tokens']);
  assert.deepEqual(given.tokens, { colors: { primary: '--kn-theme-primary', base: '--kn-theme-base' } });
  assert.deepEqual(given.bodyStyles, [
    './node_modules/.cache/konzilo-design/site.core.css',
    '@kntnt/konzilo-design/body-styles.css',
    '@kntnt/konzilo-design/konzilo.css',
    './design/fonts/fonts.css',
  ]);
  for (const sheet of given.bodyStyles) {
    assert.ok(!sheet.startsWith('/'), `${sheet} would stop being a path from the site's root`);
    if (sheet.startsWith('./')) assert.ok(existsSync(join(root, sheet)), sheet);
    else assert.ok(existsSync(join(repo, manifest.exports[sheet.replace('@kntnt/konzilo-design', '.')])), sheet);
  }
  const file = JSON.parse(await readFile(join(root, 'design/site.design.json'), 'utf8'));
  assert.equal(await readFile(join(root, given.bodyStyles[0]), 'utf8'), coreCss(file.resolved));
});

test('fromDesign takes the root as a URL and a font folder elsewhere, and leaves a core file that has not changed alone', async () => {
  const root = await site(typefaces({ main: 'Mona Sans' }));
  await copyFonts(join(root, 'design/site.design.json'), join(root, 'elsewhere'));
  const options = { root: new URL(`file://${root}/`), fonts: './elsewhere' };
  const { bodyStyles } = await fromDesign('./design/site.design.json', options);
  assert.equal(bodyStyles.at(-1), './elsewhere/fonts.css');
  const cached = join(root, bodyStyles[0]);
  const old = new Date('2026-01-01T00:00:00Z');
  await utimes(cached, old, old);
  await fromDesign('./design/site.design.json', options);
  assert.equal((await stat(cached)).mtime.getTime(), old.getTime(), 'a dev server is not disturbed by a config loaded again');
  assert.deepEqual((await readdir(join(root, 'node_modules/.cache/konzilo-design'))), ['site.core.css'], 'no temporary file stays');
});

test('a design with no typeface of the library needs no font folder, and no font stylesheet', async () => {
  const root = await site();
  const { bodyStyles } = await fromDesign('./design/site.design.json', { root });
  assert.equal(bodyStyles.length, 3);
  assert.ok(!bodyStyles.some((sheet) => sheet.includes('fonts.css')));
});

test('fromDesign refuses a design whose fonts are missing, naming the typeface and the command', async () => {
  const root = await site(typefaces({ main: 'Mona Sans', heading: 'Source Serif 4' }));
  const path = join(root, 'design/site.design.json');
  const words = /uses Mona Sans, Source Serif 4, which \.\/design\/fonts does not hold\. Run "konzilo-design fonts \.\/design\/site\.design\.json -o \.\/design\/fonts" from the design system's repository/;
  await assert.rejects(fromDesign('./design/site.design.json', { root }), words);
  await copyFonts(path, join(root, 'design/fonts'));
  assert.ok(await fromDesign('./design/site.design.json', { root }));
  await rm(join(root, 'design/fonts/SourceSerif4-Italic-VF.woff2'));
  await assert.rejects(fromDesign('./design/site.design.json', { root }), /uses Source Serif 4, which \.\/design\/fonts does not hold/);
  await copyFonts(path, join(root, 'design/fonts'));
  await rm(join(root, 'design/fonts/fonts.css'));
  await assert.rejects(fromDesign('./design/site.design.json', { root }), /Run "konzilo-design fonts/);
});

test('the fonts command copies only the typefaces the design uses, upright and italic, with relative addresses and their licences', async () => {
  const root = await site(typefaces({ main: 'Mona Sans', monospace: 'Red Hat Mono' }));
  const path = join(root, 'design/site.design.json');
  const folder = join(root, 'out');
  const said = execFileSync(process.execPath, [cli, 'fonts', path, '-o', folder], { encoding: 'utf8' });
  assert.match(said, /Mona Sans, Red Hat Mono: 4 font files/);
  const names = (await readdir(folder)).sort();
  assert.deepEqual(names, ['LICENSE-mona-sans.txt', 'LICENSE-red-hat-mono.txt', 'MonaSans-Italic-VF.woff2', 'MonaSans-VF.woff2', 'RedHatMono-Italic-VF.woff2', 'RedHatMono-VF.woff2', 'fonts.css']);
  const css = await readFile(join(folder, 'fonts.css'), 'utf8');
  assert.deepEqual([...new Set([...css.matchAll(/font-family: "([^"]+)"/g)].map((match) => match[1]))], ['Mona Sans', 'Red Hat Mono']);
  const addresses = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.equal(addresses.length, 4);
  for (const address of addresses) {
    assert.match(address, /^\.\/[^/]+\.woff2$/);
    assert.ok(existsSync(join(folder, address)));
  }
  assert.deepEqual(await readFile(join(folder, 'MonaSans-VF.woff2')), await readFile(join(repo, 'src/fonts/MonaSans-VF.woff2')));
});

test('the fonts folder follows the design: a typeface no longer used goes, and what is not the library\'s stays', async () => {
  const root = await site(typefaces({ main: 'Mona Sans' }));
  const path = join(root, 'design/site.design.json');
  const folder = join(root, 'design/fonts');
  await copyFonts(path, folder);
  await writeFile(join(folder, 'own-face.woff2'), 'kept');
  const inputs = typefaces({ main: 'Lora, Georgia, serif' });
  await writeFile(path, JSON.stringify({ format: DESIGN_FORMAT, inputs, project: {}, resolved: await resolve(inputs) }));
  await copyFonts(path, folder);
  assert.deepEqual((await readdir(folder)).sort(), ['LICENSE-lora.txt', 'Lora-Italic-VF.woff2', 'Lora-VF.woff2', 'fonts.css', 'own-face.woff2']);

  const plain = defaultInputs();
  await writeFile(path, JSON.stringify({ format: DESIGN_FORMAT, inputs: plain, project: {}, resolved: await resolve(plain) }));
  assert.match(execFileSync(process.execPath, [cli, 'fonts', path, '-o', folder], { encoding: 'utf8' }), /no typeface of the library/);
  assert.deepEqual(await readdir(folder), ['own-face.woff2']);
});

test('the fonts command refuses a stale design, a missing format, and a stylesheet it did not write', async () => {
  const root = await site(typefaces({ main: 'Mona Sans' }), (file) => {
    file.inputs['density-profile'] = 10;
    return file;
  });
  await assert.rejects(copyFonts(join(root, 'design/site.design.json'), join(root, 'out')), /fingerprint mismatch/);
  const bare = await site(typefaces({ main: 'Mona Sans' }), withoutFormat);
  await assert.rejects(copyFonts(join(bare, 'design/site.design.json'), join(bare, 'out')), /no format number/);
  const own = await site(typefaces({ main: 'Mona Sans' }));
  await mkdir(join(own, 'out'));
  await writeFile(join(own, 'out/fonts.css'), 'a site\'s own');
  await assert.rejects(copyFonts(join(own, 'design/site.design.json'), join(own, 'out')), /not written by this command/);
  assert.equal(await readFile(join(own, 'out/fonts.css'), 'utf8'), 'a site\'s own');
});

// Made-up logos, in the forms a design file holds them.
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>';
const svgUri = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const pngUri = `data:image/png;base64,${PNG.toString('base64')}`;
const withLogos = (logos) => (file) => ({ ...file, project: { ...file.project, ...logos } });

test('the logos command writes a design\'s logos as files, by the type of a data URI or from a path beside the design file', async () => {
  const root = await site(defaultInputs(), withLogos({ logo: svgUri, 'logo-dark': 'brand/night.png' }));
  const path = join(root, 'design/site.design.json');
  await mkdir(join(root, 'design/brand'));
  await writeFile(join(root, 'design/brand/night.png'), PNG);
  const said = execFileSync(process.execPath, [cli, 'logos', path, '-o', join(root, 'public/logos')], { encoding: 'utf8' });
  assert.match(said, /logo\.svg, logo-dark\.png in /);
  assert.deepEqual((await readdir(join(root, 'public/logos'))).sort(), ['logo-dark.png', 'logo.svg']);
  assert.equal(await readFile(join(root, 'public/logos/logo.svg'), 'utf8'), SVG);
  assert.deepEqual(await readFile(join(root, 'public/logos/logo-dark.png')), PNG);
});

test('the logos command reads a data URI however it is written, follows the design, and leaves what is not a logo alone', async () => {
  const words = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;
  const root = await site(defaultInputs(), withLogos({ logo: words, 'logo-dark': svgUri }));
  const path = join(root, 'design/site.design.json');
  const folder = join(root, 'public/logos');
  await writeLogos(path, folder);
  assert.equal(await readFile(join(folder, 'logo.svg'), 'utf8'), SVG);
  await writeFile(join(folder, 'other.svg'), 'kept');
  const file = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...file, project: { name: 'Example', logo: pngUri, 'logo-dark': null } }));
  assert.deepEqual((await writeLogos(path, folder)).files, ['logo.png']);
  assert.deepEqual((await readdir(folder)).sort(), ['logo.png', 'other.svg']);
  await writeFile(path, JSON.stringify({ ...file, project: { name: 'Example' } }));
  assert.match(execFileSync(process.execPath, [cli, 'logos', path, '-o', folder], { encoding: 'utf8' }), /no logo/);
  assert.deepEqual(await readdir(folder), ['other.svg']);
});

test('the logos command refuses what it cannot write, in plain words', async () => {
  const refused = async (logos, words) => {
    const root = await site(defaultInputs(), withLogos(logos));
    await assert.rejects(writeLogos(join(root, 'design/site.design.json'), join(root, 'public/logos')), words);
  };
  await refused({ logo: 'nowhere/logo.svg' }, /logo: there is no file at nowhere\/logo\.svg/);
  await refused({ 'logo-dark': '/etc/logo.svg' }, /logo-dark: use a data URI or a path relative/);
  await refused({ logo: 'https://example.com/logo.svg' }, /logo: use a data URI or a path relative/);
  await refused({ logo: 'data:text/html;base64,AAAA' }, /must be a data URI of an image/);
  const bare = await site(defaultInputs(), (file) => withoutFormat(withLogos({ logo: svgUri })(file)));
  await assert.rejects(writeLogos(join(bare, 'design/site.design.json'), join(bare, 'public/logos')), /no format number/);
});

test('fromDesign refuses a design whose logo has no file, naming the command, and still returns only the styles and tokens', async () => {
  const root = await site(defaultInputs(), withLogos({ logo: svgUri, 'logo-dark': pngUri }));
  const path = join(root, 'design/site.design.json');
  await assert.rejects(fromDesign('./design/site.design.json', { root }), /site\.design\.json has a logo, but \.\/public\/logos does not hold logo\.svg\. Run "konzilo-design logos \.\/design\/site\.design\.json -o \.\/public\/logos"/);
  assert.equal(existsSync(join(root, 'node_modules')), false, 'a refused design writes nothing');
  await writeLogos(path, join(root, 'public/logos'));
  assert.deepEqual(Object.keys(await fromDesign('./design/site.design.json', { root })), ['bodyStyles', 'tokens']);
  await rm(join(root, 'public/logos/logo-dark.png'));
  await assert.rejects(fromDesign('./design/site.design.json', { root }), /does not hold logo-dark\.png/);

  const elsewhere = await site(defaultInputs(), withLogos({ logo: svgUri }));
  await assert.rejects(fromDesign('./design/site.design.json', { root: elsewhere, logos: './static/brand' }), /\.\/static\/brand does not hold logo\.svg\. Run "konzilo-design logos \.\/design\/site\.design\.json -o \.\/static\/brand"/);
  await writeLogos(join(elsewhere, 'design/site.design.json'), join(elsewhere, 'static/brand'));
  assert.ok(await fromDesign('./design/site.design.json', { root: elsewhere, logos: './static/brand' }));

  assert.ok(await fromDesign('./design/site.design.json', { root: await site() }), 'a design with no logo needs no folder');
});

test('a logo\'s served address comes from the design, and the identity takes it in place of what the file holds', () => {
  assert.deepEqual(logoAddresses({ logo: svgUri, 'logo-dark': pngUri }), { light: '/logos/logo.svg', dark: '/logos/logo-dark.png' });
  assert.deepEqual(logoAddresses({ logo: 'brand/mark.PNG' }, { base: '/preview/', folder: '/brand/' }), { light: '/preview/brand/logo.png', dark: undefined });
  assert.deepEqual(logoAddresses({ logo: null }), { light: undefined, dark: undefined });
  assert.equal(logoExtension('data:IMAGE/SVG+XML;base64,AAAA'), 'svg');
  assert.throws(() => logoExtension('data:text/plain,hello'), /must be a data URI of an image/);

  const settings = { ...derive(defaultInputs()).header, identity: 'logo' };
  const project = { name: 'Example', logo: svgUri, 'logo-dark': pngUri };
  const logos = logoAddresses(project);
  // The tool and the presentation give no addresses, and go on with the data URIs.
  assert.deepEqual(identityProps(settings, project).logo, { light: svgUri, dark: pngUri });
  assert.deepEqual(identityProps(settings, project, { logos }).logo, { light: '/logos/logo.svg', dark: '/logos/logo-dark.png' });
  assert.deepEqual(headerProps(settings, project, { logos }).identity.logo, { light: '/logos/logo.svg', dark: '/logos/logo-dark.png' });
  const light = { name: 'Example', logo: svgUri };
  assert.deepEqual(identityProps(settings, light, { logos: logoAddresses(light) }).logo, { light: '/logos/logo.svg', dark: '/logos/logo.svg' });
  const dark = { name: 'Example', 'logo-dark': pngUri };
  assert.deepEqual(identityProps(settings, dark, { logos: logoAddresses(dark) }).logo, { light: '/logos/logo-dark.png', dark: '/logos/logo-dark.png' });
  const none = { name: 'Example' };
  assert.equal(identityProps(settings, none, { logos: logoAddresses(none) }).logo, undefined);
  assert.equal(identityProps(settings, none, { logos: logoAddresses(none) }).name, 'Example');
  const brand = footerBrand({ identity: 'logo', name: 'Example', logo: logos, surface: 'brand' });
  assert.match(brand, /src="\/logos\/logo-dark\.png"/);
  assert.doesNotMatch(brand, /data:/);
});

// The shape the core's collection gives, and its content format holds: an entry with no address only holds others.
const MENU = [
  { title: 'Home', url: '/', items: [] },
  { title: 'About us', url: '/pages/about-us/', items: [{ title: 'Our team', url: '/pages/about-us/team/', items: [{ title: 'Anna', url: '/pages/about-us/team/anna/', items: [] }] }] },
  { title: 'Elsewhere', items: [{ title: 'Shop', url: 'https://shop.example.com/', items: [] }, { title: 'More', items: [{ title: 'Press', url: '/press/', items: [] }] }] },
];

test('the menu adapter turns the core\'s plain entries into Header\'s, with its current page and its link menu', () => {
  assert.deepEqual(menuProps(MENU), [
    { label: 'Home', href: '/' },
    { label: 'About us', href: '/pages/about-us/', children: [{ label: 'Our team', href: '/pages/about-us/team/' }, { label: 'Anna', href: '/pages/about-us/team/anna/' }] },
    { label: 'Elsewhere', children: [{ label: 'Shop', href: 'https://shop.example.com/' }, { label: 'Press', href: '/press/' }], linkMenu: false },
  ]);
  assert.deepEqual(menuProps(), []);
  assert.deepEqual(menuProps([{ title: 'No list', url: '/a/' }]), [{ label: 'No list', href: '/a/' }], 'a list need not be there');

  const current = (address, options) => {
    const marked = [];
    const walk = (items) => items.forEach((item) => { if (item.current) marked.push(item.label); walk(item.children ?? []); });
    walk(menuProps(MENU, { current: address, ...options }));
    return marked;
  };
  assert.deepEqual(current('/pages/about-us/'), ['About us'], 'the page itself, and not what stands above it');
  assert.deepEqual(current('/pages/about-us'), ['About us']);
  assert.deepEqual(current('/pages/about-us/team/anna/'), ['Anna']);
  assert.deepEqual(current('/'), ['Home']);
  assert.deepEqual(current('/nowhere/'), []);
  assert.deepEqual(current('/preview/press/', { base: '/preview/' }), ['Press']);

  const inPreview = menuProps(MENU, { base: '/preview' });
  assert.equal(inPreview[1].href, '/preview/pages/about-us/');
  assert.equal(inPreview[2].children[0].href, 'https://shop.example.com/', 'an address elsewhere stays as it is');

  const chosen = menuProps(MENU, { linkMenu: (entry, index) => entry.title !== 'Home' && index < 3 });
  assert.deepEqual(chosen.map(({ linkMenu }) => linkMenu), [false, undefined, false], 'and an entry with no address never stands there');
});

test('Header renders what the adapter gives: the link menu it chose, the current page, and no address where there is none', async () => {
  const menu = menuProps(MENU, { current: '/pages/about-us/', linkMenu: ({ title }) => title !== 'Home' });
  const html = await render('Header', { identity: { label: 'Example', href: '/', name: 'Example' }, linkMenu: true, menu });
  const linkMenu = html.match(/<nav class="kn-header-link-menu".*?<\/nav>/s)[0];
  assert.deepEqual([...linkMenu.matchAll(/<a [^>]*>([^<]+)/g)].map((match) => match[1]), ['About us']);
  assert.match(linkMenu, /href="\/pages\/about-us\/" aria-current="page"/);
  assert.match(html, /Our team/);
  assert.match(html, /href="https:\/\/shop\.example\.com\/"/);
  assert.doesNotMatch(html, /href="undefined"/);
});

// What the core's reading of the tokens asks: a declaration on `:root` outside any conditional rule, in a layer or not, whose value is a colour a build can read.
function rootDeclarations(css) {
  const found = new Map();
  const walkRules = (node, conditional) => {
    for (const child of node.children) {
      if (child.type === 'Atrule') {
        if (child.block) walkRules(child.block, conditional || child.name !== 'layer');
      } else if (child.type === 'Rule') {
        const selectors = child.prelude.value.split(',').map((selector) => selector.trim());
        for (const declaration of child.block.children) {
          if (declaration.type === 'Declaration' && selectors.includes(':root') && !conditional) found.set(declaration.property, declaration.value.value.trim());
        }
      }
    }
  };
  walkRules(parse(css, { parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false, parseCustomProperty: false }), false);
  return found;
}

test('the theme colours are literals on plain :root: the primary seed exactly, and the page in light mode', () => {
  // The last seed stands so near a page that its ramp does not anchor it, which is why the seed is stored.
  for (const primary of ['#168b83', '#6366F1', '#c0392b', '#abc', '#f4f4f5']) {
    const inputs = { ...defaultInputs(), 'brand-colors': { primary } };
    const resolved = derive(inputs);
    assert.deepEqual(resolved.theme, { primary, base: resolved.surfaces.page.light.roles.background });
    const root = rootDeclarations(coreCss(resolved));
    assert.equal(root.get('--kn-theme-primary'), primary);
    assert.equal(root.get('--kn-theme-base'), resolved.surfaces.page.light.roles.background);
    assert.match(root.get('--kn-background'), /light-dark\(/, 'the roles beside them cannot be read by a build');
  }
  assert.equal(derive(defaultInputs()).theme.base, '#ffffff');
});

const SOURCE = new Set(['.js', '.mjs', '.cjs', '.ts', '.astro', '.css']);
const sourcesIn = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return entry.name.startsWith('.') || ['node_modules', 'dist', 'docs'].includes(entry.name) ? [] : sourcesIn(path);
  return SOURCE.has(extname(entry.name)) ? [path] : [];
});

test('nothing here imports the core, which a site depends on and this package does not', () => {
  const name = ['@kntnt', 'konzilo'].join('/');
  const importing = new RegExp(`(?:from\\s*|import\\s*\\(?\\s*|require\\(\\s*|@import\\s+)['"]${name}(?!-design)(?:/[^'"]*)?['"]`);
  const files = sourcesIn(repo).filter((file) => !statSync(file).isDirectory());
  assert.ok(files.includes(join(repo, 'src/konzilo/index.js')) && files.includes(join(repo, 'tool/server.js')));
  assert.deepEqual(files.filter((file) => importing.test(readFileSync(file, 'utf8'))).map((file) => relative(repo, file)), []);
  assert.ok(importing.test(`import a from '${name}/astro';`), 'the scan catches what it is for');
  assert.ok(!importing.test(`import a from '${name}-design/konzilo';`));
  for (const list of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) assert.equal(manifest[list]?.[name], undefined);
});

test('design props take a site\'s own content, and a setting that is off leaves it out', () => {
  const r = derive(defaultInputs());
  const project = { name: 'Example' };
  const content = { menu: [{ label: 'One', href: '/one/' }], languages: [{ label: 'Svenska', href: '/sv/' }], search: { action: '/search/', links: [{ label: 'Hot', href: '/hot/' }] }, cta: { label: 'Go', href: '/go/' }, home: '/start/', menuWord: 'Meny' };
  const on = { ...r.header, language: true, search: true, cta: true, 'search-links': true, 'menu-button': 'word' };
  const header = headerProps(on, project, content);
  assert.equal(header.menu, content.menu);
  assert.equal(header.identity.href, '/start/');
  assert.deepEqual(header.languages, content.languages);
  assert.equal(header.cta, content.cta);
  assert.equal(header.search.action, '/search/');
  assert.deepEqual(header.search.links, content.search.links);
  assert.deepEqual(header.menuButton, { word: 'Meny' });
  const off = headerProps({ ...on, language: false, search: false, cta: false }, project, content);
  assert.deepEqual([off.languages, off.search, off.cta], [[], undefined, undefined]);
  assert.equal(headerProps(on, project, {}).search, undefined, 'a site without a search has none to show');
  assert.equal(headerProps(on, project).identity.href, '/');
  assert.equal(identityProps(r.header, project).href, '/');

  const hero = (settings) => heroProps({ ...r.hero, ...settings }, { behind: 'wide.webp', side: 'side.webp', alt: 'A field' });
  assert.deepEqual([hero({ picture: 'behind' }).picture, hero({ picture: 'behind' }).alt], ['wide.webp', undefined]);
  assert.deepEqual([hero({ picture: 'end' }).picture, hero({ picture: 'end' }).alt, hero({ picture: 'end' }).side], ['side.webp', 'A field', 'end']);
  assert.equal(hero({ picture: 'none' }).picture, undefined);
  assert.deepEqual(nextHeadingProps({ h1: 'below' }), { level: 1, type: 'heading-1' });

  const trail = [{ label: 'Services', href: '/services/' }, { label: 'Here' }];
  const crumbs = breadcrumbProps({ ...r.breadcrumbs, home: 'name' }, project, { trail, home: '/start/' });
  assert.deepEqual(crumbs.items, [{ label: 'Example', href: '/start/' }, ...trail]);
  assert.equal(breadcrumbProps({ ...r.breadcrumbs, home: 'word' }, project, { homeWord: 'Hem' }).items[0].label, 'Hem');
  assert.deepEqual(breadcrumbProps({ ...r.breadcrumbs, show: false }, project, { trail }).items, [], 'a design with its trail off shows none');
  assert.deepEqual(Object.keys(pageProps(r.page)), ['shadow', 'edgeLine', 'fillLight', 'fillDark']);
});

test('the rows above and below the large menu reach a site where the design has them on, and only there', async () => {
  const r = derive(defaultInputs());
  const project = { name: 'Example' };
  const menu = [{ label: 'One', href: '/one/', children: [{ label: 'Two', href: '/two/' }] }];
  assert.deepEqual([r.header['menu-above'], r.header['menu-below']], [false, false], 'off in a design that says nothing');
  const rows = { 'menu-above': '<p class="site-above">From the journal</p>', 'menu-below': '<p class="site-below">Contact us</p>' };
  const shown = async (settings) => {
    const props = headerProps({ ...r.header, ...settings }, project, { menu });
    const html = await render('Header', props, rows);
    // The row's own box counts on its own: an empty row would still draw its space and its line.
    assert.equal(html.includes('kn-megamenu-above'), html.includes('site-above'), 'a row above shows only with what it holds');
    assert.equal(html.includes('kn-megamenu-below'), html.includes('site-below'), 'a row below shows only with what it holds');
    return [props.menuAbove, props.menuBelow, html.includes('kn-megamenu-above'), html.includes('kn-megamenu-below')];
  };
  assert.deepEqual(await shown({}), [false, false, false, false], 'what the site gives for a row that is off stays out');
  assert.deepEqual(await shown({ 'menu-above': true }), [true, false, true, false]);
  assert.deepEqual(await shown({ 'menu-below': true }), [false, true, false, true]);
  assert.deepEqual(await shown({ 'menu-above': true, 'menu-below': true }), [true, true, true, true]);
  // Header used on its own, as the gallery does, shows what its slots hold, and no row where it is given nothing.
  const alone = await render('Header', { identity: { label: 'Example', href: '/', name: 'Example' }, menu, menuButton: { word: 'Menu' } }, rows);
  assert.ok(alone.includes('site-above') && alone.includes('site-below'));
  const empty = await render('Header', headerProps({ ...r.header, 'menu-above': true, 'menu-below': true }, project, { menu }));
  assert.equal(empty.includes('kn-megamenu-above') || empty.includes('kn-megamenu-below'), false, 'rows on but nothing to hold draw no row');
});

// konzilo.md's layout, copied as written, for any choice of cells: every cell that shows holds something, so no empty
// cell counts when the footer spreads the others, and the first is the brand, as the header shows it.
test('the footer in konzilo.md\'s layout fills every cell a design turns on, with the brand in the upper band\'s A1', async () => {
  const doc = await readFile(join(repo, 'docs/spec/konzilo.md'), 'utf8');
  const code = /^const content = (\{[\s\S]*?^\});$/m.exec(doc)?.[1];
  assert.ok(code, 'the layout gives the footer its content');
  const r = derive(defaultInputs());
  const design = { project: { name: 'Example', slogan: '' } };
  const content = new Function('footerBrand', 'header', 'design', 'logos', 'footer', 'base', 'footerLinks', `return (${code});`)(
    footerBrand, r.header, design, { light: '/logos/logo.svg', dark: '/logos/logo-dark.svg' }, r.footer, '/', [{ label: 'About', href: '/about/' }]);
  const slots = { 'lower-a2': '<p>Policies</p>', 'lower-b2': '<p>Consent buttons</p>' };
  const cells = ['a1', 'b1', 'a2', 'b2'];
  for (const on of [255, 0b10010001, 0b00001111, 0b11110000, 0b01100110]) {
    const pick = (band, offset) => ({ ...r.footer[band], cells: Object.fromEntries(cells.map((cell, i) => [cell, !!(on & (1 << (offset + i)))])) });
    const settings = { ...r.footer, upper: pick('upper', 0), lower: pick('lower', 4) };
    const html = await render('Footer', footerFromDesign(settings, content), slots);
    const boxes = [...html.matchAll(/data-kn-cell="(\w+)"[^>]*>\s*<div class="kn-footer-box">([\s\S]*?)<\/div>\s*<\/div>/g)];
    assert.equal(boxes.length, [...on.toString(2)].filter((bit) => bit === '1').length, `cells ${on.toString(2)}`);
    for (const [, cell, inner] of boxes) assert.match(inner, /<(p|ul|span)\b/, `cell ${cell} of ${on.toString(2)} holds something`);
    if (on & 1) assert.match(boxes[0][2], /class="kn-brand"/, 'the upper band starts with the brand');
  }
});

// The tarball itself: packed, installed with no network into a folder that knows nothing of this repository, and run there.
test('the tarball holds what a site needs, and no fonts, tool or presentation, and works where it is installed', { timeout: 120000 }, async () => {
  const folder = join(scratch, 'tarball');
  await mkdir(folder);
  const [{ filename, size, files }] = JSON.parse(execFileSync('npm', ['pack', '--json', '--silent', '--pack-destination', folder], { cwd: repo, encoding: 'utf8' }));
  const held = files.map(({ path }) => path);
  for (const needed of ['package.json', 'README.md', 'bin/konzilo-design.js', 'src/cli/backup.js', 'schema/design-file.schema.json', 'src/konzilo/index.js', 'src/konzilo/fonts.js', 'src/konzilo/logos.js', 'src/konzilo/konzilo.css', 'src/konzilo/body-styles.css', 'src/fonts/catalog.js', 'src/generator/index.js', 'src/css/index.js', 'src/components/index.css', 'src/components/Footer.astro', 'src/components/design-props.js', 'docs/spec/konzilo.md', 'docs/spec/names.md', 'src/directives/components.json', 'src/directives/checks.js', 'src/directives/render/render.js', 'src/directives/astro/Section.astro', 'src/presentations/Filtered.astro', 'src/presentations/teasers.js', 'src/konzilo/directives.js']) {
    assert.ok(held.includes(needed), `the tarball lacks ${needed}`);
  }
  const unwanted = held.filter((path) => /\.(woff2?|ttf|otf|zip|webp)$/.test(path) || /^(tool|presentation|gallery|test|examples)\//.test(path) || path === 'DESIGN.md' || /\.design(\.bak)?\.json$/.test(path) || path === 'src/fonts/fonts.css');
  assert.deepEqual(unwanted, []);
  for (const target of Object.values(manifest.exports).filter((target) => !target.includes('*'))) assert.ok(held.includes(target.replace('./', '')), `an export the tarball does not hold: ${target}`);
  assert.ok(size < 2 * 1024 * 1024, `the tarball is ${size} bytes, against about 1 MB`);

  const root = join(folder, 'site');
  await mkdir(join(root, 'design'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{ "name": "scratch-site", "private": true, "type": "module" }\n');
  execFileSync('npm', ['install', join(folder, filename), '--offline', '--no-audit', '--no-fund', '--silent'], { cwd: root, encoding: 'utf8' });
  const installed = join(root, 'node_modules/@kntnt/konzilo-design');
  assert.ok(existsSync(join(installed, 'src/konzilo/index.js')));
  assert.equal(readdirSync(join(installed, 'src/fonts')).join(), 'catalog.js');
  assert.deepEqual(readdirSync(join(root, 'node_modules')).filter((name) => !name.startsWith('.')), ['@kntnt'], 'nothing more is installed');

  const inputs = typefaces({ main: 'Mona Sans' });
  await writeFile(join(root, 'design/site.design.json'), JSON.stringify({ format: DESIGN_FORMAT, inputs, project: { name: 'Example', logo: svgUri }, resolved: await resolve(inputs) }));
  const script = `
    import { fromDesign } from '@kntnt/konzilo-design/konzilo';
    import { headerProps, logoAddresses, menuProps } from '@kntnt/konzilo-design/design-props';
    import { createRequire } from 'node:module';
    import { existsSync } from 'node:fs';
    const given = await fromDesign('./design/site.design.json', { fonts: process.argv[2] });
    const require = createRequire(import.meta.url);
    const found = given.bodyStyles.map((sheet) => sheet.startsWith('./') ? existsSync(sheet) : existsSync(require.resolve(sheet)));
    console.log(JSON.stringify({ given, found, header: typeof headerProps, logos: logoAddresses({ logo: 'data:image/svg+xml,x' }), menu: menuProps([{ title: 'A', url: '/a/' }]) }));`;
  await writeFile(join(root, 'run.mjs'), script);
  const run = (...args) => spawnSync(process.execPath, ['run.mjs', ...args], { cwd: root, encoding: 'utf8' });

  const missing = run();
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /uses Mona Sans, which \.\/design\/fonts does not hold\. Run "konzilo-design fonts/);

  // The fonts are copied from this repository, as a site's are, and the build then stops at the logo.
  await copyFonts(join(root, 'design/site.design.json'), join(root, 'design/fonts'));
  const noLogo = run();
  assert.equal(noLogo.status, 1);
  assert.match(noLogo.stderr, /has a logo, but \.\/public\/logos does not hold logo\.svg\. Run "konzilo-design logos/);
  // The logos need nothing of this repository, so the site's own command writes them.
  assert.match(execFileSync(join(root, 'node_modules/.bin/konzilo-design'), ['logos', 'design/site.design.json'], { cwd: root, encoding: 'utf8' }), /logo\.svg in \.\/public\/logos/);
  assert.equal(await readFile(join(root, 'public/logos/logo.svg'), 'utf8'), SVG);
  const ran = run();
  assert.equal(ran.status, 0, ran.stderr);
  const { given, found, header, logos, menu } = JSON.parse(ran.stdout);
  assert.equal(logos.light, '/logos/logo.svg');
  assert.deepEqual(menu, [{ label: 'A', href: '/a/' }]);
  assert.deepEqual(found, given.bodyStyles.map(() => true));
  assert.equal(given.bodyStyles[1], '@kntnt/konzilo-design/body-styles.css');
  assert.equal(header, 'function');
  assert.match(await readFile(join(root, given.bodyStyles[0]), 'utf8'), /--kn-theme-primary: #168b83;/);

  // Its command works there for what it holds, and says plainly what it does not.
  const bin = join(root, 'node_modules/.bin/konzilo-design');
  assert.match(execFileSync(bin, ['check', 'design/site.design.json'], { cwd: root, encoding: 'utf8' }), /Format 1\./);
  for (const [args, words] of [[['tool', 'design/site.design.json'], /no "tool" command/], [['presentation', 'design/site.design.json'], /no "presentation" command/], [['design-md', 'design/site.design.json'], /no "design-md" command/], [['fonts', 'design/site.design.json'], /holds no fonts.*repository/]]) {
    const refused = spawnSync(bin, args, { cwd: root, encoding: 'utf8' });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, words);
  }
  // A package stylesheet resolves through the exports, and what the tarball leaves out does not.
  const require = createRequire(join(root, 'run.mjs'));
  assert.ok(existsSync(require.resolve('@kntnt/konzilo-design/components/Footer.astro')));
  assert.ok(existsSync(require.resolve('@kntnt/konzilo-design/components.css')));
  assert.throws(() => require.resolve('@kntnt/konzilo-design/fonts.css'), /not exported|ERR_PACKAGE_PATH_NOT_EXPORTED/);
  // The directives' declarations, checks, components and presentations resolve there as a site names them.
  const { DESIGN_COMPONENT_CHECKS, DESIGN_COMPONENTS_FROM, DESIGN_DIRECTIVES, DESIGN_PRESENTATIONS } = await import(pathToFileURL(require.resolve('@kntnt/konzilo-design/konzilo')).href);
  for (const specifier of [DESIGN_COMPONENTS_FROM, DESIGN_COMPONENT_CHECKS, ...Object.values(DESIGN_DIRECTIVES), ...Object.values(DESIGN_PRESENTATIONS)]) {
    assert.ok(require.resolve(specifier).startsWith(realpathSync(installed)), specifier);
  }
  const { componentProblems } = await import(pathToFileURL(require.resolve(DESIGN_COMPONENT_CHECKS)).href);
  assert.deepEqual(componentProblems('section', {}, []), []);
});

test('the typefaces a design uses are read from its resolved stacks, so fromDesign needs no font in the package', () => {
  const faces = shippedIn(derive(typefaces({ main: 'Mona Sans', monospace: 'Red Hat Mono' })).typefaces);
  assert.deepEqual(faces.map(({ family }) => family), ['Mona Sans', 'Red Hat Mono']);
});
