import { frameScheduler } from './schedule.js';

// The build-time layout pass and browser eligibility share no DOM-dependent decisions.
export function revealEligible({ attachment, footerHeight, viewportHeight, print = false }) {
  return attachment === 'reveal' && !print && footerHeight > 0 && footerHeight <= viewportHeight;
}

// A band's four cells, in the order they stack on a narrow screen: A before B.
export const FOOTER_CELLS = ['a1', 'a2', 'b1', 'b2'];

// What the filled cells of one band cover. An empty column or row always gives way to the other, and where
// a cell could fill either way, `fill` says which. Whatever a cell covers, its content box stays where it was.
export function footerSpans(cells, fill = 'column') {
  const on = (cell) => !!cells[cell];
  return FOOTER_CELLS.filter(on).map((cell) => {
    const [column, row] = cell;
    const across = column === 'a' ? 'b' : 'a';
    const over = row === '1' ? '2' : '1';
    return {
      cell,
      wide: (!on(`${across}1`) && !on(`${across}2`)) || (fill === 'row' && !on(`${across}${row}`)),
      tall: (!on(`a${over}`) && !on(`b${over}`)) || (fill === 'column' && !on(`${column}${over}`)),
    };
  });
}

function layoutBand(name, band, { fill, horizontalRules, verticalRule }) {
  const spans = footerSpans(band?.cells ?? {}, fill);
  // A row with nothing of its own has no height, so where every cell is tall the band has one row.
  const rows = spans.every(({ tall }) => tall) ? 1 : 2;
  const cells = spans.map(({ cell, wide, tall }) => ({
    ...(typeof band.cells[cell] === 'object' ? band.cells[cell] : {}),
    name: cell,
    column: cell[0].toUpperCase(),
    columns: wide ? 2 : 1,
    row: tall ? 'all' : cell[1],
  }));
  const tallIn = (column) => cells.some((cell) => cell.column === column && cell.row === 'all');
  const wideIn = (row) => cells.some((cell) => cell.columns === 2 && (cell.row === row || cell.row === 'all'));
  return {
    name,
    surface: band?.surface ?? { upper: 'brand', lower: 'inverse' }[name],
    rows,
    cells,
    // Hairlines stop at a merged cell, and never cross one.
    horizontal: horizontalRules && rows === 2 ? (tallIn('A') ? 'b' : tallIn('B') ? 'a' : 'both') : null,
    vertical: !verticalRule || (wideIn('1') && wideIn('2')) ? null : wideIn('1') ? '2' : wideIn('2') ? '1' : 'all',
  };
}

export function layoutFooter({ upper, lower, fill = 'column', horizontalRules = false, verticalRule = false } = {}, { pageSurface = 'page', pageShadow = false } = {}) {
  const options = { fill, horizontalRules, verticalRule };
  const bands = [layoutBand('upper', upper, options), layoutBand('lower', lower, options)].filter((band) => band.cells.length);
  // Two bands on one colour close up, as any two Bands do, and only there can a line part them.
  if (bands.length === 2 && bands[0].surface === bands[1].surface) {
    bands.forEach((band) => { band.joined = true; });
    bands[1].join = horizontalRules;
  }
  return { bands, topLine: bands.length > 0 && bands[0].surface === pageSurface && !pageShadow };
}

// What a design's settings and a site's content give a Footer. A cell that is off stays empty, whatever the
// site has for it, and a cell that is on without content here is filled by a slot of the same name.
export function footerFromDesign(settings, content = {}) {
  const band = (name) => ({
    surface: settings[name].surface,
    cells: Object.fromEntries(FOOTER_CELLS.map((cell) => [cell, settings[name].cells[cell] ? content[name]?.[cell] ?? true : false])),
  });
  return {
    upper: band('upper'),
    lower: band('lower'),
    fill: settings.fill,
    attachment: settings.attachment,
    rules: settings['rule-extent'],
    horizontalRules: settings['horizontal-rules'],
    verticalRule: settings['vertical-rule'],
  };
}

const initialized = new WeakMap();
export function setupFooters(root = document) {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return () => {};
  const disposers = [...root.querySelectorAll('.kn-footer')].filter((footer) => !initialized.has(footer)).map((footer) => {
    const page = footer.closest('.kn-page');
    const main = page?.querySelector(':scope > .kn-page-main');
    if (!page || !main || footer.parentElement !== page) return () => {};
    const abort = new AbortController();
    let disposed = false;
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
      const first = footer.querySelector('.kn-footer-band');
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
    const next = frameScheduler(layout);
    function schedule() {
      if (!disposed) next();
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
      disposed = true; abort.abort(); observer.disconnect(); mutation.disconnect(); next.cancel();
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
