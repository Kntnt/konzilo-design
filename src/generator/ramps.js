import { hexToOklch, fitChroma, oklchToHex, contrast, rgbToHex, hexToRgb } from './color.js';

export const STEPS = Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
export const TARGETS = Object.freeze([1.12, 1.4, 2, 3.2, 4.8, 6, 8, 11, 16, 18.5]);
// The steps that carry tint backgrounds get a chroma ceiling, so a loud seed gives a calm tint in
// both modes (owner, 2026-11-01): 100 and its border 200 in light mode, 900 in dark mode. Step 300
// is left alone: it is a foreground on dark Surfaces (links, focus, muted text), where the seed's
// full colour belongs. So is 800, which carries the brand Surface.
export const TINT_CEILING = Object.freeze({ 100: 0.03, 200: 0.06, 900: 0.06 });

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
  const o = { chromaScale: 1, tint: 1, page: '#ffffff', chroma: null, hue: null, anchor: true, ceiling: {}, ...options };
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
    out[best] = { step: out[best].step, hex: exact ? rgbToHex(hexToRgb(seedHex)) : oklchToHex(seed.L, c, seed.H), L: seed.L, C: c, H: seed.H, anchor: true };
  }
  return out.map((s) => ({ ...s, 'on-page': contrast(s.hex, o.page), 'on-white': contrast(s.hex, '#ffffff') }));
}

export function ramps(brandColors, temperature) {
  const entries = Object.entries(brandColors).map(([name, seed]) => [name, ramp(seed, { ceiling: TINT_CEILING })]);
  // A neutral midpoint, cooling towards blue or warming towards yellow independently of the brand.
  entries.push(['gray', ramp('#808080', {
    chroma: Math.abs(temperature) / 100 * 0.02,
    hue: temperature < 0 ? 260 : 80,
    anchor: false,
  })]);
  return Object.fromEntries(entries.map(([name, values]) => [name,
    Object.fromEntries(values.map(({ step, hex }) => [step, hex])),
  ]));
}
