# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
