// A Konzilo site built by the real core with this package's directives, presentations and page parts, as
// docs/spec/konzilo.md tells a site to take them: the packed tarball installed, its components registered by
// DESIGN_DIRECTIVES and DESIGN_PRESENTATIONS, its declarations and checks named in the site description, and templates
// of every kind, a page, an article, a term's page, the search page and the 404 page, as konzilo.md's own.
//
// Opt-in, since it needs the core and its dependencies: set KONZILO_CORE to a checkout of the core whose packages are
// installed, as `KONZILO_CORE=~/Projects/konzilo node --test test/konzilo-build.test.js`. Nothing here imports the core:
// the site does, as a site would, by the core's own Astro. KONZILO_BUILD_OUT names an empty folder to build the site in
// and leave there, to look at its pages, `dist/` public and `preview/` as the live preview builds them.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright-core';
import { defaultInputs, resolve as resolveDesign, DESIGN_FORMAT } from '../src/generator/index.js';
import { MATH } from '../src/fonts/catalog.js';
import { copyFonts } from '../src/konzilo/fonts.js';
import { imageContexts } from '../src/konzilo/index.js';
import { heroPictureOf, pictureSizes, seriesPicture, teaserPictures } from '../src/konzilo/images.js';
import { serve } from './helpers/serve.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const core = process.env.KONZILO_CORE ? resolve(process.env.KONZILO_CORE.replace(/^~(?=\/)/, process.env.HOME ?? '~')) : null;
const why = !core ? 'set KONZILO_CORE to a checkout of the Konzilo core with its packages installed to build a site with it'
  : !existsSync(join(core, 'node_modules/astro/bin/astro.mjs')) ? `${core} holds no installed core: run npm install there` : null;

const md = String.raw;
// The core's package, by the name a site imports it by, put together so that this file is not taken for an import of it.
const CORE = ['@kntnt', 'konzilo'].join('/');
const ELEMENTS = ['paragraph', 'heading', 'list', 'quote', 'image', 'gallery', 'post-list', 'form', 'hero', 'section', 'aside', 'list-directive', 'cards', 'accordion', 'tabs', 'toc', 'choice', 'eyebrow', 'small', 'breadcrumbs', 'inline-math', 'block-math'];
const description = {
  language: 'en_GB',
  componentsFrom: '@kntnt/konzilo-design/directives/components.json',
  componentChecks: '@kntnt/konzilo-design/directives/checks',
  types: {
    page: { collection: 'pages', hierarchical: true, address: '/pages/{path}/', elements: ELEMENTS },
    article: { collection: 'articles', address: '/articles/{slug}/', elements: ['paragraph', 'heading', 'list', 'aside', 'image', 'gallery'] },
  },
  taxonomies: { category: { address: '/category/{slug}/' }, topics: { address: '/topic/{slug}/' } },
  search: { address: '/search/' },
  presentations: {
    cards: { label: 'Cards' },
    featured: { label: 'Featured' },
    filtered: { label: 'Filtered', options: { filters: { label: 'Filters', type: 'string', control: 'text' } } },
  },
  images: { smallestWidth: 400, displayWidth: 1280 },
  forms: { contact: { label: 'Write to us', fields: [{ name: 'email', label: 'Email', kind: 'email', required: true }] } },
};

const PICTURE = 'garden-898a545757.webp';
const page = (title, body) => `---\ntitle: "${title}"\ndate: 2026-10-01T08:00:00Z\nmodified: 2026-10-01T08:00:00Z\n---\n\n${body}\n`;
const article = (slug, { headline, category, topics, day, body = `Words on ${slug}.` }) => [`content/articles/${slug}.md`, [
  '---', `title: "${headline}"`, `date: 2026-10-${day}T08:00:00Z`, `modified: 2026-10-${day}T08:00:00Z`,
  `image: {"src":"../media/${PICTURE}","alt":"A bed of ${slug}"}`, `headline: "${headline}"`, `standfirst: "All about ${slug}."`,
  'authors: ["a-writer"]', `category: ["${category}"]`, `topics: ${JSON.stringify(topics)}`, '---', '', body, ''].join('\n')];

// An article's body: a lede, crossheads, an interview's question and a fact box with an anchor.
const SOIL = md`The lede.

## <a id="what-lies-below"></a>What lies below

**What did you find?**

That the soil was dry.

:::aside{anchor="in-short"}

### In short

- Water early.

:::

## Planting

Words on planting.`;

// The bands a template writes with Section, ValueList, Actions and SmallPrint, as a page's body writes them, for the
// build to hold the two to each other.
const BANDS = md`::::section{surface="brand"}

## Find out what your garden can do

A gardener visits and, within two weeks, [writes it down](/pages/garden/).

:::list{type="actions"}

- **[Book a visit](/pages/garden/)**
- [Ask for a reference](/pages/garden/)

:::

::::

::::section{surface="tint" anchor="newsletter"}

## One e-mail a month

The month's guides, and nothing else.

::form{name="contact"}

::small[We keep your address only to send it. Read [how](/pages/legal/).]

::::

:::list{type="values"}

- Office
  - Leeds
- Write
  - [jobs@gardens.example](mailto:jobs@gardens.example)

:::`;

// A series of three cards with pictures in a band across the content area (issue #38).
const BEDS = md`::::section

## Kinds of bed

:::cards

### Raised

![A raised bed](../media/${PICTURE})

Easy on the back.

### Sunken

![A sunken bed](../media/${PICTURE})

Holds water.

### Keyhole

![A keyhole bed](../media/${PICTURE})

Compost in the middle.

:::

::::`;

// A post list of three teasers in a band across the content area (issue #39).
const JOURNAL = md`::::section

## From the journal

::post-list{type="article" number="3" presentation="cards"}

::::`;

// A page with no hero, as a legal page is written: its blocks loose at the top.
// Formulas in a page's body, in the text and as a block, which the core writes as Temml's MathML (issue #33).
const FORMULAS = md`Euler's identity, $e^{i\pi} + 1 = 0$, ties five constants together.

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

The words after it.`;

const LEGAL = md`## What we keep

What you write in a form, for ninety days.

What you do not, we do not keep.`;

const GARDEN = md`::::hero

::breadcrumbs

::eyebrow[A guide]

Start small and let the beds widen year by year.

:::list{type="actions"}

- **[Get started](/pages/garden/)**
- [Read more](/pages/garden/)

:::

::small[Free for the first month.]

![Raised beds](../media/${PICTURE})\
A caption a hero drops.

::::

::::::section{surface="raised" anchor="plans"}

![A shed](../media/${PICTURE})\
The shed in *May*.

::eyebrow[Plans]

## Our plans

A plan for every garden, from a balcony to an acre, each with the tools it needs and the seeds for its soil.

:::::cards

### [Small](/pages/garden/)

![A balcony](../media/${PICTURE})

For a balcony.

### Large

For an acre.

[hello@gardens.example](mailto:hello@gardens.example)

:::::

::::tabs

What you get

### Tools

A spade and a fork.

#### Seeds

:::list{type="values"}

- Seeds
  - Twelve kinds

:::

### Soil

Good soil.

::::

::::::

:::::section{anchor="latest"}

::eyebrow[Latest]

## From the journal

::post-list{type="article" number="3" presentation="featured"}

::post-list{type="article" presentation="filtered" filters="category topics search"}

::form{name="contact"}

::small[We answer within a day.]

:::::

:::section{anchor="courtyard" body="columns"}

## A courtyard made for growing

::post-list{type="article" number="1" leaveOutShown="false" presentation="cards"}

> We stop to see what has grown.
>
> <cite>A. Gardener, resident</cite>

:::`;

const QUESTIONS = md`::::section

## Before you start

:::aside{anchor="in-short"}

::eyebrow[In short]

### Plant in spring

- Water early.

:::

:::accordion{first="open" expand="one"}

### How long does it take?

A season.

:::

::::

::::section{surface="tint"}

:::choice

Do you have a garden?

### Yes

Then plan it.

### No

Then start with a balcony.

:::

::::

::::section

:::toc

In depth

### Soil

Words on soil.

### Water

Words on water.

:::

::::

::::section{surface="raised"}

## How it goes

:::cards{markers="1."}

### We talk

Over coffee.

### We plant

In spring.

:::

:::list{type="logos"}

Trusted by

- ![A grower](../../media/${PICTURE})

:::

::::`;

let site;
before(() => {
  if (why) return;
  site = process.env.KONZILO_BUILD_OUT ? resolve(process.env.KONZILO_BUILD_OUT) : mkdtempSync(join(tmpdir(), 'kn-konzilo-build-'));
  if (process.env.KONZILO_BUILD_OUT && existsSync(site) && readdirSync(site).length > 0) throw new Error(`KONZILO_BUILD_OUT names ${site}, which is not empty`);
  const write = (path, text) => {
    mkdirSync(dirname(join(site, path)), { recursive: true });
    writeFileSync(join(site, path), text);
  };
  // The core's packages, each linked, the core itself among them, as a site of the core's own new-site has them, and
  // this package as its tarball installs it.
  mkdirSync(join(site, 'node_modules/@kntnt'), { recursive: true });
  for (const entry of readdirSync(join(core, 'node_modules'))) {
    if (!entry.startsWith('.') && entry !== '@kntnt') symlinkSync(join(core, 'node_modules', entry), join(site, 'node_modules', entry));
  }
  symlinkSync(core, join(site, 'node_modules/@kntnt/konzilo'));
  const [{ filename }] = JSON.parse(execFileSync('npm', ['pack', '--json', '--silent', '--pack-destination', site], { cwd: repo, encoding: 'utf8' }));
  mkdirSync(join(site, 'node_modules/@kntnt/konzilo-design'));
  execFileSync('tar', ['-xzf', join(site, filename), '-C', join(site, 'node_modules/@kntnt/konzilo-design'), '--strip-components=1']);
  write('package.json', JSON.stringify({ name: 'fixture-site', private: true, type: 'module' }));
  write('astro.config.mjs', [
    `import konzilo from '${CORE}/astro';`,
    "import { DESIGN_DIRECTIVES, DESIGN_PRESENTATIONS, fromDesign } from '@kntnt/konzilo-design/konzilo';",
    '',
    "process.env.KONZILO_ORIGIN ??= 'https://www.example.com';",
    '',
    'export default {',
    "  cacheDir: './.astro-cache', vite: { cacheDir: './.astro-cache/vite' },",
    '  integrations: [konzilo({',
    "    ...await fromDesign('./design/site.design.json'),",
    `    directives: { ...DESIGN_DIRECTIVES, form: '${CORE}/astro/Form.astro' },`,
    '    presentations: { ...DESIGN_PRESENTATIONS },',
    "    termPage: './src/components/TermPage.astro',",
    "    searchPage: './src/components/SearchPage.astro',",
    '  })],',
    "  markdown: { shikiConfig: { theme: 'css-variables' } },",
    '  devToolbar: { enabled: false },',
    '};',
    '',
  ].join('\n'));
  write('src/content.config.mjs', `import { collections as konziloCollections } from '${CORE}/astro';\n\nexport const collections = konziloCollections();\n`);
  write('site-description.json', JSON.stringify(description, null, 2));
  write('src/pages/[...page].astro', [
    '---',
    "import { render } from 'astro:content';",
    `import Body from '${CORE}/astro/Body.astro';`,
    `import { breadcrumbs } from '${CORE}/astro/breadcrumbs';`,
    `import { entryPages } from '${CORE}/astro/languages';`,
    "import { designPage } from '@kntnt/konzilo-design/design-props';",
    "import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';",
    "import design from '../../design/site.design.json';",
    "import '@kntnt/konzilo-design/components.css';",
    '',
    "export function getStaticPaths() { return entryPages('pages', 'page'); }",
    'const { entry, page } = Astro.props;',
    'const { Content } = await render(entry);',
    "designPage(Astro, { design, title: entry.data.title, breadcrumbs: await breadcrumbs(entry, Astro.url), search: '/search/' });",
    '---',
    '<html lang="en"><head><meta charset="utf-8"><title>{entry.data.title}</title></head><body><main><PageBody><Body post={entry} page={page}><Content /></Body></PageBody></main></body></html>',
    '',
  ].join('\n'));
  write('src/pages/articles/[...article].astro', [
    '---',
    "import { getEntries, render } from 'astro:content';",
    `import Body from '${CORE}/astro/Body.astro';`,
    `import { breadcrumbs } from '${CORE}/astro/breadcrumbs';`,
    `import { metaLine } from '${CORE}/astro/helpers';`,
    `import { relatedPosts } from '${CORE}/astro/post-lists';`,
    "import ArticleOpening from '@kntnt/konzilo-design/page-parts/ArticleOpening.astro';",
    "import ArticleBody from '@kntnt/konzilo-design/page-parts/ArticleBody.astro';",
    "import ReadMore from '@kntnt/konzilo-design/page-parts/ReadMore.astro';",
    "import Actions from '@kntnt/konzilo-design/page-parts/Actions.astro';",
    "import Section from '@kntnt/konzilo-design/page-parts/Section.astro';",
    "import ValueList from '@kntnt/konzilo-design/page-parts/ValueList.astro';",
    "import Cards from '@kntnt/konzilo-design/presentations/Cards.astro';",
    `import { listedPosts } from '${CORE}/astro/post-lists';`,
    "import { designPage } from '@kntnt/konzilo-design/design-props';",
    "import { getCollection } from 'astro:content';",
    "import design from '../../../design/site.design.json';",
    "import '@kntnt/konzilo-design/components.css';",
    '',
    "export async function getStaticPaths() { return (await getCollection('articles')).map((entry) => ({ params: { article: entry.id }, props: { entry } })); }",
    'const { entry } = Astro.props;',
    'const { Content } = await render(entry);',
    "designPage(Astro, { design, title: entry.data.headline, breadcrumbs: await breadcrumbs(entry, Astro.url) });",
    "const topics = (await getEntries(entry.data.topics)).map((topic) => ({ name: topic.data.name, url: `/topic/${topic.id}/` }));",
    '---',
    "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>{entry.data.headline}</title></head><body><main><ArticleOpening entry={entry} metaLine={await metaLine(entry, Astro.url)} topics={topics}><Fragment slot=\"after\"><ValueList items={[{ label: 'Office', value: 'Leeds' }, { label: 'Write', value: '<a href=\"mailto:jobs@gardens.example\">jobs@gardens.example</a>' }]} /><Actions links={[{ label: 'How to apply', href: '#planting' }]} /></Fragment></ArticleOpening><ArticleBody><Body post={entry}><Content /></Body></ArticleBody><ReadMore posts={await relatedPosts(entry)} more={{ label: 'More articles', href: '/articles/' }} surface=\"raised\" /><Section surface=\"raised\" heading=\"Other articles\"><Cards posts={await listedPosts({ type: 'article', number: 2 }, { post: entry })} options={{}} empty=\"\" /><Actions links={[{ label: 'All articles', href: '/articles/' }]} /></Section><Section surface=\"brand\" heading=\"Find out what your garden can do\" actions={[{ label: 'Book a visit', href: '/pages/garden/' }, { label: 'Ask for a reference', href: '/pages/garden/' }]}><Fragment slot=\"deck\">A gardener visits and, within two weeks, <a href=\"/pages/garden/\">writes it down</a>.</Fragment></Section></main></body></html>",
    '',
  ].join('\n'));
  write('src/components/SearchPage.astro', [
    '---',
    `import Search from '${CORE}/astro/Search.astro';`,
    `import { breadcrumbs } from '${CORE}/astro/breadcrumbs';`,
    "import TitleBand from '@kntnt/konzilo-design/page-parts/TitleBand.astro';",
    "import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';",
    "import ReadingArea from '@kntnt/konzilo-design/components/ReadingArea.astro';",
    "import { designPage } from '@kntnt/konzilo-design/design-props';",
    "import design from '../../design/site.design.json';",
    "import '@kntnt/konzilo-design/components.css';",
    '',
    "designPage(Astro, { design, title: 'Search', breadcrumbs: await breadcrumbs(null, Astro.url, { title: 'Search' }) });",
    '---',
    '<html lang="en"><head><meta charset="utf-8"><title>Search</title></head><body><main><TitleBand><ReadingArea side="end"><Search /></ReadingArea></TitleBand></main></body></html>',
    '',
  ].join('\n'));
  write('src/pages/404.astro', [
    '---',
    "import { render } from 'astro:content';",
    `import Body from '${CORE}/astro/Body.astro';`,
    `import { notFoundPage } from '${CORE}/astro/site-settings';`,
    "import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';",
    "import { designPage } from '@kntnt/konzilo-design/design-props';",
    "import design from '../../design/site.design.json';",
    "import '@kntnt/konzilo-design/components.css';",
    '',
    'const page = await notFoundPage(Astro.url);',
    'const { Content } = await render(page);',
    'designPage(Astro, { design, title: page.data.title });',
    '---',
    '<html lang="en"><head><meta charset="utf-8"><title>{page.data.title}</title></head><body><main><PageBody><Body post={page}><Content /></Body></PageBody></main></body></html>',
    '',
  ].join('\n'));
  write('src/components/TermPage.astro', [
    '---',
    `import { termPages } from '${CORE}/astro/post-lists';`,
    `import { breadcrumbs } from '${CORE}/astro/breadcrumbs';`,
    "import Filtered from '@kntnt/konzilo-design/presentations/Filtered.astro';",
    "import TermOpening from '@kntnt/konzilo-design/page-parts/TermOpening.astro';",
    "import Section from '@kntnt/konzilo-design/page-parts/Section.astro';",
    "import SmallPrint from '@kntnt/konzilo-design/page-parts/SmallPrint.astro';",
    `import Form from '${CORE}/astro/Form.astro';`,
    "import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';",
    "import { designPage } from '@kntnt/konzilo-design/design-props';",
    "import design from '../../design/site.design.json';",
    "import '@kntnt/konzilo-design/components.css';",
    '',
    'export async function getStaticPaths({ routePattern }) { return termPages(routePattern); }',
    'const { term, posts, pager, empty } = Astro.props;',
    "const taxonomy = { categories: 'category', topics: 'topics' }[term.collection];",
    "designPage(Astro, { design, title: term.data.name, breadcrumbs: await breadcrumbs(term, Astro.url), search: '/search/', types: { articles: { name: 'article', label: 'Article', plural: 'Articles' } } });",
    '---',
    "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>{term.data.name}</title></head><body><main><TermOpening term={term} surface=\"tint\" /><PageBody title={false}><Filtered posts={posts} pager={pager} empty={empty} options={{ filters: 'category topics search' }} settled={{ taxonomy, term: term.id }} /></PageBody><Section surface=\"tint\" anchor=\"newsletter\" heading=\"One e-mail a month\" deck=\"The month's guides, and nothing else.\"><Form name=\"contact\" /><SmallPrint>We keep your address only to send it. Read <a href=\"/pages/legal/\">how</a>.</SmallPrint></Section></main></body></html>",
    '',
  ].join('\n'));
  mkdirSync(join(site, 'content/media'), { recursive: true });
  copyFileSync(join(core, 'site-template/demo-content/media/every-element-898a545757.webp'), join(site, 'content/media', PICTURE));
  write('content/pages/garden.md', page('Planning a garden', GARDEN));
  write('content/pages/legal.md', page('What we keep about you', LEGAL));
  write('content/pages/formulas.md', page('Formulas', FORMULAS));
  write('content/pages/bands.md', page('Bands', BANDS));
  write('content/pages/beds.md', page('Kinds of bed', BEDS));
  write('content/pages/journal.md', page('From the journal', JOURNAL));
  write('content/not-found.md', '---\ntitle: "This page is not here"\n---\n\nTry the [start page](/pages/garden/).\n');
  // The core's own demo settings, which hold every group the core asks for, with the articles' meta line in a format of the
  // owner's sentence and the pictures they name.
  const settings = JSON.parse(readFileSync(join(core, 'site-template/demo-content/settings.json'), 'utf8'));
  settings.metaLine.types.article.format = 'By {authors} • Published {date} in {category}';
  // Less what this site has none of: a canvas, a setting of the demo's own, and feeds.
  for (const group of Object.values(settings)) if (group?.types) delete group.types.canvas;
  delete settings.footerText;
  delete settings.feeds;
  write('content/settings.json', JSON.stringify(settings));
  for (const media of [settings.logo?.src, settings.icon?.src].filter(Boolean)) copyFileSync(join(core, 'site-template/demo-content', media), join(site, 'content', media));
  write('content/pages/garden/questions.md', page('Questions on a garden', QUESTIONS));
  write('content/pages/garden/tools.md', page('Tools for a garden', md`::::hero

::breadcrumbs

Words.

::::`));
  for (const [path, text] of [
    article('soil', { headline: 'Know your soil', category: 'guides', topics: ['soil'], day: '05', body: SOIL }),
    article('tools', { headline: 'The right tools', category: 'guides', topics: ['tools', 'soil'], day: '04' }),
    article('water', { headline: 'Water early', category: 'news', topics: ['water'], day: '03', body: `Words on water.\n\n![A watering can](../media/${PICTURE})\n\nMore words on water.` }),
    article('seeds', { headline: 'Seeds that last', category: 'news', topics: ['soil'], day: '02', body: `Words on seeds.\n\n![A packet of seeds](../media/${PICTURE})\n![A tray of seedlings](../media/${PICTURE})\nA spring.` }),
  ]) write(path, text);
  for (const [path, name] of [['authors/a-writer', 'A. Writer'], ['categories/guides', 'Guides'], ['categories/news', 'News'], ['topics/soil', 'Soil'], ['topics/tools', 'Tools'], ['topics/water', 'Water']]) {
    write(`content/${path}.json`, JSON.stringify({ name, description: `On ${name.toLowerCase()}.` }));
  }
});
after(() => { if (site && !process.env.KONZILO_BUILD_OUT) rmSync(site, { recursive: true, force: true }); });


// The site built into `out`, with the build's environment.
function build(out, environment = {}) {
  const inputs = defaultInputs();
  const designFile = join(site, 'design/site.design.json');
  if (!existsSync(designFile)) {
    mkdirSync(dirname(designFile), { recursive: true });
    return resolveDesign(inputs).then(async (resolved) => {
      writeFileSync(designFile, JSON.stringify({ format: DESIGN_FORMAT, inputs, project: { name: 'Example Gardens' }, resolved }));
      // Every design takes its fonts folder, for the formulas' font, copied from this repository as a site's is.
      await copyFonts(designFile, join(site, 'design/fonts'));
      return build(out, environment);
    });
  }
  const built = spawnSync(process.execPath, [join(core, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', out], {
    cwd: site, encoding: 'utf8',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ASTRO_DISABLE_UPDATE_CHECK: 'true', KONZILO_ORIGIN: 'https://www.example.com', ...environment },
  });
  return Promise.resolve({ status: built.status, output: `${built.stdout}\n${built.stderr}`, page: (path) => readFileSync(join(site, out, path, 'index.html'), 'utf8') });
}
const main = (html) => /<main>([\s\S]*)<\/main>/.exec(html)[1];

test('a site built by the core draws every directive with the package\'s components, a section\'s post lists and form in its body, and every template its page parts', { skip: why ?? false, timeout: 600000 }, async () => {
  const built = await build('dist');
  assert.equal(built.status, 0, built.output);
  assert.doesNotMatch(built.output, /@kntnt\/konzilo-design:/, 'no part warns');
  const html = main(built.page('pages/garden'));
  assert.doesNotMatch(html, /content="\[object Object\]"|data-directive=/, 'every directive drawn, none given its tree as an attribute');
  const courtyard = /<section class="kn-band kn-section" id="courtyard" data-kn-body="columns">[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(courtyard, 'the section takes body="columns" through the core');
  assert.match(courtyard, /<div class="kn-section-body kn-body-text"><div class="kn-post-list" data-kn-presentation="cards">[\s\S]*?<article class="kn-card"[\s\S]*?<\/div>\s*<blockquote>\s*<p>We stop to see what has grown\.<\/p>\s*<p><cite>A\. Gardener, resident<\/cite><\/p>\s*<\/blockquote>/);
  // The hero: the trail, the post's title, the eyebrow, deck, actions, small print and the picture behind, as the
  // default design has it. The trail ends with the page itself, as the design's `current` says, though the core's setting
  // for the type, off by default, marks the level hidden.
  assert.match(html, /^<section class="kn-band kn-hero" data-kn-surface="picture-dark"[^>]*><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><nav class="kn-breadcrumbs"[^>]* data-kn-current="true"[^>]*>.*?<span aria-current="page">Planning a garden<\/span><\/li><\/ol><\/nav><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">A guide<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">Start small/s);
  assert.match(html, /<ul class="kn-actions" role="list"><li><a class="kn-action" href="\/pages\/garden\/" data-kn-main>Get started<\/a><\/li>/);
  // Its picture behind is an <img> after its content, with the core's srcset, the band's sizes and its own alt text.
  const hero = /^<section class="kn-band kn-hero"[\s\S]*?<\/section>/.exec(html)[0];
  assert.doesNotMatch(hero, /^<section[^>]*\sstyle=/);
  const behind = /<\/div><\/div><img class="kn-band-picture" ([^>]*)><\/section>$/.exec(hero)?.[1];
  assert.ok(behind, 'the band\'s last child');
  // Its sizes the band's, as wide as half the window's height makes a picture of 16:10 where that is wider than the window.
  for (const attribute of [/\bsrc="\/_astro\/[^"]+\.webp"/, /\bsrcset="[^"]+ \d+w"/, /\bsizes="max\(100vw, 80vh\)"/, /\balt="Raised beds"/, /\bloading="eager"/]) assert.match(behind, attribute);
  // The core's image service made the pictures, and the components keep what it wrote.
  assert.match(html, /<img class="kn-section-picture" src="\/_astro\/[^"]+\.webp" alt="A shed"[^>]* width="\d+" height="\d+"/);
  // A section's photo keeps its caption under it; a hero's picture drops its own, with no warning (issue #35).
  assert.match(html, /<div class="kn-section-media"><figure class="kn-section-figure"><img class="kn-section-picture"[^>]*><figcaption class="kn-section-caption" data-kn-type="small">The shed in <em>May<\/em>\.<\/figcaption><\/figure><\/div>/);
  assert.doesNotMatch(html, /A caption a hero drops/);
  // The section of plans: its head drawn from the tree, cards and tabs in its body.
  const plans = /<section class="kn-band kn-section" id="plans" data-kn-surface="raised">[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(plans, /<header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Plans<\/p><h2 class="kn-heading-group-heading" data-kn-type="heading-2" id="our-plans">Our plans<\/h2><p class="kn-heading-group-deck" data-kn-type="lead" data-kn-deck="long">/);
  assert.match(plans, /<div class="kn-section-body kn-body-text"><div class="kn-card-grid kn-cards"><article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture"[^>]*alt="A balcony"[^>]*><h3 class="kn-card-heading" data-kn-type="heading-5" id="small"><a class="kn-card-link" href="\/pages\/garden\/">Small<\/a><\/h3>/);
  assert.match(plans, /data-kn-contact="email">hello@<wbr>gardens<wbr>\.example<\/a>/);
  assert.match(plans, /<div class="kn-tabs" role="group" aria-labelledby="tabs-1">.*<h3 id="seeds">Seeds<\/h3>.*<dl class="kn-value-list">/s);
  // The latest: the presentations and the core's form in the section's body, each where it was written.
  const latest = /<section class="kn-band kn-section" id="latest">[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(latest, /<header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Latest<\/p><h2[^>]*>From the journal<\/h2><\/hgroup><\/header><div class="kn-section-body kn-body-text"><div class="kn-post-list" data-kn-presentation="featured"><div class="kn-featured"><article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture" src="\/_astro\/[^"]+" srcset="[^"]+"[^>]*><p class="kn-card-eyebrow" data-kn-type="label">Guides<\/p><h3 class="kn-card-heading" data-kn-type="heading-3"><a class="kn-card-link" href="\/articles\/soil\/">Know your soil<\/a><\/h3><p class="kn-card-text" data-kn-type="small">All about soil\.<\/p>/);
  assert.match(latest, /<div class="kn-post-list" data-kn-presentation="filtered"><form class="kn-visitor-filters" role="search" method="get" action="\/search\/"><input type="hidden" name="type" value="article"><div class="kn-visitor-filter-panel"><fieldset class="kn-visitor-filter-group"><legend>Category<\/legend>.*value="news".*<legend>Topic<\/legend>.*value="soil"/s);
  assert.match(latest, /<\/div><\/div>\s*<form class="konzilo-form[^"]*"[\s\S]*<\/form>\s*<p class="kn-fine-print" data-kn-type="small">We answer within a day\.<\/p><\/div><\/div><\/section>$/);
  // A page below it has its trail first in its hero, from the core's levels.
  assert.match(main(built.page('pages/garden/tools')), /^<section class="kn-band kn-hero"[^>]*><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><nav class="kn-breadcrumbs" aria-label="Breadcrumb" data-kn-type="small"[^>]* data-kn-current="true"[^>]*><ol role="list"><li><a href="\/">.*<span class="kn-breadcrumbs-label">[^<]+<\/span><\/a><\/li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"><\/span><a href="\/pages\/garden\/"><span class="kn-breadcrumbs-label">Planning a garden<\/span><\/a><\/li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"><\/span><span aria-current="page">Tools for a garden<\/span><\/li><\/ol><\/nav><hgroup/s);
  // A page's ids once each.
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [...new Set(ids)]);
  // The other parts, each drawn, none left as the core's plain rendering.
  const questions = main(built.page('pages/garden/questions'));
  assert.doesNotMatch(questions, /data-directive=/);
  for (const part of ['<aside class="kn-fact-box" id="in-short" data-kn-surface="tint">', '<div class="kn-accordion" data-kn-accordion-mode="single" data-kn-questions>', '<div class="kn-choice" role="group" aria-labelledby="choice-1">', '<nav class="kn-toc" aria-labelledby="toc-1"', '<ol class="kn-timeline" data-kn-numbering="decimal" data-kn-punctuation="period">', '<div class="kn-logos"><p class="kn-logos-label" id="logos-1" data-kn-type="label">Trusted by</p>']) {
    assert.ok(questions.includes(part), part);
  }
  // The page parts, each in a template of its kind (konzilo.md, The templates). A page with no hero: its title band, then
  // its loose blocks as a section, the heading beside its paragraphs.
  assert.match(main(built.page('pages/legal')), /^<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><nav class="kn-breadcrumbs".*?<\/nav><hgroup class="kn-heading-group"><h1 class="kn-heading-group-heading" data-kn-type="heading-1">What we keep about you<\/h1><\/hgroup><\/header><\/div><\/section>\s*<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" id="what-we-keep" data-kn-type="heading-2">What we keep<\/h2><\/hgroup><\/header><div class="kn-section-body kn-body-text"><p>What you write in a form/s);
  // An article: its opening with the core's meta line, its body with its following menu and question, and Read more.
  const soil = main(built.page('articles/soil'));
  assert.match(soil, /^<section class="kn-band kn-hero kn-article-opening" data-kn-surface="picture-dark"[^>]*><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><nav class="kn-breadcrumbs".*?<span aria-current="page">Know your soil<\/span><\/li><\/ol><\/nav><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Guides<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Know your soil<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">All about soil\.<\/p><\/hgroup><p class="kn-article-meta" data-kn-type="small"><span class="kn-article-line">By <span class="kn-article-byline">A\. Writer<\/span> • Published <time class="kn-article-date" datetime="2026-10-05T08:00:00\.000Z">5 October 2026<\/time> in <a class="kn-article-category" href="\/category\/guides\/">Guides<\/a><\/span><span class="kn-article-topics"><a class="kn-pill" href="\/topic\/soil\/">Soil<\/a><\/span><\/p>/s);
  assert.match(soil, /<ol role="list"><li><a href="#what-lies-below">What lies below<\/a><\/li><li><a href="#in-short">In short<\/a><\/li><li><a href="#planting">Planting<\/a><\/li><\/ol>/);
  assert.match(soil, /<p class="kn-question"><strong>What did you find\?<\/strong><\/p>/);
  assert.match(soil, /<section class="kn-band kn-section" data-kn-surface="raised">.*<h2 class="kn-heading-group-heading" data-kn-type="heading-2">Read more<\/h2>.*<article class="kn-card" data-kn-surface="page">.*href="\/articles\/tools\/".*<a class="kn-action" href="\/articles\/" data-kn-main>More articles<\/a>/s);
  // The search page: one section, its title and trail as its head and the core's search in a Reading Area as its body.
  const search = main(built.page('search'));
  assert.match(search, /^<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><nav class="kn-breadcrumbs".*<h1 class="kn-heading-group-heading" data-kn-type="heading-1">Search<\/h1><\/hgroup><\/header><div class="kn-section-body kn-body-text"><div class="kn-reading-area" data-kn-side="end" data-kn-stack="before"><div class="kn-reading-area-flow"><div class="konzilo-search"/s);
  assert.equal((search.match(/<section/g) ?? []).length, 1);
  // The 404 page: the chosen page's title as its H1 and its body as a section.
  assert.match(main(readFileSync(join(site, 'dist/404.html'), 'utf8')), /<h1 class="kn-heading-group-heading" data-kn-type="heading-1">This page is not here<\/h1>.*<div class="kn-section-body kn-body-text"><p>Try the <a href="\/pages\/garden\/">start page<\/a>\.<\/p>/s);
  // The bands a template writes with Section, ValueList, Actions and SmallPrint are what the same Markdown in a page's
  // body is, as the core draws it, but for the heading's id, which a template gives from its words, and the core's form,
  // whose ids are its own. Drawn with white space between blocks as the core's are; compared without it.
  const tight = (html) => html.replace(/>\s+</g, '><').trim();
  const bands = tight(main(built.page('pages/bands')));
  const sectionAt = (html, start) => html.slice(html.indexOf(start), html.indexOf('</section>', html.indexOf(start)) + '</section>'.length);
  const closing = '<section class="kn-band kn-section" data-kn-surface="brand">';
  assert.equal(tight(sectionAt(soil, closing)), sectionAt(bands, closing));
  assert.match(sectionAt(bands, closing), /<header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" data-kn-type="heading-2" id="find-out-what-your-garden-can-do">Find out what your garden can do<\/h2><p class="kn-heading-group-deck" data-kn-type="lead">A gardener visits and, within two weeks, <a href="\/pages\/garden\/">writes it down<\/a>\.<\/p><\/hgroup><ul class="kn-actions" role="list"><li><a class="kn-action" href="\/pages\/garden\/" data-kn-main>Book a visit<\/a><\/li><li><a class="kn-action" href="\/pages\/garden\/">Ask for a reference<\/a><\/li><\/ul><\/header>/);
  const newsletter = '<section class="kn-band kn-section" id="newsletter" data-kn-surface="tint">';
  const [own, inBody] = [tight(sectionAt(main(built.page('category/guides')), newsletter)), sectionAt(bands, newsletter)];
  const formless = (html) => html.replace(/<form class="konzilo-form[\s\S]*<\/form>/, '<form/>');
  assert.equal(formless(own), formless(inBody));
  assert.match(own, /<h2 class="kn-heading-group-heading" data-kn-type="heading-2" id="one-e-mail-a-month">One e-mail a month<\/h2><\/hgroup><\/header><div class="kn-section-body kn-body-text"><p>The month's guides, and nothing else\.<\/p><form class="konzilo-form[\s\S]*<\/form><p class="kn-fine-print" data-kn-type="small">We keep your address only to send it\. Read <a href="\/pages\/legal\/">how<\/a>\.<\/p><\/div>/);
  // A value list and actions in an opening's slot, as the same Markdown draws them.
  const values = bands.slice(bands.indexOf('<dl class="kn-value-list">'), bands.indexOf('</dl>') + 5);
  assert.ok(tight(soil).includes(values), 'the value list is the Markdown\'s');
  assert.match(values, /<a href="mailto:jobs@gardens\.example" data-kn-contact="email">jobs@<wbr>gardens<wbr>\.example<\/a>/);
  assert.match(tight(soil), /<\/dl><ul class="kn-actions" role="list"><li><a class="kn-action" href="#planting" data-kn-main>How to apply<\/a><\/li><\/ul><\/div><\/div><img class="kn-band-picture"[^>]*><\/section>/);
  // A section's head over a list a presentation draws, and a lone action after the list in its body.
  assert.match(tight(soil), /<section class="kn-band kn-section" data-kn-surface="raised"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" data-kn-type="heading-2" id="other-articles">Other articles<\/h2><\/hgroup><\/header><div class="kn-section-body kn-body-text"><div class="kn-post-list" data-kn-presentation="cards">.*<\/div><ul class="kn-actions" role="list"><li><a class="kn-action" href="\/articles\/" data-kn-main>All articles<\/a><\/li><\/ul><\/div><\/div><\/section>/);
  // A term's page calls the presentation itself, the row it settles left out and kept with a search.
  const term = main(built.page('category/guides'));
  assert.match(term, /^<section class="kn-band kn-section" data-kn-surface="tint"><div class="kn-band-content"><header class="kn-section-head"><nav class="kn-breadcrumbs".*<p class="kn-heading-group-eyebrow" data-kn-type="label">Category<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Guides<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">On guides\.<\/p>/s);
  assert.match(term, /<div class="kn-section-body kn-body-text"><div class="kn-post-list" data-kn-presentation="filtered"><form class="kn-visitor-filters" role="search" method="get" action="\/search\/"><input type="hidden" name="type" value="article"><input type="hidden" name="category" value="guides"><div class="kn-visitor-filter-panel"><fieldset class="kn-visitor-filter-group"><legend>Topic<\/legend>/);
});

// The formulas' font is cut to the characters of one Temml, bin/design-fonts' TEMML, the one the core installs. A core
// that moves to another Temml may write a character the cut lacks, which a browser then draws in another font, unseen.
test('the formulas\' font is cut to the characters of the Temml the core installs', { skip: why ?? false }, () => {
  const installed = JSON.parse(readFileSync(join(core, 'node_modules/temml/package.json'), 'utf8')).version;
  assert.equal(MATH.subset, `temml ${installed}`, `The core installs Temml ${installed}, but the formulas' font is cut to ${MATH.subset}: set TEMML in bin/design-fonts to ${installed} and run it again.`);
});

test('a site built by the core writes a body\'s formulas as konzilo.css draws them, and serves the formulas\' font from its fonts folder', { skip: why ?? false, timeout: 600000 }, async () => {
  const built = await build('dist');
  assert.equal(built.status, 0, built.output);
  const html = main(built.page('pages/formulas'));
  assert.match(html, /<p>Euler's identity, <math><semantics>[\s\S]*?<annotation encoding="application\/x-tex">e\^\{i\\pi\} \+ 1 = 0<\/annotation><\/semantics><\/math>, ties five constants together\.<\/p>/);
  assert.match(html, /<div class="konzilo-math"><math display="block" class="tml-display" style="display:block math;"><semantics>[\s\S]*?<msubsup>/);
  // The site's stylesheets, as the core bundles bodyStyles: konzilo.css's rules on math, and the fonts folder's
  // @font-face, its font served by the site itself.
  const assets = join(site, 'dist/_astro');
  const css = readdirSync(assets).filter((name) => name.endsWith('.css')).map((name) => readFileSync(join(assets, name), 'utf8')).join('\n');
  assert.match(css, /font-family:\s*"?STIX Two Math"?,\s*math/);
  const face = /@font-face\s*\{[^}]*font-family:\s*"?STIX Two Math"?;[^}]*src:\s*url\("?([^)"]+)"?\)/.exec(css);
  assert.ok(face, 'the formulas\' font is declared');
  assert.match(face[1], /^\/_astro\/STIXTwoMath-Regular\.[\w-]+\.woff2$/);
  assert.deepEqual(readFileSync(join(site, 'dist', face[1])), readFileSync(join(repo, 'src/fonts/STIXTwoMath-Regular.woff2')));
});

test('in the core\'s live preview every part keeps its block\'s mark, and a section still finds its body', { skip: why ?? false, timeout: 600000 }, async () => {
  const built = await build('preview', { KONZILO_PREVIEW: '1' });
  assert.equal(built.status, 0, built.output);
  const html = main(built.page('pages/garden'));
  assert.match(html, /^<section data-konzilo-block="0" class="kn-band kn-hero"/);
  assert.match(html, /<section data-konzilo-block="1" class="kn-band kn-section" id="plans"/);
  assert.match(html, /<figure class="kn-section-figure"><img class="kn-section-picture"[^>]* data-konzilo-block="1\.0"[^>]*><figcaption class="kn-section-caption"/, 'a photo with its caption keeps its mark on its picture');
  assert.match(html, /<div class="kn-section-body kn-body-text"><div data-konzilo-block="1\.4" class="kn-card-grid kn-cards">/);
  assert.match(html, /<div data-konzilo-block="2\.2" class="kn-post-list" data-kn-presentation="featured">/);
  assert.match(html, /<section data-konzilo-block="3" class="kn-band kn-section" id="courtyard" data-kn-body="columns">/);
  assert.match(html, /<div data-konzilo-block="3\.1" class="kn-post-list" data-kn-presentation="cards">/);
  assert.match(html, /<blockquote data-konzilo-block="3\.2">/);
  assert.match(html, /<p class="kn-heading-group-eyebrow" data-kn-type="label" data-konzilo-block="1\.1">Plans<\/p>/);
  assert.doesNotMatch(html, /konzilo-preview-part/, 'no wrapper stands between a part and its band');
  assert.doesNotMatch(html, /data-directive=/);
});

// The core's own body check, as its intake reads a post, with the package's declarations and checks: the core's modules
// from its checkout, as the intake would load them.
test('the core\'s body check reads the package\'s declarations and runs its checks', { skip: why ?? false }, async () => {
  const from = (path) => import(new URL(`file://${join(core, path)}`).href);
  const [{ readBody }, { embedOf }, { readComponents, withComponents }, { reader }, { default: rules }, { componentProblems }] = await Promise.all([
    from('src/format/body.js'), from('src/format/embeds.js'), from('src/format/components.js'), from('src/intake/reader.js'),
    import(new URL(`file://${join(core, 'src/format/rules.json')}`).href, { with: { type: 'json' } }), import('../src/directives/checks.js'),
  ]);
  const declared = JSON.parse(readFileSync(join(repo, 'src/directives/components.json'), 'utf8'));
  const problems = [];
  const components = readComponents(declared, rules, 'componentsFrom', problems, (label) => label);
  assert.deepEqual(problems, [], 'the core takes the declarations as they are');
  const hands = {
    reader, rules: withComponents(rules, components), elements: ELEMENTS, embedOf, adminHost: null, declared: { forms: ['contact'] },
    link: (id) => ({ href: `/${id}/` }), image: (address) => ({ src: address }), components: componentProblems,
  };
  const reasons = (body) => readBody(body, hands).problems.map(({ reason }) => (typeof reason === 'string' ? reason : reason.name));
  assert.deepEqual(reasons(GARDEN), []);
  assert.deepEqual(reasons(QUESTIONS), []);
  assert.deepEqual(reasons(md`::::tabs

### One

::form{name="contact"}

::::`), ['Tabs cannot hold a form yet, since only a section can hold one directly: put it in a section of its own.']);
  assert.deepEqual(reasons(md`:::list{type="actions"}

- **[One](/one/)**
- **[Two](/two/)**

:::`), ['A styled list of actions has at most one main action, the one link in bold, and this has 2.']);
  assert.match(reasons('::::section{surface="green"}\n\nWords.\n\n::::').join(), /A section stands on page, raised, inverse, tint, brand or accent, or on tint, brand or accent in the second or third colour, such as tint-secondary or brand-tertiary, not on green\./);
  assert.match(reasons('::::hero{height="tall"}\n\nWords.\n\n::::').join(), /An opening's height is third, half, two-thirds or full, its share of the screen, not tall\. Leave it out for the design's own\./);
  for (const height of ['third', 'half', 'two-thirds', 'full']) assert.deepEqual(reasons(`::::hero{height="${height}"}\n\nWords.\n\n::::`), [], height);
  assert.match(reasons(':::section{body="split"}\n\nWords.\n\n:::').join(), /A section's body is columns, or stacked where this is left out, not split\./);
  assert.match(reasons(':::section{body="columns"}\n\n> Only a quotation.\n\n:::').join(), /one post list with presentation="cards" and one quotation/);
  assert.match(reasons(':::section{align="middle"}\n\nWords.\n\n:::').join(), /A section's alignment is start or center, and start where this is left out, not middle\./);
  assert.deepEqual(reasons(':::section{align="center"}\n\n## Ready?\n\nTell us where you live.\n\n::form{name="contact"}\n\n:::'), []);
  assert.deepEqual(reasons(':::section{align="center"}\n\n## Our story\n\nOne.\n\nTwo.\n\n:::'), ['A section with a heading and paragraphs alone sets the paragraphs beside the heading, so it cannot be centred. Leave out align="center".']);
});

// A body's image drawn by the package's article body in a site the core builds, at a phone's width: a browser loads the
// version of it that covers the width the design draws it at, at the screen's density, and no other (issue #36; the
// core's ADR 0022 measured the same of its own defaults).
const ENGINES = Object.entries({ firefox, webkit, chromium }).filter(([, type]) => existsSync(type.executablePath()));
// An attribute of an <img> as the built HTML writes it, its entities read; and its srcset's candidates, each its address
// and width.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#38': '&', '#39': "'" };
const attributeOf = (img, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(img)?.[1].replace(/&(amp|lt|gt|quot|#38|#39);/g, (_, entity) => ENTITIES[entity]);
const candidatesOf = (img) => attributeOf(img, 'srcset').split(', ').map((candidate) => {
  const [url, w] = candidate.trim().split(/\s+/);
  return { url, width: Number(w.slice(0, -1)) };
});
test('in a designed site built by the core, a body\'s image at a phone\'s width loads the version that covers how wide the design draws it, and about twice as wide at density 2', { skip: why ?? false, timeout: 600000 }, async (t) => {
  if (!existsSync(join(site, 'dist/articles/water/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const { body } = imageContexts(JSON.parse(readFileSync(join(site, 'design/site.design.json'), 'utf8')).resolved);
  const html = readFileSync(join(site, 'dist/articles/water/index.html'), 'utf8');
  const img = /<div class="kn-reading-area-flow kn-body-text">[\s\S]*?<figure><button class="konzilo-lightbox-open"[^>]*><img ([^>]*)>/.exec(html)?.[1];
  assert.ok(img, 'the article\'s body draws its image');
  assert.equal(attributeOf(img, 'sizes'), body.sizes, 'the core writes the design\'s sizes');
  const candidates = candidatesOf(img);
  // The master is 1600 px wide, so each of the body's and the lightbox's widths up to it, and the master's own in place
  // of those wider and of 1440, within a tenth of it (the core's ADR 0022).
  assert.deepEqual(candidates.map(({ width }) => width), [360, 509, 720, 1018, 1600]);
  const server = await serve(join(site, 'dist'));
  try {
    for (const [engine, type] of ENGINES) {
      const browser = await type.launch();
      try {
        const loaded = {};
        for (const density of [1, 2]) {
          const context = await browser.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: density });
          const tab = await context.newPage();
          const requested = new Set();
          tab.on('request', (request) => requested.add(new URL(request.url()).pathname));
          await tab.goto(`${server.origin}/articles/water/`);
          const figure = tab.locator('.kn-reading-area-flow figure img').first();
          await figure.scrollIntoViewIfNeeded();
          await tab.waitForFunction(() => { const image = document.querySelector('.kn-reading-area-flow figure img'); return image.complete && image.naturalWidth > 0; });
          const { drawn, current, elsewhere } = await figure.evaluate((image) => ({
            drawn: image.getBoundingClientRect().width,
            current: new URL(image.currentSrc).pathname,
            // The same master's versions other pictures on the page draw, as the article's opening and the lightbox do.
            elsewhere: [...document.querySelectorAll('img')].filter((other) => other !== image && other.currentSrc).map((other) => new URL(other.currentSrc).pathname),
          }));
          const where = `${engine} at density ${density}: drawn ${drawn} px, ${current} loaded of ${candidates.map(({ width }) => width)}`;
          const chosen = candidates.find(({ url }) => url === current);
          assert.ok(chosen, where);
          // The narrowest version at least as wide as the image is drawn at this density, or the one under it, which
          // Chromium takes where it is near enough: never one wider than covers it.
          const need = drawn * density;
          const covering = candidates.find(({ width }) => width >= need);
          const under = candidates.filter(({ width }) => width < need).at(-1);
          assert.ok(chosen === covering || chosen === under, where);
          assert.deepEqual([...requested].filter((path) => candidates.some(({ url }) => url === path) && (path === current || !elsewhere.includes(path))), [current], `${where}: no other version of it is loaded`);
          loaded[density] = chosen.width;
          t.diagnostic(`${engine}, density ${density}: drawn ${drawn} px, loaded the ${chosen.width} px version`);
          await context.close();
        }
        assert.ok(loaded[2] / loaded[1] >= 1.4 && loaded[2] / loaded[1] <= 2.9, `${engine}: ${loaded[1]} px at density 1 and ${loaded[2]} px at density 2`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
});

// A hero's picture behind its text in a site the core builds, at a phone's width: a browser loads the version of it that
// covers the picture as the band draws it, at the screen's density, where as a CSS background it loaded the widest
// (issue #40). The band is half the window's height less the header's, taller in its proportions than the picture, so
// the picture is drawn wider than the band, as its height makes it, which its sizes says (konzilo.md, Images).
test('in a designed site built by the core, a hero\'s picture behind its text at a phone\'s width loads the version that covers it as the band draws it, and about twice as wide at density 2', { skip: why ?? false, timeout: 600000 }, async (t) => {
  if (!existsSync(join(site, 'dist/pages/garden/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const resolved = JSON.parse(readFileSync(join(site, 'design/site.design.json'), 'utf8')).resolved;
  const html = readFileSync(join(site, 'dist/pages/garden/index.html'), 'utf8');
  const img = /<img class="kn-band-picture" ([^>]*)>/.exec(html)?.[1];
  assert.ok(img, 'the hero draws its picture behind');
  // The band's, by the hero's height and the picture's proportions, 1600 × 1000.
  assert.deepEqual([attributeOf(img, 'width'), attributeOf(img, 'height')], ['1600', '1000']);
  assert.equal(attributeOf(img, 'sizes'), pictureSizes(resolved, 'band', { height: resolved.hero.height, ratio: 1.6 }), 'the band\'s sizes, as tall as the hero');
  assert.equal(attributeOf(img, 'sizes'), 'max(100vw, 80vh)');
  const candidates = candidatesOf(img);
  // The core gives a body's image the body's and the lightbox's widths, up to the master's 1600 px.
  assert.deepEqual(candidates.map(({ width }) => width), [360, 509, 720, 1018, 1600]);
  const server = await serve(join(site, 'dist'));
  try {
    for (const [engine, type] of ENGINES) {
      const browser = await type.launch();
      try {
        const loaded = {};
        for (const density of [1, 2]) {
          const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: density });
          const tab = await context.newPage();
          const requested = new Set();
          tab.on('request', (request) => requested.add(new URL(request.url()).pathname));
          await tab.goto(`${server.origin}/pages/garden/`);
          await tab.waitForFunction(() => { const image = document.querySelector('.kn-band-picture'); return image.complete && image.naturalWidth > 0; });
          const { band, drawn, current, elsewhere } = await tab.evaluate(() => {
            const image = document.querySelector('.kn-band-picture');
            const box = image.getBoundingClientRect();
            return {
              band: image.parentElement.getBoundingClientRect(),
              // Covering its box, as wide as the box or as its height times the picture's proportions.
              drawn: Math.max(box.width, box.height * image.naturalWidth / image.naturalHeight),
              current: new URL(image.currentSrc).pathname,
              // The same master's versions other pictures on the page draw, as the section's photo and a card's.
              elsewhere: [...document.querySelectorAll('img')].filter((other) => other !== image && other.currentSrc).map((other) => new URL(other.currentSrc).pathname),
            };
          });
          const where = `${engine} at density ${density}: drawn ${drawn} px, ${current} loaded of ${candidates.map(({ width }) => width)}`;
          // The band is taller in its proportions than the picture, so the picture is drawn wider than it, by its height.
          assert.ok(drawn > band.width * 1.2, `${where}: wider than the band, ${band.width} × ${band.height} px`);
          const chosen = candidates.find(({ url }) => url === current);
          assert.ok(chosen, where);
          // The narrowest version at least as wide as the picture is drawn at this density, which all three engines take
          // here; with the band's width alone, 100vw, they took 509 px and 1018 px, narrower than drawn.
          assert.equal(chosen, candidates.find(({ width }) => width >= drawn * density), where);
          assert.deepEqual([...requested].filter((path) => candidates.some(({ url }) => url === path) && (path === current || !elsewhere.includes(path))), [current], `${where}: no other version of it is loaded`);
          loaded[density] = chosen.width;
          t.diagnostic(`${engine}, density ${density}: drawn ${drawn} px, loaded the ${chosen.width} px version`);
          await context.close();
        }
        assert.ok(loaded[2] / loaded[1] >= 1.4 && loaded[2] / loaded[1] <= 2.9, `${engine}: ${loaded[1]} px at density 1 and ${loaded[2]} px at density 2`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
});

// A card's picture in a series of three across a band, in a site the core builds, at a phone's width and a wide window:
// a browser loads the narrowest version that covers the width the design draws it at, by the number of cards, where it
// loaded the body's, Narrow's on a wide window (issue #38).
test('in a designed site built by the core, a card\'s picture in :::cards loads the version that covers how wide its series draws it, on a phone and a wide screen, at density 1 and 2', { skip: why ?? false, timeout: 600000 }, async (t) => {
  if (!existsSync(join(site, 'dist/pages/beds/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const resolved = JSON.parse(readFileSync(join(site, 'design/site.design.json'), 'utf8')).resolved;
  const html = readFileSync(join(site, 'dist/pages/beds/index.html'), 'utf8');
  const pictures = [...html.matchAll(/<img class="kn-card-picture" ([^>]*)>/g)].map(([, attributes]) => attributes);
  assert.equal(pictures.length, 3, 'the series draws its three pictures');
  // A picture of 16:10 in a crop of 16:9 is as wide as its card.
  for (const img of pictures) assert.equal(attributeOf(img, 'sizes'), seriesPicture(resolved, 3, { ratio: 1.6 }).sizes, 'a series of three\'s sizes, in place of the body\'s');
  const candidates = candidatesOf(pictures[0]);
  // The core's body's and lightbox's widths, up to the master's 1600 px.
  assert.deepEqual(candidates.map(({ width }) => width), [360, 509, 720, 1018, 1600]);
  const server = await serve(join(site, 'dist'));
  try {
    for (const [engine, type] of ENGINES) {
      const browser = await type.launch();
      try {
        for (const [width, height] of [[390, 844], [1440, 900]]) {
          for (const density of [1, 2]) {
            const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: density });
            const tab = await context.newPage();
            const requested = new Set();
            tab.on('request', (request) => requested.add(new URL(request.url()).pathname));
            await tab.goto(`${server.origin}/pages/beds/`);
            const card = tab.locator('.kn-card-picture').first();
            await card.scrollIntoViewIfNeeded();
            await tab.waitForFunction(() => [...document.querySelectorAll('.kn-card-picture')].every((image) => image.complete && image.naturalWidth > 0));
            const { drawn, current } = await card.evaluate((image) => ({ drawn: image.getBoundingClientRect().width, current: new URL(image.currentSrc).pathname }));
            const chosen = candidates.find(({ url }) => url === current);
            const where = `${engine} at ${width} px, density ${density}: drawn ${drawn} px, ${current} loaded of ${candidates.map(({ width: w }) => w)}`;
            assert.ok(chosen, where);
            // The narrowest version at least as wide as the picture is drawn at this density, which all three engines
            // take here; with the body's sizes a wide window loaded the 720 px version, and 1600 px at density 2.
            assert.equal(chosen, candidates.find(({ width: w }) => w >= drawn * density), where);
            assert.deepEqual([...requested].filter((path) => candidates.some(({ url }) => url === path)), [current], `${where}: the three cards load that version alone`);
            t.diagnostic(`${engine}, ${width} px, density ${density}: drawn ${drawn} px, loaded the ${chosen.width} px version`);
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
});

// The pictures the package's presentations, "Read more" and an article's opening make through Astro's getImage(), in
// a site the core builds: each in the widths and with the sizes of where the design draws it (issue #39).
// Each post list on a page, its presentation and its teasers' pictures, up to the next list or the end of its section.
const listsOf = (html) => html.split('<div class="kn-post-list"').slice(1).map((chunk) => ({
  presentation: /^[^>]*data-kn-presentation="(\w+)"/.exec(chunk)[1],
  pictures: [...chunk.split('</section>')[0].matchAll(/<img class="kn-card-picture" ([^>]*)>/g)].map(([, attributes]) => attributes),
}));
// A picture of the fixture's master, 1600 px wide, has no version above it or within a tenth below it, such as 1440 px
// (issue #42).
function noNearDuplicate(img, what) {
  const widths = candidatesOf(img).map(({ width }) => width);
  assert.ok(widths.every((width) => width < 0.9 * 1600 || width === 1600), `${what}: ${widths}`);
}

test('in a designed site built by the core, each teaser\'s picture and an article opening\'s carry the widths and sizes of where the design draws them', { skip: why ?? false, timeout: 600000 }, async () => {
  if (!existsSync(join(site, 'dist/pages/journal/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const resolved = JSON.parse(readFileSync(join(site, 'design/site.design.json'), 'utf8')).resolved;
  // The master is 1600 px wide, so each picture is made in the widths asked for below 1440 px, a tenth below the master,
  // and the master's own in place of those from 1440 px up, whether or not one asked for is wider than it: the package
  // asks for them so, and the core makes them so where one is wider (its versionWidths(), ADR 0022; the owner,
  // 2026-11-26).
  const made = (widths) => (widths.every((width) => width < 0.9 * 1600) ? widths : [...widths.filter((width) => width < 0.9 * 1600), 1600]);
  // A section's featured and filtered lists, which stand at Narrow beside its form, and a lone teaser beside a quotation.
  const garden = listsOf(readFileSync(join(site, 'dist/pages/garden/index.html'), 'utf8'));
  assert.deepEqual(garden.map(({ presentation }) => presentation), ['featured', 'filtered', 'cards']);
  // A term's page, a list across a band of its own; an article's "Other articles", a list a template places in a section.
  const term = listsOf(readFileSync(join(site, 'dist/category/guides/index.html'), 'utf8'));
  const soil = readFileSync(join(site, 'dist/articles/soil/index.html'), 'utf8');
  for (const { presentation, pictures } of [...garden, ...term, ...listsOf(soil)]) {
    // Each of the master, 1600 × 1000.
    const expected = teaserPictures(resolved, presentation, pictures.length, Array(pictures.length).fill(1.6));
    assert.ok(pictures.length > 0, presentation);
    pictures.forEach((img, at) => {
      assert.equal(attributeOf(img, 'sizes'), expected[at].sizes, `${presentation} of ${pictures.length}, teaser ${at}`);
      assert.deepEqual(candidatesOf(img).map(({ width }) => width), made(expected[at].widths), `${presentation} of ${pictures.length}, teaser ${at}`);
      noNearDuplicate(img, `${presentation} of ${pictures.length}, teaser ${at}`);
    });
  }
  assert.equal(garden[2].pictures.length, 1, 'one teaser beside the quotation');
  // "Read more", a series of its related posts across a band, where a list of posts stands.
  const more = /<h2 class="kn-heading-group-heading" data-kn-type="heading-2">Read more<\/h2>[\s\S]*?<\/section>/.exec(soil)[0];
  const related = [...more.matchAll(/<img class="kn-card-picture" ([^>]*)>/g)].map(([, attributes]) => attributes);
  assert.ok(related.length > 0);
  for (const img of related) assert.equal(attributeOf(img, 'sizes'), seriesPicture(resolved, related.length, { list: true, ratio: 1.6 }).sizes);
  // The opening's main image behind its text, as the default design puts it, across the band and as tall as the hero, by
  // the picture's proportions, 1600 × 1000.
  const opening = /<section class="kn-band kn-hero kn-article-opening"[\s\S]*?<img class="kn-band-picture" ([^>]*)><\/section>/.exec(soil)?.[1];
  assert.ok(opening, 'the opening draws its main image behind its text');
  const hero = heroPictureOf(resolved, { ratio: 1.6 });
  assert.equal(attributeOf(opening, 'sizes'), hero.sizes);
  assert.equal(hero.sizes, 'max(100vw, 80vh)');
  assert.deepEqual(candidatesOf(opening).map(({ width }) => width), made(hero.widths));
  noNearDuplicate(opening, 'the opening');
});

// A teaser card's picture in a list of three across a band, at a phone's width and a wide window: a browser loads the
// narrowest version that covers the width the design draws it at, where the hand-set sizes loaded wider (issue #39).
test('in a designed site built by the core, a teaser card\'s picture loads the version that covers how wide it is drawn, on a phone and a wide screen, at density 1 and 2', { skip: why ?? false, timeout: 600000 }, async (t) => {
  if (!existsSync(join(site, 'dist/pages/journal/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const resolved = JSON.parse(readFileSync(join(site, 'design/site.design.json'), 'utf8')).resolved;
  const [list] = listsOf(readFileSync(join(site, 'dist/pages/journal/index.html'), 'utf8'));
  assert.equal(list.pictures.length, 3, 'the list draws three teasers');
  for (const img of list.pictures) assert.equal(attributeOf(img, 'sizes'), teaserPictures(resolved, 'cards', 3, [1.6, 1.6, 1.6])[0].sizes);
  const candidates = candidatesOf(list.pictures[0]);
  // The ladder's steps from the one that covers it on the narrowest window to the one that covers it at its widest on a
  // dense screen, 1440 px, which is within a tenth below the 1600 px master, so made at the master's width instead.
  assert.deepEqual(candidates.map(({ width }) => width), [360, 509, 720, 1018, 1600]);
  const server = await serve(join(site, 'dist'));
  try {
    for (const [engine, type] of ENGINES) {
      const browser = await type.launch();
      try {
        for (const [width, height] of [[390, 844], [1440, 900]]) {
          for (const density of [1, 2]) {
            const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: density });
            const tab = await context.newPage();
            const requested = new Set();
            tab.on('request', (request) => requested.add(new URL(request.url()).pathname));
            await tab.goto(`${server.origin}/pages/journal/`);
            const card = tab.locator('.kn-card-picture').first();
            await card.scrollIntoViewIfNeeded();
            await tab.waitForFunction(() => [...document.querySelectorAll('.kn-card-picture')].every((image) => image.complete && image.naturalWidth > 0));
            const { drawn, current } = await card.evaluate((image) => ({ drawn: image.getBoundingClientRect().width, current: new URL(image.currentSrc).pathname }));
            const chosen = candidates.find(({ url }) => url === current);
            const where = `${engine} at ${width} px, density ${density}: drawn ${drawn} px, ${current} loaded of ${candidates.map(({ width: w }) => w)}`;
            assert.ok(chosen, where);
            // The narrowest version at least as wide as the picture is drawn at this density.
            assert.equal(chosen, candidates.find(({ width: w }) => w >= drawn * density), where);
            assert.deepEqual([...requested].filter((path) => candidates.some(({ url }) => url === path)), [current], `${where}: the three teasers load that version alone`);
            t.diagnostic(`${engine}, ${width} px, density ${density}: drawn ${drawn} px, loaded the ${chosen.width} px version`);
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
});

// A WebP's width and height, from its first chunk: lossy, lossless or extended.
function webpSize(bytes) {
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  throw new Error(`not a WebP: ${chunk}`);
}

// A picture an article shows in its body and a list shows as its teaser, the same master, is made once at each width
// the two share: the teaser's widths are the body's ladder, and Astro names a version by the options it is made with,
// which the core's image service makes the same for both, WebP at the core's quality (issue #39).
test('in a designed site built by the core, a picture shown both in an article\'s body and as its teaser is made once at each width the two share', { skip: why ?? false, timeout: 600000 }, async () => {
  if (!existsSync(join(site, 'dist/pages/journal/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const body = /<div class="kn-reading-area-flow kn-body-text">[\s\S]*?<figure><button class="konzilo-lightbox-open"[^>]*><img ([^>]*)>/.exec(readFileSync(join(site, 'dist/articles/water/index.html'), 'utf8'))?.[1];
  assert.ok(body, 'the article\'s body draws its picture');
  const teaser = /<article class="kn-card"[^>]*><img class="kn-card-picture" ([^>]*)>(?:(?!<\/article>)[\s\S])*href="\/articles\/water\/"/.exec(readFileSync(join(site, 'dist/pages/journal/index.html'), 'utf8'))?.[1];
  assert.ok(teaser, 'the list draws the article\'s teaser with its picture');
  const [inBody, asTeaser] = [body, teaser].map((img) => new Map(candidatesOf(img).map(({ width, url }) => [width, url])));
  // The body's are the body's and the lightbox's widths, up to the master's 1600 px in place of 1440 and those wider; the
  // teaser's go up to 1440, which is within a tenth below the master, so it asks for the master's 1600 px in its place,
  // as the body's does (the owner, 2026-11-26), and shares every version it has.
  const shared = [...asTeaser.keys()].filter((width) => inBody.has(width));
  assert.deepEqual([[...inBody.keys()], [...asTeaser.keys()]], [[360, 509, 720, 1018, 1600], [360, 509, 720, 1018, 1600]]);
  assert.deepEqual(shared, [...asTeaser.keys()]);
  noNearDuplicate(teaser, 'the teaser');
  // The build's files of the master, by their size: each version of the whole picture, 1600 × 1000, once.
  const assets = join(site, 'dist/_astro');
  const files = readdirSync(assets).filter((name) => name.startsWith(PICTURE.replace(/\.webp$/, '')) && name.endsWith('.webp'));
  const whole = files.map((name) => ({ name, ...webpSize(readFileSync(join(assets, name))) })).filter(({ width, height }) => Math.abs(height - width * 1000 / 1600) <= 1);
  for (const width of shared) {
    assert.equal(inBody.get(width), asTeaser.get(width), `${width} px: one address`);
    assert.deepEqual(whole.filter((file) => file.width === width).map(({ name }) => `/_astro/${name}`), [inBody.get(width)], `${width} px: one file, ${whole.map(({ name, width: w }) => `${name} ${w}`).join(', ')}`);
  }
});

// The design crops a gallery's pictures to 4:3, so it names the ratio, and the core makes each version of the crop alone
// around the picture's focal point, while the lightbox shows the whole picture (the core's ADR 0022).
test('in a designed site built by the core, a gallery\'s pictures are versions of their crop to the design\'s ratio, and its lightbox shows them whole', { skip: why ?? false, timeout: 600000 }, async () => {
  if (!existsSync(join(site, 'dist/articles/seeds/index.html'))) {
    const built = await build('dist');
    assert.equal(built.status, 0, built.output);
  }
  const { gallery, lightbox } = imageContexts(JSON.parse(readFileSync(join(site, 'design/site.design.json'), 'utf8')).resolved);
  const html = readFileSync(join(site, 'dist/articles/seeds/index.html'), 'utf8').replaceAll('&gt;', '>').replaceAll('&lt;', '<');
  const figure = /<figure class="konzilo-gallery">[\s\S]*?<\/figure>\s*<dialog/.exec(html)?.[0];
  assert.ok(figure, 'the article\'s body draws its gallery');
  assert.doesNotMatch(figure, /data-konzilo-whole/, 'the hidden whole picture is the lightbox\'s, out of the gallery\'s figures');
  const widths = (srcset) => srcset.split(', ').map((candidate) => Number(candidate.trim().split(/\s+/)[1].slice(0, -1)));
  const shown = [...figure.matchAll(/<img ([^>]*?)>/g)].map(([, attributes]) => attributes);
  assert.equal(shown.length, 2);
  for (const attributes of shown) {
    assert.equal(/\bsizes="([^"]*)"/.exec(attributes)[1], gallery.sizes);
    // The 1600 × 1000 master cropped to 4:3 is 1333 × 1000, wider than every width the gallery asks for.
    assert.deepEqual(widths(/\bsrcset="([^"]*)"/.exec(attributes)[1]), gallery.widths);
    // Its size its widest version's, 1018 × 764, 4:3 to the pixel.
    assert.ok(Math.abs(Number(/\bwidth="(\d+)"/.exec(attributes)[1]) / Number(/\bheight="(\d+)"/.exec(attributes)[1]) - 4 / 3) < 0.005, attributes);
  }
  const dialog = /<dialog class="konzilo-modal konzilo-lightbox"[\s\S]*?<\/dialog>/.exec(html.slice(html.indexOf(figure) + figure.length - '<dialog'.length))[0];
  for (const [, attributes] of dialog.matchAll(/<img ([^>]*?)>/g)) {
    assert.deepEqual(widths(/\bsrcset="([^"]*)"/.exec(attributes)[1]), [...lightbox.widths.filter((width) => width < 1440), 1600], 'the whole picture, up to its master');
    assert.ok(Math.abs(Number(/\bwidth="(\d+)"/.exec(attributes)[1]) / Number(/\bheight="(\d+)"/.exec(attributes)[1]) - 1.6) < 0.005, attributes);
  }
});
