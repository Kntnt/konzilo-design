# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] – 2026-11-12

### Added

- Where the line across the tabs stands, `tabs.rule-place`: under the row of tabs, as before and by default, or above it, the open tab marked on the line, so that a tab reads as a value under it does, a line, a label and the content, and tabs over a value list no longer stack two lines. The tool sets it on its Text page, whose preview now shows tabs over values, as the presentation's Text page does. The tabs' HTML is unchanged: the generated CSS carries the choice, and a design file resolved before keeps its tabs as they were.
- How the text in the footer's right column is aligned, `footer.b-align`: at the start, as before and by default, or at the end, where the column's boxes stand, so that its lines end with its links. A row of links there wraps from the end, with no separator at a line's end. On a phone, where the cells stack at the start, the text stands at the start too. The tool sets it on its Footer page, under Text. A site gives it to Footer as `bAlign`, which `footerFromDesign` does.

### Fixed

- The page's shadow on the footer shows on a dark footer: it is inked for the band it falls on, black at three times the opacity on a dark band, as every shadow on a dark plate is. It was inked for the page, and hardly showed on the default footer's dark upper band, at the end of the page or revealed under it.

## [0.4.0] – 2026-11-12

### Added

- A translucent header, `header.translucent`: where the bar is not clear, it and its megamenu and language list show a hint of the page under them, blurred, at the least opacity at which every role on them keeps its contrast over any page, and never under 85%. Off by default; the tool calls it "Translucent" on its Header page. Each Surface gets the opacity as `translucent` in the design file and as `--kn-background-translucent` in the CSS. Open a design in the tool, or run `konzilo-design resolve`, to store it; the CSS works it out meanwhile.
- A filtered list of posts can have rows: a row of pills for each taxonomy it filters by, such as the category and the topics, and a search row, in a fixed order. Choices on one row widen the result and each further row narrows it. A search goes to the site's search page with the pills checked and what the list and the page settle, so a search after a choice searches within it. A row the page itself settles, such as the category on a category's page, is left out. `docs/spec/directives.md` has the HTML.
- Visitor Filters takes `hidden`, fields a search sends with it, and draws the search field with its button beside it.

### Changed

- An article's meta line takes the sentence the Konzilo core writes by its format, such as "By A. Writer • Published 10 October 2026 in Guides", its byline, date and category each an element of its own, the authors and the category as links, and then the article's topics as pills, each a link to its topic's page. `docs/spec/directives.md` has the new HTML, which replaces the three spans of 0.3.0: a site's renderer must write it.
- Eyebrows and the other labels are a step larger by default: three steps below body text, where they were five, 14px on a phone and 13px on a wide screen with the default scale. A design that has saved its own step keeps it.
- An eyebrow stands closer to its heading than the heading stands to what follows it, in a heading group and in a card.
- The footer's icon links are a little larger, 1.75rem, and stand twice as far apart, 1rem.
- Every card that leads somewhere behaves alike under the pointer: its heading is underlined, and where it casts a shadow it rises 0.125rem as its shadow lifts. A card without a shadow keeps still, and so does every card where the visitor asks for reduced motion.
- The arrow of a card that leads on stays still under the pointer, as a word such as "Read more" would.
- A table of contents in the Aside has no rule above it, and its label stands level with the text beside it.
- Logos are almost twice as large on a wide screen, 4.5rem high where they were 2.5rem, and keep 2.5rem in the narrowest window, so a phone still shows them two to a row.
- A band of logos alone stands as far from the band before it as from the band after it, also where a band beside it has its colour, which used to leave the logos close under the cards above them.
- A quotation in body text looks as the Quotation component does: its words larger, in the text colour, after a rule in the accent, and its source under it in small, muted type. It can no longer be taken for the text round it.
- Less padding round the text in a card and every other plate: the plate space is step 4 of the space scale, 25–30px at the default density, where it shared step 6, 40–50px, with the column gap. The gaps are unchanged. Open a design in the tool, or run `konzilo-design resolve`, to take the new value.

### Fixed

- A Content Loop in body text keeps its own links, as a Card does: its titles are no longer drawn as body links, underlined in the link colour.

## [0.3.0] – 2026-11-11

### Added

- A third choice for the breadcrumb trail on a phone, "As much as fits, from the end": the trail keeps to one line and its end, hides whole steps from the start behind an ellipsis, as in "… / Services / Planning", and shows whole while a keyboard focus is in it. It works by CSS alone, alike in Firefox, Safari and Chrome, and DESIGN.md gives the recipe for each of the three choices.
- The presentation's Page page opens with a drawing of the page's layout, to scale from the design, at a wide window and a phone's: the side margin, the content width that the header, footer and bands align to, a band running edge to edge, and the text with the Aside on the right, on the left, or centred without one. A short real page follows, with the content width's edges, the reading column and the Aside drawn as guides.
- The tool's Page view draws the same layout and follows Content width and Reading width as they are dragged.
- The tool's Start page takes the client's own menu, as an indented outline, and the words for each footer cell. The preview and the presentation show them in place of the samples, cell by cell. The design file keeps them in `project.menu` and `project.footer`, outside the design, so they change nothing a site gets.
- An outline or site map pasted into the menu keeps its levels, from plain text with bullets, numbers or tree lines, or from a document's or a site's lists.
- A frame colour, Quiet edge: each plate's frame is its own border colour, following its Surface and the mode, and a filled button rings in its hover colour. It gives cards and other plates a calm edge in both modes; existing designs are unchanged.

### Changed

- Dark mode has a blacker page and lighter plates: cards, tints and status bands now stand about 1.45 from the dark page instead of 1.16. Each colour gains two steps for dark mode alone, 850 and 975, so light mode is exactly as before. Open a design in the tool, or run `konzilo-design resolve`, to take the new values.
- The tool's control panel holds only what the design file saves. Component variants, which a site chooses each time it uses a component, are no longer chosen there.
- Each component page in the tool has a preview of its own, showing every variant at once with a caption naming it.
- The tool's Header page shows the large menu and the search box open, each in a frame of its own, following every setting.
- Accordion and Quotation are separate sections and specimens, and the accordion sample has three questions.
- Opening a page says that its settings are the opening every page gets, unless the page itself chooses otherwise.
- The tool's type scale shows body text too, as the base between the lead and small text.
- The tool's Start page shows the large menu open under the page in its preview, where the client's menu is entered.
- In the presentation, the reader's switches for width, pictures and light or dark mode look like the document's own: on the sidebar's grey, each named, the chosen one in black and white, so they can no longer be taken for samples of the design.
- The presentation shows a narrow width as the screen itself: at Tablet and Phone the bordered window hugs the frame at that width, with only the document around it, and every frame still shows its whole content.
- The presentation's Shadow page shows each shadow where a site casts it, in small scenes of the real components: the header over content scrolled under it, the menu open under the bar, the end of a page over its footer, cards on three Surfaces, and a card at rest and under the pointer. A shadow the design has switched off casts nothing there, and the caption says so.
- The presentation shows every variant, every state and every colour combination at once, after the main example. Only the reference values on the Details page stay folded.
- The presentation's comments are its last chapter, in the sidebar's list after Details, with the number written so far.
- The presentation's sidebar shows its hierarchy: chapters in the text colour at the margin, their pages indented under them on a thin line and muted until chosen.

### Removed

- The "Show it in the preview" buttons on the tool's Header page, now that the preview always shows the large menu and the search box open.
- "Header over a panel" on the presentation's Shadow page, since on a site the open menu covers that shadow.

### Fixed

- The large menu's "Row above" and "Row below" now reach a site: the Header shows those rows only where the design has them on.
- The component lists in the tool's panel use the same names as the preview's sections.
- In dark mode, where a shadow does not show on the dark page, the header bar, its open menu and the page's edge over the footer keep their hairline beside the shadow.
- A sticky header at the top of the page, which casts no shadow yet, is parted by its hairline from a first band of its own colour, also while shadows are on.
- The large menu and the search box opening in the preview no longer take the focus from the tool, which in Firefox lost keys typed at that moment.
- The large menu no longer draws an empty row with a line above or below its columns where the design has its rows on but the site gives them nothing, or has them off.
- An arrow button's focus ring keeps off its word and its arrow, which it touched, and the word stays at the edge of its column.

## [0.2.0] – 2026-11-11

### Added

- The search box can go without its close button. Esc and a click outside the box still close it.
- The empty search field can show nothing, the site's own word for Search, or a magnifier that goes as the visitor types.

### Changed

- On a phone the footer's lower band stacks row by row (address, registration, policy links, consent links), while the upper band still stacks column by column.
- The tool's Colour chapter is one page: text, links and buttons on every Surface, with their contrast, stand with the colours, below them or beside them in a wide window.
- The tool's Footer page says whether the footer is fixed to the end of the page or the bottom of the window, and now also holds the page's shadow on the footer and the line at its edge.
- The tool reads a copy file as the presentation does, so a key that never existed stops it at its start, naming the file and the key.

### Fixed

- `design-tool` no longer ends with "Detected unsettled top-level await" when it opens a browser: it waits for the browser's answer and says where the tool runs.
- Create presentation no longer fails on a copy file written for an earlier version: keys the document no longer uses are ignored, and a key it refuses is named with its file, without the build's whole log.
- An open large menu makes a header that starts transparent opaque, as it is after scrolling.
- The blurred or faded page behind the search box covers the whole window, the header bar and the footer included.
- Without its heading, the search box keeps room above the field for its close button, which overlapped the Search button.
- "Show it in the preview" opens the large menu or the search box in the preview, also in the preview's own window, and keeps it open while settings change.

## [0.1.0] – 2026-11-11

### Added

- A generator that turns a design's inputs into a complete design system: colour ramps, every Surface in light and dark mode, a fluid type scale, space, corners, shadows, a frame, widths and motion.
- One rule that takes every Surface from light to dark mode, so a coloured band stays a coloured band in dark mode.
- A contrast check against WCAG 2.2 on every Surface in both modes. A design whose text would fail is refused, and so is a design whose bands cannot be told from the page.
- A tint for each brand colour, and status Surfaces for information, success, warning and error.
- One design file, `name.design.json`, that holds the inputs, the client's details and every computed value, with a JSON schema and a format number. A file whose values no longer match its inputs is refused.
- The design tool, `bin/design-tool <design-file>`: the controls beside a live preview at phone and desktop width, in one window or two, saving every change at once, with undo and redo and a backup before the first change.
- The design tool runs like an application: the command returns at once, a file already open is shown again, each design file has a tool of its own that stops by itself 30 seconds after its last window closes, and `--status` and `--stop` list and stop them. Windows on one design follow each other, and a save never overwrites a change it did not see.
- A choice of 47 typefaces, shipped with their licences. Each role, from body text to labels and code, sets its own typeface and axes. A new design is all Mona Sans.
- Shadows set by four sliders and chosen per target, and a frame of its own.
- The page, the header and the footer as parts of the design: the header's arrangement, attachment and menus; the footer's two bands of cells, at the end of the page or at the edge of the screen; the page's widths, fill and shadow.
- A header and a footer built on HTML and CSS: the menus and the search box, staying at the top, the transparent start, sliding away and the footer under the page work without a script, alike in Firefox, Safari and Chrome. Two small scripts only measure: one chooses how far the header gives way, and one says whether a footer at the edge of the screen fits in the window. Where a browser still lacks a scroll feature the header uses, a small polyfill stands in, loaded only there.
- The hero as a design choice: its size, picture, text placement, colour and where the page's first heading goes. Breadcrumbs are a design choice too.
- Components for what a normal website needs, as CSS, Astro components and plain HTML: body text, headings, buttons, icons, hero, text and image, call to action, key figures, cards, figures, video, embeds, tables, accordions, quotations, callouts, content lists, visitor filters, breadcrumbs, a table of contents, forms and a consent banner.
- Components that need no script on a site: forms, tabs, choices, a section head that stays in view, the Reading Area with its notes and asides, and visitor filters are HTML and CSS alone, alike in Firefox, Safari and Chrome. Only embeds and the consent banner have scripts of their own.
- Every length in rem, in the components and in the tool alike, so a visitor's larger text size is respected.
- A component gallery, `npm run gallery`, with every component on one page.
- A presentation for client approval: one HTML file in a ZIP that works offline and is read page by page, with live specimens in both modes, a motivation per chapter and comments the client can send back.
- Sample photos in the previews, which a client's own photos can replace, and a way to view the pages without pictures.
- An export for AI agents: a ZIP with `DESIGN.md` in Google Labs' open format, the logos, the font files and the icons, so that an agent can build a site from it alone.
- CSS for any site: the design's custom properties, and one stylesheet for every component.
- A package for Konzilo sites: `fromDesign` reads a site's design file at build, `konzilo.css` gives what the Konzilo core writes the same look as the components, and helpers turn a design and a site's menus into the components' props.
- Commands that copy a design's fonts and logos into a site.
- The HTML, look and behaviour of every Konzilo directive: sections with six layout rules, lists, cards, timelines, reasons, post lists, questions and answers, tabs, choices, fact boxes, an article's opening and a following menu.
- The commands `design-check`, `design-presentation`, `design-md`, `design-restore`, `design-gallery`, `design-test` and `design-fonts`.
- A licence: the GNU Affero General Public License, version 3 or later, with a site exception that leaves design files, everything made from them and what a site uses to look as the design says outside it.
- Release files beside each release: the package a Konzilo site installs, every typeface with its licence, and the gallery as one self-contained page.
- A contributor agreement, a trademark policy, a contributing guide, acknowledgements, a list of third-party packages, a glossary and a README for a new reader.
