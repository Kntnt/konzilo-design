# The footer

Records the footer model and attachment, with their status and reasoning.

**Owner, approved 2026-10-31 ("Ser bra ut"):** the footer model and its 24 variants. In short:

- Up to four bands, each on one colour; a band with no cells is not rendered.
- Columns A, a third, and B, two thirds, inside the content area; B's content pushed to the end edge as a block.
- Merged cells over rows or both columns.
- Runs of same-colour bands, with section space at their outer edges and a smaller gap inside; a compact utility band.
- Optional hairlines, never between colours or through a merged cell, stopping at the content by default. A hairline over column B alone therefore starts at the B block's start edge, not at the column's (*decided* 2026-11-02, the owner found it running too far past the text).
- On narrow screens, each run stacks its A cells before its B cells, and a row spanning both columns is a unit of its own.

**Stacking (resolved 2026-11-01):** CSS `order` would part reading and keyboard order from the stacking order, so `Footer.astro` writes the cells in stacking order and places them on the wide grid with named lines and explicit rows; its one-column layout keeps that document order.

### Attachment

**Owner (2026-10-31):** the footer is either fixed at the bottom of the page, as its last part, uncovered as one scrolls down; or fixed at the bottom of the window, lying under the page and hidden by it until one has scrolled far enough for the whole footer to show. He describes how it is experienced, not how it is built, and thinks it is part of the footer component. **Agreed**, with the remark that the setting is the footer's but the page must cooperate: under `reveal` the page must be opaque and lie over the footer.

**Definition** (proposed 2026-10-31; he has built on it without objection, and decided the two further points below). The footer's attachment takes one of two values:

- **`flow`:** the footer is the page's last part. It scrolls with the page and enters the window from below, its top edge first.
- **`reveal`:** the footer lies still against the window's bottom edge, under the page, which scrolls over it. Near the end the page's bottom edge slides up and uncovers the footer from below, its bottom edge first, until all of it shows.

Both values share these invariants:

1. The end state is the same: scrolled to the end, the whole footer shows directly below the page's last content. Only the way there differs, which shows in which edge of the footer appears first.
2. The footer never hides page content, and in the end state the page hides no part of the footer.
3. `reveal` holds only while the whole footer fits in the window; otherwise the footer is in `flow` (small screens, zoom, large text). This is checked all the time, not only on load.
4. When keyboard focus enters the footer, the page scrolls to its end, so nothing focused lies hidden under the page (WCAG 2.2, 2.4.11).
5. The reading order is the same: the footer comes last in the document.
6. Print is always `flow`.

Two further points, taken with the owner one at a time (2026-10-31):

- **Short pages** (*decided*; he welcomed the catch): on a page shorter than the window, the footer stands at the window's bottom edge under both values. The space between the last content and the footer is the page's surface, below the last band. It follows from the page model (page.md), where nothing behind the page ever shows; and on a short page `flow` and `reveal` look alike, since the whole footer shows at once.
- **A visible edge under `reveal`** (*decided*): the page's bottom edge always shows, or the footer's content seems to appear out of nothing behind an invisible line. It shows by a colour change between the page's last band and the footer's first, the page's shadow on the footer, or the line at the page's bottom edge; where the bands have the same colour and neither shadow nor line is chosen, the component adds the shadow. The cost, accepted: no reveal without a visible edge.

**Built 2026-11-01:** `Footer.astro`, `footer.js` and the Page implement all six invariants and both further points. Reveal eligibility is continually measured, keyboard focus uncovers the footer, short pages grow on the page Surface and an equal-colour reveal edge gets the Page’s shadow automatically, with its hairline when the shadow is off. Footer layout is calculated at build time, so runs, merged cells, hairlines and stacking need no script. The assistant’s technical choices and validation limits are in components.md.

**Settings in the design** (the owner's wish, 2026-11-03; the assistant chose the details while the owner was away, for review): the design file's `footer` holds a model, the main colour and the thin band's colour, lines between rows and between columns, where lines end, and the attachment. The models are six of the approved variants with a job to do, in `footer-models.js`: one band; two rows; two rows with a thin band; a statement across both columns above the rest; a tall left column; a tall right column. The other approved variants were tests of the layout's rules, which still hold. In the tool's preview, `footer-html.js` writes the same markup as `Footer.astro`, and a test holds the two together.

**Related, already in the model:** the page's shadow on the footer (page.md, point 4), and the line above the footer, drawn only when the first band has the page's colour and the page casts no shadow.
