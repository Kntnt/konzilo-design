// What a design's settings mean for the frame's components, given a site's own content: `resolved.header`,
// `.footer`, `.page`, `.breadcrumbs` and `.hero` of a design file, and its `project`, into the props of Header,
// Footer, Page, Breadcrumbs and Hero. A setting that is off leaves out what the site gave for it.
import { brandParts, footerBrand } from './brand.js';
import { footerFromDesign } from './footer.js';

export { footerBrand, footerFromDesign };
// The page's context, which the design's directive components and presentations read (docs/spec/konzilo.md).
export { designPage } from '../directives/render/context.js';

const LOGO_TYPES = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/avif': 'avif' };

// A logo's extension, from a design file's `project.logo` or `project['logo-dark']`: the type of a data URI, or a path's own.
export function logoExtension(logo) {
  const type = /^data:([^;,]*)/i.exec(logo)?.[1].toLowerCase();
  const extension = type === undefined ? /\.([a-z0-9]+)$/i.exec(logo)?.[1].toLowerCase() : LOGO_TYPES[type];
  if (!extension) throw new Error(`A logo must be a data URI of an image or a path to one, not ${logo.slice(0, 40)}.`);
  return extension;
}

// Where a site serves its design's logos: `konzilo-design logos` writes them, for a site whose content security policy
// refuses an image at a data: address. `base` is the site's base and `folder` the logos' folder below it, for a site that
// keeps them elsewhere than in public/logos. Give the result as `logos` to `identityProps` or `headerProps`, or as `logo`
// to `footerBrand`.
export function logoAddresses(project, { base = '/', folder = 'logos' } = {}) {
  const start = `${base.replace(/\/$/, '')}/${folder.replace(/^\/|\/$/g, '')}`;
  const address = (key) => (project[key] ? `${start}/${key}.${logoExtension(project[key])}` : undefined);
  return { light: address('logo'), dark: address('logo-dark') };
}

// `href` is where the brand leads, the site's start page. `logos` is the addresses the logos are served at, as
// `logoAddresses` gives them; without it they are what the design file holds, as in the tool and the presentation.
export function identityProps(settings, project, { href = '/', logos } = {}) {
  const dark = logos ? logos.dark : project['logo-dark'];
  const logo = (logos ? logos.light : project.logo) || dark;
  const show = brandParts(settings.identity, !!logo);
  return {
    label: project.name,
    href,
    name: show.name ? project.name : undefined,
    slogan: project.slogan || undefined,
    logo: show.logo ? { light: logo, dark: dark || logo } : undefined,
    brandAxis: settings['brand-axis'],
    sloganPlace: settings['slogan-place'],
  };
}

// A menu as plain data, entries of `{ title, url, items }` as the Konzilo core gives them, in the shape Header takes.
// `current` is the page's address, Astro.url.pathname, for the data has no mark of its own, and `base` the site's base, which
// an address on the site starts at, so that it stays in a preview. `linkMenu(entry, index)` says which top entries stand in
// the link menu, all by default, and an entry with no address, which only holds others, never does. Header's children are one
// level, so lower entries follow theirs in order, and one with no address gives way to the entries it holds.
export function menuProps(entries = [], { current, base = '/', linkMenu } = {}) {
  const start = base.endsWith('/') ? base : `${base}/`;
  const based = (url) => (url.startsWith('/') && !url.startsWith('//') ? `${start}${url.slice(1)}` : url);
  const bare = (address) => String(address).replace(/\/+$/, '');
  const link = ({ title, url }) => {
    const href = url ? based(url) : undefined;
    return { label: title, ...(href ? { href } : {}), ...(href && current !== undefined && bare(href) === bare(current) ? { current: true } : {}) };
  };
  const below = (items = []) => items.flatMap((entry) => [...(entry.url ? [link(entry)] : []), ...below(entry.items)]);
  return entries.map((entry, index) => {
    const children = below(entry.items);
    return {
      ...link(entry),
      ...(children.length ? { children } : {}),
      ...(!entry.url || (linkMenu && !linkMenu(entry, index)) ? { linkMenu: false } : {}),
    };
  });
}

// `menu`, `languages`, `search` and `cta` are the site's, in the shapes Header takes, `home` where its brand leads,
// `logos` where its logos are served and `menuWord` what its menu button says. The word in an empty search field,
// where the design shows one, is the site's too: `search.word`, such as 'Sök', or else its `label`. So are the rows above
// and below the large menu, which a site gives in Header's menu-above and menu-below slots: they show where the design
// has them on.
export function headerProps(settings, project, { menu = [], languages = [], search, cta, home, logos, menuWord = 'Menu' } = {}) {
  const sticky = settings.attachment === 'sticky';
  const button = { word: { word: menuWord }, icon: { word: '', icon: 'menu' }, off: false }[settings['menu-button']];
  return {
    identity: identityProps(settings, project, { href: home, logos }),
    arrangement: settings.arrangement,
    attachment: settings.attachment,
    start: sticky ? settings.start : 'below',
    autohide: sticky && settings.autohide,
    surface: settings.surface,
    translucent: settings.translucent === true,
    menu,
    linkMenu: settings['link-menu'],
    menuButton: button,
    languages: settings.language ? languages : [],
    search: settings.search && search
      ? { ...search, links: settings['search-links'] ? search.links : undefined, surface: settings['search-surface'], blur: settings['search-blur'], heading: settings['search-heading'], close: settings['search-close'] !== false, placeholder: settings['search-placeholder'] ?? 'word' }
      : undefined,
    cta: settings.cta ? cta : undefined,
    numbered: settings.numbered,
    menuAbove: settings['menu-above'] === true,
    menuBelow: settings['menu-below'] === true,
  };
}

// A page's first heading is its H1, and h1 says where that is. In the hero, the hero's heading is the <h1> and the next
// section's an <h2>. Under the hero, the hero's text is no heading at all, since a lower heading before the H1 reads as the
// wrong order, and the next section's heading is the <h1>. The component and the tool's live sample both follow these.
export const nextHeadingProps = (settings) => (settings.h1 === 'below' ? { level: 1, type: 'heading-1' } : { level: 2, type: 'heading-2' });

// `behind` is the picture for a hero with its text on it, `side` the one for a hero with its picture beside the text, and
// `alt` what the side picture says. A site may give one or both, since the design decides which shows. A hero the design
// gives a picture the site has not given is a hero without one, on the design's Surface: a picture Surface with nothing on
// it would be a dark band of the overlay's colour.
export function heroProps(settings, { behind, side, alt = '' } = {}) {
  const isBehind = settings.picture === 'behind' && Boolean(behind);
  const place = settings.picture === 'behind' || settings.picture === 'none' || !side ? undefined : settings.picture;
  return {
    level: settings.h1 === 'below' ? false : 1,
    surface: isBehind ? `picture-${settings.overlay}` : settings.surface === 'none' ? undefined : settings.surface,
    picture: isBehind ? behind : place ? side : undefined,
    side: place,
    alt: place ? alt : undefined,
    type: settings.type,
    height: settings.height,
    place: settings.place,
    align: settings.align,
  };
}

// `trail` is what follows the first step, `{ label, href }` each and the last without `href`. The first step is the site's
// name, or `homeWord`, or a house, and leads to `home`. A design whose trail is off gives no steps, and Breadcrumbs
// then writes nothing.
export const breadcrumbProps = (settings, project, { trail = [], home = '/', homeWord = 'Home' } = {}) => ({
  items: settings.show === false ? [] : [{ label: settings.home === 'name' ? project.name : homeWord, href: home }, ...trail],
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
