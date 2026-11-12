// Polyfill for scroll-driven animations, `animation-timeline: scroll()`, which Firefox lacks as of 2026-11-10.
// Delete this file once every engine has them.
//
// Where a page has a sticky header, three discrete animations on the root scroller (header.css) each turn a flag on
// the root element from 0 to 1 at a length it holds. Where a page has a footer at the edge of the screen, one more
// (page.css) turns a flag on the page from 1 to 0 a length short of the scroller's end. This sets the same flags on the
// same elements at the same lengths, and nothing else: what the flags do is the CSS's.
const FLAGS = [
  ['--kn-header-scrolled', '--kn-header-scrolled-at'],
  ['--kn-header-past', '--kn-header-past-at'],
  ['--kn-header-beyond', '--kn-header-beyond-at'],
];
if (!CSS.supports('animation-timeline: scroll()')) {
  const root = document.documentElement;
  const set = (element, flag, value) => { if (element.style.getPropertyValue(flag) !== value) element.style.setProperty(flag, value); };
  const update = () => {
    // The lengths are registered, so the browser gives them in pixels.
    if (document.querySelector('.kn-page > .kn-header[data-kn-attachment="sticky"]')) {
      const style = getComputedStyle(root);
      for (const [flag, at] of FLAGS) set(root, flag, window.scrollY >= parseFloat(style.getPropertyValue(at)) ? '1' : '0');
    }
    // With no room to scroll the timeline is inactive, and the page is at its end.
    const room = root.scrollHeight - root.clientHeight;
    for (const page of document.querySelectorAll('.kn-page:has(> .kn-footer[data-kn-attachment="reveal"])')) {
      const at = parseFloat(getComputedStyle(page).getPropertyValue('--kn-footer-covered-at'));
      set(page, '--kn-footer-covered', room > 0 && window.scrollY < room - at ? '1' : '0');
    }
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  // The end moves as the page grows or shrinks, as pictures load or a footer comes into the reveal.
  new ResizeObserver(update).observe(root);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true });
  update();
}
