// Footer.astro's markup for a page that changes its footer while open, as the design tool's preview does.
// A test holds the two together, so a change to the component shows up here.
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attributes = (pairs) => Object.entries(pairs).map(([name, value]) => (value === undefined || value === false || value === null ? '' : ` ${name}="${escapeHtml(value)}"`)).join('');

function cell(cell) {
  const level = cell.level ?? 2;
  const list = cell.links?.length ? `<ul class="kn-footer-links">${cell.links.map((link) => `<li><a${attributes({ href: link.href, 'data-kn-consent-open': link.consentOpen || undefined, 'aria-current': link.current ? 'page' : undefined })}>${escapeHtml(link.label)}</a></li>`).join('')}</ul>` : '';
  return `<div class="kn-footer-cell"${attributes({ 'data-kn-cell': cell.name, 'data-kn-column': cell.column, 'data-kn-columns': cell.columns, 'data-kn-row': cell.row })}><div class="kn-footer-box">${
    cell.heading ? `<h${level} data-kn-type="heading-5">${escapeHtml(cell.heading)}</h${level}>` : ''
  }${cell.text ? `<p class="kn-footer-muted">${escapeHtml(cell.text)}</p>` : ''}${list}${cell.content ?? ''}</div></div>`;
}
function band(band) {
  return `<div class="kn-footer-band"${attributes({ 'data-kn-band': band.name, 'data-kn-surface': band.surface, 'data-kn-rows': band.rows, 'data-kn-joined': band.joined || undefined })}>${
    band.join ? '<div class="kn-footer-rule" aria-hidden="true" data-kn-join="true"></div>' : ''
  }${band.horizontal ? `<div class="kn-footer-rule" aria-hidden="true"${attributes({ 'data-kn-only': band.horizontal })}></div>` : ''}${
    band.vertical ? `<div class="kn-footer-vertical-rule" aria-hidden="true"${attributes({ 'data-kn-row': band.vertical })}></div>` : ''
  }${band.cells.map(cell).join('')}</div>`;
}
export function footerHtml(layout, { attachment = 'flow', rules = 'content' } = {}) {
  if (!layout.bands.length) return '';
  return `<footer class="kn-footer"${attributes({ 'data-kn-attachment': attachment, 'data-kn-rules': rules })}>${layout.bands.map(band).join('')}</footer>`;
}
