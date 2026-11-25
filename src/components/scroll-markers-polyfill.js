// Polyfill for CSS scroll markers, `scroll-target-group` and `:target-current`, which Firefox and WebKit lack as of
// 2026-11-25. Delete this file once every engine has them.
//
// A following menu (table-of-contents.css) marks the link of the section being read. This marks the link Chromium marks
// with `aria-current="location"`, which the CSS draws as it draws `:target-current`, and does nothing else. It follows
// Chromium's rule (its ScrollMarkerChooser), not the draft's example: a target stands where scrolling it into view takes
// the page, its scroll margin counted twice, as Chromium counts it; positions within an eighth of the window of either
// end are spread over that eighth, so every link can be marked; of the last target at or above the scroll position and
// the first less than half a window below it, the nearer is marked. Where the page cannot scroll, the last link is.
if (!CSS.supports('scroll-target-group: auto')) {
  const root = document.documentElement;
  const targetOf = (link) => { try { return link.hash ? document.getElementById(decodeURIComponent(link.hash.slice(1))) : null; } catch { return null; } };
  const choose = (marks, y, view, end) => {
    if (end <= 0) return marks.at(-1);
    const reserve = view / 8, low = Math.min(...marks.map(({ at }) => at)), high = Math.max(...marks.map(({ at }) => at));
    const spread = marks.map(({ link, at }) => ({ link, at: at < reserve ? ((at - low) / (reserve - low)) * reserve
      : at > end - reserve ? ((at - (end - reserve)) / (high - (end - reserve))) * reserve + end - reserve : at }));
    let before, after;
    for (const mark of spread.toSorted((a, b) => a.at - b.at)) {
      if (!before || mark.at <= y) before = mark;
      else if (mark.at < y + view / 2 && !(after?.at < mark.at)) after = mark;
    }
    return after && after.at - y < y - before.at ? after : before;
  };
  const update = () => {
    const view = root.clientHeight, end = root.scrollHeight - view, y = scrollY, padding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    for (const menu of document.querySelectorAll('.kn-toc[data-kn-follow]')) {
      const marks = [];
      for (const link of menu.querySelectorAll('a[href]')) {
        const target = targetOf(link);
        if (target?.getClientRects().length) marks.push({ link, at: target.getBoundingClientRect().top + y - 2 * (parseFloat(getComputedStyle(target).scrollMarginTop) || 0) - padding });
      }
      const chosen = marks.length ? choose(marks, y, view, end).link : null;
      for (const link of menu.querySelectorAll('a')) if ((link === chosen) !== (link.getAttribute('aria-current') === 'location')) link === chosen ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current');
    }
  };
  for (const type of ['scroll', 'resize']) addEventListener(type, update, { passive: true });
  // Targets move as the page grows or shrinks, as pictures and fonts load.
  new ResizeObserver(update).observe(root);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true });
  update();
}
