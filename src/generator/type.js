import { endpoints } from './fluid.js';

const LABEL_RECIPES = {
  main: { weight: 600, 'letter-spacing': 0.06 },
  monospace: { weight: 500, 'letter-spacing': 0.04 },
};

// How far a window has come from the first breakpoint to the second. On one width the second takes over there.
export const windowShare = ({ breakpoints: { min, max } }, width) =>
  width >= max ? 1 : width <= min ? 0 : (width - min) / (max - min);

// A style's size in a window: the body size times the base to the power of the style's step. The body
// size and the base each follow a straight line between the breakpoints and stay fixed outside them.
export function sizeAt(scale, step, width) {
  const share = windowShare(scale, width);
  const between = ({ min, max }) => min + (max - min) * share;
  return Math.max(12, between(scale['body-size']) * between(scale.ratio) ** step);
}

// The first whole window where a style reaches a size it passes on the way between the breakpoints.
export function windowReaching(size, scale, step) {
  let { min: low, max: high } = scale.breakpoints;
  if (sizeAt(scale, step, low) >= size) return low;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (sizeAt(scale, step, middle) >= size) high = middle;
    else low = middle;
  }
  return high;
}

export function typeScale(type) {
  const { 'body-size': body, ratio, steps, label, breakpoints } = type;
  const indices = { body: 0, lead: steps.lead, small: -steps.small };
  let index = 0;
  for (const name of ['heading-6', 'heading-5', 'heading-4', 'heading-3', 'heading-2', 'heading-1', 'display']) {
    index += steps[name];
    indices[name] = index;
  }
  indices.label = -steps.label;
  indices.mono = 0;
  const px = (size) => Math.round(Math.max(12, size));
  const recipes = Object.fromEntries(Object.entries(indices).map(([name, n]) => {
    const heading = name === 'display' || name.startsWith('heading-');
    return [name, {
      size: endpoints(px(body.min * ratio.min ** n), px(body.max * ratio.max ** n), breakpoints.min, breakpoints.max),
      step: n,
      'line-height': name === 'display' ? 1.1 : heading ? 1.3 : name === 'lead' ? 1.4 : 1.55,
      weight: heading ? 600 : 400,
      'letter-spacing': heading ? -0.01 : 0,
    }];
  }));
  recipes.label = { ...recipes.label, 'line-height': 1.4, ...LABEL_RECIPES[label] };
  if (type['heading-1-role'] === 'display') recipes['heading-1']['line-height'] = recipes.display['line-height'];
  return recipes;
}
