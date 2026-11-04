// The design tool's hero: the choices on its page change the sample without a build. A choice is the same few
// attributes the Hero component writes, and only what changed is touched, since a picture set again blinks.
import { heroProps } from './frame.js';

function setAttribute(node, name, value) {
  if (value === undefined) node.removeAttribute(name);
  else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
export function setHero(node, settings, images) {
  const { surface, picture, type, height, place } = heroProps(settings, images);
  const behind = settings.picture === 'behind';
  const beside = settings.picture === 'beside';
  setAttribute(node, 'data-kn-surface', surface);
  setAttribute(node, 'data-kn-height', height);
  setAttribute(node, 'data-kn-place', place === 'bottom' ? 'bottom' : undefined);
  setAttribute(node, 'data-kn-picture', beside ? 'beside' : undefined);
  node.querySelector('.kn-heading-group-heading').dataset.knType = type;
  const image = behind ? `url(${JSON.stringify(picture)})` : '';
  if (node.style.getPropertyValue('--kn-picture-image') !== image) {
    if (image) node.style.setProperty('--kn-picture-image', image);
    else node.style.removeProperty('--kn-picture-image');
  }
  let media = node.querySelector(':scope > .kn-hero-content > .kn-hero-media');
  if (beside && !media) {
    media = document.createElement('div');
    media.className = 'kn-hero-media';
    media.append(Object.assign(document.createElement('img'), { alt: '' }));
    node.querySelector(':scope > .kn-hero-content').append(media);
  } else if (!beside) media?.remove();
  if (beside && media.firstElementChild.getAttribute('src') !== picture) media.firstElementChild.src = picture;
}
export function followHero() {
  let shown;
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'kn-design' || !event.data.hero) return;
    const { settings, images } = event.data.hero;
    const key = JSON.stringify(event.data.hero);
    if (key === shown) return;
    shown = key;
    for (const node of document.querySelectorAll('[data-kn-live-hero]')) setHero(node, settings, images);
  });
}
