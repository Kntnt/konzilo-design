// Footer.astro's markup for a page that changes its footer while open, as the design tool's preview does.
// A test holds the two together, so a change to the component shows up here.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attributes = (pairs) => Object.entries(pairs).map(([name, value]) => (value === undefined || value === false || value === null ? '' : ` ${name}="${escapeHtml(value)}"`)).join('');
const rows = (from, to = from) => `grid-row:r${from}-start / r${to}-end`;

function band(band) {
  const row = rows(band.row);
  return `<div class="kn-footer-band"${attributes({ 'data-kn-surface': band.surface, 'data-kn-compact': band.compact || undefined, 'data-kn-band': band.row, 'data-kn-run': band.run, 'data-kn-run-start': band.runStart || undefined, 'data-kn-run-end': band.runEnd || undefined })}><div class="kn-footer-background" aria-hidden="true" style="${row}"></div>${
    band.horizontal ? `<div class="kn-footer-rule" aria-hidden="true"${attributes({ 'data-kn-only': band.horizontal })} style="${row}"></div>` : ''
  }${
    band.vertical ? `<div class="kn-footer-vertical-rule" aria-hidden="true"${attributes({ 'data-kn-edge-top': band.runStart || undefined, 'data-kn-edge-bottom': band.runEnd || undefined, 'data-kn-stop-top': band.stopTop || undefined, 'data-kn-stop-bottom': band.stopBottom || undefined })} style="${row}"></div>` : ''
  }</div>`;
}
function cell(cell) {
  const level = cell.level ?? 2;
  const list = cell.links?.length ? `<ul class="kn-footer-links">${cell.links.map((link) => `<li><a${attributes({ href: link.href, 'data-kn-consent-open': link.consentOpen || undefined, 'aria-current': link.current ? 'page' : undefined })}>${escapeHtml(link.label)}</a></li>`).join('')}</ul>` : '';
  return `<div class="kn-footer-cell"${attributes({ 'data-kn-cell': `${cell.column}${cell.row}`, 'data-kn-column': cell.column, 'data-kn-surface': cell.surface, 'data-kn-columns': cell.columns ?? 1, 'data-kn-align': cell.align, 'data-kn-compact': cell.compact || undefined, 'data-kn-own-b': cell.ownB || undefined, 'data-kn-edge-top': cell.edgeTop || undefined, 'data-kn-edge-bottom': cell.edgeBottom || undefined, 'data-kn-stack-first': cell.stackFirst || undefined, 'data-kn-stack-last': cell.stackLast || undefined })} style="${rows(cell.row, cell.row + (cell.rows ?? 1) - 1)}">${
    cell.heading ? `<h${level} data-kn-type="heading-5">${escapeHtml(cell.heading)}</h${level}>` : ''
  }${cell.text ? `<p class="kn-footer-muted">${escapeHtml(cell.text)}</p>` : ''}${list}${cell.content ?? ''}</div>`;
}
export function footerHtml(layout, { attachment = 'flow', rules = 'content' } = {}) {
  return `<footer class="kn-footer"${attributes({ 'data-kn-attachment': attachment, 'data-kn-rules': rules, 'data-kn-top-line': layout.topLine || undefined })}><div class="kn-footer-grid">${layout.bands.map(band).join('')}${layout.cells.map(cell).join('')}</div></footer>`;
}
