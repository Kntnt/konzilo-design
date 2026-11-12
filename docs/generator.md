# Generator

The generator and framework core. From a design file's inputs it generates ramps,
the Surface kinds with their context roles in both modes, the contrast
matrix, typography, space, radii, shadows, frame, layout and motion; the CSS
emitter turns a resolved file into the framework core's stylesheet.

## Module API

The ES modules use JSON module imports and standard JavaScript APIs. Only
fingerprinting uses Web Crypto.
They run without runtime dependencies in Node 22+ and modern browsers. Serve the
repository over HTTP with JavaScript and JSON MIME types for browser imports;
`derive` and `coreCss` work synchronously without Web Crypto, including on a
plain HTTP preview. Fingerprinting needs a secure context (HTTPS or localhost).
Keep `package.json` and the schema at their relative locations when serving the source modules.

```js
import { DESIGN_FORMAT, defaultInputs, derive, resolve, checkFingerprint } from './src/generator/index.js';
import { coreCss, emitCss } from './src/css/index.js';

const inputs = defaultInputs();
const file = { format: DESIGN_FORMAT, inputs, project: {}, resolved: await resolve(inputs) };
await checkFingerprint(file);
const css = await emitCss(file);
const preview = derive(inputs);
const liveCss = coreCss(preview);
```

- `defaultInputs()` returns a fresh, complete input object. `resolve(inputs)` is
  asynchronous and returns only `resolved`; it does not mutate `inputs`. Only
  `brand-colors.primary` is required. Missing groups and leaves receive defaults;
  unknown controls, non-finite numbers and values outside the schema are refused.
- `derive(inputs)` returns everything `resolve` returns except
  `inputs-fingerprint`, synchronously, with the same validation and defaults.
  `resolve` builds on it and adds the fingerprint. The live tool checks the
  returned `contrast-check` before replacing its preview.
- `coreCss(resolved)` synchronously emits the core from in-memory values. It
  performs no freshness, schema or contrast checks; stored design files must
  go through `emitCss`, which applies all three guards and then calls it.
- `fingerprint(inputs)` returns a lowercase SHA-256 hex digest.
  `canonicalJson(inputs)` sorts object keys recursively, preserves array order and
  rejects non-JSON values and cycles. The exact supplied inputs are fingerprinted,
  before defaults are filled. Presentation identity is outside the fingerprint.
- `checkFingerprint(file)` resolves to `true` or throws on a missing/mismatched
  fingerprint. This is a freshness check, not a signature authenticating `resolved`.
  Consumers must perform it before using stored values; they need no colour or
  scale generation. A generator version change alone does not invalidate a file.
- `DESIGN_FORMAT` is the design file's format, the required top-level integer that is
  raised only when the file's shape breaks; the schema holds the number. `checkFormat(file)`
  returns its argument or refuses a missing or newer format, in words naming both numbers
  and what to do. `withFormat(file)` is for what writes a file or reads only its inputs: it
  gives a file with no number this version's, first in the file, and refuses a newer one.
  docs/spec/konzilo.md, The three versions, says how it differs from `project.version` and
  `resolved.generator-version`.
- `validateInputs(inputs)` and `validateDesignFile(file)` return their argument
  or throw. Their small validator implements only the vocabulary used by this
  repository's JSON Schema 2020-12; it is not a general schema validator.
- `emitCss(file)` checks the format, freshness, schema and the contrast check (re-computing
  the matrix from the stored colours, so an edited `resolved` is refused), then
  asynchronously returns CSS using the stored resolved values: the global roles
  on `:root`, the Surface kinds, the mode selectors and the widths.
- Low-level exports include `hexToRgb`, `rgbToHex`, `hexToOklch`, `rgbToOklch`,
  `oklchToRgb`, `oklchToHex`, `oklchToLinearRgb`, `inGamut`, `fitChroma`,
  `luminance`, `contrast`, `solveLightness`, `ramp`, `ramps`, `typeScale`,
  `spacing`, `radii`, `fluid`, `endpoints`, `rem`, `number`, `shadow`,
  `resolveColor`, `shadowsForSurface`, `frameFollows` and `grayChroma`. Constants `STEPS`, `TARGETS`,
  `SCALES`, `BAND_MINIMUM`, `BAND_STEPS`, `BASE_SPACE`, `SPACE_ROLES`, `LEVELS` and `REFERENCE` are also exported.
  Low-level mathematical functions expect valid arguments; input validation occurs
  at `resolve` and consumer boundaries.

The CLI supports `resolve <file>`, `css <file> [-o out.css]`, `check <file>`,
`fonts <file> [-o folder]`, `logos <file> [-o folder]` and `components-css [-o out.css]`. The last flattens `src/components/index.css`
into one stylesheet without imports, for plain HTML.
Resolve writes a complete result into the same file, preserving its inputs and
presentation identity, and its format, or this version's where it has none. CSS goes to stdout unless an output path is supplied. Check
validates the format, the file, the fingerprint and the Surface contrast check. Fonts copies the typefaces the design uses, and logos writes its logos as files, for a Konzilo site's repository (docs/spec/konzilo.md). Errors go to stderr with a nonzero exit status.

`tool <file> [--port N] [--no-open]` opens the local editor on 127.0.0.1, on the named file or a new design created there, and returns at once; the editor stops by itself when its last window has been closed for 30 seconds. `tool --status` and `tool --stop [<file>]` list and stop the editors running (`tool/README.md`).
A missing file starts with Mona Sans and is created on first save. `presentation <file>
[-o out.zip]` generates a ZIP holding one self-contained, browsable HTML presentation.
The default output is `<stem>-presentation-<YYYY-MM-DD>.zip` beside the input.
It needs no browser at runtime.
See `tool/README.md` and `presentation/README.md` for controls, copy overrides,
offline assets, comments and browser verification.

Optional `inputs.typefaces.heading-1` selects the first-heading stack and its
own tuning; otherwise it follows `heading`. Optional `inputs.type.heading-1-color`
is `text` (the default) or `accent`. The emitter declares `--kn-text-heading-1`
on every Surface, reading that Surface's chosen role. Explicit choices are stored
as optional `resolved.typefaces.heading-1` and `resolved.heading-1-color`.
Absent inputs leave the prior resolved serialization and emitted CSS byte-identical.
No component rule changes.

Optional `project.logo-dark` is a string or null like `logo`. Both accept data
URIs or SVG/PNG paths relative to the design file; the tool embeds picked files
and the presentation embeds referenced files at build time. Identity never enters
the inputs fingerprint. A Konzilo site serves them as files, by `konzilo-design logos`.

Optional `project.version` is a string with presentation/tool default `1.0`. It supplies the approval document version independently of `resolved.generator-version`; it never changes generated values or the inputs fingerprint.

Optional `project.introduction`, `project.contact` (`name`, `email`) and
`project.explanations` are presentation metadata only. Explanation keys are
`colour`, `typefaces`, `type-scale`, `space-shape`, `shadow` and `components`.
All leaves are strings. Blank lines separate paragraphs, with no markup. These
fields are validated by the design-file schema and excluded from the input
fingerprint and generated CSS. Unknown project and explanation keys are errors.

## Algorithms and storage

### Colour and ramps

Hex colours accept three or six digits without alpha. sRGB channels are normalised
to 0–1, converted to linear light, then to OKLab and cylindrical OKLCH (`L` 0–1,
`C` absolute chroma, `H` degrees). Conversion back fits the largest chroma that
stays inside sRGB with 32 bisections, preserving lightness and hue. WCAG 2.x
luminance uses the sRGB transfer function and coefficients 0.2126, 0.7152 and
0.0722; contrast is `(lighter + 0.05) / (darker + 0.05)`.

Each ramp solves lightness with 48 bisections against the white page. Its twelve
steps 100–800, 850, 900, 950 and 975 target contrasts 1.12, 1.4, 2, 3.2, 4.8, 6, 8,
11, 13.5, 16, 18.5 and 19.5. Each mode reads ten of them (`SCALES`): light mode
100–950 without 850, as it always has, and dark mode 100–800 with 850 and 975, its own
steps for lighter plates and a blacker page (owner, 2026-11-11; plates.md), where it
read 900 and 950 before. So light mode is exactly as it was in v0.2.0.
The low-level `ramp(seed, options)` retains generic chroma scaling and tint
handling: light steps 100–300 scale their in-gamut chroma by `tint`. The seed replaces
by default the nearest step in lightness on the light scale, and also dark mode's own
step where it lies nearest 850 or 975 on the dark scale, unless the light scale already
put it on 800, which both modes read. A seed on 800 darker than 800's target takes 850
down with it, keeping their spacing of 13.5 to 11. Consequently an anchor
can depart from its target, and hex quantisation also introduces small contrast
differences. A ramp does not certify a Surface's contrast.

The seed must not erase a band (owner, 2026-11-05). On a step that carries a band the
seed is not anchored if it lies less than `BAND_MINIMUM` from a page. The light scale keeps
the guard it always had, on 100, 700, 800 and 900 against white and grey 950, so light mode
keeps its anchors; `ramp` takes those pages as `pages`, its solving page by default. Dark
mode's own steps are guarded on the steps its bands stand on (`BAND_STEPS`: 100, 700, 800,
850) against `darkPages`, white and grey 975. `ramps` gives both. The solved step stays, and
the seed still gives the ramp its hue and chroma.

The fill `background-hover` must differ visibly from both `background` and `background-alt` on every Surface and seed, which a test checks. On steps 700 and 800 it goes one or two steps darker, because a lighter step fails `link-hover`; on the two darkest steps of its mode it goes lighter. The table is under Surfaces.

The status ramps carry a ceiling of their own on the steps behind the status Surfaces (100, 200, 800, 850 and 900), so that green does not shout beside blue, amber and red; the status roles use steps 300 and 600, uncapped.

Tool inputs have no chroma or tint dials: brand ramps use both factors at 1.
Instead the brand ramps' tint steps carry a chroma ceiling (`TINT_CEILING`:
0.03 at step 100, 0.06 at 200 and 850, and 0.06 at 900, which carried the dark tint
until 2026-11-11 and keeps its ceiling so light mode is unchanged), decided by the owner on 2026-11-01, so a
loud seed gives a calm tint in both modes while a muted seed's steps, already
below the ceiling, stay as they are. Steps 300 and 800 have none: the first is a
foreground on dark Surfaces, the second carries the brand Surface. An anchored
seed is kept exactly even on a capped step. `ramps(brandColors, temperature)` generates each supplied ranked brand and
an unanchored grey ramp. Grey temperature runs from −100 (cool hue 260°) through
0 (achromatic) to 100 (warm hue 80°), with chroma `abs(temperature) × 0.0001`
(`grayChroma`): at most 0.01 as solved, half the former strength (owner, 2026-11-05), so every
position stays a grey that cannot be mistaken for the Tint band; rounding to hex reads up to
about 0.011. The hue mapping is independent of brand hue. Resolved ramps store hex
colours keyed by shade; no raw ramp custom properties are exported.

### Type and units

`typeScale(type)` sums steps from body through heading-6, heading-5 and so on to
display. Lead steps start above body; small steps below it. Each endpoint is body
size times that endpoint's ratio raised to the cumulative step count, floored at
12px and rounded to whole pixels. Eyebrow takes small's size; mono takes body's.
These are visual styles, independent of semantic HTML heading levels.

The endpoints belong to the breakpoints `inputs.type.breakpoints`, 390 and 1440px by
default. Between them the body size and the ratio each follow a straight line, so a
size is `body * ratio ** step` at every width: `sizeAt(scale, step, width)` in
`src/generator/type.js`. A recipe stores its `step`, and `resolved.type-scale` holds the
breakpoints, ratio and body size. The emitter writes each size twice. `:root` gets the
`clamp()` in `size.css`, a straight line on the size between the rounded endpoints, and
an `@supports` block for `pow()` and `atan2()` replaces it with
`calc(var(--kn-type-body-size) * pow(var(--kn-type-base), step))`, floored at 0.75rem below
the body size. `--kn-type-window` is how far the window has come, from 0 to 1, and
`--kn-type-base` the ratio there. A file resolved before this has neither `step` nor
`type-scale`, and keeps its clamps. Two breakpoints on one width make a step at that
width: `size.css` and `--kn-type-window` run over its last pixel, so the wide values hold
from that width on.

All numeric resolved lengths are pixels at the default browser setting, including
layout and radii; durations are milliseconds and tracking is in em. Fluid values
store `{ min, max, css }`, where min/max mean the narrow/wide-window endpoints.
The stored CSS uses rem at 16 default-setting pixels per rem. `fluid(min, max, from, to)`
interpolates between two windows, by default 20rem and 90rem, rounding CSS coefficients to four decimals;
it also handles equal and descending endpoints. For example, 17–19px yields
`clamp(1.0625rem, 1.0268rem + 0.1786vw, 1.1875rem)`.
The root gets no font size. Line-height is unitless. Shadows and frame retain px.

### Space and shape

`spacing(profile)` uses base endpoint pairs 6–8, 10–12, 14–16, 20–24, 28–32,
32–40, 36–48 and 40–64px. A 0–100 density slider maps linearly to a multiplier
of 0.5–1.5; endpoints are rounded to whole pixels before fluid CSS is built.
The five roles map to steps 3 (component-gap), 6 (column-gap), 8 (band),
5 (band-run) and 4 (plate), and store copies of those resolved values.
`--kn-space-plate` supplies the inner space of a coloured box. It shared step 6
with column-gap until the owner found the padding round the text in a card too
large while the gaps were right (2026-11-12): the gaps stay, and a plate's
inner space is step 4, between the component gap and band-run, 25–30px at the
default density.

`radii(profile)` maps the first quarter of the corner slider linearly from 0 to
3px for both controls and cards. Above 25, radii continue linearly to 12px for
controls and 24px for cards at 100. This preserves an almost-square region while
allowing larger cards more rounding. Radii stay numeric until CSS converts to rem.

### Shadows and frame

`LEVELS` contains six immutable pairs of near/far tuples `[y, blur, spread, alpha]`.
`shadow(level, controls, hexColor, boost = 1)` applies the transformation:
elevation scales geometry relative to 50, strength scales alpha relative to 50,
and angle rotates the offset from vertically downwards. Below hardness 20, blur
and spread grow to double; above 20 they shrink towards zero, the near shadow
fades, and the far shadow approaches full opacity quadratically. Strength zero
always emits `none`. At hardness 100, nonzero strength produces one solid offset
with whole-pixel lengths; otherwise lengths use two decimals and alpha three.

`shadowsForSurface(settings, { polarity, text, colors })` generates all six strings.
Header controls both header elevations; box controls both box elevations; panel
and page control their own. Target switches are independent of strength. With a
default colour on a dark Surface, it uses black with an opacity boost of three
before hardness interpolation. Explicit colours retain their colour and opacity.
Each Surface supplies its polarity and text colour (see Surfaces). The page's shadow on the footer falls on the footer's first band, so it takes that band's ink (2026-11-12): for each Surface whose `page` shadow differs from the page's, the emitter writes it on the page's main where that Surface is the footer's first band, `[data-kn-surface]:has(> footer > [data-kn-surface="brand"]:first-child) > main`, naming no class as the clear header's rules do; with no shadow, or on a light band, it writes nothing.

Shadow colour choices are `default` (text), `primary`, `secondary`, `tertiary`,
`gray` (grey step 500), `black`, or an explicit hex colour. An absent brand rank
is refused when selected. Root shadows provisionally use grey step 900 as text.
Frame width is independent, 0–3px, always solid when used by a component.
Frame `default` follows the shadow's colour setting before the dark-Surface
exception, so on a dark Surface a default frame takes the light text colour and
stays visible while the shadow turns black; other choices use the same colour
encoding. The frame alone has one more choice, `border`, the quiet edge (owner,
2026-11-11): each Surface's frame colour is its own `border` role, so a plated card's
frame follows its kind and the mode, grey 200 on grey 100 in light and grey 800 on
grey 850 in dark for `raised`. With it the emitter gives every Surface
`--kn-frame-ring: var(--kn-button-background-hover)`, which a filled button reads
before `--kn-frame-color`: a filled button is a small plate whose quiet edge is its
hover fill, the step beside its fill, where the Surface's border would draw a pale
line inside a dark button or a dark one round a white button. `frameFollows(surfaces,
role)` tells whether every Surface's frame is its own role of that name; the emitter
and DESIGN.md read the quiet edge from it, and `resolved` stores nothing more. At 1px
the text colour is what makes a frame heavy, not its width: there is no width below
1px, since in the three engines at scale factors 1 and 2 (Playwright's, 2026-11-11)
Gecko and Chromium drew a 0.5px border as 1px, WebKit drew it as a device pixel only
at scale 2, and a 0.5px inset ring is unsnapped, a faint half pixel at scale 1, so
cards and buttons would disagree. A target uses its own corner radius; filled buttons draw the frame as
an inset ring, outline buttons keep at least a hairline, and plated cards take the frame as a border. Only plated cards
use the box and lifted-box shadows among the first six components.

### Surfaces

`surfaces(settings, palette)` builds the eight base kinds, four status kinds and any rank tints
in light and dark mode, each
with seventeen context roles, a polarity, its six shadows and its frame colour.
Each role is a recipe over the ramps (a ramp and step, or white or black).

- **Polarity:** a background's step gives it: white and 100 are light, 700 and darker dark. So `brand`, `inverse` and
  `accent` are dark in both modes, and `page`, `raised` and the tints follow the mode. `picture-dark` is dark in both
  modes and `picture-light` light in both.
- **Backgrounds (the owner's rule, 2026-11-05, with dark mode's own steps of 2026-11-11; plates.md):** page white (dark
  mode grey 975); raised grey 100 (850); tint primary 100 (850), and each rank tint and status kind its colour's 100 (850);
  brand primary 800; accent primary 700; inverse grey 950 (dark mode grey 800, since a dark band is never darker than 800
  in dark mode); the picture kinds a white or black scrim over the image.
- **What stands on a background (the same rule):** every other role follows the mode and the background's step, on that
  mode's scale, in `ON_STEP`, never its kind. Each mode solves a role along its own scale too (`solveRole`'s `steps`), and a
  picture along the light scale in both modes, so it is the same in both. A kind contributes only its family, for fills and lines alike, except that accent's muted text and borders are
  grey, and a light band's muted text (raised, the tints and the status kinds) is grey in both modes, so that in dark mode it
  is not the colour of the links and the accent (owner, 2026-11-10). Light polarity's muted text is always grey 600, and strong borders are 500 in light polarity and 400 in dark. Pictures
  stand on no step: their own fill is also their alternate fill, and their other roles are grey, as in the last two rows.

  | Mode | Background | Alternate fill | Hover fill | Muted text | Border |
  |---|---|---|---|---|---|
  | light | white | 100 | 200 | grey 600 | 200 |
  | light | 100 | white | 200 | grey 600 | 200 |
  | light | 700 | 800 | 900 | 300 | 800 |
  | light | 800 | 900 | 950 | 200 | 700 |
  | light | 950 | 900 | 800 | 300 | 800 |
  | dark | 700 | 800 | 850 | 300 | 800 |
  | dark | 800 | 850 | 975 | 200 | 700 |
  | dark | 850 | 975 | 800 | 300 | 800 |
  | dark | 975 | 850 | 800 | 300 | 800 |
  | both | `picture-light` | white | 200 | grey 600 | 200 |
  | both | `picture-dark` | black | 800 | 300 | 800 |
- **A translucent background** (2026-11-12, for the owner's hint of the page through the header; header.md): every
  Surface but a picture's stores `translucent`, the least opacity, in hundredths and at least `TRANSLUCENT_LEAST`, 0.85, at
  which each of `TRANSLUCENT_ROLES`, text, muted text, link, strong border, focus and button background, holds its target
  over its background laid on black and on white, composited in encoded sRGB as a picture's scrim is
  (`translucentOpacity`). The emitter writes it as `--kn-background-translucent`, the background's colour at that opacity
  in each mode, working it out from the roles where a file resolved before it has none, and `checkContrast` refuses a
  stored value that is not the one its roles give. For the page in light mode it is 0.88 for every design, set by grey 600's
  muted text; in dark mode 0.85.
- **Rank tints:** `tint-secondary` and `tint-tertiary` exist only when that
  brand colour does (`kindsFor(palette)`); each is the tint recipe on its own
  colour's ramp, following the mode.
- **Alternate backgrounds (decided with the components, 2026-11-02):**
  `background-alt`, emitted as `--kn-background-alt`, is a fixed fill recipe,
  outside foreground solving, in the table above. A background on step 800 takes the next
  step down, 900 in light mode and 850 in dark: 700 misses `link-alt` at about 4:1 for the teal, yellow, blue, red and near-black test
  seeds. That preserves the approved foregrounds and the 4.5:1 target.
- **Rank:** links and the brand Surfaces from the primary; `accent` and `focus`
  from the secondary when there is one, else the primary, on every Surface,
  the rank tints included. A tertiary feeds only its own tint. Status roles come from fixed
  blue, green, amber and red seeds, ramped like the brand colours.
- **Buttons (decided with the components, 2026-11-01):** light polarity takes
  `button-background` from primary 700, `button-text` from white and
  `button-background-hover` from primary 800. Dark polarity, including accent,
  takes white, primary 700 and primary 100 respectively. These recipes stay
  fixed; the foreground solver never adjusts them against the Surface.
- **Solving:** a recipe whose colour misses its target on that Surface moves
  along its own ramp to the nearest passing step (ties keep the polarity's
  direction) and never jumps to another ramp; the move is recorded as an
  adjustment. If no step passes, the colour stays and the matrix fails. A colour must
  pass on every fill its role is checked over, the background and any alternate and hover
  fill, so a seed anchored at the dark end of a step moves where a lighter hover fill needs it.
- **Pictures:** the scrim takes the least opacity, in hundredths, at which every
  role passes over both a black and a white image, each on the nearest step of its
  own ramp; the worse ratio counts. So the picture shows as much as text on it
  allows, and the roles move lighter or darker for it rather than the scrim growing.
  For some brand colours contrast needs as much as 0.58; the owner accepted that on
  2026-11-10 rather than a lower ceiling.
  The CSS gives each picture kind `--kn-scrim`, the scrim as one colour at that
  opacity, for a component whose text stands on part of the picture, with two masks
  for a layer in that colour: `--kn-scrim-fade`, from clear to whole over
  `--kn-scrim-fade-length`, along `--kn-scrim-fade-direction` (`to bottom` unless a
  component turns it round), and `--kn-scrim-header`, whole behind a header and then
  clearing. Masks add up to at most the whole layer, so however they overlap, no
  point of the picture passes the checked opacity.
- **Contrast check:** `contrastCheck` records every pair per kind and mode with its
  ratio, target and samples: text, text-muted, link, info, success, warning and error at
  4.5:1; border-strong, accent and focus at 3:1; border is decorative and only
  reported. The three button pairs are `button-background` over the Surface
  background at 3:1 (using both scrim samples on pictures), `button-text` over
  button-background at 4.5:1, and `button-text-hover` over
  button-background-hover at 4.5:1. All three participate in failure and
  stale-report checks. `status` is `passed` or `failed`; every export refuses `failed`.
  The alternate-fill pairs `text-alt`, `text-muted-alt` and `link-alt` check the
  existing foreground roles over `background-alt` at 4.5:1 and participate in
  the same failure and stale-report guards. These are pairs, not extra foreground
  roles. Alternate fills are opaque, including on pictures, so these pairs have
  no image samples and never send a foreground through solving a second time.
  The pair `background-page` holds a band apart from the page (owner, 2026-11-05): the
  Surface's background against the page's in the same mode, at `BAND_MINIMUM`, 1.1, just below
  the lowest legitimate value, about 1.11 in light; in dark mode it is about 1.42, and about 1.24 for a seed
  held on 800 darker than its target, which takes 850 down with it. The page and the picture kinds
  do not have this pair. It joins the same failure and stale-report guards, so a resolved file from
  before it must be resolved again.
- **CSS and modes:** `[data-kn-surface="<kind>"]` redeclares the roles as
  `--kn-<role>`, `--kn-polarity`, the six shadows and the frame colour, and sets
  `background`, `color` and `color-scheme`; `:root` is the page. A kind whose
  values differ by mode writes them as `light-dark(light, dark)` and takes its
  `color-scheme` from `--kn-mode`, which `data-kn-mode="light|dark"` sets on any
  element and which inherits. Mode-following kinds therefore follow the nearest
  mode setting, not the polarity of the Surface around them, and a light card in
  a dark region, or the reverse, needs only `data-kn-mode` on it. Fixed-polarity
  kinds set their own `color-scheme`, and `light-dark()` answers to that scheme and not to the mode, so
  a fixed-polarity kind whose values differ by mode, `inverse` today, writes them as
  `var(--kn-in-light, light) var(--kn-in-dark, dark)`. The two switches are set wherever `--kn-mode` is: the
  current mode's is `initial`, giving its fallback, and the other is empty, giving nothing. No Surface
  written for its ground depends on style queries or `if()`. Shadow geometry is shared; only the ink and
  alpha differ by mode. Each block declares its kind first, `--kn-surface-kind`, which inherits.
- **A part on a ground of its own kind** (2026-11-12, the assistant's choice; plates.md, A plate finds its
  ground): for each kind on which a part the design puts on a plate takes another, as `surfaceOf` gives it,
  the emitter writes inside `@container style(--kn-surface-kind: <kind>)` a rule for those parts with that
  same kind, which declares the other plate's whole block, its kind included. `sameGroundPlates()` in
  `src/directives/surfaces.js` gives the pairs from `surfaceOf`'s table and each part's selector as
  directives.md writes it: today `raised` on `raised` takes `page` (link card, a choice's answer and
  panel), and `tint` on `tint` takes `raised` (action card, fact box). These two are the only rules of the
  core that name classes. A Surface written for its ground is never its ground's kind, so they meet none.
- **A clear header** (2026-11-10, the assistant's choice, with the header's rebuild without script,
  header.md, How it is built): inside `@container style(--kn-header-clear: 1)`, which a Page sets while
  its sticky header is transparent over its start, each kind's roles, polarity, `color-scheme`, shadows and
  frame colour are written again, without its background, for the header of a page whose first band is
  that kind, and a first band's `data-kn-mode` for its mode. The selectors name no class:
  `[data-kn-surface]:has(> main > :first-child[data-kn-surface="<kind>"]) > [data-kn-start="under"]`, the
  page kind matching a first child with no Surface too.

### Layout, motion and CSS

Wide defaults to 75rem, Narrow to 45rem and Aside minimum to 14rem. Side margin
grows from 1rem to 3rem. The content-area property stores the decided
`min(100% − 2 × side margin, Wide)` relation. Layout and motion add no inputs.
Feedback and movement defaults are 180ms and 240ms, with
`cubic-bezier(0.2, 0, 0, 1)`; a reduced-motion media query sets both durations to zero.

The core starts with `@layer kn-core, kn-base, kn-components;` and wraps its
rules in `@layer kn-core`. Component CSS puts the small reset and type
selectors in `kn-base` and components in `kn-components`. Thus a site's
unlayered CSS can override every library default, while component interaction
rules beat the core Surface background regardless of selector specificity.
Load the generated core and `@kntnt/konzilo-design/components.css` once per
site. Astro components import no CSS themselves; individual `.astro` files
are exported under `@kntnt/konzilo-design/components/*`. Astro ^7 is an
optional peer for consumers using those wrappers. A Konzilo site takes all this
through `fromDesign` (docs/spec/konzilo.md), and its `konzilo.css` adds a layer of its own after these, `kn-konzilo`.

`:root` also gets two literals, `--kn-theme-primary`, the primary brand seed exactly,
and `--kn-theme-base`, the page's background in light mode, from `resolved.theme`. The
roles beside them are `light-dark()`, which a consumer that reads a colour at build time
cannot read, and a seed is not always a step of its ramp.

All owned custom properties and attributes use `kn-`. Width selectors implement
narrow, wide, full, bleed-start and bleed-end with logical margins, so directions
reverse in RTL. Use them in a full-width band or a parent centred on the viewport
(including a centred Narrow or Wide container). These selectors supply width
geometry; the Reading Area component adjusts them for its offset Narrow column,
occupied Aside rows and caption alignment, in CSS alone. The core writes
`--kn-reading-columns: 1` on `:root` and, for each window `readingColumnWindows`
(`src/generator/layout.js`) finds where `min(w − 2 × side margin, Wide)` holds
Narrow, the column gap and the Aside minimum, a `@media screen and (width >= …rem)`
that sets it to 2. It reads the side margin and the column gap back from their
emitted clamps, so the arithmetic is the browser's; for the defaults the query is
`(width >= 66.5775rem)`. `reading-area.css` reads the switch by a style query and
floats the Aside and the Sidenotes, so a Breakout beside a float keeps Narrow and
the area holds the last note; `test/reading-area.test.js` checks the windows by
brute force and in every engine. Print retains inline reading order. Viewport breakouts assume that inner containing
blocks do not clip their overflow; Page clips only horizontal viewport overflow.

## Defaults

The complete executable defaults are in `src/generator/defaults.js`. The invented
brand is teal and the main and monospace typefaces are the system stacks, with
labels in the main family; headings follow the main typeface and display text the
headings. A typeface input is a CSS family stack; one that does not end in a generic
family gets the matching system stack appended, because a named family may never
load. Body endpoints are 17–19px, ratios 1.067–1.125, chained
heading/display steps 0, 1, 1, 1, 1, 3, 3, lead 1, small 2 below and
label 3 below (5 until the owner asked for eyebrows a step larger, 2026-11-12). Grey is
achromatic. Density 75 gives a looser-leaning multiplier of 1.25; corner 25 gives
3px radii. Shadows are off through strength zero, with hardness 30, angle 0, elevation 50,
the text colour and all targets enabled. Frame is off.

Initial type recipes use line-height 1.1 for display, 1.3 for headings, 1.4 for
lead and 1.55 elsewhere; headings/display use weight 600 and −0.01em tracking,
other styles weight 400 and zero tracking. These are generic starting recipes,
not typeface-specific tuning. The label recipe is decided: components.md, Typefaces
and labels.

A typeface's own tuning is one entry in `TUNING`, `src/generator/typefaces.js`. A
recipe whose typeface has tuning and which reaches its size stores `features`, with
`from-window` 0 when always on, or else the window in px where its size crosses
that size. The emitter writes `--kn-type-<style>-features` for every style, `normal`
until the tuning applies, and a media query for a crossing.

Optional `inputs.header`, `inputs.footer`, `inputs.page`, `inputs.breadcrumbs` and `inputs.hero` pass with their defaults to `resolved.header`, `resolved.footer`, `resolved.page`, `resolved.breadcrumbs` and `resolved.hero`, for a site to give to its components. They emit no CSS. `inputs.hero` has `height` (`third`, `half`, `two-thirds`, `full`), `picture` (`none`, `behind`, `start`, `end`, `start-bleed`, `end-bleed`), `place` (`top`, `center`, `bottom`), `align` (`start`, `center`, `end`), `surface`, `overlay` and `type`; components.md says what they mean. `inputs.layout.wide` and `.narrow` set the resolved `layout` widths. `inputs.header` has `identity` (`logo`, `name`, `both`), `brand-axis` (`row`, `column`) and `slogan-place` (`beside`, `below`) among its settings; header.md, point 13, says what they mean. `footerFromDesign` in `src/components/footer.js` turns the footer's settings and a site's content into the Footer's props, and `footerBrand` in `src/components/brand.js` writes the brand for a cell, following `header.identity` and `header.brand-axis`. `src/components/design-props.js`, exported as `@kntnt/konzilo-design/design-props`, holds both, with `identityProps`, `headerProps`, `heroProps`, `nextHeadingProps`, `breadcrumbProps` and `pageProps` for the other settings: each takes a site's own content as arguments, and the presentation's `frame.js` gives them the sample's. `logoAddresses` and `menuProps` there are for a Konzilo site (docs/spec/konzilo.md).

Optional `inputs.tabs` passes with its default to `resolved.tabs` too (2026-11-12). Unlike the frame's settings it is written in the core CSS, since a site writes the tabs' HTML itself, from the directives, and the design's choice must reach it without the site writing anything: `--kn-tabs-rule-place` on `:root` is `tabs.rule-place`, `below` or `above`, or `below` where a file resolved before 0.5.0 has no `tabs`, and `tabs.css` reads it by a style query (directives.md, `tabs`).

Optional `inputs.type.roles` sets a role's look: `main` (body, lead and small text),
`heading`, `heading-1`, `display`, `label` and `monospace`, each with optional `weight`,
`letter-spacing`, `axes` (variation axes by tag) and `features` (OpenType tags). A style
then stores them in its recipe: `wdth` as `stretch`, the other axes as `variation`, and
chosen features with `from-window` 0, an empty list turning a typeface's tuning off. The
emitter also writes `--kn-type-<style>-stretch` and `--kn-type-<style>-variation`, which
components read with `normal` as fallback. Without settings the resolved serialization
and core CSS stay byte-identical.

Optional `inputs.typefaces.label` gives labels a typeface of their own; otherwise
`inputs.type.label` picks the main or the monospace family.

Optional `inputs.type.heading-1-role` is `heading` (the default) or `display`. In the
display role the first heading keeps its size and takes display text's line height, its
stack unless `typefaces.heading-1` names another, and its settings, with any set for
`heading-1` alone on top.

## Open questions

- Decided inputs cannot express separate tint and chroma dials per brand colour;
  this generator keeps factors at 1.
- Grey temperature has no brand-relative hue selector. The current cool and warm
  hues are provisional and cannot reproduce arbitrary hue-and-chroma tuning.
- One density slider, one corner slider and fixed layout/type defaults cannot
  express every independent combination of section space, layout measures, radii
  and type recipes.
  Role-to-step mappings and the slider ranges need visual design validation.
- The decided shared shadow controls preserve the six tuned shapes but cannot
  express an individual strength per elevation.
- Weights, leading and tracking for the main family and the mono style still use
  generic recipes; no extra controls have been added for them.
- Further components must assign their frame, shadow and hairline behaviour.
  Reading Area breakout behaviour was resolved with its layout implementation
  on 2026-11-01 (components.md and page.md).

The automated tests retain only neutral values and generic constants.


## Component review additions (2026-11-02)

***Decided* with the components, 2026-11-02:** add `background-hover` (emitted as `--kn-background-hover`), `info` (`--kn-info`, seed `#1d6fd1`) and four mode-following status kinds. `STATUS_KINDS` exports `status-info`, `status-success`, `status-warning`, `status-error` beside `KINDS`; `kindsFor` always includes them before optional ranked tints. The schema requires every new kind, role and pair, so stored pre-review results need CLI re-resolution.

Each status kind is the tint recipe on its own status ramp: background 100/850, alternate white/975, border 200/800, strong border 500/400, muted text gray-600 / gray-300 (owner, 2026-11-10), accent own-600/300 in light/dark respectively. Status accent deliberately uses that status ramp even when there is a secondary brand seed. Link/focus and Button recipes retain their usual rank/polarity policies. Every ordinary Surface pair applies, including the information status foreground at 4.5:1.

Hover fills are opaque and fixed recipes, independent of foreground solving. `text-hover` and `link-hover` check existing text/link over that fill at 4.5:1, including pictures without scrim samples. They join the failure and stale-report guards. No extra foreground roles are introduced.

| Kind | Light hover recipe | Dark hover recipe |
|---|---|---|
| page | gray-200 | gray-800 |
| raised | gray-200 | gray-800 |
| tint / rank tint | own-200 | own-800 |
| status kind | own-200 | own-800 |
| brand | primary-950 | primary-975 |
| inverse | gray-800 | gray-975 |
| accent | primary-900 | primary-850 |
| picture-light | gray-200 | gray-200 |
| picture-dark | gray-800 | gray-800 |

**The assistant’s recipe correction, 2026-11-02:** the requested raised-dark, tint-dark, status-dark and brand 700 recipes miss `link-hover` at about 4:1 for teal, yellow, blue, red and near-black seeds. Accent 600 also misses. Use one darker step (800 and 700 respectively), preserving the foregrounds and target. On dark tints/raised this makes hover equal to the alternate fill; brand/accent hover equals the base fill. This is the contrast-constrained result of the requested recipe correction, not a relaxed target. The test matrix also checks white, saturated magenta/green, gray, both rank configurations and temperatures −100/0/100. The table above and the step table under Surfaces hold the recipes as they now stand (owner's rule, 2026-11-05).
