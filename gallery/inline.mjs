import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { parse } from 'ultrahtml';
import { querySelectorAll as all, querySelector as one } from 'ultrahtml/selector';
import { nextId } from '../src/components/ids.js';
import { rolldown } from 'rolldown';

const output = new URL('./dist/index.html', import.meta.url);
function localAsset(path) {
  if (/^(?:[a-z]+:|\/\/)/i.test(path)) throw new Error(`External asset refused: ${path}`);
  const url = new URL(path.replace(/^\//, ''), new URL('./dist/', import.meta.url));
  if (!fileURLToPath(url).startsWith(fileURLToPath(new URL('./dist/', import.meta.url)))) throw new Error('Asset escapes gallery output');
  return url;
}
const textOf = (node) => node?.value ?? node?.children?.map(textOf).join('') ?? '';
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function withTooltips(source) {
  const tree = parse(source);
  const controls = all(tree, 'input, select, textarea, button, summary, a').filter((node) => node.name !== 'a' || 'data-kn-trigger' in node.attributes);
  const tips = []; let index = 0;
  source = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<(?:(?:input|select|textarea|button|summary)\b|a\b(?=[^>]*data-kn-trigger))[^>]*>/gi, (tag) => {
    if (tag.startsWith('<script')) return tag;
    const node = controls[index++]; if (!node) throw new Error('Tooltip control mismatch');
    const described = node.attributes['aria-describedby']?.split(' ') ?? [];
    if (described.some((id) => one(tree, `#${id}`)?.attributes.role === 'tooltip')) return tag;
    const id = nextId('kn-gallery-tip');
    const label = node.attributes['aria-label'] ?? (textOf(node.attributes.id ? all(tree, 'label').find((label) => label.attributes.for === node.attributes.id) : undefined).trim() || node.attributes.name || textOf(node).trim() || 'Example control');
    const action = node.name === 'summary' ? 'Open or close this content with a click, Enter or Space.' : node.name === 'select' ? 'Choose an option to compare the example.' : node.name === 'button' ? 'Activate this example action with a click, Enter or Space.' : ['checkbox', 'radio'].includes(node.attributes.type) ? 'Select this choice with a click or the keyboard.' : 'Enter a value to try this example field.';
    tips.push(`<span class="g-control-tip" id="${id}" role="tooltip" data-kn-surface="inverse" hidden>${escape(label + '. ' + action)}</span>`);
    const clean = tag.replace(/\saria-describedby="[^"]*"/, '');
    return clean.replace(/\s*\/?>(?=$)/, ` aria-describedby="${[...described, id].join(' ')}" data-g-tooltip="${id}">`);
  });
  return source.replace('</body>', `${tips.join('')}</body>`);
}
async function inline(source) {
  async function replace(pattern, callback) {
    const matches = [...source.matchAll(pattern)];
    const replacements = await Promise.all(matches.map(callback));
    let index = 0;
    source = source.replace(pattern, () => replacements[index++]);
  }
  await replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi, async ([tag]) => {
    const path = tag.match(/href="([^"]+)"/i)?.[1];
    if (!path) throw new Error('Stylesheet has no path');
    const css = await readFile(localAsset(path), 'utf8');
    return `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  await replace(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)>\s*<\/script>/gi, async ([, before, path, after]) => {
    // Rebundle each entry, including shared chunks, into one import-free inline script.
    const bundle = await rolldown({ input: fileURLToPath(localAsset(path)), logLevel: 'silent' });
    const { output } = await bundle.generate({ format: 'iife', minify: true });
    await bundle.close();
    const js = output[0].code;
    new Script(js);
    if (/\bimport\s*\(/.test(js)) throw new Error('Client script is not fully bundled');
    return `<script${before}${after}>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
  });
  source = source.replace(/<link\b[^>]*rel="(?:modulepreload|preload)"[^>]*>/gi, '');
  const decoded = source.replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const cssSources = [...decoded.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(([, css]) => css).concat([...source.matchAll(/\bstyle="([^"]*)"/gi)].map(([, css]) => css.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&'))).join('\n');
  if (/@import\b/i.test(cssSources) || [...cssSources.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(([, , path]) => !path.startsWith('data:'))) throw new Error('Stylesheet has a non-inline asset');
  for (const [tag] of decoded.matchAll(/<(?:img|script|link|iframe|video|audio|source)\b[^>]*>/gi)) {
    for (const [, path] of tag.matchAll(/\b(?:src|href|poster)="([^"]+)"/gi)) if (!path.startsWith('data:')) throw new Error('Gallery has a non-inline media asset');
    if (/\bsrcset=/i.test(tag)) throw new Error('Gallery media must use inline sources');
  }
  return withTooltips(source);
}
// The frame controller owns the three enhancements after cloning its templates.
// Remove component entry tags here so inserting a template never boots a second copy.
const sampleSource = (await readFile(new URL('./dist/lab/index.html', import.meta.url), 'utf8'))
  .replace(/<script\b[^>]*src="[^"]*\/(?:Header|Footer|ReadingArea|ConsentBanner)\.astro_[^"]*"[^>]*>\s*<\/script>/gi, '');
const sample = await inline(sampleSource);
let html = await inline(await readFile(output, 'utf8'));
// A JSON string survives both the HTML parser and a sandbox with an opaque origin.
html = html.replace(/(<script\b[^>]*id="g-lab-document"[^>]*>)[\s\S]*?(<\/script>)/, (_, start, end) => `${start}${JSON.stringify(sample).replace(/</g, '\\u003c')}${end}`);
await writeFile(output, html);
process.stdout.write('Self-contained gallery written to gallery/dist/index.html\n');
