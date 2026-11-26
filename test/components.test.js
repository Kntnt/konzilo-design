import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse, walk, lexer, generate } from 'css-tree';
import { derive, defaultInputs } from '../src/generator/index.js';
import { kindsFor } from '../src/generator/surface.js';
import { coreCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { icons } from '../src/components/icons.js';
import { followingMenuLoader } from '../src/components/table-of-contents.js';
import { PHYSICAL } from './helpers/logical.js';

const directory = new URL('../src/components/', import.meta.url);
const colorFunctions = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)$/i;

test('component CSS uses only logical properties, role reads and permitted drawing units', async () => {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.css'));
  const css = await Promise.all(files.map((name) => readFile(new URL(name, directory), 'utf8')));
  const withRoles = { ...defaultInputs(), typefaces: { main: 'Mona Sans', monospace: 'Mona Sans Mono' } };
  const axes = { axes: { wdth: 100, opsz: 20 } };
  withRoles.type = { ...withRoles.type, roles: { main: axes, heading: axes, 'heading-1': axes, display: axes, label: axes, monospace: axes } };
  // The quiet edge adds --kn-frame-ring, a filled button's ring, which the core emits only with it.
  const quiet = { ...defaultInputs(), frame: { width: 1, color: 'border' } };
  const emitted = new Set([defaultInputs(), withRoles, quiet].flatMap((inputs) => [...coreCss(derive(inputs)).matchAll(/(--kn-[\w-]+)\s*:/g)].map(([, name]) => name)));
  const shared = new Set(css.flatMap((source) => [...source.matchAll(/(--kn-[\w-]+)\s*:/g)].map(([, name]) => name)));
  for (const [i, source] of css.entries()) {
    const name = files[i];
    const ast = parse(source, { parseCustomProperty: true });
    const local = new Set();
    walk(ast, { visit: 'Declaration', enter(node) { if (node.property.startsWith('--kn-')) local.add(node.property); } });
    assert.doesNotMatch(source, /--kn-space-[1-8]\b/, name);
    // Style queries only where something reads a switch no selector can: the Reading Area's columns, which the core
    // sets by a media query, and the page frame's scroll flags and edges (header.md and footer.md, How it is built).
    // A plate's roles never depend on one (plates.md, point 7). A card's rise under the pointer reads whether the design
    // casts a box shadow (components.md, The owner's review of a site built with the components, 2026-11-12), and the tabs
    // read where the design puts their line, which the core writes, since a site writes the tabs' HTML (the same day).
    // Bands read whether the design parts two on one background with a hairline, for the same reason (2026-11-25), and
    // sections the side the design gives their pictures (issue #37, the same day).
    const sides = ['@container style(--kn-section-picture-side: alternate) or style(--kn-section-picture-side: corners) or style(--kn-section-picture-side: corners-bleed)', '@container style(--kn-section-picture-side: corners) or style(--kn-section-picture-side: corners-bleed)', '@container style(--kn-section-picture-side: corners-bleed)'];
    if (!['header.css', 'page.css'].includes(name)) assert.doesNotMatch(sides.reduce((text, query) => text.replaceAll(query, ''), source.replace('@container style(--kn-reading-columns: 2)', '').replaceAll('@container not style(--kn-shadow-box: none)', '').replaceAll('@container style(--kn-tabs-rule-place: above)', '').replace('@container style(--kn-page-band-line: true)', '')), /\b(?:if|style)\(/, name);
    for (const [, role] of source.matchAll(/var\(\s*(--kn-[\w-]+)/g)) assert.ok(emitted.has(role) || shared.has(role) || local.has(role), `${name}: unknown role ${role}`);
    walk(ast, { visit: 'Declaration', enter(declaration) {
      assert.ok(!PHYSICAL.test(declaration.property), `${name}: physical property ${declaration.property}`);
      if (declaration.property === 'line-height') assert.doesNotMatch(generate(declaration.value), /\d(?:px|rem|em|%)/, name);
      walk(declaration.value, (node) => {
        assert.notEqual(node.type, 'Hash', `${name}: literal colour`);
        if (node.type === 'Function') assert.ok(!colorFunctions.test(node.name), `${name}: literal colour function ${node.name}`);
        if (node.type === 'Identifier' && !['currentcolor', 'transparent'].includes(node.name.toLowerCase())) {
          assert.ok(!lexer.matchType('color', node).matched, `${name}: literal colour ${node.name}`);
        }
        if (node.type === 'Dimension' && node.unit === 'px') {
          assert.ok(['1', '2'].includes(node.value), `${name}: non-drawing pixel length`);
          assert.match(declaration.property, /^(?:border|outline|box-shadow|text-decoration-thickness)/, `${name}: pixels outside a drawn line`);
        }
      });
    } });
    if (name !== 'index.css') assert.match(source, new RegExp(`@layer ${name === 'base.css' ? 'kn-base' : 'kn-components'}\\s*\\{`), name);
  }
});

// The tool, the presentation and the gallery show the components as a site would, so they read the space roles too: the
// numbered steps are the core's own, not something to read (names.md, decision 22).
test('the tool, the presentation and the gallery read the space roles, never a numbered step', async () => {
  const root = new URL('../', import.meta.url);
  const files = (await Promise.all(['tool/', 'presentation/src/', 'gallery/src/'].map(async (folder) => (await readdir(new URL(folder, root), { recursive: true }))
    .filter((name) => /\.(?:css|astro|js|mjs|ts)$/.test(name)).map((name) => `${folder}${name}`)))).flat();
  assert.ok(files.includes('tool/style.css') && files.includes('gallery/src/gallery.css'), 'the folders are read');
  for (const file of files) assert.doesNotMatch(await readFile(new URL(file, root), 'utf8'), /--kn-space-[1-8]\b/, file);
});

test('the plain HTML stylesheet flattens the component entry point and preserves layer order', async () => {
  const css = await componentsCss();
  assert.doesNotMatch(css, /@import/);
  assert.match(css, /^@layer kn-core, kn-base, kn-components;/);
  for (const component of ['body-text', 'heading-group', 'icon', 'button', 'link-group', 'card', 'card-grid', 'page', 'band', 'reading-area', 'aside-block', 'sidenote', 'figure', 'hero', 'text-image', 'cta-band', 'key-figures', 'header', 'footer', 'footer-band', 'footer-cell', 'table', 'accordion', 'quotation', 'callout', 'breadcrumbs', 'toc', 'content-loop', 'content-card', 'content-row', 'search-box', 'switch', 'visitor-filters', 'pagination', 'video', 'embed', 'form', 'consent']) assert.ok(css.includes(`.kn-${component}`));
  assert.equal(execFileSync(process.execPath, [new URL('../bin/konzilo-design.js', import.meta.url).pathname, 'components-css'], { encoding: 'utf8' }), css);
});

test('every component has a typed wrapper; only the declared client entries, the footer\'s fit and the header\'s, footer\'s and following menu\'s polyfill loaders', async () => {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.astro'));
  for (const name of names) {
    const source = await readFile(new URL(name, directory), 'utf8');
    assert.match(source, /interface Props/);
    assert.doesNotMatch(source, /import\s+['"][^'"]+\.css|client:/);
    const entry = { 'ContentLoop.astro': 'embed', 'Embed.astro': 'embed', 'ConsentBanner.astro': 'consent' }[name];
    if (entry) assert.match(source, new RegExp(`<script>[\\s\\S]*${entry}\\.js`));
    else if (name === 'Footer.astro') {
      // Only at the edge of the screen: the scroll timelines' polyfill's loader, testing for its feature before it
      // fetches, as the header's does (since 0.6.0, for the page's shadow over it), and one script fetched as a file of
      // its own.
      assert.deepEqual([...source.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag), ['<script is:inline data-kn-polyfill="scroll-timeline" define:vars={{ src: scrollTimelinePolyfill }}>', '<script is:inline type="module" src={footerFit} data-kn-footer-fit>']);
      assert.match(source, /<script is:inline data-kn-polyfill="scroll-timeline"[^>]*>if \(!CSS\.supports\('animation-timeline: scroll\(\)'\)\) import\(src\);<\/script>/);
      assert.equal([...source.matchAll(/\{attachment === 'reveal' && <script /g)].length, 2);
    }
    else if (name === 'Header.astro') {
      // The giving-way script, inline, and two loaders, each testing for its feature before it fetches: the scroll
      // timelines' also for style queries that follow them, as the polyfill tests it, word for word.
      assert.match(source, /<script is:inline data-kn-header-fit set:html=\{headerFitScript\}><\/script>/);
      assert.match(source, /import headerFit from '\.\/header-fit\.js\?raw';/);
      const loaders = [...source.matchAll(/<script\b([^>]*data-kn-polyfill[^>]*)>([^<]*)<\/script>/g)];
      assert.deepEqual(loaders.map(([, attributes]) => attributes.match(/data-kn-polyfill="([^"]+)"/)[1]), ['scroll-timeline', 'scroll-state']);
      for (const [, attributes] of loaders) assert.match(attributes, /\bis:inline\b/);
      const follows = (await readFile(new URL('scroll-timeline-polyfill.js', directory), 'utf8')).match(/^const follows = .*$/m)[0];
      assert.equal(loaders[0][2], `${follows}\nif (!CSS.supports('animation-timeline: scroll()') || !follows()) import(src);`);
      assert.match(loaders[1][2], /^if \(!CSS\.supports\('container-type: scroll-state'\)\) import\(src\);$/);
    } else if (name === 'TableOfContents.astro') {
      // A following menu ends with the scroll markers' polyfill's loader, which the directive's and the article's
      // components write too (directives.md, `toc`): one text, written as Astro writes the header's, testing for its
      // feature before it fetches, so the core's policy needs one hash for it and the offline copies find its address.
      assert.doesNotMatch(source, /<script/);
      assert.match(source, /<TableOfContentsList entries=\{entries\} \/>\{follows && <Fragment set:html=\{scrollMarkersLoader\} \/>\}\n<\/nav>\}/);
      assert.match(source, /^import \{ scrollMarkersLoader \} from '\.\/scroll-markers-loader\.js';$/m);
      assert.equal(followingMenuLoader('/_astro/scroll-markers-polyfill.js'), `<script data-kn-polyfill="scroll-markers">(function(){const src = "/_astro/scroll-markers-polyfill.js";\nif (!CSS.supports('scroll-target-group: auto')) import(src);})();</script>`);
    } else if (name === 'Accordion.astro') {
      assert.equal([...source.matchAll(/<script/g)].length, 1);
      assert.match(source, /<script type="application\/ld\+json" is:inline set:html=/);
    } else assert.doesNotMatch(source, /<script/);
    assert.doesNotMatch(source, /<h[1-6]\b/);
  }
  // One module writes the following menu's loader with the polyfill's address, and every component that draws a following
  // menu, the gallery's too, takes it from there, so none can write another text.
  const root = new URL('../', import.meta.url);
  const sources = (await Promise.all(['src/', 'gallery/src/'].map(async (folder) => (await readdir(new URL(folder, root), { recursive: true }))
    .filter((file) => /\.(?:astro|js|mjs|ts)$/.test(file)).map((file) => `${folder}${file}`)))).flat();
  const writers = [], addresses = [];
  for (const file of sources) {
    const text = await readFile(new URL(file, root), 'utf8');
    if (/(?<!function )followingMenuLoader\(\w/.test(text)) writers.push(file);
    if (/^import \w+ from '[^']*scroll-markers-polyfill\.js\?url/m.test(text)) addresses.push(file);
  }
  assert.deepEqual(writers, ['src/components/scroll-markers-loader.js']);
  assert.deepEqual(addresses, ['src/components/scroll-markers-loader.js']);
  assert.match(await readFile(new URL('scroll-markers-loader.js', directory), 'utf8'), /^export const scrollMarkersLoader = followingMenuLoader\(scrollMarkersPolyfill\);$/m);
  assert.equal(Object.keys(icons).length, 30);
  for (const markup of Object.values(icons)) assert.doesNotMatch(markup, /<svg|<script|\bhref=/);
  assert.match(await readFile(new URL('LICENSE-lucide.txt', directory), 'utf8'), /ISC License/);
  assert.match(await readFile(new URL('LICENSE-tabler.txt', directory), 'utf8'), /MIT License/);
});

// Every Surface kind a band may take, and none, meets its own kind by the rule (band-space.test.js measures it).
test('bands share one band\'s space on each supported identical Surface, and the hairline parts each', async () => {
  const source = await readFile(new URL('band.css', directory), 'utf8');
  const [plain, parted] = source.split('@container style(--kn-page-band-line: true)');
  assert.ok(parted, 'the hairline reads the design\'s choice');
  // Every kind the generator makes, with all three brand colours, and none.
  const kinds = [undefined, ...kindsFor({ secondary: true, tertiary: true })];
  // band.css writes the kinds out in six lists, one selector per line: the plain rules and each :is(). Each list holds
  // every kind once and no other, the same kind on both bands of a line, so a new kind fails here until every list has it.
  const lists = source.split('\n').reduce((found, line, at, all) => {
    const named = [...line.matchAll(/(\.kn-(?:band|hero))(?:\[data-kn-surface="([\w-]+)"\]|:not\(\[data-kn-surface\]\))/g)];
    if (!named.length) return found;
    if (!all[at - 1]?.match(/data-kn-surface/)) found.push([]);
    found.at(-1).push(named.map(([, , kind]) => kind));
    return found;
  }, []);
  assert.equal(lists.length, 6, 'six lists of kinds');
  for (const [at, list] of lists.entries()) {
    for (const line of list) assert.equal(new Set(line).size, 1, `list ${at + 1}: one kind on both bands, ${line}`);
    assert.deepEqual(list.map(([kind]) => kind ?? '').sort(), kinds.map((kind) => kind ?? '').sort(), `list ${at + 1} holds every kind once`);
  }
  for (const kind of kinds) {
    const on = (base) => (kind ? `${base}[data-kn-surface="${kind}"]` : `${base}:not([data-kn-surface])`);
    assert.ok(plain.includes(`${on('.kn-band')}:has(+ ${on('.kn-band')}) { padding-block-end: 0; }`), kind);
    assert.ok(plain.includes(`${on('.kn-hero')} + ${on('.kn-band')},`) || plain.includes(`${on('.kn-hero')} + ${on('.kn-band')}\n`), kind);
    assert.ok(parted.includes(`${on('.kn-band')}:has(+ ${on('.kn-band')})`), kind);
    assert.ok(parted.includes(`${on('.kn-band')} + ${on('.kn-band')}`), kind);
  }
  assert.doesNotMatch(source, /band-run/);
});

test('Body Text leaves headings with an explicit visual type alone', async () => {
  const css = await readFile(new URL('../src/components/body-text.css', import.meta.url), 'utf8');
  for (const level of [1, 2, 3, 4, 5, 6]) assert.ok(css.includes(`.kn-body-text h${level}:not([data-kn-type])`), `h${level}`);
});

test('the browser-drawn parts of form controls stay light on every Surface, and only the parts', async () => {
  const css = await readFile(new URL('../src/components/form.css', import.meta.url), 'utf8');
  assert.match(css, /\.kn-field-option input, \.kn-field-control\[type="number"\]::-webkit-inner-spin-button \{ color-scheme: light; \}/);
  assert.doesNotMatch(css, /\.kn-field-control(?:\[type="number"\])?(?:,[^{]*)? \{[^}]*color-scheme/);
});

