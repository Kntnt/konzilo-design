// The frame's content in the tool's preview and the presentation: a design's own menu and footer words where its
// `project` has them, and the sample's otherwise. What a design's settings mean is general, and stands in the
// library's design-props.js.
import { icons } from '../../src/components/icons.js';
import { escapeHtml } from '../../src/components/footer-html.js';
import { footerBrand, footerFromDesign, breadcrumbProps as trailProps, headerProps as frameHeaderProps, heroProps as pictureHeroProps, identityProps as frameIdentityProps } from '../../src/components/design-props.js';
import { menu as sampleMenu, footer as sampleFooter, search, languages, cta, anchor, SOCIAL_NETWORKS } from './samples.js';

export { nextHeadingProps, pageProps } from '../../src/components/design-props.js';

const HOME = '#home';
// The menu shown: the design's own, `project.menu`, where it has one, and the sample's otherwise. Every top item of its
// own stands in the link menu, as on a Konzilo site, and an item below the second level follows its own in order, since
// Header's children are one level, as menuProps does with a site's menu.
export function menuOf(project = {}) {
  if (!project.menu?.length) return sampleMenu;
  const link = ({ label, description }) => ({ label, href: anchor(label), ...(description && { description }) });
  const below = (items = []) => items.flatMap((item) => [link(item), ...below(item.items)]);
  return project.menu.map((item) => {
    const children = below(item.items);
    return { label: item.label, href: anchor(item.label), ...(children.length && { children }) };
  });
}
export const identityProps = (settings, project) => frameIdentityProps(settings, project, { href: HOME });
export const headerProps = (settings, project) => frameHeaderProps(settings, project, { menu: menuOf(project), search, languages, cta, home: HOME });
export const heroProps = (settings, images) => pictureHeroProps(settings, { behind: images.hero, side: images.landscapes[0] });

// A network with an icon in the library shows as its icon, and any other by its name.
const social = (names) => `<ul class="kn-footer-social">${names.map((name) => {
  const network = SOCIAL_NETWORKS.find((known) => known.name === name);
  return network
    ? `<li><a href="#${network.icon}" aria-label="${escapeHtml(name)}"><svg class="kn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">${icons[network.icon]}</svg></a></li>`
    : `<li><a href="${escapeHtml(anchor(name))}">${escapeHtml(name)}</a></li>`;
}).join('')}</ul>`;
// A text keeps its lines.
const text = (words) => (words.includes('\n') ? { content: `<p class="kn-footer-muted">${words.split('\n').map(escapeHtml).join('<br>')}</p>` } : { text: words });
const links = (labels, more = {}) => ({ links: labels.map((label) => ({ label, href: anchor(label), ...more })) });
const has = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));
// What stands in each cell of the footer shown: the design's own words, `project.footer`, cell by cell, and the sample's
// where it has none. The brand follows the header's settings, and the links for navigation are the top level of the
// menu shown, unless the design has links of its own there. A site decides all of this for itself.
export function footerContent(settings, project, header = {}) {
  const own = (band, cell) => project.footer?.[band]?.[cell];
  const either = (band, cell) => (has(own(band, cell)) ? own(band, cell) : sampleFooter[band][cell]);
  return {
    upper: {
      a1: { content: footerBrand({ identity: header.identity, axis: header['brand-axis'], name: project.name, logo: { light: project.logo, dark: project['logo-dark'] }, surface: settings.upper.surface }) },
      b1: { content: social(either('upper', 'b1')) },
      a2: text(either('upper', 'a2')),
      b2: has(own('upper', 'b2')) ? links(own('upper', 'b2')) : { links: menuOf(project).map(({ label, href }) => ({ label, href })) },
    },
    lower: {
      a1: text(either('lower', 'a1')),
      b1: text(either('lower', 'b1')),
      a2: links(either('lower', 'a2')),
      b2: links(either('lower', 'b2'), { consentOpen: true }),
    },
  };
}
export const footerProps = (settings, project, header) => footerFromDesign(settings, footerContent(settings, project, header));
// The trail on the sample page.
export const breadcrumbProps = (settings, project) => trailProps(settings, project, {
  home: HOME,
  trail: [
    { label: 'Services', href: '#services' },
    { label: 'Planning', href: '#planning' },
    { label: 'A clear next step' },
  ],
});
