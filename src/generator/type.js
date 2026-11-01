import { endpoints } from './fluid.js';

export function typeScale(type) {
  const { 'body-size': body, ratio, steps } = type;
  const indices = { body: 0, lead: steps.lead, small: -steps.small };
  let index = 0;
  for (const name of ['heading-6', 'heading-5', 'heading-4', 'heading-3', 'heading-2', 'heading-1', 'display']) {
    index += steps[name];
    indices[name] = index;
  }
  indices.eyebrow = indices.small;
  indices.mono = 0;
  return Object.fromEntries(Object.entries(indices).map(([name, n]) => {
    const heading = name === 'display' || name.startsWith('heading-');
    const min = Math.round(Math.max(12, body.min * ratio.min ** n));
    const max = Math.round(Math.max(12, body.max * ratio.max ** n));
    return [name, {
      size: endpoints(min, max),
      'line-height': name === 'display' ? 1.1 : heading ? 1.3 : name === 'lead' ? 1.4 : 1.55,
      weight: heading ? 600 : 400,
      'letter-spacing': heading ? -0.01 : 0,
    }];
  }));
}
