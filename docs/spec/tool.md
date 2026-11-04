# The design system and its tool

Records the design system, tool inputs, outputs and design file, with their status and reasoning.

**Owner (2026-11-01):** Konzilo is a pre-prototype on the way to Blueprint; long term, Astro in front and WordPress or Sveltia CMS behind, switchable. The framework's foundations are the plates (plates.md) and the page, header and footer models (page.md, header.md and footer.md); two things remain, the components and a tool. The design system must serve any site, also one someone else implements in WordPress or elsewhere from it.

*Decided* 2026-11-01:

1. **A stand-alone design system**, its own repository with the tool, apart from the Konzilo core: download it, run it, tune colours and type, send the client the presentation, adjust, and export. Konzilo sites consume it; how is the assistant's proposal (below). Each site holds only its inputs and the components only it needs; Konzilo's plan, which gives each site its own design and components, changes by an ADR there. The generic decisions in this file move to the design system's repository.

   **One tool:** `konzilo-design tool <design-file>` opens the local editor, on the named file, or on a new design created there if the file does not exist; without a file it stops and shows its usage, and the first write of a run first copies an existing file to `<name>.bak.json` (*decided* by the owner, 2026-11-03). It shows the presentation's pages with their controls in place, beside a live preview of the real components at mobile and desktop width at once, in one window or two (*decided* by the owner, 2026-11-03, after trying sketches; the narrow type scale shows only on a phone and the wide one only on a desktop, so both ends must be visible while dragging). One to three colours, typefaces, type scale, shadows, frame, corners and density generate every token together. Save writes the complete design file; a button makes the presentation for people (point 4). See `tool/README.md`.
2. **Inputs:**
   - one to three brand colours, ranked primary, secondary, tertiary, and always a grey scale;
   - typefaces (*decided* 2026-11-02): one typeface throughout is the norm, as a rule a sans-serif and often Mona Sans, so the simple path must stay simple:
     - the main typeface, preselected Mona Sans, with the system sans-serif stack and typefaces of one's own as alternatives; with nothing chosen at all the library uses the system stack;
     - the monospace typeface, which always exists: in the library the system stack until someone deliberately chooses one, and in a new design Mona Sans Mono. Choosing labels in monospace picks Geist Mono if the system stack was selected;
     - exceptional first-heading choices stay in the same role list, without a separate tool or mode;
     - a heading typeface, following the main one unless set, for example a sans-serif above serif text, and a display typeface for large text, following the headings unless set. They are inputs because the presentation is made from the design file and typeface tuning has to know which typeface a style has;
     - **where a need lives** (owner): in the tool if that stays simple. If it gets too complex, the tool is simplified and the need stays in the design system. If that too gets too complex, it goes out to the CSS. The goal is a simple tool for choosing the arrangement of typefaces and each style's step, with everything on the type scale;
     - the tool's type section shows this as one row per role, each following another role until changed, with a named ratio at each breakpoint. The first heading now has optional `typefaces.heading-1` and `type.heading-1-color` inputs; the latter selects the checked text or accent role. Absolute step controls preserve every other style's step while storing the schema's relative steps;
     - **Built** (*decided* by the owner, 2026-11-03): the library ships 47 variable typefaces in `src/fonts/`, the owner's list in the owner's order: sans-serif, slab serif, serif, display and monospace, plus two partners for body text. `bin/design-fonts` holds the list and fetches each from its best source, which is the designers' own repository where that is better and a family download from Google Fonts where that is, never a font service's stripped web files. `catalog.js` is written from it, with each typeface's roles and its axes as read from the file. A display typeface is only for the first heading and larger. Each typeface has an italic of its own, drawn or sloped by its designers, or one reached through its slant axis; Roboto Slab and Mona Sans Mono have neither and stay upright, since a browser never synthesises one (`font-synthesis-style: none`). The presentation inlines only the typefaces a design uses. A site serves font files itself, without a third-party font request;
     - **Every role is set on its own** (*decided* by the owner, 2026-11-03): text, headings, the first heading, display, labels and code each choose a typeface and turn the axes that typeface has, with the letter spacing and its alternate letters (`typefaces.<role>`, `type.roles.<role>`). The first heading follows the headings or display text, the owner's reason being that it is special, and keeps its own size on the type scale. A new design uses Mona Sans for everything, with its own Mona Sans Mono for code, and sets two roles: display text light and open (weight 260, width 112, optical size 100, spacing -0.03) and labels with the look of Mona Sans Mono at width 75 and weight 800, but in the proportional Mona Sans, since a monospace forces every glyph to one width (weight 800, width 75, optical size 0, spacing 0.06, `ss02` for the slab I, `ss07` for the square G). An existing design without settings keeps its recipes;
   - the label style (*decided* 2026-11-02): labels in the main family, the default, in the monospace family, or since 2026-11-03 in a typeface of their own. components.md, Typefaces and labels, has what counts as a label and the recipes;
   - the body size, set as at the narrowest and widest window;
   - a type scale (ratio), and for each heading level how many steps it climbs from the one below, for a faster progression where wanted; not a switch between two scales (*decided* 2026-11-01):
     - The ratio, the base of the scale, is set at two breakpoints, like the body size, so headings close up on a phone and open out on a wide screen (*decided* by the owner, 2026-11-03; it replaces a straight line on each size in a fixed 320–1440px window, of 2026-11-01). A size is the body size times the base to the power of the style's step, so at every width the styles form a true scale. The base and the body size each follow a straight line between the breakpoints and stay fixed outside them: one scale with the same steps throughout. With one ratio everywhere, a display heading could be 55px on a phone; with 1.067 there and 1.125 on a wide screen it is 33px.
     - The breakpoints lie anywhere from 320 to 1920px with left at most right, 390 and 1440px by default (`type.breakpoints`). On one width the scale changes at once there, as at a media query's `min-width`.
     - In CSS each size is `calc(body * pow(base, step))`, in `@supports`, as `pow()` and `atan2()` give a window width as a number. A browser without them keeps a `clamp()` between the same two end values, with a straight line on the size. The two differ only between the breakpoints, by a pixel or two at ordinary settings.
     - The tool shows this as a number line (*decided* by the owner, 2026-11-03): at each breakpoint a filled arrow to drag, with the width under the line and above it the base and the name of its scale. The figures can be typed over, the name opens a menu of the named scales and says Custom off them. A hollow arrow under the line says which width the rows below show, and changes nothing in the design.
     - Steps: h6 from body text, then h5, h4, h3, h2, h1 and display each from the level below; the lead above body text; small text below it, and labels below body text as well. The default: 0, 1, 1, 1, 1, 3, 3; lead 1; small text 2 below; labels 5 below.
   - shadows, from none through barely visible and very diffuse to a hard, solid outline (*decided* 2026-11-01, after the owner tried a live model of it):
     - Each elevation has a tuned shape, a near and a far shadow, inked with the shadow colour: the header over the page, the header over an open panel, a panel over the page, the page over the footer, a box, and a lifted box at twice the box's elevation.
     - Four sliders transform every elevation alike, each mapping straight onto `box-shadow` values: strength scales the opacity, and zero is off, with no switch of its own beside it, since no target casting a shadow comes to the same (owner, 2026-11-03); elevation scales distance, blur and spread; the light's angle turns the offset; hardness below its reference position widens blur and spread up to double, and above it shrinks them to zero. At hardness 100 the shadow is a solid offset in the full shadow colour whatever the strength (the owner's expectation, for designs like the Tove and Oaknut WordPress themes). Hard shadows round to whole pixels.
     - The reference positions are strength 50, hardness 20, angle 0 and elevation 50, and there each elevation is its tuned shape unchanged. A new design starts from the owner's defaults (2026-11-03): strength 0, hardness 30, elevation 50, falling straight down, in the text colour, with every target casting a shadow. The strength slider catches at 50.
     - The shadow colour is the text colour by default, or one of the brand colours, grey or black.
     - On a dark plate a shadow stays dark (*decided* 2026-11-01, after comparing it with the plate's light text colour and with a hairline): where the default text colour would be light, the shadow is black at three times the opacity. A light shadow there is only a faint glow, and a hard light offset merges with a white card. On a near-black plate even this fades, and the card shows because a raised plate is lighter than its ground. A shadow colour chosen explicitly is used as chosen.
     - Where shadows fall is chosen per target: cards (later other raised components), the header, the megamenu, the page over the footer. A hard shadow suits cards, not the large layers (owner). A layer without a shadow is set off by the hairline, as at strength zero.
     - Off by default; switching on starts from the reference positions.
   - a frame, a setting of its own apart from the shadow (*decided* 2026-11-01): thickness 0–3px, none by default, and a colour, the shadow's by default; always solid, its corners from the corner slider. Which components take it is settled with the components. The thin grey lines of tables and fields are colour roles, not this;
   - one corner slider, from square through almost square (a few pixels) and discreet to clearly rounded;
   - one density slider, from very compact to very loose, with the default towards the looser side.
   - the frame (*built* on the owner's word, 2026-11-03): what surrounds every page is chosen in the design too, in `header`, `footer`, `page`, `breadcrumbs` and `layout`. It starts with the header, the footer and the page, and then come the components that can stand on a page. header.md, footer.md and page.md say what each setting means. They pass unchanged to `resolved`, for a site to give to its Header, Footer and Page, and they emit no CSS except the widths.
   Type and space are always fluid; everything else follows from the inputs.
3. **Lengths** (the owner asked the assistant to settle it, and approved its proposal on 2026-11-01). A visitor who raises the browser's text size, instead of zooming, keeps that choice only where lengths are in rem or em; zoom works with any unit.
   - The root gets no font size, not even in pixels, so the browser's setting holds. For nearly every visitor that is 16px, so nothing changes for them.
   - rem for type sizes, space, widths, radii and breakpoints.
   - Fluid values as `clamp(min, rem + vw, max)`. Space and margins run between windows of 20rem and 90rem, 320px and 1440px at the default setting; type sizes between the design's breakpoints, in `calc()` where a browser can (point 2, type scale).
   - em inside components, for parts that follow their own text: a button's padding, an icon beside text.
   - px only for what is drawn rather than read: hairlines (1px), the frame (0–3px), focus rings (2px) and shadows. The header's T (24px) is a scroll distance, not a CSS length.
   - line-height unitless, letter-spacing in em.
   - The tool, the design file's `inputs` and the presentation speak in pixels at the default setting, as people think; the generated CSS writes rem, so 17–19px between those windows becomes `clamp(1.0625rem, 1.0268rem + 0.1786vw, 1.1875rem)`.
4. **Two outputs:**
   - **For people** (*decided* by the owner, 2026-11-02, replacing a PDF, because a PDF renders shadows and the like badly and leaves little room to explain): the tool writes a ZIP archive holding one self-contained HTML file that opens in any browser, with nothing fetched from elsewhere, and is browsed page by page.
     - **Progressive disclosure:** one page at a time. Colour first: the scale and its shades, then the colours on one another, light text on dark and the reverse, with the contrast ratios in fine print under each example instead of a large table. Typography next: the main typeface, the type scale and how it closes up and opens out with the window, the complementary typefaces, and examples in use. Then space, corners and shadow.
     - **Components by theme:** header, footer, the page itself, then what goes on a page. A sensible selection is shown, not every combination, with the option to click for more variants. They are real and work as on a site.
     - **Details last:** whatever specific data remains comes at the very end.
     - **Written motivation:** per chapter, not per detail, the tool takes a text saying why a choice was made, for example why a typeface departs from a client's graphic standard. It is shown on its first applicable page and kept in the design file's `project`. The typeface and type-scale pages have separate explanations; space and shape share one, while shadow has its own.
     - **Comments:** the reader can leave comments as they go. They are kept in the browser and leave as plain text, by mail or as a file, so the owner can read what the client thinks. No server is involved.
   - **For code:** the components, HTML and CSS, all of them with all their CSS, in a form a Konzilo site takes in simply and gets exactly what was decided.
   - **For AI agents** (*decided* by the owner, 2026-11-03): `DESIGN.md`, Google Labs' open format, still an alpha, with the tokens, the Surfaces, the components and the rules, so an agent can design pages from the same decisions. The format's own command turns it into DTCG tokens or a Tailwind theme, so those need no export of their own here.
5. **The design file** (owner's idea; the assistant decided its form, 2026-11-01): the tool's settings produce one JSON file, the source, which is what is handed on; everything else is made from it.
   - `inputs`: what the tool's controls set, the only part a person changes, through the tool.
   - `project`: the presentation name, optional string `version` (default `1.0`), `logo` and optional `logo-dark`, as data URIs or paths relative to the design file. The document version is independent of the generator version.
   - `resolved`: every value the generator derived (ramps, each plate kind's roles in light and dark mode, type and space steps as min and max, radii, shadows as finished CSS values), with the generator's version, a fingerprint of `inputs` and the contrast check's result.
   - Consumers read `resolved` and need no generator, so a consumer in another language (a future WordPress plugin setting a theme's values) never reimplements the colour maths, and every consumer gets the same values. A file whose `inputs` no longer match the fingerprint is refused. Consumers: the Konzilo package, the presentation, the export, later others. Its own plain format; DESIGN.md (point 4) is how it reaches other tools.
6. **Where:** the repository `Kntnt/konzilo-design` (private, created 2026-11-01), locally `~/Projects/konzilo-design`; Konzilo sites take it as a pinned package plus their design file, others take the export.

## HTML presentation implementation (2026-11-02)

The local button is **Create presentation**; it saves before packaging. The CLI
`konzilo-design presentation <design-file> [-o out.zip]` resolves without changing
the source. The former PDF command and renderer are removed. The default ZIP is
`<stem>-presentation-<YYYY-MM-DD>.zip`, beside the source, stripping `.design`.
It contains only `<project-name-slug>-<document.filename>.html`; the final filename
word is a copy key. All assets are inline and the build needs no browser.

The reader has 23 pages: Start, two colour pages, four typography pages, three
space/shape pages, eleven component pages, Details and Comments. Hash routing
preserves history. The desktop sidebar is 260 px; a menu replaces it below 900 px.
The actual component specimens load lazily in independent real-width iframes.
Shared CSS, fonts and scripts are held once and inserted at runtime. The full-page
specimen scrolls in a 560 px viewport; ordinary specimens fit their content.
Changing their width or mode reserves the stage height so surrounding content
stays still. Reference data and additional variants are disclosed on request.

Optional project fields are `introduction`, `contact: { name, email }` and
`explanations: { colour, typefaces, type-scale, space-shape, shadow, components }`.
They never enter the input fingerprint. Plain text is escaped; blank lines make
paragraphs. The first page for each explanation is respectively colour scale,
main typeface, type scale, space, shadow and header. Introduction and contact
controls are on the tool's Start page. Explanation controls finish their relevant
page, after its controls and examples.

Comments, edits, reader name and drafts save as typed in browser localStorage,
keyed by document identity and version. Inaccessible storage uses memory with a
visible reminder. Export includes unsent drafts as readable UTF-8 plain text.
Mail links above 1800 encoded characters use a short attachment note. Comments
remain after export and are cleared only by an explicit confirmed action.
The content security policy refuses network access, including third-party media;
its local explanation remains interactive. See `presentation/README.md` for the
copy override, offline asset and verification contracts.

## Sample pictures (2026-11-04)

The sample pages show real photos, because a client judges a hero or a card by how it looks with a photograph in it. They are a small neutral set in `presentation/pictures/`, without recognisable faces or legible brands; people stay drawn, in the design's colour. A client's own photos take their places as files in a folder beside the design file, and are embedded only when a presentation is built. They stay out of the design file, because the tool sends the model to the preview on every step of a drag, and out of this repository. Whether the pages show pictures is a way of looking at them, in the tool and in the presentation alike, not a design setting.
