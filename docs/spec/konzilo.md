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
- **A tarball in the site's repository, with the fonts copied separately.** The owner reckoned on about 1 MB for a version upgrade. The tarball measured 0.29 MB at 0.8.0, the directives' and page parts' components among it, and the fonts a design uses, about 0.3 MB a file, change only when the design does. A test holds the tarball under 2 MB.

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
- It checks the format, the fingerprint, the schema and the contrast, and refuses in plain words. It also refuses if a font the design uses is missing, or the formulas' font, which every design has (Formulas, below), or the file of a logo the design has, naming the command.
- It writes the generated core CSS to `node_modules/.cache/konzilo-design/<name>.core.css`, only when that changes. Astro's dev server does not watch it: restart it after changing the design.

It returns only these three:

- `bodyStyles`, in the core's form, where `./…` is a path from the site's root and anything else a package's stylesheet by name:
  1. `./node_modules/.cache/konzilo-design/<name>.core.css`, the generated core
  2. `@kntnt/konzilo-design/body-styles.css`, the reset, the body text and tables
  3. `@kntnt/konzilo-design/konzilo.css`, the look of what the core writes
  4. `./design/fonts/fonts.css`, the design's typefaces, where it uses any of the library's, and the formulas' font, so every design has it (since issue #33)
- `tokens`: `{ colors: { primary: '--kn-theme-primary', base: '--kn-theme-base' } }`. The core reads a token from `:root` or `html`, outside any conditional rule, and its `opaqueColor()` cannot read `light-dark()`, so `coreCss` writes these two as literals: the primary brand seed exactly, and the light page colour.
- `images`: the widths, sizes and aspect ratio in which the design draws an image, by each context the core names, as its `konzilo({ images })` takes them (Images, below).

It does not return `directives` or `presentations`, which a site spreads from `DESIGN_DIRECTIVES` and `DESIGN_PRESENTATIONS` beside its own and takes only as its description declares them, or `bodyClass`, which does not exist yet.

## Images

***Built* 2026-11-26, for issue #36 (the owner's triage: the design hands the core a few fixed widths and a `sizes` for each context it draws an image in, derived from the same values its CSS uses; the shape is the core's, Kntnt/konzilo#113 and its ADR 0022).** The core makes each image it shows from its master in fixed widths, its versions, and writes them in `srcset` with `w` descriptors beside a `sizes`, so a browser loads the narrowest version at least as wide as it draws the image, at the screen's density. Only the design knows how wide it draws an image, so `fromDesign` returns `images`, `{ body, gallery, lightbox, hero, card }`, each `{ widths, sizes }` and, where the design crops the context's pictures, `ratio`. `imageContexts(resolved)` in `src/konzilo/images.js` works them out, and `@kntnt/konzilo-design/konzilo` exports it too.

**Derived, not set by hand** (the owner's triage, which he may veto). Every width a context is drawn at is a function of the window's width made of the design's own values, the side margin and the gaps as the clamps the generated CSS writes, read back from it with `fluidLine`, and Wide, Narrow, halves and least values of them, as the CSS combines them. Between its bends each is a straight line, so a `sizes` says it exactly: one stretch per run of windows, from the widest window down, each `(min-width: <edge>rem) <length>`, the length in rem, vw or both in `calc()`. A design that changes a measure changes its `sizes` with it. The lengths the CSS draws by that the design file does not hold are constants beside the derivation, `GALLERY`, `CARD`, `SWITCH` and `HERO_STACKED`, and a test holds each to its stylesheet.

| Context | Where the design draws it | Default design's `sizes` | Widths (default design) | Ratio |
|---|---|---|---|---|
| `body` | A figure in a body's text: the reading column, Narrow, or the content area where that is narrower (page.md, The Reading Area; `konzilo.css`) | `(min-width: 48.6363rem) 45rem, calc(94.2858vw - 0.8572rem)` | 360, 509, 720, 1018, 1440 | none |
| `gallery` | A gallery in that column, at its widest column: two where two of at least 12rem fit, the component gap apart, else one (`konzilo.css`, the series' rule) | four stretches, two columns from 27.5604rem | 360, 509, 720, 1018 | `4:3` |
| `lightbox` | The core's lightbox, which fits the whole picture in the window: at most the window's width | `100vw` | 360, 509, 720, 1018, 1440, 2036, 2520 | none, which the core requires |
| `hero` | A hero's picture where the design's `hero.picture` puts it (`hero.css`): behind the text across the window; beside it half the content area less half the column gap, or from the middle to the window's edge where it bleeds; above the text, the content area's or the window's width, on a window up to 40rem; `none` as `end`, where a page's picture then stands; counted as a picture of 16:9 cropped to cover its box at the design's height (The context counts a picture of 16:9, below) | `max(100vw, 88.8889vh)` (behind, half the window high) | 360 … 2520, behind the text and beside it | none |
| `card` | A card in a series across the content area, at its widest column: two where two of at least 15rem fit, the column gap apart, else one (`cards.css`) | four stretches, two columns from 35.5117rem | 360, 509, 720, 1018, 1440 | none: a card crops its own (The ratios, below) |

- **The widest of a series' columns** (the assistant's choice, 2026-11-26). A gallery and a series take their columns from their number of items, which a `sizes` cannot know, so theirs says the widest a column is drawn at each window, two items' columns, since a lone item takes a third: a gallery or a series of three or four gets a version a little wider than it draws. A series switches to two columns where `(2 × minimum + gap − row) × 999`, the CSS's switch, falls under half the row, at a row of `2 × minimum × 1998/1999 + gap`, a fifth of a pixel before the row is two minimums and a gap, and the `sizes` switches there too.
- **The edges** (the assistant's choice, 2026-11-26). A stretch that goes on from the one before starts at its edge, floored to a ten-thousandth of a rem. One that starts narrower than the one before, a series' second column or a hero's picture beside its text past 40rem, starts `0.002rem`, a 32nd of a pixel, past the edge: Chromium and WebKit tell a media query's length from a window's to about a 64th of a pixel (measured 2026-11-26), and there the wider of the two holds, so a `sizes` never says less than is drawn. The conditions are `min-width`, not ranges such as `(width >= 40rem)`, which Safari reads in a `sizes` only since 16.4, and which put a `>` in the attribute that a reader of the HTML stops at, as this package's tests did. Below 20rem, where the design's clamps start, the narrowest stretch goes on as it is, which says a little more than is drawn.
- **The widths: one ladder** (the assistant's choice, accepted by the owner, 2026-11-26). Every context's widths are steps of one ladder, a factor of √2 apart, two to each doubling, from Narrow, or Wide where that is narrower: 360, 509, 720, 1018, 1440, 2036 for the default design. So a body's image on a wide screen is made at exactly its width at density 1 and 2, 720 and 1440, the steps of two contexts never fall within a tenth of each other, which the core counts as near duplicates (its ADR 0022), and an image drawn in two contexts, as a body's image and its lightbox, shares its versions. A context takes the steps from the one that covers it at the narrowest window, 20rem, at density 1, to the one that covers its widest drawing at density 2, or the cap: a body's image is 288 px wide at 20rem and 720 px at most, so 360 to 1440. Worst, a version is √2 as wide as needed. So issue #36's third criterion, that a body's image at a narrow window loads "a version no wider than the design draws it", reads as the narrowest version that covers the drawn width (the owner, 2026-11-26), which is what a browser takes from a `srcset`.
- **The cap** is 2520 px, the core's widest version and its master's longest side, which `WIDEST` holds and the core refuses to exceed: no step stands within a tenth below it, and a context drawn across the window, the lightbox and a hero behind its text, ends there, so a hero across a wide, dense screen gets at most the master. A version is never wider than its master either; the core makes the master's own width in place of those above it.
- **The ratios** (the assistant's choice, accepted by the owner, 2026-11-26: a gallery's pictures cropped to 4:3 around their focal points, and a card naming no ratio; the core crops a context's versions to its ratio around each picture's focal point, its ADR 0022). A context the design crops every picture of to one ratio names it: a gallery's pictures `4:3`, the `aspect-ratio` with `object-fit: cover` of `.konzilo-gallery > figure img` in `konzilo.css`, the one rule of the package that draws a gallery's picture, so the files hold what is shown, around the point the editor chose rather than the middle CSS keeps. One it draws whole names none: a body's figure, the lightbox, which the core forbids one, and a hero, whose picture beside the text or behind it is as tall as the hero's share of the window makes it, so no one ratio holds; its `sizes` counts a picture of 16:9 (The context counts a picture of 16:9, below), which crops no file. Nor does a card (2026-11-26, after the review of the integration branch): `card.css` crops a card's picture to 16:9, but a person's card to a square, and `cards.css` a card with its picture behind its text to the card's own height, so a version cropped to 16:9 would be cropped again, and a person's lose its sides; with none, each card crops the whole picture as it draws it. A gallery cropped so has a second, hidden image of the whole picture in each figure, which the core takes out of the figure into the lightbox (`test/konzilo-build.test.js` holds that none is left on the page, where `figure img { display: block }` would show it).
- **What takes the body's context.** The core gives every image in a body the body's context, or a gallery's, since its reader knows no component's layout, so a picture the package's directives draw from a body, a section's photo, a hero's picture, a card's in `:::cards`, a logo, and a figure in a page section's body after its text, comes with the body's `sizes` and widths, with the lightbox's widths in its `srcset`. Each is drawn at its own width: a section's photo and a hero's picture beside its text at about half the content area; a card's at a column of a series, two or three times narrower than Narrow on a wide screen; a picture that bleeds to the window's edge, and a figure in a page section's body, as wide as half the window or the content area. So the package writes each such picture's own `sizes` where it draws it (Each picture's own sizes, below), and a hero's picture behind its text the band's (below).
- **Each picture's own sizes** (*built* 2026-11-26, for issue #38; the derivations are the assistant's, under the owner's triage of 2026-11-26). Wherever the package draws a picture from a body's tree or from the HTML the core drew, it writes in place of the body's `sizes` the width its CSS draws the picture at, derived in `src/konzilo/images.js` from the same design values and in the same way as the contexts' (Derived, not set by hand; The edges), so the two never disagree, and keeps the core's `srcset`, `width` and `height`. A picture with no versions, an SVG, which the core keeps as it is, keeps what the core wrote. `pictureSizes(resolved, picture, options)` gives each, `seriesPicture(resolved, count, options)` a series' item's with its widths, and `imageSizes()` in `src/konzilo/images.js` reads them for an image's attributes, the picture's proportions from the core's `width` and `height`, which `render.js` and `parts.js` write. Where the CSS crops a picture to cover its box, its `sizes` says how wide its proportions make it there (A picture cropped to cover its box, below):
  - *A section's photo* (`render.js`, `section()`; `parts.js`, `photoFrom()`) fills its media: from a window of 48rem beside the text, half the content area less half the column gap, and the content area below it (section.css, rule 1). Where `section.picture-side` sets it corner to corner, which the section does to a photo with neither badges nor a form in its body, exactly half the content area from 48rem, or, with `corners-bleed`, half the window, and the window's width below 48rem. One a form in the section's body offers is shown whole, at most 16rem wide, 26rem from 48rem, and no wider than its column. `sectionLayout()` in `src/directives/section.js` reads which from the section's blocks, by section.css's rules, and names each one of `SECTION_LAYOUTS`, which the sizes, the Details page and its words read too. Beside the text a cropped photo covers a box that grows with the text, up to a square and 85svh, and corner to corner one as tall as its band.
  - *A section's badges*: 4rem high and as wide as their proportions make them, at most 8rem.
  - *A figure in a section's body*, the directive's, from its slot or its tree, the page parts' `Section` and a page's loose blocks: at most its own width and the body's (konzilo.css): across the content area; beside the photo, half the content area less half the column gap from 48rem, or, beside a photo corner to corner, half the content area less the column gap; at Narrow, where the section is centred or holds a form or a choice (rule 3); or three fifths of the content area less the column gap, after a form beside the heading (rule 2). The page parts take the design from the page's context, which `Section` reads where the template called `designPage()`, and without it keep the core's `sizes`.
  - *A hero's picture beside its text*: the `hero` context's drawing for its side, half the content area less half the column gap, from the middle to the window's edge where it bleeds, and above the text the content area's width or the window's, on a window up to 40rem; covering a box as tall as the hero's height makes it, by the hero's `height`, the directive's or the design's.
  - *A hero's picture behind its text*: the band's, as wide as the window and as tall as the hero's height makes it (A hero's picture behind its text, below).
  - *A hero's logo*: 4rem high and as wide as its proportions make it, at most 16rem and its text's width.
  - *A logo in a list of logos*: as high as the list's logos, from 2.5rem on the narrowest window to 4.5rem at 90rem, and as wide as its proportions make it, at most four times as wide (logos.css).
  - *A card's picture in `:::cards`*, in each of its layouts, with its picture behind the text and in a series of navigation too: the width an item of a series of so many cards is drawn at in the place it stands in, where the part around it knows it, and else the widest in any place a series stands in (A series by its number of items; The place it stands in; The widest place it stands in, below), cropped to 16:9 of its width, or behind the text to the card, at least 20rem high.
  - *A figure a part passes through*, in an accordion's answer, a tab, a choice's panel, a fact box, a hero's text, a card's words, a step of a timeline or a reason, a list's intro or a table of contents' flow: at most its own width and the room the parts it stands in leave it (A part's room, below).
  - *A card's symbol*: shown whole in its box, by the card twice as wide as high at 1.25 times a heading 2's size, in the heading a square of 1.25em of the card's heading, a heading 5 (cards.css). A heading's size is the owner's formula, the body size times the base to the power of its step, which bends, so its `sizes` follows it in straight pieces between nine windows of the type's breakpoints, whose chords lie on it or above.
- **A series by its number of items** (the owner's triage, 2026-11-26). The renderer knows how many cards it draws, so a card's `sizes` is that of the columns `cards.css` gives that number, not the widest column of any series, which the `card` context says: at most two for two; three for one, three, and 5, 6 or 9 more than a multiple of 12; and four for any other, falling to two for 4 more than a multiple of 6 and to three otherwise. Each switches where its term times 999 falls under its share of the row, k columns from a row of k × minimum × 999k / (999k + 1) + (k − 1) × gap. `seriesPicture(resolved, count)` gives a series' `sizes` and its widths, the ladder's steps from the one that covers it on the narrowest window at density 1 to the one that covers its widest at density 2, `seriesPicture(resolved, count, { place })` its own in a place (The place it stands in, below), and `seriesPicture(resolved, count, { list: true })` a post list's teasers' (A post list's teasers, below). For the default design on a 90rem window, a series of three across a band says 22.92rem, as it is drawn, and loads the 509 px version, 1018 px at density 2, and a series of four says 16.41rem and loads 360 and 720 px, where the body's 45rem loaded 720 and 1440 px; where no part says where they stand, they say 23.57rem and 20.94rem, the widest of their places.
- **The place it stands in** (*built* 2026-11-26, for issue #44; ***decided* by the owner, 2026-11-26**: make the `sizes` exact where the package can know the place, and keep the widest of all places where it cannot; nothing may say less than is drawn). A card's picture in `:::cards`, of navigation and behind its text too, a teaser's in the presentations `cards`, `featured` and `filtered`, and "Read more"'s say the width an item of so many is drawn at in the place they stand in, at every window, wherever the part around them knows that place. `seriesPicture(resolved, count, { place })` and `teaserPictures(resolved, presentation, count, ratios, { place })` give them, a place one of `SERIES_ROWS` or `{ accordion, questions }`; a place is a row and a gap, by section.css's rules:
  - `across` the content area; `beside` a section's photo, half the content area less half the column gap from 48rem (rule 1); `corners`, beside a photo corner to corner, half the content area less the column gap; `form`, after a form beside the heading, three fifths of the content area less the column gap from 48rem (rule 2); `narrow`, Narrow, or the content area where it is narrower (rule 3, a centred section, and an article's reading column); and `columns`, a column of a body in two of at least 18rem (`body="columns"`), where a lone teaser of `cards` fills its column, each at the column gap. In an accordion standing in one of them, or alone beside a section's head (`head`, three fifths from 60rem, rule 4), its answer's width, 1.5em narrower, or 2.5em where it is of questions, at the component gap.
  - *How the place is known.* A section knows its body's layout, by `sectionLayout()`, which also says whether it has a head and its body in columns. `withBodySizes()` in `render.js`, which gave the figures at the top of its body their `sizes`, now gives each series' pictures there, and in an accordion there, the `sizes` of that place (`withSeriesSizes()`), whether the section draws its body from its tree or gets it from its slot as the core drew it, so a post list's too, which only the slot holds: it reads a series' number of cards and whether its pictures stand behind the text from its grid, a list's presentation from its root, and each picture's proportions from its `width` and `height`; a picture with no versions keeps what it has. An accordion stands beside the head where it is the body's one element and the section has a head and no picture, centred or not, as section.css reads it; with an intro before its items it is not alone. A body in columns beside a photo, which no check refuses, is no place known, and keeps the widest. **The page parts say it themselves** (the assistant's choice, 2026-11-26, where the ticket offered an option to `designPage()` too: a part knows what it draws, so a template says nothing more, and a page whose template draws its body alone keeps what it had): `PageBody` puts a run of loose blocks in a section read by its rules, `Section` and a `TitleBand`'s body are read as a section's (so a figure at the top of a title band's body now takes a section body's `sizes` too, where it kept the core's, and says exactly the width drawn, under the title alone or a deck, across the content area, beside it after a form and at Narrow, in Firefox, WebKit and Chromium, a pixel either side of every edge, as `test/image-sizes.test.js` holds), `ArticleBody` puts its flow, and an accordion in it, in the reading column at Narrow, and `ReadMore`, which always stands across a band, makes its teasers by `readMorePicture()`, `seriesPicture(resolved, count, { list: true, place: 'across' })`.
  - *Its widths.* Where the picture is made for its place, they are the ladder's steps for that drawing, as "Read more"'s. A card's picture in `:::cards` keeps the core's versions, the body's and the lightbox's; a teaser of a presentation is made in the widths of the widest place a list stands in, since the presentation is drawn in the section's slot before the section, which nothing passes it, so its `srcset` holds a step or two more than its place needs, which a browser does not load, and its `sizes` is its place's.
  - *Where the widest stays.* Where no part says where a series stands: at the top of a body a template draws alone, `<Body>` without `PageBody` or `ArticleBody`, and in an accordion there, and a list a template places outside the page parts. There a series' `sizes` says the widest an item of so many is drawn in any place, as before (The widest place it stands in, below), so no site that builds today gets worse. A series deeper than a section's body, in a tab, a choice's panel, a fact box, a hero's text, a card's words, or an accordion in any of them, keeps its room's upper bound (A part's room, below).
  - So three cards across a band on a 64rem window say 17.9rem, the width they are drawn at, where the widest of their places said 31.11rem, and load 360 px at density 1 and 720 px at density 2, where they loaded 509 and 1018 px; a list of three teasers there too.
- **The widest place it stands in** (the assistant's choice, 2026-11-26, under the owner's triage: a series' `sizes` says the widest its picture is drawn in any place the package gives it, so it never says less than is drawn; since issue #44, only where no part says the place). Where no part says what a series stands in, its `sizes` says, at each window, the widest an item of so many is drawn in any of these places: across a band's content area; in a section's body beside its picture (rule 1), beside it corner to corner where the design sets pictures so, beside a heading with a form right after it (rule 2), at Narrow, as a centred section's or one with a form or a choice (rule 3) and an article's reading column are, and in two columns of at least 18rem (`body="columns"`, where a post list's teasers stand); and in an accordion in each of those but two columns, which holds none, and alone beside a section's head (rule 4), whose answer stands 1.5em narrower, or 2.5em where it is of questions, and whose series takes the component gap; the same places, by one list in `images.js`, as the Details page shows. *(Changed 2026-11-27, after the review of the integration branch, under the owner's rule of #44 that nothing may say less than is drawn: an accordion counted only across a band and beside the head, since #38, so where an accordion of questions beside a section's photo or a heading with a form, or at Narrow, holds one column while the rows around it hold two or three, a series' `sizes`, and the room of a figure in a card's words there, said up to about 200 px less than was drawn, between about 74rem and 80rem by the design. A series there now says that width; a post list, which stands in no accordion, is unchanged.)* A narrower row may hold fewer columns and so draw a wider item, so the band is not always the widest place: on a window between about 36rem and 74rem a series' `sizes` is mostly a narrower row's one-column width, up to twice the item across a band (three cards on a 64rem window: 31.11rem said, 17.9rem across a band), and a band's series there loads a step wider than it needs; on a wide window an accordion or Narrow is at most a little wider than the band. That is what the owner's decision of 2026-11-26 made exact wherever a part knows the place (The place it stands in, above); the browser test holds each place's own `sizes` to the width drawn there. A series deeper than these places, in a tab, a choice's panel, a fact box, a hero's text, another card, or an accordion within any of them, says an upper bound instead (A part's room, below), so it never says less than is drawn there either. A post list counts fewer places, since it stands in fewer (A post list's teasers, below).
- **A display width** (the owner's triage, 2026-11-26). An image the editor gave a display width comes with `width` and `height` at that width and each of its `sizes` no wider, by `min(…, <n>px)` (the core's `docs/site-design.md` and its `sizesNoWider()`). `displayWidthOf()` reads the width from the core's `sizes`, and `pictureSizes()` keeps the cap, by `noWider()`, where the package's CSS draws the picture no wider than its own width: a badge, a hero's logo and a photo a form offers, each at `inline-size: auto`, whose own width is its `sizes`', and a figure in a section's body, at most its `width`. It drops the cap where the CSS stretches the picture to its box whatever its width: a section's photo, a hero's picture beside its text, a card's picture and its symbol, and a logo in a list of logos, drawn at the list's height.
- **A picture cropped to cover its box** (the assistant's choices, 2026-11-26, after the review of the integration branch, under #38's rule that a `sizes` is never narrower than the picture is drawn). A picture the CSS crops by `object-fit: cover` is drawn as wide as its box, or, where the box is taller than the picture's proportions, as wide as the box's height times them, max(W, H × ratio), and loads a version for that width: a phone's hero half the window high draws a photo of 3:2 half again as wide as the window. So where the box's height follows from the design and the window, its `sizes` says the drawn width, each stretch `max(<box>, <height × ratio>)`, the height in vh, which every engine reads in a `sizes` (measured in Firefox, WebKit and Chromium, 2026-11-26) and which is never less than the svh the CSS sets heights by, so it never says less than is drawn, and `min(<cap>, …)` where the height grows to a cap. The picture's proportions are its `width` and `height`: the core's for a picture from a body, which it writes on every raster image it makes, and it refuses an editor's raw HTML, so no picture from a body comes without them; the master's for one made through `getImage()`, which Astro's import gives; and a `Band`'s or `Hero`'s `pictureWidth` and `pictureHeight`, which a `srcset` requires (A band's picture, below). **None is guessed** (the owner's decision, 2026-11-26, issue #42). A picture whose proportions were not known was taken as 16:9, `FALLBACK_RATIO`; the constant is gone, since no place remains where the package can neither know a picture's proportions nor ask for them. `pictureSizes()` and `bandPictureSizes()` refuse a cropped picture without them, in words naming them; `seriesPicture()`, `teaserPictures()` and `heroPictureOf()`, which give the widths and `sizes` of a picture made through `getImage()`, give none for one whose proportions are not given, which is no master, is made in no versions and is written as given (the assistant's choice, 2026-11-26). A picture shown whole, a badge, a logo or a symbol, whose proportions are not given, still says the widest the CSS lets it be, which is a bound, not a guess. Each box:
  - *A hero's band*, behind the text: as wide as the window and at least the hero's height, its share of the window's height less the header's, or all of it under a header the page starts under (`HERO_HEIGHTS`); the `sizes` takes the share of the whole window, the header's height not taken off, so on the default design's phone, 390 × 844, its band of 389.5 px draws a photo of 3:2 584 px wide, which `max(100vw, 75vh)` says as 633 px: it loads the 720 px version at density 1 and the 1440 px one at density 2, where `100vw` loaded 509 and 1018 px, shown 1.15 times enlarged, and at `full` more than twice.
  - *A hero's picture beside its text*: past 40rem its media is as tall as the hero less its band space above and below, and bleeding, out over that space and the header's height above it, at most its tallest, `headerMost()` (the taller of 4rem and the design's identity, logo, name and slogan as it stacks them, at their largest, with 0.75rem above and below and the hairline; `HEADER`, held to `header.css`); on a narrower window it stands above the text, at least 16:9 of its width, at most the hero less its band space and the column gap, and bleeding, with the header. The text's own height is not counted, so above the text on a phone the `sizes` says up to the text's height times the picture's proportions more than is drawn, about a step of the ladder.
  - *A section's photo* cropped beside the text from 48rem: up to a square of its width and 85% of the window's height (`SECTION.most`), so `max(W, min(W × ratio, 85vh × ratio))`; corner to corner, as tall as its band, which beside text no taller than 85svh is at most that, so `max(W, 85vh × ratio)`; on a narrower window, and with badges or offered, it is not cropped.
  - *A card's picture*: cropped to 16:9 of its width (`CARD.box`), so as wide as its card, times its proportions over 16:9 for a panorama; behind its text, the card, at least 20rem high (`CARD.behind`), so `max(item, 20rem × ratio)`. A post list's teasers so too, each by its own picture's proportions, and "Read more"'s.
  - *Where the box's height is the text's* (the assistant's choice, kept as it is by the owner's decision of 2026-11-26, issue #42). Where the text makes the box taller than the design does, no `sizes` can know how much, and the picture is drawn wider than its `sizes` says, by the text's height over the box's, so slightly enlarged from the version it loads, while its `sizes` keeps the design's height: a hero whose text is taller than its height, a band with no height of its own, a `Band` as tall as its text, whose picture says the window's width, a card whose words are taller than 20rem, a photo corner to corner beside text taller than 85svh, and `featured`'s latest post from a list of 50rem, which grows to the height of the two beside it by their words and says its 16:9 crop. A bound by the window's whole height, or more, would say twice what most of these draw, and load a version two steps too wide on every page to spare the few whose text runs long; so each says the design's own height, which its text fills on most pages, and the browser test holds each to the drawn width where the text fits, and no less where it is shorter.
  - *Where a cropped picture's box jumps*, as a section's photo at 48rem, `sizes` starts the new stretch a 32nd of a pixel past the edge on the side whose box is the wider (The edges), which beside a cropped picture may be the narrower drawing; it holds for that 32nd of a pixel alone.
  - *Its widths*: a picture made through `getImage()` whose `sizes` grows with the window's height, an article's opening, takes the ladder's steps up to the cap; one whose growth is capped, as a card's crop, those up to its widest at density 2.
  - *The context counts a picture of 16:9* (the owner's decision, 2026-11-26, issue #42). The `hero` context, which the core takes for every hero's picture it draws itself, names no ratio and crops no file, but its `sizes` and widths count a picture of 16:9 cropped to cover the hero's box at the design's height, as `heroPictureOf(resolved, { ratio: 16 / 9 })` draws it (`HERO_CONTEXT_RATIO`): `max(100vw, 88.8889vh)` for the default design's hero behind its text, half the window high, which on a phone 390 × 844 says 750 px. It said the box's width, `100vw` there, so a hero the core draws loaded a version narrower than it drew, as the package's own did before the review of #38. Now it covers any picture no wider than 16:9, and at worst, for a photo of 3:2, asks one step of the ladder wider than it needs; only a panorama is drawn wider than it says. Its widths reach the step that covers its widest drawing at density 2, or the cap, which a drawing that grows with the window's height takes: 360 … 2520 px for the default design, beside the text too, where they stopped at 1440 px. The package's own heroes, the directive's, `Hero`'s and an article's opening, write their picture's own, by its proportions. The Media page's numbers for it are those of a picture of 16:9 on a phone 844 px tall and a wide screen 900 px tall, `drawnWidths(resolved, px, high)`.
  - *What a box's width alone did*: WebKit draws a picture whose `sizes` says its box's width from a version it has scaled down to that width, so a picture taller in its proportions than its band came out visibly soft, beyond the screenshot test's limit, until its `sizes` said the drawn width (the assistant's finding, 2026-11-26, `test/picture-behind.test.js`).
- **A part's room** (the assistant's choice, 2026-11-26, after the review of the integration branch). A part drawn from its tree knows the parts it stands in, which `render.js` hands what it draws as `parts`, from the outermost in, and the pictures in it take `within` that: within the content area, an accordion's answer 1.5em in from its edges, the plain answer's, and a card's, a step's or a reason's words within an item of its series; a tab, a choice's panel, a fact box, a hero's text, a list's intro and a table of contents' flow within the room they stand in. A figure the part passes through as the core wrote it says that room, at most its own width, a display width's too: in an accordion across a band its answer's width, where it kept the body's, Narrow. A series in an accordion at the top of a section's body says the place the section gives it (The place it stands in), and where no part says, it is one of the places counted (The widest place it stands in); a series deeper says the widest an item of so many is drawn in any row no wider than its room, at the column gap or the component gap, the room's own item or the widest just short of a switch to more columns, an upper bound: three cards in a tab on a 90rem window say 33.11rem, a column just short of two, where across a band they are drawn 22.92rem.
- **The versions it finds** (the assistant's finding, 2026-11-26). The core gives a body's image the body's widths and the lightbox's, so its `srcset` holds every step of the ladder from the one that covers the body on the narrowest window at density 1 to the cap, 360 to 2520 px for the default design, and `test/image-sizes.test.js` holds for six designs that each picture above finds a version that covers its widest drawing at density 2, up to the cap. The gap is at the narrow end: a badge, at most 8rem, a hero's logo, at most 16rem, a logo in a list, 2.5 to 4.5rem high, and a card's symbol, about 1.4 to 4.7rem, are drawn narrower than the narrowest version, 360 px by default, so a raster one loads that version, up to sixteen times as wide as it is shown; most are SVGs, which have none. **Kept so** (the owner's decision, 2026-11-26, issue #42): such a raster picture loads the narrowest version, 360 px by default, with no smaller steps and no change to the core. The design could have added the ladder's steps below its first to the `body` context's widths, 90, 127, 180 and 255 px for the default design, which every image in a body would then be made in too, at some cost in build time and files; or the core could have given an image a part draws small widths of its own, which needs it to know where the part draws it.
- **What keeps the body's sizes.** A figure the core draws itself, at the top of a body or of a section's body the package does not draw, and a gallery anywhere. A figure the package passes through, in an accordion's answer, a tab, a choice's panel, a fact box, a hero's text, a card's words, a step of a timeline or a table of contents' flow, says its room (A part's room, above). *The core's own pictures*, out of the package's reach: a gallery in a section's body or in a component, which keeps the core's `gallery` context, the reading column's widest column, though across a band's content area on a wide window its columns are wider; a post list's teasers that a site's own presentation draws, where the package's own make theirs in the design's widths and sizes (A post list's teasers, below); and the lightbox's pictures, which the core draws in its `lightbox` context.
- **A hero's picture behind its text** (issue #40, 2026-11-26). It was a band's CSS background, which took the image's `src`, its widest version, 2520 px for the default design, at every window. It is an `<img>` behind the text (A band's picture, below), which keeps the core's `srcset`, the body's and the lightbox's widths, and takes the band's `sizes`, `pictureSizes(resolved, 'band', { height, ratio })`, the window's width, or, by the hero's height and the picture's proportions, as wide as that share of the window's height makes it: `max(100vw, 75vh)` for a photo of 3:2 in the default design's hero, half the window high, so a phone 390 × 844 loads the 720 px version at density 1 and the 1440 px one at density 2, and a wide screen of 1440 × 900 the 1440 px one (A picture cropped to cover its box, above). `bandPictureSizes({ height, ratio })` gives the same whatever the design, and a `Band` or `Hero` given a `srcset` works it out so, from the `pictureWidth` and `pictureHeight` it requires (A band's picture, below). An article's opening draws its main image behind its text the same way (An article's opening, below).
- **A post list's teasers** (*built* 2026-11-26, for issue #39, under the owner's triage of that day: the widths and `sizes` the design derives from its own measures, on the same ladder as every other picture; the derivations are the assistant's). The package's presentations of a post list, `cards`, `featured` and `filtered`, make each teaser's picture through Astro's `getImage()`, which on a site the core builds runs through the core's image service, so they choose its widths and `sizes` themselves, not the core's `card` context, which a site's own templates take through the core's `imageVersions()`. They were set by hand in `teasers.js`, `PICTURES`, off the ladder and not the design's CSS, such as a card `33vw` above 64rem whatever the design's widths, which loaded the 800 px version for a card drawn 367 px wide on a 1440 px window. Now `presentationHtml()` takes them from `teaserPictures(resolved, presentation, count)` in `src/konzilo/images.js`, one for each teaser, worked out as a series' are (A series by its number of items; The widest place it stands in; The edges), and keeps no import of Astro or the core. A presentation is drawn without knowing where it stands, so it makes its teasers in the widths and `sizes` of the widest place a list stands in, and the section around it, a page's loose blocks' too, then writes each teaser's `sizes` for the place it stands in, `teaserPictures(resolved, presentation, count, ratios, { place })` (The place it stands in, above; issue #44):
  - *In `cards` and `filtered`* a teaser is an item of a series of as many posts as the list draws, every one counted, the cards a filtered list's pills hide too, as the series' rule counts them (`cards.css`): `seriesPicture(resolved, count, { list: true })`, and in its place a series' there. The `card` context says the widest column of any series, two items', 35.9rem on a 90rem window for the default design, where three teasers in a row are drawn 22.9rem each.
  - *A lone teaser of `cards`* fills its column beside a quotation (`section.css`, `body="columns"`), half the content area less half the column gap where two columns of 18rem fit, where an item of a series of one takes a third of its row; so a list of one post in `cards` whose place no part says says the wider of the two, 35.94rem on a 90rem window, against 22.92rem for one in `filtered`; beside a quotation it says its column's, and anywhere else a series of one's.
  - *In `featured`* the list lays out by its own width, by container queries (`post-list.css`), which a `sizes` cannot read: one column under 32rem; from 32rem two, the latest across both; from 50rem three, the latest over two columns, `(2 × row − gap) / 3`; the column gap apart wherever it stands. So its row is worked out from the window for the place the list stands in, and where no part says it, its `sizes` is the widest at each window of every place, for the latest post and for the others apart: on a 90rem window the latest 48.96rem and the others 22.92rem, as wide as across a band. `FEATURED` holds the two widths, and a test holds them to the stylesheet. At 50rem and wider the latest post's picture grows to the height of the two beside it, by their words, and crops itself to that, so where its box is taller than the picture's proportions the picture is drawn a little wider than its box, while its `sizes` says its 16:9 crop's width (the assistant's choice, 2026-11-26: A picture cropped to cover its box, Where the box's height is the text's). Each teaser's picture is cropped to 16:9 of its card, so a panorama's says as wide as its proportions make that, which `teaserPictures(resolved, presentation, count, ratios)` takes from each post's master.
  - *Where it differs from a series* (the assistant's choice, 2026-11-26, under the triage's rule that a list's `sizes` says the widest the picture is drawn in any place the package gives it). A post list stands only directly in a section, which the checks hold it to, since a part drawn from its tree cannot draw one (directives.md, What only the core can draw); a page's loose blocks and a term's page put it in a section across a band, and an article's body in its reading column, at Narrow. So its places are a series' but an accordion's: across a band's content area, beside a section's photo, corner to corner where the design sets pictures so, after a form beside the heading, at Narrow, and in two columns. Without an accordion, a list of three whose place no part says, on a 90rem window, says what it draws across a band, 22.92rem, where a series of three cards says 23.57rem, and on a window of about 36rem a list does not say twice its width, as an accordion's one column made a series say; between about 36rem and 74rem a narrower row's one column is wider than the band's item, and there such a list across a band loads a step wider than it needs, as a series does. Where the section around it says its place, which it does for every list in a body the page parts wrap, it says exactly what it draws there, and the browser test holds it so in each place.
  - *"Read more"* (`ReadMore.astro`) draws its related posts as a series across a band, where it always stands, so it makes them by `readMorePicture()` in the widths and `sizes` of a list of so many posts there, `seriesPicture(resolved, count, { list: true, place: 'across' })`: exact, in the ladder's steps for that drawing (issue #44).
  - *Their widths* are the ladder's steps from the one that covers the teaser on the narrowest window at density 1 to the one that covers its widest at density 2, in the widest place a list stands in, which a presentation cannot know: 360 to 1440 px for a series in the default design and 360 to 2036 px for `featured`'s latest post, each asked for of its master by the core's rule against near duplicates (One file for a body's picture and a teaser's, below). *No crop*: the `card` context names no ratio (the owner, 2026-11-26), and neither does a teaser, since a card crops its own picture, so it is made whole, as before.
  - *One file for a body's picture and a teaser's* (the assistant's finding, 2026-11-26; the rule the owner's decision of 2026-11-26, issue #42). Astro names a version by the options it is made with, and the core's image service makes a teaser's and a body's at one width of one master with the same ones, WebP at the core's quality, so a picture an article shows in its body and a list shows as its teaser is made once at each width the two share, and both name the same file. The core makes a body's image by `versionWidths()` (Kntnt/konzilo `src/astro/image-versions.js`, its ADR 0022): no version above the master, and since the body asks for the lightbox's widths up to 2520 px, wider than its master, the master's own width in place of those and of any within a tenth below it (`NEAR_DUPLICATE`). A teaser asked for no width wider than the master, so the core made each as asked, 1440 px of a master 1600 px wide beside the body's 1600 px, a near duplicate the browser gains nothing from. Now `postPicture()` in `teasers.js` asks `getImage()` for a teaser's, "Read more"'s and an opening's widths by `masterWidths(widths, own)` in `src/konzilo/images.js`, beside the ladder: the core's rule against the master's width, whether or not a width asked for is wider than it, none above the master, or the cap where the master is wider, and the master's own width, or the cap, once, in place of each width above it or within a tenth below it. The core is not changed; the comment beside the rule names its file and says where the two differ. So three teasers of a 1600 px master ask for 360, 509, 720, 1018 and 1600 px, as the body has them, and share every version, and a 1000 px master gives 360, 509, 720 and 1000 px, as the core makes it. An opening's widths reach the cap, so the core already made the master's width in place of a near duplicate there; the rule changes an opening only where its widths stop below its master. Where the master's width is not known the widths stay as given, which no picture made through `getImage()` meets.
- **An article's opening** (*built* 2026-11-26, for issue #39). `ArticleOpening` makes the article's main image through Astro's `getImage()` in the widths and `sizes` of a hero's picture where the design puts it, `heroPictureOf(resolved, { ratio })`: behind the text the band's, beside it half the content area less half the column gap, or from the middle to the window's edge where it bleeds, and above the text on a window up to 40rem, each covering a box as tall as the design's hero height makes it, by the master's proportions (A picture cropped to cover its box), and the ladder's steps up to the cap, since its box grows with the window's height, asked for of its master by the core's rule against near duplicates (One file for a body's picture and a teaser's). It was made in 800 to 2400 px, with `sizes` of `50vw` beside the text on a window from 40rem and `100vw` behind it, and then for a while in the `hero` context's, the box's width. `openingPicture(image, ctx, getImage)` in `parts.js` makes it.
- **In the presentation** (2026-11-26). The Media page tells a client, in plain words and this design's numbers, how wide each context's picture is drawn on a phone and on a wide screen, the widths made of it, whether it is cropped and why the widths are what they are, and the Details page has each context's `sizes` (tool.md, Pictures at the right size), and beside them each `sizes` the design's parts write on a picture they draw from a body, `bodyPictures(resolved)`: a card's picture across a band by the number of cards, one to eight, those of one `sizes` together, and so behind its text, a section's photo and a figure in its body by the section's layout, a hero's picture behind its text or beside it, where the design puts it, and a logo, a badge and a symbol at their widest, a cropped picture's for a photo of 3:2, which its note says. The Media page says of a hero's picture that where the opening is taller in its shape than the picture, as on a phone, it is shown wider than its place, and a browser loads the version for that width; its numbers for an opening are a photo of 16:9 on a phone 844 px tall and a wide screen 900 px tall, `SKETCH_HEIGHTS` beside the windows the Page page draws (the heights the assistant's choice, as the examples here), so the default design's says 750 px on the phone (the owner, 2026-11-26, issue #42), and the Details page's note says the hero context's are for a picture of 16:9 and its teasers' for a photo of 3:2, which a card's crop draws as wide as the card. Under them, **cards and teasers in other places** (the assistant's form, 2026-11-26, issue #44), `placeRows(resolved)`: a row for each place besides across a band where a card's or a teaser's `sizes` differ from across a band, beside a photo, corner to corner where the design sets pictures so, after a form beside the heading, at Narrow, in a column beside a quotation, in an accordion in each of those but a column and alone beside a section's head, of plain answers and of questions, and where no part says where it stands, last; in each row what differs there, a card's picture by the number of cards, those of one `sizes` together, which a teaser in `cards` and `filtered` takes too, `featured`'s latest post and the others where a list may stand, and where no part says, a list's teasers by their number; a place where nothing differs, as Narrow where Narrow is wider than Wide, has no row. Under them, the widths and `sizes` of each teaser's picture the design's presentations of a post list make, `teaserRows(resolved)`: the widths of the widest place a list stands in, which a presentation cannot know, and the `sizes` across a band in `cards` and `filtered` by the number of posts, one to eight, and of `featured`'s latest post and the others, and of a lone teaser in `cards` beside a quotation, where it fills its column (issues #39 and #44). `drawnWidths(resolved, px)` in `src/konzilo/images.js` gives the widths drawn, from the same drawings as the `sizes`.
- **Tests.** `test/image-sizes.test.js` holds every context's `sizes` to the width the specs' words make it at every window from 320 to 3200 px for six designs, its widths to the ladder's rules, and, in Gecko, WebKit and Chromium, each `sizes` as the browser reads it to the width the package's CSS draws the picture at, a pixel either side of every edge. It holds each picture's own `sizes` the same way, for the same six designs, a series' for one to twelve cards in each place the package knows, exactly the width an item is drawn at there, and against the widest of its places where no part says, at every window from 320 to 3200 px for four designs, its widths the ladder's steps for its drawing, and a teaser's in each presentation in each place a list stands in; that a section writes its place's on each series in its body and in an accordion there, from its tree and from its slot, a post list's too, that the page parts write theirs, and that a body no part wraps keeps the widest (issue #44); and in the three engines against pages of every such picture as the renderers draw it, a series in each of its places, each place's own `sizes` to its own drawn width, a page's loose blocks and an article's reading column among them, with its pictures behind the text, of navigation and of panoramas, a hero's picture behind its text and on each side, a section's photo beside words short and tall, and the figures and a series a part passes through, a pixel either side of every edge, for five designs, measuring the picture as drawn, its box scaled by `cover` to its proportions: equal where the design's height holds, and no less where the `sizes` is an upper bound; and that the renderers write them, with the cap of a display width where it holds and an SVG as the core wrote it. `test/konzilo-build.test.js` builds a site with the core: an article's body image at a 400 px window, drawn 363 px wide, loads the 509 px version at density 1 and the 1018 px version at density 2 in all three engines, and no other version of it; a hero's picture behind its text at a 390 × 844 window, its band half the window's height less the header's and drawing the picture of 16:10 wider than the band, loads the narrowest version that covers the drawn picture, 720 px at density 1 and the master's 1600 px at density 2, in all three engines; a card's picture in a series of three across a band loads the narrowest version that covers it in all three engines, the 360 px version on a 390 px window, the 360 px one on a 1024 px window, 64rem, where the widest of every place loaded 509 px (issue #44), and the 509 px one at 1440 px, 720, 720 and 1018 px at density 2; a teaser card's picture in a list of three across a band loads the narrowest version that covers it in all three engines, 360, 360 and 509 px on a 390, a 1024 and a 1440 px window, 720, 720 and 1018 px at density 2, where the hand-set `sizes` loaded 800 and 1200 px on the wide one; each teaser in `cards`, `featured` and `filtered`, "Read more" and an article's opening carries the widths and `sizes` of where the design draws it, a list's `sizes` those of the place the section around it gives it, at Narrow beside a form, in a column beside a quotation and across a band; a picture an article shows in its body and a list as its teaser is one file at every width the teaser has, and no teaser's or opening's picture has a version above its master or within a tenth below it, so the fixture's 1600 px master gets no 1440 px file (issue #42); and a gallery's pictures are versions of their 4:3 crop. `test/image-sizes.test.js` holds the `hero` context's `sizes` to the width a picture of 16:9 is drawn under the cover crop at every window from 320 to 3200 px, 420, 900 and 1600 px tall, for six designs, and in the three engines a pixel either side of every edge for four; `masterWidths()` to the triage's examples and the presentations and an opening to it; and that no cropped picture is taken to have proportions it was not given. `test/picture-behind.test.js` holds that a `Band` or `Hero` given a `srcset` without `pictureWidth` and `pictureHeight` stops the build, and given them writes the `sizes` it did. `test/image-sizes.test.js` holds each teaser's `sizes` to the specs' words at every window for six designs, `featured`'s latest post and the others, a lone teaser of `cards` and lists of one to seven, and in the three engines against a page of every presentation in each place a list stands in, in an article's reading column and in a page's loose blocks, each its place's own, and "Read more" and an article's opening, a pixel either side of every edge, for four designs.

## `konzilo.css`

`@kntnt/konzilo-design/konzilo.css`. It uses the roles of the Surface a thing stands on, so it works in both modes, and a site's unlayered CSS overrides it. It also styles what the core's reader writes into a body with no class of its own: figures, galleries, code blocks with their `--astro-code-*` colours, task lists and footnotes. A gallery takes its columns from its number of pictures, by the rule a series of cards follows (directives.md, Card Grid's columns), each at least 12rem, its caption not counted (fixed after 0.6.1; it filled as many columns as its width held). `:root` gets `--konzilo-lightbox-overlay`, `--konzilo-lightbox-text` and `--konzilo-lightbox-control`.

Its rules on the core's classes stand in a layer of their own, `kn-konzilo`, after `kn-components`. A form, a pager or a list of results stands in body text, whose rules are as strong as these, and a site's stylesheets do not reach a page in a set order: on a real build `components.css` comes after `konzilo.css`, which gave a pager the body's underlined links. Its rules on what the reader writes with no class stand in `kn-components`, below any rule with a class.

`test/fixtures/konzilo-page.html` is what the core really writes, fragments of a built site from its template with made-up content, and the tests also hold it against this library's own Form, Field, ConsentBanner, Embed and Pagination, property by property. Search's and a preview's states are in it too. The core writes no `:disabled` field: in a preview only its button is disabled.

**Formulas** (issue #33, settled by the owner in triage, 2026-11-25). The core writes a formula in a body as Temml's MathML, Temml 0.14.0, annotated and with nothing trusted: an inline formula is its `math` element in the text, a block formula's `math`, with `display="block"`, stands in the core's box, `<div class="konzilo-math">`, and Temml's classes, `tml-*`, and the `style` attributes it writes stay in it (the core's `docs/site-design.md`, Formulas in a body, and its ADR 0075). `konzilo.css` draws it:

- **The font:** STIX Two Math, version 2.13, under the SIL Open Font License 1.1, one math font for every design and no Typeface role. The fonts command copies it into every site's fonts folder with its licence, whatever the design's typefaces, and `fromDesign` refuses a folder without it (the assistant's choice, accepted by the owner, 2026-11-26, on the condition that a browser fetches the font only for a page that holds a formula, which `test/formulas.test.js` holds in Chromium, Firefox and WebKit). `konzilo.css` sets `font-family: "STIX Two Math", math` on `math`, and a browser fetches the font only for a page that holds a formula, since `@font-face` loads a font where text uses it, and never from the computer's own copy (no `local()`), so every visitor sees the same version. Chosen over Latin Modern Math for its x-height (0.473 em against Mona Sans' 0.517) and weight, close to the body text's, its cover of Unicode's math (4,605 code points against 2,045) and its math kerning.
- **Cut to what Temml can write** (the owner, 2026-11-26: as the other cut typefaces are): the release's WOFF2, `fonts/static_otf_woff2/STIXTwoMath-Regular.woff2` at the tag `v2.13b171` of `stipub/stixfonts`, the build of 2.13 its latest release names, 539 KB with 4,605 characters, is cut to 286 KB with 2,195, and only the cut ships, under the font's own name. A cut is a modified version, which may not carry a Reserved Font Name, and the licence reserves only "TM Math", so the cut keeps "STIX Two Math" and nothing is renamed. It keeps every character Temml can write, as near as Temml's own release tells: every character beyond ASCII in its `dist/temml.mjs`, written out or as a `\u` escape, with printable ASCII, Latin-1 and Greek, and the Letterlike Symbols and Mathematical Alphanumeric Symbols, which Temml works out rather than spells; and the combining marks, U+0300 to U+036F, which Temml reads as one range (the assistant's choice). It keeps the MATH table and every glyph the font's layout reaches from those characters, the larger and stretched forms and the alternates such as the prime's (`layout_features=['*']`), and, as the other cuts do, drops the hints, which would make it 348 KB. A cut by Unicode blocks, to Latin, Greek and the math blocks, would drop 352 characters Temml writes, among them the prime ′, ⟶ and ⟹, ‖, …, `\hat`'s accent and its combining form, □, △, ♯ and ✓ (measured 2026-11-26). Thirty formulas drawn by Temml, inline and in blocks, 2,183 boxes, stand in the cut where they stand in the whole font, to a thousandth of a pixel, in Chromium, Firefox and WebKit, while a cut by blocks moves most of them in Chromium and WebKit (measured 2026-11-26; Firefox showed no difference for either cut on macOS, which has a STIX Two Math of its own).
- **Which Temml** (the assistant's choice, 2026-11-26): `bin/design-fonts` reads Temml's source from the package npm publishes, `https://registry.npmjs.org/temml/-/temml-<version>.tgz`, at the version its `TEMML` names, 0.14.0, the one the Konzilo core installs, as the core's lock records it; a version npm publishes is never changed. **Whoever moves the core to another Temml sets `TEMML` to it and runs `bin/design-fonts` again**, since a new Temml may write a character the cut lacks, which a browser then draws in another font. The catalogue's `MATH.subset` names the Temml, `temml 0.14.0`, and `test/konzilo-build.test.js`, given the core by `KONZILO_CORE`, fails where the core installs another Temml, naming the version to set (the owner, 2026-11-26). `test/typefaces.test.js` holds the cut to its MATH table, to every character the gallery's formulas and the page fixture's draw and those a cut by blocks drops, and to the SHA-256 of the file the script wrote. A font the script changes keeps its release's timestamp, so a run writes the same file from the same release, the same Temml and the same fontTools and Brotli, 4.69.1 and 1.2.1 on 2026-11-26; a run with another writes another file, whose hash replaces the test's.
- **Size and colour:** a formula takes the size and the colour of the text round it, a block formula the body's size; so `text` in body text, in both modes and on every Surface. It takes none of the text's weight, letter spacing, features, axes, transform or wrapping, which belong to the main typeface: `konzilo.css` resets them on `math`, as Temml's own stylesheet does, with `font-feature-settings: "dtls" off`, without which Firefox drops the dot on an i.
- **Place:** a block formula is as wide as itself (`inline-size: fit-content`) and placed in the middle of its box (`margin-inline: auto`), with `display: block` for Firefox and WebKit; Chromium centres block math inside its own box, whatever the text's alignment. It stands as a paragraph does in body text, 1em after it, and weighs nothing, so that a part which spaces what it holds keeps its own rule. In a section's body the box stands in the reading column, as the section's running text does, and is a part, a column gap from its neighbours, as a table is (the assistant's choice).
- **Overflow:** the box scrolls a formula wider than its column (`overflow-x: auto`), so the page never widens. The box reads left to right on a right-to-left page too, `direction: ltr`, as the formula does: the owner left it to practice, 2026-11-26, and in practice a formula written in LaTeX, as Temml makes it, runs left to right. Besides, in a right-to-left box, Chromium and Firefox put a wide formula's end where no scrolling reaches, and Firefox reckons its width a few pixels short of what it draws.
- **Temml's rules:** `konzilo.css` holds the rules of Temml's own stylesheet for STIX Two (`Temml-STIX2.css`) that its MathML relies on: the prime's alignment (`ss04`) and the script letters (`ss01`), cramped superscripts in WebKit, the italic corrections each engine needs, an array's alignment and row spacing, and the `menclose` notations Chromium does not draw, each class only inside a formula. It leaves out its font rules, its line breaking, which a formula the core writes never asks for, since the core keeps each formula's LaTeX in its annotation and Temml then writes no break points, and its equation numbers, which the design does not draw (the assistant's choices). Its Firefox-only rules stand under `@supports (-moz-appearance: none)` where Temml uses `@-moz-document`, and its two lengths in pixels are in rem. Its lengths in ex are in em, at STIX Two Math's x-height of 0.473em, which each engine measures alike, so 0.5ex is 0.2365em; and its sides are logical, as the components' are, the same sides in a formula, which reads left to right, but for `-webkit-left` and `-webkit-right`, by which Chromium aligns an array's cells and which have no logical form (the assistant's choices, 2026-11-26, after the review of the integration branch; every box of 21 formulas drawn by Temml, the notations among them, stood where it stood before, to a ten-thousandth of a pixel, in all three engines and both directions). `test/konzilo-css.test.js` holds `konzilo.css` to logical properties and to no length in ex, and `test/formulas.test.js` the x-height in each engine. The rules are Temml's, by Ron Kok, under the MIT licence, whose notice the package publishes beside them as `src/konzilo/LICENSE-temml.txt`, and `ACKNOWLEDGEMENTS.md` names them (`test/third-party.test.js` holds both).
- **Print:** a block formula shows whole and is kept on one page, its box not scrolling (`overflow: visible`, `break-inside: avoid`).

**The lightbox** stands inside a body's wrapper, so the rules of `.kn-body-text` and the reset reach into it. The core's `modal.css` has no layer, so it beats every rule of this library on what it names: the margins and padding of its list, items, figure and words, the colour and size of its words, and the size of its image and buttons. `konzilo.css` takes back what it does not name: a link's colour and focus ring in a caption, inline code's fill and an image's corners. It also gives the button round an image on the page, which opens the lightbox, the design's focus colour as its own, since `modal.css` rings it in `currentcolor` and it holds nothing else, so its ring is the design's (fixed after 0.6.1; it was the browser's button text, black on a dark Surface). A gallery's crop on the page does not reach the dialog, which stands beside the gallery and not in it.

**A link in a form's label**, such as an acceptance line's to its policy: the core writes it as a plain `a` inside the field's `label`, or inside a group's `legend`, with no class. `konzilo.css` gives it the look of a link in body text, its colour, its underline and the thicker line under the pointer, wherever the form stands, in body text or not (since after 0.6.1).

**A table** the core writes bare, `<table>` in the body. A table must scroll inside its column where it is wider than that, and take the whole column where it is narrower, as this library's Table does in its wrapper. A bare table can do only the first: it is its own scrolling box (`table.css`), and its rows then stand in a table of their own width, which Gecko lets nothing widen, a caption no more than anything else. So the core is asked to write each table of a body in a wrapper, `<div class="konzilo-table"><table>…</table></div>`, the class on the wrapper alone; `konzilo.css` makes the wrapper the scrolling box and the table a table again, as wide as its column (the assistant's choice after 0.6.1, passed on to the core). The wrapper stands where the bare table would, with the same space above and below it: one and a half times the table's own size, straight in body text, an answer's too, and in a fact box, a tab, a choice's panel and a table of contents' flow, at any depth, though first or last in a fact box, a tab or a choice's panel it stands at the part's edge, as a paragraph does; and none of its own in a card, whose gap stands between all it holds (`table.css`; components.md, Tables). *(Changed 2026-11-25, the assistant's choice, issue #19: in a fact box, a tab, a choice's panel and a table of contents' flow the table had no space of its own, so the paragraph after it started at its last line.)* Until the core writes it, a table narrower than its column keeps its own width, in every engine alike.

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
- A following menu, as `Toc.astro`, `ArticleBody.astro` and a Table of Contents with `data-kn-follow` draw it, ends inside its `<nav>` with a loader for the scroll markers' polyfill (since 2026-11-25, directives.md, `toc`): `<script data-kn-polyfill="scroll-markers">`, which imports `scroll-markers-polyfill.js` only where `CSS.supports('scroll-target-group: auto')` is false, so in Firefox and WebKit and never in Chromium, and the polyfill marks the link of the section being read with `aria-current="location"`. Its text is the same in every menu and page of a build, so the core's policy needs one hash for it, and Astro's build emits the polyfill as a file of its own in `_astro/`. A site imports nothing for it. A page drawn by `renderDirective` without the loader, or by hand, is marked only where the browser has scroll markers.
- The core's CSS gives a header over the page's start the first band's Surface roles while it is clear, by rules that name no class: the page is the element with a Surface that holds a `main` and the header, the only element with `data-kn-start`.

## Fonts and the tarball

`konzilo-design fonts <file> [-o <folder>]` copies the typefaces the design uses, upright and italic, and the formulas' font, STIX Two Math, which every design has (Formulas, above), into the folder, `fonts` beside the design file by default. Beside them go their licences, which must travel with them, and `fonts.css` with their `@font-face` rules in relative addresses. A design that uses none of the library's typefaces still takes the folder, for the formulas' font, so a site that upgrades to a version with formulas runs the command once more. A typeface is found by its name in any case, as CSS finds a family. It removes a font of the library's that the design no longer uses, and nothing else, unless the design names a family the library does not ship and a computer does not have of itself, other than CSS's generic families and the tool's system typefaces: that may be a typeface's name misread, so it says so, with the library's typeface it may have meant, and removes nothing. It runs from this repository, where the fonts are.

`package.json` `files` makes `npm pack` hold what a site needs: the generator and schema, the CSS, the components, `konzilo`, the command and the font catalogue. It leaves out the fonts, the tool, the presentation, the gallery and the tests, so `tool`, `presentation`, `design-md` and `fonts` say plainly there that they run from the repository. `private: true` stays, and does not stop `npm pack`. `exports` holds only what the tarball holds.

## Logos

***Decided* with the core's session, 2026-11-05:** logos work as fonts do. The core's content security policy stays as it is, `img-src 'self'`, and never allows an image at a `data:` address, while a served file is allowed. The design file goes on holding its logos as data URIs or paths relative to itself, which is what the tool and the presentation use. *(Corrected 2026-11-12: the core's policy has since allowed an image at a `data:` address unless a site turns `security.dataImages` off, the core's ADR 0051; a logo is still a served file, which holds either way.)*

`konzilo-design logos <file> [-o <folder>]` writes `project.logo` and `project['logo-dark']` as `logo.<ext>` and `logo-dark.<ext>`, the extension from the data URI's type or the path's own, into the folder, `./public/logos` by default. It removes a logo the design no longer has, or has in another type, and nothing else. It needs nothing but the design file, so unlike `fonts` it also runs from the package a site installs.

`logoAddresses(project, { base, folder })` in `design-props` gives the addresses they are served at, `{ light, dark }`, so a layout needs no guessing. `base` is the site's base, and `folder` the folder below it, `logos` by default, for a site that also gives `fromDesign` another `logos`. `identityProps` and `headerProps` take the result as `logos`, and `footerBrand` as `logo`. Without `logos` they use what the design file holds, as the tool and the presentation do.

## The menu

The core gives a menu as plain data, entries of `{ title, url, items }` and, where the Admin wrote one, `description`, a line of plain text of at most 160 characters, and its entries carry no mark of the current page. `menuProps(entries, { current, base, linkMenu })` in `design-props` turns them into Header's `{ label, href, description, children, current, linkMenu }`, `description` only where an entry has one, which the large menu shows under its entry, and imports nothing of the core's.

- `current` is the page's address, `Astro.url.pathname`, and marks the entry at that address alone, not those above it. A trailing slash makes no difference.
- `base` is the site's base, which an address on the site starts at, so that it stays in a preview.
- `linkMenu(entry, index)` says which top entries stand in the link menu, all by default. An entry with no address only holds others and never stands there.
- Header's `children` are one level, so lower entries follow theirs in order, and a child with no address gives way to the entries it holds.

The design file's `project.menu`, `project.cta` and `project.footer` are a client's own menu, call to action and footer words for the design tool's preview and the presentation, so the client sees the content agreed (tool.md, The client's own menu and footer, and The client's own call to action). They are not design: `fromDesign`, `design-props` and the CSS read none of them, they never enter the fingerprint, and a site's menus, call to action and footer come from the site, as here.

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

In its configuration, `fromDesign` takes the place of `bodyStyles`, `tokens` and `images`, and the rest stays:

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

**The header's own words.** A site in another language gives them to `headerProps` as `words`, each in its language; each it leaves out is the English one, so a site that gives none sees no change (since after 0.6.1). `menuWord`, the menu button's word, names the menu button and the large menu too, unless `words.menu` does. The words, with the English of `HEADER_WORDS` in `components/header.js`:

| Key | Where it stands | English |
|---|---|---|
| `skip` | The link that skips to the content | Skip to content |
| `menu` | The menu button's name, where it shows no word of its own, and the large menu's | Menu |
| `mainMenu` | The large menu's navigation | Main menu |
| `linkMenu` | The bar's link menu | Main |
| `openSearch` | The magnifier that opens the search box | Search |
| `search` | The search button, in the box and in the large menu | Search |
| `searchHeading` | The search box's heading, shown or for a screen reader | Search |
| `closeSearch` | The search box's close button | Close search |
| `languages` | The languages moved into the large menu | Languages |
| `language` | The globe, followed by the current language's name | Language |

The search field's own name and the word in an empty field are `search.label` and `search.word`, as before. The footer writes no words of its own: every word in it is the site's. Breadcrumbs and Pagination take theirs as props (`label`, and `previous`, `next` and `pageLabel`).

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
- **A band's picture.** A picture behind a hero's text, from the directive, a template's `Hero` or `Band`, or an article's main image under `ArticleOpening`, is an `<img class="kn-band-picture">` after the band's content, which the stylesheet lays under the picture Surface's scrim and the text, covering the band from its centre (directives.md, `hero`; issue #40, 2026-11-26). Its address is written in `src` as given, as every other picture's is, a relative one too, which a browser reads from the page. `Band` and `Hero` take `picture`, its address; `alt`, what it shows, empty where a template leaves it out, which makes it a picture a screen reader passes over, so a template says whether its picture is decorative; and `srcset`, as Astro's `getImage()` gives it, `srcset={image.srcSet.attribute}`, with the picture's own `pictureWidth` and `pictureHeight`, `image.attributes.width` and `.height`, by which a `Hero` works out its `sizes` from its `height` and a `Band`, as tall as its text, the window's width (`bandPictureSizes()`; A picture cropped to cover its box), and writes them on the `<img>`; a `sizes` a template gives is written as it is. A `srcset` without both `pictureWidth` and `pictureHeight` stops the build, with an error naming both and where to get them, `image.attributes.width` and `.height` from `getImage()`, whether or not a `sizes` is given (the owner's decision, 2026-11-26, issue #42; such a picture was taken as 16:9. That it holds with a `sizes` given too, and for a `Hero` whose picture stands beside its text, which draws no `srcset`, is the assistant's reading of it.) No site that built stops building: `srcset` on a band arrived after 0.15.0. Without a `srcset` a browser loads `src` alone. Only a band on a picture Surface draws its picture, since only it has the checked scrim. ***In print*** (***decided* by the owner, 2026-11-26**, issue #43, from a sketch of three printed A4 pages) the picture is an ordinary picture above the text, and the text is in the page's colours, so nothing that matters is a background and the band prints the same whether or not a reader prints backgrounds. The picture stands first in the band, before all its text, the trail too, though it stays after the content in the HTML, so a screen reader still meets the heading first; it is drawn whole, at its own proportions, as wide as the content area and at most half the page high (`50vh`), centred, a column gap above the text, uncropped and with nothing over it. The band has no scrim and no overlay fade (`--kn-scrim: transparent`), and takes every role of the page it stands on, its text, muted text and links among them, in the page's colour scheme; it drops the hero's height and the header's room above it, so the page reads the site's name, the picture, the trail, the eyebrow, the heading, the standfirst and the byline, then the article, with no more space above the picture than a band without one has, and a band on the page after it shares its space. A header the page starts under, which takes its first band's colours, takes the page's with it. A card with its picture behind its text prints the same way (`picture="behind"`, directives.md), in the colours of what it stands on, the page's on the page; in a band of another colour it takes that band's, as an ordinary card there does, since with backgrounds printed the page's dark text would stand on the band's dark background (***the assistant's reading*** of the issue's "in the page's colours", 2026-11-26, ***awaiting the owner***). The scrim its picture Surface lays under the picture, a background, is cleared with the rest (2026-11-27, after the review of the integration branch: a browser printed it under the card's text where a reader printed backgrounds). Each of the three, the band, the card and the header, takes back in its own stylesheet everything `surface.js` declares for the Surface it has, but what reads the roles, which `test/picture-behind.test.js` holds against `surface.js`. *(Changed 2026-11-26, issue #43: the band printed its colours as they are, `print-color-adjust: exact`, the assistant's choice for issue #40, so the default design's article opening put a dark photo across the top half of the first page with white text on it, about a third of the page in ink; now about a fifth is. As a CSS background, before issue #40, the picture printed only where a reader turned backgrounds on.)* **Dark mode** follows the page: the package's print does nothing of its own for a page in dark mode, which prints in its dark colours, so the band takes the page's dark roles and a browser does with them what it does with the rest of the page: with backgrounds it prints the page's dark background under light text, and without them, its default, it leaves the background out and darkens the light text for paper, Chromium's white to a mid grey (the assistant's finding, the same day). *(Changed 2026-11-26, issue #40: it was the band's `--kn-picture-image`, written in its `style`, whose address a browser read from the stylesheet's folder, so a relative one stopped the build.)* `--kn-picture-image` is now set only by the package's own samples of a picture Surface on a plain element, the presentation's Colour page and the gallery, whose Surface rule still draws it under the even scrim; no band, hero or article opening writes it.
- **The presentations.** A site declares those it uses, and registers the same: `presentations: { cards: DESIGN_PRESENTATIONS.cards }` for one. `filtered` takes the option `filters`, the rows' names apart by spaces, `filters="category topics search"`.
- **The trail's last level** is the design's `breadcrumbs.current`, which the tool sets: whether a trail ends with the page itself. The core's own setting for each type, `breadcrumbs.types.<type>.current` among the site's settings, governs the core's Breadcrumbs component alone, and a site that draws its trail with this package leaves it as it is (directives.md, `::breadcrumbs`).
- **The page's context.** Every template that renders a body, and every page that calls a presentation itself, gives the page's context first, in its frontmatter, with `designPage()` from `design-props`:

```astro
---
// src/pages/[...page].astro, in part
import { render } from 'astro:content';
import Body from '@kntnt/konzilo/astro/Body.astro';
import { breadcrumbs } from '@kntnt/konzilo/astro/breadcrumbs';
import { designPage } from '@kntnt/konzilo-design/design-props';
import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';
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
  <PageBody><Body post={page} page={number}><Content /></Body></PageBody>
</Site>
```

`search` and `types` are for a filtered list where the core does not say what the list is of; a version of the core that gives a presentation `list` says it itself, and then the terms and the count over every page too. A component on a page whose template did not call `designPage()` stops the build, naming the call. A term's page calls `Filtered` itself, with `settled` for the row it settles:

```astro
<Filtered posts={posts} pager={pager} empty={empty} options={{ filters: 'category topics search' }} settled={{ taxonomy: 'category', term: term.id }} />
```

A page's body is its bands, heroes and sections, so a body of directives stands in Page's `main` with nothing around it but `PageBody`, which puts a run of loose blocks at its top in a section and the title band first where it opens with no hero (directives.md, The body of a page; The templates, below).

### The templates

A template places the package's page parts (directives.md, The page parts) and writes nothing of its own where a part exists, and gives the page's context first. `Site` is the layout above. The lines every example shares stand here once, and each example leaves them out:

```astro
import { render, getEntries } from 'astro:content';
import Body from '@kntnt/konzilo/astro/Body.astro';
import { breadcrumbs } from '@kntnt/konzilo/astro/breadcrumbs';
import { designPage } from '@kntnt/konzilo-design/design-props';
import design from '../../design/site.design.json';
import Site from '../layouts/Site.astro';
const base = import.meta.env.BASE_URL;
```

**A page**, `src/pages/[...page].astro`: its body as bands, its title band first where it has no hero, and the cookie declaration, on the cookie policy alone, in a section after the body.

```astro
---
import CookieDeclaration from '@kntnt/konzilo/astro/CookieDeclaration.astro';
import { entryPages } from '@kntnt/konzilo/astro/languages';
import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';

export function getStaticPaths() { return entryPages('pages', 'page'); }
const { entry: page, page: number } = Astro.props;
const { Content } = await render(page);
designPage(Astro, { design, title: page.data.title, breadcrumbs: await breadcrumbs(page, Astro.url), search: `${base}search/` });
---
<Site entry={page} page={number}>
  <PageBody>
    <Body post={page} page={number}><Content /></Body>
    <CookieDeclaration />
  </PageBody>
</Site>
```

**An article**, `src/pages/[...article].astro`: its opening from its fields and the core's meta line, its topics linked to their pages, its body with the following menu, and the related posts.

```astro
---
import { metaLine } from '@kntnt/konzilo/astro/helpers';
import { entryPages } from '@kntnt/konzilo/astro/languages';
import { relatedPosts } from '@kntnt/konzilo/astro/post-lists';
import ArticleOpening from '@kntnt/konzilo-design/page-parts/ArticleOpening.astro';
import ArticleBody from '@kntnt/konzilo-design/page-parts/ArticleBody.astro';
import ReadMore from '@kntnt/konzilo-design/page-parts/ReadMore.astro';

export function getStaticPaths() { return entryPages('articles', 'article'); }
const { entry: article, page } = Astro.props;
const { Content } = await render(article);
designPage(Astro, { design, title: article.data.headline, breadcrumbs: await breadcrumbs(article, Astro.url) });
// Each topic with the address of its page, by the topics taxonomy's address in the site description.
const topics = (await getEntries(article.data.topics)).map((topic) => ({ name: topic.data.name, url: `${base}topic/${topic.id}/` }));
---
<Site entry={article} page={page}>
  <ArticleOpening entry={article} metaLine={await metaLine(article, Astro.url)} topics={topics} />
  <ArticleBody><Body post={article} page={page}><Content /></Body></ArticleBody>
  <ReadMore posts={await relatedPosts(article)} more={{ label: 'More articles', href: `${base}articles/` }} surface="raised" />
</Site>
```

- `metaLine()`'s pieces are the line the core writes by the type's format, each author linked to their page where authors have pages; a type without a format has none, and the opening then has its topics alone. `authorsOf()` gives the same authors for a template that writes a byline of its own elsewhere.
- The category over the headline is the article's eyebrow where it has one, else its category's name, which `ArticleOpening` reads itself.
- `ReadMore` writes nothing where `relatedPosts()` finds none.

**A type of the site's own**, made like an article, such as a case study with a customer and facts: the same parts, its own eyebrow, its facts as a value list in the body's Aside in place of the following menu, its own words for "Read more", and a band that closes the page, as a page's own section, by the page part `Section`.

```astro
---
import AsideBlock from '@kntnt/konzilo-design/components/AsideBlock.astro';
import { entryPages } from '@kntnt/konzilo/astro/languages';
import { relatedPosts } from '@kntnt/konzilo/astro/post-lists';
import ArticleOpening from '@kntnt/konzilo-design/page-parts/ArticleOpening.astro';
import ArticleBody from '@kntnt/konzilo-design/page-parts/ArticleBody.astro';
import ReadMore from '@kntnt/konzilo-design/page-parts/ReadMore.astro';
import Section from '@kntnt/konzilo-design/page-parts/Section.astro';
import ValueList from '@kntnt/konzilo-design/page-parts/ValueList.astro';

export function getStaticPaths() { return entryPages('caseStudies', 'case-study'); }
const { entry: study, page } = Astro.props;
const { Content } = await render(study);
designPage(Astro, { design, title: study.data.headline, breadcrumbs: await breadcrumbs(study, Astro.url) });
// Each value is HTML the template writes safe: a link to the industry's page, a date as a <time>.
const facts = [{ label: 'Customer', value: study.data.customer }, { label: 'Location', value: study.data.location }];
---
<Site entry={study} page={page}>
  <ArticleOpening entry={study} eyebrow={study.data.customer} />
  <ArticleBody>
    <Body post={study} page={page}><Content /></Body>
    <AsideBlock slot="aside" heading="The project" surface="raised"><ValueList items={facts} /></AsideBlock>
  </ArticleBody>
  <ReadMore posts={await relatedPosts(study)} heading="More case studies" more={{ label: 'All case studies', href: `${base}customers/` }} surface="raised" />
  <Section surface="brand" heading="Find out what your garden can do"
    actions={[{ label: 'Book a visit', href: `${base}visit/` }, { label: 'Ask for a reference', href: `${base}contact/` }]}>
    <Fragment slot="deck">A gardener visits and, within two weeks, <a href={`${base}guides/`}>writes down</a> what would grow.</Fragment>
  </Section>
</Site>
```

`Section` writes what the same `:::section` in a body writes (directives.md, The page parts): the heading, the deck and the two actions stand in its head, the first the main action. Its words here stand in the template; a site that lets an Admin change them reads them from its settings.

**A type with no picture**, such as a vacancy: its opening on a Surface of its own, with its facts and the way to apply in the slot `after`, its body with a menu in its own words, and the other vacancies under a heading, as the site's own presentation draws them, with a lone action to all of them.

```astro
---
import { entryPages } from '@kntnt/konzilo/astro/languages';
import { listedPosts } from '@kntnt/konzilo/astro/post-lists';
import Actions from '@kntnt/konzilo-design/page-parts/Actions.astro';
import ArticleBody from '@kntnt/konzilo-design/page-parts/ArticleBody.astro';
import ArticleOpening from '@kntnt/konzilo-design/page-parts/ArticleOpening.astro';
import Section from '@kntnt/konzilo-design/page-parts/Section.astro';
import ValueList from '@kntnt/konzilo-design/page-parts/ValueList.astro';
import Rows from '../components/Rows.astro';   // the site's own presentation

export function getStaticPaths() { return entryPages('jobs', 'job'); }
const { entry: job, page } = Astro.props;
const { Content } = await render(job);
designPage(Astro, { design, title: job.data.title, breadcrumbs: await breadcrumbs(job, Astro.url) });
const facts = [{ label: 'Office', value: job.data.location }, { label: 'Team', value: job.data.team }];
const others = await listedPosts({ type: 'job', order: 'closingDate', direction: 'ascending', number: 10 }, { post: job });
---
<Site entry={job} page={page}>
  <ArticleOpening entry={{ ...job, data: { ...job.data, standfirst: job.data.excerpt } }} surface="tint">
    <Fragment slot="after"><ValueList items={facts} /><Actions links={[{ label: 'How to apply', href: '#how-to-apply' }]} /></Fragment>
  </ArticleOpening>
  <ArticleBody label="On this page"><Body post={job} page={page}><Content /></Body></ArticleBody>
  {others.length > 0 && (
    <Section surface="raised" heading="Other vacancies">
      <Rows posts={others} options={{}} empty="" />
      <Actions links={[{ label: 'All vacancies', href: `${base}careers/#open-positions` }]} />
    </Section>
  )}
</Site>
```

`ArticleOpening` takes the excerpt as the standfirst here, since a vacancy has no standfirst of its own. The lone action after the list is drawn as more of it, as after any series.

**A term's page**, the `termPage` the integration puts at each taxonomy's address: the term's opening, then its posts as a filtered list in a section of their own, the row it settles left out.

```astro
---
import Form from '@kntnt/konzilo/astro/Form.astro';
import { termPages } from '@kntnt/konzilo/astro/post-lists';
import Filtered from '@kntnt/konzilo-design/presentations/Filtered.astro';
import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';
import Section from '@kntnt/konzilo-design/page-parts/Section.astro';
import SmallPrint from '@kntnt/konzilo-design/page-parts/SmallPrint.astro';
import TermOpening from '@kntnt/konzilo-design/page-parts/TermOpening.astro';

export async function getStaticPaths({ routePattern }) { return termPages(routePattern); }
const { term, page, posts, pager, empty } = Astro.props;
const taxonomy = { categories: 'category', topics: 'topics', authors: 'authors' }[term.collection];
designPage(Astro, { design, title: term.data.name, breadcrumbs: await breadcrumbs(term, Astro.url), search: `${base}search/`, types: { articles: { name: 'article', label: 'Article', plural: 'Articles' } } });
---
<Site entry={term} page={page}>
  <TermOpening term={term} surface="tint" />
  <PageBody title={false}>
    <Filtered posts={posts} pager={pager} empty={empty} options={{ filters: 'category topics search' }} settled={{ taxonomy, term: term.id }} />
  </PageBody>
  <Section surface="tint" anchor="newsletter" heading="One e-mail a month" deck="The month's guides, and nothing else.">
    <Form name="newsletter" />
    <SmallPrint>We keep your address only to send it. Read <a href={`${base}privacy-policy/`}>how we handle it</a>.</SmallPrint>
  </Section>
</Site>
```

The newsletter's band is a `Section` with the core's `Form` and `SmallPrint` in its body. Since a form follows, its deck stands in the body as a paragraph, and the section keeps the start edge, its body in a column of Narrow's width, as the same `:::section` in a body does; `align="center"` on `Section` would centre it as a page's end (directives.md, A centred section). *(Changed 2026-11-25, by the owner's decision that content centres no section: it was centred as a page's end.)*

**The search page**, the `searchPage`: one section, its title and trail as its head and the core's search in a Reading Area as its body.

```astro
---
import Search from '@kntnt/konzilo/astro/Search.astro';
import { pageTexts } from '@kntnt/konzilo/astro/languages';
import ReadingArea from '@kntnt/konzilo-design/components/ReadingArea.astro';
import TitleBand from '@kntnt/konzilo-design/page-parts/TitleBand.astro';

const { title } = pageTexts(Astro.url).search;
designPage(Astro, { design, title, breadcrumbs: await breadcrumbs(null, Astro.url, { title }) });
---
<Site title={title}>
  <TitleBand><ReadingArea side="end"><Search /></ReadingArea></TitleBand>
</Site>
```

**The 404 page**, `src/pages/404.astro`: the page an Admin chose as the 404 page, its title band and its body, or the core's own words where none is chosen.

```astro
---
import { pageLanguage, pageTexts, startPage } from '@kntnt/konzilo/astro/languages';
import { notFoundPage } from '@kntnt/konzilo/astro/site-settings';
import PageBody from '@kntnt/konzilo-design/page-parts/PageBody.astro';

const plain = pageTexts(Astro.url).notFound;
const page = await notFoundPage(Astro.url);
const Content = page ? (await render(page)).Content : null;
designPage(Astro, { design, title: page?.data.title ?? plain.title });
---
<Site title={page?.data.title ?? plain.title}>
  <PageBody>
    {Content ? <Body post={page}><Content /></Body> : <><p>{plain.text}</p><p><a href={startPage(pageLanguage(Astro.url))}>{plain.start}</a></p></>}
  </PageBody>
</Site>
```

The 404 page has no trail, since it stands at no address of its own; its body is drawn through `Body`, so that its directives are drawn as anywhere.

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

From this package: the design file, `fromDesign`, `konzilo.css`, the fonts and logos commands, the frame's components, `design-props`, with `menuProps` for its menus, `logoAddresses` for its logos and `designPage` for its templates, the directives' components, declarations and checks, the presentations `cards`, `featured` and `filtered` (The directives and the presentations, above), and the page parts its templates place (The templates, above).

Of its own, since nothing here does it yet:

- Its languages, in the shape Header takes, from the core's `languageSwitcher()` (`{ url, name, current, language }`). Only the menu has an adapter so far, and the trail the few lines above.
- The look of any presentation of its own. The template's List, Cards, TermPage and SearchPage write classes of the template's, whose styles went with `src/styles`, so they stand unstyled until the site replaces them, as The templates above do.
- `bodyClass`, which the core does not take yet, so a template places `PageBody` or `ArticleBody` around a body, or for a body without directives the wrapper above.
- A restart of Astro's dev server after a change to the design, which it does not watch.
