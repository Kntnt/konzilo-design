# Konzilo Design

Konzilo Design is a design system generator with a visual tool: from a few inputs it makes a checked design system, and from that a presentation for a client, CSS for any site, a package for Konzilo sites and a `DESIGN.md` for AI agents. This glossary holds the words the specifications, the code and the people use for it. Each definition follows `docs/spec/` and `docs/generator.md`, which say more.

The names in code, the custom properties, classes, attributes and design-file keys, are in [`docs/spec/names.md`](docs/spec/names.md), and only there.

## The project

**Konzilo Design**: This repository, `Kntnt/konzilo-design`, and the package released from it, `@kntnt/konzilo-design`: the design tool, the generator, the exports and the Site Parts. `SITE-EXCEPTION.md` calls it the Design System.

**Konzilo core**: The website core in `Kntnt/konzilo` that Konzilo sites are built on. It depends on nothing here: a site takes its design from this package and hands it to the core. _Avoid_: Konzilo, alone, for this repository.

**Owner**: The person at Kntnt who decides what Konzilo Design is. The specifications mark each point as his statement, a proposal, decided or open.

**Specification**: A file in `docs/spec/` that records what was decided about one part, with its reasons. A change that departs from one updates it. _Avoid_: docs, notes.

## The design and its files

**Design File**: One JSON file, `name.design.json`, that holds a whole design: its Format, Inputs, Project and Resolved. Everything else is made from it. _Avoid_: theme file, config, tokens file.

**Format**: The design file's required whole number, `format`, that says how to read it. It is raised only when the file's shape breaks. _Avoid_: version, alone, which may mean `project.version` or the generator's version.

**Inputs**: The design file's `inputs`: what the tool's controls set, and the only part a person changes, through the tool. Brand colours, grey temperature, typefaces, type scale, shadows, frame, corners, density, and the frame of every page. _Avoid_: settings, options.

**Project**: The design file's `project`: the client's name, logos, slogan, contact, own menu and footer words, the presentation's version and the motivations written for it. It never enters the Fingerprint. _Avoid_: identity, metadata.

**Resolved**: The design file's `resolved`: every value the generator derived from the inputs, with the generator's version, the Fingerprint and the contrast check's result. A consumer reads it and needs no generator. _Avoid_: computed values, output.

**Fingerprint**: The SHA-256 digest of the inputs, kept in Resolved. A file whose inputs no longer match it is stale and refused. It is a freshness check, not a signature. _Avoid_: hash, checksum.

**Backup**: The copy `name.design.bak.json` that a command or the tool makes before its first write in a session. `design-restore` puts it back. _Avoid_: history.

**Output**: Every file the Tool writes from a design file: its Resolved values, the Presentation, the Export for AI, the CSS, and the fonts and logos the commands copy. The site exception leaves it outside the licence. _Avoid_: build, export, for all of them.

## Licence

**Tool**: In the site exception, the part of Konzilo Design that makes designs and Output: the design tool, the generator, the writers of the presentation, `DESIGN.md` and the CSS, the commands and the tests. The licence holds for it. _Avoid_: design tool, which is one part of it.

**Site Parts**: The files of Konzilo Design made for websites to use: the stylesheets, the components and the HTML they describe, the page scripts that only show, hide or move what is on the page, the helpers that write that HTML, and the icons. In a Site they are outside the licence. _Avoid_: assets, theme.

**Site**: A website, a theme, a template or a design for one, on any platform, with the files that make it. Software that is not a website, such as another design tool or a page builder, is no Site.

**Site exception**: `SITE-EXCEPTION.md`, the additional permission to the AGPL that leaves design files, Output and Site Parts in a Site outside it, while the Tool stays under it. _Avoid_: linking exception.

**Contributor agreement**: `CONTRIBUTOR-AGREEMENT.md`, the core's agreement, by which the author of work that goes into this repository keeps its copyright and gives Kntnt Sweden AB a licence to release it on any terms. _Avoid_: copyright assignment.

## Tools and outputs

**Design tool**: The local editor, `bin/design-tool <design-file>`: the presentation's pages with their controls, beside a live preview of the real components at phone and desktop width, which saves every change into the design file at once. _Avoid_: editor, app, the Tool.

**Generator**: The modules in `src/generator/` that turn Inputs into Resolved: ramps, Surfaces with their Roles, the contrast check, type, space, radii, shadows, frame, layout and motion. It has no dependencies, and runs in Node and in a browser. _Avoid_: compiler, build.

**Contrast check**: The matrix of every Role pair on every Surface in both Modes, checked against WCAG 2.2 at each resolve, with every band against the page. A design that fails is refused, and the tool turns off the Presentation and the Export for AI until it passes. _Avoid_: validation, lint.

**Presentation**: The ZIP with one self-contained HTML file that a client opens offline and reads page by page, for approval before any sketch: the colours, the type, space and shape, then every component, with the details last. The client can leave comments and send them back. _Avoid_: PDF, report, slides.

**Export for AI**: The ZIP `name-design-md.zip`, with `DESIGN.md`, the logos, the font files and the icons, made for an AI agent that has nothing else and builds with any technique. _Avoid_: DESIGN.md, alone, for the whole archive.

**DESIGN.md**: Google Labs' open format for describing a design system to AI agents, and the file in that format that the Export for AI holds: every token, every Surface in both Modes and a recipe for each component.

**Gallery**: Every component on one page, `gallery/dist/index.html`, built by `npm run gallery`. _Avoid_: storybook.

**Sample page**: The one real page the tool's preview and the presentation show, with sample content and photos, or the client's own menu, footer words and photos where the design has them, where a component may occur several times. _Avoid_: demo page.

**Way of looking**: A choice of how the design is shown, not what it is: the preview's width, the Mode, pictures or none. It is not saved in the design file or in the history, and it stays in the preview's own bar, never in the control panel. A component's variants are no way of looking either: the preview shows them all. _Avoid_: setting, for these.

**History**: The tool's undo and redo, in steps of one gesture each, over what is saved in Inputs and Project. It lives in the window and is gone when it closes. _Avoid_: backup.

## Colour

**Brand colour**: One of one to three colours a design starts from, ranked primary, secondary and tertiary. Each gives its exact value, the seed, to a Ramp. _Avoid_: theme colour, which is a name the core reads.

**Ramp**: A colour's scale of steps from 100 to 975, generated in OKLCH. A given step has the same lightness in every colour, since each step's contrast against white is fixed. Each mode reads ten of them: light mode 100 to 950 without 850, dark mode 100 to 800 with 850 and 975. A design always has a grey ramp beside its brand colours. _Avoid_: palette, shades.

**Token**: A value computed from the inputs: a ramp's step, a type or space step, a radius, a shadow. Components never read tokens; they read Roles. _Avoid_: variable.

**Role**: A value named for its use, which components read in place of a Token. Context roles come from the Surface underneath: background, text, muted text, borders, link, accent, focus, the status colours, the button's colours and the alternate and hover fills. Global roles are the same everywhere: type, space, shape, depth and layout. _Avoid_: token, for a role; on-colour.

**Surface**: Anything that paints its own opaque background, and so supplies the complete set of context Roles to everything on it: the page, a band, the header bar, a card, a button, a panel. Text on a Surface takes its text Role, and is dark on a light one and light on a dark one without anyone saying so. A Surface inside a Surface starts a new context. _Avoid_: plate, which is the Swedish talk's *platta*; theme.

**Kind**: Which Surface something is, which sets its background and every Role on it: `page`, `raised`, `tint`, `tint-secondary`, `tint-tertiary`, `brand`, `inverse`, `accent`, `picture-light`, `picture-dark` and the four status kinds. Content that paints no background takes no kind and inherits. _Avoid_: plate kind, variant.

**Mode**: Light or dark mode, chosen on an element, which turns it and everything in it. Without a choice an element inherits its parent's, and a page is light; the operating system's preference changes nothing by itself. Every Kind has values for both modes; `brand`, `inverse` and `accent` stay dark in both. _Avoid_: theme, polarity.

**Polarity**: Whether a Surface is light or dark, given by the step its background stands on. It is output, not a choice, and sets the browser's own colour scheme. _Avoid_: mode.

## Type, space and shape

**Type scale**: The sizes of the text styles: the body size times the scale's base to the power of the style's step. The body size and the base are each set at two Breakpoints, so headings close up on a phone and open out on a wide screen. _Avoid_: font sizes, type ramp.

**Breakpoint**: One of the two window widths at which the body size and the scale's base are set. Between them both follow a straight line, and outside them they stay fixed.

**Text style**: One of the twelve recipes of size, weight, line height and spacing: display, heading 1 to 6, lead, body, small, label and mono. A heading style is a look, apart from the heading's level in the HTML. _Avoid_: heading level, for the look.

**Typeface role**: Where a typeface is used: text, headings, the first heading, display, labels and code. Each sets its typeface and its axes on its own, and follows another role until it is set. _Avoid_: font stack.

**Density**: The one slider that sets every space step, from very compact to very loose.

**Corner profile**: The one slider that sets every radius, from square to clearly rounded.

**Shadow**: The six tuned elevations, from the header over the page to a lifted box, all changed alike by four sliders: strength, hardness, angle and elevation. Each target chooses whether it casts one. _Avoid_: elevation, for the whole.

**Frame**: A solid line round the components that take it, 0 to 3 px thick, set apart from the Shadow. The thin lines of tables and fields are colour Roles, not the frame. _Avoid_: border.

## The page

**Page**: The sheet as wide as the window, always opaque, that holds the main content between the header and the footer. It owns its fill in each Mode, the Content area, its sequence of Bands and the shadow on the footer.

**Content area**: The centred area that the header's, the footer's and every Band's content align to: as wide as Wide, or the window less a side margin on each side where that is less. _Avoid_: container, wrapper.

**Layer**: One of the three layers, from the top: the header with the panels it opens, the page, and the footer. The upper layer casts the shadow on the lower, never the reverse.

**Band**: A strip of the page from edge to edge, with the Content area inside it, that owns the space above and below its content and may have a Surface of its own. The main content is Bands only. Adjacent Bands on the same background get less space between them than at a change of background. _Avoid_: section, for any band; row, strip.

**Width**: How wide an element is: `narrow`, `wide`, `full`, or one-sided, `bleed-start` and `bleed-end`, from the Content area's edge to the window's on one side. _Avoid_: rail.

**Wide**: The widest the Content area gets, and the width `wide`, the whole Content area.

**Narrow**: The reading measure, the width at which body text stays readable, and the readable column of a Reading Area. _Avoid_: measure, content column.

**Reading Area**: A container in a Band that lays out a Narrow column and an Aside beside it, and does nothing else: it has no background and no vertical space of its own. When the Aside would be too narrow it goes to one column. _Avoid_: sidebar layout, Narrow/aside.

**Aside**: The space beside Narrow in a Reading Area, at the start or the end. _Avoid_: sidebar. Not the `aside` directive, which makes a fact box in the reading column.

**Flow**: A Reading Area's ordinary content, in Narrow and in order.

**Aside Block**: Content that belongs to the whole Reading Area and stands at the top of the Aside, such as a table of contents or a contact box. It may stay in view as the page scrolls. _Avoid_: widget.

**Sidenote**: A note anchored to a point in the flow, which stands in the Aside level with what it follows, or inline after it in one column. _Avoid_: footnote, margin note.

**Breakout**: An element of the flow wider than Narrow, which stays in the flow with the text going on below it. _Avoid_: full-bleed, alone.

## The frame of the page

**Header**: The component at the top of every page: the Identity, the menus, the language switcher, search and a call to action, in one of three arrangements. It either scrolls away with the page or is sticky.

**Footer**: The component at the end of every page: two Bands, each a grid of two by two cells, turned on cell by cell. It is either the page's last part or lies under the page at the window's edge, uncovered as the page scrolls off it.

**Attachment**: How the header or the footer holds its place: the header's `flow` or `sticky`, the footer's `flow` or `reveal`.

**Identity**: The brand the header shows and the footer repeats: a logo, which is a symbol only, a name, or both, with an optional slogan. _Avoid_: branding, logo, for the whole.

**Megamenu**: The panel the menu button opens under the header, with the menu's first level as headings over columns of the second. _Avoid_: dropdown, hamburger menu.

**Hero**: The Band that opens a page, with its own choices of size, picture, the text's place, colour and the look of its heading. _Avoid_: banner, header.

**Trail**: The breadcrumb links, which always stand directly before the page's H1, in the hero or under it. _Avoid_: breadcrumb bar.

## Components and directives

**Component**: A recurring part of a page, delivered as CSS on the Roles, an Astro component and plain HTML. It has no design settings of its own: it takes everything from colour, type, space and shape. _Avoid_: block, module, widget.

**Runtime**: A small page script that gives a component its behaviour, such as remembering consent, deferring an embed or measuring how far the header gives way, and only shows, hides or moves what is on the page. Behaviour is HTML and CSS wherever that is possible, and a small script is preferred to duplicating markup.

**Polyfill**: A small page script that stands in for an HTML or CSS feature one browser engine lacks, such as scroll-driven animations for the sticky header, so the page looks and behaves the same in all three. It loads only where the browser lacks the feature, sets only what the CSS reads, and goes once every engine has the feature. _Avoid_: shim, fallback.

**Directive**: A component written in a Konzilo content file, as a leaf or a container around blocks. The core's directive list decides which exist and what their HTML means; this design system decides their look and gives each its classes (`docs/spec/directives.md`). _Avoid_: shortcode.

**Fact**: An attribute that states something about the text that no selector can see, such as a long deck or headings that are all questions. The directives module computes it at build, and the site writes it. A fact never names a layout.

**Section**: The directive and the component: a Band of up to three groups, its Media, its Head and its body, whose layout the stylesheet reads from what they hold. _Avoid_: band, for this component alone.

**Head**: A section's group of eyebrows, its `h2` and its Deck, with any actions that follow at once. Without the `h2` there is no head. _Avoid_: header.

**Deck**: The paragraph right after a heading in a hero or a section's Head, set in the lead style. It is long when it holds more than a line beside its heading. In an article's opening the deck holds the core's standfirst. _Avoid_: subheading, lead, for the part.

**Eyebrow**: A short label above a heading, in its heading group. _Avoid_: kicker, overline.

**Section layout rule**: One of the six rules of the directive list by which the stylesheet lays out a section from its groups: a picture first; a heading with a form right after it; another form or a choice; a head, its actions and an accordion; a head and paragraphs only; a head and a Series. The first that matches decides; with none, the head stands above the body. _Avoid_: layout variant, template.

**Series**: A run of like parts in a section's body: cards, cards that lead on, a timeline, reasons or a post list. Its number of items sets its columns. _Avoid_: grid, for a series.

**Item**: A part of a form that begins at a heading: a card, an accordion's item, a tab, an entry of a table of contents or a choice's answer. Every heading at the level of the form's first begins one, and what stands before the first is the form's intro. _Avoid_: child, entry.

**Page context**: What a page's template gives the directives' components and the post lists' presentations once, before its body, with `designPage(Astro, …)`: the design, the post's title, the trail's levels, the site's own words and the page's count of ids, none of which the core hands a component. _Avoid_: props, globals.

**Page part**: A component a site's template places around a body, which no directive gives and the core does not draw: a page's bands and title band, an article's opening, body and "Read more", and a term's opening (`docs/spec/directives.md`, The page parts). _Avoid_: template, which is the site's own.

**Post-list presentation**: How a post list is drawn, `cards`, `featured` or `filtered`: a component a site registers and declares in its site description, which the core hands the list's posts. _Avoid_: presentation, alone, which is the client's ZIP.

**Following menu**: A table of contents that stays beside the text as the page scrolls, as an article's "In this article". It marks no section as the one being read, so it is the same in every browser. _Avoid_: scroll-spy.
