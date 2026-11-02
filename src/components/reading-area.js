// All placement numbers use one coordinate system, supplied by the caller.
// These functions have no DOM dependency and also serve non-browser consumers.
export function readingColumns({ width, narrow, gap, asideMin, side = 'end' }) {
  return side !== 'none' && width >= narrow + gap + asideMin ? 2 : 1;
}

export function breakoutBesideBlock({ top, blockBottom, gap = 0 }) {
  return blockBottom > 0 && top < blockBottom + gap;
}

export function placeSidenotes({ notes, breakouts = [], blockBottom = 0, gap = 0 }) {
  const obstacles = [...breakouts].sort((a, b) => a.top - b.top);
  let previousBottom;
  return notes.map(({ anchor, height }) => {
    let top = Math.max(anchor, blockBottom > 0 ? blockBottom + gap : 0,
      previousBottom === undefined ? 0 : previousBottom + gap);
    for (const obstacle of obstacles) {
      if (top < obstacle.bottom + gap && top + height > obstacle.top - gap) top = obstacle.bottom + gap;
    }
    previousBottom = top + height;
    return { top, bottom: previousBottom };
  });
}

export function readingExtent({ flowHeight, blockBottom = 0, notes = [] }) {
  return Math.max(flowHeight, blockBottom, ...notes.map(({ bottom }) => bottom));
}

export function stickyEligible({ columns, height, viewportHeight, inset = 0, gap = 0, notes = 0, breakouts = 0 }) {
  return columns === 2 && notes === 0 && breakouts === 0 && height + inset + gap <= viewportHeight;
}

// Unsupported browsers retain the complete inline flow.
export function setupReadingAreas(root = document) {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const areas = [...root.querySelectorAll('.kn-reading-area')];
  if (!areas.length) return () => {};
  const rootSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rem = (value) => `${value / rootSize()}rem`;
  let queued = false;
  let active = true;
  let frame;
  const controllers = areas.map((area) => {
    const flow = area.querySelector(':scope > .kn-reading-area-flow');
    const notes = [...flow.querySelectorAll('.kn-sidenote')];
    const blocks = [...area.querySelectorAll(':scope > .kn-reading-area-aside > .kn-aside-block')];
    // Width-bearing descendants inside a note or another Breakout are media parts,
    // not independent rows of the flow.
    const breakouts = [...flow.querySelectorAll('[data-kn-width]:not([data-kn-width="narrow"])')]
      .filter((element) => !element.parentElement.closest('.kn-sidenote, [data-kn-width]'));
    const measure = document.createElement('div');
    measure.className = 'kn-reading-area-measure';
    measure.setAttribute('aria-hidden', 'true');
    area.append(measure);
    const top = (element) => element.getBoundingClientRect().top - area.getBoundingClientRect().top;
    const height = (element) => element.getBoundingClientRect().height;
    function layout() {
      const metrics = getComputedStyle(measure);
      const gap = parseFloat(metrics.paddingBlockStart);
      const columns = readingColumns({ width: area.getBoundingClientRect().width, narrow: parseFloat(metrics.inlineSize), gap: parseFloat(metrics.paddingInlineStart), asideMin: parseFloat(metrics.blockSize), side: area.dataset.knSide });
      area.dataset.knColumns = String(columns);
      area.style.removeProperty('--kn-reading-min-block-size');
      for (const note of notes) note.style.removeProperty('--kn-sidenote-position');
      for (const breakout of breakouts) breakout.removeAttribute('data-kn-beside-block');
      for (const block of blocks) block.removeAttribute('data-kn-sticky-active');
      // Sticky positions must not affect measurements after scrolling.
      const blockBottom = Math.max(0, ...blocks.map((block) => top(block) + height(block)));
      if (columns === 1) return;
      // Resolve each row after shrinking the previous one: its changed height
      // can move every following row. The flow never gains artificial holes.
      for (const breakout of breakouts) {
        breakout.toggleAttribute('data-kn-beside-block', breakoutBesideBlock({ top: top(breakout), blockBottom, gap }));
      }
      const obstacles = breakouts.filter((element) => !element.hasAttribute('data-kn-beside-block'))
        .map((element) => ({ top: top(element), bottom: top(element) + height(element) }));
      const placements = placeSidenotes({ notes: notes.map((note) => ({ anchor: note.previousElementSibling ? top(note.previousElementSibling) : 0, height: height(note) })), breakouts: obstacles, blockBottom, gap });
      notes.forEach((note, i) => note.style.setProperty('--kn-sidenote-position', rem(placements[i].top)));
      area.style.setProperty('--kn-reading-min-block-size', rem(readingExtent({ flowHeight: height(flow), blockBottom, notes: placements })));
      // Resolve an inherited calc/rem sticky inset with the browser too.
      for (const block of blocks) {
        if (block.dataset.knSticky !== 'true') continue;
        block.setAttribute('data-kn-sticky-active', '');
        const stickyInset = parseFloat(getComputedStyle(block).insetBlockStart) || 0;
        block.toggleAttribute('data-kn-sticky-active', stickyEligible({ columns, height: height(block), viewportHeight: document.documentElement.clientHeight, inset: stickyInset, gap, notes: notes.length, breakouts: breakouts.length }));
      }
    }
    return { area, flow, notes, blocks, breakouts, measure, layout };
  });
  function schedule() {
    if (!active || queued) return;
    queued = true;
    frame = requestAnimationFrame(() => {
      queued = false;
      controllers.forEach(({ layout }) => layout());
    });
  }
  const observer = new ResizeObserver(schedule);
  for (const { area, flow, notes, blocks, breakouts, measure } of controllers) {
    for (const element of [area, flow, measure, ...notes, ...blocks, ...breakouts]) observer.observe(element);
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('kn:headerchange', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
  return () => {
    active = false;
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('kn:headerchange', schedule);
    cancelAnimationFrame(frame);
    for (const { area, notes, blocks, breakouts, measure } of controllers) {
      area.dataset.knColumns = '1';
      area.style.removeProperty('--kn-reading-min-block-size');
      notes.forEach((note) => note.style.removeProperty('--kn-sidenote-position'));
      blocks.forEach((block) => block.removeAttribute('data-kn-sticky-active'));
      breakouts.forEach((breakout) => breakout.removeAttribute('data-kn-beside-block'));
      measure.remove();
    }
  };
}
