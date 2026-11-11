// The tool's life: a server per design file that stops by itself once no window has it open, windows on one
// design that follow each other, and saves that never overwrite a change they did not see.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright-core';
import { resolve } from '../src/generator/index.js';
import { backupPath } from '../src/cli/backup.js';
import { newDesign } from '../tool/new-design.js';
import { startTool } from '../tool/server.js';
import { hello, launch, stop, tools } from '../tool/launch.js';

// Each browser that is installed, since how a line closes is where they differ.
const BROWSERS = Object.entries({ firefox, chromium, webkit }).filter(([, type]) => existsSync(type.executablePath()));
const cta = 'inputs.header.cta';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (check, what, within = 8000) => {
  for (const end = Date.now() + within; Date.now() < end; ) {
    if (await check()) return;
    await sleep(40);
  }
  assert.fail(what);
};
async function writeDesign(path, introduction = 'As it was') {
  const model = await newDesign();
  model.project.introduction = introduction;
  await writeFile(path, `${JSON.stringify({ ...model, resolved: await resolve(model.inputs) }, null, 2)}\n`);
}
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const stateOf = (url) => fetch(`${url}/api/state`).then((answer) => answer.json());
const save = (url, state, introduction, { base = state.revision, window = 'a' } = {}) =>
  fetch(`${url}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Konzilo-Token': state.token, 'X-Konzilo-Base': base, 'X-Konzilo-Window': window },
    body: JSON.stringify({ inputs: state.inputs, project: { ...state.project, introduction } }),
  });
const lineTo = (url, path) => new WebSocket(`${url.replace('http:', 'ws:')}/api/live?path=${encodeURIComponent(path)}`);
const opened = (socket) =>
  new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', () => fail(new Error('The line was refused.')), { once: true });
  });
// The first message of a kind, since the lines and the requests are separate connections and either may arrive first.
const news = (socket, type) =>
  new Promise((done) => {
    const listen = ({ data }) => {
      const message = JSON.parse(data);
      if (message.type !== type) return;
      socket.removeEventListener('message', listen);
      done(message);
    };
    socket.addEventListener('message', listen);
  });
// What a server answers a request to open a line, without a browser's rules about what it may send.
const upgradeStatus = (url, path, headers = {}) =>
  new Promise((done, fail) => {
    const request = http.request(`${url}${path}`, {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64'), ...headers },
    });
    request.on('response', (response) => {
      response.resume();
      done(response.statusCode);
    });
    request.on('upgrade', (response, socket) => {
      socket.destroy();
      done(101);
    });
    request.on('error', fail);
    request.end();
  });
async function freePorts(count) {
  const servers = await Promise.all(Array.from({ length: count }, () => new Promise((done) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => done(server));
  })));
  const ports = servers.map((server) => server.address().port);
  await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
  return ports;
}

test('a save that did not see the file\'s last change is refused, while its own window\'s next one is not', { timeout: 120000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-life-'));
  const path = join(directory, 'guard.design.json');
  await writeDesign(path);
  const tool = await startTool({ designFile: path, port: 0, open: false });
  try {
    const first = await stateOf(tool.url);
    let answer = await save(tool.url, first, 'One', { window: 'a' });
    assert.equal(answer.status, 200);
    const second = (await answer.json()).revision;
    assert.notEqual(second, first.revision);
    assert.ok(existsSync(backupPath(path)), 'the first write of the run backs the file up');

    // Another window, which read the file before that change.
    answer = await save(tool.url, first, 'Two', { window: 'b' });
    assert.equal(answer.status, 409);
    assert.equal((await answer.json()).conflict, second);
    assert.equal((await read(path)).project.introduction, 'One');

    // The same window, whose save left before the answer to its last came back.
    answer = await save(tool.url, first, 'Three', { window: 'a' });
    assert.equal(answer.status, 200);
    const third = (await answer.json()).revision;

    // A change from outside the tool, as a restore or a script makes, is not saved over either.
    await writeFile(path, (await readFile(path, 'utf8')).replace('"Three"', '"Four"'));
    answer = await save(tool.url, { ...first, revision: third }, 'Five', { window: 'a' });
    assert.equal(answer.status, 409);
    assert.equal((await read(path)).project.introduction, 'Four');
    // And a window that reads the state again gets what the file holds, with its revision.
    const now = await stateOf(tool.url);
    assert.equal(now.project.introduction, 'Four');
    assert.equal(now.revision, (await answer.json()).conflict);
    assert.equal((await save(tool.url, now, 'Six', { window: 'b' })).status, 200);
  } finally {
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('the tool counts its windows by their live lines, tells them of saves, and refuses lines that are not its own', { timeout: 120000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-life-'));
  const path = join(directory, 'line.design.json');
  await writeDesign(path);
  const idled = [];
  const tool = await startTool({ designFile: path, port: 0, open: false, idle: 300, onIdle: () => idled.push(Date.now()) });
  try {
    // With no window at all from the start.
    await until(() => idled.length === 1, 'a tool no window ever opened did not say so');
    const socket = lineTo(tool.url, tool.path);
    await opened(socket);
    await until(() => tool.windows === 1, 'the window was not counted');
    await sleep(600);
    assert.equal(idled.length, 1, 'an open window keeps the tool');

    const coming = news(socket, 'saved');
    const state = await stateOf(tool.url);
    assert.equal((await save(tool.url, state, 'Seen', { window: 'other' })).status, 200);
    const message = await coming;
    assert.equal(message.type, 'saved');
    assert.equal(message.by, 'other');
    assert.equal(message.revision, (await stateOf(tool.url)).revision);

    socket.close();
    await until(() => tool.windows === 0, 'a closed line still counted');
    await until(() => idled.length === 2, 'the last window gone did not start the wait');

    // A window left from another design on this port, and a page on another origin.
    assert.equal(await upgradeStatus(tool.url, `/api/live?path=${encodeURIComponent(join(directory, 'other.design.json'))}`), 409);
    assert.equal(await upgradeStatus(tool.url, `/api/live?path=${encodeURIComponent(tool.path)}`, { Origin: 'http://example.com' }), 403);
    assert.equal(await upgradeStatus(tool.url, `/api/live?path=${encodeURIComponent(tool.path)}`), 101);

    // Closing does not wait for a window to go.
    const last = lineTo(tool.url, tool.path);
    await opened(last);
    const closing = Date.now();
    await tool.close();
    assert.ok(Date.now() - closing < 3000, 'closing waited for the window');
  } finally {
    await tool.close().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});

for (const [name, browserType] of BROWSERS) test(`windows on one design follow each other, say when the tool is gone, go on when it is back, and ask on a clash, in ${name}`, { timeout: 240000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-life-'));
  const path = join(directory, 'windows.design.json');
  await writeDesign(path);
  let tool = await startTool({ designFile: path, port: 0, open: false });
  const port = Number(new URL(tool.url).port);
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const open = async () => {
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(tool.url);
      await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
      return page;
    };
    const a = await open();
    const b = await open();
    await until(() => tool.windows === 2, 'two windows were not counted');
    const flag = `[data-flag="${cta}"]`;
    for (const page of [a, b]) await page.locator('.chapter[data-chapter="frame"]').click();
    const was = (await read(path)).inputs.header.cta;

    // A's own preview window is A's alone, though both are on one address: B keeps its preview beside its controls.
    const [own] = await Promise.all([context.waitForEvent('page'), a.locator('#own-window').click()]);
    await own.waitForFunction(() => document.querySelector('#preview')?.contentDocument?.querySelector('.kn-card'));
    await b.waitForTimeout(300);
    assert.equal(await a.locator('#preview-pane').isVisible(), false);
    assert.equal(await b.locator('#preview-pane').isVisible(), true, 'B keeps its preview');
    assert.equal(tool.windows, 2, 'a preview window is not counted as a window of its own');
    await a.locator('#bring-back').click();
    await a.locator('#preview-pane').waitFor({ state: 'visible' });

    // A changes, and B shows it without being touched.
    await a.locator(flag).click();
    await b.waitForFunction(([selector, value]) => document.querySelector(selector).getAttribute('aria-pressed') === value, [flag, String(!was)]);
    assert.match(await b.locator('#notice').textContent(), /another window/);

    // B's change goes on top of A's, and A follows it.
    await b.locator('.chapter[data-chapter="start"]').click();
    await b.locator('[data-path="project.introduction"]').fill('From B');
    await until(async () => (await read(path)).project.introduction === 'From B', 'B\'s change was not saved');
    assert.equal((await read(path)).inputs.header.cta, !was, 'and A\'s is still there');
    await a.locator('.chapter[data-chapter="start"]').click();
    await a.waitForFunction(() => document.querySelector('[data-path="project.introduction"]').value === 'From B');

    await a.close();
    await until(() => tool.windows === 1, 'a closed window still counted');

    // The tool stops: the window says so, holds a change made meanwhile, and saves it once the tool is back.
    await tool.close();
    await b.waitForFunction(() => document.getElementById('notice').textContent.includes('has stopped'));
    assert.match(await b.locator('#notice').textContent(), /design-tool .*windows\.design\.json/);
    await b.locator('[data-path="project.introduction"]').fill('While away');
    await b.waitForFunction(() => document.getElementById('status-text').textContent === 'Not saved');
    assert.equal((await read(path)).project.introduction, 'From B');
    tool = await startTool({ designFile: path, port, open: false });
    await until(async () => (await read(path)).project.introduction === 'While away', 'the change made while the tool was away was not saved');
    await b.waitForFunction(() => document.getElementById('notice').hidden);
    await until(() => tool.windows === 1, 'the window did not come back');

    // A change from outside, as a restore makes, reaches a window that stands still.
    await writeFile(path, (await readFile(path, 'utf8')).replace('"While away"', '"From outside"'));
    await b.waitForFunction(() => document.querySelector('[data-path="project.introduction"]').value === 'From outside');
    assert.match(await b.locator('#notice').textContent(), /outside the tool/);

    // One that meets a change being made here: nothing is overwritten, and the window asks.
    await b.locator('[data-path="project.introduction"]').fill('B again');
    await writeFile(path, (await readFile(path, 'utf8')).replace('"From outside"', '"Outside again"'));
    await b.waitForFunction(() => document.getElementById('notice').textContent.includes('has changed'));
    assert.equal((await read(path)).project.introduction, 'Outside again');
    await b.getByRole('button', { name: 'Use the file' }).click();
    await b.waitForFunction(() => document.querySelector('[data-path="project.introduction"]').value === 'Outside again');
    assert.equal(await b.locator('#undo').isDisabled(), true, 'the history starts again from the file');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('design-tool starts a tool per file, shows a file already open, restarts on changed code, and the tool stops by itself', { timeout: 120000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-life-'));
  const runtime = join(directory, 'run');
  const ports = await freePorts(2);
  const options = { ports, runtime, open: false, idle: 3000 };
  const one = join(directory, 'one.design.json');
  const two = join(directory, 'two.design.json');
  await writeDesign(one);
  const original = await readFile(one, 'utf8');
  try {
    const first = await launch({ ...options, designFile: one });
    assert.equal(first.url, `http://127.0.0.1:${ports[0]}`);
    assert.equal(first.created, false);
    // A window holds the tool open while this test works.
    let window = lineTo(first.url, first.path);
    await opened(window);

    const again = await launch({ ...options, designFile: join(directory, '.', 'ONE.design.json') });
    assert.equal(again.joined, true, process.platform === 'darwin' ? 'the same file, written another way' : 'the same file');
    assert.equal(again.url, first.url);

    let state = await stateOf(first.url);
    assert.equal((await save(first.url, state, 'Before the restart')).status, 200);
    assert.equal(await readFile(backupPath(one), 'utf8'), original);

    // Changed code: the tool is replaced on its port, its windows are told, and the run's backup stays as it was.
    const told = news(window, 'restarting');
    const replaced = await launch({ ...options, designFile: one, code: 'changed since' });
    assert.equal(replaced.replaced, true);
    assert.equal(replaced.url, first.url);
    assert.equal((await told).type, 'restarting');
    window = lineTo(first.url, first.path);
    await opened(window);
    state = await stateOf(first.url);
    assert.equal((await save(first.url, state, 'After the restart')).status, 200);
    assert.equal(await readFile(backupPath(one), 'utf8'), original, 'the replaced tool\'s run goes on');

    const second = await launch({ ...options, designFile: two });
    assert.equal(second.url, `http://127.0.0.1:${ports[1]}`);
    assert.equal(second.created, true);
    const running = await tools(options);
    assert.deepEqual(running.map((tool) => [tool.port, tool.windows]).sort(), [[ports[0], 1], [ports[1], 0]]);

    assert.deepEqual(await stop({ ...options, designFile: two }), [second.path]);
    assert.equal(await hello(ports[1]), null);

    // The last window goes, and so does the tool, with its record.
    window.close();
    await until(async () => (await hello(ports[0])) === null, 'the tool did not stop by itself', 10000);
    assert.equal(existsSync(join(runtime, `${ports[0]}.json`)), false);
    assert.match(await readFile(join(runtime, `${ports[0]}.log`), 'utf8'), /no window for 3 seconds/);
  } finally {
    await stop(options).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
