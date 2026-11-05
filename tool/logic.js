import { sizeAt, windowShare } from '../src/generator/type.js';
import { REFERENCE } from '../src/generator/shadow.js';

export { sizeAt, windowShare };

export const scales = [
  [1.067, 'Minor second'],
  [1.125, 'Major second'],
  [1.2, 'Minor third'],
  [1.25, 'Major third'],
  [1.333, 'Perfect fourth'],
  [1.414, 'Augmented fourth'],
  [1.5, 'Perfect fifth'],
  [1.6, 'Minor sixth'],
  [1.618, 'Golden ratio'],
  [1.667, 'Major sixth'],
  [1.778, 'Minor seventh'],
  [1.875, 'Major seventh'],
  [2, 'Octave'],
];
export const chain = [
  'heading-6',
  'heading-5',
  'heading-4',
  'heading-3',
  'heading-2',
  'heading-1',
  'display',
];
export function absoluteSteps(steps) {
  let n = 0;
  const result = Object.fromEntries(
    chain.map((key) => [key, (n += steps[key])]),
  );
  return {
    ...result,
    lead: steps.lead,
    small: -steps.small,
    label: -steps.label,
    body: 0,
  };
}
export function relativeSteps(absolute) {
  let n = 0;
  const result = Object.fromEntries(
    chain.map((key) => {
      const delta = absolute[key] - n;
      n = absolute[key];
      return [key, delta];
    }),
  );
  return {
    ...result,
    lead: absolute.lead,
    small: -absolute.small,
    label: -absolute.label,
  };
}
export function stepLimits(steps, key) {
  if (!chain.includes(key)) return key === 'lead' ? [0, 12] : [-12, 0];
  const a = absoluteSteps(steps);
  const i = chain.indexOf(key);
  const prev = i ? a[chain[i - 1]] : 0;
  const next = i < chain.length - 1 ? a[chain[i + 1]] : Infinity;
  return [
    Math.max(prev, next === Infinity ? 0 : next - 12),
    Math.min(prev + 12, next),
  ];
}
export function changeStep(steps, key, value) {
  const [min, max] = stepLimits(steps, key);
  const a = absoluteSteps(steps);
  a[key] = Math.max(min, Math.min(max, Math.round(value)));
  return relativeSteps(a);
}
export function contrastError(report) {
  for (const [kind, modes] of Object.entries(report.matrix))
    for (const [mode, context] of Object.entries(modes))
      for (const [role, pair] of Object.entries(context.pairs))
        if (!pair.passed)
          return `${kind}, ${mode}: ${role} ${pair.ratio.toFixed(2)}:1; needs ${pair.target}:1.`;
  return report.status === 'passed' ? '' : 'Contrast check failed.';
}

export const ratioName = (value) =>
  scales.find(([n]) => Math.abs(n - value) < 0.0005)?.[1] ?? 'Custom';
// Two decimals at least, three at most: 1.25, 1.067.
export const ratioText = (value) => value.toFixed(3).replace(/(\.\d\d)0$/, '$1');

/* ---- The number line of the type scale. ---- */
export const LINE = { min: 320, max: 1920 };
// A drag moves several px of width per px of screen, so it catches at the widths people aim for.
export const COMMON_WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440, 1920];
export const lineShare = (width) => (width - LINE.min) / (LINE.max - LINE.min);
export const lineWidth = (share) => {
  const width = Math.round(LINE.min + Math.min(1, Math.max(0, share)) * (LINE.max - LINE.min));
  return COMMON_WIDTHS.find((common) => Math.abs(common - width) <= 6) ?? width;
};
// What was typed, with a decimal comma or a unit if so; NaN if it is no number.
export const typedNumber = (text) => {
  const clean = text.trim().replace(',', '.').replace(/\s*px$/i, '');
  return clean === '' ? NaN : Number(clean);
};
export const typedRatio = (text, fallback) => {
  const value = typedNumber(text);
  return Number.isNaN(value) ? fallback : Math.round(Math.min(2, Math.max(1, value)) * 1000) / 1000;
};
export const typedWidth = (text, low, high, fallback) => {
  const value = typedNumber(text);
  return Number.isNaN(value) ? fallback : Math.round(Math.min(high, Math.max(low, value)));
};
// The left breakpoint may reach the right one and no further, and the other way around.
export const breakpointLimits = ({ min, max }, end) => (end === 'min' ? [LINE.min, max] : [min, LINE.max]);
// Each label centred on its point; apart when they would touch, and inside the line's ends.
export function spreadLabels(a, b, width, total, gap = 8) {
  let left = a - width / 2;
  let right = b - width / 2;
  const short = left + width + gap - right;
  if (short > 0) {
    left -= short / 2;
    right += short / 2;
  }
  if (right > total - width) {
    right = total - width;
    left = Math.min(left, right - width - gap);
  }
  if (left < 0) {
    left = 0;
    right = Math.max(right, width + gap);
  }
  return [left, right];
}
// With one arrow moved only its own label goes, and stops short of the other, which keeps its place:
// nothing but what is in the hand moves. Any other time the two stand as spreadLabels has it.
export function placeLabels(before, a, b, width, total, gap = 8) {
  const same = before?.width === width && before?.total === total;
  if (same && before.a === a && before.b === b) return before;
  const centred = (at) => Math.min(total - width, Math.max(0, at - width / 2));
  let left;
  let right;
  if (same && before.b === b) {
    right = before.right;
    left = Math.min(centred(a), right - width - gap);
  } else if (same && before.a === a) {
    left = before.left;
    right = Math.max(centred(b), left + width + gap);
  } else {
    [left, right] = spreadLabels(a, b, width, total, gap);
  }
  return { a, b, width, total, left, right };
}

// A request sent as a page goes away may carry 64 KiB, and one logo can weigh more than that. So a
// logo the server already holds stays behind as a mark in its place, and the server puts it back.
export const KEPT_LOGO = 'kept';
const LOGOS = ['logo', 'logo-dark'];
export const logosOf = (project) => Object.fromEntries(LOGOS.map((key) => [key, project[key]]));
export function withoutSavedLogos(model, saved) {
  const project = { ...model.project };
  for (const key of LOGOS) if (project[key] && project[key] === saved[key]) project[key] = KEPT_LOGO;
  return { ...model, project };
}
export function withKeptLogos(incoming, held) {
  if (!incoming?.project) return incoming;
  const project = { ...incoming.project };
  for (const key of LOGOS) if (project[key] === KEPT_LOGO) project[key] = held[key];
  return { ...incoming, project };
}

// A camera's photo is far more than a page shows, and a presentation carries every picture it has.
export const PICTURE_MAX_SIDE = 2000;
export const pictureSize = (width, height) => {
  const scale = Math.min(1, PICTURE_MAX_SIDE / Math.max(width, height));
  return [Math.round(width * scale), Math.round(height * scale)];
};

// The divider between the controls and the preview. The controls' words and the preview's margins are
// in rem, so what they need grows with the reader's text size: `scale` is that size over the default.
// The frames' window widths and the divider are real pixels, whatever the text size.
export const DIVIDER = 9;
export const SNAP = 18;
const MIN_CONTROLS = 490;
const COMFORTABLE_CONTROLS = 540;
const MOBILE = 390;
const MOBILE_ALONE_MARGIN = 50;
const MIN_ALONE = 431;
const MIN_BOTH = 640;
export const clampControls = (width, view, windowWidth, scale = 1) =>
  Math.round(Math.max(
    MIN_CONTROLS * scale,
    Math.min(width, windowWidth - DIVIDER - (view === 'both' ? MIN_BOTH : MIN_ALONE) * scale),
  ));
// The controls get a comfortable measure; the preview gets the rest, up to real size.
export function optimalControls(view, windowWidth, desktopWidth, scale = 1) {
  const preview =
    view === 'phone'
      ? MOBILE + MOBILE_ALONE_MARGIN * scale
      : view === 'desktop'
        ? desktopWidth + 32 * scale
        : MOBILE + desktopWidth + 48 * scale;
  const wanted = windowWidth - DIVIDER - preview;
  return clampControls(
    view === 'phone' ? wanted : Math.max(COMFORTABLE_CONTROLS * scale, wanted),
    view,
    windowWidth,
    scale,
  );
}
export function dragControls(pointer, view, windowWidth, desktopWidth, scale = 1) {
  const optimal = optimalControls(view, windowWidth, desktopWidth, scale);
  const width = clampControls(Math.round(pointer), view, windowWidth, scale);
  const caught = Math.abs(width - optimal) <= SNAP;
  return { width: caught ? optimal : width, atOptimal: caught };
}

// Dragged up from off, Strength catches at the strength the tuned shadows are made for.
export const snapStrength = (value) => (Math.abs(value - REFERENCE.strength) <= 3 ? REFERENCE.strength : value);

// How much of what is set at one breakpoint reaches a window.
export const followShare = (end, width, scale) =>
  Math.round((end === 'narrow' ? 1 - windowShare(scale, width) : windowShare(scale, width)) * 100);
export const previewScale = (available, width, fit) =>
  fit ? Math.min(1, available / width) : 1;
// "Space and shape" does not fit the menu, and its last word says enough there.
export const shortChapter = (name) => {
  const word = name.split(/\s+(?:and|och|&)\s+/).at(-1);
  return word[0].toUpperCase() + word.slice(1);
};
