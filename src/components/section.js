import { frameScheduler } from './schedule.js';

// A section's head beside its accordion stays in view under the header as the page scrolls, and only while it fits
// in the window below the header: one taller than that would hide its own end. This writes data-kn-sticky="true" on
// each head that may stay. Without it the head scrolls with the page (docs/spec/directives.md, section, rule 4).

// The heads of rule 4: no picture first, a head, and a body of one accordion.
export const STICKY_HEADS = '.kn-section > .kn-band-content:not(:has(> .kn-section-media)) > .kn-section-head:has(+ .kn-section-body > .kn-accordion:only-child)';

export function headFits({ height, inset = 0, viewportHeight }) {
  return height > 0 && height + inset <= viewportHeight;
}

export function setupSections(root = document) {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const heads = [...root.querySelectorAll(STICKY_HEADS)];
  if (!heads.length) return () => {};
  let active = true;
  function layout() {
    for (const head of heads) {
      // The inset resolves through the browser, from the header's visible height and the space roles.
      head.dataset.knSticky = 'true';
      const inset = parseFloat(getComputedStyle(head).insetBlockStart) || 0;
      const fits = headFits({ height: head.getBoundingClientRect().height, inset, viewportHeight: document.documentElement.clientHeight });
      if (!fits) head.removeAttribute('data-kn-sticky');
    }
  }
  const next = frameScheduler(layout);
  const schedule = () => { if (active) next(); };
  const observer = new ResizeObserver(schedule);
  for (const head of heads) observer.observe(head);
  window.addEventListener('resize', schedule);
  window.addEventListener('kn:headerchange', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
  return () => {
    active = false;
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('kn:headerchange', schedule);
    next.cancel();
    for (const head of heads) head.removeAttribute('data-kn-sticky');
  };
}
