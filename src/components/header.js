export const GIVING_WAY_ORDER = ['slogan', 'name', 'links', 'word', 'language', 'cta', 'search'];
const ARRANGEMENTS = {
  A: [['identity'], ['search', 'language', 'links', 'menu', 'cta']],
  B: [['identity', 'links'], ['search', 'language', 'menu', 'cta']],
  C: [['identity', 'links', 'search'], ['language', 'menu', 'cta']],
};
export function arrangementGroups(arrangement, items = {}) {
  if (!ARRANGEMENTS[arrangement]) throw new TypeError('Unknown header arrangement');
  return ARRANGEMENTS[arrangement].map((group) => group.filter((item) => item === 'identity' || items[item]));
}

// Widths are measured candidates, each relative to the previously accepted steps.
// A decorative step that saves no width is skipped, including stacked identities.
export function givingWay({ available, width, steps = [], identityWidth = 0 }) {
  const collapsed = [];
  for (const name of GIVING_WAY_ORDER) {
    if (width <= available + 0.5) break;
    const step = steps.find((candidate) => candidate.name === name);
    if (step && step.width < width - 0.5) { collapsed.push(name); width = step.width; }
  }
  const scale = width > available && identityWidth > 0 ? Math.max(0.01, Math.min(1, (identityWidth - (width - available)) / identityWidth)) : 1;
  return { collapsed, scale };
}

// Anchor accumulates small deltas, so jitter never toggles the header repeatedly.
export function autohideDecision({ y, height, sticky = true, autohide = true, panelOpen = false, keyboard = false, away = false, anchor = 0, jitter = 4 }) {
  if (!sticky || !autohide || panelOpen || keyboard || y <= 0) return { away: false, anchor: y };
  if (Math.abs(y - anchor) < jitter) return { away, anchor };
  return { away: y > anchor && y > height, anchor: y };
}

// Change an outgoing transparent appearance only after the slide finishes.
export function appearanceDecision({ under, y, autohide, blocked = false, clear = true, hidden = false, threshold = 24 }) {
  if (!under) return { transparent: false, clear: false };
  if (y < threshold) clear = true;
  else if (!autohide || blocked || hidden) clear = false;
  return { transparent: y < threshold || clear, clear };
}

const initialized = new WeakMap();
let closeOpenHeader;
export function setupHeaders(root = document) {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return () => {};
  const disposers = [...root.querySelectorAll('.kn-header')].filter((header) => !initialized.has(header)).map((header) => {
    const page = header.closest('.kn-page');
    const main = page?.querySelector(':scope > .kn-page-main');
    const bar = header.querySelector('.kn-header-bar');
    const inner = header.querySelector('.kn-header-inner');
    const identity = header.querySelector('.kn-header-identity');
    const panels = [...header.querySelectorAll('[data-kn-panel]')];
    const triggers = [...header.querySelectorAll('[data-kn-trigger]')];
    const doc = document.documentElement;
    const sticky = header.dataset.knAttachment === 'sticky';
    const under = sticky && header.dataset.knStart === 'under';
    const autohide = header.dataset.knAutohide === 'true';
    const abort = new AbortController();
    const on = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: abort.signal });
    const rem = (n) => `${n / parseFloat(getComputedStyle(doc).fontSize)}rem`;
    const keyboard = () => !!header.querySelector(':focus-visible');
    let activePanel = '', returnTo, lockedStyle, frame, queued = false, disposed = false;
    let state = { away: false, anchor: window.scrollY };
    let clear = window.scrollY < 24;
    let hidden = false;
    let publishedInset;
    const originalMode = header.getAttribute('data-kn-mode');
    let slideTimer;
    panels.forEach((panel) => { panel.removeAttribute('popover'); panel.hidden = true; });
    triggers.forEach((trigger) => {
      trigger.removeAttribute('popovertarget');
      if (trigger.tagName === 'A') { trigger.setAttribute('role', 'button'); }
    });
    header.querySelectorAll('[data-kn-close]').forEach((button) => button.removeAttribute('popovertarget'));
    header.dataset.knEnhanced = 'true';
    if (page && sticky) page.dataset.knHeaderStart = under ? 'under' : 'below';
    function publish() {
      const height = bar.getBoundingClientRect().height;
      header.style.setProperty('--kn-header-height', rem(height));
      doc.style.setProperty('--kn-header-height', rem(height));
      if (sticky) {
        doc.style.setProperty('--kn-header-visible-height', state.away && hidden ? '0rem' : rem(height));
        doc.dataset.knStickyHeader = 'true';
        const inset = state.away && hidden ? 0 : height;
        if (inset !== publishedInset) { publishedInset = inset; window.dispatchEvent(new Event('kn:headerchange')); }
      }
      if (page) page.style.setProperty('--kn-header-height', rem(height));
    }
    function paint() {
      const firstBand = main?.querySelector(':scope > .kn-band');
      const next = appearanceDecision({ under, y: window.scrollY, autohide, blocked: !!activePanel || keyboard(), clear, hidden });
      clear = next.clear;
      header.toggleAttribute('data-kn-transparent', next.transparent);
      const surface = next.transparent ? firstBand?.dataset.knSurface ?? 'page' : header.dataset.knOpaqueSurface;
      header.dataset.knSurface = surface;
      const mode = next.transparent ? firstBand?.getAttribute('data-kn-mode') ?? originalMode : originalMode;
      if (mode) header.setAttribute('data-kn-mode', mode); else header.removeAttribute('data-kn-mode');
      // color-scheme is the standard, resolved Surface output, not an author polarity input.
      header.dataset.knLogoPolarity = getComputedStyle(header).colorScheme.includes('dark') ? 'dark' : 'light';
      const contentUnder = sticky && !next.transparent && !(state.away && hidden) && window.scrollY > 0;
      header.toggleAttribute('data-kn-shadow', contentUnder);
      header.toggleAttribute('data-kn-panel-open', !!activePanel);
      // A layer without a shadow is set off by the hairline, as at strength zero.
      for (const panel of panels) if (!panel.hidden) panel.toggleAttribute('data-kn-line', getComputedStyle(panel).boxShadow === 'none');
      const barStyle = getComputedStyle(bar);
      const same = firstBand && getComputedStyle(firstBand.hasAttribute('data-kn-surface') ? firstBand : page).backgroundColor === getComputedStyle(header).backgroundColor;
      header.toggleAttribute('data-kn-line', !next.transparent && !activePanel && (contentUnder || same) && barStyle.boxShadow === 'none');
      publish();
    }
    function setAway(away) {
      if (away === header.hasAttribute('data-kn-away')) return;
      header.toggleAttribute('data-kn-away', away);
      hidden = false;
      clearTimeout(slideTimer);
      if (away) {
        // transitionend is absent under reduced motion and may be cancelled by resize.
        const duration = parseFloat(getComputedStyle(header).transitionDuration.split(',').at(-1)) * 1000 || 0;
        if (!duration) hidden = true;
        else slideTimer = setTimeout(() => { if (state.away) { hidden = true; paint(); } }, duration + 20);
      }
    }
    function scroll() {
      state = autohideDecision({ y: window.scrollY, height: bar.offsetHeight, sticky, autohide, panelOpen: !!activePanel, keyboard: keyboard(), ...state });
      setAway(state.away);
      paint();
    }
    function fit() {
      header.style.removeProperty('--kn-header-identity-scale');
      const set = (steps) => { header.dataset.knCollapsed = steps.join(' '); };
      const width = () => {
        const groups = [...inner.children].filter((group) => group.getBoundingClientRect().width > 0);
        return groups.reduce((sum, group) => sum + group.getBoundingClientRect().width, 0) + Math.max(0, groups.length - 1) * parseFloat(getComputedStyle(inner).columnGap);
      };
      set([]);
      const initialWidth = width();
      let currentWidth = initialWidth;
      const accepted = [], steps = [];
      for (const name of GIVING_WAY_ORDER) {
        set([...accepted, name]);
        const candidate = width();
        steps.push({ name, width: candidate });
        if (candidate < currentWidth - 0.5) { accepted.push(name); currentWidth = candidate; }
      }
      set(accepted);
      const result = givingWay({ available: inner.clientWidth, width: initialWidth, steps, identityWidth: identity.getBoundingClientRect().width });
      set(result.collapsed);
      if (result.scale < 1) {
        header.style.setProperty('--kn-header-identity-scale', String(result.scale));
        // Gaps and the slogan separator also scale, preserving a long name intact.
        for (let i = 0; i < 3 && width() > inner.clientWidth + 0.5; i++) {
          const previous = Number(header.style.getPropertyValue('--kn-header-identity-scale'));
          header.style.setProperty('--kn-header-identity-scale', String(previous * Math.max(0.01, (identity.getBoundingClientRect().width - (width() - inner.clientWidth)) / identity.getBoundingClientRect().width)));
        }
      }
      if (activePanel && returnTo && !returnTo.getClientRects().length) {
        const restore = keyboard();
        close(false);
        if (restore) header.querySelector('[data-kn-trigger="menu"]')?.focus({ preventScroll: true });
      }
      // Never leave focus in an item that has just moved out of the bar.
      const focused = header.querySelector(':focus-visible');
      if (focused && !focused.getClientRects().length) header.querySelector('[data-kn-trigger="menu"]')?.focus({ preventScroll: true });
      const top = Math.max(0, bar.getBoundingClientRect().bottom);
      header.style.setProperty('--kn-header-panel-top', rem(top));
      paint();
    }
    function schedule() {
      if (queued || disposed) return;
      queued = true;
      frame = requestAnimationFrame(() => { queued = false; fit(); });
    }
    function lock(needed) {
      if (needed && lockedStyle === undefined) {
        lockedStyle = doc.style.overflow;
        doc.style.overflow = 'hidden';
      } else if (!needed && lockedStyle !== undefined) {
        doc.style.overflow = lockedStyle;
        lockedStyle = undefined;
      }
    }
    function open(name, trigger) {
      if (name && closeOpenHeader && closeOpenHeader !== close) closeOpenHeader(false);
      closeOpenHeader = name ? close : closeOpenHeader === close ? undefined : closeOpenHeader;
      activePanel = name;
      if (trigger) returnTo = trigger;
      panels.forEach((panel) => { panel.hidden = panel.dataset.knPanel !== name; });
      triggers.forEach((button) => button.setAttribute('aria-expanded', String(button.dataset.knTrigger === name)));
      lock(name === 'menu' || name === 'search');
      state.away = false;
      setAway(false);
      header.style.setProperty('--kn-header-panel-top', rem(Math.max(0, bar.getBoundingClientRect().bottom)));
      paint();
      if (name === 'search') header.querySelector('[data-kn-panel="search"] input')?.focus({ preventScroll: true });
      else if (name && trigger?.matches(':focus-visible')) panels.find((panel) => panel.dataset.knPanel === name)?.querySelector('a, input, button')?.focus({ preventScroll: true });
    }
    function close(focus = true) {
      const trigger = returnTo;
      open('');
      if (focus) (trigger?.getClientRects().length ? trigger : header.querySelector('[data-kn-trigger="menu"]'))?.focus({ preventScroll: true });
    }
    on(header, 'click', (event) => {
      const trigger = event.target.closest('[data-kn-trigger]');
      if (trigger) { event.preventDefault(); activePanel === trigger.dataset.knTrigger ? close() : open(trigger.dataset.knTrigger, trigger); return; }
      if (event.target.closest('[data-kn-close]')) close();
      const dialogButton = event.target.closest('[data-kn-dialog]');
      if (dialogButton) { close(false); document.getElementById(dialogButton.dataset.knDialog)?.showModal(); }
      const link = event.target.closest('a[href]');
      if (link && activePanel) close(false);
      if (link?.classList.contains('kn-skip-link')) {
        const target = document.getElementById(link.hash.slice(1));
        if (target) { target.setAttribute('tabindex', '-1'); target.focus(); }
      }
    });
    on(header, 'keydown', (event) => {
      if (event.key === ' ' && event.target.matches('a[data-kn-trigger]')) { event.preventDefault(); event.target.click(); }
      if (event.key === 'Tab' && (activePanel === 'menu' || activePanel === 'search')) {
        const panel = panels.find((candidate) => candidate.dataset.knPanel === activePanel);
        const focusable = [...header.querySelectorAll('.kn-header-bar a, .kn-header-bar button'), ...panel.querySelectorAll('a, button, input, select, textarea')].filter((element) => element.getClientRects().length && !element.disabled);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    on(document, 'keydown', (event) => { if (event.key === 'Escape' && activePanel) { event.preventDefault(); close(); } });
    on(document, 'click', (event) => {
      if (activePanel && (!header.contains(event.target) || event.target.matches('.kn-header-search-overlay'))) close();
    });
    on(header, 'focusin', () => { if (keyboard()) { state.away = false; setAway(false); paint(); } });
    on(header, 'focusout', schedule);
    on(header, 'transitionend', (event) => { if (event.target === header && event.propertyName === 'translate' && state.away) { hidden = true; paint(); } });
    on(window, 'scroll', scroll, { passive: true });
    on(window, 'resize', schedule);
    on(header, 'kn:refresh', schedule);
    const observer = new ResizeObserver(schedule);
    [inner, identity, ...inner.querySelectorAll('.kn-header-group'), ...(main ? [main] : [])].forEach((element) => observer.observe(element));
    // Theme controls can replace the core without changing a bar's dimensions.
    const mutation = new MutationObserver(schedule);
    mutation.observe(doc, { attributes: true, attributeFilter: ['data-kn-mode', 'dir'] });
    const core = document.getElementById('kn-live-core');
    if (core) mutation.observe(core, { childList: true, characterData: true, subtree: true });
    document.fonts?.ready.then(schedule);
    fit();
    const dispose = () => {
      disposed = true; close(false); abort.abort(); observer.disconnect(); mutation.disconnect(); clearTimeout(slideTimer); cancelAnimationFrame(frame);
      header.removeAttribute('data-kn-enhanced'); header.removeAttribute('data-kn-away'); header.removeAttribute('data-kn-transparent');
      header.dataset.knSurface = header.dataset.knOpaqueSurface;
      if (page) { delete page.dataset.knHeaderStart; page.style.removeProperty('--kn-header-height'); }
      if (sticky) { delete doc.dataset.knStickyHeader; doc.style.removeProperty('--kn-header-height'); doc.style.removeProperty('--kn-header-visible-height'); }
      initialized.delete(header);
    };
    initialized.set(header, dispose);
    return dispose;
  });
  return () => disposers.forEach((dispose) => dispose());
}
