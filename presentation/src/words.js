import { resolved, t, num } from './data.js';

export const typeOrder = [
  'display', 'heading-1', 'heading-2', 'heading-3', 'heading-4',
  'heading-5', 'heading-6', 'lead', 'body', 'small', 'label',
];
export const families = [...new Set(Object.values(resolved.typefaces))];
export const px = (value) => t('value.px', { value: num(value) });
export const range = ({ min, max }) => t('value.range', { min: num(min), max: num(max) });

export function faceName(family) {
  const first = family.split(',')[0].replaceAll('"', '').trim();
  if (first === 'system-ui') return t('font.system-sans');
  if (first === 'ui-monospace') return t('font.system-monospace');
  if (first === 'Georgia') return t('font.system-serif');
  return first;
}

export function rolesFor(family) {
  return Object.entries(resolved.typefaces)
    .filter(([, value]) => value === family)
    .map(([role]) => t(`role.${role}`))
    .join(', ');
}
