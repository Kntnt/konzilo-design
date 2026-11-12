// Polyfill for scroll-driven animations, `animation-timeline: scroll()`, where a browser lacks them, and where its
// style queries miss what they set: Firefox 160 runs them, but a container style query there keeps what it found when
// its element was last matched, so a flag an animation turns later goes unseen. Delete this file once every engine has
// both.
//
// Where a page has a sticky header, three discrete animations on the root scroller (header.css) each turn a flag on
// the root element from 0 to 1 at a length it holds. Where a browser lacks scroll timelines and a page has a footer at
// the edge of the screen, the page's edge reads one more (page.css), on the page, 1 until a length short of the
// scroller's end. This sets the same flags on the same elements at the same lengths, with priority over an animation of
// them, and nothing else: what the flags do is the CSS's.
const FLAGS = [
  ['--kn-header-scrolled', '--kn-header-scrolled-at'],
  ['--kn-header-past', '--kn-header-past-at'],
  ['--kn-header-beyond', '--kn-header-beyond-at'],
];
// Whether a style query follows a flag an animation sets on its container: tried on two elements of its own, in a
// shadow tree with a constructed sheet, which a policy on inline styles allows, and removed at once. A header's loader
// tests the same, word for word, before it fetches this file.
const follows = () => { const host = document.createElement('span'), tree = host.attachShadow({ mode: 'open' }), sheet = new CSSStyleSheet(); sheet.replaceSync('@keyframes f { from, to { --f: 1; } } b { animation: f 1s paused both; } @container style(--f: 1) { i { --g: 1; } }'); tree.adoptedStyleSheets = [sheet]; const child = tree.appendChild(document.createElement('b')).appendChild(document.createElement('i')); document.documentElement.append(host); const seen = getComputedStyle(child).getPropertyValue('--g'); host.remove(); return seen.trim() === '1'; };
const timelines = CSS.supports('animation-timeline: scroll()');
if (!timelines || !follows()) {
  const root = document.documentElement;
  const set = (element, flag, value) => { if (element.style.getPropertyValue(flag) !== value) element.style.setProperty(flag, value, 'important'); };
  const update = () => {
    // The lengths are registered, so the browser gives them in pixels.
    if (document.querySelector('.kn-page > .kn-header[data-kn-attachment="sticky"]')) {
      const style = getComputedStyle(root);
      for (const [flag, at] of FLAGS) set(root, flag, window.scrollY >= parseFloat(style.getPropertyValue(at)) ? '1' : '0');
    }
    if (timelines) return;
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
