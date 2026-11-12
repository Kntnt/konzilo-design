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
import { defaultInputs, resolve as resolveDesign, DESIGN_FORMAT } from '../src/generator/index.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const core = process.env.KONZILO_CORE ? resolve(process.env.KONZILO_CORE.replace(/^~(?=\/)/, process.env.HOME ?? '~')) : null;
const why = !core ? 'set KONZILO_CORE to a checkout of the Konzilo core with its packages installed to build a site with it'
  : !existsSync(join(core, 'node_modules/astro/bin/astro.mjs')) ? `${core} holds no installed core: run npm install there` : null;

const md = String.raw;
// The core's package, by the name a site imports it by, put together so that this file is not taken for an import of it.
const CORE = ['@kntnt', 'konzilo'].join('/');
const ELEMENTS = ['paragraph', 'heading', 'list', 'image', 'gallery', 'post-list', 'form', 'hero', 'section', 'aside', 'list-directive', 'cards', 'accordion', 'tabs', 'toc', 'choice', 'eyebrow', 'small', 'breadcrumbs'];
const description = {
  language: 'en_GB',
  componentsFrom: '@kntnt/konzilo-design/directives/components.json',
  componentChecks: '@kntnt/konzilo-design/directives/checks',
  types: {
    page: { collection: 'pages', hierarchical: true, address: '/pages/{path}/', elements: ELEMENTS },
    article: { collection: 'articles', address: '/articles/{slug}/', elements: ['paragraph', 'heading', 'list', 'aside'] },
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

// A page with no hero, as a legal page is written: its blocks loose at the top.
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

![Raised beds](../media/${PICTURE})

::::

::::::section{surface="raised" anchor="plans"}

![A shed](../media/${PICTURE})

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

:::::`;

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
    "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>{entry.data.headline}</title></head><body><main><ArticleOpening entry={entry} metaLine={await metaLine(entry, Astro.url)} topics={topics} /><ArticleBody><Body post={entry}><Content /></Body></ArticleBody><ReadMore posts={await relatedPosts(entry)} more={{ label: 'More articles', href: '/articles/' }} surface=\"raised\" /></main></body></html>",
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
    '<html lang="en"><head><meta charset="utf-8"><title>Search</title></head><body><main><TitleBand /><PageBody title={false}><ReadingArea side="end"><Search /></ReadingArea></PageBody></main></body></html>',
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
    "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>{term.data.name}</title></head><body><main><TermOpening term={term} surface=\"tint\" /><PageBody title={false}><Filtered posts={posts} pager={pager} empty={empty} options={{ filters: 'category topics search' }} settled={{ taxonomy, term: term.id }} /></PageBody></main></body></html>",
    '',
  ].join('\n'));
  mkdirSync(join(site, 'content/media'), { recursive: true });
  copyFileSync(join(core, 'site-template/demo-content/media/every-element-898a545757.webp'), join(site, 'content/media', PICTURE));
  write('content/pages/garden.md', page('Planning a garden', GARDEN));
  write('content/pages/legal.md', page('What we keep about you', LEGAL));
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
    article('water', { headline: 'Water early', category: 'news', topics: ['water'], day: '03' }),
    article('seeds', { headline: 'Seeds that last', category: 'news', topics: ['soil'], day: '02' }),
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
    return resolveDesign(inputs).then((resolved) => {
      writeFileSync(designFile, JSON.stringify({ format: DESIGN_FORMAT, inputs, project: { name: 'Example Gardens' }, resolved }));
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
  // The hero: the post's title, the eyebrow, deck, actions, small print and the picture behind, as the default design
  // has it; no trail, since a page right under the start page, its own level hidden, has none to show.
  assert.match(html, /^<section class="kn-band kn-hero" data-kn-surface="picture-dark"[^>]* style="--kn-picture-image:url\(&quot;\/_astro\/[^&]+\.webp&quot;\)"><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">A guide<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">Start small/s);
  assert.match(html, /<ul class="kn-actions" role="list"><li><a class="kn-action" href="\/pages\/garden\/" data-kn-main>Get started<\/a><\/li>/);
  // The core's image service made the pictures, and the components keep what it wrote.
  assert.match(html, /<img class="kn-section-picture" src="\/_astro\/[^"]+\.webp" alt="A shed"[^>]* width="\d+" height="\d+"/);
  // The section of plans: its head drawn from the tree, cards and tabs in its body.
  const plans = /<section class="kn-band kn-section" id="plans" data-kn-surface="raised">[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(plans, /<header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Plans<\/p><h2 class="kn-heading-group-heading" data-kn-type="heading-2" id="our-plans">Our plans<\/h2><p class="kn-heading-group-deck" data-kn-type="lead" data-kn-deck="long">/);
  assert.match(plans, /<div class="kn-section-body kn-body-text"><div class="kn-card-grid kn-cards"><article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture"[^>]*alt="A balcony"[^>]*><h3 class="kn-card-heading" data-kn-type="heading-5" id="small"><a class="kn-card-link" href="\/pages\/garden\/">Small<\/a><\/h3>/);
  assert.match(plans, /data-kn-contact="email">hello@<wbr>gardens<wbr>\.example<\/a>/);
  assert.match(plans, /<div class="kn-tabs" role="group" aria-labelledby="tabs-1">.*<h3 id="seeds">Seeds<\/h3>.*<dl class="kn-value-list">/s);
  // The latest: the presentations and the core's form in the section's body, each where it was written.
  const latest = /<section class="kn-band kn-section" id="latest">[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(latest, /<header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Latest<\/p><h2[^>]*>From the journal<\/h2><\/hgroup><\/header><div class="kn-section-body kn-body-text"><div class="kn-post-list" data-kn-presentation="featured"><div class="kn-featured"><article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture" src="\/_astro\/[^"]+" srcset="[^"]+"[^>]*><p class="kn-card-eyebrow" data-kn-type="label">Guides<\/p><h3 class="kn-card-heading" data-kn-type="heading-3"><a class="kn-card-link" href="\/articles\/soil\/">Know your soil<\/a><\/h3><p class="kn-card-text" data-kn-type="small">All about soil\.<\/p>/);
  assert.match(latest, /<div class="kn-post-list" data-kn-presentation="filtered"><form class="kn-visitor-filters" role="search" method="get" action="\/search\/"><div class="kn-visitor-filter-panel"><fieldset class="kn-visitor-filter-group"><legend>Category<\/legend>.*value="news".*<legend>Topic<\/legend>.*value="soil"/s);
  assert.match(latest, /<\/div><\/div>\s*<form class="konzilo-form[^"]*"[\s\S]*<\/form>\s*<p class="kn-fine-print" data-kn-type="small">We answer within a day\.<\/p><\/div><\/div><\/section>$/);
  // A page below it has its trail first in its hero, from the core's levels.
  assert.match(main(built.page('pages/garden/tools')), /^<section class="kn-band kn-hero"[^>]*><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><nav class="kn-breadcrumbs" aria-label="Breadcrumb" data-kn-type="small"[^>]* data-kn-current="false"[^>]*><ol role="list"><li><a href="\/">.*<span class="kn-breadcrumbs-label">[^<]+<\/span><\/a><\/li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"><\/span><a href="\/pages\/garden\/"><span class="kn-breadcrumbs-label">Planning a garden<\/span><\/a><\/li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"><\/span><span aria-current="page">Tools for a garden<\/span><\/li><\/ol><\/nav><hgroup/s);
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
  assert.match(main(built.page('pages/legal')), /^<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h1 class="kn-heading-group-heading" data-kn-type="heading-1">What we keep about you<\/h1><\/hgroup><\/header><\/div><\/section>\s*<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" id="what-we-keep" data-kn-type="heading-2">What we keep<\/h2><\/hgroup><\/header><div class="kn-section-body kn-body-text"><p>What you write in a form/);
  // An article: its opening with the core's meta line, its body with its following menu and question, and Read more.
  const soil = main(built.page('articles/soil'));
  assert.match(soil, /^<section class="kn-band kn-hero kn-article-opening" data-kn-surface="picture-dark"[^>]*><div class="kn-band-content kn-hero-content"><div class="kn-hero-text"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Guides<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Know your soil<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">All about soil\.<\/p><\/hgroup><p class="kn-article-meta" data-kn-type="small"><span class="kn-article-line">By <span class="kn-article-byline">A\. Writer<\/span> • Published <time class="kn-article-date" datetime="2026-10-05T08:00:00\.000Z">5 October 2026<\/time> in <a class="kn-article-category" href="\/category\/guides\/">Guides<\/a><\/span><span class="kn-article-topics"><a class="kn-pill" href="\/topic\/soil\/">Soil<\/a><\/span><\/p>/);
  assert.match(soil, /<ol role="list"><li><a href="#what-lies-below">What lies below<\/a><\/li><li><a href="#in-short">In short<\/a><\/li><li><a href="#planting">Planting<\/a><\/li><\/ol>/);
  assert.match(soil, /<p class="kn-question"><strong>What did you find\?<\/strong><\/p>/);
  assert.match(soil, /<section class="kn-band kn-section" data-kn-surface="raised">.*<h2 class="kn-heading-group-heading" data-kn-type="heading-2">Read more<\/h2>.*<article class="kn-card" data-kn-surface="page">.*href="\/articles\/tools\/".*<a class="kn-action" href="\/articles\/" data-kn-main>More articles<\/a>/s);
  // The search page: its title band, then the core's search in a Reading Area in a section.
  assert.match(main(built.page('search')), /^<section class="kn-band kn-section"><div class="kn-band-content"><header class="kn-section-head"><nav class="kn-breadcrumbs".*<h1 class="kn-heading-group-heading" data-kn-type="heading-1">Search<\/h1>.*<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><div class="kn-reading-area" data-kn-side="end" data-kn-stack="before"><div class="kn-reading-area-flow"><div class="konzilo-search"/s);
  // The 404 page: the chosen page's title as its H1 and its body as a section.
  assert.match(main(readFileSync(join(site, 'dist/404.html'), 'utf8')), /<h1 class="kn-heading-group-heading" data-kn-type="heading-1">This page is not here<\/h1>.*<div class="kn-section-body kn-body-text"><p>Try the <a href="\/pages\/garden\/">start page<\/a>\.<\/p>/s);
  // A term's page calls the presentation itself, the row it settles left out and kept with a search.
  const term = main(built.page('category/guides'));
  assert.match(term, /^<section class="kn-band kn-section" data-kn-surface="tint"><div class="kn-band-content"><header class="kn-section-head"><nav class="kn-breadcrumbs".*<p class="kn-heading-group-eyebrow" data-kn-type="label">Category<\/p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Guides<\/h1><p class="kn-heading-group-deck" data-kn-type="lead">On guides\.<\/p>/s);
  assert.match(term, /<div class="kn-section-body kn-body-text"><div class="kn-post-list" data-kn-presentation="filtered"><form class="kn-visitor-filters" role="search" method="get" action="\/search\/"><input type="hidden" name="type" value="article"><input type="hidden" name="category" value="guides"><div class="kn-visitor-filter-panel"><fieldset class="kn-visitor-filter-group"><legend>Topic<\/legend>/);
});

test('in the core\'s live preview every part keeps its block\'s mark, and a section still finds its body', { skip: why ?? false, timeout: 600000 }, async () => {
  const built = await build('preview', { KONZILO_PREVIEW: '1' });
  assert.equal(built.status, 0, built.output);
  const html = main(built.page('pages/garden'));
  assert.match(html, /^<section data-konzilo-block="0" class="kn-band kn-hero"/);
  assert.match(html, /<section data-konzilo-block="1" class="kn-band kn-section" id="plans"/);
  assert.match(html, /<div class="kn-section-body kn-body-text"><div data-konzilo-block="1\.4" class="kn-card-grid kn-cards">/);
  assert.match(html, /<div data-konzilo-block="2\.2" class="kn-post-list" data-kn-presentation="featured">/);
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
  assert.match(reasons('::::section{surface="green"}\n\nWords.\n\n::::').join(), /A section stands on page, raised, inverse, tint, brand or accent, not on green\./);
});
