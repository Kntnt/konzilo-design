// Says whether a footer at the edge of the screen fits in the window: `data-kn-fit="true"` or `"false"` on the footer,
// which footer.css reads to give it the reveal only while it fits, a footer exactly as tall as the window included. It
// does nothing else. Not a polyfill: the reveal is decoration, so without this script the footer simply stands in the
// flow (the owner, 2026-11-11; footer.md, Attachment). Running it twice changes nothing.
const footers = () => document.querySelectorAll('.kn-footer[data-kn-attachment="reveal"]');
const fit = (footer) => {
  const value = String(footer.getBoundingClientRect().height <= document.documentElement.clientHeight);
  if (footer.dataset.knFit !== value) footer.dataset.knFit = value;
};
// The footer's own size, and the window's, which a change of text size changes too.
const sized = new ResizeObserver((entries) => entries.forEach(({ target }) => fit(target)));
const watch = () => footers().forEach((footer) => { sized.observe(footer); fit(footer); });
addEventListener('resize', () => footers().forEach(fit), { passive: true });
// A footer that comes later, or is set to the edge of the screen later, as a page that changes its footer does.
new MutationObserver(watch).observe(document.documentElement, { subtree: true, childList: true, attributeFilter: ['data-kn-attachment'] });
watch();
