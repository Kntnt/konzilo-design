// DESIGN.md is for an agent with nothing but that file, building with any technique (docs/spec/tool.md, point 4).
// These hold that it carries what such an agent cannot build without, for any design, not only one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { derive } from '../src/generator/index.js';
import { withDefaults, SYSTEM_SANS } from '../src/generator/defaults.js';
import { GIVING_WAY_ORDER, arrangementGroups } from '../src/components/header.js';
import { COMPONENT_GROUPS, NOT_COMPONENTS } from '../src/design-md/components.js';
import { designMd } from '../src/design-md/index.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#3a7d5c"/></svg>';
const base64 = (text) => `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;

// A spread of made-up designs: one colour and flat, three colours with shadows and a serif, and a system typeface
// with one breakpoint and a hard shadow in a chosen colour.
const DESIGNS = [
  { 'brand-colors': { primary: '#3a7d5c' } },
  { 'brand-colors': { primary: '#8a3ffc', secondary: '#d4622b', tertiary: '#2b8ad4' }, shadow: { strength: 60, hardness: 20, angle: 0, elevation: 50, color: 'default', targets: { box: true, header: true, panel: true, page: true } }, typefaces: { main: 'Source Serif 4', heading: 'Inter' }, header: { arrangement: 'B', language: true }, hero: { picture: 'end-bleed', surface: 'tint', overlay: 'light' } },
  { 'brand-colors': { primary: '#b8860b' }, typefaces: { main: SYSTEM_SANS }, type: { breakpoints: { min: 800, max: 800 } }, shadow: { strength: 40, hardness: 100, angle: 20, elevation: 60, color: 'black', targets: { box: true, header: false, panel: true, page: true } }, header: { arrangement: 'A', 'link-menu': false } },
];
const exported = (inputs, project = { name: 'Example' }) => {
  const resolved = derive(inputs);
  const text = designMd({ inputs: withDefaults(inputs), project, resolved }, 'example.design.json');
  const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return { resolved, text, front, body };
};
const rem = (px) => `${Number((px / 16).toFixed(4))}rem`;

test('DESIGN.md names no stylesheet of the library\'s as if it came with the file', () => {
  for (const inputs of DESIGNS) {
    const { text } = exported(inputs);
    assert.doesNotMatch(text, /--kn-|data-kn-|\bkn-[a-z]/, 'an agent has no stylesheet that defines these');
    assert.doesNotMatch(text, /undefined|NaN|\[object|\bno an?\b/);
    assert.match(text, /No stylesheet, script, picture or font comes with it/);
  }
});

test('DESIGN.md carries the name, the slogan and the logo, or says plainly that it does not', () => {
  const inputs = DESIGNS[0];
  const { body } = exported(inputs, { name: 'Example', slogan: 'Made to last', logo: base64(SVG), 'logo-dark': `data:image/svg+xml,${encodeURIComponent(SVG.replace('#3a7d5c', '#e8f5ee'))}` });
  assert.match(body, /\*\*Name:\*\* "Example"/);
  assert.match(body, /\*\*Slogan:\*\* "Made to last"/);
  assert.ok(body.includes(`\`\`\`svg\n${SVG}\n\`\`\``), 'the logo itself, as text an agent can save');
  assert.ok(body.includes('fill="#e8f5ee"'), 'the dark logo, from a URL-encoded data URI');
  assert.match(body, /Use the dark logo where the background is dark: on [^\n]*`brand`/);
  const png = exported(inputs, { name: 'Example', logo: 'data:image/png;base64,iVBORw0KGgo=' }).body;
  assert.match(png, /\*\*Logo:\*\* a PNG image[^\n]*not carried here[^\n]*never draw a logo of your own/);
  assert.doesNotMatch(png, /iVBORw0KGgo/);
  assert.match(exported(inputs, { name: 'Example', logo: 'logos/mark.svg' }).body, /\*\*Logo:\*\* the file `logos\/mark\.svg`, beside the design file/);
  const huge = exported(inputs, { name: 'Example', logo: base64(SVG.replace('</svg>', `${'<path d="M0 0"/>'.repeat(3000)}</svg>`)) }).body;
  assert.match(huge, /too large to carry here/);
  const none = exported(inputs, { name: 'Example' }).body;
  assert.match(none, /\*\*Logo:\*\* none\. The brand is the name alone\./);
  assert.match(none, /\*\*Slogan:\*\* none\./);
});

test('DESIGN.md gives every Surface in both modes, with the picture Surfaces\' overlay and the status Surfaces', () => {
  for (const inputs of DESIGNS) {
    const { resolved: r, front, body } = exported(inputs);
    for (const kind of Object.keys(r.surfaces)) {
      for (const [prefix, mode] of [['', 'light'], ['dark-', 'dark']])
        assert.match(front, new RegExp(`^  ${prefix}${kind}-text: "${r.surfaces[kind][mode].roles.text}"$`, 'm'), `${prefix}${kind}`);
      assert.match(body, new RegExp(`^- \\*\\*${kind}:\\*\\* `, 'm'), `${kind} has a job`);
    }
    for (const kind of ['picture-light', 'picture-dark', 'status-info', 'status-success', 'status-warning', 'status-error']) assert.ok(r.surfaces[kind], kind);
    const { color, opacity } = r.surfaces['picture-dark'].light.scrim;
    assert.match(front, new RegExp(`^  picture-dark-scrim: "rgb\\([\\d ]+ / ${opacity}\\)"$`, 'm'));
    assert.ok(body.includes(`${color} at ${opacity} opacity`), 'the hero\'s overlay, in colour and strength');
    assert.ok(body.includes('`clamp(6rem, 24svh, 16rem)`'), 'how far the overlay fades');
  }
});

test('DESIGN.md describes every header arrangement, the chosen one, and the order in which items give way', () => {
  for (const inputs of DESIGNS) {
    const { resolved: r, body } = exported(inputs);
    for (const name of ['A', 'B', 'C']) {
      const [start, end] = arrangementGroups(name, { links: true, search: true, language: true, menu: true, cta: true });
      assert.match(body, new RegExp(`^- \\*\\*${name}:\\*\\* start: [^\\n]*; end: `, 'm'));
      assert.equal(body.match(new RegExp(`^- \\*\\*${name}:\\*\\* start: ([^;]*);`, 'm'))[1].split(', ').length, start.length);
      assert.equal(body.match(new RegExp(`^- \\*\\*${name}:\\*\\* start: [^;]*; end: ([^.]*)\\.`, 'm'))[1].split(', ').length, end.length);
    }
    assert.match(body, new RegExp(`\\*\\*Header:\\*\\* arrangement ${r.header.arrangement},[^\\n]*So the bar reads, start: identity`));
    const steps = [...body.matchAll(/^(\d)\. (.+)$/gm)].map(([, n]) => Number(n));
    assert.deepEqual(steps, GIVING_WAY_ORDER.map((_, i) => i + 1));
    assert.match(body, /^1\. the slogan goes$/m);
    assert.match(body, /^7\. the search icon moves into the megamenu/m);
    for (const words of ['always a globe icon', 'at least 4rem high, with 0.75rem', 'The logo is 2.25rem tall', '2.5rem square', 'a 1 px inset ring in `border`', 'only once page content has scrolled under it'])
      assert.ok(body.includes(words), words);
  }
});

test('DESIGN.md maps each shadow to its use, with its dark-mode value and the Surfaces that keep the dark one', () => {
  const [flat, soft, hard] = DESIGNS.map((inputs) => exported(inputs));
  assert.match(flat.body, /This design has no shadows/);
  const { resolved: r, body } = soft;
  for (const [level, value] of Object.entries(r.surfaces.page.light.shadow)) {
    assert.ok(body.includes(`- **${level}**, `), level);
    assert.ok(body.includes(`\`${value}\`; in dark mode \`${r.surfaces.page.dark.shadow[level]}\``), `${level} in both modes`);
  }
  assert.match(body, /\*\*header\*\*, the header, once page content has scrolled under it/);
  assert.match(body, /\*\*box-lifted\*\*, a linked card on a Surface, while hovered or focused/);
  assert.match(body, /also hold in light mode on `brand`, `inverse`, `accent`/);
  assert.match(hard.body, /The values are the same in both modes and on every Surface/, 'a chosen shadow colour holds everywhere');
  assert.match(hard.body, /\*\*header\*\*, [^\n]*: none\./, 'a target that casts no shadow says so');
});

test('DESIGN.md gives type steps, sizes as CSS, the windows features switch on in, and where to get each typeface', () => {
  for (const inputs of DESIGNS) {
    const { resolved: r, body } = exported(inputs);
    for (const [name, style] of [['display', 'display'], ['h1', 'heading-1'], ['h6', 'heading-6'], ['body', 'body'], ['small', 'small'], ['label', 'label']]) {
      const recipe = r.type[style];
      const size = recipe.size.min === recipe.size.max ? rem(recipe.size.max) : recipe.size.css;
      assert.match(body, new RegExp(`^\\| ${name} \\| [^|]+ \\| ${recipe.step} \\| \`${size.replace(/[()+.]/g, '\\$&')}\` \\|`, 'm'), name);
    }
    for (const recipe of Object.values(r.type).filter(({ features }) => features?.['from-window'] > 0))
      assert.ok(body.includes(`\`@media (min-width: ${rem(recipe.features['from-window'])})\``));
    assert.ok(body.includes(`The emphasis weight** is ${r.type['heading-6'].weight}`));
    const { min, max } = r['type-scale'].breakpoints;
    if (min !== max) assert.ok(body.includes(`pow(var(--base), STEP)`) && body.includes(`in a ${rem(min)} (${min} px) window`));
    assert.doesNotMatch(body, /- \*\*[^*]+\*\*, version [^\n]*: free to download from undefined/);
  }
  const serif = exported(DESIGNS[1]).body;
  assert.match(serif, /- \*\*Source Serif 4\*\*, version [\d.]+, under the SIL Open Font License 1\.1: free to download and to serve, from [^\n]*https:\/\/github\.com\/\S+[^\n]*\. Use the variable font, declared with `font-weight: [\d ]+`/);
  assert.match(exported(DESIGNS[2]).body, /the system's own typeface, so there is nothing to serve/);
});

test('DESIGN.md gives space, the side margin and where running text stands, as values an agent can use', () => {
  for (const inputs of DESIGNS) {
    const { resolved: r, body } = exported(inputs);
    for (const [role, value] of Object.entries(r.space.roles)) assert.ok(body.includes(`(\`${role}\`): \`${value.css}\``), role);
    assert.ok(body.includes(`**Side margin:** \`${r.layout['side-margin'].css}\``));
    assert.ok(body.includes(`from a 20rem (320 px) window to a 90rem (1440 px) one`));
    assert.match(body, /With nothing beside it, the column is centred in the content area\. With an Aside[^\n]*start edge[^\n]*at the end/);
    assert.ok(body.includes(`The Aside is at least ${rem(r.layout['aside-min'])} wide`));
  }
});

test('DESIGN.md gives the motion and every component\'s look in one place, and the fixed shapes beside the radii', () => {
  for (const inputs of DESIGNS) {
    const { resolved: r, front, body } = exported(inputs);
    assert.ok(body.includes(`take ${r.duration.feedback}ms`) && body.includes(`take ${r.duration.movement}ms`) && body.includes(`\`${r.easing.standard}\``));
    for (const [, items] of COMPONENT_GROUPS)
      for (const [name, job, recipe] of items) {
        assert.ok(body.includes(`\n- **${name}:** ${job}`), `${name} is listed with its job`);
        assert.ok(recipe ? body.includes(`- **${name}:** ${job} ${recipe}\n`) : new RegExp(`- \\*\\*${name}:\\*\\* [^\n]*Its recipe is under [^\n]+ above\\.\n`).test(body), `${name} has its look, or says where it is`);
      }
    for (const heading of ['### Shared rules', '### Header', '### Footer', '### Hero']) assert.ok(body.includes(`\n${heading}\n`), heading);
    assert.match(body, /pills [^\n]*have a radius of 2em, and round controls [^\n]*are circles/);
    assert.doesNotMatch(body, /only two radii/);
    assert.match(front, /^  pill: "2em"$/m);
    assert.match(front, /^  button-primary:\n(?: {4}.+\n)*? {4}typography: "\{typography\.small\}"\n {4}padding: "0\.8em 1\.3em"$/m);
    assert.ok(body.includes(`deliberately has none of these: ${NOT_COMPONENTS.at(0).replace(/^an? /, '')}, `));
  }
  const { body } = exported(DESIGNS[0]);
  for (const words of ['padding 0.8em 1.3em, no border', 'a 1 px inset ring in `border-strong`', 'value in the h1 style in `text`', 'a 0.125rem rule in `accent`', 'the head row\'s line is `border-strong`', 'with `accent-color` set to `accent`', 'Its size is exactly `max(label size, 0.92 × small size)`', 'a 2 px solid outline in `focus`, 2 px outside its edge', 'All of the footer is in the small size', 'parted by a • in `text-muted`'])
    assert.ok(body.includes(words), words);
});

test('DESIGN.md leaves the use of light and dark mode to the builder', () => {
  for (const inputs of DESIGNS) {
    const { body } = exported(inputs);
    assert.match(body, /two equal sets[^\n]*the builder's choice: light only, dark only, or both[^\n]*decides nothing about it/);
    assert.doesNotMatch(body, /prefers-color-scheme|offer a switch/);
  }
});

test('DESIGN.md says whether the design has a frame, and its width and colour where it has', () => {
  const none = exported(DESIGNS[0]);
  assert.match(none.body, /\*\*Frame:\*\* this design has none/);
  assert.doesNotMatch(none.front, /-frame:/);
  const framed = exported({ ...DESIGNS[0], frame: { width: 2, color: 'default' } });
  assert.match(framed.body, /\*\*Frame:\*\* a 2 px solid line, in the `text` colour of the Surface it stands on/);
  for (const [kind, surface] of Object.entries(framed.resolved.surfaces)) {
    assert.match(framed.front, new RegExp(`^  ${kind}-frame: "${surface.light['frame-color']}"$`, 'm'));
    assert.match(framed.front, new RegExp(`^  dark-${kind}-frame: "${surface.dark['frame-color']}"$`, 'm'));
  }
});

test('DESIGN.md gives the status colours of every Surface, and says the component tokens are the page Surface\'s case', () => {
  for (const inputs of DESIGNS) {
    const { resolved: r, front, body } = exported(inputs);
    for (const [kind, surface] of Object.entries(r.surfaces))
      for (const status of ['info', 'success', 'warning', 'error'])
        assert.match(front, new RegExp(`^  ${kind}-${status}: "${surface.light.roles[status]}"$`, 'm'), `${kind}-${status}`);
    assert.match(body, /show the case on the `page` Surface, which is why they point at `page-\*`/);
    assert.doesNotMatch(front.split('\ncomponents:\n')[1], /^ {2}button-outline:\n {4}backgroundColor/m, 'an unfilled button is transparent');
    assert.match(front, /^ {2}card-raised:$/m);
    assert.match(body, /cards in a Card Grid on a plain Band are hairline cards/);
  }
});

test('DESIGN.md writes the overlay\'s fade and ceiling one way only, and the page, footer and trail exactly', () => {
  const { body } = exported(DESIGNS[0]);
  assert.match(body, /going up from the text's top edge it has 84% of its strength a quarter of the way, 50% halfway, 16% at three quarters and nothing at the end/);
  assert.match(body, /wherever text stands the layer has exactly that strength, and nowhere is it stronger/);
  assert.doesNotMatch(body, /darker than that/);
  assert.match(body, /Header, page and footer together fill at least the window's height/);
  assert.match(body, /\*\*Where page and footer meet\.\*\*[^\n]*under either attachment[^\n]*the same as the footer's first band/);
  assert.match(body, /The lower band takes the label size only/);
  assert.match(body, /the trail stands above the eyebrow: from the top always trail, eyebrow, heading, deck, buttons/);
  assert.match(body, /level-2 links [^\n]*in the body style[^\n]*0\.75 times the body size/);
  assert.match(body, /not in every browser \(not in Firefox\); what works everywhere/);
  assert.match(body, /a native popover \(`popovertarget`\), placed absolutely in the top layer by the globe as its anchor/);
  // How to build the header and footer without a script, and where a polyfill may stand in.
  assert.match(body, /let a small script try them one after another in a single task, before the browser paints, so nothing flickers/);
  assert.match(body, /Without the script, show the narrowest step: the identity and the menu button/);
  assert.match(body, /Each loads only where `CSS\.supports` says the feature is missing, the second only for a header that slides away/);
  assert.match(body, /A small script, loaded only by a footer at the edge of the screen, compares the footer's height with the window's/);
  assert.match(exported(DESIGNS[0], { name: 'Example', logo: base64(SVG) }).body, /A logo's own colours are part of the logo, not of the palette/);
});

test('DESIGN.md names each icon a component uses and a direct download for it and for each typeface', async () => {
  const { ICONS } = await import('../src/design-md/components.js');
  const { TYPEFACES } = await import('../src/fonts/catalog.js');
  const { downloadOf } = await import('../src/design-md/index.js');
  const { body } = exported(DESIGNS[0]);
  for (const [name] of [...ICONS.lucide, ...ICONS.tabler]) assert.match(body, new RegExp(`^- \`${name}\`: `, 'm'), name);
  assert.ok(body.includes('https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/<name>.svg'));
  assert.ok(body.includes('https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/<name>.svg'));
  for (const face of TYPEFACES) {
    const where = downloadOf(face, face.licence === 'LICENSE-roboto-slab.txt' ? 'the Apache License 2.0' : 'the SIL Open Font License 1.1');
    assert.doesNotMatch(where, /fonts\.google\.com/, `${face.family} has a file to download, not a specimen page`);
    assert.match(where, /https:\/\/github\.com\//);
  }
  assert.match(exported(DESIGNS[1]).body, /`opsz`, its optical size, which the browser sets from the font size by itself/);
});

// Reads an archive back through its central directory, as any unzip does.
async function unzip(bytes) {
  const { inflateRawSync } = await import('node:zlib');
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const files = new Map();
  let at = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    const size = bytes.readUInt32LE(at + 20), nameLength = bytes.readUInt16LE(at + 28), local = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    files.set(name, inflateRawSync(bytes.subarray(start, start + size)));
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return { files, comment: bytes.subarray(end + 22).toString('utf8') };
}

test('the archive holds DESIGN.md and every file it names, logos, fonts with licences and icons with licences', async () => {
  const { mkdtemp, rm, writeFile: write } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { designBundle } = await import('../src/design-md/bundle.js');
  const { zipFiles } = await import('../tool/archive.js');
  const { ICONS } = await import('../src/design-md/components.js');
  const inputs = { ...DESIGNS[1] };
  const dir = await mkdtemp(join(tmpdir(), 'kn-design-md-'));
  try {
    await write(join(dir, 'mark.svg'), SVG);
    const project = { name: 'Example', logo: base64(SVG), 'logo-dark': 'mark.svg' };
    const design = { inputs: withDefaults(inputs), project, resolved: derive(inputs) };
    const { files, comment } = await unzip(zipFiles(await designBundle(design, join(dir, 'example.design.json'), 'example.design.json'), { comment: 'mark' }));
    assert.equal(comment, 'mark');
    const text = files.get('DESIGN.md').toString('utf8');
    assert.equal(files.get('logos/logo.svg').toString('utf8'), SVG, 'an embedded logo, as a file');
    assert.equal(files.get('logos/logo-dark.svg').toString('utf8'), SVG, 'a logo at a path, as a file');
    const named = [...text.matchAll(/`((?:logos|fonts|icons)\/[^`<]+)`/g)].map(([, name]) => name);
    assert.ok(named.length > 10);
    for (const name of named) assert.ok(files.has(name), `${name} is in the archive`);
    for (const set of ['lucide', 'tabler']) {
      assert.ok(files.has(`icons/${set}/LICENSE`));
      for (const [name] of ICONS[set]) assert.match(files.get(`icons/${set}/${name}.svg`).toString('utf8'), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"[^>]*stroke="currentColor"/);
    }
    for (const face of ['Source Serif 4', 'Inter']) assert.match(text, new RegExp(`\\*\\*${face}\\*\\*[^\\n]*free to serve, in \`fonts/[^\`]+\\.woff2\``));
    assert.match(files.get('fonts/fonts.css').toString('utf8'), /@font-face \{ font-family: "Source Serif 4"; src: url\("\.\/[^"]+\.woff2"\)/);
    assert.doesNotMatch(text, /raw\.githubusercontent|ask for it|github\.com\/google\/fonts/, 'nothing is fetched where the archive holds it');
    assert.match(designMd(design, 'example.design.json'), /raw\.githubusercontent\.com\/lucide-icons/, 'DESIGN.md alone still links to the downloads');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('DESIGN.md carries every role the tool shows, the accent borders too, and the CSS keeps them', async () => {
  const { coreCss } = await import('../src/css/index.js');
  for (const inputs of DESIGNS) {
    const { resolved: r, front } = exported(inputs);
    for (const prefix of ['', 'dark-']) {
      assert.match(front, new RegExp(`^  ${prefix}accent-border-strong:`, 'm'));
      assert.match(front, new RegExp(`^  ${prefix}brand-border-strong:`, 'm'));
    }
    assert.match(coreCss(r), /\[data-kn-surface="accent"\] \{[^}]*--kn-border: /, 'a component on an accent band keeps its own border colour');
  }
});

test('DESIGN.md draws the directives\' components by recipe: sections, series, questions, tabs, a choice and the following menu', () => {
  const { body } = exported(DESIGNS[0]);
  for (const words of [
    'three or four, whichever leaves the last row fuller, four where both do alike',
    'four cards fall to two and two, never three and one',
    'an accordion whose headings are all questions',
    'is drawn as questions and answers',
    'An exclusive group of native disclosures (`<details name>`), the first open, drawn as tabs',
    'there are no arrow keys between tabs',
    'None is chosen beforehand, and no panel shows until one is',
    'runs no script and marks no section as the one being read, so it is the same in every browser',
    'a logo, where a picture stands before the text',
    'with fine print under them as their note',
  ]) assert.ok(body.includes(words), words);
  for (const n of [1, 2, 3, 4, 5, 6]) assert.match(body, new RegExp(`^  ${n}\\. \\*\\*`, 'm'), `section rule ${n}`);
  assert.match(body, /from a 48rem window, two equal columns/);
  assert.match(body, /from 60rem, the head beside the accordion at 2:3/);
  assert.doesNotMatch(body, /none of these: [^\n]*\b(tabs|timeline)\b/, 'tabs and a timeline are components now');
  assert.match(body, /^- `brand-instagram`: /m);
  assert.match(body, /^- `brand-x`: /m);
});
