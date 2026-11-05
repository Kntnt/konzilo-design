// The sample's content for the frame. What a design's settings mean is general, and stands in the library's design-props.js.
import { icons } from '../../src/components/icons.js';
import { footerBrand, footerFromDesign, breadcrumbProps as trailProps, headerProps as frameHeaderProps, heroProps as pictureHeroProps, identityProps as frameIdentityProps } from '../../src/components/design-props.js';
import { menu, search, languages, cta } from './samples.js';

export { nextHeadingProps, pageProps } from '../../src/components/design-props.js';

const HOME = '#home';
export const identityProps = (settings, project) => frameIdentityProps(settings, project, { href: HOME });
export const headerProps = (settings, project) => frameHeaderProps(settings, project, { menu, search, languages, cta, home: HOME });
export const heroProps = (settings, images) => pictureHeroProps(settings, { behind: images.hero, side: images.landscapes[0] });

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
// The trail on the sample page.
export const breadcrumbProps = (settings, project) => trailProps(settings, project, {
  home: HOME,
  trail: [
    { label: 'Services', href: '#services' },
    { label: 'Planning', href: '#planning' },
    { label: 'A clear next step' },
  ],
});
