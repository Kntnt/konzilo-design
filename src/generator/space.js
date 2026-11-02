import { endpoints } from './fluid.js';

export const BASE_SPACE = Object.freeze([[6, 8], [10, 12], [14, 16], [20, 24], [28, 32], [32, 40], [36, 48], [40, 64]].map(Object.freeze));
export const SPACE_ROLES = Object.freeze({ 'component-gap': 3, 'column-gap': 6, band: 8, 'band-run': 5, plate: 6 });

export function spacing(profile) {
  const density = 0.5 + profile / 100;
  const steps = Object.fromEntries(BASE_SPACE.map(([a, b], i) => [i + 1, endpoints(Math.round(a * density), Math.round(b * density))]));
  return { steps, roles: Object.fromEntries(Object.entries(SPACE_ROLES).map(([name, step]) => [name, { ...steps[step] }])) };
}
