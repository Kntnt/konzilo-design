// A host for the browser tests, on a free port of this computer, as a site's host serves it: the pages in `pages`, a Map
// of an address's path to its HTML, and the files below `root`, each with its type, a folder by its index.html. Anything
// else is not found, with the site's 404.html where it has one. Returns its origin, and close().
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

export function serve(root, { pages = new Map() } = {}) {
  const base = resolve(root);
  const server = createServer((request, response) => {
    const address = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pages.has(address)) {
      response.writeHead(200, { 'content-type': TYPES['.html'] });
      response.end(pages.get(address));
      return;
    }
    let path = normalize(join(base, address));
    if (path !== base && !path.startsWith(base + sep)) path = null;
    else if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (path === null || !existsSync(path)) {
      const missing = join(base, '404.html');
      response.writeHead(404, { 'content-type': TYPES['.html'] });
      response.end(existsSync(missing) ? readFileSync(missing) : '');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    response.end(readFileSync(path));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((closed) => server.close(closed)),
  })));
}
