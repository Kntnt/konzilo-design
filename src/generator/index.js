import metadata from '../../package.json' with { type: 'json' };
import { defaultInputs, withDefaults } from './defaults.js';
import { validateInputs } from './validate.js';
import { ramps } from './ramps.js';
import { typeScale } from './type.js';
import { typefaceStacks, withTuning } from './typefaces.js';
import { spacing } from './space.js';
import { radii } from './shape.js';
import { fingerprint } from './fingerprint.js';
import { endpoints } from './fluid.js';
import { surfaces, contrastCheck } from './surface.js';

export { defaultInputs };
export * from './color.js';
export * from './ramps.js';
export * from './type.js';
export * from './typefaces.js';
export * from './space.js';
export * from './shape.js';
export * from './shadow.js';
export * from './fingerprint.js';
export * from './fluid.js';
export * from './validate.js';
export * from './surface.js';

// Live previews need no secure context or asynchronous fingerprinting.
export function derive(inputs) {
  validateInputs(inputs);
  const settings = withDefaults(inputs);
  const palette = ramps(settings['brand-colors'], settings['gray-temperature']);
  const contexts = surfaces(settings, palette);
  const typefaces = typefaceStacks(settings.typefaces, settings.type.label);
  return {
    ramps: palette,
    surfaces: contexts,
    type: withTuning(typeScale(settings.type), typefaces),
    typefaces,
    ...(settings.type['heading-1-color'] ? { 'heading-1-color': settings.type['heading-1-color'] } : {}),
    space: spacing(settings['density-profile']),
    radius: radii(settings['corner-profile']),
    shadow: { ...contexts.page.light.shadow },
    frame: { width: settings.frame.width, color: contexts.page.light['frame-color'] },
    layout: {
      wide: 1200,
      'side-margin': endpoints(16, 48),
      narrow: 720,
      'aside-min': 224,
      'content-area': 'min(calc(100% - 2 * var(--kn-layout-side-margin)), var(--kn-layout-wide))',
    },
    duration: { feedback: 180, movement: 240 },
    easing: { standard: 'cubic-bezier(0.2, 0, 0, 1)' },
    'generator-version': metadata.version,
    'contrast-check': contrastCheck(contexts),
  };
}

export async function resolve(inputs) {
  return { ...derive(inputs), 'inputs-fingerprint': await fingerprint(inputs) };
}
