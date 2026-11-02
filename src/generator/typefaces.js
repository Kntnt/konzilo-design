import { SYSTEM_MONOSPACE, SYSTEM_SANS } from './defaults.js';
import { windowAt } from './fluid.js';

const GENERIC_LAST = /(?:^|,)\s*(?:serif|sans-serif|monospace|system-ui|ui-serif|ui-sans-serif|ui-monospace)\s*$/i;

// What a typeface needs whichever design uses it. Another typeface takes only another entry.
const TUNING = {
  'mona sans': { features: '"ss05", "ss07"', 'from-size': 20 },
};

// A named family may be missing on the visitor's device or never load, so every stack ends in
// a generic family. Headings follow the main family, and display text the headings, by default.
export function typefaceStacks({ main, monospace, heading, 'heading-1': firstHeading, display }, label) {
  const stack = (value, fallback) => GENERIC_LAST.test(value) ? value : `${value}, ${fallback}`;
  const stacks = { main: stack(main, SYSTEM_SANS), monospace: stack(monospace, SYSTEM_MONOSPACE) };
  stacks.heading = heading ? stack(heading, SYSTEM_SANS) : stacks.main;
  if (firstHeading) stacks['heading-1'] = stack(firstHeading, SYSTEM_SANS);
  stacks.display = display ? stack(display, SYSTEM_SANS) : stacks.heading;
  stacks.label = label === 'monospace' ? stacks.monospace : stacks.main;
  return stacks;
}

const familyOf = (stack) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
const stackOf = (style, typefaces) => style === 'display' ? typefaces.display
  : style === 'heading-1' && typefaces['heading-1'] ? typefaces['heading-1']
  : style.startsWith('heading-') ? typefaces.heading
  : style === 'mono' ? typefaces.monospace
  : style === 'label' ? typefaces.label
  : typefaces.main;

// A size that crosses the threshold takes the tuning from the window where it does.
export function withTuning(recipes, typefaces) {
  return Object.fromEntries(Object.entries(recipes).map(([style, recipe]) => {
    const tuning = TUNING[familyOf(stackOf(style, typefaces))];
    const { min, max } = recipe.size;
    if (!tuning || max < tuning['from-size']) return [style, recipe];
    const window = min >= tuning['from-size'] ? 0 : windowAt(tuning['from-size'], min, max);
    return [style, { ...recipe, features: { value: tuning.features, 'from-window': window } }];
  }));
}
