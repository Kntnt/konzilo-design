// Visitor Filters' pure helpers, for the build and for a site's own server. The component runs no client code
// (docs/spec/principles.md, HTML and CSS, not JavaScript): its pills and select filter the items on the page by CSS
// (visitor-filters.css), and its form submits as an ordinary GET form, which `parseState` reads on the server.
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
// Filtering by CSS (the assistant's choice, 2026-11-10). A stylesheet cannot compare a control's value with an
// item's, so each control carries a key the stylesheet knows in advance: its group's place in the form and its value's
// place in the group, both from 1, as `g-v`. An item carries the keys of every value it has, and visitor-filters.css
// holds one rule a group and one alternative a value, up to these limits.
export const FILTER_GROUPS = 3;
export const FILTER_VALUES = 24;
// The groups in the form's order: each pill group, then the select. A select's empty option, "All", has no key.
export const filterGroups = ({ toggles = [], select } = {}) => [...toggles, ...(select ? [select] : [])];
export function filterKeys(groups) {
  if (groups.length > FILTER_GROUPS) throw new RangeError(`Visitor Filters filters by CSS with at most ${FILTER_GROUPS} groups`);
  return new Map(groups.map((group, g) => {
    const values = [...new Set(group.options.map((option) => option.value).filter(Boolean))];
    if (values.length > FILTER_VALUES) throw new RangeError(`Visitor Filters filters by CSS with at most ${FILTER_VALUES} values a group`);
    return [group.name, new Map(values.map((value, v) => [value, `${g + 1}-${v + 1}`]))];
  }));
}
// An item's `data-kn-matches`: the keys of its values, in the groups' order.
export function itemMatches(keys, filters = {}) {
  return [...keys].flatMap(([name, values]) => {
    const carried = filters[name] ?? [];
    return [...values].filter(([value]) => (Array.isArray(carried) ? carried : [carried]).includes(value)).map(([, key]) => key);
  }).join(' ');
}
