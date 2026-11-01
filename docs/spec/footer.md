# The footer

Records the footer model and attachment, with their status and reasoning.

**Owner, approved 2026-10-31 ("Ser bra ut"):** the footer model, with the reference implementation and its 24 variants. In short:

- Up to four bands, each on one colour; a band with no cells is not rendered.
- Columns A, a third, and B, two thirds, inside the content area; B's content pushed to the end edge as a block.
- Merged cells over rows or both columns.
- Runs of same-colour bands, with section space at their outer edges and a smaller gap inside; a compact utility band.
- Optional hairlines, never between colours or through a merged cell, stopping at the content by default.
- On narrow screens, each run stacks its A cells before its B cells, and a row spanning both columns is a unit of its own.

**Known flaw:** the reference implementation stacks with CSS `order`, so reading and keyboard order do not follow the stacking order; a real component must write the cells in stacking order.

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

The reference implementation already behaves as `reveal`, falling back when the footer does not fit; it does not yet do invariant 4, the short-page point or the automatic shadow.

**Related, already in the model:** the page's shadow on the footer (a toggle in the reference implementation; page.md, point 4), and the line above the footer, drawn only when the first band has the page's colour and the page casts no shadow.
