// The design tool's choices of how to look at a component: each variation is on the page already, and only the chosen
// one shows. Nothing is rebuilt, so nothing blinks. A choice made elsewhere on the page brings its component into view.
import { lookDefaults, lookShows } from './looks.js';

// A variation a little taller than the last, by a frame or a line, is no reason to move what is being looked at.
const MARGIN = 32;
function reveal(section) {
  const box = section.getBoundingClientRect();
  const below = box.bottom - innerHeight;
  // A component larger than the window stays as it is once it fills it.
  const by = box.top < 0 ? (below >= 0 ? 0 : box.top) : below > MARGIN ? Math.min(box.top, below) : 0;
  if (!by) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scrollTo({ top: scrollY + by, behavior: still ? 'instant' : 'smooth' });
}

export function followLooks() {
  const marks = [...document.querySelectorAll('[data-look]')];
  const write = (chosen) => {
    for (const mark of marks) mark.toggleAttribute('data-look-on', lookShows(mark.dataset.look, chosen));
  };
  // A picture in a variation not yet shown is there at once when it is, instead of arriving after it.
  for (const image of document.querySelectorAll('[data-look] img')) {
    image.loading = 'eager';
    image.decode?.().catch(() => {});
  }
  let shown = lookDefaults();
  let first = true;
  write(shown);
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'kn-design' || !event.data.looks) return;
    const chosen = { ...shown, ...event.data.looks };
    const changed = Object.keys(chosen).filter((key) => chosen[key] !== shown[key]);
    const opening = first;
    first = false;
    if (!changed.length) return;
    shown = chosen;
    write(chosen);
    // A frame opened on looks chosen earlier stays where it is.
    if (opening) return;
    const section = marks.find((mark) => mark.dataset.look.split(' ').some((pair) => pair.startsWith(`${changed[0]}:`)))?.closest('[data-component]');
    if (section) reveal(section);
  });
}
