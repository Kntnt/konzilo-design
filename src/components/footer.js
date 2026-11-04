// The build-time layout pass and browser eligibility share no DOM-dependent decisions.
export function revealEligible({ attachment, footerHeight, viewportHeight, print = false }) {
  return attachment === 'reveal' && !print && footerHeight > 0 && footerHeight <= viewportHeight;
}

export function layoutFooter(input, { pageSurface = 'page', pageShadow = false } = {}) {
  if (input.length > 4) throw new RangeError('Footer supports at most four bands');
  const occupied = new Map();
  const source = input.map((band, index) => ({ ...band, row: index + 1, cells: (band.cells ?? []).map((cell) => ({ ...cell, row: index + 1, rows: cell.rows ?? 1, columns: cell.columns ?? 1 })) }));
  for (const band of source) for (const cell of band.cells) {
    if (!['A', 'B'].includes(cell.column) || !Number.isInteger(cell.rows) || cell.rows < 1 || cell.row + cell.rows - 1 > input.length || ![1, 2].includes(cell.columns) || (cell.columns === 2 && cell.column !== 'A')) throw new RangeError('Invalid footer cell span');
    for (let row = cell.row; row < cell.row + cell.rows; row++) {
      if (source[row - 1].cells.length && source[row - 1].surface !== band.surface) throw new RangeError('Footer cells cannot span different Surfaces');
      for (const column of cell.columns === 2 ? ['A', 'B'] : [cell.column]) {
        const key = `${column}${row}`;
        if (occupied.has(key)) throw new RangeError('Footer cells overlap');
        occupied.set(key, cell);
      }
    }
  }
  const bands = source.filter((band) => band.cells.length);
  let run = -1;
  bands.forEach((band, index) => {
    const previous = bands[index - 1], next = bands[index + 1];
    band.runStart = !previous || previous.surface !== band.surface;
    band.runEnd = !next || next.surface !== band.surface;
    if (band.runStart) run++;
    band.run = run;
    band.ownB = run > 0;
    band.wide = band.cells.some((cell) => cell.columns === 2);
    const coverA = occupied.get(`A${band.row}`), coverB = occupied.get(`B${band.row}`);
    const crossesA = coverA && coverA.row < band.row;
    const crossesB = coverB && coverB.row < band.row;
    band.horizontal = band.rule && index > 0 && previous.surface === band.surface && !(crossesA && crossesB) ? crossesA ? 'b' : crossesB ? 'a' : 'both' : null;
    band.vertical = !!band.verticalRule && !band.wide && !(coverA?.columns === 2);
  });
  bands.forEach((band, index) => {
    band.stopTop = band.vertical && !band.runStart && !bands[index - 1]?.vertical;
    band.stopBottom = band.vertical && !band.runEnd && !bands[index + 1]?.vertical;
    band.cells.forEach((cell) => {
      const last = source[cell.row + cell.rows - 2];
      cell.edgeTop = band.runStart;
      cell.edgeBottom = !!last.runEnd || !last.cells.length;
      cell.surface = band.surface;
      cell.compact = !!band.compact;
      cell.ownB = band.ownB;
    });
  });
  // Each spanning row is its own unit. Otherwise a run stacks all A before B.
  const units = [];
  for (const band of bands) {
    const unit = units.at(-1);
    if (!unit || band.runStart || band.wide || unit.at(-1).wide) units.push([band]);
    else unit.push(band);
  }
  const cells = units.flatMap((unit) => ['A', 'B'].flatMap((column) => unit.flatMap((band) => band.cells.filter((cell) => cell.column === column))));
  cells.forEach((cell, index) => {
    cell.stackFirst = !cells[index - 1] || cells[index - 1].surface !== cell.surface;
    cell.stackLast = !cells[index + 1] || cells[index + 1].surface !== cell.surface;
  });
  return { bands, cells, topLine: bands.length > 0 && bands[0].surface === pageSurface && !pageShadow };
}

const initialized = new WeakMap();
export function setupFooters(root = document) {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return () => {};
  const disposers = [...root.querySelectorAll('.kn-footer')].filter((footer) => !initialized.has(footer)).map((footer) => {
    const page = footer.closest('.kn-page');
    const main = page?.querySelector(':scope > .kn-page-main');
    if (!page || !main || footer.parentElement !== page) return () => {};
    const abort = new AbortController();
    let frame, queued = false, disposed = false;
    const print = window.matchMedia('print');
    const rem = (n) => `${n / parseFloat(getComputedStyle(document.documentElement).fontSize)}rem`;
    function layout() {
      const height = footer.getBoundingClientRect().height;
      const reveal = revealEligible({ attachment: footer.dataset.knAttachment, footerHeight: height, viewportHeight: document.documentElement.clientHeight, print: print.matches });
      footer.dataset.knEffectiveAttachment = reveal ? 'reveal' : 'flow';
      page.dataset.knFooterAttachment = reveal ? 'reveal' : 'flow';
      page.style.setProperty('--kn-footer-height', rem(height));
      const last = main.lastElementChild;
      // A short page's blank space is the page Surface, beyond the final band.
      const blank = last && main.getBoundingClientRect().bottom > last.getBoundingClientRect().bottom + 1;
      const first = footer.querySelector('.kn-footer-background');
      const same = first && getComputedStyle(blank || !last || !last.hasAttribute('data-kn-surface') ? page : last).backgroundColor === getComputedStyle(first).backgroundColor;
      const chosenShadow = main.dataset.knShadow === 'true';
      const chosenLine = main.dataset.knEdgeLine === 'true';
      const automatic = reveal && same && !chosenShadow && !chosenLine;
      main.toggleAttribute('data-kn-auto-shadow', automatic);
      // Resolve the actual shadow, including a disabled target or strength zero.
      const shadow = getComputedStyle(main).boxShadow !== 'none';
      main.toggleAttribute('data-kn-auto-line', !!same && !shadow && !chosenLine);
      footer.removeAttribute('data-kn-top-line');
    }
    function schedule() {
      if (queued || disposed) return;
      queued = true;
      frame = requestAnimationFrame(() => { queued = false; layout(); });
    }
    footer.addEventListener('focusin', (event) => {
      // A pointer can focus a link too. Keyboard focus is the obscuration case.
      if (event.target.matches(':focus-visible') || footer.dataset.knEffectiveAttachment === 'reveal') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    }, { signal: abort.signal });
    window.addEventListener('resize', schedule, { signal: abort.signal });
    print.addEventListener('change', schedule, { signal: abort.signal });
    footer.addEventListener('kn:refresh', schedule, { signal: abort.signal });
    const observer = new ResizeObserver(schedule);
    [footer, main, page, document.documentElement].forEach((element) => observer.observe(element));
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kn-mode'] });
    const core = document.getElementById('kn-live-core');
    if (core) mutation.observe(core, { childList: true, characterData: true, subtree: true });
    document.fonts?.ready.then(schedule);
    layout();
    const dispose = () => {
      disposed = true; abort.abort(); observer.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame);
      delete page.dataset.knFooterAttachment; page.style.removeProperty('--kn-footer-height');
      delete footer.dataset.knEffectiveAttachment;
      main.removeAttribute('data-kn-auto-shadow'); main.removeAttribute('data-kn-auto-line');
      initialized.delete(footer);
    };
    initialized.set(footer, dispose);
    footer.addEventListener('kn:dispose', dispose, { once: true });
    return dispose;
  });
  return () => disposers.forEach((dispose) => dispose());
}
