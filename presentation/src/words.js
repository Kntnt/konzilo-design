import { resolved, inputs, copy, t, num } from './data.js';

export const families = [...new Set(Object.values(resolved.typefaces))];
export const typeOrder = [
  'display',
  'heading-1',
  'heading-2',
  'heading-3',
  'heading-4',
  'heading-5',
  'heading-6',
  'lead',
  'body',
  'small',
  'label',
];
export const px = (value) => t('value.px', { value: num(value) });
export const range = ({ min, max }) =>
  min === max ? px(min) : t('value.range', { min: num(min), max: num(max) });

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
    .map(([role]) => t(role))
    .join(', ');
}

export function chapterNumber(chapter) {
  return new Intl.NumberFormat(copy.lang, { minimumIntegerDigits: 2 }).format(
    Number(t(`${chapter}.number`)),
  );
}

export function words(page) {
  if (page.opener)
    return {
      title: t(`${page.chapter}.name`),
      text: t(`${page.chapter}.opener`),
    };
  if (page.id.startsWith('typeface-')) {
    const family = families[Number(page.id.slice(9))];
    const main = family === resolved.typefaces.main;
    return {
      title: t(main ? 'typeface-detail.main' : 'typeface-detail.other', {
        name: faceName(family),
      }),
      text: t('typeface-detail.text', { roles: rolesFor(family) }),
    };
  }
  const values = {};
  if (page.id === 'type-scale') {
    const scale = (ratio) =>
      t(copy[`scale.${ratio}`] ? `scale.${ratio}` : 'scale.custom', {
        ratio: num(ratio, 3),
      });
    values.narrow = scale(inputs.type.ratio.min);
    values.wide = scale(inputs.type.ratio.max);
  }
  if (page.id === 'spacing')
    values.density = t(
      inputs['density-profile'] < 35
        ? 'density.compact'
        : inputs['density-profile'] > 70
          ? 'density.loose'
          : 'density.balanced',
    );
  if (page.id === 'corners')
    values.corners = t(
      inputs['corner-profile'] === 0
        ? 'corners.square'
        : inputs['corner-profile'] < 60
          ? 'corners.discreet'
          : 'corners.round',
    );
  return { title: t(`${page.id}.title`), text: t(`${page.id}.text`, values) };
}
