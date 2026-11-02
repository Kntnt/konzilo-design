import { defaultInputs } from '../src/generator/defaults.js';
export const scales = [
  [1.067, 'Minor second'],
  [1.125, 'Major second'],
  [1.2, 'Minor third'],
  [1.25, 'Major third'],
  [1.333, 'Perfect fourth'],
  [1.414, 'Augmented fourth'],
  [1.5, 'Perfect fifth'],
  [1.618, 'Golden ratio'],
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
export function ratioOptions(value) {
  return scales.some(([n]) => n === value)
    ? scales
    : [...scales, [value, `Custom (${value})`]];
}
export function preset(name, inputs) {
  const next = structuredClone(inputs);
  next.typefaces = {
    main: 'Mona Sans',
    monospace: defaultInputs().typefaces.monospace,
  };
  next.type.label = 'main';
  next.type['heading-1-color'] = 'text';
  if (name === 'mono') {
    next.type.label = 'monospace';
    next.typefaces.monospace = 'Red Hat Mono';
  }
  if (name === 'serif') {
    next.typefaces.main = 'Georgia, serif';
    next.typefaces.heading = 'Mona Sans';
  }
  if (name === 'display') next.typefaces.display = 'Georgia, serif';
  return next;
}
export function contrastError(report) {
  for (const [kind, modes] of Object.entries(report.matrix))
    for (const [mode, context] of Object.entries(modes))
      for (const [role, pair] of Object.entries(context.pairs))
        if (!pair.passed)
          return `${kind}, ${mode}: ${role} ${pair.ratio.toFixed(2)}:1; needs ${pair.target}:1.`;
  return report.status === 'passed' ? '' : 'Contrast check failed.';
}
