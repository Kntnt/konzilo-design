import http from 'node:http';
import { access, readFile, readdir, writeFile, rename, mkdir, mkdtemp, rm, unlink } from 'node:fs/promises';
import {
  resolve as pathResolve,
  basename,
  dirname,
  extname,
  join,
  isAbsolute,
} from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { watch } from 'node:fs';
import { userInfo } from 'node:os';
import { openBrowser } from './browser.js';
import { acceptLive, refuse } from './live.js';
import { buildPresentation, repo } from './build.js';
import { newDesign, backUp } from './new-design.js';
import { writeDesignMd } from './design-md.js';
import { createPresentation } from './presentation.js';
import {
  DESIGN_FORMAT,
  resolve,
  validateDesignFile,
  withFormat,
  checkContrast,
} from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { withKeptLogos } from './logic.js';
import { componentsCss } from '../src/css/components.js';
import { PICTURE_SLOTS } from '../presentation/src/samples.js';
import { OWN_PICTURES_PATH, ownPictureUrls, readOwnPicture, removeOwnPicture, saveOwnPicture } from '../presentation/own-pictures.mjs';
import { copyFor } from '../presentation/copy-override.mjs';

export async function loadDesign(path) {
  try {
    // A file from before formats had numbers opens as it is, and its next save writes the number.
    const file = withFormat(JSON.parse(await readFile(path, 'utf8')));
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
  const file = { format: DESIGN_FORMAT, inputs: model.inputs, project: model.project, resolved };
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
// The words the document uses: the presentation's copy and the design's own override, read as the presentation
// reads them, so a copy file the presentation would refuse stops the tool at its start, with the same message.
export const loadCopy = (path) => copyFor(path);
// What a window's save builds on: the design file's text as the window last saw it, as a hash. A save made
// on another text is refused, whoever changed the file since: another window, a restore, a script or git.
export const revisionOf = (text) => (text === null ? 'none' : createHash('sha256').update(text).digest('hex').slice(0, 20));
export async function revisionOnDisk(path) {
  const text = await readFile(path, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return revisionOf(text);
}
const userName = () => {
  try {
    return userInfo().username;
  } catch {
    return String(process.getuid?.() ?? '');
  }
};
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

// Serves one design file. Called by itself it runs until `close()`; `tool/serve.js`, which `design-tool` starts,
// also gives it `idle`, the milliseconds without a window before `onIdle` is called, and `stopKey`, which lets
// `POST /api/stop` stop it from the command line. `backedUp` says that this run's backup is already made,
// by the server this one replaces, and `code` is what that command took the code's state to be.
export async function startTool({ designFile, port = 4174, open = true, idle, onIdle, stopKey, onStop, backedUp: inherited = false, code = '' }) {
  const path = pathResolve(designFile);
  const created = !(await access(path).then(() => true, () => false));
  let model = await loadDesign(path);
  // The file's text that `model` holds. When the file has changed outside the tool, the state is read anew from it.
  let known = await revisionOnDisk(path);
  // One backup a run: what the file held when this run first changed it. A file this run made has nothing to keep.
  let backedUp = created || inherited;
  // Before the preview's build, so a copy file to fix says so at once.
  const copy = await loadCopy(path);
  const previewDir = await previewFolder();
  const { preview, catalogues } = await buildPresentation({ output: previewDir });
  const components = await componentsCss();
  const token = randomBytes(24).toString('hex');
  const started = new Date().toISOString();
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
  // The last file this server wrote, and which window it was for: that window may send its next save before
  // the answer to the last has reached it, and that one builds on its own change.
  let written = { revision: null, window: null };
  // The windows open now, by their live lines; with none for `idle`, the server is not needed.
  const windows = new Set();
  const broadcast = (message) => {
    for (const window of windows) window.send(message);
  };
  let stopping = false;
  let idleTimer = null;
  const waitForWindows = () => {
    clearTimeout(idleTimer);
    if (idle !== undefined && !windows.size && !stopping) idleTimer = setTimeout(() => onIdle?.(), idle);
  };
  // What a request that changes something is doing, so stopping can let it finish.
  const tasks = new Set();
  const drain = async () => {
    stopping = true;
    clearTimeout(idleTimer);
    while (tasks.size) await Promise.allSettled([...tasks]);
    await writes;
  };
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
  };
  const handle = async (req, res) => {
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
      if (req.method === 'GET' && url.pathname === '/api/hello') {
        // How `design-tool` finds the tool that has a file open. It holds nothing a window needs to save.
        json(200, { app: 'konzilo-design-tool', path, pid: process.pid, user: userName(), code, started, windows: windows.size });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/stop') {
        if (!stopKey || req.headers['x-konzilo-stop'] !== stopKey) {
          json(403, { error: 'Only the design-tool command stops the tool.' });
          return;
        }
        await drain();
        broadcast({ type: url.searchParams.get('restart') === '1' ? 'restarting' : 'stopped' });
        // The answer first, so the command learns about the backup before the server goes.
        res.once('finish', () => onStop?.());
        json(200, { backedUp });
        return;
      }
      if (req.method !== 'GET' && stopping) {
        json(503, { error: 'The tool is stopping.' });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        await writes;
        const revision = await revisionOnDisk(path);
        if (revision !== known) {
          model = await loadDesign(path);
          known = revision;
        }
        json(200, { ...(await embedLogos(model, path)), token, copy, path, revision, pictures: await ownPictureUrls(path) });
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
      // Each component page of the tool has a preview of its own.
      const catalogue = req.method === 'GET' && /^\/catalogue\/([a-z]+)\.html$/.exec(url.pathname)?.[1];
      if (catalogue && Object.hasOwn(catalogues, catalogue)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(catalogues[catalogue]);
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
        broadcast({ type: 'pictures', by: req.headers['x-konzilo-window'] });
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
        const window = req.headers['x-konzilo-window'] || null;
        const base = req.headers['x-konzilo-base'];
        const saved = await inTurn(async () => {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 15 * 1024 * 1024)
              throw new Error('Design file exceeds 15 MB.');
          }
          const now = await revisionOnDisk(path);
          if (base !== now && !(window && written.revision === now && written.window === window)) return { conflict: now };
          const incoming = withKeptLogos(JSON.parse(body), model.project);
          await saveDesign(path, incoming, {
            beforeWrite: async () => {
              if (!backedUp) await backUp(path);
              backedUp = true;
            },
          });
          model = { inputs: incoming.inputs, project: incoming.project };
          const revision = await revisionOnDisk(path);
          known = revision;
          if (revision !== now) {
            written = { revision, window };
            broadcast({ type: 'saved', revision, by: window });
          }
          return { revision };
        });
        if (saved.conflict) {
          json(409, { error: 'The design file has changed since this window last read it.', conflict: saved.conflict });
          return;
        }
        const { revision } = saved;
        if (url.pathname === '/api/save') {
          json(200, { path, revision });
          return;
        }
        if (url.pathname === '/api/design-md') {
          json(200, { path: await writeDesignMd(path), revision });
          return;
        }
        busy = true;
        try {
          const { html, ...report } = await createPresentation(path, undefined, { includeHtml: true });
          lastPresentation = html;
          json(200, { ...report, revision });
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
        /^\/(?:presentation\/pictures\/[a-z0-9-]+\.webp|tool\/(?:index\.html|style\.css|app\.js|logic\.js|history\.js|pages\.js|preview\.js)|src\/(?:generator|css)\/[a-z-]+\.js|src\/design-md\/components\.js|src\/directives\/surfaces\.js|presentation\/src\/(?:catalog|catalogue|page-sketch)\.js|presentation\/src\/page-sketch\.css|src\/fonts\/(?:fonts\.css|catalog\.js|[A-Za-z0-9-]+\.woff2)|schema\/design-file\.schema\.json|package\.json|gallery\/src\/tooltips\.js|presentation\/src\/samples\.js)$/;
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
  };
  const server = http.createServer((req, res) => {
    const task = handle(req, res);
    // Stopping waits for what changes something, but not for the request that stops.
    if (req.method !== 'GET' && !req.url.startsWith('/api/stop')) {
      tasks.add(task);
      task.finally(() => tasks.delete(task));
    }
  });
  server.on('upgrade', (req, socket, head) => {
    // The request handler's checks do not reach an upgrade, so they are made again here.
    const host = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== `http://${host}`)) return refuse(socket, 403);
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname !== '/api/live') return refuse(socket, 404);
    // A window left open for another design, now that this one has its port, is not one of this server's.
    if (url.searchParams.get('path') !== path) return refuse(socket, 409);
    if (stopping) return refuse(socket, 503);
    const window = acceptLive(req, socket, head);
    if (!window) return undefined;
    windows.add(window);
    clearTimeout(idleTimer);
    window.onClose(() => {
      windows.delete(window);
      waitForWindows();
    });
    return undefined;
  });
  await new Promise((done, fail) => {
    server.once('error', (error) =>
      fail(
        error.code === 'EADDRINUSE'
          ? Object.assign(new Error(`Port ${port} is in use, by another program or by the tool with another design open. Choose another port with --port.`), { code: 'EADDRINUSE' })
          : error,
      ),
    );
    server.listen(port, '127.0.0.1', done);
  });
  if (created) {
    await saveDesign(path, model).catch((error) => {
      server.close();
      throw error;
    });
    known = await revisionOnDisk(path);
  }
  // A change from outside the tool, such as a restore or git, reaches the windows as another window's does.
  // It is looked at in the writes' turn, so the tool's own write is known before its folder event is.
  let announced = null;
  let lookTimer = null;
  const watcher = watch(dirname(path), (event, name) => {
    if (name && name !== basename(path)) return;
    clearTimeout(lookTimer);
    lookTimer = setTimeout(() => inTurn(async () => {
      const now = await revisionOnDisk(path);
      if (now === known || now === announced) return;
      announced = now;
      broadcast({ type: 'changed', revision: now });
    }).catch(() => {}), 150);
  });
  watcher.on('error', () => {});
  const url = `http://127.0.0.1:${server.address().port}`;
  if (open) openBrowser(url);
  waitForWindows();
  return {
    server,
    url,
    path,
    created,
    get windows() {
      return windows.size;
    },
    // Lets what is under way finish, says goodbye to the windows, and frees the port and the preview folder.
    close: async () => {
      watcher.close();
      clearTimeout(lookTimer);
      await drain();
      await Promise.all([...windows].map((window) => window.close()));
      const closed = new Promise((done, fail) =>
        server.close((error) => (error ? fail(error) : done())),
      );
      server.closeAllConnections();
      await closed;
      await rm(previewDir, { recursive: true, force: true });
    },
  };
}
