import { endpoints } from './fluid.js';

const LABEL_RECIPES = {
  main: { weight: 600, 'letter-spacing': 0.06 },
  monospace: { weight: 500, 'letter-spacing': 0.04 },
};

export function typeScale(type) {
  const { 'body-size': body, ratio, steps, label } = type;
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
      size: endpoints(px(body.min * ratio.min ** n), px(body.max * ratio.max ** n)),
      'line-height': name === 'display' ? 1.1 : heading ? 1.3 : name === 'lead' ? 1.4 : 1.55,
      weight: heading ? 600 : 400,
      'letter-spacing': heading ? -0.01 : 0,
    }];
  }));
  recipes.label = { ...recipes.label, 'line-height': 1.4, ...LABEL_RECIPES[label] };
  return recipes;
}
