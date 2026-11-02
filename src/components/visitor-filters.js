export const normaliseText = (text = '') => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export function matchItem(item, { q = '', filters = {} } = {}) {
  const text = normaliseText(item.text ?? item.searchText ?? '');
  if (!normaliseText(q).split(/\s+/).filter(Boolean).every((word) => text.includes(word))) return false;
  return Object.entries(filters).every(([name, values]) => {
    const asked = Array.isArray(values) ? values : [values];
    const carried = item.filters?.[name] ?? [];
    return !asked.length || asked.some((value) => (Array.isArray(carried) ? carried : [carried]).includes(value));
  });
}
export const filterItems = (items, state) => items.filter((item) => matchItem(item, state));
export function paginate(items, page = 1, size = 10) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Page size must be a positive integer');
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}
// Allowlist names and stable values belong to the supplied controls. Repeated
// values have OR semantics; canonical order makes equivalent URLs repeatable.
export function parseState(query = '', allowed = {}) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(String(query).replace(/^\?/, ''));
  const filters = {};
  for (const name of Object.keys(allowed).sort()) {
    if (['q', 'page', '__proto__', 'constructor', 'prototype'].includes(name)) continue;
    const values = [...new Set(params.getAll(name).filter((value) => value && allowed[name].includes(value)))].sort();
    if (values.length) Object.defineProperty(filters, name, { value: values, enumerable: true });
  }
  const number = params.get('page') ?? '1';
  const page = /^[1-9]\d*$/.test(number) && Number.isSafeInteger(Number(number)) ? Number(number) : 1;
  return { q: (params.get('q') ?? '').trim(), filters, page };
}
export function serialiseState(state, base = '', names = Object.keys(state.filters ?? {})) {
  const params = base instanceof URLSearchParams ? new URLSearchParams(base) : new URLSearchParams(String(base).replace(/^\?/, ''));
  params.delete('q'); params.delete('page');
  names.forEach((name) => params.delete(name));
  if (state.q?.trim()) params.set('q', state.q.trim());
  for (const name of Object.keys(state.filters ?? {}).sort()) {
    for (const value of [...new Set(state.filters[name])].filter(Boolean).sort()) params.append(name, value);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params.toString();
}
export function paginationStops(page, pages, reach = 2) {
  const shown = [...new Set([1, pages, ...Array.from({ length: 2 * reach + 1 }, (_, i) => page - reach + i)])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return shown.flatMap((n, i) => i && n - shown[i - 1] > 1 ? [null, n] : [n]);
}
export function paginationModel({ page, pages, previous = 'Previous', next = 'Next', pageLabel = 'Page' }) {
  if (pages <= 1) return [];
  return [
    ...(page > 1 ? [{ page: page - 1, text: previous, label: previous }] : []),
    ...paginationStops(page, pages).map((n) => n === null ? { text: '…' } : { page: n, text: String(n), label: `${pageLabel} ${n}`, current: n === page }),
    ...(page < pages ? [{ page: page + 1, text: next, label: next }] : []),
  ];
}
export function pageAddress(address, state, page) {
  const [path, hash] = address.split('#');
  const [base, query = ''] = path.split('?');
  const search = serialiseState({ ...state, page }, query);
  return `${base}${search ? `?${search}` : ''}${hash === undefined ? '' : `#${hash}`}`;
}
export const isPrimaryClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const initialized = new WeakSet();
export function setupVisitorFilters(root = document) {
  if (typeof window === 'undefined') return () => {};
  const forms = [...root.querySelectorAll('form.kn-visitor-filters')];
  const allowed = {};
  forms.forEach((form) => {
    for (const control of form.querySelectorAll('[data-kn-filter-name]')) {
      const name = control.dataset.knFilterName;
      const values = control.tagName === 'SELECT' ? [...control.options].map((option) => option.value) : [control.value];
      allowed[name] = [...new Set([...(allowed[name] ?? []), ...values.filter(Boolean)])];
    }
  });
  let sharedState = parseState(window.location.search, allowed);
  const disposers = forms.filter((form) => !initialized.has(form)).map((form) => {
    const loop = document.getElementById(form.dataset.knFor);
    if (!loop) return () => {};
    initialized.add(form);
    form.setAttribute('data-kn-enhanced', '');
    const abort = new AbortController();
    const nodes = [...loop.querySelectorAll('[data-kn-item]')];
    const items = nodes.map((node) => ({ node, text: node.dataset.knText ?? node.textContent, filters: JSON.parse(node.dataset.knFilter ?? '{}') }));
    const search = form.querySelector('input[type="search"]');
    const toggles = [...form.querySelectorAll('button[data-kn-filter-name]')];
    const selects = [...form.querySelectorAll('select[data-kn-filter-name]')];
    const names = [...new Set([...toggles, ...selects].map((control) => control.dataset.knFilterName))];
    const status = form.querySelector('[data-kn-result-count]');
    const empty = loop.querySelector('.kn-content-loop-empty');
    const host = form.querySelector('[data-kn-pagination-host]');
    if (host) loop.after(host);
    const size = Number(form.dataset.knPageSize);
    let page = 1;
    function restore() {
      const state = sharedState;
      if (search) search.value = state.q;
      toggles.forEach((control) => control.setAttribute('aria-pressed', String(state.filters[control.name]?.includes(control.value) ?? false)));
      selects.forEach((control) => { control.value = state.filters[control.name]?.[0] ?? ''; });
      page = state.page;
      draw(false);
    }
    function state() {
      const filters = {};
      toggles.filter((control) => control.getAttribute('aria-pressed') === 'true').forEach((control) => (filters[control.name] ??= []).push(control.value));
      selects.filter((control) => control.value).forEach((control) => { filters[control.name] = [control.value]; });
      return { q: search?.value ?? '', filters, page };
    }
    function draw(write = true) {
      const local = state();
      const found = filterItems(items, local);
      const result = size > 0 ? paginate(found, page, size) : { items: found, page: 1, pages: 1 };
      page = result.page;
      const shown = new Set(result.items);
      items.forEach((item) => { item.node.hidden = !shown.has(item); });
      loop.querySelectorAll('[data-kn-content-group]').forEach((group) => {
        group.hidden = !items.some((item) => item.node.dataset.knGroup === group.dataset.knContentGroup && !item.node.hidden);
      });
      if (empty) empty.hidden = found.length > 0;
      if (status) status.textContent = form.dataset.knCountText.replace('{count}', String(found.length)).replace('{total}', String(items.length));
      // Preserve the independent panels' allowlisted selections. A panel owns
      // only its names; any filter change resets the one shared page position.
      const current = { ...sharedState, filters: { ...sharedState.filters } };
      names.forEach((name) => delete current.filters[name]);
      Object.assign(current.filters, local.filters);
      if (search) current.q = local.q;
      current.page = size > 0 ? page : (write ? 1 : current.page);
      const query = serialiseState(current);
      if (write) {
        sharedState = current;
        try { window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`); } catch { /* Sandboxes and file previews may refuse history. */ }
        window.dispatchEvent(new Event('kn:filterschange'));
      }
      host?.replaceChildren();
      const model = paginationModel({ page, pages: result.pages, previous: form.dataset.knPrevious, next: form.dataset.knNext, pageLabel: form.dataset.knPageLabel });
      if (host && model.length) {
        const nav = document.createElement('nav'); nav.className = 'kn-pagination'; nav.setAttribute('aria-label', form.dataset.knPaginationLabel);
        const list = document.createElement('ul');
        for (const stop of model) {
          const li = document.createElement('li');
          if (stop.page) {
            const link = document.createElement('a'); link.textContent = stop.text; link.setAttribute('aria-label', stop.label);
            link.href = pageAddress(`${window.location.pathname}${window.location.hash}`, current, stop.page);
            link.dataset.knPage = String(stop.page);
            if (stop.current) link.setAttribute('aria-current', 'page');
            li.append(link);
          } else { li.textContent = stop.text; li.setAttribute('aria-hidden', 'true'); }
          list.append(li);
        }
        nav.append(list); host.append(nav);
      }
    }
    const changed = () => { page = 1; draw(); };
    form.addEventListener('input', changed, { signal: abort.signal });
    form.addEventListener('change', changed, { signal: abort.signal });
    form.addEventListener('submit', (event) => { event.preventDefault(); changed(); }, { signal: abort.signal });
    form.addEventListener('click', (event) => {
      const toggle = event.target.closest('button[data-kn-filter-name]');
      if (toggle) { event.preventDefault(); toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true')); changed(); }
    }, { signal: abort.signal });
    host?.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-kn-page]');
      if (link && isPrimaryClick(event)) {
        event.preventDefault(); page = Number(link.dataset.knPage); draw();
        // Keep keyboard focus on a surviving link after the pager is replaced.
        host.querySelector(`[data-kn-page="${page}"][aria-current]`)?.focus({ preventScroll: true });
        loop.scrollIntoView({ block: 'start' });
      }
    }, { signal: abort.signal });
    window.addEventListener('popstate', () => { sharedState = parseState(window.location.search, allowed); restore(); }, { signal: abort.signal });
    window.addEventListener('kn:filterschange', () => restore(), { signal: abort.signal });
    restore();
    return () => { abort.abort(); form.removeAttribute('data-kn-enhanced'); loop.querySelectorAll('[data-kn-content-group]').forEach((group) => { group.hidden = false; }); nodes.forEach((node) => { node.hidden = false; }); initialized.delete(form); };
  });
  return () => disposers.forEach((dispose) => dispose());
}
