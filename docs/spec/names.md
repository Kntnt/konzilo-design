# Framework names

Records the naming principles, framework and design-file name draft, and decisions still for the owner.

***Settled* 2026-11-01.** The owner chose the prefix; he left the other naming questions to the assistant, which took the recommendations under "Naming decisions" below, with the adjustments noted there. Every name in the tables is now the framework's name; the status column records where its spelling came from. Sources are the six neighbouring spec files and Blueprint's canonical vocabulary, including Q314 as amended by Q368–Q370. The eight Surface kinds, English terminology, eleven context roles plus polarity, continuous controls and design-file sections are already decided. New spellings and selector forms below remain proposals.

## Naming principles

- English is canonical. Use Blueprint's words where they exist: **Surface**, never Plate in English; “plate” / “platta” belong only in Swedish talk.
- Identifiers follow CSS's own spelling, `color` and `gray`, so that `--kn-frame-color` sits beside `border-color`; prose keeps British spelling.
- Use kebab-case in custom properties, classes, attributes and design-file keys. Keep the same word for the same thing in the design file, CSS and documentation.
- Name a role for its use, never its current value or colour. Components consume roles; generated ramps and steps are implementation values.
- No `on-` pairs. A Surface supplies a complete context, including nested Surfaces.
- Order names by family, variant, then state: `--text-muted`, `--border-strong`, `--button-hover`. A namespace precedes the family.
- Names carry no units. Follow tool.md point 3: rem for type sizes, space, widths, radii and breakpoints; em for component parts following their text; unitless line-height and em letter-spacing. Only what is drawn rather than read uses px: hairlines, the frame, focus rings and shadows. Durations use CSS time units.

## How to read the inventory

**Status concerns the spelling.** “Working name from spec” preserves a spelling already used there; any decided meaning is stated separately. “Proposed here” means that the exact spelling or mapping is new, even when its purpose is already decided. Each row gives the reason for retaining or proposing the name. Component classes and component-specific states wait for the components.

**Namespace notation:** custom properties below use their readable stems (`--text`, for example). Under decisions 1–2, the actual exported name is `--kn-text`, with no bare alias. Apply this transformation to every custom property in every table. Selector tables show the recommended full namespace explicitly. Design-file keys and attribute values are unprefixed inside their enclosing file or namespaced attribute. Standard CSS properties and native HTML/ARIA attributes keep their standard names.

### Context roles and Surface application

The eleven roles are decided in plates.md point 3 and “Decided with the owner”, point 4. Their spellings remain working names; retain all eleven because each supplies a distinct checked relationship. Hover, active and further states are added with components, as already decided.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--background` | The Surface's opaque background fill, with a fallback colour for an image | plates.md §3; page.md §1 | Working name from spec | Covers colour, gradient and image without calling every fill a colour. |
| `--text` | Primary foreground text | plates.md §3 | Working name from spec | Names the use independently of light or dark. |
| `--text-muted` | Secondary foreground text, still contrast-checked | plates.md §3 | Working name from spec | Keeps the text family together. |
| `--border` | Ordinary separating border colour | plates.md §3 | Working name from spec | Describes separation rather than a shade of grey. |
| `--border-strong` | Stronger border colour where separation needs emphasis | plates.md §3 | Working name from spec | A variant of the same border family. |
| `--link` | Link foreground | plates.md §3 | Working name from spec | Gives links a checked relationship on each Surface. |
| `--accent` | Contextual accent colour | plates.md §3 | Working name from spec | Keeps the accent role distinct from a raw Brand Colour Seed. |
| `--focus` | Focus-ring colour | plates.md §3 | Working name from spec | Names the interaction purpose. |
| `--success` | Success-status colour | plates.md §3 | Working name from spec | Names meaning rather than green. |
| `--warning` | Warning-status colour | plates.md §3 | Working name from spec | Names meaning rather than yellow. |
| `--error` | Error-status colour | plates.md §3 | Working name from spec | Names meaning rather than red. |
| `--polarity` | Generated `light` or `dark` marker for the Surface | plates.md §§3–4 | Proposed here | Uses the spec's exact concept, distinct from a requested mode. |
| `data-kn-surface="<kind>"` | Recommended Surface-kind selector, e.g. `data-kn-surface="raised"` | plates.md §7; proposed here | Proposed here | One attribute expresses one complete context and makes the selected kind visible. |
| `.kn-surface-<kind>` | Alternative class form, e.g. `.kn-surface-raised` | plates.md §7; proposed here | Proposed here | An ordinary class can redeclare the same roles; offered for the owner's choice. |

Both forms redeclare all roles and set the native `color-scheme` property from the generated polarity. The polarity is output, not a second author-controlled declaration. Consumers such as the transparent header use the generated context and marker through the ordinary class or attribute mechanism in plates.md point 7. Omitting a Surface kind inherits the enclosing context; `none`, `plain` and `inherit` are not ninth kinds.

### Surface kinds and local mode

These eight kind names and their meanings are **decided**, not questions to reopen (plates.md §4 and “Decided with the owner”, points 1–2). The selector syntax above remains proposed.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `page` | Page Surface, following the active mode | plates.md §4 | Working name from spec; decided kind | Names the base context's use. |
| `raised` | Raised content such as a card, following the mode | plates.md §4 | Working name from spec; decided kind | Expresses its relation to its ground. |
| `tint` | Light brand tint, following the mode | plates.md §4 | Working name from spec; decided kind | Retains the approved treatment name. |
| `brand` | Dark brand Surface, dark in both modes | plates.md §4 | Working name from spec; decided kind | Retains the approved brand treatment. |
| `inverse` | Dark neutral Surface, dark in both modes | plates.md §4 | Working name from spec; decided kind | Preserves the decided name; it does not mean invert the current mode. |
| `accent` | Brand fill for buttons and small marks | plates.md §4 | Working name from spec; decided kind | Shares the accent concept with its context role, in a different scope. |
| `picture-light` | Image treatment with light polarity and tested overlay or text Surface | plates.md §4 | Working name from spec; decided kind | Describes the image context's polarity, not an unchecked image brightness. |
| `picture-dark` | Image treatment with dark polarity and tested overlay or text Surface | plates.md §4 | Working name from spec; decided kind | Completes the approved picture pair. |
| `data-kn-mode="light"` | Explicit local light-mode selection; also usable at the root | plates.md §4; proposed here | Proposed here | Uses mode for the selection and leaves polarity for the result. |
| `data-kn-mode="dark"` | Explicit local dark-mode selection; also usable at the root | plates.md §4; proposed here | Proposed here | Keeps the two mode values together under one attribute. |
| `.kn-mode-light` | Class alternative for explicit light mode | plates.md §7; proposed here | Proposed here | Follows the class alternative if the owner chooses that syntax. |
| `.kn-mode-dark` | Class alternative for explicit dark mode | plates.md §7; proposed here | Proposed here | Completes the same alternative. |

No local mode attribute means inherit the selected mode; it does not mean follow the operating system. A light local mode does not turn `brand` or `inverse` light. Picture and accent values in both modes are generated and checked; this draft adds no new mode rule for them. The yellow-to-olive generator issue remains open in plates.md.

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
| `--type-body-size` | body style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-body-line-height` | body style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-body-weight` | body style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-body-letter-spacing` | body style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-small-size` | small style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-small-line-height` | small style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-small-weight` | small style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-small-letter-spacing` | small style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-eyebrow-size` | eyebrow style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-eyebrow-line-height` | eyebrow style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-eyebrow-weight` | eyebrow style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-eyebrow-letter-spacing` | eyebrow style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |
| `--type-mono-size` | mono style: fluid font size | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Names the visual size without fixing its value or unit. |
| `--type-mono-line-height` | mono style: unitless line-height | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps readable leading with the style recipe. |
| `--type-mono-weight` | mono style: font weight | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps the selected typeface’s weight with its style. |
| `--type-mono-letter-spacing` | mono style: letter-spacing in em | tool.md §2, type scale; plates.md §3; proposed here | Proposed here | Keeps tracking with the style and follows its text size. |

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--typeface-body` | Body Typeface family/stack, also the default for lead and small | tool.md §2; proposed here | Proposed here | Reuses Blueprint's Body Typeface. |
| `--typeface-display` | Display Typeface family/stack for display and headings | tool.md §2; proposed here | Proposed here | Reuses Blueprint's Display Typeface without tying it to a semantic heading level. |
| `--typeface-eyebrow` | Eyebrow Typeface family/stack | tool.md §2; proposed here | Proposed here | Keeps the decided separate typeface role. |
| `--typeface-monospace` | Optional Monospace Typeface family/stack for the mono style | tool.md §2; proposed here | Proposed here | Uses Blueprint's full typeface term; `mono` remains the shorter style name in the spec. |

`lead` is a typography treatment, not a replacement name for Blueprint's content term Standfirst. No fifth Utility Typeface input is introduced. Font assets and internal type-step indexing are generator details; components read these named roles.

### Space steps and roles

The specs decide fluid space steps and semantic space roles, but give neither a step count nor step names. Eight numbered steps, as in the reference design's tuning, are **proposed here**, ordered by size, with no numerical values implied by the names. Step names are internal CSS values for constructing roles; components read the roles only. The same keys live under `resolved.space.steps` without the CSS family prefix.

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--space-1` | Smallest generated fluid space step | plates.md §2; proposed here | Proposed here | Stable ordinal independent of density and units. |
| `--space-2` | Second generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-3` | Third generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-4` | Fourth generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-5` | Fifth generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-6` | Sixth generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-7` | Seventh generated fluid space step | plates.md §2; proposed here | Proposed here | Keeps one ordered vocabulary for the scale. |
| `--space-8` | Largest generated fluid space step | plates.md §2; proposed here | Proposed here | Covers broad band space without naming a fixed distance; eight steps reproduce the reference design. |
| `--space-component-gap` | Gap inside a component | plates.md §3; proposed here | Proposed here | Names the first decided space use explicitly. |
| `--space-column-gap` | Gap between columns, including Narrow and Aside | plates.md §3; page.md, Reading Area §4; proposed here | Proposed here | Shares the same column-gap role across layouts. |
| `--space-band` | Vertical space at a band's outer edges | plates.md §3; page.md §3; footer.md, model; proposed here | Proposed here | Uses Band, which includes main-content and footer bands. |
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

Shadows are off by default; enabling them starts at the reference design's tuned settings. Dark shadows, the explicit-colour override and hardness 100 behaviour remain as decided in tool.md. A shared control does not collapse the six shapes into one literal shadow. No separate `--shadow-footer` or additional seventh layer-shadow role is proposed.

### Frame

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--frame-width` | Frame thickness, 0–3px, in px like hairlines | tool.md §§2–3; proposed here | Proposed here | Uses CSS's border-width vocabulary without encoding a unit. |
| `--frame-color` | Frame colour, defaulting to the shadow's chosen colour | tool.md §2; proposed here | Proposed here | Uses the same English spelling as the colour inputs. |

The frame is always solid, off by default, with corners from the corner slider. There is no frame-style setting or separate frame radius. Table/field hairlines use context border roles; their naming is not absorbed into frame. Which components take a frame remains for the components.

### Layout

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `--layout-wide` | Maximum Wide content measure, owned by the page | plates.md §§2–3; page.md §§2, 5; proposed here | Proposed here | Reuses the canonical Layout Rail word Wide. |
| `--layout-side-margin` | Fluid margin on each side of the content area | plates.md §§2–3; page.md §2; proposed here | Proposed here | Names its geometric role without physical left/right. |
| `--layout-narrow` | Narrow reading measure, owned by the Reading Area | plates.md §§2–3; page.md, Reading Area §4; proposed here | Proposed here | Uses Narrow everywhere instead of introducing a second `measure` alias. |
| `--layout-aside-min` | Minimum usable Aside width | plates.md §§2–3; page.md, Reading Area §4; proposed here | Proposed here | Names the condition that triggers the one-column layout. |
| `--layout-content-area` | Available centred content width: `min(100% − 2 × side margin, Wide)` in the page's full-width context | page.md §2; proposed here | Proposed here | Distinguishes the computed width from Wide's maximum. |

The Reading Area threshold is Narrow + column gap + Aside minimum; it gains no independently named breakpoint. The content area aligns the header, footer and bands. Layout values use rem or relations built from rem; names do not encode the reference design's dimensions.

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

Top-level sections `inputs`, `project` and `resolved` are already decided (tool.md point 5). Dotted paths below describe nesting, not literal keys containing dots. Every new key is kebab-case. The file is a container for the design system, so keys need no CSS namespace. A flattened CSS name joins the same family and variant words; it need not reproduce JSON punctuation or repeat container keys.

### Sections and presentation identity

| Name | What it is | Source | Status | Reason |
|---|---|---|---|---|
| `inputs` | Tool-controlled choices; the only part a person changes, through the tool | tool.md §5 | Working name from spec; decided key | Retains the source contract. |
| `project` | Presentation identity | tool.md §5 | Working name from spec; decided key | Keeps presentation details apart from design choices. |
| `resolved` | All derived values read by consumers | tool.md §5 | Working name from spec; decided key | Retains the shared generated-output contract. |
| `project.name` | Presentation name | tool.md §5; proposed here | Proposed here | Uses the spec's simple identity word without naming any actual project. |
| `project.logo` | Presentation logo reference | tool.md §5; proposed here | Proposed here | Keeps the same identity term as the tool. |

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
| `inputs.typefaces.body` | Body Typeface | tool.md §2; proposed here | Proposed here | Same role as `--typeface-body`. |
| `inputs.typefaces.display` | Display Typeface, also for headings | tool.md §2; proposed here | Proposed here | Same role as `--typeface-display`. |
| `inputs.typefaces.eyebrow` | Eyebrow Typeface | tool.md §2; proposed here | Proposed here | Same role as `--typeface-eyebrow`. |
| `inputs.typefaces.monospace` | Optional Monospace Typeface | tool.md §2; proposed here | Proposed here | Same role as `--typeface-monospace`. |
| `inputs.type` | Body-size and scale container | tool.md §2; proposed here | Proposed here | Shares the global type family. |
| `inputs.type.body-size` | Fluid body-size endpoints | tool.md §§2–3; proposed here | Proposed here | Matches the body style's size rather than introducing base-font aliases. |
| `inputs.type.body-size.min` | Body size at the narrowest window, in default-setting pixels | tool.md §§2–3; proposed here | Proposed here | Uses the same endpoint word as resolved fluid values. |
| `inputs.type.body-size.max` | Body size at the widest window, in default-setting pixels | tool.md §§2–3; proposed here | Proposed here | Completes the endpoint pair without units in the key. |
| `inputs.type.ratio` | Fluid type-scale ratio endpoints | tool.md §2; proposed here | Proposed here | Names the decided ratio directly. |
| `inputs.type.ratio.min` | Ratio at the narrowest window | tool.md §2; proposed here | Proposed here | Uses the same endpoint convention as body size. |
| `inputs.type.ratio.max` | Ratio at the widest window | tool.md §2; proposed here | Proposed here | Completes the pair for one scale, not two scale presets. |
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
| `resolved.surfaces` | Eight Surface-kind entries | tool.md §5; plates.md §4; proposed here | Proposed here | Uses Surface, the canonical English word. |
| `page`, `raised`, `tint`, `brand`, `inverse`, `accent`, `picture-light`, `picture-dark` | Keys under `resolved.surfaces`, one per kind | plates.md §4 | Working names from spec; decided kinds | Exactly the same kind values as the CSS selectors. |
| `light`, `dark` | Mode keys under each kind | tool.md §5; plates.md §4 | Working names from spec; modes decided | Keeps mode selection separate from actual polarity. |
| `background`, `text`, `text-muted`, `border`, `border-strong`, `link`, `accent`, `focus`, `success`, `warning`, `error` | Context-role keys under each mode | plates.md §3 | Working names from spec | Exact CSS role stems, with only `--` and the namespace omitted. |
| `polarity` | Generated marker under each mode | plates.md §§3–4; proposed here | Proposed here | Exact word used by the CSS marker. |
| `resolved.type` | Text-style recipes keyed by display, heading-1 through heading-6, lead, body, small, eyebrow, mono | tool.md §5; plates.md §3; proposed here | Proposed here | Exact style words used by CSS. |
| `size`, `line-height`, `weight`, `letter-spacing` | Properties in each type recipe | tool.md §§2–3; proposed here | Proposed here | Same words as the corresponding global roles. |
| `resolved.typefaces` | Resolved body, display, eyebrow and optional monospace stacks | tool.md §2; proposed here | Proposed here | Keeps the typeface role words unchanged. |
| `resolved.space.steps` | Fluid steps keyed 1 through 8 | tool.md §5; plates.md §2; proposed here | Proposed here | Same step vocabulary as the internal CSS scale. |
| `resolved.space.roles` | component-gap, column-gap, band and band-run | plates.md §3; proposed here | Proposed here | Same variant words as the semantic CSS space roles. |
| `min`, `max` | Endpoint keys in fluid size and space values | tool.md §5 | Working names from spec | Retains the spec's endpoint words; storage units follow the schema, not the key. |
| `resolved.radius` | control and card radius values | tool.md §5; plates.md §3; proposed here | Proposed here | Exact family and use words from CSS. |
| `resolved.shadow` | Finished CSS values keyed header, header-panel, panel, page, box and box-lifted | tool.md §§2, 5; proposed here | Proposed here | Exact shadow variants used in CSS; each value includes near and far shadows. |
| `resolved.frame` | width and colour | tool.md §2; proposed here | Proposed here | Same independent frame family and properties as CSS. |
| `resolved.layout` | wide, side-margin, narrow, aside-min and content-area | plates.md §§2–3; page.md §2; proposed here | Proposed here | Same layout role words, including the computed relation. |
| `resolved.duration` | feedback and movement times | plates.md §2; proposed here | Proposed here | Same duration family and uses as CSS. |
| `resolved.easing` | standard curve | plates.md §2; proposed here | Proposed here | Same easing family and variant as CSS. |
| `resolved.generator-version` | Generator version | tool.md §5; proposed here | Proposed here | Names the version's subject explicitly. |
| `resolved.inputs-fingerprint` | Fingerprint of inputs; consumers refuse a mismatch | tool.md §5; proposed here | Proposed here | Names exactly what was fingerprinted. |
| `resolved.contrast-check` | Contrast-check result | tool.md §5; plates.md §6; proposed here | Proposed here | Names the validation, without presuming a report schema. |

No separate schema-version key, export configuration or component catalogue is invented here. This is a name inventory, not a JSON schema: colour-choice encoding, font-asset records, numeric ranges, report details and serialization of fluid relations still need implementation definitions. The words above do not authorize further input controls.

## Naming decisions (2026-11-01)

Each entry keeps its problem, options and reason as the record. Decisions 1 and 2 are the owner's. The rest he left to the assistant, which took each recommendation, with two adjustments: identifiers follow CSS's spelling (`color`, `gray`), and there are eight space steps, `--kn-space-1` to `--kn-space-8`, as in the reference design's tuning, in place of six `--space-step-*`. Already decided Surface kinds, Reading Area terminology, mode behaviour, continuous controls and the design-file source contract stood throughout.

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
12. **Space-step names and count.** Problem: fluid steps are decided but no enumeration exists. **Options:** step-1 through step-6; an extensible numbered scale with a count left to implementation; size adjectives such as xs through xl. **Recommendation, adjusted:** eight numbered steps, `--kn-space-1` to `--kn-space-8`, as the reference design's tuning has, because ordered indices survive density changes and provide a finite draft for the four semantic uses. This is a new proposed count, not a recovered decision; numerical values and mappings still require design validation.
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
