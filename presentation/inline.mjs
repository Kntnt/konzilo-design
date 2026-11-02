import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { rolldown } from 'rolldown';
import * as csstree from 'css-tree';
import { componentsCss } from '../src/css/components.js';

// Generate forced states from the actual selectors. The library remains untouched.
export async function forcedStates() {
  const tree = csstree.parse(await componentsCss());
  csstree.walk(tree, {
    visit: 'PseudoClassSelector',
    enter(node) {
      const name = {
        hover: 'hover',
        focus: 'focus',
        'focus-visible': 'focus',
        active: 'active',
        disabled: 'disabled',
      }[node.name];
      if (name) {
        node.type = 'ClassSelector';
        node.name = `is-${name}`;
        delete node.children;
      }
    },
  });
  return csstree.generate(tree);
}
export async function inlineBuild(directory) {
  const root = resolve(directory);
  const local = (path) => {
    if (/^(?:[a-z]+:|\/\/)/i.test(path))
      throw new Error(`External build asset refused: ${path}`);
    const target = resolve(root, path.replace(/^\//, ''));
    if (relative(root, target).startsWith('..'))
      throw new Error('Build asset escapes output');
    return target;
  };
  const states = await forcedStates();
  const assetCache = new Map();
  async function inline(html) {
    async function replace(pattern, fn) {
      const matches = [...html.matchAll(pattern)];
      const values = await Promise.all(matches.map(fn));
      let i = 0;
      html = html.replace(pattern, () => values[i++]);
    }
    await replace(
      /<link\b[^>]*rel="stylesheet"[^>]*>/gi,
      async ([tag]) =>
        `<style>${await readFile(local(tag.match(/href="([^"]+)"/)[1]), 'utf8')}</style>`,
    );
    await replace(
      /<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)>\s*<\/script>/gi,
      async ([, before, path, after]) => {
        if (!assetCache.has(path))
          assetCache.set(
            path,
            (async () => {
              const bundle = await rolldown({
                input: local(path),
                logLevel: 'silent',
              });
              try {
                return (await bundle.generate({ format: 'iife', minify: true }))
                  .output[0].code;
              } finally {
                await bundle.close();
              }
            })(),
          );
        return `<script${before}${after}>${(await assetCache.get(path)).replace(/<\/script/gi, '<\\/script')}</script>`;
      },
    );
    return html
      .replace(/<link\b[^>]*rel="(?:modulepreload|preload)"[^>]*>/gi, '')
      .replace('</head>', `<style>${states}</style></head>`);
  }
  const specimens = {};
  for (const entry of await readdir(join(root, 'specimens'))) {
    const path = join(root, 'specimens', entry, 'index.html');
    specimens[entry] = await inline(await readFile(path, 'utf8'));
  }
  let document = await inline(await readFile(join(root, 'index.html'), 'utf8'));
  document = document.replace(
    /<iframe\b([^>]*data-specimen-frame="([^"]+)"[^>]*)>\s*<\/iframe>/g,
    (_, attrs, id) => {
      if (!specimens[id]) throw new Error(`Unknown specimen ${id}`);
      const escaped = specimens[id]
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
      return `<iframe ${attrs} srcdoc="${escaped}"></iframe>`;
    },
  );
  await writeFile(join(root, 'index.html'), document);
  await writeFile(join(root, 'preview.html'), specimens.preview);
  return { html: document, preview: specimens.preview };
}
