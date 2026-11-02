export const number = (x, digits = 4) => String(Number(x.toFixed(digits)));
export const rem = (px) => `${number(px / 16)}rem`;

// Endpoints are px at the browser's default setting; the fluid window is 20–90rem.
export function fluid(min, max) {
  const slope = (max - min) / (1440 - 320);
  const intercept = (min - slope * 320) / 16;
  const sign = slope < 0 ? '-' : '+';
  return `clamp(${rem(Math.min(min, max))}, ${number(intercept)}rem ${sign} ${number(Math.abs(slope) * 100)}vw, ${rem(Math.max(min, max))})`;
}

// The window width, in px at the default setting, where a fluid size reaches the given size.
export const windowAt = (size, min, max) => Math.ceil(320 + (size - min) * (1440 - 320) / (max - min));

export const endpoints = (min, max) => ({ min, max, css: fluid(min, max) });
