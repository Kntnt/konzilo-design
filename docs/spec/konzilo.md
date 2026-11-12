read when working on how a Konzilo site consumes this package: `fromDesign`, `konzilo.css`, `design-props`, the design file's format, the fonts and logos commands or the tarball

# How a Konzilo site takes its design

Records the contract between this package, a Konzilo site and the Konzilo core, as the owner and the two sessions agreed it, and how a site follows it.

## The seam

A site depends on this package, and the core depends on neither. A site writes, in its `astro.config.mjs`:

```js
konzilo({ ...await fromDesign('./design/site.design.json'), directives: { ...DESIGN_DIRECTIVES, … }, presentations: { ...DESIGN_PRESENTATIONS }, ... })
```

Nothing in this repository imports `@kntnt/konzilo`, and a test holds that. The core never reads a design file: `fromDesign` turns one into the options the core's integration already takes, and the package's components and presentations take what the core hands them, as props, a tree and a slot, and the page's context the site's templates give (directives.md, The components).

***Decided* by the owner, 2026-11-05:**

- **Format version.** A design file carries a required top-level integer, `"format": 1`, raised only when the file's shape breaks.
- **Works without a design file.** A site without one never calls `fromDesign`, and has the core's own defaults.
- **The public site, not the editor.** The design styles the public site. It does not style Sveltia's interface.
- **A tarball in the site's repository, with the fonts copied separately.** The owner reckoned on about 1 MB for a version upgrade. The tarball measures 0.14 MB, and the fonts a design uses, about 0.3 MB a file, change only when the design does.

## Who owns what

| Who | What |
|---|---|
| The core | The markup and the behaviour of consent, embeds, forms, search, the pager and the lightbox, and the stylesheet that makes the lightbox work (`modal.css`). Its `docs/site-design.md` lists every class, state and custom property a design can count on. |
| This package | How all of that looks (`konzilo.css`), the generated core CSS, the body text styles, the components of the frame, turning a design into props (`design-props`), and the components that draw the directives and the presentations of post lists, with the directives' declarations and checks (directives.md, The components; the core's ADR 0068). |
| The site | Its design file, its fonts and logos folders, its layout, which places the core's components in this package's slots, its templates, which give the page's context, and whatever only it knows: its menus, its pictures, its trail's levels, its words in its own languages, and which presentations its description declares, since the core refuses a component the description does not declare. |

The library's own Field, Form, ConsentBanner, Embed and Pagination are for sites outside Konzilo. On a Konzilo site the core writes those, and `konzilo.css` gives them the same look.

## The three versions

| Version | Where | What it says | Who changes it |
|---|---|---|---|
| `format` | The file's top level | How to read the file. `DESIGN_FORMAT` in the generator, and the schema holds the number. | This repository, only when the shape breaks |
| `project.version` | The file's `project` | A client's review version of the presentation, such as `1.0` or `2.4-review` | Whoever sends a client the presentation |
| `resolved.generator-version` | The file's `resolved` | Which version of this package made the values. A change of it alone invalidates nothing. | Written at every resolve |

`check`, `css`, `fromDesign` and `fonts` refuse a missing or newer format, in words naming both numbers and what to do. `resolve`, the tool's save and a new design write the format, and the tool opens a file without one and fills it in at its next save, as it does for defaults. `resolve`, the tool, the presentation and `design-md` refuse a newer one too.

## `fromDesign(path, options)`

`@kntnt/konzilo-design/konzilo`. Asynchronous, and it runs when Astro loads the config.

- `path` is the design file, from the site's root. `options.root` is the root, the working directory by default; `options.fonts` is the font folder, `fonts` beside the design file by default; `options.logos` is the logos' folder, from the root, `./public/logos` by default.
- It checks the format, the fingerprint, the schema and the contrast, and refuses in plain words. It also refuses if a font the design uses is missing, or the file of a logo the design has, naming the command.
- It writes the generated core CSS to `node_modules/.cache/konzilo-design/<name>.core.css`, only when that changes. Astro's dev server does not watch it: restart it after changing the design.

It returns only these two:

- `bodyStyles`, in the core's form, where `./…` is a path from the site's root and anything else a package's stylesheet by name:
  1. `./node_modules/.cache/konzilo-design/<name>.core.css`, the generated core
  2. `@kntnt/konzilo-design/body-styles.css`, the reset, the body text and tables
  3. `@kntnt/konzilo-design/konzilo.css`, the look of what the core writes
  4. `./design/fonts/fonts.css`, the design's typefaces, where it uses any of the library's
- `tokens`: `{ colors: { primary: '--kn-theme-primary', base: '--kn-theme-base' } }`. The core reads a token from `:root` or `html`, outside any conditional rule, and its `opaqueColor()` cannot read `light-dark()`, so `coreCss` writes these two as literals: the primary brand seed exactly, and the light page colour.

It does not return `directives` or `presentations`, which a site spreads from `DESIGN_DIRECTIVES` and `DESIGN_PRESENTATIONS` beside its own and takes only as its description declares them, or `bodyClass`, which does not exist yet.

## `konzilo.css`

`@kntnt/konzilo-design/konzilo.css`. It uses the roles of the Surface a thing stands on, so it works in both modes, and a site's unlayered CSS overrides it. It also styles what the core's reader writes into a body with no class of its own: figures, galleries, code blocks with their `--astro-code-*` colours, task lists and footnotes. `:root` gets `--konzilo-lightbox-overlay`, `--konzilo-lightbox-text` and `--konzilo-lightbox-control`.

Its rules on the core's classes stand in a layer of their own, `kn-konzilo`, after `kn-components`. A form, a pager or a list of results stands in body text, whose rules are as strong as these, and a site's stylesheets do not reach a page in a set order: on a real build `components.css` comes after `konzilo.css`, which gave a pager the body's underlined links. Its rules on what the reader writes with no class stand in `kn-components`, below any rule with a class.

`test/fixtures/konzilo-page.html` is what the core really writes, fragments of a built site from its template with made-up content, and the tests also hold it against this library's own Form, Field, ConsentBanner, Embed and Pagination, property by property. Search's and a preview's states are in it too. The core writes no `:disabled` field: in a preview only its button is disabled.

**The lightbox** stands inside a body's wrapper, so the rules of `.kn-body-text` and the reset reach into it. The core's `modal.css` has no layer, so it beats every rule of this library on what it names: the margins and padding of its list, items, figure and words, the colour and size of its words, and the size of its image and buttons. `konzilo.css` takes back what it does not name: a link's colour and focus ring in a caption, inline code's fill and an image's corners. It also gives the button round an image on the page, which opens the lightbox, the design's focus colour as its own, since `modal.css` rings it in `currentcolor` and it holds nothing else, so its ring is the design's (fixed after 0.6.1; it was the browser's button text, black on a dark Surface). A gallery's crop on the page does not reach the dialog, which stands beside the gallery and not in it.

## Dark mode

The generated CSS is light until an element asks for dark: `data-kn-mode="dark"` turns that element and everything in it to dark mode, and `data-kn-mode="light"` turns a part of it back (names.md, Surface kinds and local mode). Without the attribute a page is light. The operating system's light or dark preference changes nothing by itself, since no attribute means inherit the selected mode, not follow the operating system.

Which modes a site uses is the site's choice, not this package's (owner, 2026-11-10): light only, dark only, or both, and with both, whether it follows the visitor's system or offers a switch. Neither the core nor this package writes the attribute, so the site does: for a dark site its layout writes `<html lang={…} data-kn-mode="dark">`, and a site that lets the mode change sets the attribute on `<html>` itself, by a script of its own that runs before the page paints. `brand` and `inverse` stay dark in both modes, and the header's and the footer's logos follow the mode they stand in. `--kn-theme-base`, which the core gives the browser's frame, stays the light page colour, since the core reads one colour.

## The footer

Nothing to import. A site's layout places the core's controls in this package's Footer, whose named slots exist for this:

```astro
<Footer {...footerFromDesign(design.resolved.footer, content)}>
  <ConsentControls slot="lower-a2" buttons={false} />
  <ConsentControls slot="lower-b2" links={false} />
</Footer>
```

A slot's content takes its cell's alignment, at the start in column A and the end in column B, its text at the end there too where the design sets `footer.b-align` to `end`, and all at the start on a narrow screen, where the upper band stacks column by column and the lower band row by row, so `lower-a2` and `lower-b2` follow each other there (footer.md), and `konzilo.css` makes it look like the cell's links: the same size and colour, the same separators, after each link where column B's text is at the end, and buttons that read as links. A cell filled by a slot must be on in the design and have no content of its own in `content`. A cell that is off stays empty, whatever its slot holds.

## The header and the footer in the browser

The panels, the stickiness, the appearances, the reveal and the edges are HTML and CSS (header.md and footer.md, How it is built). Since 2026-11-11 two small scripts measure, by the owner's choice of a script over duplicated markup: `header-fit.js` for giving way and `footer-fit.js` for whether a footer at the edge of the screen fits. A site imports nothing for them, and a layout that called `setupHeaders` or `setupFooters` must drop those calls; `footerFromDesign`, `footerSpans` and `layoutFooter` stay where they were.

What the Header writes for the browser (the assistant's choices, 2026-11-10):

- Every header writes its bar once, with `data-kn-steps` listing the giving-way steps it can take, and as its last element but the polyfill loaders `<script data-kn-header-fit>…</script>`: `header-fit.js` inline, a classic script without its comments (about 2.1 kB, its text the same in every header of a build, so the core's hashes allow it). It writes `data-kn-step` (`none`, a step's name or `scale`) on its own header before the page first paints; as a module it ran after the first paint, and a wide page showed its narrowest step first. Without it the bar shows its narrowest step, the identity and the menu button. A site that renders a header without Header.astro should write `components/header-fit.js` inline right after the header, for the same reason. A logo image should carry `width` and `height`, or the bar can take one more step when the image loads. A sticky header also writes one inline loader inside the header that imports `scroll-timeline-polyfill.js` only where `CSS.supports('animation-timeline: scroll()')` is false or, since 0.6.1, where a short test finds that the browser's style queries miss what an animation sets, as Firefox's do (header.md, How it is built); the test builds its two elements in a shadow tree with a constructed stylesheet, which the core's policy on inline styles does not govern, and removes them at once. One that slides away writes a second, one line, for `scroll-state-polyfill.js`, only where `CSS.supports('container-type: scroll-state')` is false. Astro's build emits each as a file of its own in `_astro/`, never inlined. A loader's text is fixed for a build, so the core's policy, which takes the SHA-256 of every inline script, allows it, and each file is a script from the site itself.
- The bar is written once (2026-11-11): the hidden giving-way copies are gone, so a site queries the header's parts as they are.
- The rows above and below the megamenu hold what the layout gives Header in its `menu-above` and `menu-below` slots, and show only where the design has them on, since `headerProps` passes the design's `menu-above` and `menu-below` (2026-11-11). A layout with nothing for a row leaves its slot out and the design turns the row off; one that gives a row a slot while the design has it off shows nothing there.
- The megamenu and the search box as `<dialog>`s and the language list as a popover, opened by `commandfor`, `command` and `popovertarget`; a CTA with `dialog` and no `href` opens its dialog the same way, so the site's dialog needs no script either.
- A footer with `attachment="reveal"` writes its bands once and, last inside it, a loader for the scroll timelines' polyfill, which imports it only where `CSS.supports('animation-timeline: scroll()')` is false (since 0.6.0, for the page's shadow over it; since 0.6.1 the page's edge reads no flag where the browser has scroll timelines, so it needs no test of style queries), and `<script type="module" src="…/footer-fit.js" data-kn-footer-fit>`, which writes `data-kn-fit="true"` or `"false"` on the footer; the reveal applies only while it is `true`. Any other footer writes no script. Slot content needs no care beyond what any footer needs.
- The core's CSS gives a header over the page's start the first band's Surface roles while it is clear, by rules that name no class: the page is the element with a Surface that holds a `main` and the header, the only element with `data-kn-start`.

## Fonts and the tarball

`konzilo-design fonts <file> [-o <folder>]` copies the typefaces the design uses, upright and italic, into the folder, `fonts` beside the design file by default. Beside them go their licences, which must travel with them, and `fonts.css` with their `@font-face` rules in relative addresses. It removes a font of the library's that the design no longer uses, and nothing else. It runs from this repository, where the fonts are.

`package.json` `files` makes `npm pack` hold what a site needs: the generator and schema, the CSS, the components, `konzilo`, the command and the font catalogue. It leaves out the fonts, the tool, the presentation, the gallery and the tests, so `tool`, `presentation`, `design-md` and `fonts` say plainly there that they run from the repository. `private: true` stays, and does not stop `npm pack`. `exports` holds only what the tarball holds.

## Logos

***Decided* with the core's session, 2026-11-05:** logos work as fonts do. The core's content security policy stays as it is, `img-src 'self'`, and never allows an image at a `data:` address, while a served file is allowed. The design file goes on holding its logos as data URIs or paths relative to itself, which is what the tool and the presentation use. *(Corrected 2026-11-12: the core's policy has since allowed an image at a `data:` address unless a site turns `security.dataImages` off, the core's ADR 0051; a logo is still a served file, which holds either way.)*

`konzilo-design logos <file> [-o <folder>]` writes `project.logo` and `project['logo-dark']` as `logo.<ext>` and `logo-dark.<ext>`, the extension from the data URI's type or the path's own, into the folder, `./public/logos` by default. It removes a logo the design no longer has, or has in another type, and nothing else. It needs nothing but the design file, so unlike `fonts` it also runs from the package a site installs.

`logoAddresses(project, { base, folder })` in `design-props` gives the addresses they are served at, `{ light, dark }`, so a layout needs no guessing. `base` is the site's base, and `folder` the folder below it, `logos` by default, for a site that also gives `fromDesign` another `logos`. `identityProps` and `headerProps` take the result as `logos`, and `footerBrand` as `logo`. Without `logos` they use what the design file holds, as the tool and the presentation do.

## The menu

The core gives a menu as plain data, entries of `{ title, url, items }`, and its entries carry no mark of the current page. `menuProps(entries, { current, base, linkMenu })` in `design-props` turns them into Header's `{ label, href, children, current, linkMenu }`, and imports nothing of the core's.

- `current` is the page's address, `Astro.url.pathname`, and marks the entry at that address alone, not those above it. A trailing slash makes no difference.
- `base` is the site's base, which an address on the site starts at, so that it stays in a preview.
- `linkMenu(entry, index)` says which top entries stand in the link menu, all by default. An entry with no address only holds others and never stands there.
- Header's `children` are one level, so lower entries follow theirs in order, and a child with no address gives way to the entries it holds.

The design file's `project.menu` and `project.footer` are a client's own menu and footer words for the design tool's preview and the presentation, so the client sees the content agreed (tool.md, The client's own menu and footer). They are not design: `fromDesign`, `design-props` and the CSS read neither, they never enter the fingerprint, and a site's menus and footer come from the site, as here.

## How a site takes its design

This starts from the core's site template, as `bin/new-site` makes it, in a folder here called `my-site`.

From this repository, for each version, and then for each design. The tool creates the design file at the first change saved:

```bash
mkdir -p ~/Projects/my-site/vendor
npm pack --pack-destination ~/Projects/my-site/vendor
bin/design-tool ~/Projects/my-site/design/site.design.json
node bin/konzilo-design.js fonts ~/Projects/my-site/design/site.design.json
```

In the site, with the tarball, the design file and the fonts and logos folders committed:

```bash
npm install ./vendor/kntnt-konzilo-design-<version>.tgz
npx konzilo-design logos design/site.design.json
rm -r src/styles
```

**The template's stylesheets go,** with their imports in `src/layouts/Site.astro`, `src/components/List.astro`, `Cards.astro` and `Form.astro`. They have no layer, so they would beat `konzilo.css`, and they read custom properties nothing declares any more: a form's fields lose their borders and its button its fill. What the template's own classes looked like goes with them (What a site needs, below).

In its configuration, `fromDesign` takes the place of `bodyStyles` and `tokens`, and the rest stays:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import konzilo from '@kntnt/konzilo/astro';
import { DESIGN_DIRECTIVES, DESIGN_PRESENTATIONS, fromDesign } from '@kntnt/konzilo-design/konzilo';

// Every page is built for the site's public host, which the build's environment names.
process.env.KONZILO_ORIGIN ??= 'http://localhost:4321';

export default defineConfig({
  integrations: [konzilo({
    ...await fromDesign('./design/site.design.json'),
    // The package's components for its directives, and the site's own form, which the core draws.
    directives: { ...DESIGN_DIRECTIVES, form: './src/components/Form.astro' },
    // Each presentation the site description declares, and no other: the core refuses either way round.
    presentations: { ...DESIGN_PRESENTATIONS },
    searchPage: './src/components/SearchPage.astro',
    termPage: './src/components/TermPage.astro',
  })],
  markdown: { shikiConfig: { theme: 'css-variables' } },   // Code blocks take their colours from konzilo.css.
  devToolbar: { enabled: false },
});
```

Its layout:

```astro
---
// src/layouts/Site.astro
import design from '../../design/site.design.json';
import { publicSite } from '@kntnt/konzilo/astro';
import Head from '@kntnt/konzilo/astro/Head.astro';
import ConsentBanner from '@kntnt/konzilo/astro/ConsentBanner.astro';
import ConsentControls from '@kntnt/konzilo/astro/ConsentControls.astro';
import { siteMenu } from '@kntnt/konzilo/astro/site-settings';
import Page from '@kntnt/konzilo-design/components/Page.astro';
import Header from '@kntnt/konzilo-design/components/Header.astro';
import Footer from '@kntnt/konzilo-design/components/Footer.astro';
import { footerBrand, footerFromDesign, headerProps, logoAddresses, menuProps, pageProps } from '@kntnt/konzilo-design/design-props';
import '@kntnt/konzilo-design/components.css';

const { entry, title, page } = Astro.props;
const { header, footer, page: pageSettings } = design.resolved;
const base = import.meta.env.BASE_URL;
const logos = logoAddresses(design.project, { base });
const menu = menuProps(await siteMenu('main', Astro.url), { current: Astro.url.pathname, base });
const footerLinks = menuProps(await siteMenu('footer', Astro.url), { current: Astro.url.pathname, base });
// The field's name and the word its empty field shows where the design shows one, both the site's own words.
const search = { action: `${base}search/`, label: 'Search the site', word: 'Search' };
// Something for every one of the eight cells, here or in a slot of its name below, as the lower band's A2 and B2 have.
// A cell the design has off leaves out what it is given here. A cell it has on counts when the footer spreads the
// others, whether or not it holds anything, so a site with nothing for a cell turns the cell off in the design.
// The upper band's A1 is the brand, as the header shows it. The texts and links in quotes are the site's own.
const content = {
  upper: {
    a1: { content: footerBrand({ identity: header.identity, axis: header['brand-axis'], name: design.project.name, logo: logos, surface: footer.upper.surface }) },
    b1: { links: [{ label: 'LinkedIn', href: '…' }, { label: 'Newsletter', href: `${base}newsletter/` }] },
    a2: { text: design.project.slogan || 'What the organisation does, in a sentence or two.' },
    b2: { links: footerLinks },
  },
  lower: {
    a1: { text: '12 Example Street, 123 45 Sampleton' },
    b1: { text: `© ${new Date().getFullYear()} ${design.project.name}` },
  },
};
---
<html lang={publicSite(Astro.url).languageTag}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <Head entry={entry} title={title} page={page} />
  </head>
  <body>
    <ConsentBanner />
    <Page {...pageProps(pageSettings)}>
      <Header {...headerProps(header, design.project, { menu, logos, search, home: base })} slot="header" />
      <slot />
      <Footer {...footerFromDesign(footer, content)} slot="footer">
        <ConsentControls slot="lower-a2" buttons={false} />
        <ConsentControls slot="lower-b2" links={false} />
      </Footer>
    </Page>
  </body>
</html>
```

### The directives and the presentations

A site draws the directives of directives.md with this package's components, and its post lists with its presentations (directives.md, The components). Besides the configuration above, its site description takes the declarations and the checks by their package specifiers, names the directives among each type's elements, and declares the presentations it registers:

```json
{
  "componentsFrom": "@kntnt/konzilo-design/directives/components.json",
  "componentChecks": "@kntnt/konzilo-design/directives/checks",
  "types": {
    "page": {
      "collection": "pages",
      "address": "/{path}/",
      "hierarchical": true,
      "elements": ["paragraph", "heading", "list", "quote", "table", "image", "gallery", "post-list", "form",
        "hero", "section", "aside", "list-directive", "cards", "accordion", "tabs", "toc", "choice", "eyebrow", "small", "breadcrumbs"]
    }
  },
  "presentations": {
    "cards": { "label": "Cards" },
    "featured": { "label": "Featured" },
    "filtered": { "label": "Filtered", "options": { "filters": { "label": "Rows", "type": "string", "control": "text" } } }
  }
}
```

- **The elements.** The list is the element `list-directive`, since the core's Markdown list is `list`; every other directive is the element of its name. A type that names none of them has none.
- **The labels** are the package's British English; a site gives its own by language under `componentLabels`.
- **The checks** run in the core's intake, which refuses a post for each reason, in the editor's words; the editor's early check runs none (the core's ADR 0060). A site with components of its own names a module of its own under `componentChecks`, which may ask the package's `componentProblems()` for the package's names.
- **The presentations.** A site declares those it uses, and registers the same: `presentations: { cards: DESIGN_PRESENTATIONS.cards }` for one. `filtered` takes the option `filters`, the rows' names apart by spaces, `filters="category topics search"`.
- **The page's context.** Every template that renders a body, and every page that calls a presentation itself, gives the page's context first, in its frontmatter, with `designPage()` from `design-props`:

```astro
---
// src/pages/[...page].astro, in part
import { render } from 'astro:content';
import Body from '@kntnt/konzilo/astro/Body.astro';
import { breadcrumbs } from '@kntnt/konzilo/astro/breadcrumbs';
import { designPage } from '@kntnt/konzilo-design/design-props';
import design from '../../design/site.design.json';

const { entry: page, page: number } = Astro.props;
const { Content } = await render(page);
designPage(Astro, {
  design,                                          // the design file
  title: page.data.title,                          // a hero's H1
  breadcrumbs: await breadcrumbs(page, Astro.url), // the trail's levels, as the core gives them
  search: `${import.meta.env.BASE_URL}search/`,    // where a filtered list's search goes
  types: { articles: { name: 'article', label: 'Article', plural: 'Articles' } }, // for a filtered list's count
  // words: { contents: 'Innehåll', search: 'Sök', … }, the site's own words over the package's
});
---
<Site entry={page} page={number}>
  <Body post={page} page={number}><Content /></Body>
</Site>
```

`search` and `types` are for a filtered list where the core does not say what the list is of; a version of the core that gives a presentation `list` says it itself, and then the terms and the count over every page too. A component on a page whose template did not call `designPage()` stops the build, naming the call. A term's page calls `Filtered` itself, with `settled` for the row it settles:

```astro
<Filtered posts={posts} pager={pager} empty={empty} options={{ filters: 'category topics search' }} settled={{ taxonomy: 'category', term: term.id }} />
```

A page's body is its bands, heroes and sections, so a body of directives stands in Page's `main` with nothing around it. A run of loose blocks at the top of a body, and the title and trail of a page without a hero, are the template's to write (directives.md, The body of a page).

### A body without directives

Page holds the page's one `<main>`, so a template's `<main>` goes. In its place, and in place of `class="body-text"`, what a template shows stands in a Band, in the library's body text at a width, which body text has none of by itself. The wrapper stands directly around what the body writes, since a bare table takes its scrolling from that:

```astro
---
// src/pages/[...page].astro, in part
import Band from '@kntnt/konzilo-design/components/Band.astro';
import BodyText from '@kntnt/konzilo-design/components/BodyText.astro';
---
<Site entry={page} page={number}>
  <Band>
    <BodyText data-kn-width="narrow">
      <h1>{page.data.title}</h1>
      <Body post={page} page={number}><Content /></Body>
      <CookieDeclaration />
    </BodyText>
  </Band>
</Site>
```

The core's `Breadcrumbs.astro` writes no class, so a design cannot reach it. The library's takes the same levels, as `::breadcrumbs` does from the page's context:

```astro
---
import Breadcrumbs from '@kntnt/konzilo-design/components/Breadcrumbs.astro';
import { breadcrumbs } from '@kntnt/konzilo/astro/breadcrumbs';
import { breadcrumbProps } from '@kntnt/konzilo-design/design-props';
import design from '../../design/site.design.json';

const [home, ...rest] = await breadcrumbs(page, Astro.url);
const trail = rest.map(({ name, href }, at) => (at === rest.length - 1 ? { label: name } : { label: name, href }));
---
<!-- A design with its trail off gives no steps, and Breadcrumbs then writes nothing. -->
<Breadcrumbs {...breadcrumbProps(design.resolved.breadcrumbs, design.project, { trail, home: home.href, homeWord: home.name })} />
```

`components.css` holds what `body-styles.css` holds again, to no harm. `design-props` also gives `identityProps`, `heroProps` and `nextHeadingProps`, each taking the site's own content, and `footerBrand`, which takes the `logos` above as its `logo`.

## What a site needs

From this package: the design file, `fromDesign`, `konzilo.css`, the fonts and logos commands, the frame's components, `design-props`, with `menuProps` for its menus, `logoAddresses` for its logos and `designPage` for its templates, and the directives' components, declarations and checks and the presentations `cards`, `featured` and `filtered` (The directives and the presentations, above).

Of its own, since nothing here does it yet:

- Its languages, in the shape Header takes, from the core's `languageSwitcher()` (`{ url, name, current, language }`). Only the menu has an adapter so far, and the trail the few lines above.
- Its templates' parts: an article's opening, body and "Read more", a term's opening, and the title and trail of a page without a hero, whose HTML directives.md gives, and the section around a run of loose blocks at the top of a body.
- The look of any presentation of its own, and its `searchPage` and `termPage`, whose list a term's page draws with `Filtered`. The template's List, Cards and TermPage write classes of the template's, whose styles went with `src/styles`, so they stand unstyled until the site replaces them.
- `bodyClass`, which the core does not take yet, so a template writes the wrapper around a body itself.
- A restart of Astro's dev server after a change to the design, which it does not watch.
