// What a design's settings for the header, the footer and the page mean for this document's sample content.
import { icons } from '../../src/components/icons.js';
import { brandParts, footerBrand } from '../../src/components/brand.js';
import { footerFromDesign } from '../../src/components/footer.js';
import { menu, search, languages, cta } from './samples.js';

export function identityProps(settings, project) {
  const logo = project.logo || project['logo-dark'];
  const show = brandParts(settings.identity, !!logo);
  return {
    label: project.name,
    href: '#home',
    name: show.name ? project.name : undefined,
    slogan: project.slogan || undefined,
    logo: show.logo ? { light: logo, dark: project['logo-dark'] || logo } : undefined,
    brandAxis: settings['brand-axis'],
    sloganPlace: settings['slogan-place'],
  };
}
export function headerProps(settings, project) {
  const sticky = settings.attachment === 'sticky';
  const button = { word: { word: 'Menu' }, icon: { word: '', icon: 'menu' }, off: false }[settings['menu-button']];
  return {
    identity: identityProps(settings, project),
    arrangement: settings.arrangement,
    attachment: settings.attachment,
    start: sticky ? settings.start : 'below',
    autohide: sticky && settings.autohide,
    surface: settings.surface,
    menu,
    linkMenu: settings['link-menu'],
    menuButton: button,
    languages: settings.language ? languages : [],
    search: settings.search
      ? { ...search, links: settings['search-links'] ? search.links : undefined, surface: settings['search-surface'], blur: settings['search-blur'], heading: settings['search-heading'] }
      : undefined,
    cta: settings.cta ? cta : undefined,
    numbered: settings.numbered,
  };
}

// A page's first heading is its H1, and h1 says where that is. In the hero, the hero's heading is the <h1> and the next
// section's an <h2>. Under the hero, the hero's text is no heading at all, since a lower heading before the H1 reads as the
// wrong order, and the next section's heading is the <h1>. The component and the tool's live sample both follow these.
export const nextHeadingProps = (settings) => (settings.h1 === 'below' ? { level: 1, type: 'heading-1' } : { level: 2, type: 'heading-2' });

export function heroProps(settings, images) {
  const behind = settings.picture === 'behind';
  const side = behind || settings.picture === 'none' ? undefined : settings.picture;
  return {
    level: settings.h1 === 'below' ? false : 1,
    surface: behind ? `picture-${settings.overlay}` : settings.surface === 'none' ? undefined : settings.surface,
    picture: behind ? images.hero : side ? images.landscapes[0] : undefined,
    side,
    alt: side ? '' : undefined,
    type: settings.type,
    height: settings.height,
    place: settings.place,
    align: settings.align,
  };
}

const SOCIAL = [['LinkedIn', 'linkedin'], ['Facebook', 'facebook'], ['YouTube', 'youtube'], ['Spotify', 'spotify'], ['Email', 'mail'], ['RSS', 'rss']];
const social = `<ul class="kn-footer-social">${SOCIAL.map(([label, icon]) => `<li><a href="#${icon}" aria-label="${label}"><svg class="kn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">${icons[icon]}</svg></a></li>`).join('')}</ul>`;
// What stands in each cell of the sample footer. A site decides this for itself. The brand follows the header's settings.
export function footerContent(settings, project, header = {}) {
  return {
    upper: {
      a1: { content: footerBrand({ identity: header.identity, axis: header['brand-axis'], name: project.name, logo: { light: project.logo, dark: project['logo-dark'] }, surface: settings.upper.surface }) },
      b1: { content: social },
      a2: { text: 'Clear information and practical next steps, for anyone planning what comes next.' },
      b2: {
        links: [
          { label: 'Products', href: '#products' },
          { label: 'Services', href: '#services' },
          { label: 'Markets', href: '#markets' },
          { label: 'Technology', href: '#technology' },
          { label: 'Knowledge', href: '#knowledge' },
          { label: 'About', href: '#about' },
        ],
      },
    },
    lower: {
      a1: { text: '12 Example Street, 123 45 Sampleton' },
      b1: { text: 'Registration no. 000000-0000. Registered office: Sampleton.' },
      a2: { links: [{ label: 'Cookie policy', href: '#cookie-policy' }, { label: 'Privacy policy', href: '#privacy-policy' }] },
      b2: { links: [{ label: 'Change privacy settings', href: '#privacy-settings', consentOpen: true }, { label: 'Revoke consents', href: '#revoke-consents', consentOpen: true }] },
    },
  };
}
export const footerProps = (settings, project, header) => footerFromDesign(settings, footerContent(settings, project, header));
// The trail on the sample page. The first step is the site's name, or the word Home, or a house.
export const breadcrumbProps = (settings, project) => ({
  items: [
    { label: settings.home === 'name' ? project.name : 'Home', href: '#home' },
    { label: 'Services', href: '#services' },
    { label: 'Planning', href: '#planning' },
    { label: 'A clear next step' },
  ],
  separator: settings.separator,
  home: settings.home === 'icon' ? 'icon' : 'word',
  current: settings.current,
  narrow: settings.narrow,
});
export const pageProps = (settings) => ({
  shadow: settings.shadow,
  edgeLine: settings['edge-line'],
  fillLight: settings['fill-light'],
  fillDark: settings['fill-dark'],
});
