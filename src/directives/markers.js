// A list's markers: the attributes of one level of a list from the directive's `markers` (docs/spec/directives.md, List).
// `markers` holds a value per level, the levels apart by `/`. A value is a sign, a check or a cross, for a level of
// bullets, or a numbering for a numbered level: a numbering's last part names it, a dotted value below the first level
// puts the number of the item above before its own, and a trailing `.`, a trailing `)` or brackets around it are its
// punctuation. A level without a value of its own takes the nearest level above of its kind.

const SIGNS = { v: 'check', '✓': 'check', x: 'cross', '✗': 'cross' };
const NUMBERINGS = { 1: 'decimal', a: 'lower-latin', A: 'upper-latin', i: 'lower-roman', I: 'upper-roman', α: 'lower-greek', aa: 'double-latin' };

// What one value is: `{ sign }`, `{ numbering, punctuation, dotted }`, `null` for an empty value, or `{}` for a value
// that is neither, which gives its level nothing.
function readValue(value) {
  const text = value.trim();
  if (!text) return null;
  if (SIGNS[text]) return { sign: SIGNS[text] };
  let body = text;
  let punctuation;
  const bracketed = body.match(/^\((.+)\)$/);
  if (bracketed) [body, punctuation] = [bracketed[1], 'brackets'];
  else if (body.endsWith(')')) [body, punctuation] = [body.slice(0, -1), 'parenthesis'];
  else if (body.endsWith('.')) [body, punctuation] = [body.slice(0, -1), 'period'];
  const parts = body.split('.');
  if (parts.some((part) => !Object.hasOwn(NUMBERINGS, part))) return {};
  return { numbering: NUMBERINGS[parts.at(-1)], punctuation, dotted: parts.length > 1 };
}

/**
 * The attributes of one level of a list.
 * @param {string | undefined} markers The directive's value, such as `1/a)` or `v`.
 * @param {number} level The level, counting from 1.
 * @param {boolean} ordered True for an `<ol>`.
 * @returns {Record<string, string>} `data-kn-sign`, or `data-kn-numbering` with `data-kn-punctuation` and `data-kn-dotted`;
 *   empty where the level has no marker.
 */
export function markerAttributes(markers, level, ordered) {
  if (typeof markers !== 'string' || !(level >= 1)) return {};
  const values = markers.split('/');
  const fits = (read) => (ordered ? 'numbering' : 'sign') in read;
  let found;
  for (let at = level; at >= 1; at -= 1) {
    const read = at <= values.length ? readValue(values[at - 1]) : null;
    if (!read) continue;
    // A value of the other kind on the level itself gives it none; above, it is passed over for the nearest of its kind.
    if (fits(read)) { found = read; break; }
    if (at === level) return {};
  }
  if (!found) return {};
  if (found.sign) return { 'data-kn-sign': found.sign };
  const attributes = { 'data-kn-numbering': found.numbering };
  if (found.punctuation) attributes['data-kn-punctuation'] = found.punctuation;
  if (found.dotted && level > 1) attributes['data-kn-dotted'] = '';
  return attributes;
}
