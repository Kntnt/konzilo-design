import { SYSTEM_MONOSPACE, SYSTEM_SANS, withDefaults } from './defaults.js';
import { windowReaching } from './type.js';
import { faceOf } from '../fonts/catalog.js';

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

// A role keeps only what its typeface has, as the tool has it when a typeface changes and `resolve` whenever it runs:
// its weight within the typeface's weight axis, the axes the typeface has within their ranges, and the sets of
// alternate letters it has. A typeface the library does not ship has no axes or sets the library knows, so a role on it
// keeps only its weight and letter spacing. An empty choice of sets stays, since it turns a typeface's tuning off. A
// role left with nothing goes, and `type.roles` with it. Changes `inputs` in place and returns what it changed, a line
// each.
export function fitRolesToFaces(inputs) {
  const roles = inputs.type?.roles;
  if (!roles) return [];
  const { typefaces, type } = withDefaults(inputs);
  const stacks = typefaceStacks(typefaces, type.label, type['heading-1-role']);
  const changes = [];
  for (const [role, settings] of Object.entries(roles)) {
    const stack = role === 'heading-1' ? stacks['heading-1'] ?? stacks.heading : stacks[role];
    const face = faceOf(stack);
    const name = face?.family ?? stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
    const lacks = face ? `${name} has no` : `${name} is not a typeface the library ships, so it has no known`;
    const inRange = (tag, value) => {
      const [min, , max] = face.axes[tag];
      const fitted = Math.min(max, Math.max(min, value));
      if (fitted !== value) changes.push(`${role}: ${tag === 'wght' ? 'weight' : tag} ${value} is outside ${name}'s ${min} to ${max}, so it is ${fitted}`);
      return fitted;
    };
    if (settings.weight !== undefined && face?.axes.wght) settings.weight = inRange('wght', settings.weight);
    if (settings.axes) {
      for (const [tag, value] of Object.entries(settings.axes)) {
        if (face?.axes[tag]) settings.axes[tag] = inRange(tag, value);
        else {
          delete settings.axes[tag];
          changes.push(`${role}: ${lacks} ${tag} axis, so its setting ${value} is left out`);
        }
      }
      if (!Object.keys(settings.axes).length) delete settings.axes;
    }
    if (settings.features?.length) {
      const lacking = settings.features.filter((set) => !face?.sets.some(([tag]) => tag === set));
      if (lacking.length) changes.push(`${role}: ${lacks} ${lacking.join(', ')}, so ${lacking.length === 1 ? 'it is' : 'they are'} left out`);
      settings.features = settings.features.filter((set) => !lacking.includes(set));
      if (!settings.features.length) delete settings.features;
    }
    if (!Object.keys(settings).length) delete roles[role];
  }
  if (!Object.keys(roles).length) delete inputs.type.roles;
  return changes;
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
