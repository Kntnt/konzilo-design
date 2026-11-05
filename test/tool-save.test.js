// A change is saved after a short pause, and a page that goes away within that pause still saves it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { resolve } from '../src/generator/index.js';
import { newDesign } from '../tool/new-design.js';
import { startTool } from '../tool/server.js';
import { failContrastOn, failingColour } from './helpers/failing-contrast.js';

const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const loaded = (page) => page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
const cta = 'inputs.header.cta';
const openHeader = async (page, url) => {
  await page.goto(url);
  await loaded(page);
  await page.locator('.chapter[data-chapter="frame"]').click();
  return page.locator(`[data-flag="${cta}"]`);
};
const until = async (check, what) => {
  for (let tries = 0; tries < 100; tries += 1) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 30));
  }
  assert.fail(what);
};

test('a page reloaded, left or closed within the pause still saves its change, whatever its logos weigh', { timeout: 180000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-save-'));
  const path = join(directory, 'save.design.json');
  // A made-up logo far larger than the 64 KiB a request sent on the way out may carry.
  const model = await newDesign();
  model.project.logo = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><!--${'x'.repeat(200000)}--><rect width="8" height="8"/></svg>`).toString('base64')}`;
  await writeFile(path, `${JSON.stringify({ ...model, resolved: await resolve(model.inputs) }, null, 2)}\n`);
  const logo = model.project.logo;
  const tool = await startTool({ designFile: path, port: 0, open: false });
  const browser = await chromium.launch();
  try {
    // Its own context: a page from browser.newPage() takes its context along when it closes, and a request on its way with it.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const posts = [];
    page.on('request', (request) => { if (request.url().endsWith('/api/save')) posts.push(request.postData()?.length ?? 0); });
    let flag = await openHeader(page, tool.url);
    const was = (await read(path)).inputs.header.cta;

    // Reloaded at once: the file has not yet got it, and has it when the page is back, which shows it.
    await flag.click();
    assert.equal((await read(path)).inputs.header.cta, was, 'still in the pause');
    await page.reload();
    await loaded(page);
    await page.locator('.chapter[data-chapter="frame"]').click();
    flag = page.locator(`[data-flag="${cta}"]`);
    assert.equal(await flag.getAttribute('aria-pressed'), String(!was), 'the reloaded page holds the change');
    assert.equal((await read(path)).inputs.header.cta, !was, 'and so does the file');
    assert.equal((await read(path)).project.logo, logo, 'with its logo whole, though it was too large to go along');

    // An ordinary save still sends all of it, and one just on its way cannot overtake the last.
    await flag.click();
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'saved');
    assert.ok(posts.at(-1) > 200000, 'an ordinary save carries the logo');
    assert.equal((await read(path)).inputs.header.cta, was);
    await flag.click();
    await page.waitForTimeout(460);
    await flag.click();
    await page.reload();
    await loaded(page);
    assert.equal((await read(path)).inputs.header.cta, was, 'the last click wins');
    assert.equal((await read(path)).project.logo, logo);

    // Text being typed, on a page left for another.
    await page.locator('.chapter[data-chapter="start"]').click();
    await page.locator('[data-path="project.introduction"]').fill('Written on the way out');
    await page.goto('about:blank');
    await until(async () => (await read(path)).project.introduction === 'Written on the way out', 'the text was lost when leaving');

    // A window closed.
    const other = await context.newPage();
    await openHeader(other, tool.url);
    await other.locator(`[data-flag="${cta}"]`).click();
    await other.close({ runBeforeUnload: true });
    await until(async () => (await read(path)).inputs.header.cta === !was, 'the click was lost when closing');

    // A removed logo is news, and a new small one goes along.
    await failContrastOn(page);
    await page.goto(tool.url);
    await loaded(page);
    await page.locator('.chapter[data-chapter="start"]').click();
    await page.locator('[data-remove-logo="logo"]').click();
    await page.reload();
    await loaded(page);
    assert.equal((await read(path)).project.logo, null, 'removed on the way out');

    // A setting that fails the contrast check stays out of the file.
    const before = await readFile(path, 'utf8');
    await page.locator('.chapter[data-chapter="colour"]').click();
    await page.locator('[data-hex="primary"]').fill(failingColour);
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
    await page.reload();
    await loaded(page);
    assert.equal(await readFile(path, 'utf8'), before, 'a failing colour is not saved on the way out');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a page going away cannot save over a design opened since then', { timeout: 240000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-save-'));
  const first = join(directory, 'first.design.json');
  const second = join(directory, 'second.design.json');
  let tool = await startTool({ designFile: first, port: 0, open: false });
  const { port } = new URL(tool.url);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(tool.url);
    await loaded(page);
    await page.locator('.chapter[data-chapter="frame"]').click();
    const firstText = await readFile(first, 'utf8');
    await tool.close();
    tool = await startTool({ designFile: second, port: Number(port), open: false });
    const secondText = await readFile(second, 'utf8');

    // An ordinary save is refused with a reason, as it was.
    await page.locator(`[data-flag="${cta}"]`).click();
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
    assert.match(await page.locator('#notice').textContent(), /another design open/);

    // On the way out the old token is enough to refuse it, and the page has no time to ask for a new one.
    await page.locator(`[data-flag="${cta}"]`).click();
    await page.reload();
    await loaded(page);
    await page.waitForTimeout(300);
    assert.equal(await readFile(second, 'utf8'), secondText, 'the design open now is untouched');
    assert.equal(await readFile(first, 'utf8'), firstText, 'and so is the one it came from');
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});
