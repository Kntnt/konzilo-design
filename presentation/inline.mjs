import { readFile, writeFile, readdir } from 'node:fs/promises';
import { extname, join, resolve, relative } from 'node:path';
import { rolldown } from 'rolldown';
import * as csstree from 'css-tree';
import { componentsCss } from '../src/css/components.js';
import { coreCss } from '../src/css/index.js';
import { shippedIn } from '../src/fonts/catalog.js';
import { fontFaceRules } from '../src/konzilo/fonts.js';
import { PICTURE_URL } from './src/samples.js';
import { OWN_PICTURES_PATH, PICTURE_TYPES, readOwnPicture } from './own-pictures.mjs';

export async function forcedStates() {
  const tree = csstree.parse(await componentsCss());
  csstree.walk(tree, {
    visit: 'PseudoClassSelector',
    enter(node) {
      const name = { hover: 'hover', focus: 'focus', 'focus-visible': 'focus', active: 'active', disabled: 'disabled' }[node.name];
      if (!name) return;
      node.type = 'ClassSelector';
      node.name = `is-${name}`;
      delete node.children;
    },
  });
  return csstree.generate(tree);
}

// A presentation carries only the typefaces its design uses: all of them would weigh megabytes.
async function fontCss(resolved) {
  const all = await readFile(new URL('../src/fonts/fonts.css', import.meta.url), 'utf8');
  let css = fontFaceRules(all, shippedIn(resolved.typefaces));
  for (const match of [...css.matchAll(/url\("(.+?)"\)/g)]) {
    const bytes = await readFile(new URL(`../src/fonts/${match[1]}`, import.meta.url));
    css = css.replace(match[0], `url("data:font/woff2;base64,${bytes.toString('base64')}")`);
  }
  return css;
}

// A stock photo from this folder, or a design's own from the one beside its file.
async function pictureData(url, designFile) {
  const own = url.startsWith(OWN_PICTURES_PATH) && await readOwnPicture(designFile, url.slice(OWN_PICTURES_PATH.length));
  const bytes = own ? own.bytes : await readFile(new URL(`.${url.replace('/presentation', '')}`, import.meta.url));
  const type = own ? own.type : PICTURE_TYPES[extname(url)];
  return `data:${type};base64,${bytes.toString('base64')}`;
}

const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const safeScript = (value) => value.replace(/<\/script/gi, '<\\/script');

export async function inlineBuild(directory, resolved, designFile) {
  const root = resolve(directory);
  const local = (path) => {
    if (/^(?:[a-z]+:|\/\/)/i.test(path)) throw new Error(`External build asset refused: ${path}`);
    const target = resolve(root, path.replace(/^\//, ''));
    if (relative(root, target).startsWith('..')) throw new Error('Build asset escapes output');
    return target;
  };
  const shared = [coreCss(resolved), await componentsCss(), await fontCss(resolved), await forcedStates()].join('\n');
  const scripts = [];
  const styles = [];
  const bundleCache = new Map();
  function intern(pool, value) {
    let index = pool.indexOf(value);
    if (index === -1) {
      index = pool.length;
      pool.push(value);
    }
    return index;
  }
  async function bundle(path) {
    if (!bundleCache.has(path)) {
      const build = await rolldown({ input: local(path), logLevel: 'silent' });
      try {
        const output = await build.generate({ format: 'iife', minify: true });
        bundleCache.set(path, safeScript(output.output[0].code));
      } finally {
        await build.close();
      }
    }
    return bundleCache.get(path);
  }
  async function extract(source) {
    const scriptIds = [];
    const styleIds = [];
    let html = source;
    for (const match of [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]) {
      if (/application\/json/.test(match[1])) continue;
      // A header's polyfill loader fetches its polyfill by address, which an offline document cannot: the polyfill
      // itself goes in instead, and tests for its feature as the loader did.
      const polyfill = /\bdata-kn-polyfill\b/.test(match[1]) && match[2].match(/const src = "([^"]+)"/);
      const path = polyfill ? [, polyfill[1]] : match[1].match(/src="([^"]+)"/);
      const source = path ? await bundle(path[1]) : match[2];
      const code = safeScript(`(function () {${source}})();`);
      scriptIds.push(intern(scripts, code));
      html = html.replace(match[0], '');
    }
    html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
      styleIds.push(intern(styles, css));
      return '';
    });
    html = html.replace(/<link\b[^>]*rel="(?:modulepreload|preload)"[^>]*>/gi, '');
    return { html, scripts: scriptIds, styles: styleIds };
  }
  const specimens = {};
  for (const entry of await readdir(join(root, 'specimens'))) {
    const source = await extract(await readFile(join(root, 'specimens', entry, 'index.html'), 'utf8'));
    const body = source.html.match(/<body\b[\s\S]*<\/body>/i)?.[0];
    if (!body) throw new Error(`Specimen has no body: ${entry}`);
    specimens[entry] = { body, scripts: source.scripts, styles: source.styles };
  }
  // Every component on one page is for the tool; the report shows them one at a time.
  const catalogue = specimens.catalogue;
  delete specimens.catalogue;
  const main = await extract(await readFile(join(root, 'index.html'), 'utf8'));
  // The report keeps one copy of each picture, and a specimen takes it when it opens.
  const pictures = {};
  const used = [...JSON.stringify(specimens).matchAll(PICTURE_URL), ...main.html.matchAll(PICTURE_URL)];
  for (const url of new Set(used.map(([found]) => found))) pictures[url] = await pictureData(url, designFile);
  const data = { specimens, styles: [...styles], scripts: [...scripts], pictures };
  let html = main.html.replace(PICTURE_URL, (url) => pictures[url]).replace('</head>', () => `<style id="kn-shared">${shared}</style>${main.styles.map((index) => `<style>${styles[index]}</style>`).join('')}</head>`);
  html = html.replace('</body>', () => `<script id="kn-specimen-data" type="application/json">${safeJson(data)}</script>${main.scripts.map((index) => `<script>${scripts[index]}</script>`).join('')}</body>`);
  const standalone = ({ body, styles: own, scripts: run }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${shared}\n${own.map((index) => styles[index]).join('\n')}</style><style id="kn-live-core"></style></head>${body}${run.map((index) => `<script>${scripts[index]}</script>`).join('')}</html>`;
  const previewHtml = standalone(specimens.preview);
  const catalogueHtml = standalone(catalogue);
  await writeFile(join(root, 'index.html'), html);
  return { html, preview: previewHtml, catalogue: catalogueHtml };
}
