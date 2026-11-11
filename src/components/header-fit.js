// Measures a header's giving way (header.md, point 12) and writes the step it needs as `data-kn-step` on the header:
// `none`, the last of the steps in its `data-kn-steps` that it takes, or `scale`, the last resort. header.css shows
// and hides by it, and it does nothing else. Without it the header shows its narrowest step (the owner, 2026-11-11).
// A classic script: Header.astro writes it inline as the header's last child, so it fits that header while the rest
// of the page is still unparsed, before the first paint; a page may hold it once per header, and it sets itself up
// once. Loaded as a file instead, it fits every header. Each step is tried in one task, so none flickers, and a bar
// fits when its groups and gaps are no wider than its room, compared exactly. Running it again changes nothing.
(() => {
  const setup = () => {
    const width = (row) => {
      const groups = [...row.children].filter((group) => group.matches('.kn-header-group') && group.getClientRects().length);
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      return groups.reduce((sum, group) => sum + group.getBoundingClientRect().width, 0) + gap * Math.max(0, groups.length - 1);
    };
    const fit = (header) => {
      const row = header.querySelector('.kn-header-row');
      if (!row) return;
      const room = row.parentElement.getBoundingClientRect().width;
      const step = ['none', ...(header.dataset.knSteps ?? '').split(' ').filter(Boolean)].find((candidate) => {
        header.dataset.knStep = candidate;
        return width(row) <= room;
      }) ?? 'scale';
      if (header.dataset.knStep !== step) header.dataset.knStep = step;
    };
    // The room and the groups' own widths, which a font arriving, a text size or the window's width changes.
    const sized = new ResizeObserver((entries) => new Set(entries.map(({ target }) => target.closest('.kn-header')).filter(Boolean)).forEach(fit));
    const add = (header) => {
      for (const node of [header.querySelector('.kn-header-inner'), ...header.querySelectorAll('.kn-header-row > .kn-header-group')]) if (node) sized.observe(node);
      fit(header);
    };
    const all = () => document.querySelectorAll('.kn-header[data-kn-steps]').forEach(add);
    addEventListener('resize', () => document.querySelectorAll('.kn-header[data-kn-steps]').forEach(fit), { passive: true });
    // A header that comes later, or changes what it holds, as the design tool's preview does; watched once the page
    // is parsed, since each header in it fits itself.
    const holds = (node) => node.closest?.('.kn-header') || node.querySelector?.('.kn-header');
    const watch = () => new MutationObserver((changes) => { if (changes.some((change) => holds(change.target) || [...change.addedNodes].some(holds))) all(); })
      .observe(document.documentElement, { subtree: true, childList: true });
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', watch, { once: true });
    else watch();
    return { add, all };
  };
  const kn = (window.knHeaderFit ??= setup());
  const own = document.currentScript?.closest('.kn-header[data-kn-steps]');
  if (own) kn.add(own);
  else kn.all();
})();
