import { endpoints } from './fluid.js';

export const BASE_SPACE = Object.freeze([[6, 8], [10, 12], [14, 16], [20, 24], [28, 32], [32, 40], [36, 48], [40, 64]].map(Object.freeze));
// `band-run`, step 5, the smaller space of a run of bands on one background, is retired: two such bands share one band's
// space since 2026-11-25 (page.md, point 3), and nothing read it.
export const SPACE_ROLES = Object.freeze({ 'component-gap': 3, 'column-gap': 6, band: 8, plate: 4 });

export function spacing(profile) {
  const density = 0.5 + profile / 100;
  const steps = Object.fromEntries(BASE_SPACE.map(([a, b], i) => [i + 1, endpoints(Math.round(a * density), Math.round(b * density))]));
  return { steps, roles: Object.fromEntries(Object.entries(SPACE_ROLES).map(([name, step]) => [name, { ...steps[step] }])) };
}
