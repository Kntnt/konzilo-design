# Framework names

Records the naming principles, framework and design-file name draft, and decisions still for the owner.

***Settled* 2026-11-01.** The owner chose the prefix; he left the other naming questions to the assistant, which took the recommendations under "Naming decisions" below, with the adjustments noted there. Every name in the tables is now the framework's name; the status column records where its spelling came from. Sources are the six neighbouring spec files and Blueprint's canonical vocabulary, including Q314 as amended by Q368–Q370. The eight Surface kinds, English terminology, eleven context roles plus polarity, continuous controls and design-file sections are already decided. New spellings and selector forms below remain proposals.

## Naming principles

- English is canonical. Use Blueprint's words where they exist: **Surface**, never Plate in English; “plate” / “platta” belong only in Swedish talk.
- Identifiers follow CSS's own spelling, `color` and `gray`, so that `--kn-frame-color` sits beside `border-color`; prose keeps British spelling.
- Use kebab-case in custom properties, classes, attributes and design-file keys. Keep the same word for the same thing in the design file, CSS and documentation.
- Name a role for its use, never its current value or colour. Components consume roles; generated ramps and steps are implementation values.
- No `on-` pairs. A Surface supplies a complete context, including nested Surfaces.
- Order names by family, variant, then state: `--text-muted`, `--border-strong`, `--button-background-hover`. A namespace precedes the family.
- Names carry no units. Follow tool.md point 3: rem for type sizes, space, widths, radii and breakpoints; em for component parts following their text; unitless line-height and em letter-spacing. Only what is drawn rather than read uses px: hairlines, the frame, focus rings and shadows. Durations use CSS time units.

## How to read the inventory

**Status concerns the spelling.** “Working name from spec” preserves a spelling already used there; any decided meaning is stated separately. “Proposed here” means that the exact spelling or mapping is new, even when its purpose is already decided. Each row gives the reason for retaining or proposing the name. The first six components' classes and mutually exclusive states are recorded under "Component names" below.

**Namespace notation:** custom properties below use their readable stems (`--text`, for example). Under decisions 1–2, the actual exported name is `--kn-text`, with no bare alias. Apply this transformation to every custom property in every table. Selector tables show the recommended full namespace explicitly. Design-file keys and attribute values are unprefixed inside their enclosing file or namespaced attribute. Standard CSS properties and native HTML/ARIA attributes keep their standard names.

### Context roles and Surface application

The eleven original roles are decided in plates.md point 3 and “Decided with the owner”, point 4. Their spellings remain working names; retain all eleven because each supplies a distinct checked relationship. The three button context roles below were decided with the components on 2026-11-01, and the alternate fill with Table on 2026-11-02. Further states follow as components need them.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--background` | The Surface's opaque background fill, with a fallback colour for an image | plates.md §3; page.md §1 | Working name from spec | Covers colour, gradient and image without calling every fill a colour. |
| `--background-alt` | Checked alternate fill for table rows | Components, 2026-11-02 | Decided with the components; assistant's technical choice | Keeps the background family together; existing text, muted text and links pass on it. |
| `--background-hover` | Checked fill under the pointer | Components, 2026-11-02 | Decided with the components | Existing text and links pass on it at 4.5:1. |
| `--text` | Primary foreground text | plates.md §3 | Working name from spec | Names the use independently of light or dark. |
| `--text-muted` | Secondary foreground text, still contrast-checked | plates.md §3 | Working name from spec | Keeps the text family together. |
| `--border` | Ordinary separating border colour | plates.md §3 | Working name from spec | Describes separation rather than a shade of grey. |
| `--border-strong` | Stronger border colour where separation needs emphasis | plates.md §3 | Working name from spec | A variant of the same border family. |
| `--link` | Link foreground | plates.md §3 | Working name from spec | Gives links a checked relationship on each Surface. |
| `--accent` | Contextual accent colour | plates.md §3 | Working name from spec | Keeps the accent role distinct from a raw Brand Colour Seed. |
| `--focus` | Focus-ring colour | plates.md §3 | Working name from spec | Names the interaction purpose. |
| `--info` | Information-status colour | Components, 2026-11-02 | Decided with the components | Fixed blue seed, checked like the other status roles. |
| `--success` | Success-status colour | plates.md §3 | Working name from spec | Names meaning rather than green. |
| `--warning` | Warning-status colour | plates.md §3 | Working name from spec | Names meaning rather than yellow. |
| `--error` | Error-status colour | plates.md §3 | Working name from spec | Names meaning rather than red. |
| `--button-background` | Filled button background on this Surface | Components, 2026-11-01 | Assistant's technical choice | Fixed polarity recipe; checked against its ground at 3:1. |
| `--button-text` | Filled button text | Components, 2026-11-01 | Assistant's technical choice | Checked against normal and hover fills at 4.5:1. |
| `--button-background-hover` | Filled button hover and active background | Components, 2026-11-01 | Assistant's technical choice | A checked state on the same role family. |
| `--background-translucent` | The Surface's background as a translucent layer shows it: at the least opacity at which every role a layer draws on it holds over any page, at least 85% | The owner's hint of the page through the header, 2026-11-12 | The assistant's technical choice | A fill of the background family, as the alternate and hover fills are; the opacity is stored as `translucent` on each Surface's mode in `resolved.surfaces`, and the CSS writes the colour. |
| `--polarity` | Generated `light` or `dark` marker for the Surface | plates.md §§3–4 | Proposed here | Uses the spec's exact concept, distinct from a requested mode. |
| `data-kn-surface="<kind>"` | Recommended Surface-kind selector, e.g. `data-kn-surface="raised"` | plates.md §7; proposed here | Proposed here | One attribute expresses one complete context and makes the selected kind visible. |
| `.kn-surface-<kind>` | Alternative class form, e.g. `.kn-surface-raised` | plates.md §7; proposed here | Proposed here | An ordinary class can redeclare the same roles; offered for the owner's choice. |

Both forms redeclare all roles and set the native `color-scheme` property from the generated polarity. The polarity is output, not a second author-controlled declaration. Consumers such as the transparent header use the generated context and marker through the ordinary class or attribute mechanism in plates.md point 7. Omitting a Surface kind inherits the enclosing context; `none`, `plain` and `inherit` are not ninth kinds.

### Surface kinds and local mode

These eight kind names and their meanings, and the two rank tints added on 2026-11-01, are **decided**, not questions to reopen (plates.md §4 and “Decided with the owner”, points 1–2). The selector syntax above remains proposed.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `page` | Page Surface, following the active mode | plates.md §4 | Working name from spec; decided kind | Names the base context's use. |
| `raised` | Raised content such as a card, following the mode | plates.md §4 | Working name from spec; decided kind | Expresses its relation to its ground. |
| `tint` | Light brand tint, following the mode | plates.md §4 | Working name from spec; decided kind | Retains the approved treatment name. |
| `brand` | Dark brand Surface, dark in both modes | plates.md §4 | Working name from spec; decided kind | Retains the approved brand treatment. |
| `inverse` | Dark neutral Surface, dark in both modes: grey 950 in light mode and grey 800 in dark mode | plates.md §4 and the one rule of 2026-11-05 | Working name from spec; decided kind | Preserves the decided name; it does not mean invert the current mode. |
| `accent` | Brand fill for buttons and small marks | plates.md §4 | Working name from spec; decided kind | Shares the accent concept with its context role, in a different scope. |
| `picture-light` | Image treatment with light polarity and tested overlay or text Surface | plates.md §4 | Working name from spec; decided kind | Describes the image context's polarity, not an unchecked image brightness. |
| `picture-dark` | Image treatment with dark polarity and tested overlay or text Surface | plates.md §4 | Working name from spec; decided kind | Completes the approved picture pair. |
| `tint-secondary` | The secondary brand colour's tint, following the mode; present only with a secondary | plates.md, decided point 7 | Decided 2026-11-01 | Names the family first, then the rank, as the brand-colour keys do. |
| `tint-tertiary` | The tertiary brand colour's tint, following the mode; present only with a tertiary | plates.md, decided point 7 | Decided 2026-11-01 | Completes the rank tints. |
| `status-info`, `status-success`, `status-warning`, `status-error` | Mode-following tints of their own status ramps | Components, 2026-11-02 | Decided with the components | Always present, with the full checked role set. |
| `data-kn-mode="light"` | Explicit local light-mode selection; also usable at the root | plates.md §4; proposed here | Proposed here | Uses mode for the selection and leaves polarity for the result. |
| `data-kn-mode="dark"` | Explicit local dark-mode selection; also usable at the root | plates.md §4; proposed here | Proposed here | Keeps the two mode values together under one attribute. |
| `.kn-mode-light` | Class alternative for explicit light mode | plates.md §7; proposed here | Proposed here | Follows the class alternative if the owner chooses that syntax. |
| `.kn-mode-dark` | Class alternative for explicit dark mode | plates.md §7; proposed here | Proposed here | Completes the same alternative. |
| `--kn-in-light`, `--kn-in-dark` | The mode as two switches, for a kind that keeps one `color-scheme` in both modes, where `light-dark()` cannot follow the mode; set wherever `--kn-mode` is | generator.md, Surfaces; 2026-11-05 | The assistant's choice, for the owner's rule of 2026-11-05 | Say when a value applies; emitted CSS only, for no component to read. |

No local mode attribute means inherit the selected mode; it does not mean follow the operating system. A light local mode does not turn `brand` or `inverse` light. Picture and accent values in both modes are generated and checked; this draft adds no new mode rule for them. A yellow brand's dark steps stay olive, by the one rule for every colour (plates.md, owner, 2026-11-05).

### Global roles: type

All twelve text styles from tool.md point 2 appear below. The proposed `heading-1` through `heading-6` are **visual styles**, usable on any semantic heading level. The mapping from the spec's h1–h6 labels is explicit; it does not rename HTML elements. Size is generated from the decided fluid scale. Line-height, weight and letter-spacing spellings reserve places for each typeface recipe; their values are not specified in the current specs and are not settled here. This makes every style complete without inventing numerical typography decisions.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--type-display-size` | display style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-display-line-height` | display style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-display-weight` | display style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-display-letter-spacing` | display style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-heading-1-size` | h1 style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-heading-1-line-height` | h1 style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-heading-1-weight` | h1 style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-heading-1-letter-spacing` | h1 style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-heading-2-size` | h2 style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-heading-2-line-height` | h2 style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-heading-2-weight` | h2 style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-heading-2-letter-spacing` | h2 style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-heading-3-size` | h3 style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-heading-3-line-height` | h3 style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-heading-3-weight` | h3 style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-heading-3-letter-spacing` | h3 style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-heading-4-size` | h4 style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-heading-4-line-height` | h4 style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-heading-4-weight` | h4 style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-heading-4-letter-spacing` | h4 style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-heading-5-size` | h5 style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-heading-5-line-height` | h5 style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-heading-5-weight` | h5 style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-heading-5-letter-spacing` | h5 style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-heading-6-size` | h6 style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-heading-6-line-height` | h6 style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-heading-6-weight` | h6 style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-heading-6-letter-spacing` | h6 style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-lead-size` | lead style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-lead-line-height` | lead style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-lead-weight` | lead style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-lead-letter-spacing` | lead style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-window` | How far the window has come between the breakpoints, from 0 to 1, in `@supports` | tool.md §2 | *Built* 2026-11-03 | Names what it measures. |
| `--type-base` | The ratio at this window, in `@supports` | tool.md §2 | *Built* 2026-11-03 | The base each size raises to its step. |
| `--type-body-size` | body style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-body-line-height` | body style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-body-weight` | body style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-body-letter-spacing` | body style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-small-size` | small style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-small-line-height` | small style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-small-weight` | small style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-small-letter-spacing` | small style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-label-size` | label style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-label-line-height` | label style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-label-weight` | label style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-label-letter-spacing` | label style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-mono-size` | mono style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-mono-line-height` | mono style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-mono-weight` | mono style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-mono-letter-spacing` | mono style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--typeface-main` | Main family/stack, for practically all content | tool.md §2 | *Decided* 2026-11-02 | One typeface throughout is the norm. |
| `--typeface-heading` | Heading family/stack; follows main unless set | components.md, Typefaces and labels | *Decided* 2026-11-02 | Serif text can take sans-serif headings. |
| `--typeface-heading-1` | First-heading family/stack; follows heading unless the optional input is set | components.md, Typefaces and labels | *Built* 2026-11-02 | The tool exposes the rare exception without a separate mode. |
| `--typeface-display` | Display family/stack for large text; follows heading unless set | components.md, Typefaces and labels | *Decided* 2026-11-02 | A display face changes only that style. |
| `--typeface-monospace` | Monospace family/stack, always present | tool.md §2 | *Decided* 2026-11-02 | Uses Blueprint's full typeface term; `mono` remains the shorter style name. |
| `--typeface-label` | The stack labels use: main or monospace | tool.md §2 | *Decided* 2026-11-02 | Lets every label follow the design's one choice. |
| `--text-heading-1` | First-heading colour, declared on each Surface and reading text or accent | components.md, Typefaces and labels | *Built* 2026-11-02 | The optional input chooses a checked contextual role. |
| `--type-<style>-features` | A style's font features: `normal`, or its typeface's tuning | components.md, Typefaces and labels | *Decided* 2026-11-02 | Lets tuning follow the typeface and the fluid size. |
| `--type-<style>-stretch`, `--type-<style>-variation` | A style's width and optical size, only where a design sets them for the style's role | tool.md §2 | *Built* 2026-11-03 | Components read them with `normal` as fallback. |

`lead` is a typography treatment, not a replacement name for Blueprint's content term Standfirst. Font assets and internal type-step indexing are generator details; components read these named roles.

### Space steps and roles

The specs decide fluid space steps and semantic space roles, but give neither a step count nor step names. Eight numbered steps are **proposed here**, ordered by size, with no numerical values implied by the names. Step names are internal CSS values for constructing roles; components read the roles only. The same keys live under `resolved.space.steps` without the CSS family prefix.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--space-1` | Smallest generated fluid space step | plates.md §2; proposed here | Proposed here | Stable ordinal independent of density and units. |
| `--space-2` | Second generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-3` | Third generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-4` | Fourth generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-5` | Fifth generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-6` | Sixth generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-7` | Seventh generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-8` | Largest generated fluid space step | plates.md §2; proposed here | Proposed here | Covers broad band space without naming a fixed distance. |
| `--space-component-gap` | Gap inside a component | plates.md §3; proposed here | Proposed here | Names the first decided space use explicitly. |
| `--space-column-gap` | Gap between columns, including Narrow and Aside | plates.md §3; page.md, Reading Area §4; proposed here | Proposed here | Shares the same column-gap role across layouts. |
| `--space-band` | Vertical space at a band's outer edges | plates.md §3; page.md §3; footer.md, model; proposed here | Proposed here | Uses Band, which includes main-content and footer bands. |
| `--space-plate` | Inner space of a box whose colour differs from its ground | Components, 2026-11-01 | Assistant's technical choice | Separate use from column-gap; step 4 since 2026-11-12, when the owner found it too large at step 6. |
| `--space-band-run` | Smaller gap within a run of bands sharing a background | plates.md §3; footer.md, model; proposed here | Proposed here | Makes the adjacency relationship part of the band family. |

### Shape

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--radius-control` | Control radius derived from the continuous Corner Profile | plates.md §§2–3; tool.md §2; proposed here | Proposed here | Names the functional use rather than a roundness preset. |
| `--radius-card` | Card radius derived from the same corner slider | plates.md §§2–3; tool.md §2; proposed here | Proposed here | Allows larger surfaces their appropriate geometry from one input. |

These are the two specified shape roles; no new corner presets or universal radius are implied. A frame uses its target's radius.

### Depth

Tool.md point 2 now names six tuned elevations, each a finished near-and-far `box-shadow` value transformed by the same four controls. Preserve the common layer treatment in page.md point 4 as their shared origin and ownership rule, while exposing the six specific uses from the later tool decision. The layer roles are not six stacking-order numbers.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--shadow-header` | Header over the page | tool.md §2, shadows; header.md §8; proposed here | Proposed here | Names the upper layer that owns the shadow. |
| `--shadow-header-panel` | Header over an open panel | tool.md §2, shadows; proposed here | Proposed here | Distinguishes this tuned elevation from the header over the page. |
| `--shadow-panel` | Panel over the page | tool.md §2, shadows; header.md §§16, 18; proposed here | Proposed here | Covers the shared panel relationship without naming one menu. |
| `--shadow-page` | Page over the footer | tool.md §2, shadows; page.md §4; footer.md, Attachment; proposed here | Proposed here | Correctly puts ownership on the page. |
| `--shadow-box` | Box elevation | tool.md §2, shadows; proposed here | Proposed here | Retains the tool's generic box term rather than limiting it to cards. |
| `--shadow-box-lifted` | Lifted box, twice the box elevation | tool.md §2, shadows; proposed here | Proposed here | Keeps the variant within the box family and avoids hard-coding a distance. |

Shadows are off by default; enabling them starts at the reference positions in tool.md. Dark shadows, the explicit-colour override and hardness 100 behaviour remain as decided in tool.md. A shared control does not collapse the six shapes into one literal shadow. No separate `--shadow-footer` or additional seventh layer-shadow role is proposed.

### Frame

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--frame-width` | Frame thickness, 0–3px, in px like hairlines | tool.md §§2–3; proposed here | Proposed here | Uses CSS's border-width vocabulary without encoding a unit. |
| `--frame-color` | Frame colour, defaulting to the shadow's chosen colour | tool.md §2; proposed here | Proposed here | Uses the same English spelling as the colour inputs. |
| `--frame-ring` | A filled button's frame ring where it differs from the frame colour: with the quiet edge, the button's hover fill | The assistant, 2026-11-11 | *Built* | A button is not a Surface, so it cannot read a plate's own border; absent, the ring is the frame colour. |

The frame is always solid, off by default, with corners from the corner slider. There is no frame-style setting or separate frame radius. Table/field hairlines use context border roles; their naming is not absorbed into frame. Which components take a frame remains for the components.

### Layout

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--layout-wide` | Maximum Wide content measure, owned by the page | plates.md §§2–3; page.md §§2, 5; proposed here | Proposed here | Reuses the canonical Layout Rail word Wide. |
| `--layout-side-margin` | Fluid margin on each side of the content area | plates.md §§2–3; page.md §2; proposed here | Proposed here | Names its geometric role without physical left/right. |
| `--layout-narrow` | Narrow reading measure, owned by the Reading Area | plates.md §§2–3; page.md, Reading Area §4; proposed here | Proposed here | Uses Narrow everywhere instead of introducing a second `measure` alias. |
| `--layout-aside-min` | Minimum usable Aside width | plates.md §§2–3; page.md, Reading Area §4; proposed here | Proposed here | Names the condition that triggers the one-column layout. |
| `--layout-content-area` | Available centred content width: `min(100% − 2 × side margin, Wide)` in the page's full-width context | page.md §2; proposed here | Proposed here | Distinguishes the computed width from Wide's maximum. |

The Reading Area threshold is Narrow + column gap + Aside minimum; it gains no independently named breakpoint. ***Built* 2026-11-10 (the assistant's choice):** `--kn-reading-columns`, `1` on `:root` and `2` inside the media query in rem the CSS emitter works out from that threshold (page.md, The Reading Area, point 4), is the one switch `reading-area.css` reads, by a style query; the generator's `readingColumnWindows` and `readingColumnQueries` give the windows and their queries. Inside the component, `--kn-reading-reach` and `--kn-reading-edge-radius` give a Breakout's picture its reach to the window's edges and its corners, zero and the card radius where it stands at Narrow beside a float. ***Removed* with `reading-area.js`:** `data-kn-columns` on a Reading Area, `data-kn-beside-block`, `data-kn-sticky-active`, `--kn-reading-min-block-size`, `--kn-sidenote-position` and the part `.kn-reading-area-measure`. The content area aligns the header, footer and bands. Layout values use rem or relations built from rem; names do not encode dimensions.

### Theme colours

The roles of the page are `light-dark()`, so for a consumer that reads a colour at build time the core also writes these two as literals on plain `:root`, outside any conditional rule. A Konzilo site names them to the core as its theme colours (konzilo.md).

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--kn-theme-primary` | The primary brand seed, exact, in both modes | Owner and the core's session, 2026-11-05 | *Built* | A seed is not always a step of its ramp, so no role holds it. |
| `--kn-theme-base` | The page's background in light mode | Owner and the core's session, 2026-11-05 | *Built* | The one page colour a browser's frame and a home-screen icon can take. |

### Motion

Durations and easing exist in plates.md point 2, but their count, names and values are unspecified. These three global roles are a minimal proposed vocabulary for the header's colour transition and slide, and later component feedback. They do not add a motion input slider.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--duration-feedback` | Duration for short colour/opacity feedback | plates.md §2; header.md §3; proposed here | Proposed here | Names the interaction use rather than calling a value fast. |
| `--duration-movement` | Duration for movement such as the header slide | plates.md §2; header.md §4; proposed here | Proposed here | Separates movement from brief feedback without choosing milliseconds. |
| `--easing-standard` | Shared default easing curve | plates.md §2; proposed here | Proposed here | Starts with one coherent curve; extra curves need an actual use. |

Reduced motion follows header.md point 6: the slide and appearance switch happen without movement. These names do not prescribe numerical timings or change that rule.

### Widths and Reading Area vocabulary

Width values are usable by all content, including Breakouts. Proposed selector: `data-kn-width="<width>"`; the class alternative is `.kn-width-<width>`. These are framework layout selectors, not component classes.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `data-kn-width` | Attribute selecting one Layout Rail | page.md §2; proposed here | Proposed here | Uses one mutually exclusive value in the same form as a Surface kind. |
| `.kn-width-<width>` | Alternative width class form | page.md §2; proposed here | Proposed here | Supplies the corresponding class option without introducing new rail words. |
| `narrow` | Narrow reading measure | page.md §2; Reading Area §6 | Working name from spec; confirmed width | Reuses Blueprint's Layout Rail. |
| `wide` | The whole content area, bounded by Wide and the side margins | page.md §2; Reading Area §6 | Working name from spec; confirmed width | Aligns with the header and footer content. |
| `full` | Both viewport edges | page.md §2; Reading Area §6 | Working name from spec; confirmed width | Reuses Blueprint's edge-to-edge rail. |
| `bleed-start` | Viewport start edge to content-area end edge | page.md §2; Reading Area §6 | Working name from spec; explicitly proposed name | Names the edge it reaches beyond the content area, in logical direction. |
| `bleed-end` | Content-area start edge to viewport end edge | page.md §2; Reading Area §6 | Working name from spec; explicitly proposed name | Completes the logical pair and works in right-to-left. |
| `reading-area` | Reading Area: layout container, without a fill or vertical padding | page.md, Reading Area, Names and §1 | Working name from spec; decided term | Preserves the canonical container term. |
| `narrow` | Narrow: readable column inside a Reading Area | page.md, Reading Area, Names | Working name from spec; decided term | Keeps the part and its shared width in the same words. |
| `aside` | Aside: space beside Narrow | page.md, Reading Area, Names | Working name from spec; decided term | Distinguishes the space from content placed in it. |
| `aside-block` | Aside Block: supporting content belonging to the whole Reading Area | page.md, Reading Area, Names and §5 | Working name from spec; decided term | Preserves the distinction from an anchored Sidenote. |
| `sidenote` | Sidenote: content anchored in the flow | page.md, Reading Area, Names and §5 | Working name from spec; decided term | Uses the settled single word. |
| `breakout` | Breakout: flow element with intended width beyond Narrow | page.md, Reading Area, Names and §6 | Working name from spec; decided term | Names the decided layout relationship. |
| `flow` | The Reading Area's ordinary content stream | page.md, Reading Area §5 | Working name from spec | Keeps the spec's word for the default content. |
| `side` | Reading Area option: `start`, `end` (default), `none` (centred Narrow) | page.md, Reading Area §3 | Working name from spec; behaviour settled | Reuses the existing option and logical directions. |
| `stack` | Aside Block option: `before` or `after` the flow in one column | page.md, Reading Area §§5, 7 | Working name from spec; behaviour settled | Names reading order rather than CSS visual reordering. |

These part and option names reserve vocabulary, not component class names. Sticky Aside Blocks, Sidenote anchors and caption placement retain page.md's rules; their component markup and selectors are not drafted here.

## Design file

Top-level sections `format`, `inputs`, `project` and `resolved` are already decided (tool.md point 5). Dotted paths below describe nesting, not literal keys containing dots. Every new key is kebab-case. The file is a container for the design system, so keys need no CSS namespace. A flattened CSS name joins the same family and variant words; it need not reproduce JSON punctuation or repeat container keys.

### Sections and presentation identity

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `format` | Required whole number saying how to read the file, raised only when its shape breaks | Owner, 2026-11-05; konzilo.md | *Built* | Names what it versions: the file's format, apart from `project.version` and `resolved.generator-version`. |
| `inputs` | Tool-controlled choices; the only part a person changes, through the tool | tool.md §5 | Working name from spec; decided key | Retains the source contract. |
| `project` | Presentation identity | tool.md §5 | Working name from spec; decided key | Keeps presentation details apart from design choices. |
| `resolved` | All derived values read by consumers | tool.md §5 | Working name from spec; decided key | Retains the shared generated-output contract. |
| `project.name` | Presentation name | tool.md §5; proposed here | Proposed here | Uses the spec's simple identity word without naming any actual project. |
| `project.logo` | Presentation logo reference | tool.md §5; proposed here | Proposed here | Keeps the same identity term as the tool. |
| `project.logo-dark` | Optional logo for dark Surfaces | Tool implementation, 2026-11-02 | Built | Both logo fields accept data URIs or paths relative to the design file. |

The reusable repository stores no actual presentation identity or project-specific reference in this draft.

### Input keys

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `inputs.brand-colors` | Container for one to three ranked Brand Colour Seeds | tool.md §2; plates.md §1; proposed here | Proposed here | Uses the tool's colour terminology while making rank explicit below. |
| `inputs.brand-colors.primary` | Required primary seed | tool.md §2; proposed here | Proposed here | Retains the decided first rank. |
| `inputs.brand-colors.secondary` | Optional second seed | tool.md §2; proposed here | Proposed here | Retains the decided second rank; no empty placeholder needed. |
| `inputs.brand-colors.tertiary` | Optional third seed | tool.md §2; proposed here | Proposed here | Retains the decided third rank. |
| `inputs.gray-temperature` | Grey-scale temperature control; grey scale always exists | plates.md §1; Blueprint Q369; proposed here | Proposed here | Reuses the named input; does not restore a neutral/tinted preset switch. |
| `inputs.typefaces` | Typeface-role container | tool.md §2; proposed here | Proposed here | Keeps family selections separate from text-style recipes. |
| `inputs.typefaces.main` | Main family | tool.md §2 | *Decided* 2026-11-02 | Same role as `--typeface-main`. |
| `inputs.typefaces.monospace` | Monospace family | tool.md §2 | *Decided* 2026-11-02 | Same role as `--typeface-monospace`. |
| `inputs.typefaces.heading` | Optional heading family | tool.md §2 | *Decided* 2026-11-02 | Same role as `--typeface-heading`. |
| `inputs.typefaces.heading-1` | Optional first-heading family, following heading unless set | Tool implementation, 2026-11-02 | Built | Same role as `--typeface-heading-1`, including typeface tuning. |
| `inputs.typefaces.display` | Optional display family | tool.md §2 | *Decided* 2026-11-02 | Same role as `--typeface-display`. |
| `inputs.type` | Body-size and scale container | tool.md §2; proposed here | Proposed here | Shares the global type family. |
| `inputs.type.label` | Which family labels use: `main` or `monospace` | tool.md §2 | *Decided* 2026-11-02 | One choice of two recipes, not a set of controls. |
| `inputs.type.heading-1-color` | First-heading colour: `text` (default) or `accent` | Tool implementation, 2026-11-02 | Built | Reads the chosen role on each Surface. |
| `inputs.type.body-size` | Fluid body-size endpoints | tool.md §§2–3; proposed here | Proposed here | Matches the body style's size rather than introducing base-font aliases. |
| `inputs.type.body-size.min` | Body size at the narrowest window, in default-setting pixels | tool.md §§2–3; proposed here | Proposed here | Uses the same endpoint word as resolved fluid values. |
| `inputs.type.body-size.max` | Body size at the widest window, in default-setting pixels | tool.md §§2–3; proposed here | Proposed here | Completes the endpoint pair without units in the key. |
| `inputs.type.ratio` | Fluid type-scale ratio endpoints | tool.md §2; proposed here | Proposed here | Names the decided ratio directly. |
| `inputs.type.ratio.min` | Ratio at the narrowest window | tool.md §2; proposed here | Proposed here | Uses the same endpoint convention as body size. |
| `inputs.type.ratio.max` | Ratio at the widest window | tool.md §2; proposed here | Proposed here | Completes the pair for one scale, not two scale presets. |
| `inputs.header` | The header's settings: arrangement, attachment, items, identity, large menu and search box | header.md | *Built* 2026-11-03 | Named for the component they go to. |
| `inputs.header.identity` | What the brand is, in the header and the footer: `logo` (default), `name` or `both` | header.md, point 13 | *Decided* 2026-11-05 | The value's three words are what shows. |
| `inputs.header.brand-axis` | How logo and name stand: `row` (default) or `column` | header.md, point 13 | *Decided* 2026-11-05 | Keeps the axis words of flex layout, as the attribute does. |
| `inputs.header.slogan-place` | Where the slogan stands: `beside` (default) or `below` | header.md, point 13 | *Decided* 2026-11-05, replacing `brand-align`, `identity-axis` and `identity-align` | `place` is the word `inputs.hero.place` already uses for where something stands; the owner's own words for the two values. |
| `inputs.header.translucent` | Whether the bar, where it is not clear, and its megamenu and language list let a hint of the page show through, blurred: `true` or `false` (default) | header.md, A hint of the page | *Decided* 2026-11-12 | An adjective for what the bar is, beside `autohide`; written as `data-kn-translucent`. |
| `inputs.footer` | The footer's settings: attachment, how empty cells fill, its two bands and its lines | footer.md | *Built* 2026-11-05, replacing the models of 2026-11-03 | Named for the component they go to. |
| `inputs.footer.attachment` | `flow` (default) or `reveal` | footer.md, Attachment | *Decided* 2026-10-31 | The spec's own two words; since 2026-11-11 the tool says "The footer is fixed to" "The end of the page" or "The bottom of the window", replacing "At the end of the page" and "At the edge of the screen" (footer.md, Attachment). |
| `inputs.footer.fill` | How a cell fills where it could go either way: `column` (default) or `row` | footer.md | *Decided* 2026-11-05 | Names what the cell does, along the axis it does it. |
| `inputs.footer.upper`, `inputs.footer.lower` | The two bands, each with `surface` and `cells` | footer.md | *Decided* 2026-11-05 | The owner's own words for them. |
| `inputs.footer.upper.surface`, `inputs.footer.lower.surface` | The band's Surface: `page`, `raised`, `tint`, `brand` (the upper's default) or `inverse` (the lower's default) | footer.md | *Decided* 2026-11-05 | Keeps the Surface word and its kinds. |
| `inputs.footer.upper.cells`, `inputs.footer.lower.cells` | The cells `a1`, `b1`, `a2` and `b2`, each on or off, all on by default | footer.md | *Decided* 2026-11-05 | The owner's spreadsheet notation, in lower case as keys are. |
| `inputs.footer.horizontal-rules`, `inputs.footer.vertical-rule`, `inputs.footer.rule-extent` | Lines between rows and between columns, and where they end: `content` (default) or `full` | footer.md | *Built* 2026-11-03 | Unchanged by the decision of 2026-11-05. |
| `inputs.page` | The page's shadow on the footer, its edge line and its fill in each mode | page.md | *Built* 2026-11-03 | Named for the component they go to. The tool sets the shadow and the edge line on its Footer page, beside the attachment, since 2026-11-11. |
| `inputs.breadcrumbs` | Whether a trail shows, its mark, first step, end, and form on a phone | components.md | *Built* 2026-11-03 | Named for the component they go to. |
| `inputs.breadcrumbs.narrow` | The trail on a phone: `trail` (whole, wrapping; default), `parent` (only the way up one level) or `fit` (as much as fits, from the end, on one line), written as `data-kn-narrow` | components.md, How breadcrumbs show | *Built* 2026-11-03; `fit` 2026-11-11 | Each value names what shows; `fit` says as much as fits, as the owner put it. |
| `inputs.hero` | The design's default Hero; a page may depart from it | components.md, Band compositions | *Built* 2026-11-05 | Named for the component it goes to. |
| `inputs.hero.picture` | Where the picture stands: `none`, `behind` (default), `start`, `end`, `start-bleed` or `end-bleed` | components.md, Band compositions | *Decided* 2026-11-05 | The values are logical, so right-to-left works; the tool says Left and Right. |
| `inputs.hero.surface` | The Surface without a picture behind: `none` (default), `page`, `raised`, `tint`, `brand` or `inverse` | components.md, Band compositions | *Decided* 2026-11-05 | Reuses the Surface kinds; `none` lets what lies beneath show. |
| `inputs.hero.overlay` | The scrim over a picture behind: `dark` (default) or `light` | components.md, Band compositions | *Decided* 2026-11-05 | Selects `picture-dark` or `picture-light`. |
| `inputs.hero.height` | Share of the screen: `third`, `half`, `two-thirds` (default) or `full` | components.md, Band compositions | *Decided* 2026-11-05 | Written as `data-kn-height`. |
| `inputs.hero.place` | The text up and down: `top`, `center` or `bottom` (default) | components.md, Band compositions | *Decided* 2026-11-05 | Written as `data-kn-place`. |
| `inputs.hero.align` | The text block across: `start` (default), `center` or `end` | components.md, Band compositions | *Decided* 2026-11-05 | Written as `data-kn-align`. |
| `inputs.hero.type` | The look of the hero's heading: `heading-1` (default) or `display` | components.md, Band compositions | *Decided* 2026-11-05 | Reuses the text styles' words. |
| `inputs.hero.h1` | Where the page's H1 is: `hero` (default) or `below` | components.md, The H1, the trail and the hero's heading | *Decided* 2026-11-05 | Names the element, not a look: `heading-1` is the text style, which `type` chooses, while `h1` is the `<h1>` itself, so the two keys cannot be read as one. `below` is `inputs.header.slogan-place`'s word for under. |
| `inputs.layout.wide`, `inputs.layout.narrow` | Wide and Narrow, in default-setting pixels | page.md | *Built* 2026-11-03 | The resolved `layout` keys they set. |
| `inputs.type.breakpoints` | Where the ratio and body size endpoints apply | tool.md §2 | *Decided* 2026-11-03 | The owner's word for the two arrows on the number line. |
| `inputs.type.breakpoints.min` | The left breakpoint, in default-setting pixels | tool.md §2 | *Decided* 2026-11-03 | Uses the same endpoint convention as ratio and body size. |
| `inputs.type.breakpoints.max` | The right breakpoint, at or above the left | tool.md §2 | *Decided* 2026-11-03 | Completes the pair. |
| `inputs.type.steps` | Step counts between adjacent visual styles | tool.md §2; proposed here | Proposed here | Keeps progression choices distinct from the ratio. |
| `inputs.type.steps.heading-6` | Number of steps above body | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.heading-5` | Number of steps above heading-6 | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.heading-4` | Number of steps above heading-5 | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.heading-3` | Number of steps above heading-4 | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.heading-2` | Number of steps above heading-3 | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.heading-1` | Number of steps above heading-2 | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.display` | Number of steps above heading-1 | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.lead` | Number of steps above body | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.small` | Number of steps below body | tool.md §2; proposed here | Proposed here | Uses the same visual-style word as the CSS role. |
| `inputs.type.steps.label` | Number of steps below body | components.md, Typefaces and labels | *Decided* 2026-11-02 | Keeps labels on the type scale. |
| `inputs.shadow` | Continuous shadow-control container | tool.md §2; proposed here | Proposed here | Names the CSS shadow family, whose controls implement the Elevation Profile. |
| `inputs.shadow.strength` | Opacity control; zero off | tool.md §2; proposed here | Proposed here | Retains the decided slider word. |
| `inputs.shadow.elevation` | Distance, blur and spread multiplier | tool.md §2; proposed here | Proposed here | Retains the decided slider word. |
| `inputs.shadow.angle` | Light-angle control | tool.md §2; proposed here | Proposed here | Retains the decided slider word without encoding degrees. |
| `inputs.shadow.hardness` | Diffuse-to-solid control | tool.md §2; proposed here | Proposed here | Retains the decided slider word. |
| `inputs.shadow.color` | Default text-colour policy or explicit brand/grey/black choice | tool.md §2; proposed here | Proposed here | Matches the frame's colour word and keeps the default policy available. |
| `inputs.shadow.targets` | Where shadows fall, each on or off: `box`, `header`, `panel`, `page` | tool.md §2; proposed here | Proposed here | The decided per-target choice, in the words of the shadow family; later raised components join `box`. |
| `inputs.frame` | Independent solid-frame control container | tool.md §2; proposed here | Proposed here | Keeps the frame independent of shadow strength. |
| `inputs.frame.width` | Thickness, 0–3 in the tool's default-setting pixel notation | tool.md §§2–3; proposed here | Proposed here | Same width word as the generated frame role. |
| `inputs.frame.color` | Explicit colour or default following the shadow colour | tool.md §2; proposed here | Proposed here | Same colour word as the generated frame role. |
| `inputs.corner-profile` | One continuous square-to-rounded slider | tool.md §2; plates.md §1; proposed here | Proposed here | Uses Blueprint's Corner Profile, not a set of radius presets. |
| `inputs.density-profile` | One continuous compact-to-loose slider | tool.md §2; plates.md §1; proposed here | Proposed here | Uses Blueprint's Density Profile, not discrete compact/airy keys. |

Grey temperature is carried from plates.md and Q369 although tool.md point 2 abbreviates it to an always-present grey scale. The four shadow targets are decided inputs (tool.md point 2); components defined later may join them. Which components take the frame waits for the component definitions. The default fluid window endpoints (20rem and 90rem) are the generation bounds from tool.md point 3, not additional owner-approved sliders. No motion, layout or independent type-recipe controls are silently added to `inputs`.

### Resolved keys

These proposed containers account for all derived families in tool.md point 5 and plates.md point 2, including the controls added in tool.md point 2. Containers do not expose raw tokens for component consumption. Ramps remain in the design file rather than acquiring public CSS shade names in this proposal; the emitted roles contain literal colours.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `resolved.ramps` | Generated colour-ramp container | tool.md §5; plates.md §2; proposed here | Proposed here | Keeps raw values separate from semantic roles. |
| `resolved.ramps.primary` | Primary seed ramp | tool.md §§2, 5; proposed here | Proposed here | Reuses the input's primary rank. |
| `resolved.ramps.secondary` | Second seed ramp, when supplied | tool.md §§2, 5; proposed here | Proposed here | Reuses the input's secondary rank. |
| `resolved.ramps.tertiary` | Third seed ramp, when supplied | tool.md §§2, 5; proposed here | Proposed here | Reuses the input's tertiary rank. |
| `resolved.ramps.gray` | Always-present grey ramp | tool.md §§2, 5; proposed here | Proposed here | Reuses grey rather than introducing neutral as an alias. |
| `100` through `900`, in increments of `100` | String keys for each ramp's nine steps | plates.md §2 | Working name from spec | Retains the stated ramp indexing; numbers are shade indices, not units or roles. |
| `resolved.surfaces` | Base, status and available rank-tint Surface-kind entries | tool.md §5; plates.md §4; proposed here | Proposed here | Uses Surface, the canonical English word. |
| `page`, `raised`, `tint`, `brand`, `inverse`, `accent`, `picture-light`, `picture-dark` | Keys under `resolved.surfaces`, one per kind | plates.md §4 | Working names from spec; decided kinds | Exactly the same kind values as the CSS selectors. |
| `light`, `dark` | Mode keys under each kind | tool.md §5; plates.md §4 | Working names from spec; modes decided | Keeps mode selection separate from actual polarity. |
| `background`, `background-alt`, `background-hover`, `text`, `text-muted`, `border`, `border-strong`, `link`, `accent`, `focus`, `info`, `success`, `warning`, `error`, `button-background`, `button-text`, `button-background-hover` | Context-role keys under each mode | plates.md §3; components, 2026-11-02 | Working names from spec; alternate fill decided with the components | Exact CSS role stems, with only `--` and the namespace omitted. |
| `polarity` | Generated marker under each mode |
| `translucent` | Under each mode of every Surface but a picture's: the least opacity, from 0.85, at which every role a translucent layer draws on its background holds over any page (2026-11-12) | header.md, A hint of the page | The assistant's technical choice | Optional, so a file resolved before it still reads; the CSS then works it out from the roles. `TRANSLUCENT_LEAST` and `TRANSLUCENT_ROLES` name its floor and the roles it holds, and `translucentOpacity` finds it. | plates.md §§3–4; proposed here | Proposed here | Exact word used by the CSS marker. |
| `resolved.type` | Text-style recipes keyed by display, heading-1 through heading-6, lead, body, small, label, mono | tool.md §5; plates.md §3; proposed here | Proposed here | Exact style words used by CSS. |
| `size`, `line-height`, `weight`, `letter-spacing` | Properties in each type recipe | tool.md §§2–3; proposed here | Proposed here | Same words as the corresponding global roles. |
| `resolved.typefaces` | Resolved main, monospace, heading, display and label stacks, with optional heading-1; each ends in a generic family | tool.md §2 | *Built* 2026-11-02 | Keeps the typeface role words unchanged. |
| `resolved.heading-1-color` | Optional explicit first-heading colour policy, `text` or `accent` | Tool implementation, 2026-11-02 | Built | Omitted when the input is absent, preserving prior output bytes. |
| `resolved.space.steps` | Fluid steps keyed 1 through 8 | tool.md §5; plates.md §2; proposed here | Proposed here | Same step vocabulary as the internal CSS scale. |
| `resolved.space.roles` | component-gap, column-gap, band, band-run and plate | plates.md §3; proposed here | Proposed here | Same variant words as the semantic CSS space roles. |
| `min`, `max` | Endpoint keys in fluid size and space values | tool.md §5 | Working names from spec | Retains the spec's endpoint words; storage units follow the schema, not the key. |
| `resolved.radius` | control and card radius values | tool.md §5; plates.md §3; proposed here | Proposed here | Exact family and use words from CSS. |
| `resolved.shadow` | Finished CSS values keyed header, header-panel, panel, page, box and box-lifted | tool.md §§2, 5; proposed here | Proposed here | Exact shadow variants used in CSS; each value includes near and far shadows. |
| `resolved.frame` | width and colour | tool.md §2; proposed here | Proposed here | Same independent frame family and properties as CSS. |
| `resolved.theme` | primary, the primary brand seed exact, and base, the light page colour | Owner and the core's session, 2026-11-05 | *Built* | The literals behind `--kn-theme-primary` and `--kn-theme-base`. |
| `resolved.layout` | wide, side-margin, narrow, aside-min and content-area | plates.md §§2–3; page.md §2; proposed here | Proposed here | Same layout role words, including the computed relation. |
| `resolved.duration` | feedback and movement times | plates.md §2; proposed here | Proposed here | Same duration family and uses as CSS. |
| `resolved.easing` | standard curve | plates.md §2; proposed here | Proposed here | Same easing family and variant as CSS. |
| `resolved.generator-version` | Generator version | tool.md §5; proposed here | Proposed here | Names the version's subject explicitly. |
| `resolved.inputs-fingerprint` | Fingerprint of inputs; consumers refuse a mismatch | tool.md §5; proposed here | Proposed here | Names exactly what was fingerprinted. |
| `resolved.contrast-check` | Contrast-check result | tool.md §5; plates.md §6; proposed here | Proposed here | Names the validation, without presuming a report schema. |

No export configuration or component catalogue is invented here, and the format version is `format` (Sections and presentation identity). This is a name inventory, not a JSON schema: colour-choice encoding, font-asset records, numeric ranges, report details and serialization of fluid relations still need implementation definitions. The words above do not authorize further input controls.

## Naming decisions (2026-11-01)

Each entry keeps its problem, options and reason as the record. Decisions 1 and 2 are the owner's. The rest he left to the assistant, which took each recommendation, with two adjustments: identifiers follow CSS's spelling (`color`, `gray`), and there are eight space steps, `--kn-space-1` to `--kn-space-8`, in place of six `--space-step-*`. Already decided Surface kinds, Reading Area terminology, mode behaviour, continuous controls and the design-file source contract stood throughout.

1. **Prefix coverage.** Problem: bare custom properties such as `--text` and `--accent`, classes and data attributes can collide when exported into WordPress themes and other people's sites, although Konzilo sites are controlled. **Options:** bare names everywhere; prefixes only in third-party exports; one prefix on every design-system-owned custom property, class and data attribute in every output. ***Decided* by the owner:** prefix every such CSS/HTML identifier in every output, because one contract protects exports and keeps consumers interchangeable. Standard CSS properties, native HTML/ARIA names, attribute values and keys inside the design file retain their ordinary names.
2. **Prefix spelling.** Problem: the namespace must remain recognisable outside Konzilo and unlikely to overlap another framework. **Options:** `konzilo-`; `kd-`; `kds-`; `kn-`. ***Decided* by the owner:** `kn-` (`--kn-text`, `data-kn-surface`, `data-kn-width`), which reads as both KoNzilo and KNtnt. A short prefix keeps the role legible in every line of component CSS, and it does not tie exported code to a product name that may change on the way to Blueprint.
3. **Surface selector form.** Problem: a Surface must select exactly one complete context while the specs permit either a class or attribute. **Options:** `.kn-surface-raised`; `data-kn-surface="raised"`; publish both. **Recommendation:** the data attribute alone as the documented API, because one value makes the context explicit and avoids competing Surface classes; its kind value matches the design file. Both candidate forms are recorded above for the decision.
4. **Mode selector form.** Problem: a requested local mode must remain distinct from generated polarity. **Options:** `data-kn-mode="light|dark"`; mode classes; a `data-kn-colour-mode` attribute. **Recommendation:** `data-kn-mode` with light or dark, because it is short, parallels the Surface selector and leaves `polarity` exclusively for output. Local mode itself is already decided.
5. **Polarity marker name.** Problem: the spec requires the marker but gives it no CSS spelling. **Options:** `--polarity`; `--surface-polarity`; `--colour-scheme`. **Recommendation:** `--polarity` under the chosen namespace, because that is the spec's term and it cannot be mistaken for the native `color-scheme` property or the requested mode.
6. **Context role spellings.** Problem: the eleven decided roles still have working names. **Options:** retain background/text/text-muted/border/border-strong/link/accent/focus/success/warning/error; use background/foreground families; rename focus to focus-ring. **Recommendation:** retain the eleven stems as a set, because they already express each use and preserve the Surface contract without a second vocabulary; focus remains a colour role, with ring geometry belonging elsewhere.
7. **One-sided width names.** Problem: the geometry is confirmed but `bleed-start` and `bleed-end` are explicitly proposed names. **Options:** those names; `full-start`/`full-end`; `wide-to-start`/`wide-to-end`. **Recommendation:** `bleed-start`/`bleed-end`, because bleed names extension beyond the content area and start/end name the viewport edge reached, including in right-to-left. The opposite edge stays at the content-area boundary.
8. **Width selector form.** Problem: all content needs the same mutually exclusive rail selection before component classes are defined. **Options:** `data-kn-width="wide"`; `.kn-width-wide`; a `data-kn-rail` attribute. **Recommendation:** the width attribute, because it reuses the spec's word width and follows the proposed Surface selection pattern.
9. **Heading-style names.** Problem: h1–h6 in the tool describe appearances, while HTML heading levels express independent document structure. **Options:** h1–h6 style keys; heading-1 through heading-6; ordinal size names such as heading-largest through heading-smallest. **Recommendation:** heading-1 through heading-6 in JSON and `--type-heading-1-size` through `--type-heading-6-size` in CSS, because the heading family is explicit and the keys do not look like HTML selectors. Documentation must still state that style 1 can be applied to any semantic level; the progression remains the decided h6-from-body through display chain.
10. **Type-role grammar.** Problem: the styles need a complete, consistent set of CSS properties without fixing unchosen typeface values. **Options:** `--type-body-size` and corresponding line-height/weight/letter-spacing roles; property-first families such as `--font-size-body`; one CSS shorthand per style. **Recommendation:** the type/style/property grammar listed above, because the entire style stays together, individual properties remain usable, and JSON can carry the identical words. Line-height, weight and tracking come from the typeface recipe, not new sliders.
11. **Typeface vocabulary.** Problem: the tool calls its optional face monospace but the text style mono. **Options:** monospace for both; mono for both; monospace for the Typeface and mono for the text style. **Recommendation:** retain the distinction, because Monospace Typeface is Blueprint's canonical term and mono is the spec's global style; Display Typeface similarly serves both display and heading styles.
12. **Space-step names and count.** Problem: fluid steps are decided but no enumeration exists. **Options:** step-1 through step-6; an extensible numbered scale with a count left to implementation; size adjectives such as xs through xl. **Recommendation, adjusted:** eight numbered steps, `--kn-space-1` to `--kn-space-8`, because ordered indices survive density changes and provide a finite draft for the four semantic uses. This is a new proposed count, not a recovered decision; numerical values and mappings still require design validation.
13. **Space-role names.** Problem: the four decided uses have no CSS spellings. **Options:** component-gap/column-gap/band/band-run under space; generic gap/section/run; property-first gap and padding families. **Recommendation:** `--space-component-gap`, `--space-column-gap`, `--space-band`, `--space-band-run`, because they identify each use and Band includes the footer as well as editable Sections.
14. **Radius-role names.** Problem: one corner slider must feed distinct control and card geometry. **Options:** `--radius-control`/`--radius-card`; `--shape-control-radius`/`--shape-card-radius`; generic small/large radii. **Recommendation:** the radius family with control/card variants, because it names the CSS value and each decided use without introducing presets.
15. **Shadow names.** Problem: the later tool decision supplies six tuned elevations while the earlier page model describes a common layer shadow. **Options:** the six owner/use names listed above; relational names such as header-over-page and page-over-footer; numbered elevations plus semantic aliases. **Recommendation:** `--shadow-header`, `--shadow-header-panel`, `--shadow-panel`, `--shadow-page`, `--shadow-box`, `--shadow-box-lifted`, because they expose all six tuned shapes, preserve the upper layer's ownership and give the box variant a stable family. Keep shared controls and a shared layer character; do not collapse the tuned shapes or add duplicate numbered public roles.
16. **Frame names.** Problem: the independent frame needs a thickness and colour name without absorbing ordinary borders. **Options:** frame-width/frame-colour; frame-thickness/frame-colour; outline-width/outline-colour. **Recommendation:** `--frame-width` and `--frame-color`, mirrored under `inputs.frame` and `resolved.frame`, because frame is the owner's word and width matches the CSS property it supplies. Always-solid style and inherited corner geometry need no extra names.
17. **Layout names.** Problem: Wide's maximum, actual content width and Narrow's reading measure must stay distinguishable. **Options:** the layout-wide/side-margin/narrow/aside-min/content-area family; container-max/gutter/measure/sidebar-min/container; omit the computed content-area role. **Recommendation:** the five layout roles listed above, because they reuse the canonical vocabulary and make maximum versus available width explicit; Narrow remains owned by the Reading Area.
18. **Motion names.** Problem: duration and easing families are specified without names or a count. **Options:** feedback/movement durations and standard easing; fast/slow durations; component-named times and separate entry/exit curves. **Recommendation:** `--duration-feedback`, `--duration-movement` and `--easing-standard`, because they give the existing short transition and slide distinct uses with one common curve. Values remain to be designed; extra curves should follow an actual need.
19. **Input nesting and endpoint words.** Problem: tool.md fixes controls and top-level sections but leaves input keys and fluid endpoint labels unwritten. **Options:** the grouped, kebab-case paths above with min/max; a flat input object; narrow-window/wide-window labels on each endpoint. **Recommendation:** grouped paths with min/max, because they keep related controls together and reuse the resolved step vocabulary. Define min/max as the narrowest/widest-window endpoints, not independent extrema, and retain the spec's pixel notation in inputs with rem generation for CSS.
20. **Continuous profile keys.** Problem: density and corners have canonical Profile names while the four shadow controls form an Elevation Profile. **Options:** density-profile/corner-profile plus a shadow container; density/corners/shadow; density-profile/corner-profile/elevation-profile. **Recommendation:** `density-profile`, `corner-profile` and the `shadow` container, because the first two preserve Blueprint's exact terms while shadow directly matches its four controls and the emitted shadow family. Document that shadow implements the Elevation Profile, not stacking order.
21. **Resolved-family and metadata keys.** Problem: consumers need stable names for every derived family and the three required provenance/check items. **Options:** the grouped resolved paths above; flat resolved keys; shorter metadata such as version/hash/validation. **Recommendation:** the plain families above plus generator-version/inputs-fingerprint/contrast-check, because the CSS and JSON share their role words and the metadata names state exactly what consumers must verify. The plain format and three top-level sections are already decided; report internals remain implementation work.
22. **Raw values in exported CSS.** Problem: components must use roles, yet fluid space steps are useful when constructing those roles. **Options:** export every ramp and step; keep every raw value only in resolved; emit internal namespaced space steps while keeping ramps and internal type indexing in resolved. **Recommendation:** the last option as drafted, because CSS can retain explicit space relations without inviting raw-colour consumption. Internal steps are not a component API; literal context colours and named global roles remain the public contract.

## Component names (2026-11-01)

***Decided* with the first six components; the assistant's technical choices, 2026-11-01.**

- **Classes:** `.kn-<component>` and `.kn-<component>-<part>`, all in kebab-case; for example `.kn-heading-group` and `.kn-card-heading`. A class names a component or part, not one of several competing appearances.
- **Variants:** `data-kn-variant` holds mutually exclusive choices: `filled`, `outline`, `arrow` on Button; `link`, `person` on Card (the former article variant is now Content Card). Link Group uses `data-kn-direction="row|stack"`; Card Grid uses `data-kn-columns="2|3|4"`.
- **Type:** `data-kn-type="display|heading-1|heading-2|heading-3|heading-4|heading-5|heading-6|lead|body|small|label|mono"` applies the complete type recipe, independently of the semantic heading level. Display uses the display role, heading-1 its own, the other headings the heading role, mono the monospace family, label the family the design chose for labels, and everything else the main family.
- **Button roles:** `--kn-button-background`, `--kn-button-text`, `--kn-button-background-hover` are context roles, supplied on every Surface in both modes. Names follow family, part, state; recipes and pairs are in generator.md.
- **Plate space:** `--kn-space-plate` is the inner space of a coloured box. It mapped to step 6 alongside the distinct column-gap use, and maps to step 4 since the owner found the padding round a card's text too large (2026-11-12). Components read neither numbered steps nor colour ramps.

The class grammar and selectors are shared by Astro and the plain HTML export.

## Content and navigation names (2026-11-02)

***Decided* with Table, Accordion, Quotation, Callout, Breadcrumb Navigation and Table of Contents; the assistant's technical choices, 2026-11-02.**

- **Classes:** `.kn-table` on the table and `.kn-table-scroll` on its named scroll region; `.kn-accordion` with `.kn-accordion-item`, `summary`, `label`, `chevron` and `content` parts; `.kn-quotation` with `text`, `attribution` and `name` parts; `.kn-callout` with `heading`, `title`, `icon` and `content` parts; `.kn-breadcrumbs` with a `separator` part; `.kn-toc` with a `label` part. Each part uses the ordinary component-part grammar, for example `.kn-accordion-summary`.
- **Choices:** Table uses `data-kn-striped`, cell `data-kn-align="start|center|end"` and `data-kn-numeric`; its wrapper takes `data-kn-width`. Accordion uses `data-kn-accordion-mode="single|multiple"`; native `details` carries the generated `name` and `open`, leaving `data-kn-mode` exclusively for colour mode. Callout uses `data-kn-variant="info|success|warning|error"`. A `surface` prop uses the existing `data-kn-surface` contract.
- **Alternate fill:** `--kn-background-alt`, stored as `background-alt` under every Surface mode's roles and recipes. The contrast-pair names `text-alt`, `text-muted-alt` and `link-alt` describe the existing foregrounds over that fill, all at 4.5:1; they add no foreground role. Their fixed recipes and the tested brand correction are in generator.md.
- **Local relation:** `--kn-callout-mark` reads accent on filled status Surfaces, or info/success/warning/error for an outlined Callout. It is a component-local relation, not another generator input or Surface role.


## Header and Footer names (2026-11-01)

**The assistant’s technical choices, 2026-11-01.** The class grammar above also covers Header’s named parts, `.kn-megamenu`, `.kn-skip-link`, `.kn-footer`, `.kn-footer-band`, `.kn-footer-cell` and, since 2026-11-05, `.kn-footer-box`, `.kn-footer-social` and `.kn-footer-logo`, and since the same day `.kn-brand`, `.kn-brand-logo` and `.kn-brand-name`, the brand the header and a footer share, in place of the header's own names for them. These consume the existing context, type, space, radius, duration and shadow roles. No new generated token or colour role is introduced.

| Custom property | What it is |
|---|---|
| `--kn-header-height` | The bar's height, worked out in CSS from the identity's settings, not measured (2026-11-10): each header's own, and on the root the page header's, for what lies outside it. Registered as a length, so it is read in pixels. |
| `--kn-header-visible-height` | The sticky height shown: the header's height, zero in flow and while it has slid away. The Reading Area and a Section's head follow it. |
| `--kn-header-identity-scale` | Unitless last-resort scale of the identity, 1 or, where even the identity and the menu button do not fit, 0.8, after which the identity may shrink, its name wrapping to two lines (2026-11-10; the wrapping the owner's, 2026-11-11); independent of scrolling. A brand elsewhere has no scale, and reads it as 1. |
| `--kn-header-menu-columns` | Number of level-1 columns, capped at six before responsive steps to two and one. |
| `--kn-header-scrolled`, `--kn-header-past`, `--kn-header-beyond` | The scroll flags, 0 or 1, on the root where a page has a sticky header: content under the header, past T and past the header's own height. Set by scroll-driven animations, or by `scroll-timeline-polyfill.js` where the browser has none (2026-11-10). |
| `--kn-header-scrolled-at`, `--kn-header-past-at`, `--kn-header-beyond-at` | Where each flag turns: 0.0625rem, 1.5rem (T) and the header's height. Registered lengths, which the polyfill reads in pixels. |
| `--kn-header-clear` | 1 on a Page whose header is clear, transparent with the first band's Surface roles; the generated core reads it (2026-11-10). |
| `--kn-header-under`, `--kn-header-same` | On the header: content lies under it, and the first band has its colour; with no shadow, either draws its hairline. |
| `--kn-header-gone-slogan` … `--kn-header-gone-search` | On the header, 1 where its giving-way step is taken, by `data-kn-step`, or with no step written. |
| `--kn-header-logo`, `--kn-header-name`, `--kn-header-slogan`, `--kn-header-slogan-gap`, `--kn-header-brand`, `--kn-header-identity`, `--kn-header-cap` | Local terms of the bar's height: each part's box, a line of words counting as `--kn-header-cap`, 0.66, of its size. |
| `--kn-footer-same` | 1 on a Page whose last child's Surface is the footer's first band's; the Page then shows its edge (2026-11-10). |
| `--kn-footer-edge-start`, `--kn-footer-edge-end`, `--kn-footer-row-gap` | Local space at a band's edges and between its rows: as any Band, thin in the lower band, closed up where two bands share a colour. |
| `--kn-footer-inner`, `--kn-footer-side` | Local grid relations for the shared content rail and its margins. |
| `--kn-footer-separator` | Local width of the footer link list’s bullet strip, in em. |
| `--kn-reading-sticky-inset` | Existing Reading Area inset, now the visible sticky header height plus component gap. |
| `--kn-hero-screen`, `--kn-hero-height` | What a Hero's height is a share of, and the share chosen by `data-kn-height`. |
| `--kn-scrim` | A picture Surface's scrim as one colour at its checked opacity, for a layer that masks say where to show. |
| `--kn-scrim-fade`, `--kn-scrim-fade-length` | That layer's mask where text stands on part of the picture, from clear to whole over the length. |
| `--kn-scrim-header` | That layer's mask behind a transparent header, whole over the header's height and then clearing. |
| `--kn-scrim-fade-direction` | Which way that mask runs: `to bottom` (default) with the text at the bottom, `to top` with the text at the top. |

| Attribute | What it is |
|---|---|
| `data-kn-arrangement="A|B|C"` | Fixed Header groups and document order. |
| `data-kn-attachment="flow|sticky"` | Header attachment. |
| `data-kn-start="below|under"`, `data-kn-autohide="true|false"` | Header start and sliding away; a flow header writes `below` and `false`. |
| `data-kn-translucent="true|false"` | Whether the header shows a hint of the page through its bar and panels (2026-11-12). |
| `data-kn-group="start|end"` | The Header group, in document order. |
| `data-kn-axis="row|column"` on `.kn-brand` | How logo and name stand, in the header and in a footer. |
| `data-kn-slogan-place="beside|below"` | Where the slogan stands, on `.kn-header-identity`. |
| `data-kn-align="center|end"` | On a Hero, where its text block stands across the content width; `start`, the default, writes no attribute. |
| `data-kn-picture="start|end|start-bleed|end-bleed"` | A Hero's picture beside its text: on that side inside the content width, or out to the window's edge and the hero's top and bottom. Absent with no such picture. |
| `data-kn-place="top|bottom"` | Where a Hero's text stands up and down; `center`, the default, writes no attribute. |
| `data-kn-height="third|half|two-thirds|full"` | A Hero's minimum share of the screen; tall text grows past it. |
| `data-kn-steps` on `.kn-header` | The giving-way steps this header can take, in order, space-separated, for `header-fit.js` (2026-11-11). |
| `data-kn-step` on `.kn-header` | The step `header-fit.js` chose: `none`, the last step taken, or `scale`, the last resort. Absent without script, where the bar shows its narrowest step. |
| `data-kn-header-fit`, `data-kn-footer-fit` | On the inline `header-fit.js` in each header and the element that loads `footer-fit.js`, for an offline build to find them. |
| `data-kn-fit="true|false"` on a revealed `.kn-footer` | Whether it fits in the window, from `footer-fit.js`; the reveal applies only at `true` (2026-11-11). |
| `data-kn-logo="light|dark"` | Image version; the header shows the one for its resolved `--kn-polarity`, by a style query. |
| `data-kn-trigger`, `data-kn-panel` | Matching `menu`, `language` or `search` control and panel names, on the visible row's controls only. The browser keeps whether a panel is open. |
| `data-kn-automatic`, `data-kn-icon` | Automatic menu-button visibility and its `chevron-down`, `menu` or `none` icon choice. |
| `data-kn-moved="search|language|cta"` | Functional items at the megamenu’s top. |
| `data-kn-close` | The search box's close control, where the design has one. |
| `data-kn-placeholder="none|word|icon"` on `.kn-search-field` | What a header's empty search field shows: nothing, the site's word, or a magnifier that goes as the visitor types (2026-11-11). `.kn-search-field` wraps the field and that magnifier, on the page Surface without painting it. |
| `data-kn-polyfill="scroll-timeline|scroll-state"` | On a header's inline loader: which polyfill it loads where the browser lacks the feature. An offline build puts the polyfill itself in its place. |
| `data-kn-scrolled="block-end|block-start"` | On the root, where the browser has no scroll-state queries: the direction of the last relative scroll, which `scroll-state-polyfill.js` writes and the parallel rules read. |
| `data-kn-attachment="flow|reveal"` | Footer attachment. |
| `data-kn-rules="content|full"` | Footer hairline extent. |
| `data-kn-band="upper|lower"`, `data-kn-rows="1|2"`, `data-kn-joined` | Which Footer band, how many rows it has, and that the two bands share a colour and close up. |
| `data-kn-cell="a1|b1|a2|b2"`, `data-kn-column="A|B"`, `data-kn-columns="1|2"`, `data-kn-row="1|2|all"` | Cell address, the column that places its box, and what it covers. A vertical hairline uses `data-kn-row` too. |
| `data-kn-only="a|b|both"`, `data-kn-join` | A hairline between a band's rows, over the columns no merged cell covers, or between two bands on one colour. |
| `data-kn-logo="light|dark"` on `.kn-footer-logo` | Which mode a footer logo is for, on a band whose colour follows the mode. |
| `data-kn-shadow="true"`, `data-kn-edge-line="true"` | The Page's chosen shadow and bottom-edge hairline, on its main. |

`.kn-header-row` holds the bar's groups and its panels; `.kn-header-search-dismiss` is the transparent close button behind the search box. ***Removed* 2026-11-11, by the owner's choice of a script over duplicated markup:** the giving way's hidden copies, `.kn-header-probe`, `.kn-header-slack`, `.kn-header-copy` with its `data-kn-collapsed`, the slack's `data-kn-step` and the containers named for the steps, and the revealed footer's second set of bands, `.kn-footer-fit`, `.kn-footer-reach`, `.kn-footer-sheet` and `.kn-footer-copy`, which stood for a few hours the same day. ***Removed* 2026-11-10, with `header.js`'s and `footer.js`'s runtimes, by the owner's principle:** `--kn-header-panel-top`, `--kn-footer-height`, `data-kn-opaque-surface`, `data-kn-enhanced`, `data-kn-transparent`, `data-kn-away`, `data-kn-logo-polarity`, `data-kn-shadow`, `data-kn-line` and `data-kn-panel-open` on the header, `data-kn-collapsed` on the header, `data-kn-dialog`, `data-kn-header-start` and `data-kn-footer-attachment` on the Page, `data-kn-sticky-header` on the root, `data-kn-effective-attachment` and `data-kn-top-line` on the footer, `data-kn-auto-shadow` and `data-kn-auto-line` on the Page's main, and the `kn:headerchange`, `kn:refresh` and `kn:dispose` events. Gallery-only controls and the frame's `kn-frame-ready` / `kn-frame-config` messages are outside the component API.


## Lists, media, forms and consent names (2026-11-02)

***Decided* with the last six families of the first list; the assistant’s technical choices, 2026-11-02.** The initial build added no generated token or Surface role; the review below adds hover and status contexts.

- **Classes:** `.kn-content-loop`, `.kn-content-rows` and `.kn-content-row` with `heading`, `link`, `content`, `meta`, `excerpt`, `thumbnail` and `icon` parts; `.kn-visitor-filters`, `.kn-visitor-filter-group`, `toggles` and `count`; shared `.kn-pill`; `.kn-pagination`; `.kn-video`; `.kn-embed` with `stage`, `preview`, `poster`, `title`, `provider`, `notice`, `frame`, `original`, `dialog` and `gallery-note` parts; `.kn-form` with `fields` and `actions`; `.kn-field` with `label`, `required`, `control`, `options`, `option`, `help` and `error`; `.kn-consent`, `.kn-consent-settings`, `.kn-consent-settings-form` and `.kn-consent-category`. Parts retain the ordinary component-part grammar. Video and Embed also carry `.kn-figure` and reuse Figure’s media/caption parts and width attributes.
- **Choices:** `data-kn-presentation="cards|rows"` selects Content Loop presentation. Form reuses `data-kn-columns="1|2"`; its two columns collapse intrinsically. A native checked checkbox selects a filter pill (`aria-pressed` until 2026-11-10), and `aria-current="page"` selects a pager link. Neither adds another variant attribute. Media, forms and rows take no Frame or box shadow; the consent panel and native dialogs use `--kn-shadow-panel`.

| Custom property | What it is |
|---|---|
| `--kn-video-ratio` | Local video aspect ratio, default 16 / 9; no generator input. |
| `--kn-field-max` | Optional maximum inline size of one field, default 100%. |
| `--kn-consent-height` | Measured visible banner height on the root, in rem; zero while hidden. Reserves body space and end scroll padding. |

| Attribute | What it is |
|---|---|
| `data-kn-item` | One rendered loop item, which Visitor Filters may hide. |
| `data-kn-match="g-v"` | On a filter checkbox or option: its key, its group's place in the form and its value's place in the group, from 1, which the stylesheet pairs with items (the assistant's choice, 2026-11-10). A select's empty option has none. |
| `data-kn-matches` | On an item: the keys of its values, separated by spaces. |
| `data-kn-page` | The page number of an ordinary pager link. |

***Removed* with Visitor Filters' runtime by the owner's principle (2026-11-10):** `data-kn-filter`, `data-kn-text`, `data-kn-for`, `data-kn-filter-name`, `data-kn-page-size`, `data-kn-count-text`, `data-kn-result-count`, `data-kn-pagination-host`, `data-kn-pagination-label`, `data-kn-previous`, `data-kn-next`, `data-kn-page-label`, an item's `data-kn-group` and Visitor Filters' `data-kn-enhanced`. Visitor Filters' `for` now writes `aria-controls` on its keyed controls, and Content Loop gains `filteredBy`.
| `data-kn-url`, `data-kn-embed-title`, `data-kn-format` | Registered original URL, accessible title and provider format (`16 / 9`, `4 / 3`, `audio` or `square`). |
| `data-kn-embed-load` | Local one-view acceptance control; it grants no category. |
| `data-kn-embed-overlay` | An ordinary link enhanced to a native player dialog on an unmodified primary click. |
| `data-kn-embed-close`, `data-kn-embed-level`, `data-kn-embed-notice`, `data-kn-embed-load-label`, `data-kn-embed-original-label` | Optional overlay copy and semantic heading level on its trigger. |
| `data-kn-gallery-note` | Explicit gallery-only player substitute; normal components still create real iframes. |
| `data-kn-honeypot`, `data-kn-error-text` | Optional non-interactive honeypot field and the native validation-message destination. |
| `data-kn-categories`, `data-kn-consent-version`, `data-kn-storage-key`, `data-kn-settings` | Banner’s category catalogue, choice version, localStorage key and native settings-dialog id. |
| `data-kn-category` | Category id on a settings checkbox, with native disabled for required categories. |
| `data-kn-consent-accept`, `data-kn-consent-reject`, `data-kn-consent-close` | Accept-all, reject-all and settings-close actions. |
| `data-kn-consent-open` | Link or button anywhere in the document that reopens Consent Settings. Its link remains the no-script path. |
| `data-kn-consent-visible` | Root marker while the banner reserves space. |
| `data-kn-deferred` | Suppresses initial banner display for an explicitly opened gallery lab. |

The public query keys are `q`, the declared filter names and `page`; repeated values express OR. `kn:filterschange` synchronises panels after a local choice; it is not a source-query API. `consent.js` exports `hasConsent`, `setConsent` and `openConsentSettings`; the `kn:consentchange` window event carries the version and category choices, including withdrawal. `kn:consentbanneropen` on the banner opens the deferred lab example. These events change presentation and consent state, not design inputs.


## Dark-mode rule names (2026-11-05)

***Decided* with the owner's rule of 2026-11-05 (plates.md):** `background-page` is the contrast-pair name for a band's background against the page in the same mode, following the names `text-alt` and `link-hover`: what is checked, then what over. It adds no role, and the page and the picture kinds do not have it. `BAND_MINIMUM` names its target and `BAND_STEPS` the steps of a ramp that carry a band.

## Dark mode's steps (2026-11-11)

***Named* by the assistant with the owner's choice of a blacker dark page and lighter plates (plates.md):** dark mode's two steps of its own are `850` and `975`. A ramp's steps are named by their place in lightness on the hundreds scale, so a step that falls between two takes the number between them: 850 at 13.5 lies between 800 at 11 and 900 at 16, and 975 at 19.5 beyond 950 at 18.5. They follow the existing keys in `resolved.ramps.<rank>` and in recipes (`gray-975`), and no other name changes. `SCALES` names the ten steps each mode reads, `SCALES.light` and `SCALES.dark`.

## Owner’s review names (2026-11-02)

***Decided* with the components, 2026-11-02:** `--kn-background-hover` / resolved `background-hover`; `--kn-info` / `info`; `status-info`, `status-success`, `status-warning`, `status-error`. `text-hover` and `link-hover` are contrast-pair names at 4.5:1, not extra foreground roles. `STATUS_KINDS` is exported beside `KINDS` and all four belong to `kindsFor` in both modes. The assistant’s fixed contrast corrections are recorded in generator.md.

**Decided component vocabulary:** Accordion’s `variant` selects `data-kn-variant="hairlines|boxes"`; `faq` has only a structured-data effect. Callout’s `style` selects `data-kn-style="filled|outlined"`; its semantic `variant` remains `info|success|warning|error`, and it no longer accepts `surface`.

Content Card (`ContentCard.astro`, `.kn-card.kn-content-card`) and Content Row (`ContentRow.astro`, `.kn-content-row`) replace the earlier loop forms; Card retains only `link|person`. Props `imageRatio`, `imageInset`, `images`, `meta1`, `meta2`, `metaSeparator`, `cta`, `group`, `level` and `type` name their purposes. `meta1`/`meta2` entries are `{ text, datetime?, href?, pill? }`; CTA is `{ label, style: 'link'|'button', icon?: '›'|'»'|'→'|'➔' }`. Loop owns row `images`, `presentation`, `columns` and optional `surface` defaults. No numbered space step is public component input.

**The assistant’s part names:** `.kn-content-items`, `.kn-content-item`, `.kn-content-picture`, `.kn-content-body`, `.kn-content-heading`, `.kn-content-link`, `.kn-content-meta`, `.kn-content-meta-item`, `.kn-content-file`, `.kn-content-text`, `.kn-content-cta`, `.kn-content-cta-icon`, `.kn-content-kind-icon`, `.kn-content-group`. Shared `.kn-pill` supplies filled metadata pills and, as a checkbox's label, checked filter pills. Attributes `data-kn-image-ratio="2:1|3:2|1:1"`, `data-kn-image-inset="true|false"`, `data-kn-meta="1|2"`, `data-kn-separator="comma|bar|dot|none"`, `data-kn-pill`, `data-kn-placeholder` and `data-kn-content-group` describe existing parts. Optional metadata `kind="author|date|category"` becomes `data-kn-meta-kind` for the gallery configurator; arbitrary metadata needs no kind.

Visitor Filters uses `variant="filters|search"`; `.kn-visitor-filter-panel`, `select`, `search`, `input` and `submit` name its panel parts. A panel whose controls carry `data-kn-match` and that has no search field hides its submit control (2026-11-10). Shared `.kn-search-box`, `.kn-search-row` and `.kn-search-links` come from Search Panel; header aliases remain for compatibility with its approved appearance.

Consent adds `.kn-consent-actions`, `.kn-consent-settings-header`, `.kn-consent-settings-actions`, `.kn-consent-category-label`, `.kn-consent-category-content`, `.kn-consent-always`, `.kn-consent-close`, `.kn-consent-reopen`, `.kn-switch` and `.kn-switch-track`. Props `policyHref`, `policyLabel`, `maxAgeDays` (182), `reopenButton` (true) and `reopenLabel` identify the policy, expiry and persistent control. `categories[].services[]` contains `name`, `provider`, `thirdParty`, `purpose`, `storage` and `data`. `purpose` must include any onward sharing. `data-kn-max-age-days` supplies retention to the runtime; `data-kn-consent-reopen` relates the persistent Button to its banner. Stored `timestamp` is the choice’s epoch milliseconds, beside `version` and `choices`. Existing consent actions/events and Embed’s shared API remain unchanged. `--kn-consent-height` reserves body/scroll space only on narrow windows.

## Names on a Konzilo site (2026-11-05)

`konzilo.css` styles the core's own `konzilo-*` classes, which the core's `docs/site-design.md` lists, in a layer of its own, `kn-konzilo`, after `kn-components`, and sets its `--konzilo-lightbox-overlay`, `--konzilo-lightbox-text` and `--konzilo-lightbox-control` on the root. It adds two properties of its own inside its rules, `--kn-form-mark`, the colour of a form outcome's edge, and `--kn-select-stroke`, the line of a select's arrow, and a Footer's `--kn-footer-separator` holds for the consent controls in its cells too. `design-props` adds `logoAddresses`, whose `{ light, dark }` is the shape of Header's and `footerBrand`'s logo, and `menuProps`, named as the other props are. The package exports `./konzilo`, `./konzilo.css`, `./body-styles.css` and `./design-props`, and no longer `./fonts.css` or `./fonts/*`, since the tarball holds no fonts (konzilo.md).

## Directive names (2026-11-10)

***Specified* with the HTML contract for the directive list Konzilo defines (directives.md); the assistant's choices, 2026-11-10.** They follow the class grammar above, add no generated token, Surface kind or design-file key, and use the existing context, type, space, radius, duration and shadow roles.

- **Classes:** `.kn-section` with `media`, `picture`, `badges`, `head` and `body` parts, on a Band; `.kn-hero-logo`, a part of Hero; `.kn-heading-group-subheadline`, a part of Heading Group; `.kn-fine-print`; `.kn-fact-box` with `label` and `heading`; `.kn-description-list` and `.kn-value-list`, each with an `item` part, and `.kn-value-list-value`; `.kn-logos` with `label` and `list`; `.kn-actions` holding `.kn-action`, with `.kn-action-label`; `.kn-cards`, a series on a Card Grid, with `.kn-cards-nav` and `.kn-cards-label` for one that leads on; `.kn-card-symbol`, a part of Card; `.kn-timeline` with `item` and `heading`; `.kn-reasons` holding `.kn-reason`, with `.kn-reason-heading`; `.kn-post-list` and `.kn-featured`; `.kn-tabs` with `label`, `item` (a `<details>`), `tab` (its `<summary>`), `panel`, `text` and `parts`; `.kn-choice` with `label`, `item` (a `<details>`), `answer` (its `<summary>`) and `panel`; `.kn-article-opening`, on a Hero, `.kn-article-body`, on a Band, `.kn-article-meta` with `line`, `byline`, `date`, `category` and `topics` (`line` and `topics` since 2026-11-12: the core's sentence and the topics after it), and `.kn-question`.
- **Words:** `.kn-tabs-parts` holds a tab's components after its text, a word chosen over `components`, since every part of the page is one. `.kn-actions` and `.kn-action` name what the reader can do next, not a look, so a design may draw an action as a button or a link; Link Group stays for sites outside Konzilo.

| Attribute | What it is |
|---|---|
| `data-kn-deck="long"` | On a deck: its text is longer than a line beside its heading holds, `DECK_LINE`. A fact, not a layout. |
| `data-kn-numbering="decimal\|lower-latin\|upper-latin\|lower-roman\|upper-roman\|lower-greek\|double-latin"` | On an `<ol>` or a Timeline: the numbering of that level, named as CSS names its own counter styles where one matches. |
| `data-kn-punctuation="period\|parenthesis\|brackets"` | With a numbering: a full stop after it, a closing parenthesis after it, or both brackets around it; absent for none. |
| `data-kn-dotted` | With a numbering below the first level: the number of the item above stands before its own. |
| `data-kn-sign="check\|cross"` | On a `<ul>`, Reasons or a series of cards: the mark before each item or heading. |
| `data-kn-contact="phone\|email"` | On a link alone in a card's paragraph: its text is the number or the address. |
| `data-kn-service="linkedin\|facebook\|instagram\|youtube\|x"` | On `.kn-action`: a link to a service the design knows, drawn as its icon. |
| `data-kn-main` | On `.kn-action`: the main action, the one the editor set in bold. |
| `data-kn-picture="behind"` | On `.kn-cards`: the text stands on the picture. The same attribute says where a Hero's picture stands. |
| `data-kn-symbol="item\|heading"` | On `.kn-cards`: the pictures are symbols, by the card or by its heading. |
| `data-kn-questions` | On `.kn-accordion`: every item's heading is a question. |
| `data-kn-presentation="cards\|featured\|filtered"` | On `.kn-post-list`: the presentation a site declares to the core, as Content Loop's attribute names its own. |
| `data-kn-follow` | On `.kn-toc`: a following menu, on a rail. Nothing marks the section being read, neither a script (2026-11-10) nor Chromium's scroll markers (2026-11-11). |

| Export of `@kntnt/konzilo-design/directives` | What it is |
|---|---|
| `sectionParts`, `DECK_LINE` | A section's media, head, deck and body, and the deck's length fact. |
| `panelParts` | A tab panel's text and parts. |
| `markerAttributes` | One list level's attributes from `markers`. |
| `contactOf` | `phone`, `email` or nothing, for a link and its text. |
| `serviceOf`, `SERVICES` | A known service and its icon, by a link's host. |
| `allQuestions` | Whether a set of headings are all questions. |
| `surfaceOf` | The Surface of a part the design puts on a plate: `link-card`, `action-card`, `behind-card`, `fact-box`, `choice-answer` or `choice-panel`, given its ground. |
| `iconHtml` | An Icon's markup, as Icon writes it. |

No directive has a runtime. ***Removed* 2026-11-10, with their runtimes, replaced by `<details name>` and CSS:** `section.js` (`setupSections`, `headFits`, `STICKY_HEADS`), `tabs.js` (`setupTabs`, `tabMove`), `choice.js` (`setupChoices`), with `PREVIEW_EVENT` (`konzilo-preview-show`), the parts `.kn-tabs-list` and `.kn-choice-answers`, the tab's `role`, `aria-selected`, `aria-controls` and `tabindex`, the answer's `aria-expanded` and `aria-controls`, `data-kn-enhanced` on `.kn-tabs` and `.kn-choice`, and `data-kn-sticky` on `.kn-section-head`; `data-kn-sticky="true"` stays on an Aside Block as the option it requests. `form.js` (`setupForms`, `fieldMessage`) is removed too; `describedBy` moved to `ids.js`. `table-of-contents.js` holds only the build-time `contentsTree`; its `setupFollowingMenus` and `currentStop` are removed (2026-11-10). The counter styles are `kn-<numbering>`, such as `kn-lower-latin`, with the punctuation's forms beside them. The icons `instagram` and `brand-x` join `icons.js`; `brand-x` keeps `x`, the close mark, as it is.
