import { checkFingerprint } from '../generator/fingerprint.js';
import { checkFormat, validateDesignFile } from '../generator/validate.js';
import { number, rem, stepStart } from '../generator/fluid.js';
import { checkContrast } from '../generator/surface.js';
import { surfaceCss } from './surface.js';

// This consumer reads the stored resolved values; it never resolves the inputs.
export async function emitCss(file) {
  checkFormat(file);
  await checkFingerprint(file);
  validateDesignFile(file);
  checkContrast(file.resolved);
  return coreCss(file.resolved);
}

// Each size as the owner's formula: body size times the base to the power of its step, where the base and the
// body size follow a straight line between the breakpoints. A browser without pow() or atan2() keeps the clamp().
function scaleCurve(r) {
  if (!r['type-scale']) return '';
  const { breakpoints: { min, max }, ratio, 'body-size': body } = r['type-scale'];
  const start = stepStart(min, max);
  const sizes = Object.entries(r.type).filter(([name]) => name !== 'body').map(([name, { step }]) => {
    const size = step ? `calc(var(--kn-type-body-size) * pow(var(--kn-type-base), ${step}))` : 'var(--kn-type-body-size)';
    return `  --kn-type-${name}-size: ${step < 0 ? `max(0.75rem, ${size})` : size};`;
  });
  return `@supports (width: calc(1rem * pow(tan(atan2(100vw, 1rem)), 2))) {
:root {
  --kn-type-window: clamp(0, (tan(atan2(100vw, 1rem)) - ${number(start / 16)}) / ${number((max - start) / 16)}, 1);
  --kn-type-base: calc(${ratio.min} + ${number(ratio.max - ratio.min)} * var(--kn-type-window));
  --kn-type-body-size: calc(${rem(body.min)} + ${rem(body.max - body.min)} * var(--kn-type-window));
${sizes.join('\n')}
}
}
`;
}

// Synchronous output for freshly derived, in-memory preview values.
export function coreCss(r) {
  const lines = [];
  const put = (name, value) => lines.push(`  --kn-${name}: ${value};`);
  // Each role points at the one it follows, so a site can move a whole chain with one line.
  const { main, monospace, heading, display, label } = r.typefaces;
  put('typeface-main', main);
  put('typeface-monospace', monospace);
  put('typeface-heading', heading === main ? 'var(--kn-typeface-main)' : heading);
  put('typeface-heading-1', r.typefaces['heading-1'] && r.typefaces['heading-1'] !== heading ? r.typefaces['heading-1'] : 'var(--kn-typeface-heading)');
  put('typeface-display', display === heading ? 'var(--kn-typeface-heading)' : display);
  put('typeface-label', label === main ? 'var(--kn-typeface-main)' : label === monospace ? 'var(--kn-typeface-monospace)' : label);
  for (const [name, recipe] of Object.entries(r.type)) {
    put(`type-${name}-size`, recipe.size.css);
    put(`type-${name}-line-height`, recipe['line-height']);
    put(`type-${name}-weight`, recipe.weight);
    put(`type-${name}-letter-spacing`, `${recipe['letter-spacing']}em`);
    put(`type-${name}-features`, recipe.features?.['from-window'] === 0 ? recipe.features.value : 'normal');
    if (recipe.stretch !== undefined) put(`type-${name}-stretch`, `${recipe.stretch}%`);
    if (recipe.variation) put(`type-${name}-variation`, Object.entries(recipe.variation).map(([axis, value]) => `"${axis}" ${value}`).join(', '));
  }
  for (const [name, value] of Object.entries(r.space.steps)) put(`space-${name}`, value.css);
  for (const [name, value] of Object.entries(r.space.roles)) put(`space-${name}`, value.css);
  for (const [name, value] of Object.entries(r.radius)) put(`radius-${name}`, rem(value));
  for (const [name, value] of Object.entries(r.shadow)) put(`shadow-${name}`, value);
  put('frame-width', `${r.frame.width}px`);
  put('frame-color', r.frame.color);
  for (const [name, value] of Object.entries(r.layout)) {
    put(`layout-${name}`, name === 'side-margin' ? value.css : name === 'content-area' ? value : rem(value));
  }
  for (const [name, value] of Object.entries(r.duration)) put(`duration-${name}`, `${value}ms`);
  put('easing-standard', r.easing.standard);
  // Literals, for a consumer that cannot read light-dark(): the primary seed exactly, and the page in light mode.
  put('theme-primary', r.theme.primary);
  put('theme-base', r.theme.base);
  const staged = Object.entries(r.type).filter(([, { features }]) => features?.['from-window'] > 0)
    .map(([name, { features }]) => `@media (min-width: ${rem(features['from-window'])}) {\n  :root { --kn-type-${name}-features: ${features.value}; }\n}\n`).join('');
  return `/* Konzilo framework core and checked Surface contexts. */
@layer kn-core, kn-base, kn-components;
@layer kn-core {
:root {
${lines.join('\n')}
}
${scaleCurve(r)}${staged}
/* Declared on each Surface, so a site's own first-heading colour can read that Surface's roles. */
[data-kn-surface] { --kn-text-heading-1: var(--kn-${r['heading-1-color'] === 'accent' ? 'accent' : 'text'}); }

${surfaceCss(r.surfaces)}

/* Use in a full-width band or a centred Narrow/Wide parent. Logical margins support RTL.
   A Reading Area will handle occupied Aside rows and Sidenotes in the component stage. */
[data-kn-width] {
  box-sizing: border-box;
  min-inline-size: 0;
  max-inline-size: none;
}
[data-kn-width="narrow"] {
  inline-size: min(100%, var(--kn-layout-narrow));
  margin-inline: auto;
}
[data-kn-width="wide"] {
  inline-size: min(calc(100vw - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide));
  margin-inline: calc((100% - min(calc(100vw - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide))) / 2);
}
[data-kn-width="full"] {
  inline-size: 100vw;
  margin-inline: calc((100% - 100vw) / 2);
}
[data-kn-width="bleed-start"] {
  inline-size: calc((100vw + min(calc(100vw - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide))) / 2);
  margin-inline-start: calc((100% - 100vw) / 2);
  margin-inline-end: calc((100% - min(calc(100vw - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide))) / 2);
}
[data-kn-width="bleed-end"] {
  inline-size: calc((100vw + min(calc(100vw - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide))) / 2);
  margin-inline-start: calc((100% - min(calc(100vw - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide))) / 2);
  margin-inline-end: calc((100% - 100vw) / 2);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --kn-duration-feedback: 0ms;
    --kn-duration-movement: 0ms;
  }
}
}
`;
}
