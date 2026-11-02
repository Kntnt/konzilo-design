// One document owns one versioned category catalogue. Services only ask this API.
export function mergeChoice(categories, choice = {}, previous = {}) {
  return Object.fromEntries(categories.map(({ id, required }) => [id, !!required || (typeof choice[id] === 'boolean' ? choice[id] : previous[id] === true)]));
}
export function parseStored(raw, version, categories, maxAgeDays = 182, now = Date.now()) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || !Number.isFinite(value.timestamp) || value.timestamp > now || now - value.timestamp >= maxAgeDays * 86400000 || value.version !== version || !value.choices || typeof value.choices !== 'object' || Array.isArray(value.choices)) return null;
    if (categories.some(({ id, required }) => !required && typeof value.choices[id] !== 'boolean')) return null;
    return { version, timestamp: value.timestamp, choices: mergeChoice(categories, value.choices) };
  } catch { return null; }
}
// One state per document, even if a page's bundling yields two instances of this module.
const shared = () => (globalThis.__knConsent ??= { catalogue: [], current: {}, version: '1', storageKey: 'kn-consent', opener: undefined });
export const hasConsent = (category) => shared().current[category] === true;
export function setConsent(choice) {
  const state = shared();
  state.current = mergeChoice(state.catalogue, choice, state.current);
  const stored = { version: state.version, timestamp: Date.now(), choices: { ...state.current } };
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(state.storageKey, JSON.stringify(stored)); } catch { /* Choice still applies to this document when storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent('kn:consentchange', { detail: stored }));
  }
  return stored;
}
export const openConsentSettings = (trigger) => shared().opener?.(trigger);
const initialized = new WeakSet();
export function setupConsent(root = document) {
  if (typeof window === 'undefined') return () => {};
  const banner = root.querySelector('.kn-consent');
  if (!banner || initialized.has(banner)) return () => {};
  initialized.add(banner);
  const state = shared();
  state.catalogue = JSON.parse(banner.dataset.knCategories);
  state.version = banner.dataset.knConsentVersion; state.maxAgeDays = Number(banner.dataset.knMaxAgeDays) || 182; state.storageKey = banner.dataset.knStorageKey;
  const { catalogue, version, storageKey } = state;
  const settings = document.getElementById(banner.dataset.knSettings);
  const reopen = root.querySelector(`[data-kn-consent-reopen="${banner.getAttribute('id')}"]`);
  const abort = new AbortController();
  const on = (node, name, handler) => node.addEventListener(name, handler, { signal: abort.signal });
  const doc = document.documentElement;
  let returnTo, restoring = false;
  function measure() {
    const height = banner.hidden ? 0 : banner.getBoundingClientRect().height;
    doc.style.setProperty('--kn-consent-height', `${height / parseFloat(getComputedStyle(doc).fontSize)}rem`);
    doc.toggleAttribute('data-kn-consent-visible', !banner.hidden);
  }
  function show(visible) { banner.hidden = !visible; measure(); }
  state.opener = (trigger = document.activeElement) => {
    if (!settings?.showModal) return;
    returnTo = trigger;
    settings.querySelectorAll('input[data-kn-category]').forEach((input) => { input.checked = hasConsent(input.value); });
    if (!settings.open) settings.showModal();
  };
  function load() {
    let stored;
    try { stored = parseStored(window.localStorage.getItem(storageKey), version, catalogue, state.maxAgeDays); } catch { stored = null; }
    state.current = stored?.choices ?? mergeChoice(catalogue);
    if (reopen) reopen.hidden = !stored;
    show(!stored && banner.dataset.knDeferred !== 'true');
    restoring = true;
    window.dispatchEvent(new CustomEvent('kn:consentchange', { detail: { version, choices: { ...state.current } } }));
    restoring = false;
  }
  const choose = (event) => {
    const accept = event.target.closest('[data-kn-consent-accept]');
    const reject = event.target.closest('[data-kn-consent-reject]');
    if (!accept && !reject) return;
    setConsent(Object.fromEntries(catalogue.map(({ id }) => [id, !!accept])));
    if (settings.open) settings.close();
  };
  on(banner, 'click', choose);
  on(settings, 'click', choose);
  on(document, 'click', (event) => {
    const trigger = event.target.closest('[data-kn-consent-open]');
    if (trigger && (!('button' in event) || event.button === 0) && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && settings?.showModal) {
      event.preventDefault(); openConsentSettings(trigger);
    }
  });
  on(settings, 'submit', (event) => {
    event.preventDefault();
    const choice = Object.fromEntries([...settings.querySelectorAll('input[data-kn-category]')].map((input) => [input.value, input.checked]));
    setConsent(choice); settings.close();
  });
  on(settings, 'click', (event) => { if (event.target.closest('[data-kn-consent-close]') || event.target === settings) settings.close(); });
  on(settings, 'close', () => { returnTo?.focus({ preventScroll: true }); });
  on(window, 'kn:consentchange', () => { if (!restoring) { show(false); if (reopen) reopen.hidden = false; } });
  on(banner, 'kn:consentbanneropen', () => show(true));
  on(window, 'storage', (event) => { if (event.key === storageKey || event.key === null) load(); });
  on(document, 'focusin', (event) => {
    if (banner.hidden || banner.contains(event.target) || settings.contains(event.target) || !event.target.getBoundingClientRect) return;
    const bottom = event.target.getBoundingClientRect().bottom;
    const edge = banner.getBoundingClientRect().top;
    if (bottom > edge) window.scrollBy({ top: bottom - edge + 8, behavior: 'instant' });
  });
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  observer?.observe(banner);
  on(window, 'resize', measure);
  load();
  return () => { abort.abort(); observer?.disconnect(); show(false); if (reopen) reopen.hidden = true; if (settings.open) settings.close(); state.opener = undefined; initialized.delete(banner); };
}
