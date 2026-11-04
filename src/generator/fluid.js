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
