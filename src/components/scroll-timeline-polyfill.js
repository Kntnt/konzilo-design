// Polyfill for scroll-driven animations, `animation-timeline: scroll()`, which Firefox lacks as of 2026-11-10.
// Delete this file once every engine has them.
//
// Where a page has a sticky header, three discrete animations on the root scroller (header.css) each turn a flag on
// the root element from 0 to 1 at a length it holds. This sets the same flags on the same element at the same lengths,
// and nothing else: what the flags do is the CSS's.
const FLAGS = [
  ['--kn-header-scrolled', '--kn-header-scrolled-at'],
  ['--kn-header-past', '--kn-header-past-at'],
  ['--kn-header-beyond', '--kn-header-beyond-at'],
];
if (!CSS.supports('animation-timeline: scroll()')) {
  const root = document.documentElement;
  const update = () => {
    if (!document.querySelector('.kn-page > .kn-header[data-kn-attachment="sticky"]')) return;
    // The lengths are registered, so the browser gives them in pixels.
    const style = getComputedStyle(root);
    for (const [flag, at] of FLAGS) {
      const value = window.scrollY >= parseFloat(style.getPropertyValue(at)) ? '1' : '0';
      if (root.style.getPropertyValue(flag) !== value) root.style.setProperty(flag, value);
    }
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true });
  update();
}
