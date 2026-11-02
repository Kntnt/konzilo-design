import http from 'node:http';
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import {
  resolve as pathResolve,
  dirname,
  extname,
  join,
  isAbsolute,
} from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { buildPresentation, repo } from './build.js';
import { createPdf } from './pdf.js';
import {
  defaultInputs,
  resolve,
  validateDesignFile,
  checkContrast,
} from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';

export async function loadDesign(path) {
  try {
    const file = JSON.parse(await readFile(path, 'utf8'));
    const resolved = await resolve(file.inputs);
    validateDesignFile({ ...file, resolved });
    return {
      inputs: withDefaults(file.inputs),
      project: { version: '1.0', ...file.project },
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const inputs = defaultInputs();
    inputs.typefaces.main = 'Mona Sans';
    return {
      inputs,
      project: { name: 'Example', version: '1.0', logo: null, 'logo-dark': null },
    };
  }
}
async function embedLogos(model, path) {
  model = structuredClone(model);
  for (const key of ['logo', 'logo-dark']) {
    const value = model.project[key];
    if (!value || value.startsWith('data:')) continue;
    if (isAbsolute(value) || /^[a-z]+:/i.test(value))
      throw new Error(`${key}: use a data URI or a relative SVG/PNG path`);
    const target = pathResolve(dirname(path), value);
    const extension = extname(target).toLowerCase();
    if (!['.svg', '.png'].includes(extension))
      throw new Error(`${key}: expected SVG or PNG`);
    model.project[key] =
      `data:${extension === '.svg' ? 'image/svg+xml' : 'image/png'};base64,${(await readFile(target)).toString('base64')}`;
  }
  return model;
}
export async function saveDesign(path, model) {
  const resolved = await resolve(model.inputs);
  checkContrast(resolved);
  const file = { inputs: model.inputs, project: model.project, resolved };
  validateDesignFile(file);
  await mkdir(dirname(path), { recursive: true });
  // Rename a complete sibling file so an interrupted save cannot truncate the source.
  const temporary = `${path}.saving-${randomBytes(6).toString('hex')}`;
  try {
    await writeFile(temporary, JSON.stringify(file, null, 2) + '\n', {
      flag: 'wx',
    });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  return file;
}
function openBrowser(url) {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}
export async function startTool({
  designFile = 'design.design.json',
  port = 4174,
  open = true,
} = {}) {
  const path = pathResolve(designFile);
  let model = await loadDesign(path);
  const previewDir = join(repo, 'node_modules/.cache/konzilo-tool');
  const { preview } = await buildPresentation({ output: previewDir });
  const token = randomBytes(24).toString('hex');
  let lastPdf;
  let busy = false;
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  const server = http.createServer(async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    try {
      const host = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== host) {
        json(403, { error: 'Use the loopback address printed by the tool.' });
        return;
      }
      if (req.headers.origin && req.headers.origin !== `http://${host}`) {
        json(403, { error: 'Cross-origin request refused.' });
        return;
      }
      const url = new URL(req.url, `http://${host}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET' && url.pathname === '/api/state') {
        json(200, { ...(await embedLogos(model, path)), token });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/preview.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(preview);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/pdf-file') {
        if (!lastPdf) {
          json(404, { error: 'Create a PDF first.' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
        });
        res.end(await readFile(lastPdf));
        return;
      }
      if (
        req.method === 'POST' &&
        ['/api/save', '/api/pdf'].includes(url.pathname)
      ) {
        if (
          req.headers['x-konzilo-token'] !== token ||
          !req.headers['content-type']?.startsWith('application/json')
        ) {
          json(403, { error: 'Invalid local session.' });
          return;
        }
        if (busy) {
          json(409, { error: 'A PDF is already being created.' });
          return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 15 * 1024 * 1024)
            throw new Error('Design file exceeds 15 MB.');
        }
        const incoming = JSON.parse(body);
        await saveDesign(path, incoming);
        model = { inputs: incoming.inputs, project: incoming.project };
        if (url.pathname === '/api/save') {
          json(200, { path });
          return;
        }
        busy = true;
        try {
          const pdf = await createPdf(path);
          lastPdf = pdf.path;
          json(200, pdf);
        } finally {
          busy = false;
        }
        return;
      }
      if (req.method !== 'GET') {
        json(405, { error: 'Method not allowed.' });
        return;
      }
      const pathname = url.pathname === '/' ? '/tool/index.html' : url.pathname;
      const allowed =
        /^\/(?:tool\/(?:index\.html|style\.css|app\.js|logic\.js)|src\/(?:generator|css)\/[a-z-]+\.js|schema\/design-file\.schema\.json|package\.json|gallery\/src\/tooltips\.js|presentation\/src\/samples\.js)$/;
      if (!allowed.test(pathname)) {
        json(404, { error: 'Not found.' });
        return;
      }
      const source = await readFile(join(repo, pathname.slice(1)));
      res.writeHead(200, {
        'Content-Type': mime[extname(pathname)] || 'application/octet-stream',
      });
      res.end(source);
    } catch (error) {
      if (!res.headersSent) json(400, { error: error.message });
      else res.end();
    }
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', done);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  if (open) openBrowser(url);
  return {
    server,
    url,
    path,
    close: () =>
      new Promise((done, fail) =>
        server.close((error) => (error ? fail(error) : done())),
      ),
  };
}
