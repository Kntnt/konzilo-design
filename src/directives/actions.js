// Actions: the services the design knows, whose links it draws as their icons (docs/spec/directives.md, Actions).

// Each service by its name, `data-kn-service`, with the hosts whose links are its, and its icon in icons.js.
export const SERVICES = Object.freeze({
  linkedin: Object.freeze({ hosts: Object.freeze(['linkedin.com']), icon: 'linkedin' }),
  facebook: Object.freeze({ hosts: Object.freeze(['facebook.com']), icon: 'facebook' }),
  instagram: Object.freeze({ hosts: Object.freeze(['instagram.com']), icon: 'instagram' }),
  youtube: Object.freeze({ hosts: Object.freeze(['youtube.com', 'youtu.be']), icon: 'youtube' }),
  x: Object.freeze({ hosts: Object.freeze(['x.com', 'twitter.com']), icon: 'brand-x' }),
});

/**
 * The service a link leads to, by its host or a subdomain of it.
 * @param {string} href The link's address.
 * @returns {{ service: string, icon: string } | null}
 */
export function serviceOf(href) {
  let host;
  try {
    const url = new URL(String(href ?? ''));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    host = url.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
  for (const [service, { hosts, icon }] of Object.entries(SERVICES)) {
    if (hosts.some((known) => host === known || host.endsWith(`.${known}`))) return { service, icon };
  }
  return null;
}
