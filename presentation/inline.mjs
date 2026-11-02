import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { rolldown } from 'rolldown';
import * as csstree from 'css-tree';
import { componentsCss } from '../src/css/components.js';
import { coreCss } from '../src/css/index.js';

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

async function fontCss() {
  let css = await readFile(new URL('../src/fonts/fonts.css', import.meta.url), 'utf8');
  for (const match of [...css.matchAll(/url\("(.+?)"\)/g)]) {
    const bytes = await readFile(new URL(`../src/fonts/${match[1]}`, import.meta.url));
    css = css.replace(match[0], `url("data:font/woff2;base64,${bytes.toString('base64')}")`);
  }
  return css;
}

const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const safeScript = (value) => value.replace(/<\/script/gi, '<\\/script');

export async function inlineBuild(directory, resolved) {
  const root = resolve(directory);
  const local = (path) => {
    if (/^(?:[a-z]+:|\/\/)/i.test(path)) throw new Error(`External build asset refused: ${path}`);
    const target = resolve(root, path.replace(/^\//, ''));
    if (relative(root, target).startsWith('..')) throw new Error('Build asset escapes output');
    return target;
  };
  const shared = [coreCss(resolved), await componentsCss(), await fontCss(), await forcedStates()].join('\n');
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
      const path = match[1].match(/src="([^"]+)"/);
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
  const data = { specimens, styles: [...styles], scripts: [...scripts] };
  const main = await extract(await readFile(join(root, 'index.html'), 'utf8'));
  let html = main.html.replace('</head>', () => `<style id="kn-shared">${shared}</style>${main.styles.map((index) => `<style>${styles[index]}</style>`).join('')}</head>`);
  html = html.replace('</body>', () => `<script id="kn-specimen-data" type="application/json">${safeJson(data)}</script>${main.scripts.map((index) => `<script>${scripts[index]}</script>`).join('')}</body>`);
  const preview = specimens.preview;
  const previewHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${shared}\n${preview.styles.map((index) => styles[index]).join('\n')}</style><style id="kn-live-core"></style></head>${preview.body}${preview.scripts.map((index) => `<script>${scripts[index]}</script>`).join('')}</html>`;
  await writeFile(join(root, 'index.html'), html);
  return { html, preview: previewHtml };
}
