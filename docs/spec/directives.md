# The directives

Records the HTML contract between the directive list Konzilo defines and this design system: for every directive and variant, the HTML a site writes, the `kn-` classes and attributes it carries, what the design reads from the content, and the runtimes that give it behaviour.

## Roles

***Decided* by the owner, 2026-11-10:**

- **The directive list Konzilo defines** decides which parts exist and the structure and meaning of their HTML. Its examples' colours, type steps and picture shapes are illustrative only.
- **This design system decides every look:** colour, type, space, columns and states. Everything here works for any design the tool can make, light or dark, in any colours and any typefaces.
- **The site writes only HTML**, with this package's classes (`kn-*`), text types (`data-kn-type`) and Surfaces (`data-kn-surface`). This file names the class of every part. A site's own classes are its own CSS and no part of this contract.
- **Behaviour belongs to this design system:** tab switching, choosing an answer, one-open accordions, marking the section being read in the following menu, and a head that stays as the page scrolls. It is HTML and CSS, with no script wherever that is possible (principles.md, owner, 2026-11-10): tabs, a choice and an accordion are native `<details>`, and a head or an Aside Block stays by `position: sticky`.
- **The owner's decisions on look**, made with the directive list, bind this design system and override earlier specs where they clash (Superseded, below).

***Drawn by this package*** (the Konzilo core's ADR 0068, settled by the owner, 2026-11-10; built 2026-11-12): on a Konzilo site this package draws the HTML below itself, by components a site registers (The components, below), and the site writes it by hand only where it renders a directive without them, as a site outside Konzilo does.

***The assistant's choices, 2026-11-10:*** the following menu "In this article" marks the section being read, and fact boxes (`aside`) stand in the reading column, not in the Aside.

***Dropped* by the owner's principle (principles.md, HTML and CSS, not JavaScript), 2026-11-10:** marking the section being read was the assistant's choice and needed a script, so no script marks it now. Where a browser has CSS scroll markers it marks the section itself, as a progressive enhancement that costs nothing elsewhere (`toc`, below). Visitor Filters, for `filtered`, runs no script either (the assistant's choice, 2026-11-10).

## How the design reads content

***The assistant's choice, 2026-11-10***, of three options: (a) the CSS infers every layout from semantic HTML with `:has()`; (b) the package exports a pure function that a site calls at build to get a `data-kn-layout` value; (c) a mix. **The choice is (c), in three channels:**

1. **Markup.** The site writes what the content is: the elements, the classes of the parts, and a grouping by position, such as a section's head or a tab's text, by the rules in this file. `sectionParts` and `panelParts` implement those rules, so no site writes them again.
2. **Facts.** What lies in text, which no selector can see, a pure function of `@kntnt/konzilo-design/directives` states at build, and the site writes it as a `data-kn-*` fact about the content: a deck longer than a line, headings that are all questions, a link whose text is a telephone number, a link to a known service, the numbering of a list's level. A fact never names a layout.
3. **Readings.** Everything else the stylesheet reads from the markup with `:has()`, sibling and child-count selectors: a section's layout, a series' columns, a card that is a link as a whole, a card with an action among cards without, a lone main action after a series.

**Why.** The HTML stays a description of the content, the same for every design. The decisions stay in this package's CSS, so a design or a later version changes a layout without the site changing a line or knowing a rule. A page written by hand, in the gallery, the tool or a site outside Konzilo, gets the same layout from the same HTML. Only text needs a function, and the function states a fact, so a design stays free to do something else with a long deck. Option (b) was rejected because a `data-kn-layout` value writes the design's decision into the HTML, which every page must then be rebuilt to change and every hand-written page must compute; (a) alone cannot see a deck's length or a heading's question mark.

**The one exception is a Surface.** A Surface is an attribute (names.md, decision 3), and a stylesheet cannot put one on an element. Where the design puts a part on a plate of its own, the site writes the Surface that `surfaceOf` returns, so that choice too stays in this package. Where the site does not know the ground the part stands on, as when the core draws a nested part or a post list's teasers into a band, it gives `surfaceOf` none and writes what it returns: the stylesheet then finds the ground, and a part that stands on a ground of its own kind takes the Surface `surfaceOf` gives on that ground, the third column of the table below, at any depth (since 2026-11-12; plates.md, A plate finds its ground).

### The module

`@kntnt/konzilo-design/directives`, in `src/directives/`. Plain JavaScript with no dependency and nothing of Astro's or the browser's, so a site's build can call it on whatever tree its reader gives it.

| Export | What it gives |
|---|---|
| `sectionParts(blocks)` | A section's grouping and its deck fact. `blocks` is the section's blocks in order, each `{ kind, text }`, `kind` one of `picture` (an image standing alone), `eyebrow`, `heading` (an `h2`), `paragraph` (a plain paragraph), `actions`, `form`, `choice` and `other`; `text` is needed only for a paragraph. It returns `{ media, head, deck, body, deckLong }`: arrays of indexes for the three groups, the deck's index or `null`, and whether the deck is long (Section, below). |
| `DECK_LINE` | 70: about the characters a line of a deck holds beside a heading. A deck is long when its text, its white space collapsed, is longer. |
| `panelParts(blocks)` | A tab's grouping. `blocks` is the panel's blocks in order, each `{ component }`, true for what a directive made. It returns `{ text, parts }`, arrays of indexes, where the panel is a run of text followed by a run of components, both not empty; otherwise `null`, and the panel's blocks stand in order (Tabs, below). |
| `markerAttributes(markers, level, ordered)` | The attributes of one level of a list: `markers` is the directive's value, `level` counts from 1, `ordered` is true for an `<ol>`. It returns an object, empty where the level has no marker (List, below). |
| `contactOf(href, text)` | `'phone'`, `'email'` or `null`: a `tel:` link whose text is a telephone number, or a `mailto:` link whose text is an address. |
| `serviceOf(href)` | `{ service, icon }` or `null`: a link to a service the design knows, by its host. `SERVICES` holds them. |
| `allQuestions(texts)` | True where there is at least one text and every one, trimmed, ends in a question mark. |
| `surfaceOf(part, ground)` | The Surface kind for a part the design puts on a plate, or `null`. `ground` is the Surface kind of the band around it, left out or `undefined` for the page or where it is not known, and the part then finds its ground by CSS. |
| `iconHtml(name, className)` | An Icon's markup as a string, exactly as `Icon.astro` writes it: `<svg class="kn-icon …" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">…</svg>`. |

`surfaceOf` today:

| `part` | Surface | On a ground of the same kind |
|---|---|---|
| `link-card` | `raised` | `page` |
| `action-card` | `tint` | `raised` |
| `behind-card` | `picture-dark` | `picture-dark` |
| `fact-box` | `tint` | `raised` |
| `choice-answer` | `raised` | `page` |
| `choice-panel` | `raised` | `page` |

`SERVICES` today: `linkedin` (linkedin.com), `facebook` (facebook.com), `instagram` (instagram.com), `youtube` (youtube.com, youtu.be) and `x` (x.com, twitter.com), each matching its host and the host's subdomains. Their icons are `linkedin`, `facebook`, `instagram`, `youtube` and `brand-x` in `icons.js`; `instagram` and `brand-x` are to be added from Tabler, whose licence is already beside the icons.

### Rules for every directive

- **Items.** A form's items begin at its headings, as the directive list defines: every heading at the level of the first begins an item, and what follows, up to the next, belongs to it. What stands before the first heading is the intro. The site splits them.
- **Pictures** in a hero, a section's media, a card and a logo band are bare `<img>` elements with their `alt`. Where the reader wraps one in a `<figure>`, the site writes the image alone; a caption has no place there.
- **Headings keep their level** as written, except under a tab or an answer, whose own heading is drawn as a button: the headings under it go up one level, never above `h2`, so the page's headings keep their order.
- **Ids** are unique on the page. The site makes them, and the form `<directive>-<n>` used below is only an example. An anchor made from a heading is the id the reader gave the heading, or one made from its text the same way.
- **Body text.** `.kn-body-text` stands on a section's body, an accordion's content, as Accordion writes it, and an article's flow. Everything inside it, tabs, answers and cards included, takes Body Text's typography, and a part with a class of its own takes the part's look.
- **`data-kn-type`** is given below for every part that is a single text element. The values are this file's, and this file may change them.
- **No inline style and no `<style>`.** A site's content security policy may refuse them, and every reading here is in the stylesheet. *The one exception* (the assistant's choice, 2026-11-12): a picture behind a hero is the band's `--kn-picture-image`, written in its `style` as Band writes it, since a picture is content and no stylesheet can know it; the core's policy allows it, as it allows every distinct `style` attribute of a release by its hash (its `content-security-policy.js`), and the picture is an image of the site's own, which `img-src 'self'` allows.
- **No image in a stylesheet.** A site may turn the core's `data:` images off (`security.dataImages`, the core's ADR 0051), so a mark the design draws is either drawn with borders and gradients, as `konzilo.css` draws a select's arrow, or written as an Icon with `iconHtml`. *(Corrected 2026-11-12: this said the core's policy refuses an image at a `data:` address; it allows one unless the site says otherwise.)*
- **The page's own Surface writes nothing.** `surface="page"`, the default of a section, writes no `data-kn-surface`, so the page's fill shows and adjoining bands join as page.md says.

### Superseded

- **Card Grid's columns** (components.md, How a component is built, Links and layout): in a card series from the directives, the number of cards sets the columns, three or four, whichever leaves the last row fuller, and two cards stand in two (owner, 2026-11-10, via the directive list). Card Grid's `columns` holds for other uses, and on a window too narrow for four a directive series makes the same choice between three and two, then two and one (owner's rule, applied by the assistant, 2026-11-10); Card Grid's own `data-kn-columns="4"` still falls straight to two for other uses.
- **Accordion's FAQ** (components.md, Owner's component review): an accordion whose headings are all questions is drawn as questions and answers, a look of its own read from `data-kn-questions` (owner, 2026-11-10, via the directive list). `faq` on the Astro component still adds only structured data.
- **Table of Contents' "no scroll-spy is added"** (components.md, Navigation): the following menu marked the section being read by a script (the assistant's choice, 2026-11-10, above), dropped the same day by the owner's principle. It stands again: no script is added, and only a browser's own scroll markers mark the section (`toc`). A Table of Contents without `data-kn-follow` stays as it was.

## The components

***Built* 2026-11-12** (the core's ADR 0060 and ADR 0068; the assistant's technical choices, recorded here): a Konzilo site draws the directives with this package's components, declares them with its declarations and checks them with its checks, and the core keeps its own plain rendering for a site without them.

| What | Where | What it is |
|---|---|---|
| The components | `@kntnt/konzilo-design/directives/<Name>.astro`: `Hero`, `Section`, `Aside`, `List`, `Cards`, `Accordion`, `Tabs`, `Toc`, `Choice`, `Eyebrow`, `Small`, `Breadcrumbs` | One for each directive, registered by its name in `konzilo({ directives })` (`DESIGN_DIRECTIVES`, konzilo.md). Each takes its attributes, its tree and, in the live preview, its mark, and writes the HTML of this file. |
| The renderer | `src/directives/render/` | Plain JavaScript with no dependency, which the components call: a directive's tree to its HTML, and a writer of the core's tree as HTML. |
| The declarations | `@kntnt/konzilo-design/directives/components.json` | What a site description takes by `componentsFrom`: each directive's label, form, body and attributes, below. |
| The checks | `@kntnt/konzilo-design/directives/checks` | `componentProblems(name, attributes, blocks)`, which the core's intake runs for a site that names it by `componentChecks`: what each directive may hold, below. |
| The presentations | `@kntnt/konzilo-design/presentations/<Name>.astro`: `Cards`, `Featured`, `Filtered` | The post list's presentations `cards`, `featured` and `filtered` (`::post-list`, below), registered by name in `konzilo({ presentations })` (`DESIGN_PRESENTATIONS`). |
| The page's context | `designPage(Astro, { design, title, breadcrumbs, … })` in `design-props` | What a component is not handed by the core, which a page's template gives once, before its body (konzilo.md, How a site takes its design). |

**What the core hands a component** (the core's `docs/site-design.md`): its attributes as props, typed, those not written at their defaults; its body as a tree, a hast root in `content`, the package's own directives within it as the core's plain renderings holding their bodies; its body again as its default slot, rendered by the core, the site's components within it drawn by their components, post lists by their presentations, forms by the site's form and pictures with their lightbox; and in the live preview its block's mark, `data-konzilo-block`. Nothing else: no post, no title, no trail and no design, which the page's context holds.

**Drawn from the tree.** Every component but the section draws all it holds from its tree: its items, the package's directives within them, each with the Surface of the plate or band around it (`surfaceOf(part, ground)`), and every other block as the core wrote it. What the core wrote stays:

- **Marks.** Every element drawn for a block of the tree keeps the block's `data-konzilo-block`, a figure's on its image, and a list's on the list it becomes, its items' on its items. A level with no element of its own, such as a card, a tab's panel or a styled list around its Markdown list, is found by its first block, as the core's contract has it; a tab's and an answer's heading keep theirs on their `<summary>`. A component's own mark stands on each element at its top that holds none of its own, such as a series' grid beside its intro, so the core writes no wrapper (its ADR 0068).
- **Pictures.** An image keeps the core's `src`, `srcset`, `sizes`, `width`, `height`, `loading` and `decoding`; a hero's pictures load at once. A picture in a part drawn from its tree has no lightbox, which the core adds only to what it draws.
- **Ids.** A heading keeps the id the core gave it, which is unique in the body. A section's or a fact box's own `anchor` wins over its heading's id of the same name, which is left out. An id the design writes, such as a tabs' `name` and label, is `<directive>-<n>`, counted on the page.

**What a component draws in a section's body finds its ground by CSS.** A part the core draws in a section's slot is drawn without knowing the band around it, since Astro renders a page's components in parallel and nothing passes from one to another, so it takes `surfaceOf(part)` as on the page, and the stylesheet finds the band's Surface for it (plates.md, A plate finds its ground).

**A section takes its body from its slot** (the report's decision D1, settled by the orchestrator, 2026-11-12): it draws its media and its head from the tree, and its body is what its slot holds after them, as the core drew it there, so a post list, a form, a site's own component and a picture with its lightbox stand in a section's body as on any page. In the live preview the body begins at the first element marked as its first block, or as a block within that block; elsewhere the section counts the elements the core drew for its media and head: a figure and the lightbox's dialog after it for each picture, one element for an eyebrow, the heading and the deck, and what the package's own list draws for the actions. In the body, eyebrows right before a heading join it in a heading group, as `::eyebrow` says.

**What only the core can draw** (until the core's issue #55): a part drawn from its tree cannot draw a post list, a form or a site's own component, which the tree holds only as the core's empty plain renderings. The checks refuse them anywhere but directly in a section, and the renderer leaves the plain rendering and warns where one stands all the same. *A choice's answer that holds a form*, which `choice` below promises, waits for it.

**A page's context.** A component reads it from `Astro.locals`, where `designPage()` keeps it; a component on a page whose template did not call it stops the build, naming the call. It holds the design file, the post's title, which a hero shows as the page's H1, the trail's levels as the core's `breadcrumbs(entry, Astro.url)` gives them, the site's search page and its types for a filtered list, the site's own words over the package's British English, and the page's count of ids. Astro renders sibling components in parallel, so nothing passes from one component to another but that count.

### The declarations

`components.json` is their source, and a test holds this table to it. A site takes them whole and gives them labels of its own by language under `componentLabels`. Each attribute that takes listed values or a pattern refuses another value in an editor's words. A type's `elements` names a directive by its element.

| Directive | Element | Form | Label | Attributes |
|---|---|---|---|---|
| `hero` | `hero` | container, blocks | Opening | `surface`: `page`, `raised`, `inverse`, `tint`, `brand` or `accent`, no default, the design's own where it is left out |
| `section` | `section` | container, blocks | Section | `surface`: `page`, `raised`, `inverse`, `tint`, `brand` or `accent`, default `page`; `anchor`: the section's id, of lowercase letters `a` to `z`, digits, hyphens and underscores |
| `aside` | `aside` | container, blocks | Fact box | `anchor`: the fact box's id, as a section's |
| `list` | `list-directive` | container, blocks | Styled list | `type`: `description`, `values`, `logos` or `actions`, no default, a list with the design's bullets or markers where it is left out; `markers`: a value for each level, apart by `/` (List, below) |
| `cards` | `cards` | container, blocks | Cards | `type`: `navigation`, no default; `markers`: one value, a sign or a numbering; `picture`: `behind`, no default; `symbol`: `item` or `heading`, no default |
| `accordion` | `accordion` | container, blocks | Accordion | `first`: `open` or `closed`, default `closed`; `expand`: `one` or `many`, default `many` |
| `tabs` | `tabs` | container, blocks | Tabs | none |
| `toc` | `toc` | container, blocks | Table of contents | none |
| `choice` | `choice` | container, blocks | Choice | none |
| `eyebrow` | `eyebrow` | leaf, text | Eyebrow | none |
| `small` | `small` | leaf, text | Small print | none |
| `breadcrumbs` | `breadcrumbs` | leaf, none | Breadcrumbs | none |

**Each is a directive of its own** (the assistant's choice, 2026-11-12): the list and its five forms, cards, accordion, tabs, a table of contents and a choice, as this file and the gallery have always named them, not `:::list{form="…"}`, which the core's ADR 0068, "the list … and its five forms", could also be read as. Only the list takes the element of another name, since the core's Markdown list is `list`.

**The Markdown an editor writes** is given under each directive below. What holds for all: a container's fence is one colon longer than the longest inside it; an item of a form begins at its heading, `###` in a section with a heading and `##` in one without; a picture is a paragraph of its own, since pictures on adjacent lines are a gallery.

### The checks

`componentProblems()` says, in an editor's words, what would otherwise be dropped or drawn wrong, and the core's intake refuses the post for each reason. It reads the core's body model (the core's `src/format/body.js`), and passes a component of a site's own.

| Directive | Refused |
|---|---|
| `hero` | A heading, which the post's title stands in for; a gallery; more than two pictures, a logo and its own |
| `list` | Anything but exactly one Markdown list; with `type="actions"`, an item that is more than one link, in bold or not, and a second main action; with `values` or `description`, an item without its value or description under it; with `logos`, an item that is no picture or linked picture |
| `cards`, `accordion`, `tabs`, `toc`, `choice` | No heading to begin an item at; a choice of one answer; in a table of contents, more than one paragraph before the first heading |
| `cards` | With `type="navigation"`, a heading that is not one link, or another link in the card; with `symbol`, a card without a picture; a numbering in `markers` with `picture` or `symbol` |
| every directive but `section` | A post list, a form or a site's own component, until the core can draw one inside a part drawn from its tree |

## The page parts

***Built* 2026-11-13** (the assistant's technical choices): what a site's templates place around a body, which the core does not draw and no directive gives, so that a template places parts of this package's and writes nothing of its own where a part exists. Each is an Astro component of `@kntnt/konzilo-design/page-parts/<Name>.astro`, which reads the page's context (The components) and takes what a template has in hand from the core.

| Part | What a template gives it | What it draws |
|---|---|---|
| `PageBody` | The body, as its slot: `<Body post page><Content /></Body>`, and anything after it | The body as bands (The body of a page): each hero and section as it is, a run of other blocks at the top in a section of its own, the title band first where the body opens with no hero (`title={false}` leaves it out), and the page's H1 under the hero where the design puts it there |
| `TitleBand` | `title`, the page's context's by default; `eyebrow`, `deck`, `surface`, and `trail={false}` to leave the trail out | A page's title and trail, as a section's head of its own |
| `TermOpening` | `term`, the term's entry as the core's `termPages()` hands a term's page it; `taxonomy`, read from its collection by default; `eyebrow`; `surface` | A term's opening: its taxonomy's word over its name, the page's H1, and its description as the deck |
| `ArticleOpening` | `entry`, the post's entry; `metaLine`, the core's `metaLine()` pieces; `topics`, each `{ name, url }`; `eyebrow`, the category's name by default; `surface`; the slot `after` | An article's opening (An article, The opening) |
| `ArticleBody` | The body, as its slot; `label`; `menu={false}`; the slot `aside` | An article's body and its following menu (An article, The body and its following menu) |
| `ReadMore` | `posts`, as the core's `relatedPosts()` gives them; `heading`; `more`, `{ label, href }`; `surface` | "Read more" (An article, "Read more"), nothing without posts |

**Drawn from what the core drew.** `PageBody` and `ArticleBody` take the body as the core's `Body` drew it, so a post list, a form and a picture with its lightbox stand in them as anywhere. Each reads the elements at the top of that HTML and writes them again only where the design adds to them: a class and a text type on the head of a section it makes, `kn-question` on an interview's question. The live preview's marks stay on every block.

**A run of loose blocks** at the top of a body is read by the section's rules (`section`, above) from what the core drew: a figure of one image is a picture, whose lightbox's dialog it leaves out of the media; an eyebrow's label, an `h2`, a plain paragraph, actions, a form and a choice are what they are in the tree. So a run of a heading and paragraphs, as a legal page is written, has its head beside them as rule 5 reads it, as if the editor had written `:::section` around it.

**The H1 under the hero** (components.md, The H1, the trail and the hero's heading): where the design's `inputs.hero.h1` is `below`, the hero draws its heading as a paragraph and no trail, and `PageBody` gives the band after the hero the trail first in its head and its heading as the `h1`, with the H1's look; where that band has no heading, a title band stands between them. An article's opening draws its headline as the H1 whatever the design's `h1`, since no band after it holds a heading (the assistant's choice, 2026-11-13).

**A term's page** shows its posts with `Filtered` (`::post-list`, `presentation="filtered"`), in a body of its own: `PageBody` puts the list in a section, under the term's opening.

## The body of a page

A post's body is a sequence of bands (page.md, point 3): heroes and sections. A run of blocks at the top level outside a hero or a section is written as a section without a Surface, as if the editor had put `:::section` around it, so a list of logos alone at the top stands in a band of its own. `PageBody` writes that section around such a run, reading it by the section's rules (The page parts).

**A page without a hero** (components.md, The H1, the trail and the hero's heading) has its trail and its title as the H1 in a section's head of its own, first, which `TitleBand` writes and `PageBody` puts first:

```html
<section class="kn-band kn-section">
  <div class="kn-band-content">
    <header class="kn-section-head">
      <nav class="kn-breadcrumbs" …>…</nav>
      <hgroup class="kn-heading-group"><h1 class="kn-heading-group-heading" data-kn-type="heading-1">The post's title</h1></hgroup>
    </header>
  </div>
</section>
```

No directive has a runtime (2026-11-10): a site's layout imports no script for a body. `section.js`, `tabs.js`, `choice.js` and `reading-area.js` are gone, replaced by native `<details>` and CSS, as each part below says; a site that still calls their setups must drop those imports.

### Behaviour in a live preview

***Specified* with the Konzilo core's contract for its live preview, 2026-11-10:**

- **Blocks keep their mark.** In a preview the core writes `data-konzilo-block` on every block of a body, its value a path within containers and lists, such as `2.1`. Markup that renders a directive keeps the attribute on the blocks it is given. No selector of this package reads it, and none is broken by it: an attribute on any element changes no layout, which `test/directives-section.test.js` checks over every directive's fixture.
- **What holds a selected block opens.** The core opens every `<details>` that holds the block an editor selects, and brings the block into view itself. Tabs, a choice and an accordion are all `<details>`, so this package needs nothing for it: an exclusive group (`name`) closes the others as the browser opens one, and a block in a tab inside an answer opens both. The `konzilo-preview-show` event the runtimes of tabs and a choice listened for went with them (2026-11-10).

## `hero`

**Markup.** The Hero's markup, with its choices from the design (`heroProps(design.resolved.hero, …)` and `heroAttributes`), and the directive's `surface` in place of the design's `inputs.hero.surface` for this page. Where the design puts the picture behind the text and the hero has one, the picture's Surface takes the place of both, as `heroProps` says; a hero without a picture keeps the Surface it would have beside one, since `heroProps` gives a picture Surface only to a picture it is given (fixed after 0.6.1).

```html
<section class="kn-band kn-hero" data-kn-surface="raised" data-kn-picture="end-bleed" data-kn-height="two-thirds">
  <div class="kn-band-content kn-hero-content">
    <div class="kn-hero-text">
      <nav class="kn-breadcrumbs" …>…</nav>                       <!-- ::breadcrumbs -->
      <img class="kn-hero-logo" src="…" alt="…">                  <!-- a picture before the text -->
      <hgroup class="kn-heading-group">
        <p class="kn-heading-group-eyebrow" data-kn-type="label">An eyebrow</p>
        <h1 class="kn-heading-group-heading" data-kn-type="heading-1">The post's title</h1>
        <p class="kn-heading-group-deck" data-kn-type="lead">The first paragraph.</p>
      </hgroup>
      <ul class="kn-actions" role="list">…</ul>                   <!-- :::list{type="actions"} -->
      <p class="kn-fine-print" data-kn-type="small">A note.</p>   <!-- ::small -->
    </div>
    <div class="kn-hero-media"><img src="…" alt="…"></div>        <!-- the last picture -->
  </div>
</section>
```

- The heading is the post's title, as `h1`, or, where the design has `inputs.hero.h1` set to `below`, a paragraph in a `<div class="kn-heading-group">`, as Heading Group writes it (components.md, The H1, the trail and the hero's heading). `data-kn-type` is the design's `inputs.hero.type`.
- The first paragraph is the deck. The last picture is the hero's picture, in `.kn-hero-media`; a picture before the text is a logo, `.kn-hero-logo`, first after the trail, at its own proportions, at most 4rem high and 16rem wide, as a section's badges are at most 4rem high and 8rem wide (the assistant's choice, 2026-11-10). ***Decided* by the owner (2026-11-11):** 4rem is a largest height, not a set one, so a small raster logo is never drawn past its own size and blurred; an SVG, whose `src` ends in `.svg` or which is an SVG data address, is drawn 4rem high, since one with only a `viewBox` has no size of its own. Everything else follows the heading group in the order written.
- Where the design's `inputs.hero.picture` is `none` and the hero holds a picture, it stands at `end`, Hero's default side, since content the editor chose is never dropped.
- `surface` takes `page` (no attribute), `raised`, `inverse`, `tint`, `brand` or `accent`. Left out, the hero stands on the design's own, `inputs.hero.surface`, as `resolved.hero.surface` holds it, which `none` leaves without a Surface. *(Changed 2026-11-12, the assistant's choice: the directive's default was `raised`, which overrode the design's choice on every page; with no default, a page departs from the design only where its editor writes a Surface.)*
- The page's title comes from the page's context, since a hero's body holds no heading: the post's title is its H1 (the core's content format: a body's headings are at levels 2 to 6). A hero whose page gives no title stops the build. Where the design puts the H1 below the hero, the hero draws no trail, and `PageBody` gives the band after it the trail and the H1 (The page parts).

**Markdown.**

```markdown
::::hero{surface="tint"}

::breadcrumbs

![Example Gardens](../media/logo.svg)

::eyebrow[A guide]

Start small, and let the beds widen year by year.

:::list{type="actions"}

- **[Get started](/start/)**
- [Read more](/more/)

:::

::small[Free for the first month.]

![Raised beds in the spring](../media/beds.webp)

::::
```

The trail first, where the page has one; a picture before the text is the logo; eyebrows; the first paragraph is the deck; actions and small print in the order written; the last picture is the hero's.

**Read from content.** *(CSS)* Fine print right after the actions is a note under them. A hero without a picture has no `.kn-hero-media`, and its text takes the content width as Hero's choices say. It keeps the design's height, two thirds of the window by default, as a hero with a picture does (***decided*** by the owner, 2026-11-13, after a site built with the components asked whether such an opening should be only as tall as its text).

**Behaviour.** None.

**Component.** Hero, with Heading Group, Breadcrumb Navigation, Actions and Fine Print. New: the part `.kn-hero-logo`.

## `section`

**Markup.** A Band with the class `kn-section`, its `surface` and its `anchor` as `id`. Its content is up to three groups, in this order, as `sectionParts` gives them; a group with nothing in it is not written.

```html
<section class="kn-band kn-section" id="plans" data-kn-surface="tint">
  <div class="kn-band-content">
    <div class="kn-section-media">
      <img class="kn-section-picture" src="…" alt="…">
      <ul class="kn-section-badges" role="list"><li><img src="…" alt="…"></li></ul>
    </div>
    <header class="kn-section-head">
      <hgroup class="kn-heading-group">
        <p class="kn-heading-group-eyebrow" data-kn-type="label">An eyebrow</p>
        <h2 class="kn-heading-group-heading" data-kn-type="heading-2">The heading</h2>
        <p class="kn-heading-group-deck" data-kn-type="lead" data-kn-deck="long">The deck.</p>
      </hgroup>
      <ul class="kn-actions" role="list">…</ul>
    </header>
    <div class="kn-section-body kn-body-text">…the rest, in the order written…</div>
  </div>
</section>
```

`sectionParts` groups the blocks so:

1. **Media** is the run of pictures the section begins with: the first is `.kn-section-picture`, and the ones after it are its badges, each an item of `.kn-section-badges`.
2. **The head** begins after the media with any eyebrows and the `h2` right after them; without that `h2` there is no head, and eyebrows not followed by a heading are plain labels, `<p data-kn-type="label">`, in the body. The head holds the eyebrows, the heading and its deck in an `hgroup`, and after it any actions that follow the heading or the deck at once.
3. **The deck** is the paragraph right after the heading. It is no deck where nothing but paragraphs follow the heading, or where a form or a choice stands among the section's own blocks, not nested in another part. A deck longer than `DECK_LINE` carries `data-kn-deck="long"`.
4. **The body** is everything else, in the order written: other paragraphs, lists, forms, series, accordions, fine print. A form stands directly in the body, as the core writes it, so that a selector can find it.

**Markdown.**

```markdown
:::::section{surface="tint" anchor="plans"}

![A shed with tools](../media/shed.webp)

![An award for our sheds](../media/award.svg)

::eyebrow[Tools]

## Everything in one shed

The tools, the seeds and the soil, delivered at once.

:::list{type="actions"}

- **[See what is in it](/plans/)**

:::

Each shed holds what a garden of its size needs.

::::cards

### Small

For a balcony.

### Large

For an acre.

::::

:::::
```

The section's pictures first, each a paragraph of its own: the first is its picture, the others its badges. Then any eyebrows, the `##` heading, the deck and the actions; everything after them is its body.

**Space in the body** *(the assistant's choice, 2026-11-10; the directive list is silent)*: a part with a class of its own stands a column gap from what is next to it, whatever space it gives itself in other flows, so a description list, a value list and actions are spaced as cards are. A label written as a list's intro, `<p data-kn-type="label">`, stands at the component gap over its part, as the labels of Logos and of cards that lead on do. A heading group in the body, as a panel's eyebrow and heading, is spaced as a heading: room above it and a little under it, close to what it heads. Fine print stands at the component gap after a form or a choice, as their terms.

**Read from content.** *(CSS, with the deck fact.)* The stylesheet reads the six rules of the directive list from the groups, the first that matches deciding. `C` below is `.kn-section > .kn-band-content`, and a series is `:is(.kn-cards, .kn-cards-nav, .kn-timeline, .kn-reasons, .kn-post-list)`: cards that lead on stand in their `<nav>`, so the nav stands for them in the body. *(Corrected 2026-11-10: the list lacked `.kn-cards-nav`, which `section.css` and `cards.css` already read.)*

| | The section holds | Read by | The design draws |
|---|---|---|---|
| 1 | A picture first | `C:has(> .kn-section-media)` | The picture beside the head and body, its badges with it. A head and body shorter than the picture stand in the middle of its height; where they are taller, the picture grows to their height and is cropped to fill it (`object-fit: cover`), never short of its own proportions, up to a square and `85svh`; beside text longer still it keeps that size and stays at the top of the window as the text scrolls by, as a following menu does. With badges, the picture and its badges stay together at their own size and follow together (***decided*** by the owner, 2026-11-11). With a form in the body, `C:has(> .kn-section-body > form)`, the picture is what the form offers. |
| 2 | A heading with a form right after it | A head with neither deck nor actions, and `.kn-section-body > form:first-child` | The form beside the heading, with any fine print under the form. |
| 3 | Another form or a choice | `C:has(> .kn-section-body > :is(form, .kn-choice))` | The whole section centred, as a page's end. A form, its button and its terms after it, and what a chosen answer shows, keep the start edge, so labels, fields and the button read down one edge (the assistant's choice, 2026-11-10). |
| 4 | A head, its actions and an accordion | A head, and `.kn-section-body > .kn-accordion:only-child` | The head beside the accordion, staying in view as the page scrolls. |
| 5 | A head and paragraphs only | A head, and a body of `p` elements only | The paragraphs beside the head. |
| 6 | A head and a series | A head, and a series in the body; the first series decides | The head at the start edge, as every other head (***decided*** by the owner, 2026-11-13: a section's head over a series always keeps the start edge; it was centred over `.kn-reasons`, over cards without a `.kn-card-picture` or `.kn-card-symbol`, and over exactly two cards). The heading beside its deck where the deck has `data-kn-deck="long"`, and the series has pictures and five cards or more, which is more than one row at three or four columns. Otherwise the head above. |
| – | Anything else | | The head above the body. |

On a narrow window everything beside stands above and below in document order. Rule 2 lets eyebrows stand over the heading, which the directive list's wording allows; rule 4 also holds with no actions, which is how the directive list's own build reads it.

**Behaviour.** *(CSS)* Rule 4's head stays in view under the header as the page scrolls, by `position: sticky` at `--kn-reading-sticky-inset`. It is at most as tall as the window below that inset less the component gap, and a head taller than that scrolls inside itself, so it never hides its own end (the assistant's choice, 2026-11-10, replacing `section.js`, which let a head too tall for the window scroll with the page).

**Component.** New: Section, a composition of Band, Heading Group and Actions. Its parts are `.kn-section-media`, `.kn-section-picture`, `.kn-section-badges`, `.kn-section-head` and `.kn-section-body`.

## `aside`

**Markup.** A fact box, on the Surface `surfaceOf('fact-box', ground)` gives, with its `anchor` as `id`.

```html
<aside class="kn-fact-box" id="in-short" data-kn-surface="tint">
  <p class="kn-fact-box-label" data-kn-type="label">In short</p>   <!-- ::eyebrow -->
  <h2 class="kn-fact-box-heading" data-kn-type="heading-5">The heading</h2>
  <p>…</p>
  <ul>…</ul>
</aside>
```

**Markdown.**

```markdown
:::aside{anchor="in-short"}

::eyebrow[In short]

### Plant in spring

- Water early.
- Mulch the beds.

:::
```

Its first heading is its heading, at any level; the eyebrow is its label.

**Read from content.** *(CSS)* Its eyebrow is a plain label, its heading small and a list in it in small type, with the design's bullets. In a section's body it keeps to the reading column too, at the start, or in the middle of a centred section, as the text does (fixed after 0.6.1; it spanned the content width). In an article, a fact box with an `id` is a stop in the following menu, its heading the stop's name. In a `toc`'s flow it is no stop, its anchor or not: the menu lists the items' headings, and the fact box's heading, inside it, begins no item (the assistant's choice, 2026-11-12).

**Behaviour.** None of its own; where the browser marks the section being read (`toc`), it marks a fact box as a crosshead.

**Component.** New: Fact Box. It stands in the reading column, in the flow; Aside Block keeps the Aside.

## `list`

Each `:::list` holds one Markdown list. The intro and outro paragraphs stand before and after it as written, except where a type below makes the intro a label.

### No `type`: the design's bullets, or `markers`

**Markup.** The list as written, `<ul>` or `<ol>`, its `start` kept, with `markerAttributes(markers, level, ordered)` on each level's list element. A level with no marker carries nothing and has the design's bullets or numbers.

```html
<ol data-kn-numbering="decimal" data-kn-punctuation="period">
  <li>First
    <ol data-kn-numbering="lower-latin" data-kn-punctuation="parenthesis"><li>a sub-item</li></ol>
  </li>
</ol>
<ul data-kn-sign="check"><li>Included</li></ul>
```

`markers` holds a value per level, the levels apart by `/`. `markerAttributes` reads it so:

- **A sign**, `v` or `✓` a check and `x` or `✗` a cross, on a level of bullets: `data-kn-sign="check|cross"`.
- **A numbering** on a numbered level: `data-kn-numbering`, from the value's last part: `1` `decimal`, `a` `lower-latin`, `A` `upper-latin`, `i` `lower-roman`, `I` `upper-roman`, `α` `lower-greek`, `aa` `double-latin`. `data-kn-punctuation` is `period` for a trailing `.`, `parenthesis` for a trailing `)` and `brackets` for `(…)`, and absent for none. A dotted value, such as `1.1` or `A.1`, below the first level, adds `data-kn-dotted`: the number of the item above stands before the level's own, with a full stop between.
- **A level without a value of its own** takes the nearest level above of its kind, a numbering for a numbered level and a sign for bullets, so `1/1.1` numbers a third level 2.1.1. A value of the other kind gives the level none, and an empty value gives it none of its own.

**Markdown.**

```markdown
:::list{markers="1./a)"}

1. Dig the bed
   1. A spade's depth

:::
```

**Read from content.** *(CSS)* `lower-latin`, `upper-latin` and `lower-greek` double after the last letter: y, z, aa, bb. `double-latin` counts aa, bb, …, zz, aaa. A list without `markers` has the design's bullets, in a card, a text block and a fact box too. A check or a cross is drawn before each item, without an image.

**Behaviour.** None.

**Component.** Body Text, with new list markers. A single level is numbered by an `@counter-style` of this package, `kn-<numbering>` with its punctuation, so the list stays a real `<ol>`; a dotted level needs the number above, which a counter style cannot hold, so it is drawn before the item from counters of each level. Safari draws no `content` on `::marker`, which is why the dotted form is not a `::marker`.

### `type="description"`

**Markup.** Terms and their descriptions: each item's text is a term, its sub-items its descriptions. The intro is a label.

```html
<p data-kn-type="label">Words we use</p>
<dl class="kn-description-list">
  <div class="kn-description-list-item">
    <dt data-kn-type="heading-6">A term</dt>
    <dd>What it means.</dd>
    <dd>What else it means.</dd>
  </div>
</dl>
```

**Markdown.** Each item is a term, and its sub-items its descriptions:

```markdown
:::list{type="description"}

Words we use

- A bed
  - A plot of soil raised above the path.

:::
```

**Read from content.** *(CSS)* The reader looks for the term, so it stands beside its descriptions, and above them on a narrow window. It looks like a heading but is none, since HTML allows no heading in a `<dt>`.

**Behaviour.** None. **Component.** New: Description List.

### `type="values"`

**Markup.** Values with their labels: each item's text is the label, its sub-item the value. The intro is a label.

```html
<dl class="kn-value-list">
  <div class="kn-value-list-item">
    <dt data-kn-type="small">Opening hours</dt>
    <dd class="kn-value-list-value">8–17</dd>
  </div>
</dl>
```

A value may be a link, such as `tel:`, kept as written. An address alone in a value, a `mailto:` link whose words are the address, may break after its `@` and before each full stop, `<wbr>`, as in a card (the assistant's choice, 2026-11-12, since a long address in a narrow column broke anywhere).

**Markdown.** Each item is a label, and its one sub-item the value:

```markdown
:::list{type="values"}

- Opening hours
  - 8–17
- Write to us
  - [hello@gardens.example](mailto:hello@gardens.example)

:::
```

**Read from content.** *(CSS)* The value is what the reader looks for, so it stands out; the pairs stand side by side where they fit.

**Behaviour.** None. **Component.** New: Value List. Key Figures is for a few large numbers; values are also telephone numbers and opening hours.

### `type="logos"`

**Markup.** Each item an image, or an image that is a link, whose `alt` names it. The intro is the band's label.

```html
<div class="kn-logos">
  <p class="kn-logos-label" id="logos-1" data-kn-type="label">Trusted by</p>
  <ul class="kn-logos-list" role="list" aria-labelledby="logos-1">
    <li><img src="…" alt="A name"></li>
    <li><a href="…"><img src="…" alt="Another name"></a></li>
  </ul>
</div>
```

**Markdown.**

```markdown
:::list{type="logos"}

Trusted by

- ![Example Seeds](../media/seeds.svg)
- [![Example Tools](../media/tools.svg)](https://tools.example/)

:::
```

**Read from content.** *(CSS)* The logos stand in a band under their label (owner, 2026-11-10). At the top level, the list stands in a section of its own (The body of a page). A logo is almost twice as high on a wide screen as it was, 4.5rem, and 2.5rem in the narrowest window, between them following the window as space does, at most four times as wide as high (the owner's wish, 2026-11-12; the measures are the assistant's). A section that holds nothing but a logos list stands as far from the band before it as from the band after it (the owner, 2026-11-12): beside a band of its own colour it takes the band space on that side, where a run of bands would leave only its smaller space, `:is(X + L)` and `L:has(+ X)` for each Surface X, since a strip of logos under its small label does not read as a section's start; after a Hero of its colour, which keeps its end space, it adds none of its own.

**Behaviour.** None. **Component.** New: Logos.

### `type="actions"`

**Markup.** Each item a link and nothing else; the one in bold is the main action. The intro is a label.

```html
<ul class="kn-actions" role="list">
  <li><a class="kn-action" href="…" data-kn-main>Get started</a></li>
  <li><a class="kn-action" href="…">Read more</a></li>
  <li><a class="kn-action" href="https://www.linkedin.com/…" data-kn-service="linkedin"><svg class="kn-icon" …>…</svg><span class="kn-action-label">LinkedIn</span></a></li>
</ul>
```

- `data-kn-main` marks the bold link; at most one has it.
- A link `serviceOf` knows carries `data-kn-service`, its icon from `iconHtml(icon)` and its text in `.kn-action-label`.

**Markdown.** The main action is the link in bold, the strong around the link:

```markdown
:::list{type="actions"}

- **[Get started](/start/)**
- [Read more](/more/)
- [LinkedIn](https://www.linkedin.com/company/example)

:::
```

**Read from content.** *(CSS)*

- The main action is a filled button and the others outlined (owner, 2026-11-10).
- A link to a known service is drawn as its icon, its text kept for a screen reader; where every action is one, they stand as a row of icons.
- A lone main action right after a series, `:is(.kn-cards, .kn-cards-nav, .kn-timeline, .kn-reasons, .kn-post-list) + .kn-actions:has(> li:only-child > [data-kn-main])`, shows more of the series, drawn as such. *(Corrected 2026-11-10: cards that lead on, `.kn-cards-nav`, are a series here too.)*
- In a hero, in a section's head and in a card, the actions take the place the part gives them.

**Behaviour.** None. **Component.** New: Actions, drawn with Button's recipes; Link Group stays for sites outside Konzilo.

## Task lists

**Markup.** As the core's reader writes a GFM task list, untouched:

```html
<ul class="contains-task-list">
  <li class="task-list-item"><input type="checkbox" disabled> A question to answer</li>
  <li class="task-list-item"><input type="checkbox" checked disabled> One that is done</li>
</ul>
```

**Read from content.** *(CSS)* A box in place of the bullet, item by item, wherever body text stands: in a section, a card, a fact box, a tab and an article.

**Behaviour.** None. **Component.** Body Text, through `konzilo.css`, which already styles them in `.kn-body-text`.

## `cards`

**Markup.** A series is a Card Grid with the class `kn-cards`, its cards Cards. The intro stands before it as written.

```html
<div class="kn-card-grid kn-cards">
  <article class="kn-card" data-kn-surface="raised">                    <!-- a link as a whole -->
    <img class="kn-card-picture" src="…" alt="…">
    <p class="kn-card-eyebrow" data-kn-type="label">An eyebrow</p>
    <h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="…">A heading</a></h3>
    <p class="kn-card-text" data-kn-type="small">Its text.</p>
  </article>
  <article class="kn-card">                                             <!-- open -->
    <h3 class="kn-card-heading" data-kn-type="heading-5">An office</h3>
    <p class="kn-card-text" data-kn-type="small">12 Example Street</p>
    <p class="kn-card-text" data-kn-type="small"><a href="tel:+442079460000" data-kn-contact="phone">+44 20 7946 0000</a></p>
    <ul>…</ul>
  </article>
  <article class="kn-card" data-kn-surface="tint">                       <!-- an action among cards without -->
    <h3 class="kn-card-heading" data-kn-type="heading-5">Something else?</h3>
    <p class="kn-card-text" data-kn-type="small">…</p>
    <ul class="kn-actions" role="list">…</ul>
  </article>
</div>
```

- An item's picture is `.kn-card-picture`, first in the card; its eyebrows are `.kn-card-eyebrow`; its paragraphs `.kn-card-text`; lists, actions and the rest stand as written.
- **A link as a whole:** where the heading holds a link and the card holds no other link, that link is `.kn-card-link` and the card takes `surfaceOf('link-card', ground)`.
- **An action card:** a card that holds actions, in a series where some card holds none, takes `surfaceOf('action-card', ground)`.
- **A number or an address:** a paragraph whose only content is one link, for which `contactOf(href, text)` gives a kind, carries it on the link as `data-kn-contact`; an address may break after its `@` and before each full stop, `<wbr>`.

**Markdown.**

```markdown
::::cards

Our plans

### [A balcony](/plans/balcony/)

![Pots on a balcony](../media/balcony.webp)

::eyebrow[Small]

Pots and a trough.

### An office

12 Example Street

[+44 20 7946 0000](tel:+442079460000)

::::
```

A card begins at its heading, and what stands before the first heading is the intro. **A card's picture and eyebrows are its own written right after its heading or right before it** (settled by the orchestrator, 2026-11-12): an editor may write them in the order the page shows them. A run of pictures and eyebrows at the end of one card, right before the next heading, is the next card's, unless it is all the card before it holds, or the next card has a picture or an eyebrow of its own after its heading. A heading that is a link, where the card holds no other link, makes the card a link as a whole.

**Read from content.** *(CSS, with the contact fact and the Surfaces above.)*

- The number of cards sets the columns: two for two, three for one or three, and from four on three or four, whichever leaves the last row fuller, four where both do alike (owner, 2026-11-10). With `n` cards from four on that is three where `n` is 5, 6 or 9 more than a multiple of 12, and four otherwise, which child-count selectors read: `:has(> :nth-child(12n+5):last-child)` and so on.
- A card is open, with the design's hairline, unless it is a link as a whole, which stands on its plate and lifts on hover (owner, 2026-11-10): its heading is underlined and, where it casts a shadow, it rises a hair with its shadow following, while a mark that it leads on, such as the arrow of `type="navigation"`, stays still (owner, 2026-11-12; components.md, The owner's review of a site built with the components).
- All card series are drawn alike (owner, 2026-11-10), post lists and "Read more" too.
- A number or an address has the design's look for them; "Call us" stays an ordinary link.
- Cards in an accordion make the section denser, `.kn-accordion .kn-cards`.

**Behaviour.** None.

**Component.** Card and Card Grid. New: the class `kn-cards`, the part `.kn-card-symbol` and the readings above.

### `markers` with a numbering: steps

**Markup.** Steps are a timeline, numbered from the first level of `markers`, by `markerAttributes(markers, 1, true)`. `picture` and `symbol` do not go with it.

```html
<ol class="kn-timeline" data-kn-numbering="decimal">
  <li class="kn-timeline-item">
    <h3 class="kn-timeline-heading" data-kn-type="heading-5">We talk</h3>
    <p>…</p>
  </li>
</ol>
```

**Markdown.**

```markdown
:::cards{markers="1."}

### We talk

Over coffee, about your garden.

### We plant

:::
```

**Read from content.** *(CSS)* The number stands as written, `markers="1"` 1, 2, 3 and `markers="A."` A., B., C.; the number of steps sets the columns as for cards.

**Behaviour.** None. **Component.** Timeline, moved out of "Not now" (components.md).

### `markers` with a check or a cross, no pictures: reasons

**Markup.** Where no item has a picture and the series has neither `picture`, `symbol` nor `type="navigation"`:

```html
<ul class="kn-reasons" role="list" data-kn-sign="check">
  <li class="kn-reason">
    <h3 class="kn-reason-heading" data-kn-type="heading-5">A reason</h3>
    <p>…</p>
  </li>
</ul>
```

With pictures, the series stays cards, `<div class="kn-card-grid kn-cards" data-kn-sign="check">`.

**Read from content.** *(CSS)* The mark before each heading, in reasons and in signed cards alike, drawn without an image.

**Behaviour.** None. **Component.** New: Reasons.

### `type="navigation"`

**Markup.** Cards that lead on, under their label: a `<nav>` named by the intro, the series a list, every card a Card of the `link` variant whose heading's link is its only link.

```html
<nav class="kn-cards-nav" aria-labelledby="navigation-1">
  <div class="kn-cards-label" id="navigation-1"><p data-kn-type="label">Where next</p></div>
  <ul class="kn-card-grid kn-cards" role="list">
    <li><article class="kn-card" data-kn-variant="link" data-kn-surface="raised">
      <h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="…">A page</a></h3>
      <p class="kn-card-text" data-kn-type="small">…</p>
      <svg class="kn-icon kn-card-arrow" …>…</svg>                     <!-- iconHtml('arrow-right', 'kn-card-arrow') -->
    </article></li>
  </ul>
</nav>
```

Without an intro the `<nav>` has no label and no `aria-labelledby`.

**Markdown.**

```markdown
:::cards{type="navigation"}

Where next

### [Our plans](/plans/)

What each plan holds.

:::
```

**Read from content.** As for cards. **Behaviour.** None. **Component.** Card's `link` variant in Card Grid.

### `picture="behind"`

**Markup.** `data-kn-picture="behind"` on the series; each card with a picture takes `surfaceOf('behind-card', ground)`, whatever else it is.

```html
<div class="kn-card-grid kn-cards" data-kn-picture="behind">
  <article class="kn-card" data-kn-surface="picture-dark">
    <img class="kn-card-picture" src="…" alt="…">
    <h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="…">A heading</a></h3>
    <p class="kn-card-text" data-kn-type="small">…</p>
  </article>
</div>
```

**Read from content.** *(CSS)* The text on the picture, over the Surface's checked scrim. A card without a picture in the series is drawn as an ordinary card.

**Behaviour.** None. **Component.** Card, with a picture Surface.

### `symbol="item"` and `symbol="heading"`

**Markup.** `data-kn-symbol` on the series. A card's picture is then a symbol in `.kn-card-symbol`: by the card, first in it, for `item`; in the heading, before its words, for `heading`.

```html
<div class="kn-card-grid kn-cards" data-kn-symbol="heading">
  <article class="kn-card">
    <h3 class="kn-card-heading" data-kn-type="heading-5"><span class="kn-card-symbol"><img src="…" alt=""></span>A heading</h3>
    <p class="kn-card-text" data-kn-type="small">…</p>
  </article>
</div>
```

The symbol is the image as the core writes it, an `<img>`, its alternative text empty, since it is decorative beside the heading that names the card. *(Corrected 2026-11-12: this said the core writes small SVG files inline, which then follow the text's colour; it writes every image as an `<img>`, so a symbol keeps its own colours, and the accent `cards.css` gives an inline `<svg>` reaches only one a page writes itself.)*

**Markdown.** Each card's picture, before or after its heading, is its symbol:

```markdown
:::cards{symbol="item"}

### Sowing

![A seed](../media/seed.svg)

When and how deep.

:::
```

**Read from content.** *(CSS)* A symbol is shown whole, with its proportions, in a box the same on every card for its place, however large its file.

**Behaviour.** None. **Component.** Card. New: the part `.kn-card-symbol`.

## `accordion`

**Markup.** Accordion's markup, each item a `<details>` whose `<summary>` holds the item's heading, at its own level. The intro stands before it as written.

```html
<div class="kn-accordion" data-kn-accordion-mode="single" data-kn-questions>
  <details class="kn-accordion-item" name="accordion-1" open>
    <summary class="kn-accordion-summary">
      <h3 class="kn-accordion-label" data-kn-type="heading-6">How long does it take?</h3>
      <svg class="kn-icon kn-accordion-chevron" …>…</svg>               <!-- iconHtml('chevron-down', 'kn-accordion-chevron') -->
    </summary>
    <div class="kn-body-text kn-accordion-content">…</div>
  </details>
</div>
```

- `first="open"` writes `open` on the first item; `closed` and none write it on no item.
- `expand="one"` writes `data-kn-accordion-mode="single"` and one `name`, unique on the page, on every item; `many` and none write `multiple` and no `name`.
- `data-kn-questions` where `allQuestions` holds for the items' headings.

**Markdown.**

```markdown
:::accordion{first="open" expand="one"}

### How long does it take?

A season, from sowing to the first harvest.

### What does it cost?

Less than a dinner out.

:::
```

**Read from content.** *(CSS, with the questions fact.)* An accordion of questions is drawn as questions and answers (owner, 2026-11-10).

**Behaviour.** The browser's own: `name` keeps one open at a time, and an answer opens at once, with no animation, in every engine (the owner, 2026-11-11).

**Component.** Accordion, its FAQ look superseded above.

## `tabs`

**Markup.** An exclusive group of `<details>`, the first open: the intro names the tabs, each item's heading is a tab's `<summary>`, and what follows it the tab's panel, its headings raised a level.

```html
<div class="kn-tabs" role="group" aria-labelledby="tabs-1">
  <div class="kn-tabs-label" id="tabs-1"><p data-kn-type="label">Our plans</p></div>
  <details class="kn-tabs-item" name="tabs-1" open>
    <summary class="kn-tabs-tab">Small</summary>
    <div class="kn-tabs-panel">
      <div class="kn-tabs-text">…paragraphs, pictures…</div>
      <div class="kn-tabs-parts">…an accordion, a list…</div>
    </div>
  </details>
  <details class="kn-tabs-item" name="tabs-1">
    <summary class="kn-tabs-tab">Large</summary>
    <div class="kn-tabs-panel">…in order…</div>
  </details>
</div>
```

- Every `<details>` of one tabs carries the same `name`, unique on the page, so the browser keeps one open; the first carries `open`.
- Without an intro there is no `.kn-tabs-label`, no `role` and no `aria-labelledby`.
- Where `panelParts` gives a grouping, the panel's blocks stand in `.kn-tabs-text` and `.kn-tabs-parts`; otherwise they stand directly in `.kn-tabs-panel`, in order.
- A tab's heading keeps its block's mark on its `<summary>`.

**Markdown.** The intro is the tabs' label; a heading under a tab is written a level below the tab's, and raised:

```markdown
::::tabs

Our plans

### Small

A balcony's worth of pots and seeds.

#### What you get

:::list{type="values"}

- Pots
  - Six

:::

### Large

An acre, a shed and the tools for both.

::::
```

**Read from content.** *(CSS)* Each `<details>` gives way to its summary and its `::details-content`: the summaries stand in a row that wraps, as tabs, and the open panel takes the whole line under them; in right-to-left the row runs from the right. A tab's text and its components stand in two columns (owner, 2026-11-10), where the panel has both groups; a panel of anything else keeps its order in one column. A browser without `::details-content` draws each summary over its own panel, as an accordion. In print every panel shows under its tab's name.

**The line across the tabs** (*(design)*, the owner, 2026-11-12; components.md, The owner's review of a site built with the components). The design's `tabs.rule-place` says where the rule across the whole width stands. `below`, the default: under the row of tabs, at the top of the open panel, the open tab's bar standing on it. `above`: between the label and the row of tabs, the open tab's bar lying on it, centred on the hairline, the panel following half the component gap below with no rule of its own, so a tab is drawn as a value under it is, a rule, a label and the content; each tab hangs from the rule, its corners round at its foot, and its fill under the pointer starts at the rule and leaves it whole. A row that wraps has the rule under its last line, or, above, a rule over each of its lines, across the whole width, so that an open tab on a later line has its bar on its own line (since 0.6.0, below). The lines of a row that wraps stand 0.5em apart under either choice, so the open tab's bar, at its foot or its head, lies nearer its own label than the label of a tab on the next line, and a row of one line stands as before. **The HTML is the same for both:** the generated core writes the choice on the root as `--kn-tabs-rule-place`, and `tabs.css` reads it by a style query, so a site writes nothing for it and changes nothing when the design does (the assistant's choice, as How the design reads content, above, has it for every look). A design file resolved before 0.5.0 has no `tabs`, and its tabs keep the rule below. A browser without `::details-content` reads the tabs as an accordion with the line under each tab, whichever the design chose.

**Behaviour.** The browser's own, with no script (the assistant's choice, 2026-11-10, replacing `tabs.js`, by the owner's principle). A click, Enter or Space on a tab opens it and closes the others; a click on the open tab keeps it open, while Enter or Space on it closes it, as on any disclosure. Tab moves through the tabs in document order, each followed by what its open panel holds. **Given up:** the arrow keys, Home and End between tabs and the roving `tabindex` of the ARIA tabs pattern; a screen reader hears each tab as a disclosure, expanded or collapsed, not as a tab of a tab list. A link to something in a closed panel opens it, as the browser opens any `<details>` that holds a link's target.

**Component.** Tabs, moved out of "Not now" (components.md).

## `toc`

**Markup.** A Reading Area whose Aside holds a sticky Aside Block with a following menu, and whose flow holds the items, each heading carrying its anchor. It stands in a section's body.

```html
<div class="kn-reading-area" data-kn-side="start" data-kn-stack="before">
  <div class="kn-reading-area-aside">
    <aside class="kn-aside-block" data-kn-sticky="true">
      <nav class="kn-toc" aria-labelledby="toc-1" data-kn-type="small" data-kn-follow>
        <p class="kn-toc-label" id="toc-1" data-kn-type="heading-6">In depth</p>
        <ol role="list"><li><a href="#first-part">The first part</a></li><li><a href="#second-part">The second part</a></li></ol>
      </nav>
    </aside>
  </div>
  <div class="kn-reading-area-flow">
    <h3 id="first-part">The first part</h3>
    <p>…</p>
    <h3 id="second-part">The second part</h3>
    <p>…</p>
  </div>
</div>
```

The intro is the menu's label; without one, the `<nav>` takes an `aria-label` in the site's language, the page's context's word `contents`, "Contents" by default.

**Markdown.**

```markdown
:::toc

In depth

### The first part

Words on the first part.

### The second part

Words on the second part.

:::
```

One paragraph before the first heading is the label, and nothing else stands there.

**Read from content.** *(CSS)* As Reading Area and Table of Contents. `data-kn-side="start"` puts the menu before the text. An Aside Block that begins with a table of contents has no rule above it, so the menu's label stands level with the text (the owner, 2026-11-12).

**Behaviour.** No script (the owner's principle, 2026-11-10). The menu stands on a rail along its links and stays in view as Reading Area keeps its Aside, and nothing marks the section being read. ***Removed* by the owner, 2026-11-11, under his rule that a site behaves the same in Gecko, WebKit and Chromium:** the assistant's choice of 2026-11-10, `scroll-target-group: auto` on `.kn-toc[data-kn-follow]`, by which a browser with CSS scroll markers marked the link whose section was being read with `:target-current`, drawn as the rail's accent; only Chromium had them (Firefox 157 and Safari 27.2 had neither).

**Component.** Reading Area, Aside Block and Table of Contents, which gains `data-kn-follow`, with no runtime.

## `choice`

**Markup.** An exclusive group of `<details>`, none open: the intro names the answers; each item's heading is an answer's `<summary>`, and what follows it the answer's panel, its headings raised a level.

```html
<div class="kn-choice" role="group" aria-labelledby="choice-1">
  <div class="kn-choice-label" id="choice-1"><p>Do you have an account?</p></div>
  <details class="kn-choice-item" name="choice-1">
    <summary class="kn-choice-answer" data-kn-surface="raised">Yes</summary>
    <div class="kn-choice-panel" data-kn-surface="raised">…more than a form…</div>
  </details>
  <details class="kn-choice-item" name="choice-1">
    <summary class="kn-choice-answer" data-kn-surface="raised">No</summary>
    <div class="kn-choice-panel"><form class="konzilo-form" …>…</form></div>
  </details>
</div>
```

- Every `<details>` of one choice carries the same `name`, unique on the page; none carries `open`.
- The intro stands as written in `.kn-choice-label`; without one there is no label, no `role` and no `aria-labelledby`.
- Every answer takes `surfaceOf('choice-answer', ground)`. A panel that holds more than a form takes `surfaceOf('choice-panel', ground)`; a panel of only a form takes none. *A form in an answer waits for the core* (The components, What only the core can draw): until then the checks refuse it.

**Markdown.** The intro is the question; a heading under an answer is written a level below the answer's, and raised:

```markdown
:::choice

Do you have a garden?

### Yes

#### Then plan it

What to sow first, and when.

### No

Start with a balcony: [see the small plan](/plans/small/).

:::
```

**Read from content.** *(CSS)* The answers are big buttons side by side, each at least 14rem, none chosen beforehand, their number setting their columns so that no answer stands alone on a row: two for two or four, three for any other number, fewer where the window holds fewer at 14rem (the assistant's choice after 0.6.1, which the owner may veto; four answers fell three and one); an answer with more than a form stands on a plate (owner, 2026-11-10). The chosen answer is marked, and its panel takes the whole line under the answers. A browser without `::details-content` puts each panel under its own answer; in print every panel shows under its answer. A section holding a choice is read by rule 3.

**Behaviour.** The browser's own, with no script (the assistant's choice, 2026-11-10, replacing `choice.js`). A click, Enter or Space chooses an answer and shows its panel alone; a click on the chosen answer keeps it chosen, while Enter or Space on it closes it, as on any disclosure. A link to something in a panel chooses its answer, as the browser opens any `<details>` that holds a link's target. **Given up:** the runtime's scrolling of a panel that opened far below the window into view.

**Component.** New: Choice.

## Text with a role

### `::eyebrow`

**Markup.** A label over a heading, in the heading's group:

- in a hero's or a section's head: `<p class="kn-heading-group-eyebrow" data-kn-type="label">`, in the `hgroup`;
- in a card: `<p class="kn-card-eyebrow" data-kn-type="label">`;
- in a fact box: `<p class="kn-fact-box-label" data-kn-type="label">`, a plain label;
- before a heading anywhere else, such as in a panel: the eyebrows and the heading in `<hgroup class="kn-heading-group">`, as in a head;
- with no heading after it: `<p data-kn-type="label">`.

In a section's body, which the core draws, eyebrows right before a heading join it in `<hgroup class="kn-heading-group">` all the same, the section adding the classes (The components).

**Markdown.** Its words in brackets, on a line of their own, right before its heading:

```markdown
::eyebrow[A guide]
```

**Read from content.** None beyond its place. **Behaviour.** None. **Component.** Heading Group, Card and Fact Box.

### `::small`

**Markup.** `<p class="kn-fine-print" data-kn-type="small">`, where it stands.

**Markdown.**

```markdown
::small[Free for the first month, and you may stop whenever you like.]
```

**Read from content.** *(CSS)* Under a hero's actions it is their note; after a form, `form + .kn-fine-print`, it is the form's terms, standing with the form; after a choice, `.kn-choice + .kn-fine-print`, it is the terms of the forms its answers hold, standing with it (the assistant's choice, 2026-11-10: the contract named only a form).

**Behaviour.** None. **Component.** New: Fine Print.

### `::breadcrumbs`

**Markup.** Breadcrumb Navigation's markup, its steps from the core's `breadcrumbs()` and its look from `breadcrumbProps(design.resolved.breadcrumbs, …)`:

```html
<nav class="kn-breadcrumbs" aria-label="Breadcrumb" data-kn-type="small" data-kn-separator="slash" data-kn-home="word" data-kn-current="false" data-kn-narrow="trail">
  <ol role="list">
    <li><a href="/"><svg class="kn-icon kn-breadcrumbs-house" …>…</svg><span class="kn-breadcrumbs-label">Home</span></a></li>
    <li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><a href="/guides/"><span class="kn-breadcrumbs-label">Guides</span></a></li>
    <li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><span aria-current="page">This page</span></li>
  </ol>
</nav>
```

- The markup is Breadcrumbs.astro's, with the design's settings (components.md, How breadcrumbs show): `data-kn-separator`, `data-kn-home` and `data-kn-narrow` from `breadcrumbProps`, and the house, `iconHtml('house', 'kn-breadcrumbs-house')`, always first in the first step, shown only where `data-kn-home="icon"`, its word then kept for a screen reader. `aria-label` is the component's default, "Breadcrumb", or the same in the site's language. *(Corrected 2026-11-10: the example had "Breadcrumbs" and lacked the house and `data-kn-narrow`; the component, its test and the design's settings were right.)*
- The page's own level is always the last item. Where the core marks it hidden, by the setting for the page's type, the trail carries `data-kn-current="false"` and keeps the level in the markup, since the narrow form, the way up one level, counts from it. Otherwise `data-kn-current` is the design's `current`.
- A trail with no step but the start page left to show is none: nothing is written, so a hidden current level needs three levels for a trail.
- The trail stands directly before the page's H1 (components.md, The H1, the trail and the hero's heading): first in the hero's text, where the editor writes it.
- Its levels are the page's context's, as the core's `breadcrumbs(entry, Astro.url)` gives them; its first step's word is the start page's name there, and its name for a screen reader the context's word `breadcrumb`.

**Markdown.**

```markdown
::breadcrumbs
```

**Read from content.** *(CSS)* `data-kn-current="false"` hides the last item. **Behaviour.** None. **Component.** Breadcrumb Navigation, which must count only the steps it shows when it decides there is no trail.

## `::post-list`

The core lists the posts at each build and gives them to the presentation the site declares. Each presentation writes teaser cards: a post's teaser image, its category over its teaser headline as a label, its teaser headline as the card's only link, and its teaser text.

```html
<article class="kn-card" data-kn-surface="raised">
  <img class="kn-card-picture" src="…" alt="…">
  <p class="kn-card-eyebrow" data-kn-type="label">A category</p>
  <h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="…">A teaser headline</a></h3>
  <p class="kn-card-text" data-kn-type="small">A teaser text.</p>
</article>
```

A teaser card is a link as a whole, so it takes `surfaceOf('link-card', ground)`; a post of a type with no address is an open card, its headline no link.

- **Its parts** (the assistant's choices, 2026-11-12): the picture is the post's teaser image, else its featured image, made by Astro's `getImage()` at three widths with `srcset` and `sizes`; the label is the name of its category, else its eyebrow; the headline is its teaser headline, else its main headline, else its title; the text is the core's `ownSummary()`: its excerpt, else its teaser's text, else its standfirst.
- **One root.** Each presentation writes one `div.kn-post-list`, with its mark in the live preview. The core's pager, where the list has pages of its own, stands last in it, after the cards, as the core's `Pager.astro` writes it, from the pager's data. A list that matches nothing writes the list's text in it, `<p>`, and nothing else.

**Markdown,** the core's own: the presentation by its name, and its options after the list's attributes:

```markdown
::post-list{type="article" number="9" presentation="filtered" filters="category topics search"}
```

### `presentation="cards"`

**Markup.**

```html
<div class="kn-post-list" data-kn-presentation="cards">
  <div class="kn-card-grid kn-cards">…teaser cards…</div>
</div>
```

**Read from content.** *(CSS)* As cards: the number sets the columns. The core's pager, `nav.konzilo-pager`, where the list has pages, stands a column gap under the cards, inside the list or right after it, as a section's body spaces its parts (fixed after 0.6.1; it stood at the component gap, close under the cards). **Behaviour.** None. **Component.** New: Post List, of Card and Card Grid.

### `presentation="featured"`

**Markup.** The latest first, its heading larger, then the next two.

```html
<div class="kn-post-list" data-kn-presentation="featured">
  <div class="kn-featured">
    <article class="kn-card" data-kn-surface="raised">…<h3 class="kn-card-heading" data-kn-type="heading-3">…</h3>…</article>
    <article class="kn-card" data-kn-surface="raised">…</article>
    <article class="kn-card" data-kn-surface="raised">…</article>
  </div>
</div>
```

**Read from content.** *(CSS)* The first large, the next two small beside it; any further posts follow as the small ones. **Behaviour.** None. **Component.** Post List.

### `presentation="filtered"`

**Rows** (***decided* by the owner, 2026-11-12**, replacing one row of topics): Visitor Filters over the cards, in rows. Each taxonomy the list filters by is a row of pills, and search is a row of its own. Choices on one row are joined by OR and the rows by AND, so a topic chosen and then a search searches only within that topic. Which rows a list has is chosen where it is placed, from the taxonomies its posts' type takes and search; a site writes them in a fixed order, whatever order they were chosen in: the category, then the topics, then any other taxonomy of the site's in the order its description declares them, and search last (the order is the assistant's, from the owner's own example: Category, Topics, Search). A list placed with no rows chosen has one row of topics, as before. **A row the page settles is left out:** on a category's page the list has no category row, and on a topic's page no topic row; an author's page keeps them all, since authors are no row.

**Markup.**

```html
<div class="kn-post-list" data-kn-presentation="filtered">
  <form class="kn-visitor-filters" role="search" method="get" action="/search/">
    <input type="hidden" name="type" value="article">                     <!-- with a search row: what the list settles -->
    <input type="hidden" name="category" value="guides">                  <!-- and what the page settles, on a term's page -->
    <div class="kn-visitor-filter-panel">
      <fieldset class="kn-visitor-filter-group"><legend>Category</legend>
        <div class="kn-visitor-filter-toggles">
          <label class="kn-pill"><input type="checkbox" name="category" value="guides" aria-controls="posts-1" data-kn-match="1-1">Guides</label>
          <label class="kn-pill"><input type="checkbox" name="category" value="news" aria-controls="posts-1" data-kn-match="1-2">News</label>
        </div>
      </fieldset>
      <fieldset class="kn-visitor-filter-group"><legend>Topic</legend>
        <div class="kn-visitor-filter-toggles">
          <label class="kn-pill"><input type="checkbox" name="topics" value="planning" aria-controls="posts-1" data-kn-match="2-1">Planning</label>
          <label class="kn-pill"><input type="checkbox" name="topics" value="costs" aria-controls="posts-1" data-kn-match="2-2">Costs</label>
        </div>
      </fieldset>
      <div class="kn-field kn-visitor-filter-search">
        <label class="kn-field-label" for="posts-1-search">Search</label>
        <div class="kn-visitor-filter-input"><svg class="kn-icon" …>…</svg><input class="kn-field-control" id="posts-1-search" name="q" type="search"></div>
      </div>
      <button class="kn-button kn-visitor-filter-submit" type="submit" data-kn-variant="outline">Search</button>
    </div>
    <p class="kn-visitor-filter-count" data-kn-type="small">Showing 12 articles</p>
  </form>
  <div class="kn-card-grid kn-cards" id="posts-1">
    <article class="kn-card" data-kn-surface="raised" data-kn-item data-kn-matches="1-1 2-1 2-2">…</article>
  </div>
</div>
```

- **A row of pills** is a `fieldset.kn-visitor-filter-group` with its `legend`, the taxonomy's name in the site's language, and a `.kn-visitor-filter-toggles` of pills. A pill is a checkbox in its label, `name` the taxonomy's query key, its own name (`category`, `topics`, or a site's own taxonomy's), and `value` the term's slug, with `aria-controls` the list's `id`. Its terms are those of every post the list matches, on every page, where the core gives them (its `list`), else those of the posts on the page; the terms with the most posts first, then by name, at most 24. *(Changed 2026-11-12, with the core: a taxonomy's query key is its own name, so `topics` where the example had `topic`.)*
- **Its legend** is the page's context's word for the taxonomy, "Category", "Topic" and "Author" by default, and another taxonomy's name.
- **Keys.** A pill's `data-kn-match` is `g-v`: `g` the row's place among the rows of pills, from 1, and `v` the term's place in its row, from 1. A card's `data-kn-matches` holds the keys of all its terms, in every row, separated by spaces. `filterKeys`, `filterGroups` and `itemMatches` in `components/visitor-filters.js` give both at build, with the rows of pills as `toggles` in their order. The stylesheet knows 3 rows of 24 (`FILTER_GROUPS`, `FILTER_VALUES`).
- **The search row** is Visitor Filters' search field, `.kn-field.kn-visitor-filter-search`, its `label` the site's word for search and its field `name="q"`, last among the rows, followed by the submit button with the site's word for search. Without a search row the button is the same with the site's word for show, and the stylesheet hides it.
- **Where a search goes.** With a search row, the form's `action` is the site's search page, and the form begins with a hidden field for what the list itself settles, the posts' type as `type`, and on a term's page one for the term the page settles, by its taxonomy's query key, so that a search from a category's page searches only within that category. Without a search row the form has no hidden field and `action=""`. The search page and the type are the core's `list` where it gives them, else the page's context's `search` and `types`; a list that knows no search page leaves its search row out, saying so at the build.
- **The count** is the core's total, over every page, where it gives it ("Showing 9 of 17 articles"), else the posts on the page ("Showing 9 articles"), in the page's context's words.
- **What a page settles.** A term's page, which calls the presentation itself, gives it `settled: { taxonomy, term }`, and the core gives it the same, with `list`, from a version that has them.

**Read from content.** *(CSS)* The rows over the cards, as Visitor Filters draws them: each row of pills spans the panel, the field of the search row stands up to 30rem wide with the button beside it, as high as the field, and under it in a panel of 15rem or less. **Behaviour.** No script (the owner's principle, 2026-11-10). With no pill checked every card shows; pills checked on one row show the cards with any of them, and pills on another row narrow those to the cards with one of that row's too, by CSS alone (components.md, Visitor Filters). A search sends the form, as an ordinary GET form, to the site's search page with `q`, every checked pill and the hidden fields, which answers with the posts that match all of them; nothing filters the cards as the visitor types, which would need a script. A form of pills alone needs no "Show", so the stylesheet hides it. The count is the server's: it stands while no pill differs from how the page was sent and steps aside once one does, since nothing can count again; it is no live region. A screen-reader user hears each pill's state as a checkbox, and the cards that do not match are `display: none`, so they leave the accessibility tree and reading on finds only the matching cards. The columns stay those of all the cards while pills narrow them (cards.css). **Component.** Post List, with Visitor Filters, which takes `hidden` for the hidden fields. ***Superseded* (the assistant's choice, 2026-11-10):** the pills were submit buttons with `aria-pressed`, the form carried `data-kn-for`, `data-kn-page-size` and `data-kn-count-text`, the count was a polite live region, a pagination place followed it, and each card carried `data-kn-filter` as JSON, all for `visitor-filters.js`, which is gone; the Konzilo core writes the markup above instead.

## `::form`

**Markup.** The form as the core writes it, `form.konzilo-form` (konzilo.md), standing directly where the directive stands, with any fine print after it.

**Read from content.** *(CSS)* Rules 1 to 3 of a section read it. **Behaviour.** The core's. **Component.** `konzilo.css`, in Form's look.

## An article

An article's page is laid out by its fields, not by directives: an opening, the body with its following menu, and "Read more". The page parts `ArticleOpening`, `ArticleBody` and `ReadMore` write them, from what the template has from the core (The page parts), and a type of the site's own made like an article takes them too.

### The opening

**Markup.** A Hero, its picture the main image:

```html
<section class="kn-band kn-hero kn-article-opening" …the design's hero attributes…>
  <div class="kn-band-content kn-hero-content">
    <div class="kn-hero-text">
      <nav class="kn-breadcrumbs" …>…</nav>
      <hgroup class="kn-heading-group">
        <p class="kn-heading-group-eyebrow" data-kn-type="label">The eyebrow, or the category</p>
        <h1 class="kn-heading-group-heading" data-kn-type="heading-1">The main headline</h1>
        <p class="kn-heading-group-subheadline">The subheadline</p>
        <p class="kn-heading-group-deck" data-kn-type="lead">The standfirst</p>
      </hgroup>
      <p class="kn-article-meta" data-kn-type="small">
        <span class="kn-article-line">By <span class="kn-article-byline"><a href="/author/a-writer/">A. Writer</a></span> • Published <time class="kn-article-date" datetime="2026-10-10">10 October 2026</time> in <a class="kn-article-category" href="/category/guides/">Guides</a></span>
        <span class="kn-article-topics"><a class="kn-pill" href="/topic/soil/">Soil</a><a class="kn-pill" href="/topic/tools/">Tools</a></span>
      </p>
    </div>
    <div class="kn-hero-media"><img src="…" alt="…"></div>
  </div>
</section>
```

- The headline is in up to three parts: the eyebrow above the main headline, and the subheadline under it.
- The category stands over the headline as its label, unless the article has an eyebrow.
- **The meta line** (***decided* by the owner, 2026-11-12**, in his words for an article, its own names left out, "By [the author] • Published [the date] in [the category] • [THE TOPIC]", the author's name and the category as links and the topic as a pill; replacing three spans the design parted, which did not match the sentence the core writes) is two parts in `p.kn-article-meta`:
  - `.kn-article-line`, the core's line, written by the format its type has in the site's settings (the core's ADR 0062), such as `By {authors} • Published {date} in {category}`, or the core's default, `Published on {date} in {category} by {authors}`: the format's own words as text, and each variable's value an element of its own. The authors are `span.kn-article-byline`, each author a link to the author's page where authors have pages, with the core's words between them; the published date is `time.kn-article-date` with its `datetime`; the category is `a.kn-article-category`, a link to the category's page, or a `span` where categories have no pages. A variable the format does not name, or the article lacks, is left out with its words, as the core's writer drops it. The order and the words, the bullet between "By A. Writer" and "Published" included, are the format's, the site's own.
  - `.kn-article-topics`, after the line, the article's topics, each `a.kn-pill` linking to its topic's page, in the article's order; absent where the article has none.

**Read from content.** *(CSS)* The meta line is small and muted. The byline's and the category's links are underlined in its colour and turn the text colour under the pointer; a topic is a pill in the label style, filled in the button colours, underlined under the pointer. A bullet the design draws parts the topics from the line, staying with the line, so a wrapped meta line never starts with one, and the pills stand 0.4em apart. **Behaviour.** None. **Component.** Hero and Heading Group. New: the parts `.kn-heading-group-subheadline` and `.kn-article-meta`, with `.kn-article-line`, `.kn-article-byline`, `.kn-article-date`, `.kn-article-category` and `.kn-article-topics`, and the class `kn-article-opening`.

### The body and its following menu

**Markup.** A band holding a Reading Area, its Aside the following menu "In this article", its flow the body:

```html
<section class="kn-band kn-article-body">
  <div class="kn-band-content">
    <div class="kn-reading-area" data-kn-side="start" data-kn-stack="before">
      <div class="kn-reading-area-aside">
        <aside class="kn-aside-block" data-kn-sticky="true">
          <nav class="kn-toc" aria-labelledby="article-menu" data-kn-type="small" data-kn-follow>
            <p class="kn-toc-label" id="article-menu" data-kn-type="heading-6">In this article</p>
            <ol role="list"><li><a href="#a-crosshead">A crosshead</a></li><li><a href="#in-short">In short</a></li></ol>
          </nav>
        </aside>
      </div>
      <div class="kn-reading-area-flow kn-body-text">
        <p>The lede…</p>
        <h2 id="a-crosshead">A crosshead</h2>
        <p class="kn-question"><strong>What did you find?</strong></p>
        <p>…</p>
        <aside class="kn-fact-box" id="in-short" data-kn-surface="tint">…</aside>
      </div>
    </div>
  </div>
</section>
```

- The body is a lede, the paragraphs before the first crosshead, and then sections, each a crosshead, `h2`, with what follows it. The lede is body text with no look of its own.
- The menu's stops, in document order, are every crosshead and every fact box with an `id`; its label is in the site's language. With fewer than two stops there is no menu, and no Aside (the assistant's choice, 2026-11-12, as Table of Contents writes nothing for fewer than two headings).
- **The interview's question:** a paragraph whose only content, apart from white space, is one `<strong>` carries the class `kn-question`.

**Read from content.** *(CSS)* Crossheads and the headings under them take the article's steps, which the design sets by place, so the body's headings carry no `data-kn-type`. A question is drawn as an interview's question.

**Behaviour.** Only a browser's own scroll markers mark the section being read, as for `toc`; the Reading Area's CSS places the menu and keeps it in view, with no script.

**Component.** Reading Area, Aside Block, Table of Contents with `data-kn-follow` and no runtime, Fact Box and Body Text. New: the class `kn-article-body` and the part `.kn-question`.

### "Read more"

**Markup.** A section of up to three teaser cards, chosen by the core's rule, under a heading in the site's language, and a lone main action to the rest:

```html
<section class="kn-band kn-section">
  <div class="kn-band-content">
    <header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" data-kn-type="heading-2">Read more</h2></hgroup></header>
    <div class="kn-section-body kn-body-text">
      <div class="kn-card-grid kn-cards">…up to three teaser cards…</div>
      <ul class="kn-actions" role="list"><li><a class="kn-action" href="…" data-kn-main>More articles</a></li></ul>
    </div>
  </div>
</section>
```

**Read from content.** *(CSS)* As a section and its series: a lone card keeps its column, and the action shows more of the series. **Behaviour.** None. **Component.** Section, Cards and Actions.

## Open

- **A deck in a section with a choice.** The directive list says a paragraph is no deck where it leads to a form. The rule above also takes a choice, as the directive list's own build does, since a choice's answers usually hold forms; a section with a choice is centred as a page's end either way.
- **The trail's last level.** The core hides it by a setting per type, and the design has `current`. The core's setting wins where it hides the level; elsewhere the design's holds.
- **"All topics".** Visitor Filters shows every card when no pill is checked and lets several be checked, so `filtered` has no "All" pill in any row, and checking two topics shows the cards of either.
- **Which rows a filtered list has** (2026-11-12). *Settled 2026-11-12:* an option of the presentation, `filters`, which a site declares in its description as a string with the control `text` (konzilo.md), and the core hands the presentation as any option: the rows' names apart by spaces, from `category`, `topics`, a site's own taxonomy's name and `search`, such as `filters="category topics search"`; the presentation writes the rows in the fixed order above whatever order they are given in.
- **More than 24 terms.** The stylesheet knows 24 keys a row (components.md, Visitor Filters), so a row of `filtered` shows the 24 terms with the most posts. Whether a site with more wants another way in is open.
- **Captions in cards.** A picture in a card, a hero, a section's media or a logo band has no caption; the core's intake does not refuse one yet.
