# The directives

Records the HTML contract between the directive list Konzilo defines and this design system: for every directive and variant, the HTML a site writes, the `kn-` classes and attributes it carries, what the design reads from the content, and the runtimes that give it behaviour.

## Roles

***Decided* by the owner, 2026-11-10:**

- **The directive list Konzilo defines** decides which parts exist and the structure and meaning of their HTML. Its examples' colours, type steps and picture shapes are illustrative only.
- **This design system decides every look:** colour, type, space, columns and states. Everything here works for any design the tool can make, light or dark, in any colours and any typefaces.
- **The site writes only HTML**, with this package's classes (`kn-*`), text types (`data-kn-type`) and Surfaces (`data-kn-surface`). This file names the class of every part. A site's own classes are its own CSS and no part of this contract.
- **Behaviour belongs to this design system:** tab switching, choosing an answer, one-open accordions, marking the section being read in the following menu, and a head that stays as the page scrolls. It ships as small runtimes, as the header, the footer and consent do.
- **The owner's decisions on look**, made with the directive list, bind this design system and override earlier specs where they clash (Superseded, below).

***The assistant's choices, 2026-11-10:*** the following menu "In this article" marks the section being read, and fact boxes (`aside`) stand in the reading column, not in the Aside.

## How the design reads content

***The assistant's choice, 2026-11-10***, of three options: (a) the CSS infers every layout from semantic HTML with `:has()`; (b) the package exports a pure function that a site calls at build to get a `data-kn-layout` value; (c) a mix. **The choice is (c), in three channels:**

1. **Markup.** The site writes what the content is: the elements, the classes of the parts, and a grouping by position, such as a section's head or a tab's text, by the rules in this file. `sectionParts` and `panelParts` implement those rules, so no site writes them again.
2. **Facts.** What lies in text, which no selector can see, a pure function of `@kntnt/konzilo-design/directives` states at build, and the site writes it as a `data-kn-*` fact about the content: a deck longer than a line, headings that are all questions, a link whose text is a telephone number, a link to a known service, the numbering of a list's level. A fact never names a layout.
3. **Readings.** Everything else the stylesheet reads from the markup with `:has()`, sibling and child-count selectors: a section's layout, a series' columns, a card that is a link as a whole, a card with an action among cards without, a lone main action after a series.

**Why.** The HTML stays a description of the content, the same for every design. The decisions stay in this package's CSS, so a design or a later version changes a layout without the site changing a line or knowing a rule. A page written by hand, in the gallery, the tool or a site outside Konzilo, gets the same layout from the same HTML. Only text needs a function, and the function states a fact, so a design stays free to do something else with a long deck. Option (b) was rejected because a `data-kn-layout` value writes the design's decision into the HTML, which every page must then be rebuilt to change and every hand-written page must compute; (a) alone cannot see a deck's length or a heading's question mark.

**The one exception is a Surface.** A Surface is an attribute (names.md, decision 3), and a stylesheet cannot put one on an element. Where the design puts a part on a plate of its own, the site writes the Surface that `surfaceOf` returns, so that choice too stays in this package.

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
| `surfaceOf(part, ground)` | The Surface kind for a part the design puts on a plate, or `null`. `ground` is the Surface kind of the band around it, `undefined` for the page. |
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
- **No inline style and no `<style>`.** A site's content security policy may refuse them, and every reading here is in the stylesheet.
- **No image in a stylesheet.** The core's policy refuses an image at a `data:` address (konzilo.md, Logos), so a mark the design draws is either drawn with borders and gradients, as `konzilo.css` draws a select's arrow, or written as an Icon with `iconHtml`.
- **The page's own Surface writes nothing.** `surface="page"`, the default of a section, writes no `data-kn-surface`, so the page's fill shows and adjoining bands join as page.md says.

### Superseded

- **Card Grid's columns** (components.md, How a component is built, Links and layout): in a card series from the directives, the number of cards sets the columns, three or four, whichever leaves the last row fuller, and two cards stand in two (owner, 2026-11-10, via the directive list). Card Grid's `columns` holds for other uses, and on a window too narrow for four a directive series makes the same choice between three and two, then two and one (owner's rule, applied by the assistant, 2026-11-10); Card Grid's own `data-kn-columns="4"` still falls straight to two for other uses.
- **Accordion's FAQ** (components.md, Owner's component review): an accordion whose headings are all questions is drawn as questions and answers, a look of its own read from `data-kn-questions` (owner, 2026-11-10, via the directive list). `faq` on the Astro component still adds only structured data.
- **Table of Contents' "no scroll-spy is added"** (components.md, Navigation): the following menu marks the section being read (the assistant's choice, 2026-11-10, above). A Table of Contents without `data-kn-follow` stays as it was.

## The body of a page

A post's body is a sequence of bands (page.md, point 3): heroes and sections. A run of blocks at the top level outside a hero or a section is written as a section without a Surface, as if the editor had put `:::section` around it, so a list of logos alone at the top stands in a band of its own.

The runtimes below are modules in `@kntnt/konzilo-design/components/`. A site's layout imports each one it uses and calls its setup once; each finds its parts in the document and does nothing where there are none.

| Runtime | Setup | For |
|---|---|---|
| `section.js` | `setupSections()` | A head that stays beside an accordion |
| `tabs.js` | `setupTabs()` | Tabs |
| `choice.js` | `setupChoices()` | A choice |
| `table-of-contents.js` | `setupFollowingMenus()` | The following menu of `toc` and an article |
| `reading-area.js` | `setupReadingAreas()` (existing) | The Reading Area of `toc` and an article |
| `visitor-filters.js` | `setupVisitorFilters()` (existing) | The post list's `filtered` |

### Behaviour in a live preview

***Specified* with the Konzilo core's contract for its live preview, 2026-11-10:**

- **Blocks keep their mark.** In a preview the core writes `data-konzilo-block` on every block of a body, its value a path within containers and lists, such as `2.1`. Markup that renders a directive keeps the attribute on the blocks it is given. No selector of this package reads it, and none is broken by it: an attribute on any element changes no layout, which `test/directives-section.test.js` checks over every directive's fixture.
- **What holds a selected block opens.** When an editor selects a block in a field, the page dispatches a bubbling `konzilo-preview-show` event from that block (`PREVIEW_EVENT` in `tabs.js` and `choice.js`). `setupTabs()` selects the tab whose panel contains `event.target`, and `setupChoices()` chooses the answer whose panel contains it, so a block in a tab inside an answer opens both. Neither scrolls: bringing the block into view is the preview's (the assistant's choice, 2026-11-10). The core opens a `<details>` itself, so an accordion needs nothing, and `setupSections()` does nothing.
- **It costs nothing where the parts are absent.** Each runtime listens once, on the document, and only where it found something to enhance.

## `hero`

**Markup.** The Hero's markup, with its choices from the design (`heroProps(design.resolved.hero, …)` and `heroAttributes`), and the directive's `surface` in place of the design's `inputs.hero.surface` for this page. Where the design puts the picture behind the text and the hero has one, the picture's Surface takes the place of both, as `heroProps` says.

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
- The first paragraph is the deck. The last picture is the hero's picture, in `.kn-hero-media`; a picture before the text is a logo, `.kn-hero-logo`, first after the trail, drawn 4rem high at its own proportions, as a section's badges are, so an SVG with only a `viewBox` shows too (the assistant's choice, 2026-11-10). Everything else follows the heading group in the order written.
- Where the design's `inputs.hero.picture` is `none` and the hero holds a picture, it stands at `end`, Hero's default side, since content the editor chose is never dropped.
- `surface` takes `page` (no attribute), `raised` (the default), `inverse`, `tint`, `brand` or `accent`.

**Read from content.** *(CSS)* Fine print right after the actions is a note under them. A hero without a picture has no `.kn-hero-media`, and its text takes the content width as Hero's choices say.

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

**Space in the body** *(the assistant's choice, 2026-11-10; the directive list is silent)*: a part with a class of its own stands a column gap from what is next to it, whatever space it gives itself in other flows, so a description list, a value list and actions are spaced as cards are. A label written as a list's intro, `<p data-kn-type="label">`, stands at the component gap over its part, as the labels of Logos and of cards that lead on do. A heading group in the body, as a panel's eyebrow and heading, is spaced as a heading: room above it and a little under it, close to what it heads. Fine print stands at the component gap after a form or a choice, as their terms.

**Read from content.** *(CSS, with the deck fact.)* The stylesheet reads the six rules of the directive list from the groups, the first that matches deciding. `C` below is `.kn-section > .kn-band-content`, and a series is `:is(.kn-cards, .kn-cards-nav, .kn-timeline, .kn-reasons, .kn-post-list)`: cards that lead on stand in their `<nav>`, so the nav stands for them in the body. *(Corrected 2026-11-10: the list lacked `.kn-cards-nav`, which `section.css` and `cards.css` already read.)*

| | The section holds | Read by | The design draws |
|---|---|---|---|
| 1 | A picture first | `C:has(> .kn-section-media)` | The picture beside the head and body, its badges with it. With a form in the body, `C:has(> .kn-section-body > form)`, the picture is what the form offers. |
| 2 | A heading with a form right after it | A head with neither deck nor actions, and `.kn-section-body > form:first-child` | The form beside the heading, with any fine print under the form. |
| 3 | Another form or a choice | `C:has(> .kn-section-body > :is(form, .kn-choice))` | The whole section centred, as a page's end. A form, its button and its terms after it, and what a chosen answer shows, keep the start edge, so labels, fields and the button read down one edge (the assistant's choice, 2026-11-10). |
| 4 | A head, its actions and an accordion | A head, and `.kn-section-body > .kn-accordion:only-child` | The head beside the accordion, staying in view as the page scrolls. |
| 5 | A head and paragraphs only | A head, and a body of `p` elements only | The paragraphs beside the head. |
| 6 | A head and a series | A head, and a series in the body; the first series decides | The head centred over `.kn-reasons`, over cards without a `.kn-card-picture` or `.kn-card-symbol`, or over exactly two cards. The heading beside its deck where the deck has `data-kn-deck="long"`, and the series has pictures and five cards or more, which is more than one row at three or four columns. Otherwise the head above. |
| – | Anything else | | The head above the body. |

On a narrow window everything beside stands above and below in document order. Rule 2 lets eyebrows stand over the heading, which the directive list's wording allows; rule 4 also holds with no actions, which is how the directive list's own build reads it.

**Behaviour.** Rule 4's head stays in view under the header as the page scrolls, at `--kn-reading-sticky-inset`, and only while it fits in the window below the header. `setupSections()` measures that, as `reading-area.js` does for a sticky Aside Block, and writes `data-kn-sticky="true"` on the `.kn-section-head` that may stay; without the runtime the head scrolls with the page.

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

**Read from content.** *(CSS)* Its eyebrow is a plain label, its heading small and a list in it in small type, with the design's bullets. In an article, a fact box with an `id` is a stop in the following menu, its heading the stop's name.

**Behaviour.** None of its own; the following menu marks it as it marks a crosshead.

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

A value may be a link, such as `tel:`, kept as written.

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

**Read from content.** *(CSS)* The logos stand in a band under their label (owner, 2026-11-10). At the top level, the list stands in a section of its own (The body of a page).

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
- **A number or an address:** a paragraph whose only content is one link, for which `contactOf(href, text)` gives a kind, carries it on the link as `data-kn-contact`.

**Read from content.** *(CSS, with the contact fact and the Surfaces above.)*

- The number of cards sets the columns: two for two, three for one or three, and from four on three or four, whichever leaves the last row fuller, four where both do alike (owner, 2026-11-10). With `n` cards from four on that is three where `n` is 5, 6 or 9 more than a multiple of 12, and four otherwise, which child-count selectors read: `:has(> :nth-child(12n+5):last-child)` and so on.
- A card is open, with the design's hairline, unless it is a link as a whole, which stands on its plate and lifts on hover (owner, 2026-11-10).
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

The symbol is the image as the reader writes it: an `<img>`, or an inline `<svg>` where the core writes small SVG files into the page, which then follow the text's colour.

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

**Read from content.** *(CSS, with the questions fact.)* An accordion of questions is drawn as questions and answers (owner, 2026-11-10).

**Behaviour.** The browser's own: `name` keeps one open at a time, and the animation is Accordion's.

**Component.** Accordion, its FAQ look superseded above.

## `tabs`

**Markup.** The ARIA tabs pattern: the intro names the tabs, each item's heading is a tab's button, and what follows it the tab's panel, its headings raised a level.

```html
<div class="kn-tabs">
  <div class="kn-tabs-label" id="tabs-1"><p data-kn-type="label">Our plans</p></div>
  <div class="kn-tabs-list" role="tablist" aria-labelledby="tabs-1">
    <button class="kn-tabs-tab" type="button" role="tab" id="tabs-1-tab-1" aria-controls="tabs-1-panel-1" aria-selected="true">Small</button>
    <button class="kn-tabs-tab" type="button" role="tab" id="tabs-1-tab-2" aria-controls="tabs-1-panel-2" aria-selected="false" tabindex="-1">Large</button>
  </div>
  <div class="kn-tabs-panel" role="tabpanel" id="tabs-1-panel-1" aria-labelledby="tabs-1-tab-1" tabindex="0">
    <div class="kn-tabs-text">…paragraphs, pictures…</div>
    <div class="kn-tabs-parts">…an accordion, a list…</div>
  </div>
  <div class="kn-tabs-panel" role="tabpanel" id="tabs-1-panel-2" aria-labelledby="tabs-1-tab-2" tabindex="0">…in order…</div>
</div>
```

- Without an intro there is no `.kn-tabs-label` and no `aria-labelledby`.
- No panel carries `hidden`: the runtime hides them, so without it every panel shows.
- Where `panelParts` gives a grouping, the panel's blocks stand in `.kn-tabs-text` and `.kn-tabs-parts`; otherwise they stand directly in the panel, in order.

**Read from content.** *(CSS)* A tab's text and its components stand in two columns (owner, 2026-11-10), where the panel has both groups; a panel of anything else keeps its order in one column. Under `@media (scripting: enabled)` only the first panel shows before the runtime has run, so the page does not jump.

**Behaviour.** `setupTabs()` marks `data-kn-enhanced` on `.kn-tabs` and shows only the selected panel, `hidden` on the others. A click or Enter selects a tab; the arrow keys along the list, logical in right-to-left, and Home and End move between tabs and select, with a roving `tabindex`. A live preview's `konzilo-preview-show` from a block in a panel selects its tab (Behaviour in a live preview).

**Component.** Tabs, moved out of "Not now" (components.md).

## `toc`

**Markup.** A Reading Area whose Aside holds a sticky Aside Block with a following menu, and whose flow holds the items, each heading carrying its anchor. It stands in a section's body.

```html
<div class="kn-reading-area" data-kn-side="start" data-kn-stack="before" data-kn-columns="1">
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

The intro is the menu's label; without one, the `<nav>` takes an `aria-label` in the site's language.

**Read from content.** *(CSS)* As Reading Area and Table of Contents. `data-kn-side="start"` puts the menu before the text.

**Behaviour.** `setupFollowingMenus()` marks the section being read: on each `.kn-toc[data-kn-follow]` it gives `aria-current="true"` to the link whose target is the last to have passed the reading line, `--kn-reading-sticky-inset` below the window's top, and to the first before any has; it follows scrolling, resizing and `kn:headerchange`. Its decision is an exported pure function, `currentStop(tops, line)`. Reading Area's own runtime places the Aside and its stickiness.

**Component.** Reading Area, Aside Block and Table of Contents, which gains `data-kn-follow` and its runtime.

## `choice`

**Markup.** The intro names the answers; each item's heading is an answer's button, and what follows it the answer's panel, its headings raised a level. No answer is chosen.

```html
<div class="kn-choice">
  <div class="kn-choice-label" id="choice-1"><p>Do you have an account?</p></div>
  <div class="kn-choice-answers" role="group" aria-labelledby="choice-1">
    <button class="kn-choice-answer" type="button" aria-expanded="false" aria-controls="choice-1-answer-1" data-kn-surface="raised">Yes</button>
    <button class="kn-choice-answer" type="button" aria-expanded="false" aria-controls="choice-1-answer-2" data-kn-surface="raised">No</button>
  </div>
  <div class="kn-choice-panel" id="choice-1-answer-1" data-kn-surface="raised">…more than a form…</div>
  <div class="kn-choice-panel" id="choice-1-answer-2"><form class="konzilo-form" …>…</form></div>
</div>
```

- The intro stands as written in `.kn-choice-label`; without one there is no label and no `aria-labelledby`.
- Every answer takes `surfaceOf('choice-answer', ground)`. A panel that holds more than a form takes `surfaceOf('choice-panel', ground)`; a panel of only a form takes none.
- No panel carries `hidden`, as for tabs.

**Read from content.** *(CSS)* The answers are big buttons, none chosen beforehand; an answer with more than a form stands on a plate (owner, 2026-11-10). The chosen answer is marked. Under `@media (scripting: enabled)` no panel shows before the runtime has run. A section holding a choice is read by rule 3.

**Behaviour.** `setupChoices()` marks `data-kn-enhanced` on `.kn-choice` and hides every panel. A click on an answer gives it `aria-expanded="true"`, the other answers `false`, and shows its panel alone; a click on the chosen answer keeps it chosen. A live preview's `konzilo-preview-show` from a block in a panel chooses its answer (Behaviour in a live preview).

**Component.** New: Choice.

## Text with a role

### `::eyebrow`

**Markup.** A label over a heading, in the heading's group:

- in a hero's or a section's head: `<p class="kn-heading-group-eyebrow" data-kn-type="label">`, in the `hgroup`;
- in a card: `<p class="kn-card-eyebrow" data-kn-type="label">`;
- in a fact box: `<p class="kn-fact-box-label" data-kn-type="label">`, a plain label;
- before a heading anywhere else, such as in a panel: the eyebrows and the heading in `<hgroup class="kn-heading-group">`, as in a head;
- with no heading after it: `<p data-kn-type="label">`.

**Read from content.** None beyond its place. **Behaviour.** None. **Component.** Heading Group, Card and Fact Box.

### `::small`

**Markup.** `<p class="kn-fine-print" data-kn-type="small">`, where it stands.

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

A teaser card is a link as a whole, so it takes `surfaceOf('link-card', ground)`.

### `presentation="cards"`

**Markup.**

```html
<div class="kn-post-list" data-kn-presentation="cards">
  <div class="kn-card-grid kn-cards">…teaser cards…</div>
</div>
```

**Read from content.** *(CSS)* As cards: the number sets the columns. **Behaviour.** None. **Component.** New: Post List, of Card and Card Grid.

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

**Markup.** Visitor Filters over the cards: one group of topic pills, each a post's topic, the topics with the most posts first, and each card an item with its topics.

```html
<div class="kn-post-list" data-kn-presentation="filtered">
  <form class="kn-visitor-filters" role="search" method="get" action="" data-kn-for="posts-1" data-kn-page-size="0" data-kn-count-text="Showing {count} articles">
    <div class="kn-visitor-filter-panel">
      <fieldset class="kn-visitor-filter-group"><legend>Topic</legend>
        <div class="kn-visitor-filter-toggles">
          <button class="kn-pill" type="submit" name="topic" value="planning" aria-pressed="false" data-kn-filter-name="topic">Planning</button>
        </div>
      </fieldset>
      <button class="kn-button kn-visitor-filter-submit" type="submit" data-kn-variant="outline">Show</button>
    </div>
    <p class="kn-visitor-filter-count" role="status" aria-live="polite" data-kn-result-count data-kn-type="small">Showing 12 articles</p>
    <div data-kn-pagination-host></div>
  </form>
  <div class="kn-card-grid kn-cards" id="posts-1">
    <article class="kn-card" data-kn-surface="raised" data-kn-item data-kn-filter='{"topic":["planning","costs"]}'>…</article>
  </div>
</div>
```

**Read from content.** *(CSS)* The pills over the cards, as Visitor Filters draws them. Its "Show" button is hidden from the start wherever script runs, and its empty pagination place takes no row, so the cards do not move when the runtime starts; without script the pills, which are submit buttons, still filter (the assistant's choice, 2026-11-10). **Behaviour.** `visitor-filters.js`: with no pill pressed every card shows; pressing pills shows the cards with any of their topics, and the count follows. Without script the pills submit the form. **Component.** Post List, with Visitor Filters.

## `::form`

**Markup.** The form as the core writes it, `form.konzilo-form` (konzilo.md), standing directly where the directive stands, with any fine print after it.

**Read from content.** *(CSS)* Rules 1 to 3 of a section read it. **Behaviour.** The core's. **Component.** `konzilo.css`, in Form's look.

## An article

An article's page is laid out by its fields, not by directives: an opening, the body with its following menu, and "Read more". The site writes it all.

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
        <span class="kn-article-date">Published <time datetime="2026-10-10">10 October 2026</time></span>
        <span class="kn-article-byline">By A. Writer</span>
        <span class="kn-article-category">A category</span>
      </p>
    </div>
    <div class="kn-hero-media"><img src="…" alt="…"></div>
  </div>
</section>
```

- The headline is in up to three parts: the eyebrow above the main headline, and the subheadline under it.
- The category stands over the headline as its label, unless the article has an eyebrow; then it stands in the meta line, in `.kn-article-category`.
- The meta line is the published date and the byline, each part a `span`.

**Read from content.** *(CSS)* The meta line's parts are separated by the design, as Content Card separates its metadata. **Behaviour.** None. **Component.** Hero and Heading Group. New: the parts `.kn-heading-group-subheadline` and `.kn-article-meta` with its three, and the class `kn-article-opening`.

### The body and its following menu

**Markup.** A band holding a Reading Area, its Aside the following menu "In this article", its flow the body:

```html
<section class="kn-band kn-article-body">
  <div class="kn-band-content">
    <div class="kn-reading-area" data-kn-side="start" data-kn-stack="before" data-kn-columns="1">
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
- The menu's stops, in document order, are every crosshead and every fact box with an `id`; its label is in the site's language.
- **The interview's question:** a paragraph whose only content, apart from white space, is one `<strong>` carries the class `kn-question`.

**Read from content.** *(CSS)* Crossheads and the headings under them take the article's steps, which the design sets by place, so the body's headings carry no `data-kn-type`. A question is drawn as an interview's question.

**Behaviour.** `setupFollowingMenus()` marks the section being read, as for `toc`; `setupReadingAreas()` places the menu and keeps it in view.

**Component.** Reading Area, Aside Block, Table of Contents with `data-kn-follow`, Fact Box and Body Text. New: the class `kn-article-body` and the part `.kn-question`.

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
- **"All topics".** Visitor Filters shows every card when no pill is pressed and lets several be pressed, so `filtered` has no "All topics" pill and pressing two topics shows the cards of either.
- **Captions in cards.** A picture in a card, a hero, a section's media or a logo band has no caption; the core's intake does not refuse one yet.
