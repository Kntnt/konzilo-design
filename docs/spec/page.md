# The page

Records the page model and the Reading Area, with their status and reasoning.

**Owner's model**, the one he uses exclusively:

- The page is a sheet as wide as the viewport, edge to edge; no desktop shows beside it. (The other historical model, a sheet of paper lying on a desktop with nothing ever beyond its left and right edges, he does not use.)
- The page's surface may be a colour, a gradient or a background image, but it is always opaque. It is usually white or near white, or the reverse in dark mode.
- A centred content area of a set width lies on it. It sets the limits for the header's and the footer's content, while their backgrounds run to the viewport's edges. Content normally lies inside it, but may go outside: into the left or right margin, or as a band from edge to edge.
- Bands stack on one another; each runs edge to edge and has the same inner content area. A further, narrower area may also be used.
- Body text must not be too wide to read, so it takes a narrower column, which leaves room beside it, still inside the content area, for other things.

**Blueprint** already describes most of this, as the owner remembered: the Layout Rails Wide, Narrow and Full (glossary "Layout Rail"; Q194 as amended: Wide aligns with the inner edges of Site Header and Site Footer); the Section as a viewport-wide band that owns its background while its Section Layout bounds the content (Q354, Q358); the Narrow reading measure, 45rem (Q357); the Narrow/aside and Aside/narrow layouts (Q317, Q356); body text as the Rich Text Page Module and the Article's Narrow body. **Not there:** the page's own surface as a gradient or an image, and the rule that it is always opaque (Blueprint has only the mode's page colour roles); body text as a component of its own.

**Owner (2026-10-31):** Narrow is not a property of the page. It belongs to a separate content component, a container placed on the page whose only task is to give Narrow and a space beside it, on the left or the right.

**The page component** (put to the owner 2026-10-31 and confirmed point by point the same evening):

1. **Surface** (*confirmed* 2026-10-31). It covers the viewport's full width and the page's full height, and at least enough height for the footer to reach the window's bottom edge (the short-page decision). Its fill is a colour, a gradient, or an image over a colour; the colour shows while the image loads and where it ends. Light and dark mode each have a fill of their own, both set explicitly rather than derived, since a derived image or gradient seldom looks right. It is always opaque: nothing behind it ever shows.
2. **Content area** (*confirmed* 2026-10-31). The area is centred, `min(viewport − 2 × side margin, Wide)`; the side margin grows with the window (16px to 48px). The header's, the footer's and every band's content align to it, while their backgrounds run edge to edge. Content may leave it on purpose, edge to edge or into the margin on one side: besides `narrow`, `wide` and `full`, an element may take a one-sided width that starts at the content area's edge on one side and runs to the window's edge on the other (names proposed: `bleed-start`, `bleed-end`). These widths hold for all content, Breakouts in a Reading Area too.
3. **Order** (*confirmed* 2026-10-31). The main content is a vertical sequence of bands only; a Reading Area and everything else lie in a band. A band runs edge to edge with the content area inside it, and may have a background of its own; without one, the page's surface shows. The band owns the vertical space above and below its content, which is why nothing lies directly on the page: a Reading Area there would have no vertical space at all. Adjacent bands with the same background get less space between them than at a change of background, the rule in footer.md.
4. **Layers** (*confirmed* 2026-10-31). Three layers, from the top: the header, with the panels it opens (megamenu, search panel); the page; the footer. The upper layer casts the shadow on the lower, never the reverse, and only where something lies under it: the header when page content lies under it, the page on the footer as the footer's visible-edge rule (footer.md, Attachment) requires or as chosen. One shadow serves every layer edge, so depth looks alike everywhere. The shadow belongs to the upper layer: the page's shadow on the footer is a setting of the page, not of the footer (resolved 2026-11-01: Page owns the `shadow` option and paints it at the main content edge). Under the footer's `reveal`, the page's bottom edge is what slides off the footer.
5. **What is the page's** (*confirmed* 2026-10-31), so that every setting has one home:

    | What | Belongs to |
    |---|---|
    | The surface, in light and dark mode | the page |
    | The content area: Wide and the side margin | the page |
    | The sequence of bands; the height on short pages | the page |
    | The shadow on the footer | the page |
    | Narrow and the Aside | the Reading Area |
    | Background, vertical space, light or dark | the band |
    | Sticky, sliding away, transparent at the top, and the page starting under it | the header |
    | `flow` or `reveal` | the footer |

    The page start under a sticky header is the header's: it exists only with a sticky header and goes with its transparency; the page only lets its first band begin at the window's top, and that band declares light or dark.
6. **The surface scrolls with the page** (*decided* 2026-10-31), an image and a gradient alike: the surface belongs to the sheet, and a still backdrop would leave unclear what slides off the footer under `reveal`; still backgrounds have also long failed in Safari on iPhone and iPad. An image lies at the page's top, as wide as the page, with the fill colour below it, or repeats as a pattern. The cost, accepted: on a long page the image shows only at the top.

**The Reading Area**. Proposed 2026-10-31 and settled with the owner the same evening, one question at a time; points he decided are marked *decided*, the rest he has seen without objection.

**Names** (*decided*): English is canonical, in code and Blueprint, reusing Blueprint's words.

| What | Name |
|---|---|
| The container | Reading Area |
| The readable column | Narrow |
| The space beside it | Aside |
| Content belonging to the whole, at the top of the Aside | Aside Block |
| A note anchored to a point in the text | Sidenote |
| An element wider than Narrow | Breakout |

Reading Area pairs with the content area, inside which it lies.

1. **Task:** the Reading Area lays content out across the width; nothing else. It has no background and no vertical padding, since vertical rhythm belongs to the bands.
2. **Placement:** in a band, never directly on the page (page.md, point 3), and never in another Reading Area, the header or the footer. Several may follow one another, each independent: the Aside does not continue across a band.
3. **Setting `side`:**
   - `end` (default) or `start`, as logical directions, so they flip in right-to-left.
   - With `end` or `start`, Narrow lies against the content area's opposite edge. It does not move when the Aside is empty, so a page type always aligns alike; Blueprint's Article already has "no recentring".
   - `none` centres Narrow (*decided*): it is the one placement the other values cannot give; start-aligned, `none` would look exactly like `end` with an empty Aside. The cost, accepted: Narrow's edge does not align with the logo or with full-width bands.
4. **Geometry:**
   - Narrow is the reading measure, a site-wide typographic token (Blueprint's 45rem), and the Aside takes the rest less the column gap.
   - When the Aside would fall below its minimum width, the Reading Area goes to one column. The threshold follows from measure + gap + minimum, with no breakpoint of its own.
   - **Worked out when the CSS is written, not measured** (the assistant's choice, 2026-11-10, replacing `reading-area.js`, whose switch after the first paint moved everything after an area by 200px or more): two columns fit from the window `w` where `min(w − 2 × side margin(w), Wide) = Narrow + column gap(w) + Aside minimum`. The side margin and the column gap are clamps of the window and every value is the design's, so the CSS emitter solves it (`readingColumnWindows` in `src/generator/layout.js`) and writes a media query in rem that sets `--kn-reading-columns: 2`, which `reading-area.css` reads by a style query. In rem it follows the reader's text size: every term scales with the text and the window alike. Where the gap grows past what Wide leaves room for, the query has an upper end too; where Wide is too narrow for two columns, there is none. For the default design (Narrow 45rem, Wide 75rem, side margin `clamp(1rem, 0.4286rem + 2.8571vw, 3rem)`, gap `clamp(2.5rem, 2.3214rem + 0.8929vw, 3.125rem)`, Aside minimum 14rem) it is `w ≥ 66.5775rem`, 1065px at the default text size. It assumes the Reading Area spans the content area, as it does in a band, and the root's font size is the reader's, which this package never sets; a classic scrollbar may leave the Aside up to its width under the minimum at the switch. A browser without style queries keeps one column.
5. **Three kinds of content:**
   - **Flow** (default): in Narrow, in order.
   - **Aside Blocks:** belong to the whole Reading Area, such as a table of contents, a contact box or related links. They sit at the top of the Aside and may be sticky, as an option on the block; a sticky block is at most as tall as the window below the header, and one taller scrolls inside itself (the assistant's choice, 2026-11-10, replacing the rule that a block too tall did not stick). In one column they go before or after the flow, by the setting `stack: before | after`. Where Sidenotes or Breakouts reach into the Aside, blocks written after the flow (`stack: after`) stay after it in two columns too, at the reading line: CSS cannot lift what comes later in the document to the top of the Aside and keep notes and Breakouts clear of it (the assistant's choice, 2026-11-10).
   - **Sidenotes** (*decided* part of the Reading Area): anchored to a point in the flow, such as a definition, a short explanation, a small picture or a quote. In two columns a Sidenote sits in the Aside from the end of the element it follows, and a later one is pushed down rather than overlapping, even below its paragraph (the assistant's choice, 2026-11-10: a float in CSS, as Tufte's notes are, cannot stand level with the top of an element before it, which `reading-area.js` measured; crowded notes stand close, one under the other). In one column it goes inline right after its anchor. Editors need a way to mark a Sidenote in the text.
   - **A sticky Aside Block needs the Aside to itself:** it would cover anything below it, so a Reading Area with Sidenotes or Breakouts has no sticky Aside Block.
6. **Breakouts** (*decided* part of the Reading Area): every element of the flow has a width, `narrow` (default), `wide` (Narrow + Aside, the whole content area), `full` (edge to edge of the window) or a one-sided `bleed-start` / `bleed-end` (page.md, point 2); the first three are Blueprint's Layout Rails, and a Breakout is an element with any width but `narrow`. It stays in the flow, and the text goes on in Narrow below it. Nothing stands in the Aside beside it, except a Sidenote begun before it, beside which it keeps Narrow, as beside an Aside Block (the assistant's choice, 2026-11-10: CSS cannot push a note that comes earlier in the document below a later Breakout, and pushing the Breakout would leave a hole in the text). This keeps a wide figure from being shrunk to Narrow or forcing the Reading Area to close, which would split the text and restart the Aside. In one column `wide` looks like `narrow`, while `full` still reaches the window's edges.
   - **Beside Aside Blocks:** a Breakout whose row an Aside Block still occupies keeps Narrow's width, so the reading column never gets a hole (*decided* 2026-11-01, over pushing the Breakout and the following text below the blocks). Every Breakout must therefore work at Narrow's width, as it already must on a narrow screen. **In CSS** (2026-11-10): the Aside and the notes float, and a Breakout is a formatting context of its own with no width of its own, so the browser fits it beside a float at Narrow and gives it the content area elsewhere. A Figure is a container too, and its picture alone reaches the window's edges by a length that is zero where it stands at Narrow. Any other Breakout reaches them itself, which beside a float WebKit answers by moving it below the float.
   - **Captions:** a figure's caption starts at the reading line, Narrow's start edge (outside a Reading Area, the content area's), and keeps Narrow's measure, whatever the figure's width; the figure's tint stays with the image and the caption stands on the page below it (*decided* 2026-11-01).
7. **Order:** the document order is the reading order at every width. Sidenotes come right after their anchor, and Aside Blocks before or after the flow as `stack` says.
8. **Body text is separate:** body text is the typography (headings, paragraphs, lists, figures), usable in Narrow and elsewhere, such as in a card. The Reading Area is the layout. Together they replace "Narrow as a property of the page".
9. **Blueprint:** this replaces the Section Layouts Narrow, Narrow/aside and Aside/narrow with one container and a setting, and adds Sidenotes and Breakouts.

**Settings in the design** (the owner's wish, 2026-11-03; the assistant chose the details while the owner was away, ***approved* by the owner on 2026-11-10**): `layout.wide` and `layout.narrow` set Wide and Narrow, and `page` sets the shadow on the footer, the line at the bottom edge, and a fill for each mode as a colour or gradient. An image fill has no control yet. A Band's and a Reading Area's settings belong to each page's content, not the design.

**Open with the owner:** nothing on the Reading Area (2026-10-31).
