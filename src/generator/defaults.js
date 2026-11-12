export const SYSTEM_SANS = 'system-ui, sans-serif';
export const SYSTEM_MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
// The serif the tool offers among a computer's own typefaces.
export const SYSTEM_SERIF = 'Georgia, serif';

const defaults = {
  'brand-colors': { primary: '#168b83' },
  'gray-temperature': 0,
  typefaces: { main: SYSTEM_SANS, monospace: SYSTEM_MONOSPACE },
  type: {
    'body-size': { min: 17, max: 19 },
    ratio: { min: 1.067, max: 1.125 },
    breakpoints: { min: 390, max: 1440 },
    steps: { 'heading-6': 0, 'heading-5': 1, 'heading-4': 1, 'heading-3': 1, 'heading-2': 1, 'heading-1': 3, display: 3, lead: 1, small: 2, label: 3 },
    label: 'main',
  },
  shadow: { strength: 0, hardness: 30, angle: 0, elevation: 50, color: 'default', targets: { box: true, header: true, panel: true, page: true } },
  frame: { width: 0, color: 'default' },
  layout: { wide: 1200, narrow: 720 },
  header: {
    arrangement: 'A', attachment: 'sticky', start: 'below', autohide: false, surface: 'page', translucent: false,
    identity: 'logo', 'brand-axis': 'row', 'slogan-place': 'beside',
    'link-menu': true, 'menu-button': 'word', language: false, search: true, cta: true,
    numbered: false, 'menu-above': false, 'menu-below': false,
    'search-surface': 'inverse', 'search-blur': true, 'search-heading': true, 'search-links': true,
    'search-close': true, 'search-placeholder': 'word',
  },
  footer: {
    attachment: 'flow', fill: 'column', 'b-align': 'start',
    upper: { surface: 'brand', cells: { a1: true, b1: true, a2: true, b2: true } },
    lower: { surface: 'inverse', cells: { a1: true, b1: true, a2: true, b2: true } },
    'horizontal-rules': false, 'vertical-rule': false, 'rule-extent': 'content',
  },
  page: { shadow: false, 'edge-line': false },
  breadcrumbs: { show: true, separator: 'slash', home: 'word', current: true, narrow: 'trail' },
  hero: { picture: 'behind', surface: 'none', overlay: 'dark', height: 'two-thirds', place: 'bottom', align: 'start', type: 'heading-1', h1: 'hero' },
  tabs: { 'rule-place': 'below' },
  'corner-profile': 25,
  'density-profile': 75,
};

export const defaultInputs = () => structuredClone(defaults);

// Each group contains only schema-validated properties; missing leaves receive defaults.
export function withDefaults(inputs) {
  const merge = (base, supplied) => Object.fromEntries(Object.keys({ ...base, ...supplied }).map((key) => {
    const value = supplied[key];
    return [key, value === undefined ? structuredClone(base[key])
      : value !== null && typeof value === 'object' && !Array.isArray(value) ? merge(base[key] ?? {}, value) : value];
  }));
  return merge(defaults, inputs);
}
