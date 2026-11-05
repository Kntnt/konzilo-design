import { escapeHtml } from './footer-html.js';

// What of a brand shows, by a design's `header.identity`: `logo`, `name` or `both`. Without a logo there is the name.
export const brandParts = (identity, hasLogo) => ({ logo: hasLogo && identity !== 'name', name: !hasLogo || identity !== 'logo' });

// A band that is dark in both modes takes the dark logo, and one that follows the mode has both, for CSS to choose.
const DARK_SURFACES = ['brand', 'inverse'];

// The brand for a cell of a footer, following the header: give it as the cell's `content` to `footerFromDesign`
// or to Footer. `identity` and `axis` are the design's `header.identity` and `header.brand-axis`, `surface` the band's.
export function footerBrand({ identity = 'logo', axis = 'row', name, logo, surface }) {
  const light = logo?.light || logo?.dark;
  const dark = logo?.dark || logo?.light;
  const show = brandParts(identity, !!light);
  const image = (source, mode) => `<img ${mode ? `class="kn-footer-logo" data-kn-logo="${mode}" ` : ''}src="${escapeHtml(source)}" alt="${show.name ? '' : escapeHtml(name)}">`;
  const logos = DARK_SURFACES.includes(surface) ? image(dark) : light === dark ? image(light) : image(light, 'light') + image(dark, 'dark');
  return `<span class="kn-brand" data-kn-axis="${escapeHtml(axis)}">${show.logo ? `<span class="kn-brand-logo">${logos}</span>` : ''}${show.name ? `<span class="kn-brand-name"><span>${escapeHtml(name)}</span></span>` : ''}</span>`;
}
