import http from 'node:http';
import { access, readFile, readdir, writeFile, rename, mkdir, mkdtemp, rm, unlink } from 'node:fs/promises';
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
import { newDesign, backUp } from './new-design.js';
import { writeDesignMd } from './design-md.js';
import { createPresentation } from './presentation.js';
import {
  resolve,
  validateDesignFile,
  checkContrast,
} from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { withKeptLogos } from './logic.js';
import { componentsCss } from '../src/css/components.js';
import { PICTURE_SLOTS } from '../presentation/src/samples.js';
import { OWN_PICTURES_PATH, ownPictureUrls, readOwnPicture, removeOwnPicture, saveOwnPicture } from '../presentation/own-pictures.mjs';

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
    return newDesign();
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
// A save that would change nothing does not touch the file, so `beforeWrite` runs only for a real write.
export async function saveDesign(path, model, { beforeWrite } = {}) {
  const resolved = await resolve(model.inputs);
  checkContrast(resolved);
  const file = { inputs: model.inputs, project: model.project, resolved };
  validateDesignFile(file);
  const text = JSON.stringify(file, null, 2) + '\n';
  if ((await readFile(path, 'utf8').catch(() => null)) === text) return file;
  await mkdir(dirname(path), { recursive: true });
  await beforeWrite?.();
  // Rename a complete sibling file so an interrupted save cannot truncate the source.
  const temporary = `${path}.saving-${randomBytes(6).toString('hex')}`;
  try {
    await writeFile(temporary, text, {
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
// The words the document uses: the presentation's copy and the design's own override.
export async function loadCopy(path) {
  const copy = JSON.parse(await readFile(join(repo, 'presentation/copy.json'), 'utf8'));
  try {
    const custom = JSON.parse(await readFile(`${path.replace(/\.[^/.]+$/, '')}.copy.json`, 'utf8'));
    for (const [key, value] of Object.entries(custom))
      if (Object.hasOwn(copy, key) && typeof value === 'string') copy[key] = value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return copy;
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
// A folder per run, so a second tool or a test run cannot pull the preview from under this one.
// Runs stopped from outside leave theirs behind, and the next start sweeps them.
async function previewFolder() {
  const cache = join(repo, 'node_modules/.cache');
  await mkdir(cache, { recursive: true });
  const running = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code === 'EPERM';
    }
  };
  for (const name of await readdir(cache)) {
    const pid = /^konzilo-tool-(\d+)-/.exec(name)?.[1];
    if (pid && !running(Number(pid))) await rm(join(cache, name), { recursive: true, force: true });
  }
  return mkdtemp(join(cache, `konzilo-tool-${process.pid}-`));
}

export async function startTool({ designFile, port = 4174, open = true }) {
  const path = pathResolve(designFile);
  const created = !(await access(path).then(() => true, () => false));
  let model = await loadDesign(path);
  // One backup a run: what the file held when this run first changed it. A file this run made has nothing to keep.
  let backedUp = created;
  const previewDir = await previewFolder();
  const { preview, catalogue } = await buildPresentation({ output: previewDir });
  const copy = await loadCopy(path);
  const components = await componentsCss();
  const token = randomBytes(24).toString('hex');
  let lastPresentation;
  let busy = false;
  // Writes take their turn in the order they came, and the state waits for them: a window reloaded
  // just after a change has to find that change, and the save it sent going away must not lose to an earlier one.
  let writes = Promise.resolve();
  const inTurn = (write) => {
    const turn = writes.then(write);
    writes = turn.catch(() => {});
    return turn;
  };
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
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
        await writes;
        json(200, { ...(await embedLogos(model, path)), token, copy, path, pictures: await ownPictureUrls(path) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/tool/components.css') {
        res.writeHead(200, { 'Content-Type': mime['.css'] });
        res.end(components);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/preview.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(preview);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/catalogue.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(catalogue);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/presentation-file') {
        if (!lastPresentation) {
          json(404, { error: 'Create a presentation first.' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'inline',
        });
        res.end(lastPresentation);
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith(OWN_PICTURES_PATH)) {
        const picture = await readOwnPicture(path, url.pathname.slice(OWN_PICTURES_PATH.length));
        if (!picture) {
          json(404, { error: 'Not found.' });
          return;
        }
        // The address has a version, and a picture fetched again is a picture decoded again.
        res.writeHead(200, { 'Content-Type': picture.type, 'Cache-Control': 'max-age=3600' });
        res.end(picture.bytes);
        return;
      }
      if (url.pathname === '/api/picture' && ['POST', 'DELETE'].includes(req.method)) {
        const slot = url.searchParams.get('slot');
        if (req.headers['x-konzilo-token'] !== token) {
          json(403, { error: 'Invalid local session.' });
          return;
        }
        if (!PICTURE_SLOTS.includes(slot)) {
          json(400, { error: 'Unknown picture place.' });
          return;
        }
        if (req.method === 'DELETE') await removeOwnPicture(path, slot);
        else {
          const parts = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 15 * 1024 * 1024) throw new Error('A picture may be at most 15 MB.');
            parts.push(chunk);
          }
          await saveOwnPicture(path, slot, Buffer.concat(parts));
        }
        json(200, { pictures: await ownPictureUrls(path) });
        return;
      }
      if (
        req.method === 'POST' &&
        ['/api/save', '/api/presentation', '/api/design-md'].includes(url.pathname)
      ) {
        if (
          req.headers['x-konzilo-token'] !== token ||
          !req.headers['content-type']?.startsWith('application/json')
        ) {
          json(403, { error: 'Invalid local session.' });
          return;
        }
        if (busy) {
          json(409, { error: 'A presentation is already being created.' });
          return;
        }
        await inTurn(async () => {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 15 * 1024 * 1024)
              throw new Error('Design file exceeds 15 MB.');
          }
          const incoming = withKeptLogos(JSON.parse(body), model.project);
          await saveDesign(path, incoming, {
            beforeWrite: async () => {
              if (!backedUp) await backUp(path);
              backedUp = true;
            },
          });
          model = { inputs: incoming.inputs, project: incoming.project };
        });
        if (url.pathname === '/api/save') {
          json(200, { path });
          return;
        }
        if (url.pathname === '/api/design-md') {
          json(200, { path: await writeDesignMd(path) });
          return;
        }
        busy = true;
        try {
          const { html, ...report } = await createPresentation(path, undefined, { includeHtml: true });
          lastPresentation = html;
          json(200, report);
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
        /^\/(?:presentation\/pictures\/[a-z0-9-]+\.webp|tool\/(?:index\.html|style\.css|app\.js|logic\.js|history\.js|pages\.js|preview\.js)|src\/(?:generator|css)\/[a-z-]+\.js|src\/design-md\/components\.js|presentation\/src\/(?:catalog|looks)\.js|src\/fonts\/(?:fonts\.css|catalog\.js|[A-Za-z0-9-]+\.woff2)|schema\/design-file\.schema\.json|package\.json|gallery\/src\/tooltips\.js|presentation\/src\/samples\.js)$/;
      if (!allowed.test(pathname)) {
        json(404, { error: 'Not found.' });
        return;
      }
      const source = await readFile(join(repo, pathname.slice(1)));
      res.writeHead(200, {
        'Content-Type': mime[extname(pathname)] || 'application/octet-stream',
        ...(extname(pathname) === '.webp' ? { 'Cache-Control': 'max-age=3600' } : {}),
      });
      res.end(source);
    } catch (error) {
      if (!res.headersSent) json(400, { error: error.message });
      else res.end();
    }
  });
  await new Promise((done, fail) => {
    server.once('error', (error) =>
      fail(
        error.code === 'EADDRINUSE'
          ? new Error(`Port ${port} is in use, probably by another copy of the tool. Stop that one, or choose another port with --port.`)
          : error,
      ),
    );
    server.listen(port, '127.0.0.1', done);
  });
  if (created)
    await saveDesign(path, model).catch((error) => {
      server.close();
      throw error;
    });
  const url = `http://127.0.0.1:${server.address().port}`;
  if (open) openBrowser(url);
  return {
    server,
    url,
    path,
    created,
    close: async () => {
      await new Promise((done, fail) =>
        server.close((error) => (error ? fail(error) : done())),
      );
      await rm(previewDir, { recursive: true, force: true });
    },
  };
}
