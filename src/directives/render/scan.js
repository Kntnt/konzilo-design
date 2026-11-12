// A scanner of HTML as Astro renders a body: what stands at its top, element by element, without a parser. The HTML is
// Astro's own rendering, so a scan of its tags is enough: comments and the text of raw text elements are skipped, a void
// element has no end, and an element ends at the end tag of its name that matches it. A section takes its body from its
// slot with it (sections.js), and nothing else here needs one.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

const decode = (text) => text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|lt|gt|apos);/gi, (whole, name) => {
  const lower = name.toLowerCase();
  if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
  if (lower.startsWith('#')) return String.fromCodePoint(Number(lower.slice(1)));
  return { amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" }[lower] ?? whole;
});

/**
 * The next tag from `at`: { start, end, name, closing, void, attributes }, its attributes by name with their values
 * decoded; null after the last. A raw text element's tag ends where its text does.
 * @param {string} html
 * @param {number} at
 */
export function nextTag(html, at) {
  for (let i = html.indexOf('<', at); i !== -1; i = html.indexOf('<', i + 1)) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      if (end === -1) return null;
      i = end + 2;
      continue;
    }
    const head = /^<(\/?)([a-zA-Z][^\s/>]*)/.exec(html.slice(i, i + 64));
    if (!head) continue;
    const [, closing, tagName] = head;
    const name = tagName.toLowerCase();
    const found = {};
    let j = i + head[0].length;
    for (;;) {
      while (/\s/.test(html[j] ?? '')) j += 1;
      if (j >= html.length) return null;
      if (html[j] === '>') break;
      if (html.startsWith('/>', j)) {
        j += 1;
        break;
      }
      const attribute = /^[^\s"'>/=]+/.exec(html.slice(j))?.[0] ?? html[j];
      j += attribute.length;
      while (/\s/.test(html[j] ?? '')) j += 1;
      let value = '';
      if (html[j] === '=') {
        j += 1;
        while (/\s/.test(html[j] ?? '')) j += 1;
        const quote = html[j] === '"' || html[j] === "'" ? html[j] : null;
        const stop = quote ? html.indexOf(quote, j + 1) : j + (/^[^\s>]*/.exec(html.slice(j))[0].length);
        value = html.slice(quote ? j + 1 : j, stop === -1 ? html.length : stop);
        j = quote ? stop + 1 : stop;
      }
      found[attribute.toLowerCase()] = decode(value);
    }
    const tag = { start: i, end: j + 1, name, closing: closing === '/', void: VOID.has(name) || html[j - 1] === '/', attributes: found };
    if (!tag.closing && RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, tag.end);
      return { ...tag, textEnd: end === -1 ? html.length : end };
    }
    return tag;
  }
  return null;
}

/**
 * Where the element a start tag opens ends: { start, end } of its end tag, or of the HTML's end where it has none.
 * @param {string} html
 * @param {object} open A start tag, as nextTag() gives it.
 */
export function endOf(html, open) {
  if (open.void) return { start: open.end, end: open.end };
  let depth = 1;
  let at = open.textEnd ?? open.end;
  for (;;) {
    const tag = nextTag(html, at);
    if (!tag) return { start: html.length, end: html.length };
    at = tag.textEnd ?? tag.end;
    if (tag.name !== open.name || tag.void) continue;
    depth += tag.closing ? -1 : 1;
    if (depth === 0) return { start: tag.start, end: tag.end };
  }
}

/**
 * The elements at the top of `html`, in order: each { start, end, name, attributes, open }, `start` and `end` its
 * place in the HTML from its start tag to the end of its end tag, and `open` its start tag. Text at the top, white
 * space or not, and comments stand between them and are no element.
 * @param {string} html
 */
export function topElements(html) {
  const found = [];
  for (let at = 0; ;) {
    const tag = nextTag(html, at);
    if (!tag) return found;
    if (tag.closing) {
      at = tag.end;
      continue;
    }
    const close = endOf(html, tag);
    found.push({ start: tag.start, end: close.end, name: tag.name, attributes: tag.attributes, open: tag });
    at = close.end;
  }
}
