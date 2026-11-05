// The design tool's hero: the choices on its page change the sample without a build. A choice is the same few
// attributes the Hero component writes, and only what changed is touched, since a picture set again blinks.
// The page's H1 and its trail go with it, as both are in the hero or in the section after it.
import { heroProps, nextHeadingProps } from './frame.js';
import { heroAttributes } from '../../src/components/hero-attributes.js';

function setAttribute(node, name, value) {
  if (value === undefined) node.removeAttribute(name);
  else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
// A tag is only the meaning: the look lies in the class and data-kn-type, so a new element looks the same in the same frame.
function retag(node, tag) {
  if (node.localName === tag) return node;
  const fresh = document.createElement(tag);
  for (const { name, value } of node.attributes) fresh.setAttribute(name, value);
  fresh.append(...node.childNodes);
  node.replaceWith(fresh);
  return fresh;
}
// What HeadingGroup writes for this level and type.
function setHeading(group, { level, type }) {
  const plain = level === false;
  const heading = retag(retag(group, plain ? 'div' : 'hgroup').querySelector('.kn-heading-group-heading'), plain ? 'p' : `h${level}`);
  setAttribute(heading, 'data-kn-type', type);
}
const sections = (hero) => [hero, hero.nextElementSibling].filter(Boolean);
const trailOf = (hero) => sections(hero).map((part) => part.querySelector('.kn-breadcrumbs')).find(Boolean);
// The rule itself: the trail stands directly before the group that holds the H1.
function placeTrail(trail, hero) {
  const group = sections(hero).map((part) => part.querySelector('h1')).find(Boolean)?.closest('.kn-heading-group');
  if (group && trail.nextElementSibling !== group) group.before(trail);
}
function setTrail(hero, settings, project) {
  trailOf(hero)?.remove();
  if (!settings.show) return;
  const trail = document.querySelector('template[data-kn-live-breadcrumbs]').content.firstElementChild.cloneNode(true);
  trail.dataset.knSeparator = settings.separator;
  trail.dataset.knHome = settings.home === 'icon' ? 'icon' : 'word';
  trail.dataset.knCurrent = String(settings.current);
  trail.dataset.knNarrow = settings.narrow;
  trail.querySelector('.kn-breadcrumbs-label').textContent = settings.home === 'name' ? project.name : 'Home';
  placeTrail(trail, hero);
}
export function setHero(node, settings, images) {
  const props = heroProps(settings, images);
  const { surface, picture, side, type, level } = props;
  setAttribute(node, 'data-kn-surface', surface);
  for (const [name, value] of Object.entries(heroAttributes(props))) setAttribute(node, name, value);
  setHeading(node.querySelector('.kn-heading-group'), { level, type });
  const next = node.nextElementSibling?.querySelector('.kn-heading-group');
  if (next) setHeading(next, nextHeadingProps(settings));
  const trail = trailOf(node);
  if (trail) placeTrail(trail, node);
  const image = settings.picture === 'behind' ? `url(${JSON.stringify(picture)})` : '';
  if (node.style.getPropertyValue('--kn-picture-image') !== image) {
    if (image) node.style.setProperty('--kn-picture-image', image);
    else node.style.removeProperty('--kn-picture-image');
  }
  let media = node.querySelector(':scope > .kn-hero-content > .kn-hero-media');
  if (side && !media) {
    media = document.createElement('div');
    media.className = 'kn-hero-media';
    media.append(Object.assign(document.createElement('img'), { alt: '' }));
    node.querySelector(':scope > .kn-hero-content').append(media);
  } else if (!side) media?.remove();
  if (side && media.firstElementChild.getAttribute('src') !== picture) media.firstElementChild.src = picture;
}
export function followHero() {
  let shownHero;
  let shownTrail;
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'kn-design' || !event.data.hero) return;
    const { hero, frame, project } = event.data;
    const heroKey = JSON.stringify(hero);
    const trailKey = JSON.stringify([frame?.breadcrumbs, project?.name]);
    const nodes = document.querySelectorAll('[data-kn-live-hero]');
    if (heroKey !== shownHero) for (const node of nodes) setHero(node, hero.settings, hero.images);
    if (frame && trailKey !== shownTrail) {
      for (const node of nodes) setTrail(node, frame.breadcrumbs, project);
      document.querySelector('.kn-page > .kn-header')?.dispatchEvent(new Event('kn:refresh'));
    }
    shownHero = heroKey;
    shownTrail = trailKey;
  });
}
