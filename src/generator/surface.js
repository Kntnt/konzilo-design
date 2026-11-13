import { contrast, fitChroma, hexToOklch, hexToRgb, luminance, oklchToHex } from './color.js';
import { BAND_MINIMUM, ramp, SCALES } from './ramps.js';
import { resolveColor, shadowsForSurface } from './shadow.js';

export const KINDS = Object.freeze(['page', 'raised', 'tint', 'brand', 'inverse', 'accent', 'picture-light', 'picture-dark']);
export const STATUS_KINDS = Object.freeze(['status-info', 'status-success', 'status-warning', 'status-error']);
// A tint per further brand colour (owner, 2026-11-01), generated only when that colour exists.
export const RANK_TINTS = Object.freeze({ secondary: 'tint-secondary', tertiary: 'tint-tertiary' });
export const kindsFor = (palette) => [...KINDS, ...STATUS_KINDS, ...Object.entries(RANK_TINTS).filter(([rank]) => palette[rank]).map(([, kind]) => kind)];
export const MODES = Object.freeze(['light', 'dark']);
export const ROLES = Object.freeze(['background', 'background-alt', 'background-hover', 'text', 'text-muted', 'border', 'border-strong', 'link', 'accent', 'focus', 'info', 'success', 'warning', 'error', 'button-background', 'button-text', 'button-background-hover']);
// Accent is also checked at 3:1, so it can carry non-text emphasis. background-page holds a band apart from the page.
export const ROLE_TARGETS = Object.freeze({ text: 4.5, 'text-muted': 4.5, border: 0, 'border-strong': 3, link: 4.5, accent: 3, focus: 3, info: 4.5, success: 4.5, warning: 4.5, error: 4.5, 'button-background': 3, 'button-text': 4.5, 'button-text-hover': 4.5, 'text-alt': 4.5, 'text-muted-alt': 4.5, 'link-alt': 4.5, 'text-hover': 4.5, 'link-hover': 4.5, 'background-page': BAND_MINIMUM });
// Steps carrying the status Surfaces and their borders, 850 in dark mode, and 900 as it was (ramps.js, TINT_CEILING);
// the status roles use 300 and 600, uncapped.
const STATUS_CEILING = Object.freeze({ 100: 0.05, 200: 0.08, 800: 0.09, 850: 0.06, 900: 0.06 });
export const STATUS_SEEDS = Object.freeze({ info: '#1d6fd1', success: '#16803c', warning: '#b77900', error: '#c53030' });

// The warning apart from the brand's tints (2026-11-13). A brand colour near amber gave its tint almost the warning's
// values, so a warning Surface could not be told from the tint Surface. Where a brand tint's background stands nearer the
// warning Surface's than WARNING_NEAR in either mode, in OKLab, the warning turns its hue by the fewest whole degrees, up
// to WARNING_TURN either way and away from that tint first, that set its Surface WARNING_APART from every brand tint and
// from every other status in both modes, keeping the seed's lightness and chroma where the gamut allows. Where no turn
// does, it takes the turn that sets it farthest from the nearest of them. WARNING_APART is CSS Color 4's just noticeable
// difference in OKLab and about the least the four statuses stand from one another in light mode; WARNING_NEAR is half
// of it. Any other design keeps the warning's seed, and so every value, exactly.
export const WARNING_NEAR = 0.01;
export const WARNING_APART = 0.02;
export const WARNING_TURN = 30;
const oklab = (hex) => {
  const { L, C, H } = hexToOklch(hex);
  return [L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180)];
};
// How far apart two colours are, in OKLab (deltaEOK).
export const oklabDistance = (one, other) => Math.hypot(...oklab(one).map((value, i) => value - oklab(other)[i]));
// Each light band's background, light mode's and dark mode's.
const BAND_BACKGROUNDS = [100, 850];
// The least distance between a ramp's band backgrounds and those of other ramps, mode by mode.
const nearest = (steps, others) => Math.min(...others.flatMap((other) => BAND_BACKGROUNDS.map((step) => oklabDistance(steps[step], other[step]))));

// A status seed's ramp, as the status Surfaces take it, beside the brand's palette.
export const statusRamp = (seed, palette) => Object.fromEntries(ramp(seed, { ceiling: STATUS_CEILING, pages: ['#ffffff', palette.gray[950]], darkPages: ['#ffffff', palette.gray[975]] }).map(({ step, hex }) => [step, hex]));

// The warning's seed beside the brand's palette.
export function warningSeed(palette) {
  const rampOf = (seed) => statusRamp(seed, palette);
  const tints = Object.keys(RANK_TINTS).concat('primary').filter((rank) => palette[rank]).map((rank) => palette[rank]);
  const seed = STATUS_SEEDS.warning;
  const plain = rampOf(seed);
  const near = nearest(plain, tints);
  if (near >= WARNING_NEAR) return seed;
  const others = Object.entries(STATUS_SEEDS).filter(([name]) => name !== 'warning').map(([, hex]) => rampOf(hex));
  const { L, C, H } = hexToOklch(seed);
  const turned = (turn) => {
    const hue = (H + turn + 360) % 360;
    return oklchToHex(L, fitChroma(L, C, hue), hue);
  };
  // Away from the tint nearest it: the side its hue lies on from the warning's.
  const closest = tints.reduce((best, tint) => (nearest(plain, [tint]) < nearest(plain, [best]) ? tint : best));
  const away = (((hexToOklch(plain[100]).H - hexToOklch(closest[100]).H) % 360) + 540) % 360 - 180 < 0 ? -1 : 1;
  let best = { seed, least: Math.min(near, nearest(plain, others)) };
  for (let degrees = 1; degrees <= WARNING_TURN; degrees++) {
    for (const turn of [away * degrees, -away * degrees]) {
      const hex = turned(turn), candidate = rampOf(hex);
      const [fromTints, fromOthers] = [nearest(candidate, tints), nearest(candidate, others)];
      if (fromTints >= WARNING_APART && fromOthers >= WARNING_APART) return hex;
      if (Math.min(fromTints, fromOthers) > best.least) best = { seed: hex, least: Math.min(fromTints, fromOthers) };
    }
  }
  return best.seed;
}

const ref = (ramp, step) => `${ramp}-${step}`;
const color = (recipe, palette) => recipe === 'white' ? '#ffffff' : recipe === 'black' ? '#000000' : palette[recipe.split('-')[0]][recipe.split('-')[1]];

// Picture compositing is in encoded sRGB, like CSS source-over. Do not round
// channels before computing luminance: the matrix checks the actual scrim.
export function pictureContrast(foreground, scrim, image) {
  const rgb = hexToRgb(scrim.color).map((v, i) => v * scrim.opacity + hexToRgb(image)[i] * (1 - scrim.opacity));
  const linear = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const bg = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const fg = luminance(foreground);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

// A translucent layer, such as a header bar the page shows through (the owner, 2026-11-12): its Surface's background at
// this opacity, over whatever lies under it, blurred. The roles such a layer draws on its background must hold over any
// page, from black to white, as a picture's roles hold over any picture: its words, muted words and links, its focus
// ring, an unfilled button's ring and a filled button against it. And it is only ever a hint of what lies under it, so
// it is at least TRANSLUCENT_LEAST opaque, where its roles would allow it more see-through.
export const TRANSLUCENT_LEAST = 0.85;
export const TRANSLUCENT_ROLES = Object.freeze(['text', 'text-muted', 'link', 'border-strong', 'focus', 'button-background']);
// The least hundredth-opacity, from TRANSLUCENT_LEAST, at which every one of those roles holds over black and over white.
// A picture Surface has a scrim of its own and none.
export function translucentOpacity(surface) {
  if (surface.scrim) return null;
  for (let percent = Math.round(TRANSLUCENT_LEAST * 100); percent < 100; percent++) {
    const scrim = { color: surface.roles.background, opacity: percent / 100 };
    if (TRANSLUCENT_ROLES.every((role) => ['#000000', '#ffffff'].every((image) => pictureContrast(surface.roles[role], scrim, image) >= ROLE_TARGETS[role]))) return percent / 100;
  }
  return 1;
}

// Given its page, a band also gets the pair that holds it apart from that page in the same mode. The page cannot
// differ from itself and a picture shows an image rather than a fill, so neither has that pair.
export function surfacePairs(surface, page = surface) {
  const band = surface !== page && !surface.scrim;
  return Object.fromEntries(Object.entries(ROLE_TARGETS).filter(([role]) => band || role !== 'background-page').map(([role, target]) => {
    if (role === 'background-page') {
      const ratio = contrast(surface.roles.background, page.roles.background);
      return [role, { foreground: surface.roles.background, background: page.roles.background, ratio, target, passed: ratio >= target, samples: {} }];
    }
    const buttonText = role === 'button-text' || role === 'button-text-hover';
    const alternate = role.endsWith('-alt');
    const hover = !buttonText && role.endsWith('-hover');
    const foreground = surface.roles[buttonText ? 'button-text' : alternate ? role.slice(0, -4) : hover ? role.slice(0, -6) : role];
    const background = surface.roles[buttonText ? role === 'button-text-hover' ? 'button-background-hover' : 'button-background' : alternate ? 'background-alt' : hover ? 'background-hover' : 'background'];
    const onPicture = surface.scrim && !buttonText && !alternate && !hover;
    const samples = onPicture ? Object.fromEntries(['#000000', '#ffffff'].map((image) => [image, pictureContrast(foreground, surface.scrim, image)])) : {};
    const ratio = onPicture ? Math.min(...Object.values(samples)) : contrast(foreground, background);
    return [role, { foreground, background, ratio, target, passed: ratio >= target, samples }];
  }));
}

// Search by distance in the ordered step list of the mode's scale, rather than by numeric shade gap.
// Ties keep the polarity's foreground direction. Never jump to another ramp.
export function solveRole(recipe, palette, target, ratio, polarity, steps = SCALES.light) {
  const original = color(recipe, palette);
  if (ratio(original) >= target || !recipe.includes('-')) return { recipe, color: original };
  const [name, shade] = recipe.split('-'), start = steps.indexOf(Number(shade));
  const candidates = steps.map((step, i) => ({ step, distance: Math.abs(i - start) }))
    .sort((a, b) => a.distance - b.distance || (polarity === 'dark' ? a.step - b.step : b.step - a.step));
  for (const { step } of candidates) {
    const candidate = ref(name, step), hex = color(candidate, palette);
    if (ratio(hex) >= target) return { recipe: candidate, color: hex };
  }
  return { recipe, color: original }; // The matrix records the failure.
}

// One rule from light mode to dark mode (owner, 2026-11-05): the step each kind's background stands on in each mode,
// and its family. Each mode reads its own scale (ramps.js, SCALES). The page is white in light and 975 in dark. Light
// bands mirror, 100 in light being 850 in dark (owner, 2026-11-11, where they were 950 and 900). Dark bands keep their
// step, but in dark mode are never darker than 800: the page and the light bands have 975 and 850.
// A light band's muted text is grey in both modes, as it is in light mode, so that in dark mode it is not the colour of
// the links and the accent (owner, 2026-11-10).
const LIGHT_BAND = Object.freeze({ light: 100, dark: 850, mutedFamily: 'gray' });
const STANDS = Object.freeze({
  page: { family: 'gray', light: 'white', dark: 975 },
  raised: { family: 'gray', ...LIGHT_BAND },
  brand: { family: 'primary', light: 800, dark: 800 },
  inverse: { family: 'gray', light: 950, dark: 800 },
  // Accent's fills are the primary's, while its muted text and borders are grey.
  accent: { family: 'primary', lines: 'gray', light: 700, dark: 700 },
});
const standsOf = (kind) => STANDS[kind] ?? { family: kind === 'tint' ? 'primary' : kind.split('-')[1], ...LIGHT_BAND };
// What stands on a background follows the mode and the step, never the kind; white and 100 are light, the rest dark. A
// hover fill must show against both the background and the alternate fill. On 700 and 800 a lighter hover would fail
// link-hover, so these go darker, and 800's alternate is the next step down because 700 fails link-alt; on the two
// darkest steps the hover goes lighter. The dark rows are the same in both modes, each on its own mode's scale.
const ON_STEP = Object.freeze({
  light: {
    white: { alternate: 100, hover: 200, border: 200 },
    100: { alternate: 'white', hover: 200, border: 200 },
    700: { alternate: 800, hover: 900, muted: 300, border: 800 },
    800: { alternate: 900, hover: 950, muted: 200, border: 700 },
    950: { alternate: 900, hover: 800, muted: 300, border: 800 },
  },
  dark: {
    700: { alternate: 800, hover: 850, muted: 300, border: 800 },
    800: { alternate: 850, hover: 975, muted: 200, border: 700 },
    850: { alternate: 975, hover: 800, muted: 300, border: 800 },
    975: { alternate: 850, hover: 800, muted: 300, border: 800 },
  },
});
// A picture stands on no step: its grey family's roles are fixed, and its scrim's colour is also its alternate fill. It
// reads the light scale in both modes, so it is the same in both, as it always was.
const PICTURES = Object.freeze({
  'picture-light': { polarity: 'light', family: 'gray', alternate: 'white', hover: 200, border: 200 },
  'picture-dark': { polarity: 'dark', family: 'gray', alternate: 'black', hover: 800, muted: 300, border: 800 },
});

function recipesFor(kind, mode, palette) {
  const accent = palette.secondary ? 'secondary' : 'primary';
  const picture = PICTURES[kind];
  const stands = picture ?? standsOf(kind);
  const { family, lines = family } = stands;
  const polarity = picture ? picture.polarity : ['white', 100].includes(stands[mode]) ? 'light' : 'dark';
  const dark = polarity === 'dark';
  const row = picture ?? ON_STEP[mode][stands[mode]];
  const fill = (step) => ['white', 'black'].includes(step) ? step : ref(family, step);
  return { polarity, recipes: {
    background: fill(picture ? picture.alternate : stands[mode]), 'background-alt': fill(row.alternate), 'background-hover': fill(row.hover), text: dark ? 'white' : 'gray-900',
    'text-muted': dark ? ref(stands.mutedFamily ?? lines, row.muted) : 'gray-600',
    border: ref(lines, row.border),
    'border-strong': ref(lines, dark ? 400 : 500), link: ref('primary', dark ? 300 : 800),
    accent: ref(kind.startsWith('status-') ? family : accent, dark ? 300 : 600), focus: ref(accent, dark ? 300 : 600),
    ...Object.fromEntries(Object.keys(STATUS_SEEDS).map((name) => [name, ref(name, dark ? 300 : 600)])),
    'button-background': dark ? 'white' : 'primary-700',
    'button-text': dark ? 'primary-700' : 'white',
    'button-background-hover': dark ? 'primary-100' : 'primary-800',
  } };
}

export function surfaces(settings, palette) {
  const seeds = settings['brand-colors'];
  const statusSeeds = { ...STATUS_SEEDS, warning: warningSeed(palette) };
  const status = Object.fromEntries(Object.entries(statusSeeds).map(([name, seed]) => [name, statusRamp(seed, palette)]));
  const all = { ...palette, ...status };
  return Object.fromEntries(kindsFor(palette).map((kind) => [kind, Object.fromEntries(MODES.map((mode) => {
    const { polarity, recipes } = recipesFor(kind, mode, all);
    const surface = { polarity, roles: Object.fromEntries(Object.entries(recipes).map(([role, recipe]) => [role, color(recipe, all)])), recipes, adjustments: {} };
    const solveRoles = () => {
      surface.adjustments = {};
      for (const [role, target] of Object.entries(ROLE_TARGETS)) {
        // Filled-button recipes are fixed pairs and the fills fixed colours, not foregrounds on the Surface.
        if (role.startsWith('button-') || role.startsWith('background-') || role.endsWith('-alt') || role.endsWith('-hover')) continue;
        // A foreground must hold on every fill it is checked over, not only on the background: a seed anchored at the
        // dark end of a step leaves too little margin for a hover fill lighter than the background.
        const fills = ['alt', 'hover'].filter((fill) => ROLE_TARGETS[`${role}-${fill}`]).map((fill) => surface.roles[`background-${fill}`]);
        const ratio = (hex) => Math.min(...fills.map((fill) => contrast(hex, fill)), ...(surface.scrim ? ['#000000', '#ffffff'].map((image) => pictureContrast(hex, surface.scrim, image)) : [contrast(hex, surface.roles.background)]));
        const solved = solveRole(recipes[role], all, target, ratio, polarity, SCALES[kind.startsWith('picture-') ? 'light' : mode]);
        surface.roles[role] = solved.color;
        if (solved.recipe !== recipes[role]) surface.adjustments[role] = { from: recipes[role], to: solved.recipe };
      }
    };
    if (kind.startsWith('picture-')) {
      surface.scrim = { color: surface.roles.background, opacity: 1 };
      // The least hundredth-opacity at which every role holds on any picture, each on the step of its
      // ramp nearest its recipe, so the picture shows as much as text on it allows.
      for (let percent = 0; percent <= 100; percent++) {
        surface.scrim.opacity = percent / 100;
        // Text has one colour here, so the other roles need not be tried until it holds.
        if (Math.min(...['#000000', '#ffffff'].map((image) => pictureContrast(surface.roles.text, surface.scrim, image))) < ROLE_TARGETS.text) continue;
        solveRoles();
        if (Object.values(surfacePairs(surface)).every((pair) => pair.passed)) break;
      }
    } else solveRoles();
    const context = { polarity, text: surface.roles.text, colors: { ...seeds, gray: palette.gray[500] } };
    surface.shadow = shadowsForSurface(settings.shadow, context);
    // Default frame takes the chosen shadow ink before the dark-Surface exception. The quiet edge, `border`, is the
    // Surface's own border role, so a plate's frame follows its kind and the mode (owner, 2026-11-11).
    const frame = settings.frame.color;
    surface['frame-color'] = frame === 'border' ? surface.roles.border : resolveColor(frame === 'default' ? settings.shadow.color : frame, context);
    if (!surface.scrim) surface.translucent = translucentOpacity(surface);
    return [mode, surface];
  }))]));
}

// Whether every Surface's frame is its own role of that name in both modes: `text` for a default frame with the
// default shadow colour, `border` for the quiet edge. A colour of its own cannot match both modes of every Surface.
export const frameFollows = (surfaces, role) => Object.values(surfaces).every((modes) => MODES.every((mode) => modes[mode]['frame-color'] === modes[mode].roles[role]));

export function contrastCheck(surfaces) {
  const matrix = Object.fromEntries(Object.keys(surfaces).map((kind) => [kind, Object.fromEntries(MODES.map((mode) => [mode, {
    pairs: surfacePairs(surfaces[kind][mode], surfaces.page[mode]), adjustments: structuredClone(surfaces[kind][mode].adjustments),
  }]))]));
  const passed = Object.values(matrix).every((modes) => Object.values(modes).every(({ pairs }) => Object.values(pairs).every((pair) => pair.passed)));
  return { status: passed ? 'passed' : 'failed', matrix };
}

// All exports share this guard. Recheck stored colours as well as the report:
// a fingerprint authenticates inputs, not edits to resolved output.
export function checkContrast(resolved) {
  const actual = contrastCheck(resolved.surfaces);
  if (resolved['contrast-check'].status !== 'passed' || actual.status !== 'passed') throw new Error('Surface contrast check failed');
  const kinds = Object.keys(resolved.surfaces);
  if (Object.keys(resolved['contrast-check'].matrix).join() !== kinds.join()) throw new Error('Surface contrast check failed or stale: kinds differ');
  for (const kind of kinds) for (const mode of MODES) {
    const surface = resolved.surfaces[kind][mode];
    if (surface.translucent !== undefined && surface.translucent !== translucentOpacity(surface)) throw new Error(`Surface contrast check failed or stale: ${kind}/${mode}/translucent`);
    const stored = resolved['contrast-check'].matrix[kind][mode];
    const computed = actual.matrix[kind][mode];
    for (const role of new Set([...Object.keys(computed.pairs), ...Object.keys(stored.pairs)])) {
      const a = stored.pairs[role], b = computed.pairs[role];
      if (!a || !b || !a.passed || a.ratio < b.target ||
          ['foreground', 'background', 'ratio', 'target', 'passed'].some((key) => a[key] !== b[key]) ||
          Object.keys(a.samples).length !== Object.keys(b.samples).length ||
          Object.keys(b.samples).some((image) => a.samples[image] !== b.samples[image])) {
        throw new Error(`Surface contrast check failed or stale: ${kind}/${mode}/${role}`);
      }
    }
  }
  return true;
}
