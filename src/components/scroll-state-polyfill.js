// Polyfill for scroll-state container queries, `scroll-state(scrolled: …)`, which Firefox and WebKit lack as of
// 2026-11-10. Delete this file once every engine has them.
//
// A header that slides away reads the direction the root scroller was last scrolled in (header.css). This writes that
// direction on the same element, the root, as `data-kn-scrolled`, which a parallel selector reads, and nothing else.
// As in the native query, only a relative scroll counts: by wheel, touch, or the arrow, page and space keys. A jump to
// a place, such as Home, End, an anchor or a focused element brought into view, leaves the direction as it was.
if (!CSS.supports('container-type: scroll-state')) {
  const root = document.documentElement;
  const KEYS = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  let last = window.scrollY, hint = 0, hinted = 0, touch = null;
  // A relative input says which way the scrolling it starts goes, for as long as a smooth scroll lasts.
  const relative = (direction) => { if (direction) { hint = direction; hinted = performance.now(); } };
  addEventListener('wheel', (event) => relative(Math.sign(event.deltaY)), { passive: true });
  addEventListener('keydown', (event) => relative(event.key === ' ' ? (event.shiftKey ? -1 : 1) : KEYS[event.key] ?? 0), { passive: true });
  addEventListener('touchstart', (event) => { touch = event.touches[0]?.clientY ?? null; }, { passive: true });
  addEventListener('touchmove', (event) => {
    const y = event.touches[0]?.clientY;
    if (touch !== null && y !== undefined) { relative(Math.sign(touch - y)); touch = y; }
  }, { passive: true });
  addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y !== last && Math.sign(y - last) === hint && performance.now() - hinted < 1000) root.dataset.knScrolled = hint > 0 ? 'block-end' : 'block-start';
    last = y;
  }, { passive: true });
}
