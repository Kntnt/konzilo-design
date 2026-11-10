import { frameScheduler } from './schedule.js';

// Missing semantic levels are compressed into the next list level, without
// empty links or placeholder list items. Input order and actual anchors survive.
export function contentsTree(headings, depth = 2) {
  const roots = [], stack = [];
  for (const heading of headings.filter(({ depth: level }) => level >= 2 && level <= depth)) {
    while (stack.length && stack.at(-1).depth >= heading.depth) stack.pop();
    const entry = { ...heading, children: [] };
    (stack.at(-1)?.children ?? roots).push(entry);
    stack.push(entry);
  }
  return roots;
}

// A following menu (docs/spec/directives.md, `toc`) marks the section being read. `tops` are its stops' tops
// in document order, relative to the window, with null for a stop that has no box, such as one in a tab not
// shown. The current stop is the last to have passed the reading line, `line` below the window's top, and
// the first before any has; -1 where no stop has a box.
export function currentStop(tops, line) {
  let current = -1;
  tops.forEach((top, index) => {
    if (top === null || top === undefined || Number.isNaN(top)) return;
    if (current < 0 || top <= line) current = index;
  });
  return current;
}

// Gives `aria-current="true"` to the link of the current stop on every `.kn-toc[data-kn-follow]`, as the page
// scrolls, resizes or its header changes. Only an attribute changes, so nothing reflows.
export function setupFollowingMenus(root = document) {
  const menus = [...root.querySelectorAll('.kn-toc[data-kn-follow]')].map((menu) => {
    const links = [...menu.querySelectorAll('a[href^="#"]')];
    const targets = links.map((link) => {
      try {
        return document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      } catch {
        return null;
      }
    });
    return { menu, links, targets, current: -1 };
  }).filter(({ links }) => links.length);
  if (!menus.length) return () => {};
  function update() {
    for (const state of menus) {
      // The reading line is the Reading Area's sticky inset, resolved by the browser (table-of-contents.css).
      const line = parseFloat(getComputedStyle(state.menu).scrollMarginBlockStart) || 0;
      const tops = state.targets.map((target) => (target && target.getClientRects().length ? target.getBoundingClientRect().top : null));
      // A pixel's give, for a stop a link has just scrolled to, which lands on the line itself.
      const index = currentStop(tops, line + 1);
      if (index === state.current) continue;
      state.links[state.current]?.removeAttribute('aria-current');
      if (index >= 0) state.links[index].setAttribute('aria-current', 'true');
      state.current = index;
    }
  }
  const schedule = frameScheduler(update);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  observer?.observe(document.documentElement);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('kn:headerchange', schedule);
  update();
  return () => {
    schedule.cancel();
    observer?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('kn:headerchange', schedule);
    for (const state of menus) state.links[state.current]?.removeAttribute('aria-current');
  };
}
