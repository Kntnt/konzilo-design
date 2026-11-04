// What a design's settings for the header, the footer and the page mean for this document's sample content.
import { footerBands } from '../../src/components/footer-models.js';
import { menu, search, languages, cta } from './samples.js';
import { heroHasRoom } from './catalog.js';

export function identityProps(settings, project) {
  const logo = project.logo || project['logo-dark'];
  const showLogo = logo && settings.identity !== 'name';
  return {
    label: project.name,
    href: '#home',
    name: !logo || settings.identity !== 'logo' ? project.name : undefined,
    slogan: project.slogan || undefined,
    logo: showLogo ? { light: logo, dark: project['logo-dark'] || logo } : undefined,
    brandAxis: settings['brand-axis'],
    brandAlign: settings['brand-align'],
    axis: settings['identity-axis'],
    align: settings['identity-align'],
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

export function heroProps(settings, images) {
  const behind = settings.picture === 'behind';
  const beside = settings.picture === 'beside';
  return {
    surface: behind ? `picture-${settings.overlay}` : settings.surface === 'none' ? undefined : settings.surface,
    picture: behind ? images.hero : beside ? images.landscapes[0] : undefined,
    alt: beside ? '' : undefined,
    type: settings.type,
    height: settings.height,
    place: heroHasRoom(settings.height) ? settings.place : 'center',
  };
}

const DARK_SURFACES = ['brand', 'inverse'];
export function footerContent(settings, project) {
  const logo = DARK_SURFACES.includes(settings.surface) ? project['logo-dark'] || project.logo : project.logo || project['logo-dark'];
  const name = project.name.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return {
    identity: logo ? `<img src="${logo.replaceAll('"', '&quot;')}" alt="${name}" style="max-width:14rem;max-height:3rem">` : `<p data-kn-type="heading-3">${name}</p>`,
    about: 'Clear information. Practical next steps.',
    explore: {
      heading: 'Explore',
      links: [
        { label: 'Services', href: '#services' },
        { label: 'Resources', href: '#resources' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ],
    },
    contact: { heading: 'Contact the team', text: 'Ask about planning, delivery or ongoing support.', links: [{ label: 'Start a conversation', href: '#contact' }] },
    statement: 'A clear next step is never far away',
    legal: 'Clear information. Practical next steps.',
    legalLinks: [
      { label: 'Privacy', href: '#privacy' },
      { label: 'Cookie choices', href: '#cookies', consentOpen: true },
    ],
  };
}
export const footerProps = (settings, project) => ({
  bands: footerBands(settings, footerContent(settings, project)),
  attachment: settings.attachment,
  rules: settings['rule-extent'],
});
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
