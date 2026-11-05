import { hexToOklch, fitChroma, oklchToHex, contrast, rgbToHex, hexToRgb } from './color.js';

export const STEPS = Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
export const TARGETS = Object.freeze([1.12, 1.4, 2, 3.2, 4.8, 6, 8, 11, 16, 18.5]);
// The steps that carry tint backgrounds get a chroma ceiling, so a loud seed gives a calm tint in
// both modes (owner, 2026-11-01): 100 and its border 200 in light mode, 900 in dark mode. Step 300
// is left alone: it is a foreground on dark Surfaces (links, focus, muted text), where the seed's
// full colour belongs. So is 800, which carries the brand Surface.
export const TINT_CEILING = Object.freeze({ 100: 0.03, 200: 0.06, 900: 0.06 });
// How far a band's background must stand from the page in the same mode. It is no text contrast: it asks only that
// a band still reads as a band. TARGETS put step 100 at 1.12 from white and step 900 at 16 against 18.5, about 1.16,
// from the dark page, and hex rounding, the ceilings and a warm or cool grey bring the lowest legitimate bands to about
// 1.11 in light and 1.15 in dark. 1.1 lies just below those, so it passes every band the ramps solve and refuses one that is vanishing.
export const BAND_MINIMUM = 1.1;
// The steps of a colour's ramp that carry a band: 100 and 900 the light bands, 800 brand and 700 accent (surface.js).
export const BAND_STEPS = Object.freeze([100, 700, 800, 900]);

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

// Low-level tuning options preserve the generic ramp algorithm; they are not tool inputs.
export function ramp(seedHex, options = {}) {
  const o = { chromaScale: 1, tint: 1, page: '#ffffff', pages: null, chroma: null, hue: null, anchor: true, ceiling: {}, ...options };
  const seed = hexToOklch(seedHex);
  const H = o.hue ?? seed.H, C = o.chroma ?? seed.C * o.chromaScale;
  const out = STEPS.map((step, i) => {
    const f = step <= 300 ? o.tint : 1;
    const L = solveLightness(H, C, TARGETS[i], o.page, f);
    const c = Math.min(fitChroma(L, C, H) * f, o.ceiling[step] ?? Infinity);
    return { step, hex: oklchToHex(L, c, H), L, C: c, H, anchor: false };
  });
  if (o.anchor) {
    let best = 0;
    out.forEach((s, i) => { if (Math.abs(s.L - seed.L) < Math.abs(out[best].L - seed.L)) best = i; });
    const exact = Math.abs(o.chromaScale - 1) < 1e-9;
    const c = exact ? seed.C : fitChroma(seed.L, seed.C * o.chromaScale, seed.H);
    const hex = exact ? rgbToHex(hexToRgb(seedHex)) : oklchToHex(seed.L, c, seed.H);
    // The seed must not erase a band: on a step that carries one, a seed too near a page is not anchored. The solved
    // step stays, and the seed still gives the ramp its hue and chroma.
    const erases = BAND_STEPS.includes(out[best].step) && (o.pages ?? [o.page]).some((page) => contrast(hex, page) < BAND_MINIMUM);
    if (!erases) out[best] = { step: out[best].step, hex, L: seed.L, C: c, H: seed.H, anchor: true };
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
  const pages = ['#ffffff', gray.find(({ step }) => step === 950).hex];
  const entries = Object.entries(brandColors).map(([name, seed]) => [name, ramp(seed, { ceiling: TINT_CEILING, pages })]);
  entries.push(['gray', gray]);
  return Object.fromEntries(entries.map(([name, values]) => [name,
    Object.fromEntries(values.map(({ step, hex }) => [step, hex])),
  ]));
}
