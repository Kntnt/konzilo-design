import { SYSTEM_MONOSPACE, SYSTEM_SANS } from './defaults.js';
import { windowReaching } from './type.js';

const GENERIC_LAST = /(?:^|,)\s*(?:serif|sans-serif|monospace|system-ui|ui-serif|ui-sans-serif|ui-monospace)\s*$/i;

// What a typeface needs whichever design uses it. Another typeface takes only another entry.
const TUNING = {
  'mona sans': { features: '"ss05", "ss07"', 'from-size': 20 },
};

// A named family may be missing on the visitor's device or never load, so every stack ends in
// a generic family. Headings follow the main family, and display text the headings, by default.
export function typefaceStacks({ main, monospace, heading, 'heading-1': firstHeading, display, label: labelFace }, label, firstHeadingRole) {
  const stack = (value, fallback) => GENERIC_LAST.test(value) ? value : `${value}, ${fallback}`;
  const stacks = { main: stack(main, SYSTEM_SANS), monospace: stack(monospace, SYSTEM_MONOSPACE) };
  stacks.heading = heading ? stack(heading, SYSTEM_SANS) : stacks.main;
  if (firstHeading) stacks['heading-1'] = stack(firstHeading, SYSTEM_SANS);
  stacks.display = display ? stack(display, SYSTEM_SANS) : stacks.heading;
  if (!firstHeading && firstHeadingRole === 'display') stacks['heading-1'] = stacks.display;
  stacks.label = labelFace ? stack(labelFace, SYSTEM_SANS) : label === 'monospace' ? stacks.monospace : stacks.main;
  return stacks;
}

const familyOf = (stack) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
const stackOf = (style, typefaces) => style === 'display' ? typefaces.display
  : style === 'heading-1' && typefaces['heading-1'] ? typefaces['heading-1']
  : style.startsWith('heading-') ? typefaces.heading
  : style === 'mono' ? typefaces.monospace
  : style === 'label' ? typefaces.label
  : typefaces.main;

const ROLE_OF_STYLE = {
  body: 'main', lead: 'main', small: 'main', mono: 'monospace', display: 'display', label: 'label',
  'heading-2': 'heading', 'heading-3': 'heading', 'heading-4': 'heading', 'heading-5': 'heading', 'heading-6': 'heading',
};

// A first heading starts from the role it follows, and what is set for it alone goes on top.
function firstHeadingSettings(type) {
  const { roles = {} } = type;
  const base = (type['heading-1-role'] === 'display' ? roles.display : roles.heading) ?? {};
  const own = roles['heading-1'] ?? {};
  return { ...base, ...own, axes: { ...base.axes, ...own.axes } };
}

// What a design sets for a role: weight and spacing replace the style's, width becomes `stretch`, and
// every other axis goes in `variation`. Without a setting the recipe stays exactly as it was.
function withSettings(recipe, { weight, 'letter-spacing': spacing, axes = {}, features } = {}) {
  const { wght, wdth, ...others } = axes;
  const result = { ...recipe };
  const chosenWeight = weight ?? wght;
  if (chosenWeight !== undefined) result.weight = chosenWeight;
  if (spacing !== undefined) result['letter-spacing'] = spacing;
  if (wdth !== undefined) result.stretch = wdth;
  if (Object.keys(others).length) result.variation = others;
  if (features?.length) result.features = { value: features.map((tag) => `"${tag}"`).join(', '), 'from-window': 0 };
  return result;
}

// A size that crosses the threshold takes the tuning from the window where it does. Features chosen for
// a role replace the tuning, and an empty choice turns it off.
export function withTuning(recipes, typefaces, type) {
  return Object.fromEntries(Object.entries(recipes).map(([style, plain]) => {
    const settings = style === 'heading-1' ? firstHeadingSettings(type) : type.roles?.[ROLE_OF_STYLE[style]];
    const recipe = withSettings(plain, settings);
    const tuning = TUNING[familyOf(stackOf(style, typefaces))];
    const { min, max } = recipe.size;
    if (!tuning || settings?.features !== undefined || max < tuning['from-size']) return [style, recipe];
    const window = min >= tuning['from-size'] ? 0 : windowReaching(tuning['from-size'], type, recipe.step);
    return [style, { ...recipe, features: { value: tuning.features, 'from-window': window } }];
  }));
}
