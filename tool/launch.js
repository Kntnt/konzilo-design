// What `design-tool` does: shows a design file in the tool that already has it open, or starts a tool for it
// that runs on its own and stops by itself when its last window has been gone for `IDLE`. Each design file
// has a server of its own, on the first free port from 4174. The command returns as soon as the tool answers.
import { spawn } from 'node:child_process';
import { chmod, mkdir, open as openFile, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir, userInfo } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './browser.js';

export const PORTS = Array.from({ length: 10 }, (_, index) => 4174 + index);
export const IDLE = 30000;
const APP = 'konzilo-design-tool';
const repo = fileURLToPath(new URL('../', import.meta.url));
const serveScript = fileURLToPath(new URL('./serve.js', import.meta.url));

const userName = () => {
  try {
    return userInfo().username;
  } catch {
    return String(process.getuid?.() ?? '');
  }
};

// One folder per user for what the running tools leave while they run: a record each, with the key that
// stops it, and a log each. Only that user may read it. A tool removes its record when it stops.
export async function runtimeFolder(folder = join(tmpdir(), `konzilo-design-tool-${process.getuid?.() ?? userName()}`)) {
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const info = await stat(folder);
  if (process.getuid && info.uid !== process.getuid()) throw new Error(`${folder} belongs to another user, so the tool cannot keep its records there.`);
  if (process.platform !== 'win32' && info.mode & 0o077) await chmod(folder, 0o700);
  return folder;
}
const recordPath = (folder, port) => join(folder, `${port}.json`);
export const logPath = (folder, port) => join(folder, `${port}.log`);
export async function writeRecord(folder, port, record) {
  await rm(recordPath(folder, port), { force: true });
  await writeFile(recordPath(folder, port), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
}
export const removeRecord = (folder, port) => rm(recordPath(folder, port), { force: true });
async function readRecord(folder, port) {
  try {
    return JSON.parse(await readFile(recordPath(folder, port), 'utf8'));
  } catch {
    return null;
  }
}
async function recordedPorts(folder) {
  const names = await readdir(folder).catch(() => []);
  return names.map((name) => /^(\d+)\.json$/.exec(name)?.[1]).filter(Boolean).map(Number);
}

// When the code the tool runs last changed. A server started before that shows old components, so a
// launch replaces it. The documents are left out, since they change nothing the tool does.
const CODE = ['tool', 'src', 'presentation', 'gallery/src', 'schema', 'bin/konzilo-design.js', 'package.json'];
export async function codeFingerprint() {
  const newest = async (path) => {
    const info = await stat(path).catch(() => null);
    if (!info) return 0;
    if (!info.isDirectory()) return extname(path) === '.md' ? 0 : info.mtimeMs;
    const names = (await readdir(path)).filter((name) => !name.startsWith('.') && !['node_modules', 'dist'].includes(name));
    return Math.max(0, ...(await Promise.all(names.map((name) => newest(join(path, name))))));
  };
  return String(Math.round(Math.max(...(await Promise.all(CODE.map((part) => newest(join(repo, part))))))));
}

// The file as the system knows it, so one file never gets two tools however its path is written:
// through a link, in another case on a disk that ignores case, or relative to another folder.
export async function canonical(file) {
  const absolute = resolve(file);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    return join(await realpath(dirname(absolute)), basename(absolute));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return absolute;
  }
}

// What answers on a port, if it is this user's design tool.
export async function hello(port, timeout = 800) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/hello`, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    const answer = await response.json();
    if (answer?.app !== APP) return null;
    return { ...answer, port, url: `http://127.0.0.1:${port}` };
  } catch {
    return null;
  }
}
const isFree = (port) =>
  new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)));
  });
const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
async function gone(pid, within = 10000) {
  for (const until = Date.now() + within; Date.now() < until; ) {
    if (!isRunning(pid)) return;
    await new Promise((done) => setTimeout(done, 50));
  }
}

// This user's tools that run now, on the usual ports and on any other one recorded. A record left by a tool
// that no longer runs, after a crash, is removed.
export async function tools({ ports = PORTS, runtime } = {}) {
  const folder = await runtimeFolder(runtime);
  const recorded = await recordedPorts(folder);
  const candidates = [...new Set([...ports, ...recorded])];
  const answers = await Promise.all(candidates.map((port) => hello(port)));
  const mine = answers.filter((answer) => answer && answer.user === userName());
  for (const port of recorded) {
    const record = await readRecord(folder, port);
    if (!mine.some((tool) => tool.port === port && tool.pid === record?.pid)) await removeRecord(folder, port);
  }
  return mine.map((tool) => ({ ...tool, log: logPath(folder, tool.port) }));
}

// Lets the tool finish what it is doing, and waits until it has gone. It answers whether this run has made its backup.
async function stopTool(tool, folder, { restart = false } = {}) {
  const record = await readRecord(folder, tool.port);
  if (record?.pid !== tool.pid) {
    // Not started by this command, so without its key: a signal also lets it finish its saves.
    process.kill(tool.pid, 'SIGTERM');
    await gone(tool.pid);
    return { backedUp: false };
  }
  const response = await fetch(`${tool.url}/api/stop${restart ? '?restart=1' : ''}`, { method: 'POST', headers: { 'X-Konzilo-Stop': record.key } });
  const answer = await response.json();
  if (!response.ok) throw new Error(answer.error);
  await gone(tool.pid);
  return answer;
}

async function lastLines(path, count = 12) {
  const text = await readFile(path, 'utf8').catch(() => '');
  return text.trimEnd().split('\n').slice(-count).join('\n');
}

// Starts a server for the file on the port, apart from this process, and waits until it answers or fails.
async function spawnTool({ path, port, folder, idle, backedUp }) {
  const log = logPath(folder, port);
  const output = await openFile(log, 'w', 0o600);
  const args = [serveScript, path, '--port', String(port), '--runtime', folder, '--idle', String(idle), ...(backedUp ? ['--backed-up'] : [])];
  const child = spawn(process.execPath, args, { detached: true, stdio: ['ignore', output.fd, output.fd, 'ipc'] });
  await output.close();
  try {
    const message = await new Promise((done, fail) => {
      child.once('message', done);
      child.once('error', fail);
      child.once('exit', async (code) => fail(new Error(`The tool stopped while starting (exit status ${code}).\n${await lastLines(log)}`)));
    });
    if (message.error) throw Object.assign(new Error(message.error), { code: message.code });
    return { url: message.url, created: message.created, log };
  } finally {
    child.removeAllListeners();
    if (child.connected) child.disconnect();
    child.unref();
  }
}

// Opens the design file in the tool. `joined` says that a tool already had it open, and `replaced` that it
// was started again since the code has changed. `port` decides only where a new tool goes.
export async function launch({ designFile, port, open = true, ports = PORTS, runtime, idle = IDLE, code } = {}) {
  const folder = await runtimeFolder(runtime);
  const path = await canonical(designFile);
  code ??= await codeFingerprint();
  const running = await tools({ ports: port === undefined ? ports : [port, ...ports], runtime: folder });
  const same = running.find((tool) => tool.path === path);
  const show = async (url) => (open ? openBrowser(url) : true);
  if (same && same.code === code) return { url: same.url, path, log: same.log, joined: true, opened: await show(same.url) };
  let backedUp = false;
  if (same) ({ backedUp } = await stopTool(same, folder, { restart: true }));
  const tries = same ? [same.port] : port === undefined ? ports : [port];
  for (const candidate of tries) {
    if (!same && !(await isFree(candidate))) {
      if (port === undefined) continue;
      const other = running.find((tool) => tool.port === candidate);
      throw new Error(other ? `Port ${candidate} is in use by the tool with ${other.path} open. Choose another port with --port, or leave it out.` : `Port ${candidate} is in use by another program. Choose another port with --port, or leave it out.`);
    }
    try {
      const started = await spawnTool({ path, port: candidate, folder, idle, backedUp });
      return { ...started, path, replaced: Boolean(same), opened: await show(started.url) };
    } catch (error) {
      // Taken between the look and the start, by a tool started at the same moment.
      if (error.code === 'EADDRINUSE' && port === undefined && !same) continue;
      throw error;
    }
  }
  throw new Error(`Ports ${ports[0]}–${ports.at(-1)} are all in use. Choose another with --port.`);
}

// Stops the tool that has the file open, or every tool of this user without a file. It answers the files stopped.
export async function stop({ designFile, ports = PORTS, runtime } = {}) {
  const folder = await runtimeFolder(runtime);
  const path = designFile === undefined ? undefined : await canonical(designFile);
  const chosen = (await tools({ ports, runtime: folder })).filter((tool) => path === undefined || tool.path === path);
  for (const tool of chosen) await stopTool(tool, folder);
  return chosen.map((tool) => tool.path);
}
