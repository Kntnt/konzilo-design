import { icons } from '../components/icons.js';

const attribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// An Icon's markup as a string, exactly as Icon.astro writes a decorative one, for a site that writes HTML at build.
export function iconHtml(name, className) {
  if (!Object.hasOwn(icons, name)) throw new TypeError(`Unknown icon: ${name}`);
  const classes = ['kn-icon', ...String(className ?? '').split(/\s+/).filter(Boolean)].join(' ');
  return `<svg class="${attribute(classes)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}
