export const number = (x, digits = 4) => String(Number(x.toFixed(digits)));
export const rem = (px) => `${number(px / 16)}rem`;

// The first of two breakpoints on one width lies a pixel below it, so that width is where the step ends.
export const stepStart = (from, to) => Math.min(from, to - 1);

// Endpoints and window are px at the browser's default setting; by default the fluid window is 20–90rem.
export function fluid(min, max, from = 320, to = 1440) {
  const start = stepStart(from, to);
  const slope = (max - min) / (to - start);
  const intercept = (min - slope * start) / 16;
  const sign = slope < 0 ? '-' : '+';
  return `clamp(${rem(Math.min(min, max))}, ${number(intercept)}rem ${sign} ${number(Math.abs(slope) * 100)}vw, ${rem(Math.max(min, max))})`;
}

export const endpoints = (min, max, from, to) => ({ min, max, css: fluid(min, max, from, to) });

/**
 * The owner's type scale, which the generated CSS writes with pow() (css/index.js, scaleCurve()): between the windows
 * `from` and `to`, in rem, the body size and the base each a straight line of the window, and a size the body size times
 * the base to the power of its step, never under 0.75rem for a step below the body's.
 * @param {object} scale The resolved design's `type-scale`, `{ breakpoints, ratio, 'body-size' }`, each `{ min, max }`, in
 *   px.
 * @returns {{ from: number, to: number, size: (step: number, v: number) => number }} `size` in rem at a window `v` rem
 *   wide.
 */
export function typeScaleCurve({ breakpoints: { min, max }, ratio, 'body-size': body }) {
  const [from, to] = [stepStart(min, max) / 16, max / 16];
  const share = (v) => Math.min(1, Math.max(0, (v - from) / (to - from)));
  const size = (step, v) => {
    const at = share(v);
    const value = (body.min + (body.max - body.min) * at) / 16 * (ratio.min + (ratio.max - ratio.min) * at) ** step;
    return step < 0 ? Math.max(0.75, value) : value;
  };
  return { from, to, size };
}
