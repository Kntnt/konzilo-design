# The footer

Records the footer's two bands of cells and its attachment, with their status and reasoning.

**Owner, decided 2026-11-05:** the controls of the six models did not give enough freedom to choose a combination, so the footer becomes two bands of cells. The model of 2026-10-31 and the six models of 2026-11-03 are replaced, see below.

The footer has two bands, shown each on its own or together.

- **The upper band** behaves like every other Band on the page in its space and colour; the only difference is that it belongs to the footer.
- **The lower band** is always thin (the compact treatment of the old model), and its cells behave exactly as the upper band's.
- **The cells:** each band is a grid of 2 x 2 cells. The columns are A and B and the rows 1 and 2, in spreadsheet notation. Column A takes a third of the available width inside the content area and column B two thirds, parted by the usual column gap. A row is as tall as it needs.
- **The content box:** each cell has a content box that wants to be as small as it can. Its text is start-aligned, in column B too unless the design sets B's text at the end (Column B's text, below). Column A's boxes stand against the cell's start edge and column B's against its end edge, and every box stands at the cell's top. All of this is logical, so right-to-left mirrors it.
- **Who decides:** whoever designs the site decides what stands in the cells and what colour the bands have. By default the upper band is on the dark brand Surface and the lower on the nearly black `inverse` Surface.

**When cells are empty** (the owner's list, as rules for the filled cells of one band):

| Filled | What happens |
|---|---|
| None | The band is not rendered. Both bands empty: no footer at all. |
| One | It spans all four cells. |
| Two in one column | Each spans its whole row; the other column is gone. |
| Two in one row | The empty row has no height; the cells keep their own columns. |
| Two diagonally, or three | The owner's "or": with `fill: row` the cell beside an empty cell spans that row, and with `fill: column` the cell above or below an empty cell spans that column. |

When a cell fills another, it spreads over both, but its content box stays as it was: at its own column's edge, at the top, and as small as its content allows. A cell in column B that spans a row therefore keeps its box at the end edge.

The assistant reads the owner's "or" as a design choice (2026-11-05, ***approved* with the footer by the owner on 2026-11-10**): the setting `fill`, one per footer, applying to both bands, with `column` as the default. `footerSpans` in `footer.js` holds these rules, and a test holds them to a table of all 16 combinations under both values.

**On narrow screens** (***decided* by the owner on 2026-11-11**, replacing "A cells before B cells within each band", approved on 2026-11-01): one column, every box at the start edge, the upper band column by column and the lower band row by row: A1, A2, B1, B2 in the upper band, then A1, B1, A2, B2 in the lower. In his words, "Stapelordning på mobil: A1 A2 B1 B2 A3 B3 A4 B4 (rad 1 och 2 är de två översta banden och rad 3 och 4 är de två nedersta banden)". Why: the upper band's columns are two wholes, the brand with its statement and the icons with the links, while the lower band's rows are two pairs, the address with the registration and the policy links with the consent links, which belong together read down a phone. It is a fixed rule, with no setting. Document order stays equal to stacking order: CSS `order` would part reading and keyboard order from the stacking order (resolved 2026-11-01), so `Footer.astro` writes each band's cells in its stacking order (`FOOTER_STACKING` in `footer.js`) and places them on the wide grid by their own column and row, so the wide footer is as before. A test holds both, in every combination of cells under both fills, in all three engines.

**What stays of the model of 2026-10-31:**

- Optional hairlines, never between two colours or through a merged cell, stopping at the content by default. A hairline over column B alone therefore starts at the start edge of B's widest content box, not at the column's (*decided* 2026-11-02, the owner found it running too far past the text). The owner did not ask to remove them on 2026-11-05, and approved the footer with them on 2026-11-10.
- Adjacent bands with the same background get less space between them than at a change of background: section space at their outer edges and a smaller gap inside. Footer bands on one colour close up in the same way, and only there can a hairline part them.

**Replaced 2026-11-05, no longer in force:** up to four bands, cells merged by hand over rows or both columns, same-colour runs of more than two bands, B's content pushed to the end as one shared block, and the design file's `model`, `surface` and `second-surface` with the six models (2026-11-03). Old keys have no migration: validation refuses them.

**Sample content** (the owner, for the preview and the presentation; made-up values in English):

| Cell | Upper band | Lower band |
|---|---|---|
| A1 | The brand, as the header shows it | Address |
| B1 | Icons for LinkedIn, Facebook, YouTube, Spotify, email and RSS (`src/components/icons.js`) | Registration number and registered office |
| A2 | A position statement, or a similar short text presenting the brand | Cookie policy • Privacy policy (links) |
| B2 | Links for navigation: a selection from the megamenu, all of it, or links that do not fit there | Change privacy settings • Revoke consents (links) |

**The client's own** (the owner, 2026-11-11): the tool's Start page takes the client's words for every cell but the upper band's A1, the brand, and the design file keeps them in `project.footer`. Where the tool's preview and the presentation show the footer, a cell with the client's words shows them and one without shows the sample's; the upper band's B2 without links of its own is the top level of the menu shown, the client's once there is one. It is content, not design, so a site's footer gets none of it (tool.md, The client's own menu and footer).

**The brand follows the header** (the owner, 2026-11-05): what is chosen in the header holds in the footer too. A1 of the upper band shows what `header.identity` says, logo only, name only, or logo and name, following `brand-axis` too and optically centred as in the header (header.md, point 13), with no slogan. It has the header's sizes, and the logo for the band's Surface: a band dark in both modes takes the dark logo, and one that follows the mode holds both, for CSS to choose. Changing them changes the preview's footer where it stands. A site gets the same from `footerBrand` in `src/components/brand.js`, as a cell's `content`.

**The tool's control** (the owner): a miniature of this structure, in which one clicks the cells to turn them on and off and sees the result in the preview. Eight cells in all.

### Attachment

**Owner (2026-10-31):** the footer is either fixed at the bottom of the page, as its last part, uncovered as one scrolls down; or fixed at the bottom of the window, lying under the page and hidden by it until one has scrolled far enough for the whole footer to show. He describes how it is experienced, not how it is built, and thinks it is part of the footer component. **Agreed**, with the remark that the setting is the footer's but the page must cooperate: under `reveal` the page must be opaque and lie over the footer.

**Owner (2026-11-05):** it must be possible to fix the footer at the end of the page or at the edge of the screen, more of a reveal effect, with the end of the page as the standard. The tool says "At the end of the page" and "At the edge of the screen". The definition below stands.

**Owner (2026-11-11), the tool's words replaced:** he did not recognise "The footer sits: At the end of the page / At the edge of the screen" as this choice, which he reads as whether the footer is fixed to the end of the page or to the bottom edge of the window ("om sidfoten är klistrad till sidans slut eller till fönstrets nederkant"). The tool now says "The footer is fixed to: The end of the page / The bottom of the window" (the assistant's wording of his reading). The same day he moved "Where the page meets the footer", the page's shadow on the footer and its edge line, from the tool's Page page to its Footer page, beside the attachment, since it only concerns how page and footer meet; the design file keeps them in `page` (page.md).

**Definition** (proposed 2026-10-31; he has built on it without objection, and decided the two further points below). The footer's attachment takes one of two values:

- **`flow`:** the footer is the page's last part. It scrolls with the page and enters the window from below, its top edge first.
- **`reveal`:** the footer lies still against the window's bottom edge, under the page, which scrolls over it. Near the end the page's bottom edge slides up and uncovers the footer from below, its bottom edge first, until all of it shows.

Both values share these invariants:

1. The end state is the same: scrolled to the end, the whole footer shows directly below the page's last content. Only the way there differs, which shows in which edge of the footer appears first.
2. The footer never hides page content, and in the end state the page hides no part of the footer.
3. `reveal` holds only while the whole footer fits in the window; otherwise the footer is in `flow` (small screens, zoom, large text). This is checked all the time, not only on load. (Held by a small script since 2026-11-11, below.)
4. When keyboard focus enters the footer, the page scrolls to its end, so nothing focused lies hidden under the page (WCAG 2.2, 2.4.11). (Changed in the rebuild of 2026-11-10, below: nothing focused lies hidden, by another means.)
5. The reading order is the same: the footer comes last in the document.
6. Print is always `flow`.

Two further points, taken with the owner one at a time (2026-10-31):

- **Short pages** (*decided*; he welcomed the catch): on a page shorter than the window, the footer stands at the window's bottom edge under both values. The space between the last content and the footer is the page's surface, below the last band. It follows from the page model (page.md), where nothing behind the page ever shows; and on a short page `flow` and `reveal` look alike, since the whole footer shows at once.
- **A visible edge under `reveal`** (*decided*): the page's bottom edge always shows, or the footer's content seems to appear out of nothing behind an invisible line. It shows by a colour change between the page's last band and the footer's first, the page's shadow on the footer, or the line at the page's bottom edge; where the bands have the same colour and neither shadow nor line is chosen, the component adds the shadow. The cost, accepted: no reveal without a visible edge.

**Built 2026-11-01, the attachment; 2026-11-05, the cells; *approved* by the owner in the design tool on 2026-11-10:** `Footer.astro`, `footer.js` and the Page implement all six invariants and both further points. Reveal eligibility is continually measured, keyboard focus uncovers the footer, short pages grow on the page Surface and an equal-colour reveal edge gets the Page’s shadow automatically, with its hairline when the shadow is off. Footer layout is calculated at build time, so the cells, hairlines and stacking need no script. The assistant’s technical choices are in components.md.

***Rebuilt* without script, 2026-11-10, by the owner's rule of that day (principles.md, HTML and CSS, not JavaScript); the assistant's choices:** the attachment is CSS, alike in Gecko, WebKit and Chromium; since 2026-11-11 a small script says whether the footer fits (below). `footer.js` keeps only the build-time layout (`footerSpans`, `layoutFooter`, `footerFromDesign`).

- **At the edge of the screen**, while it fits, the footer itself is `position: sticky` at the window's bottom edge, under the Page's main, which is opaque, `position: relative` and above it. So the page scrolls off the footer, which lies still at the window's bottom edge, and the end state is the flow's (invariants 1, 2 and 5). The Page reserves nothing.
- ***Decided* by the owner, 2026-11-11 (invariant 3):** a footer that fits in the window gets the reveal; one that does not fit goes back into the flow at the page's end, scrolls in with the page, and the visitor can scroll back and forth over it. A footer exactly as tall as the window still fits.
- ***Decided* by the owner the same day: a small script, not a copy of the footer.** For a few hours the footer was built without script, its bands written twice, a hidden copy beside a size container; the owner rejected that, since the copy doubled the footer's elements, search engines read its links twice, and it bound every site to put no `id` in a slot and to change every copy. `footer-fit.js` (16 lines), loaded only by a footer with `attachment="reveal"`, compares the footer's height with the window's (`clientHeight` of the root) with a ResizeObserver on the footer and the window's resize event, which a change of text size also fires, and writes `data-kn-fit="true"` or `"false"` on the footer, and nothing else; it also watches for a footer that comes or is set to the edge of the screen later. It is not a polyfill: the reveal is decoration, so its loss without script is the owner's accepted choice. The reveal, and the Page's opaque main and automatic shadow under it, apply only while `data-kn-fit="true"`; a footer too tall for the window gets the hairline, as at the end of the page. **Lost without script, or before it has run:** the reveal. The footer then stands in the flow at the page's end, as a footer at the end of the page does.
- **Invariant 4, changed** (***accepted* by the owner, 2026-11-11**): while keyboard focus is in the footer (`:has(:focus-visible)`) the footer is `position: relative`, back in the flow, where the browser shows what has focus. The page no longer scrolls to its end: the focused link shows where it stands in the flow.
- **The visible edge:** one rule per Surface kind compares the page's last child's Surface, or the page's own where it has none, with the footer's first band's, and sets `--kn-footer-same` on the Page. Then, at the edge of the screen and with neither shadow nor line chosen, the main casts the `page` shadow; where no shadow results, at strength zero or at the end of the page with no shadow chosen, it draws its hairline. This replaces the built `data-kn-top-line`. **Given up:** on a short page, the page Surface between the last Band and the footer is not compared, only the last child's.
- **Print** is the flow (invariant 6).

**Room for what floats over it:** while the consent's reopen button shows, the last band's end padding grows to 4.75rem, the button's 2.75rem and 1rem on each side of it, so the button never covers the lower band's words (components.md, consent; the assistant's choice, 2026-11-10).

**Settings in the design** (2026-11-05, replacing those of 2026-11-03): the design file's `footer` holds `attachment` (`flow`, the default, or `reveal`), `fill` (`column`, the default, or `row`), since 2026-11-12 `b-align` (`start`, the default, or `end`; Column B's text, above), `upper` and `lower`, each with a `surface` and `cells` (`a1`, `b1`, `a2`, `b2`, all on by default), and the lines: `horizontal-rules`, `vertical-rule` and `rule-extent`. In the tool's preview, `footer-html.js` writes the same markup as `Footer.astro`, and a test holds the two together.

**Icon links** (***decided* by the owner, 2026-11-12**, from a site built with the components: "Perhaps a little too small. Not much larger, but a little. [...] But the gap between them is too tight; it should be larger"): `.kn-footer-social` draws each icon 1.75rem, where it drew 1.5rem, a sixth larger, which keeps its line as light as the text's beside it, and stands them 1rem apart, where they stood 0.5rem, the room the links of a cell have between them. The sizes are the assistant's.

**Column B's text** (***decided* by the owner, 2026-11-12**, from a site built with the components, where the lower band's B1 held three lines of text above a row of links: the links stood at the column's end, the text at its start, and he found it looked best with the text at the end too, "which should be a setting one makes in Konzilo Design"): the design's `footer.b-align` says how the text in column B's boxes is aligned, `start`, the default and the look until then, or `end`. With `end`, on a wide screen, every line in a box of column B ends at the box's end edge, where the box itself stands, its parts placed at its end, and a row of links or icons there wraps from the end. ***The assistant's choices, which he may veto:*** one setting for the whole footer, applying to both bands, as `fill` does, since a band's cells behave as the other band's and a column is the footer's own grain, and for column B alone, since column A's boxes stand at the start, where its text already is; a B cell that has come to cover its row keeps its text at the end with its box; the names; and on a narrow screen, where every box stands at the start edge, its text stands there too whatever the setting, since lines ending at the end of a box that stands at the start would end nowhere. A row of links in column B then carries its separator after each link instead of before, overhanging the box's end by one, so that no line ends with one, as no line starts with one at the start; the Konzilo core's consent links in a slot of column B do the same (`konzilo.css`). The tool sets it on its Footer page, under Text, as "Text in the right column": Left-aligned or Right-aligned.

**Related, already in the model:** the page's shadow on the footer (page.md, point 4), and the line above the footer, drawn only when the first band has the page's colour and the page casts no shadow.
