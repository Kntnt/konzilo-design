import { hexToOklch, fitChroma, oklchToHex, contrast, rgbToHex, hexToRgb } from './color.js';

// Every step a ramp has, lightest first, and each one's contrast against white.
export const STEPS = Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950, 975]);
export const TARGETS = Object.freeze([1.12, 1.4, 2, 3.2, 4.8, 6, 8, 11, 13.5, 16, 18.5, 19.5]);
// Each mode reads ten of them. Light mode keeps the ten it always had, so nothing in it changed when dark mode got two of
// its own for a blacker page and lighter plates (owner, 2026-11-11): 975 at 19.5 for the page, and 850 at 13.5 for the
// light bands, so a plate stands about 1.44 from the dark page, where 900 on 950 gave 1.16.
export const SCALES = Object.freeze({
  light: Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
  dark: Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 850, 975]),
});
// The steps that carry tint backgrounds get a chroma ceiling, so a loud seed gives a calm tint in both modes (owner,
// 2026-11-01): 100 and its border 200 in light mode, 850 in dark mode. 900 keeps the ceiling it had while it carried the
// dark tint, so light mode, where it is brand's stripes and accent's hover, stays as it was. Step 300 is left alone: it
// is a foreground on dark Surfaces (links, focus, muted text), where the seed's full colour belongs. So is 800, which
// carries the brand Surface.
export const TINT_CEILING = Object.freeze({ 100: 0.03, 200: 0.06, 850: 0.06, 900: 0.06 });
// How far a band's background must stand from the page in the same mode. It is no text contrast: it asks only that
// a band still reads as a band. TARGETS put step 100 at 1.12 from white and step 850 at 13.5 against 975's 19.5, about
// 1.44, from the dark page, and hex rounding, the ceilings and a warm or cool grey bring the lowest legitimate bands to
// about 1.11 in light and 1.42 in dark. 1.1 lies just below the light value, so it passes every band the ramps solve and
// refuses one that is vanishing; in dark mode only a band far off its step comes near it.
export const BAND_MINIMUM = 1.1;
// The steps of a colour's ramp that carry a band: 100 the light bands in light mode and 850 in dark mode, 800 brand and
// 700 accent (surface.js).
export const BAND_STEPS = Object.freeze([100, 700, 800, 850]);
// On each scale, the steps where a seed too near a page is not anchored. The light scale keeps the steps and the pages it
// always had, 900 and grey 950 among them, which carried dark mode until 2026-11-11, so light mode stays as it was.
const GUARDED = Object.freeze({ light: [100, 700, 800, 900], dark: BAND_STEPS });

export function solveLightness(H, C, target, page = '#ffffff', factor = 1) {
  let lo = 0, hi = hexToOklch(page).L;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const ratio = contrast(oklchToHex(mid, fitChroma(mid, C, H) * factor, H), page);
    if (ratio > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Low-level tuning options preserve the generic ramp algorithm; they are not tool inputs. `pages` are the pages the light
// scale's anchor is guarded against, `darkPages` the dark scale's.
export function ramp(seedHex, options = {}) {
  const o = { chromaScale: 1, tint: 1, page: '#ffffff', pages: null, darkPages: null, chroma: null, hue: null, anchor: true, ceiling: {}, ...options };
  const seed = hexToOklch(seedHex);
  const H = o.hue ?? seed.H, C = o.chroma ?? seed.C * o.chromaScale;
  const out = STEPS.map((step, i) => {
    const f = step <= 300 ? o.tint : 1;
    const L = solveLightness(H, C, TARGETS[i], o.page, f);
    const c = Math.min(fitChroma(L, C, H) * f, o.ceiling[step] ?? Infinity);
    return { step, hex: oklchToHex(L, c, H), L, C: c, H, anchor: false };
  });
  if (o.anchor) {
    const at = (step) => out[STEPS.indexOf(step)];
    const exact = Math.abs(o.chromaScale - 1) < 1e-9;
    const c = exact ? seed.C : fitChroma(seed.L, seed.C * o.chromaScale, seed.H);
    const hex = exact ? rgbToHex(hexToRgb(seedHex)) : oklchToHex(seed.L, c, seed.H);
    const put = (step) => { out[STEPS.indexOf(step)] = { step, hex, L: seed.L, C: c, H: seed.H, anchor: true }; };
    // The nearest step in lightness on a scale; a tie keeps the lighter.
    const nearest = (scale) => scale.reduce((best, step) => (Math.abs(at(step).L - seed.L) < Math.abs(at(best).L - seed.L) ? step : best));
    // The seed must not erase a band: on a step that carries one, a seed too near a page is not anchored. The solved
    // step stays, and the seed still gives the ramp its hue and chroma.
    const erases = (step, scale, pages) => GUARDED[scale].includes(step) && pages.some((page) => contrast(hex, page) < BAND_MINIMUM);
    const light = nearest(SCALES.light);
    const anchored = !erases(light, 'light', o.pages ?? [o.page]);
    if (anchored) put(light);
    // Dark mode's own steps take the seed too where it lies nearest one of them on the dark scale, unless it already
    // stands on a step dark mode shares, which would give dark mode the seed twice.
    const dark = nearest(SCALES.dark);
    if (!SCALES.light.includes(dark) && !(anchored && SCALES.dark.includes(light)) && !erases(dark, 'dark', o.darkPages ?? [o.page])) put(dark);
    // 850 keeps its spacing from 800, 13.5 to 11: a seed that darkens 800 darkens 850 with it, so dark mode's plates
    // still stand apart from the brand band on 800 and from their hover fill on it.
    const brand = at(800), ratio = contrast(brand.hex, o.page), [eleven, plate] = [800, 850].map((step) => TARGETS[STEPS.indexOf(step)]);
    if (brand.anchor && !at(850).anchor && ratio > eleven) {
      const L = solveLightness(H, C, ratio * plate / eleven, o.page);
      const chroma = Math.min(fitChroma(L, C, H), o.ceiling[850] ?? Infinity);
      out[STEPS.indexOf(850)] = { step: 850, hex: oklchToHex(L, chroma, H), L, C: chroma, H, anchor: false };
    }
  }
  return out.map((s) => ({ ...s, 'on-page': contrast(s.hex, o.page), 'on-white': contrast(s.hex, '#ffffff') }));
}

// The Temperature slider at half its original strength (owner, 2026-11-05): every position stays a grey that
// cannot be mistaken for the Tint band.
export const grayChroma = (temperature) => Math.abs(temperature) / 100 * 0.01;

export function ramps(brandColors, temperature) {
  // A neutral midpoint, cooling towards blue or warming towards yellow independently of the brand.
  const gray = ramp('#808080', {
    chroma: grayChroma(temperature),
    hue: temperature < 0 ? 260 : 80,
    anchor: false,
  });
  const page = (step) => gray.find((s) => s.step === step).hex;
  const pages = ['#ffffff', page(950)], darkPages = ['#ffffff', page(975)];
  const entries = Object.entries(brandColors).map(([name, seed]) => [name, ramp(seed, { ceiling: TINT_CEILING, pages, darkPages })]);
  entries.push(['gray', gray]);
  return Object.fromEntries(entries.map(([name, values]) => [name,
    Object.fromEntries(values.map(({ step, hex }) => [step, hex])),
  ]));
}
