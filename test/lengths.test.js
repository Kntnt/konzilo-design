// Every length is in rem, with px only where truly necessary: docs/spec/tool.md, point 3.
// This reads every stylesheet, <style> block, inline style and script in the repository, and the CSS
// the generator emits, and fails on a px length that the two lists below do not allow. A number shown
// to people, such as "17 px", has a space and is a word, not CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, walk } from 'css-tree';
import { emitCss } from '../src/css/index.js';
import { designMd } from '../src/design-md/index.js';

const repo = fileURLToPath(new URL('..', import.meta.url));

// What is drawn rather than read, wherever it stands.
const DRAWN = [
  { property: /^border(-(block|inline|top|right|bottom|left)(-(start|end))?)?(-width)?$/, most: 3, reason: 'the thickness of a hairline, border or frame' },
  { property: /^outline(-width|-offset)?$/, reason: 'a focus ring and its offset' },
  { property: /^text-decoration-thickness$/, reason: 'the thickness of a line under text' },
  { property: /^box-shadow$/, reason: 'a shadow' },
  { property: /^--kn-(frame-width|shadow-[a-z0-9-]+)$/, reason: 'the frame and the shadows, as the generated CSS holds them' },
];

const HAIRLINE = 'a hairline drawn as a box instead of a border';
const WINDOW = 'a preview frame that simulates a real window width';
const MEASURED = 'geometry measured at runtime and written back';
// Each other place: the file, then `selector { property: value }` in CSS or a piece of the line in a script.
const PLACES = [
  ['tool/style.css', '.slider-track { height: 1px }', HAIRLINE],
  ['tool/style.css', '.line-track { height: 1.5px }', HAIRLINE],
  ['tool/style.css', '.line-track i { width: 1px }', HAIRLINE],
  ['tool/style.css', '.line-arrow[data-kind="view"]::before { width: 1px }', HAIRLINE],
  ['tool/style.css', '#optimal-line { width: 1px }', HAIRLINE],
  ['tool/style.css', '#tool { grid-template-columns: 9px }', 'the divider, which tool/logic.js reckons with in pixels'],
  ['tool/style.css', '#optimal-line { margin-inline-start: 4px }', 'centres a hairline in the divider, which is in pixels'],
  ['tool/style.css', '[data-page="corners"] .sample-cards { padding-block-end: 6px }', 'twice the thickest frame, which is in pixels'],
  ['tool/style.css', '.end[data-end="narrow"] { flex: 390px }', WINDOW],
  ['tool/style.css', '.end[data-end="wide"] { max-width: 1440px }', WINDOW],
  ['tool/style.css', '#preview-pane[data-stacked] .end[data-end="narrow"] { max-width: 390px }', WINDOW],
  ['tool/style.css', '#preview-narrow { width: 390px }', WINDOW],
  ['tool/preview.js', 'frame.style.width =', WINDOW],
  ['tool/preview.js', "querySelector('.frame-host').style.width", WINDOW],
  ['tool/preview.js', "'--desktop-width'", WINDOW],
  ['presentation/src/reader.js', 'frame.style.width =', WINDOW],
  ['gallery/src/lab.js', 'frame.style.inlineSize =', WINDOW],
  ['tool/preview.js', 'frame.style.height =', MEASURED],
  ['presentation/src/reader.js', 'frame.style.height =', MEASURED],
  ['tool/app.js', "'--controls-width'", MEASURED],
  ['tool/app.js', 'optimalLine.style.insetInlineStart =', MEASURED],
  ['tool/app.js', 'widthReadout.style.insetInlineStart =', MEASURED],
  ['tool/app.js', 'arrow.style.left =', MEASURED],
  ['tool/app.js', 'left.style.left =', MEASURED],
  ['tool/app.js', 'right.style.left =', MEASURED],
  ['tool/app.js', 'view.style.left =', MEASURED],
  ['src/css/index.js', "put('frame-width'", 'writes the frame, 0-3px'],
  ['src/generator/shadow.js', '`${r}px`', 'writes a shadow'],
  ['presentation/src/samples.js', '<svg xmlns=', 'the own size of a picture file, not a length on a page'],
];

const used = new Set();
const allowedAnywhere = (property, value) => DRAWN.find((rule) => rule.property.test(property) && Math.abs(value) <= (rule.most ?? Infinity));
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const placeOf = (file, match) => PLACES.find((place) => place[0] === file && match(place[1]));

function scanCss(file, css, firstLine = 1) {
  const found = [];
  const selectors = [];
  const errors = [];
  const ast = parse(css, {
    positions: true, parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false, parseCustomProperty: false,
    onParseError: (error) => errors.push(error.message),
  });
  assert.deepEqual(errors, [], `${file} parses`);
  const report = (node, token, what) => found.push(`${file}:${firstLine + node.loc.start.line - 1} ${what}`);
  walk(ast, {
    enter(node) {
      if (node.type === 'Rule') selectors.push(node.prelude.value.replace(/\s+/g, ' ').trim());
      if (node.type === 'Atrule' && node.prelude) {
        for (const [token] of node.prelude.value.matchAll(/-?\d*\.?\d+px\b/g)) report(node, token, `@${node.name} ${node.prelude.value}`);
      }
      if (node.type === 'Declaration') {
        for (const [token, amount] of node.value.value.matchAll(/(-?\d*\.?\d+)px\b/g)) {
          if (allowedAnywhere(node.property, Number(amount))) continue;
          const selector = selectors.at(-1) ?? '';
          const place = placeOf(file, (where) => selector.split(', ').some((one) => where === `${one} { ${node.property}: ${token} }`));
          if (place) used.add(place);
          else report(node, token, `${selector} { ${node.property}: ${node.value.value} }`);
        }
      }
    },
    leave(node) {
      if (node.type === 'Rule') selectors.pop();
    },
  });
  return found;
}

function scanScript(file, source) {
  const found = [];
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/(?<![:'"`])\/\/.*$/gm, '');
  code.split('\n').forEach((line, index) => {
    const lengths = [...line.matchAll(/(-?\d*\.?\d+)px\b|\}px\b|['"`]px['"`]/g)];
    const sized = [...line.matchAll(/<(?:svg|iframe)\b[^>]*\s(?:width|height)="[\d.]+"/g)];
    for (const hit of [...lengths, ...sized]) {
      const property = line.slice(0, hit.index).match(/([a-zA-Z-]+)\s*:\s*[^:;{}"'`]*$/)?.[1];
      if (hit[1] !== undefined && property && allowedAnywhere(kebab(property), Number(hit[1]))) continue;
      const place = placeOf(file, (where) => line.includes(where));
      if (place) used.add(place);
      else found.push(`${file}:${index + 1} ${line.trim().slice(0, 160)}`);
    }
  });
  return found;
}

// A markup file's <style> blocks are CSS, and the rest of it reads like a script.
function scanMarkup(file, source) {
  const found = [];
  const styles = /<style\b[^>]*?(?<!\/)>([\s\S]*?)<\/style>/gi;
  for (const match of source.matchAll(styles)) {
    const css = match[1];
    const before = source.slice(0, match.index + match[0].indexOf(css));
    found.push(...scanCss(file, css, before.split('\n').length));
  }
  found.push(...scanScript(file, source.replace(styles, (block) => block.replace(/[^\n]/g, ' '))));
  return found;
}

const SCANNED = { '.css': scanCss, '.astro': scanMarkup, '.html': scanMarkup, '.js': scanScript, '.mjs': scanScript, '.ts': scanScript };
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') || ['node_modules', 'dist', 'release-assets', 'docs'].includes(entry.name) ? [] : filesIn(path);
    return SCANNED[extname(entry.name)] ? [relative(repo, path)] : [];
  });
}
// The tests themselves read computed pixels back from a browser, so of test/ only stylesheets count.
const sources = filesIn(repo).filter((file) => !file.startsWith('test/') || extname(file) === '.css');

test('every length in the repository is in rem, apart from what the lists allow, and the lists hold nothing stale', async () => {
  assert.ok(sources.includes('tool/style.css') && sources.includes('presentation/src/document.css') && sources.includes('gallery/src/gallery.css') && sources.includes('src/components/header.css'));
  assert.ok(sources.includes('tool/app.js') && sources.includes('tool/pages.js') && sources.includes('presentation/src/chapters/Typography.astro') && sources.includes('gallery/src/pages/lab.astro'));
  const found = sources.flatMap((file) => SCANNED[extname(file)](file, readFileSync(join(repo, file), 'utf8')));
  const file = JSON.parse(readFileSync(join(repo, 'examples/example.design.json'), 'utf8'));
  found.push(...scanCss('generated CSS', await emitCss(file)));
  assert.deepEqual(found, [], 'Write these in rem, or add them to the lists with the reason. See docs/spec/tool.md, point 3.');
  assert.deepEqual(PLACES.filter((place) => !used.has(place)), [], 'An exception nothing needs any more');
});

test('the root gets no font size, so the browser\'s text size setting holds', () => {
  for (const file of sources.filter((name) => extname(name) === '.css')) {
    walk(parse(readFileSync(join(repo, file), 'utf8'), { parseValue: false, parseRulePrelude: false, parseAtrulePrelude: false, parseCustomProperty: false }), (node) => {
      if (node.type !== 'Rule' || !/(^|,\s*)(html|:root)\s*(,|$)/.test(node.prelude.value)) return;
      for (const declaration of node.block.children) assert.ok(!['font', 'font-size'].includes(declaration.property), `${file}: ${node.prelude.value}`);
    });
  }
});

test('DESIGN.md gives its dimension tokens in rem, which the format accepts', () => {
  const file = JSON.parse(readFileSync(join(repo, 'examples/example.design.json'), 'utf8'));
  const [, front] = designMd(file, 'example.design.json').match(/^---\n([\s\S]*?)\n---\n/);
  assert.doesNotMatch(front, /\dpx\b/);
  assert.match(front, /^ {2}control: "[\d.]+rem"$/m);
  assert.match(front, /^ {2}content-wide: "[\d.]+rem"$/m);
});

test('the scan itself catches what it is for', () => {
  const css = (text) => scanCss('sample.css', text).length;
  assert.equal(css('.a { gap: 3px; }'), 1);
  assert.equal(css('.a { width: 1px; }'), 1);
  assert.equal(css('.a { width: var(--w, 540px); }'), 1);
  assert.equal(css('.a { border-block: 4px solid transparent; }'), 1, 'too thick to be a line');
  assert.equal(css('@media (max-width: 960px) { .a { color: red; } }'), 1);
  assert.equal(css('@container (width < 600px) { .a { color: red; } }'), 1);
  assert.equal(css('@layer x { .a { font-size: 12px; } }'), 1);
  assert.equal(css('.a { border: 1px solid; outline: 2px solid; outline-offset: -3px; box-shadow: 0 8px 24px -8px red; text-decoration-thickness: 2px; gap: 0.25rem; }'), 0);
  const script = (text) => scanScript('sample.js', text).length;
  assert.equal(script('node.style.fontSize = `${size}px`;'), 1);
  assert.equal(script("node.style.width = size + 'px';"), 1);
  assert.equal(script('const html = `<i style="height: 12px"></i>`;'), 1);
  assert.equal(script('const html = `<i style={{ width: `${value}px` }}></i>`;'), 1);
  assert.equal(script('const html = `<svg width="14" viewBox="0 0 14 14"></svg>`;'), 1);
  assert.equal(script('const html = `<i style="box-shadow: inset 0 0 0 1px red; border: 1px solid"></i>`;'), 0);
  assert.equal(script('const words = `${value} px`, text = "17 px wide"; // 12px in a comment'), 0);
  assert.equal(script('/* 12px in a comment */ const icon = `<svg width="1em" height="0.875rem"></svg>`;'), 0);
  assert.equal(scanMarkup('sample.astro', '<style is:inline>\n.a { gap: 3px; }\n</style>\n<i style="padding: 2px"></i>').length, 2);
  assert.match(scanMarkup('sample.astro', '<p></p>\n<style>\n.a {\n  gap: 3px;\n}\n</style>')[0], /^sample\.astro:4 /);
});
