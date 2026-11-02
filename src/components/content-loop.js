// Excerpts admit search-hit marks only; all other markup remains literal text.
export function excerptHtml(text = '') {
  return String(text).split(/(<\/?mark>)/g).map((part) => /^<\/?mark>$/.test(part) ? part : part.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')).join('');
}
