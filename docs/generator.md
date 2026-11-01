# Generator

The generator and framework core. From a design file's inputs it generates ramps,
the eight Surface kinds with their context roles in both modes, the contrast
matrix, typography, space, radii, shadows, frame, layout and motion; the CSS
emitter turns a resolved file into the framework core's stylesheet.

## Module API

The ES modules use Web Crypto, JSON module imports and standard JavaScript APIs.
They run without runtime dependencies in Node 22+ and modern browsers. Serve the
repository over HTTP with JavaScript and JSON MIME types for browser imports;
Web Crypto needs a secure context (HTTPS or localhost). Keep `package.json` and
the schema at their relative locations when serving the source modules.

```js
import { defaultInputs, resolve, checkFingerprint } from './src/generator/index.js';
import { emitCss } from './src/css/index.js';

const inputs = defaultInputs();
const file = { inputs, project: {}, resolved: await resolve(inputs) };
await checkFingerprint(file);
const css = await emitCss(file);
```

- `defaultInputs()` returns a fresh, complete input object. `resolve(inputs)` is
  asynchronous and returns only `resolved`; it does not mutate `inputs`. Only
  `brand-colors.primary` is required. Missing groups and leaves receive defaults;
  unknown controls, non-finite numbers and values outside the schema are refused.
- `fingerprint(inputs)` returns a lowercase SHA-256 hex digest.
  `canonicalJson(inputs)` sorts object keys recursively, preserves array order and
  rejects non-JSON values and cycles. The exact supplied inputs are fingerprinted,
  before defaults are filled. Presentation identity is outside the fingerprint.
- `checkFingerprint(file)` resolves to `true` or throws on a missing/mismatched
  fingerprint. This is a freshness check, not a signature authenticating `resolved`.
  Consumers must perform it before using stored values; they need no colour or
  scale generation. A generator version change alone does not invalidate a file.
- `validateInputs(inputs)` and `validateDesignFile(file)` return their argument
  or throw. Their small validator implements only the vocabulary used by this
  repository's JSON Schema 2020-12; it is not a general schema validator.
- `emitCss(file)` checks freshness, schema and the contrast check (re-computing
  the matrix from the stored colours, so an edited `resolved` is refused), then
  asynchronously returns CSS using the stored resolved values: the global roles
  on `:root`, the Surface kinds, the mode selectors and the widths.
- Low-level exports include `hexToRgb`, `rgbToHex`, `hexToOklch`, `rgbToOklch`,
  `oklchToRgb`, `oklchToHex`, `oklchToLinearRgb`, `inGamut`, `fitChroma`,
  `luminance`, `contrast`, `solveLightness`, `ramp`, `ramps`, `typeScale`,
  `spacing`, `radii`, `fluid`, `endpoints`, `rem`, `number`, `shadow`,
  `resolveColor` and `shadowsForSurface`. Constants `STEPS`, `TARGETS`,
  `BASE_SPACE`, `SPACE_ROLES`, `LEVELS` and `REFERENCE` are also exported.
  Low-level mathematical functions expect valid arguments; input validation occurs
  at `resolve` and consumer boundaries.

The CLI supports `resolve <file>`, `css <file> [-o out.css]` and `check <file>`.
Resolve writes a complete result into the same file, preserving its inputs and
presentation identity. CSS goes to stdout unless an output path is supplied. Check
validates the file, the fingerprint and the Surface contrast check. Errors go to stderr with a nonzero exit status.

## Algorithms and storage

### Colour and ramps

Hex colours accept three or six digits without alpha. sRGB channels are normalised
to 0–1, converted to linear light, then to OKLab and cylindrical OKLCH (`L` 0–1,
`C` absolute chroma, `H` degrees). Conversion back fits the largest chroma that
stays inside sRGB with 32 bisections, preserving lightness and hue. WCAG 2.x
luminance uses the sRGB transfer function and coefficients 0.2126, 0.7152 and
0.0722; contrast is `(lighter + 0.05) / (darker + 0.05)`.

Each ramp solves lightness with 48 bisections against the white page. Steps
100–900 and 950 target contrasts 1.12, 1.4, 2, 3.2, 4.8, 6, 8, 11, 16 and 18.5.
The low-level `ramp(seed, options)` retains generic chroma scaling and tint
handling: light steps 100–300 scale their in-gamut chroma by `tint`. The nearest
lightness step is replaced by the exact seed by default. Consequently the anchor
can depart from its target, and hex quantisation also introduces small contrast
differences. A ramp does not certify a Surface's contrast.

Tool inputs have no chroma or tint dials: brand ramps use both factors at 1.
Instead the brand ramps' light steps carry a chroma ceiling (`LIGHT_CEILING`:
0.03 at step 100, 0.06 at 200), decided by the owner on 2026-11-01, so a loud seed
gives a calm tint and its decorative border while a muted seed's light steps,
already below the ceiling, stay as they are. Step 300 has none: it is a
foreground on dark Surfaces. An anchored seed is kept exactly even on a light
step. `ramps(brandColors, temperature)` generates each supplied ranked brand and
an unanchored grey ramp. Grey temperature runs from −100 (cool hue 260°) through
0 (achromatic) to 100 (warm hue 80°), with chroma `abs(temperature) × 0.0002`.
This is an initial mapping, independent of brand hue. Resolved ramps store hex
colours keyed by shade; no raw ramp custom properties are exported.

### Type and units

`typeScale(type)` sums steps from body through heading-6, heading-5 and so on to
display. Lead steps start above body; small steps below it. Each endpoint is body
size times that endpoint's ratio raised to the cumulative step count, floored at
12px and rounded to whole pixels. Eyebrow takes small's size; mono takes body's.
These are visual styles, independent of semantic HTML heading levels.

All numeric resolved lengths are pixels at the default browser setting, including
layout and radii; durations are milliseconds and tracking is in em. Fluid values
store `{ min, max, css }`, where min/max mean the narrow/wide-window endpoints.
The stored CSS uses rem at 16 default-setting pixels per rem. `fluid(min, max)`
interpolates between 20rem and 90rem, rounding CSS coefficients to four decimals;
it also handles equal and descending endpoints. For example, 17–19px yields
`clamp(1.0625rem, 1.0268rem + 0.1786vw, 1.1875rem)`.
The root gets no font size. Line-height is unitless. Shadows and frame retain px.

### Space and shape

`spacing(profile)` uses base endpoint pairs 6–8, 10–12, 14–16, 20–24, 28–32,
32–40, 36–48 and 40–64px. A 0–100 density slider maps linearly to a multiplier
of 0.5–1.5; endpoints are rounded to whole pixels before fluid CSS is built.
The four roles map to steps 3 (component-gap), 6 (column-gap), 8 (band) and
5 (band-run), and store copies of those resolved values.

`radii(profile)` maps the first quarter of the corner slider linearly from 0 to
3px for both controls and cards. Above 25, radii continue linearly to 12px for
controls and 24px for cards at 100. This preserves an almost-square region while
allowing larger cards more rounding. Radii stay numeric until CSS converts to rem.

### Shadows and frame

`LEVELS` contains six immutable pairs of near/far tuples `[y, blur, spread, alpha]`.
`shadow(level, controls, hexColor, boost = 1)` applies the reference transformation:
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
Each Surface supplies its polarity and text colour (see Surfaces).

Shadow colour choices are `default` (text), `primary`, `secondary`, `tertiary`,
`gray` (grey step 500), `black`, or an explicit hex colour. An absent brand rank
is refused when selected. Root shadows provisionally use grey step 900 as text.
Frame width is independent, 0–3px, always solid when used by a component.
Frame `default` follows the shadow's colour setting before the dark-Surface
exception, so on a dark Surface a default frame takes the light text colour and
stays visible while the shadow turns black; other choices use the same colour
encoding. A target uses its own corner radius; component attachment comes
later, so this stage exports only frame width and colour.

### Surfaces

`surfaces(settings, palette)` builds the eight kinds in light and dark mode, each
with the eleven context roles, a polarity, its six shadows and its frame colour.
Each role is a recipe over the ramps (a ramp and step, or white or black).

- **Polarity:** `brand`, `inverse`, `accent` and `picture-dark` are dark in both
  modes; `picture-light` is light in both; `page`, `raised` and the tints follow
  the mode.
- **Backgrounds:** page white (dark mode grey 950); raised grey 100 (900); tint
  primary 100 (900), and each rank tint its colour's 100 (900); brand primary 800; inverse grey 950; accent primary 700;
  the picture kinds a white or black scrim over the image.
- **Rank tints:** `tint-secondary` and `tint-tertiary` exist only when that
  brand colour does (`kindsFor(palette)`); each is the tint recipe on its own
  colour's ramp, following the mode.
- **Rank:** links and the brand Surfaces from the primary; `accent` and `focus`
  from the secondary when there is one, else the primary, on every Surface,
  the rank tints included. A tertiary feeds only its own tint. Status roles come from fixed
  green, amber and red seeds, ramped like the brand colours.
- **Solving:** a recipe whose colour misses its target on that Surface moves
  along its own ramp to the nearest passing step (ties keep the polarity's
  direction) and never jumps to another ramp; the move is recorded as an
  adjustment. If no step passes, the colour stays and the matrix fails.
- **Pictures:** the scrim takes the least opacity, in hundredths, at which every
  role passes over both a black and a white image; the worse ratio counts.
- **Contrast check:** `contrastCheck` records every pair per kind and mode with its
  ratio, target and samples: text, text-muted, link, success, warning and error at
  4.5:1; border-strong, accent and focus at 3:1; border is decorative and only
  reported. `status` is `passed` or `failed`; every export refuses `failed`.
- **CSS and modes:** `[data-kn-surface="<kind>"]` redeclares the roles as
  `--kn-<role>`, `--kn-polarity`, the six shadows and the frame colour, and sets
  `background`, `color` and `color-scheme`; `:root` is the page. A kind whose
  values differ by mode writes them as `light-dark(light, dark)` and takes its
  `color-scheme` from `--kn-mode`, which `data-kn-mode="light|dark"` sets on any
  element and which inherits. Mode-following kinds therefore follow the nearest
  mode setting, not the polarity of the Surface around them, and a light card in
  a dark region, or the reverse, needs only `data-kn-mode` on it. Fixed-polarity
  kinds set their own `color-scheme`. Shadow geometry is shared; only the ink and
  alpha differ by mode, inside `light-dark()`.

### Layout, motion and CSS

Wide defaults to 75rem, Narrow to 45rem and Aside minimum to 14rem, as in the reference implementation. Side margin
grows from 1rem to 3rem. The content-area property stores the decided
`min(100% − 2 × side margin, Wide)` relation. Layout and motion add no inputs.
Feedback and movement defaults are 180ms and 240ms, with
`cubic-bezier(0.2, 0, 0, 1)`; a reduced-motion media query sets both durations to zero.

All owned custom properties and attributes use `kn-`. Width selectors implement
narrow, wide, full, bleed-start and bleed-end with logical margins, so directions
reverse in RTL. Use them in a full-width band or a parent centred on the viewport
(including a centred Narrow or Wide container). These selectors supply width
geometry; a future Reading Area handles its start-aligned Narrow column, occupied
Aside rows, caption alignment and Sidenote collision rules. Viewport breakouts
assume that containing blocks do not clip their overflow.

## Defaults

The complete executable defaults are in `src/generator/defaults.js`. The invented
brand is teal and typefaces use generic system sans-serif stacks; no monospace
selection is required. Body endpoints are 17–19px, ratios 1.067–1.125, chained
heading/display steps 0, 1, 1, 1, 1, 3, 3, lead 1 and small 2 below. Grey is
achromatic. Density 75 gives a looser-leaning multiplier of 1.25; corner 25 gives
3px radii. Shadows are off through strength zero, with other controls at reference
positions (hardness 20, angle 0, elevation 50) and all targets enabled. Frame is off.

Initial type recipes use line-height 1.1 for display, 1.3 for headings, 1.4 for
lead and 1.55 elsewhere; headings/display use weight 600 and −0.01em tracking,
other styles weight 400 and zero tracking. These are generic starting recipes,
not typeface-specific tuning.

## Open questions

- The reference design's tuning uses separate tint and chroma dials per brand
  colour. Decided inputs cannot express them; this generator keeps factors at 1.
- Grey temperature has no decided numerical mapping or brand-relative hue
  selector. The current cool/warm mapping is provisional and cannot reproduce
  arbitrary hue-and-chroma tuning.
- The reference design's tuning uses separate section-space scaling, layout
  measures, radii and type recipes. One density slider, one corner slider and
  fixed layout/type defaults cannot express every independent combination.
  Role-to-step mappings and the slider ranges need visual design validation.
- The reference design's tuning uses individual shadow strengths per elevation.
  The decided shared controls preserve the six reference shapes but cannot
  express arbitrary independent adjustments.
- Typeface assets, weights, leading, tracking, feature settings and eyebrow/mono
  size policy need typeface recipes; no extra controls have been added for them.
- A yellow primary's dark brand Surface still turns olive; no generic fix yet.
- In dark mode `inverse` and `page` share grey 950, so an inverse band does not
  stand out from a dark page.
- The reference design's tuning differs from these recipes in two places. Its
  strong borders on tinted and dark Surfaces equal the ordinary border and miss
  3:1, which the matrix now requires. On its light tinted Surfaces links and
  focus take the text colour, but only because its tool fell back to the text
  colour where a plate named no link colour, not by a tuned choice; these
  recipes keep the primary and secondary colours. Its light-step tints differ
  by a few units. Everything else matches to within one unit per channel.
- The component stage must assign frames, hairline fallbacks and Reading Area
  breakout behaviour; no component selectors are generated here.

The comparable reference tuning was checked outside repository files: ten type
styles, eight space steps, both radii and all six shadow strings matched from
equivalent inputs, and of 35 compared role colours 14 matched exactly and all but
the deliberate differences above within a few units. The reference's light tint
of its second brand colour is now `tint-secondary`, within two units. The automated tests retain only neutral values and generic
reference constants.
