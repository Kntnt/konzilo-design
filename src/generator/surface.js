import { contrast, hexToRgb, luminance } from './color.js';
import { ramp, STEPS } from './ramps.js';
import { resolveColor, shadowsForSurface } from './shadow.js';

export const KINDS = Object.freeze(['page', 'raised', 'tint', 'brand', 'inverse', 'accent', 'picture-light', 'picture-dark']);
export const STATUS_KINDS = Object.freeze(['status-info', 'status-success', 'status-warning', 'status-error']);
// A tint per further brand colour (owner, 2026-11-01), generated only when that colour exists.
export const RANK_TINTS = Object.freeze({ secondary: 'tint-secondary', tertiary: 'tint-tertiary' });
export const kindsFor = (palette) => [...KINDS, ...STATUS_KINDS, ...Object.entries(RANK_TINTS).filter(([rank]) => palette[rank]).map(([, kind]) => kind)];
export const MODES = Object.freeze(['light', 'dark']);
export const ROLES = Object.freeze(['background', 'background-alt', 'background-hover', 'text', 'text-muted', 'border', 'border-strong', 'link', 'accent', 'focus', 'info', 'success', 'warning', 'error', 'button-background', 'button-text', 'button-background-hover']);
// Accent is also checked at 3:1, so it can carry non-text emphasis.
export const ROLE_TARGETS = Object.freeze({ text: 4.5, 'text-muted': 4.5, border: 0, 'border-strong': 3, link: 4.5, accent: 3, focus: 3, info: 4.5, success: 4.5, warning: 4.5, error: 4.5, 'button-background': 3, 'button-text': 4.5, 'button-text-hover': 4.5, 'text-alt': 4.5, 'text-muted-alt': 4.5, 'link-alt': 4.5, 'text-hover': 4.5, 'link-hover': 4.5 });
// Steps carrying the status Surfaces and their borders; the status roles use 300 and 600, uncapped.
const STATUS_CEILING = Object.freeze({ 100: 0.05, 200: 0.08, 800: 0.09, 900: 0.06 });
export const STATUS_SEEDS = Object.freeze({ info: '#1d6fd1', success: '#16803c', warning: '#b77900', error: '#c53030' });
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

export function surfacePairs(surface) {
  return Object.fromEntries(Object.entries(ROLE_TARGETS).map(([role, target]) => {
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

// Search by distance in the ordered step list, rather than by numeric shade gap.
// Ties keep the polarity's foreground direction. Never jump to another ramp.
export function solveRole(recipe, palette, target, ratio, polarity) {
  const original = color(recipe, palette);
  if (ratio(original) >= target || !recipe.includes('-')) return { recipe, color: original };
  const [name, shade] = recipe.split('-'), start = STEPS.indexOf(Number(shade));
  const candidates = STEPS.map((step, i) => ({ step, distance: Math.abs(i - start) }))
    .sort((a, b) => a.distance - b.distance || (polarity === 'dark' ? a.step - b.step : b.step - a.step));
  for (const { step } of candidates) {
    const candidate = ref(name, step), hex = color(candidate, palette);
    if (ratio(hex) >= target) return { recipe: candidate, color: hex };
  }
  return { recipe, color: original }; // The matrix records the failure.
}

function recipesFor(kind, mode, palette) {
  const accent = palette.secondary ? 'secondary' : 'primary';
  const rank = kind === 'tint' ? 'primary' : kind.startsWith('tint-') ? kind.slice(5) : kind.startsWith('status-') ? kind.slice(7) : null;
  const polarity = ['brand', 'inverse', 'accent', 'picture-dark'].includes(kind) ? 'dark'
    : kind === 'picture-light' ? 'light' : mode;
  const dark = polarity === 'dark';
  const background = kind === 'accent' ? 'primary-700'
    : kind === 'brand' ? 'primary-800' : kind === 'inverse' ? 'gray-950'
    : kind.startsWith('picture-') ? (dark ? 'black' : 'white')
    : rank !== null ? ref(rank, dark ? 900 : 100)
    : kind === 'raised' ? ref('gray', dark ? 900 : 100) : dark ? 'gray-950' : 'white';
  const family = kind === 'brand' ? 'primary' : rank !== null ? rank : 'gray';
  // A hover fill must show against both the background and the alternate rows. On the dark
  // brand Surfaces a lighter step would fail link-hover, so these fills go darker instead.
  const hover = kind === 'brand' ? 'primary-950' : kind === 'accent' ? 'primary-900'
    : kind === 'inverse' || kind === 'picture-dark' ? 'gray-800'
    : kind === 'picture-light' ? 'gray-200'
    : rank !== null ? ref(rank, dark ? 800 : 200)
    : ref('gray', dark ? 800 : 200);
  // Brand 700 fails link-alt at 4.5:1; 900 preserves the approved foregrounds.
  const alternate = kind.startsWith('picture-') ? background
    : kind === 'brand' ? 'primary-900' : kind === 'accent' ? 'primary-800'
    : kind === 'inverse' ? 'gray-900'
    : rank !== null ? dark ? ref(rank, 950) : 'white'
    : kind === 'raised' ? dark ? 'gray-950' : 'white' : dark ? 'gray-900' : 'gray-100';
  return { polarity, recipes: {
    background, 'background-alt': alternate, 'background-hover': hover, text: dark ? 'white' : 'gray-900',
    'text-muted': dark ? ref(family, kind === 'brand' ? 200 : 300) : 'gray-600',
    border: ref(family, dark ? kind === 'brand' ? 700 : 800 : 200),
    'border-strong': ref(family, dark ? 400 : 500), link: ref('primary', dark ? 300 : 800),
    accent: ref(kind.startsWith('status-') ? rank : accent, dark ? 300 : 600), focus: ref(accent, dark ? 300 : 600),
    ...Object.fromEntries(Object.keys(STATUS_SEEDS).map((name) => [name, ref(name, dark ? 300 : 600)])),
    'button-background': dark ? 'white' : 'primary-700',
    'button-text': dark ? 'primary-700' : 'white',
    'button-background-hover': dark ? 'primary-100' : 'primary-800',
  } };
}

export function surfaces(settings, palette) {
  const seeds = settings['brand-colors'];
  const status = Object.fromEntries(Object.entries(STATUS_SEEDS).map(([name, seed]) => [name, Object.fromEntries(ramp(seed, { ceiling: STATUS_CEILING }).map(({ step, hex }) => [step, hex]))]));
  const all = { ...palette, ...status };
  return Object.fromEntries(kindsFor(palette).map((kind) => [kind, Object.fromEntries(MODES.map((mode) => {
    const { polarity, recipes } = recipesFor(kind, mode, all);
    const surface = { polarity, roles: Object.fromEntries(Object.entries(recipes).map(([role, recipe]) => [role, color(recipe, all)])), recipes, adjustments: {} };
    if (kind.startsWith('picture-')) {
      surface.scrim = { color: surface.roles.background, opacity: 1 };
      // The least hundredth-opacity that preserves all starting recipes.
      for (let percent = 0; percent <= 100; percent++) {
        surface.scrim.opacity = percent / 100;
        if (Object.values(surfacePairs(surface)).every((pair) => pair.passed)) break;
      }
    }
    for (const [role, target] of Object.entries(ROLE_TARGETS)) {
      // Filled-button recipes are fixed pairs, not foregrounds on the Surface.
      if (role.startsWith('button-') || role.endsWith('-alt') || role.endsWith('-hover')) continue;
      const ratio = (hex) => surface.scrim ? Math.min(...['#000000', '#ffffff'].map((image) => pictureContrast(hex, surface.scrim, image))) : contrast(hex, surface.roles.background);
      const solved = solveRole(recipes[role], all, target, ratio, polarity);
      surface.roles[role] = solved.color;
      if (solved.recipe !== recipes[role]) surface.adjustments[role] = { from: recipes[role], to: solved.recipe };
    }
    const context = { polarity, text: surface.roles.text, colors: { ...seeds, gray: palette.gray[500] } };
    surface.shadow = shadowsForSurface(settings.shadow, context);
    // Default frame takes the chosen shadow ink before the dark-Surface exception.
    surface['frame-color'] = resolveColor(settings.frame.color === 'default' ? settings.shadow.color : settings.frame.color, context);
    return [mode, surface];
  }))]));
}

export function contrastCheck(surfaces) {
  const matrix = Object.fromEntries(Object.keys(surfaces).map((kind) => [kind, Object.fromEntries(MODES.map((mode) => [mode, {
    pairs: surfacePairs(surfaces[kind][mode]), adjustments: structuredClone(surfaces[kind][mode].adjustments),
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
    const stored = resolved['contrast-check'].matrix[kind][mode];
    const computed = actual.matrix[kind][mode];
    for (const role of Object.keys(ROLE_TARGETS)) {
      const a = stored.pairs[role], b = computed.pairs[role];
      if (!a || !a.passed || a.ratio < b.target ||
          ['foreground', 'background', 'ratio', 'target', 'passed'].some((key) => a[key] !== b[key]) ||
          Object.keys(a.samples).length !== Object.keys(b.samples).length ||
          Object.keys(b.samples).some((image) => a.samples[image] !== b.samples[image])) {
        throw new Error(`Surface contrast check failed or stale: ${kind}/${mode}/${role}`);
      }
    }
  }
  return true;
}
