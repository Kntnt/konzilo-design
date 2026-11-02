# The design system and its tool

Records the design system, tool inputs, outputs and design file, with their status and reasoning.

**Owner (2026-11-01):** Konzilo is a pre-prototype on the way to Blueprint; long term, Astro in front and WordPress or Sveltia CMS behind, switchable. The framework's foundations are the plates (plates.md) and the page, header and footer models (page.md, header.md and footer.md); two things remain, the components and a tool. The design system must serve any site, also one someone else implements in WordPress or elsewhere from it.

*Decided* 2026-11-01:

1. **A stand-alone design system**, its own repository with the tool, apart from the Konzilo core: download it, run it, tune colours and type, send the client the presentation, adjust, and export. Konzilo sites consume it; how is the assistant's proposal (below). Each site holds only its inputs and the components only it needs; Konzilo's plan, which gives each site its own design and components, changes by an ADR there. The generic decisions in this file move to the design system's repository.

   **One tool:** `konzilo-design tool [design-file]` opens the local editor with a fixed control column and a live preview of the real components. One to three colours, typefaces, type scale, shadows, frame, corners and density generate every token together. Save writes the complete design file; a button makes the presentation for people (point 4). See `tool/README.md`.
2. **Inputs:**
   - one to three brand colours, ranked primary, secondary, tertiary, and always a grey scale;
   - typefaces (*decided* 2026-11-02): one typeface throughout is the norm, as a rule a sans-serif and often Mona Sans, so the simple path must stay simple:
     - the main typeface, preselected Mona Sans, with the system sans-serif stack and typefaces of one's own as alternatives; with nothing chosen at all the library uses the system stack;
     - the monospace typeface, which always exists: the system stack until someone deliberately chooses one, for labels or for a site with much code, and then as a rule Red Hat Mono. Choosing labels in monospace picks Red Hat Mono if the system stack was selected;
     - exceptional first-heading choices stay in the same role list, without a separate tool or mode;
     - a heading typeface, following the main one unless set, for example a sans-serif above serif text, and a display typeface for large text, following the headings unless set. They are inputs because the presentation is made from the design file and typeface tuning has to know which typeface a style has;
     - **where a need lives** (owner): in the tool if that stays simple. If it gets too complex, the tool is simplified and the need stays in the design system. If that too gets too complex, it goes out to the CSS. The goal is a simple tool for choosing the arrangement of typefaces and each style's step, with everything on the type scale;
     - the tool's type section shows this as one row per role, each following another role until changed, with named ratios for the narrowest and widest windows. The first heading now has optional `typefaces.heading-1` and `type.heading-1-color` inputs; the latter selects the checked text or accent role. Absolute step controls preserve every other style's step while storing the schema's relative steps;
     - **Built:** the library ships Mona Sans and Red Hat Mono in `src/fonts/`; the tool and presentation inline them. A site serves font files itself, without a third-party font request;
   - the label style (*decided* 2026-11-02), one choice of two: labels in the main family, the default, or in the monospace family. components.md, Typefaces and labels, has what counts as a label and the recipes;
   - the body size, set as at the narrowest and widest window;
   - a type scale (ratio), and for each heading level how many steps it climbs from the one below, for a faster progression where wanted; not a switch between two scales (*decided* 2026-11-01):
     - The ratio is set at the narrowest and the widest window, like the body size, so headings close up on a phone and open out on a wide screen. Every size grows linearly between the two windows (`clamp()`, 320–1440px at the default setting) and stays fixed outside them: one scale with the same steps throughout and no breakpoint. With one ratio everywhere, the reference design's display heading would be 55px on a 320px phone; with 1.067 there and 1.125 on a wide screen it is 33px.
     - Steps: h6 from body text, then h5, h4, h3, h2, h1 and display each from the level below; the lead above body text; small text below it, and labels below body text as well. The reference design: 0, 1, 1, 1, 1, 3, 3; lead 1; small text 2 below; labels 5 below.
   - shadows, from none through barely visible and very diffuse to a hard, solid outline (*decided* 2026-11-01, after the owner tried a live model of it):
     - Each elevation keeps the reference design's tuned shape, a near and a far shadow, inked with the shadow colour: the header over the page, the header over an open panel, a panel over the page, the page over the footer, a box, and a lifted box at twice the box's elevation.
     - Four sliders transform every elevation alike, each mapping straight onto `box-shadow` values: strength scales the opacity, and zero is off; elevation scales distance, blur and spread; the light's angle turns the offset; hardness below the reference widens blur and spread up to double, and above it shrinks them to zero. At hardness 100 the shadow is a solid offset in the full shadow colour whatever the strength (the owner's expectation, for designs like the Tove and Oaknut WordPress themes). Hard shadows round to whole pixels.
     - At the reference positions (strength 50, hardness 20, angle 0, elevation 50) the output is the reference design's shadows character for character.
     - The shadow colour is the text colour by default, or one of the brand colours, grey or black.
     - On a dark plate a shadow stays dark (*decided* 2026-11-01, after comparing it with the plate's light text colour and with a hairline): where the default text colour would be light, the shadow is black at three times the opacity. A light shadow there is only a faint glow, and a hard light offset merges with a white card. On a near-black plate even this fades, and the card shows because a raised plate is lighter than its ground. A shadow colour chosen explicitly is used as chosen.
     - Where shadows fall is chosen per target: cards (later other raised components), the header, the megamenu, the page over the footer. A hard shadow suits cards, not the large layers (owner). A layer without a shadow is set off by the hairline, as at strength zero.
     - Off by default; switching on starts from the reference.
   - a frame, a setting of its own apart from the shadow (*decided* 2026-11-01): thickness 0–3px, none by default, and a colour, the shadow's by default; always solid, its corners from the corner slider. Which components take it is settled with the components. The thin grey lines of tables and fields are colour roles, not this;
   - one corner slider, from square through almost square (a few pixels) and discreet to clearly rounded;
   - one density slider, from very compact to very loose, with the default towards the looser side.
   Type and space are always fluid (`clamp()`); everything else follows from the inputs.
3. **Lengths** (the owner asked the assistant to settle it, and approved its proposal on 2026-11-01). A visitor who raises the browser's text size, instead of zooming, keeps that choice only where lengths are in rem or em; zoom works with any unit.
   - The root gets no font size, not even in pixels, so the browser's setting holds. For nearly every visitor that is 16px, so nothing changes for them.
   - rem for type sizes, space, widths, radii and breakpoints.
   - Fluid values as `clamp(min, rem + vw, max)` between windows of 20rem and 90rem, 320px and 1440px at the default setting.
   - em inside components, for parts that follow their own text: a button's padding, an icon beside text.
   - px only for what is drawn rather than read: hairlines (1px), the frame (0–3px), focus rings (2px) and shadows. The header's T (24px) is a scroll distance, not a CSS length.
   - line-height unitless, letter-spacing in em.
   - The tool, the design file's `inputs` and the presentation speak in pixels at the default setting, as people think; the generated CSS writes rem, so 17–19px body text becomes `clamp(1.0625rem, 1.0268rem + 0.1786vw, 1.1875rem)`.
4. **Two outputs:**
   - **For people** (*decided* by the owner, 2026-11-02, replacing a PDF, because a PDF renders shadows and the like badly and leaves little room to explain): the tool writes a ZIP archive holding one self-contained HTML file that opens in any browser, with nothing fetched from elsewhere, and is browsed page by page.
     - **Progressive disclosure:** one page at a time. Colour first: the scale and its shades, then the colours on one another, light text on dark and the reverse, with the contrast ratios in fine print under each example instead of a large table. Typography next: the main typeface, the type scale and how it closes up and opens out with the window, the complementary typefaces, and examples in use. Then space, corners and shadow.
     - **Components by theme:** header, footer, the page itself, then what goes on a page. A sensible selection is shown, not every combination, with the option to click for more variants. They are real and work as on a site.
     - **Details last:** whatever specific data remains comes at the very end.
     - **Written motivation:** per chapter, not per detail, the tool takes a text saying why a choice was made, for example why a typeface departs from a client's graphic standard. It is shown on its first applicable page and kept in the design file's `project`. The typeface and type-scale pages have separate explanations; space and shape share one, while shadow has its own.
     - **Comments:** the reader can leave comments as they go. They are kept in the browser and leave as plain text, by mail or as a file, so the owner can read what the client thinks. No server is involved.
   - **For code:** the components, HTML and CSS, all of them with all their CSS, in a form a Konzilo site takes in simply and gets exactly what was decided.
5. **The design file** (owner's idea; the assistant decided its form, 2026-11-01): the tool's settings produce one JSON file, the source, which is what is handed on; everything else is made from it.
   - `inputs`: what the tool's controls set, the only part a person changes, through the tool.
   - `project`: the presentation name, optional string `version` (default `1.0`), `logo` and optional `logo-dark`, as data URIs or paths relative to the design file. The document version is independent of the generator version.
   - `resolved`: every value the generator derived (ramps, each plate kind's roles in light and dark mode, type and space steps as min and max, radii, shadows as finished CSS values), with the generator's version, a fingerprint of `inputs` and the contrast check's result.
   - Consumers read `resolved` and need no generator, so a consumer in another language (a future WordPress plugin setting a theme's values) never reimplements the colour maths, and every consumer gets the same values. A file whose `inputs` no longer match the fingerprint is refused. Consumers: the Konzilo package, the presentation, the export, later others. Its own plain format; a DTCG export only when something needs one.
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
controls are in Client. Explanation controls finish their relevant section, with
a small Components section for its one field.

Comments, edits, reader name and drafts save as typed in browser localStorage,
keyed by document identity and version. Inaccessible storage uses memory with a
visible reminder. Export includes unsent drafts as readable UTF-8 plain text.
Mail links above 1800 encoded characters use a short attachment note. Comments
remain after export and are cleared only by an explicit confirmed action.
The content security policy refuses network access, including third-party media;
its local explanation remains interactive. See `presentation/README.md` for the
copy override, offline asset and verification contracts.
