// Reject values JSON would silently discard or coerce, rather than fingerprinting a different input.
export function canonicalJson(value) {
  const ancestors = new Set();
  const encode = (v) => {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (typeof v !== 'object' || v === null || ancestors.has(v)) throw new TypeError('Inputs must be finite, acyclic JSON');
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new TypeError('Inputs must be plain JSON objects');
    ancestors.add(v);
    let result;
    if (Array.isArray(v)) {
      if (Object.keys(v).length !== v.length) throw new TypeError('Inputs must not contain sparse arrays');
      result = '[' + Array.from(v, encode).join(',') + ']';
    } else {
      result = '{' + Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${encode(v[k])}`).join(',') + '}';
    }
    ancestors.delete(v);
    return result;
  };
  return encode(value);
}

export async function fingerprint(inputs) {
  const data = new TextEncoder().encode(canonicalJson(inputs));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkFingerprint(file) {
  if (!file?.resolved || await fingerprint(file.inputs) !== file.resolved['inputs-fingerprint']) {
    throw new Error('Inputs fingerprint mismatch; resolve the design file again');
  }
  return true;
}
