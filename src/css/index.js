import { checkFingerprint } from '../generator/fingerprint.js';
import { validateDesignFile } from '../generator/validate.js';
import { rem } from '../generator/fluid.js';
import { checkContrast } from '../generator/surface.js';
import { surfaceCss } from './surface.js';

// This consumer reads the stored resolved values; it never resolves the inputs.
export async function emitCss(file) {
  await checkFingerprint(file);
  validateDesignFile(file);
  checkContrast(file.resolved);
  const r = file.resolved;
  const lines = [];
  const put = (name, value) => lines.push(`  --kn-${name}: ${value};`);
  for (const [name, value] of Object.entries(r.typefaces)) put(`typeface-${name}`, value);
  for (const [name, recipe] of Object.entries(r.type)) {
    put(`type-${name}-size`, recipe.size.css);
    put(`type-${name}-line-height`, recipe['line-height']);
    put(`type-${name}-weight`, recipe.weight);
    put(`type-${name}-letter-spacing`, `${recipe['letter-spacing']}em`);
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
  return `/* Konzilo framework core and checked Surface contexts. */
:root {
${lines.join('\n')}
}

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
`;
}
