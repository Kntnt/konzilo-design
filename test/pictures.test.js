import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { derive, defaultInputs } from '../src/generator/index.js';
import { pictures, flatPictures, PICTURE_SLOTS, PICTURE_URL } from '../presentation/src/samples.js';
import { ownPictureFiles, ownPictureUrls, picturesFolder, removeOwnPicture, saveOwnPicture } from '../presentation/own-pictures.mjs';
import { pictureSize } from '../tool/logic.js';
import { createPresentation } from '../tool/presentation.js';
import { saveDesign, startTool } from '../tool/server.js';

// A real 2x1 JPEG, the smallest thing a browser will decode as one.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');
const scratch = () => mkdtemp(join(tmpdir(), 'kn-pictures-'));
const design = async (directory, hero) => {
  const path = join(directory, 'client.design.json');
  const inputs = { ...defaultInputs(), typefaces: { ...defaultInputs().typefaces, main: 'Mona Sans' } };
  if (hero) inputs.hero = { ...inputs.hero, ...hero };
  await saveDesign(path, { inputs, project: { name: 'Client', version: '1.0' } });
  return path;
};

test('every sample photo ships, and every place can be told from its address', async () => {
  const set = pictures(derive(defaultInputs()).ramps);
  for (const photo of [set.hero, set.panorama, ...set.landscapes]) {
    assert.ok((await stat(new URL(`..${photo}`, import.meta.url))).size < 400 * 1024, photo);
    assert.deepEqual(photo.match(PICTURE_URL), [photo]);
  }
  const own = Object.fromEntries(PICTURE_SLOTS.map((slot) => [slot, `/design-pictures/${slot}.jpg`]));
  assert.deepEqual(flatPictures(pictures(derive(defaultInputs()).ramps, own)), Object.values(own), 'the list runs in the order of the places');
});

test('a photo is never made larger, and a large one keeps its shape', () => {
  assert.deepEqual(pictureSize(800, 600), [800, 600]);
  assert.deepEqual(pictureSize(6000, 4000), [2000, 1333]);
  assert.deepEqual(pictureSize(3000, 6000), [1000, 2000]);
});

test('the folder beside the design file is the whole record of its own photos', async () => {
  const directory = await scratch();
  try {
    const path = join(directory, 'client.design.json');
    assert.deepEqual(await ownPictureFiles(path), {});
    await saveOwnPicture(path, 'hero', JPEG);
    assert.equal(picturesFolder(path), join(directory, 'client.design.pictures'));
    assert.deepEqual(await ownPictureFiles(path), { hero: 'hero.jpg' });
    // A file put there by hand counts, and anything else in the folder does not.
    await writeFile(join(picturesFolder(path), 'person-1.png'), 'png');
    await writeFile(join(picturesFolder(path), 'notes.txt'), 'words');
    await writeFile(join(picturesFolder(path), 'other.jpg'), JPEG);
    assert.deepEqual(await ownPictureFiles(path), { hero: 'hero.jpg', 'person-1': 'person-1.png' });
    assert.match((await ownPictureUrls(path)).hero, /^\/design-pictures\/hero\.jpg\?v=\d+$/);
    assert.equal((await ownPictureUrls(path, { versioned: false })).hero, '/design-pictures/hero.jpg');
    // An upload takes over the place, whatever file was there.
    await saveOwnPicture(path, 'person-1', JPEG);
    assert.equal((await ownPictureFiles(path))['person-1'], 'person-1.jpg');
    await removeOwnPicture(path, 'hero');
    assert.equal((await ownPictureFiles(path)).hero, undefined);
    await assert.rejects(saveOwnPicture(path, '../../evil', JPEG), /Unknown picture place/);
    await assert.rejects(saveOwnPicture(path, 'hero', Buffer.from('<svg>')), /Expected a JPEG/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the tool takes a photo only from its own session, and never serves anything but one', async () => {
  const directory = await scratch();
  const path = await design(directory);
  await writeFile(join(directory, 'secret.jpg'), 'secret');
  const tool = await startTool({ designFile: path, port: 0, open: false });
  try {
    const { token, pictures: before } = await fetch(`${tool.url}/api/state`).then((answer) => answer.json());
    assert.deepEqual(before, {});
    const send = (slot, headers, method = 'POST') => fetch(`${tool.url}/api/picture?slot=${slot}`, { method, headers, body: method === 'POST' ? JPEG : undefined });
    assert.equal((await send('hero', { 'Content-Type': 'image/jpeg' })).status, 403);
    assert.equal((await send('nowhere', { 'X-Konzilo-Token': token })).status, 400);
    assert.equal((await send('hero', { 'X-Konzilo-Token': token })).status, 200);
    const { pictures: after } = await fetch(`${tool.url}/api/state`).then((answer) => answer.json());
    const served = await fetch(tool.url + after.hero);
    assert.equal(served.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), JPEG);
    assert.equal((await fetch(`${tool.url}/design-pictures/..%2Fsecret.jpg`)).status, 404);
    assert.equal((await fetch(`${tool.url}/design-pictures/../secret.jpg`)).status, 404);
    assert.equal((await fetch(`${tool.url}/presentation/pictures/hero.webp`)).headers.get('content-type'), 'image/webp');
    assert.equal((await fetch(`${tool.url}/presentation/pictures/README.md`)).status, 404);
    assert.equal((await send('hero', { 'X-Konzilo-Token': token }, 'DELETE')).status, 200);
    assert.deepEqual(await ownPictureFiles(path), {});
    assert.ok(!JSON.parse(await readFile(path, 'utf8')).project.pictures, 'nothing of it goes in the design file');
  } finally {
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a presentation carries each picture once, and a design\'s own in place of the sample', { timeout: 240000 }, async () => {
  const directory = await scratch();
  const path = await design(directory);
  await saveOwnPicture(path, 'landscape-1', JPEG);
  try {
    const { html } = await createPresentation(path, join(directory, 'out.zip'), { includeHtml: true, date: '2026-11-04' });
    const own = JPEG.toString('base64');
    assert.equal(html.split(own).length - 1, 1 + 1, 'in the specimens\' store, and once for the surfaces in the document itself');
    const hero = (await readFile(new URL('../presentation/pictures/hero.webp', import.meta.url))).toString('base64');
    assert.equal(html.split(hero).length - 1, 1);
    assert.ok(!html.includes((await readFile(new URL('../presentation/pictures/landscape-1.webp', import.meta.url))).toString('base64')), 'the sample it replaced is not carried');

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const external = [];
      page.on('request', (request) => { if (!/^(data|about|blob):/.test(request.url())) external.push(request.url()); });
      await page.setContent(html);
      await page.evaluate(() => { location.hash = 'opening'; });
      const frame = async (id) => {
        const handle = await page.waitForSelector(`[data-specimen-frame="${id}"]`, { state: 'attached' });
        const content = await handle.contentFrame();
        await content.waitForFunction(() => document.readyState === 'complete');
        return content;
      };
      assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('.surface-example[data-kn-surface="picture-dark"]')).backgroundImage), /url\("data:image\/jpeg/, 'a picture Surface in the document shows the picture');
      const hero = await frame('hero');
      const background = () => hero.evaluate(() => getComputedStyle(document.querySelector('.kn-hero')).backgroundImage);
      await hero.waitForFunction(() => getComputedStyle(document.querySelector('.kn-hero')).backgroundImage.includes('url("data:image/'));
      assert.deepEqual(external, [], 'nothing is fetched');
      await page.locator('#opening [data-frame-pictures] [data-value="off"]').click();
      assert.doesNotMatch(await background(), /url\(/);
      await page.locator('#opening [data-frame-pictures] [data-value="on"]').click();
      assert.match(await background(), /url\("data:image\//);
    } finally {
      await browser.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('in the tool a photo reaches both ends, the toggle hides what can go, and colours leave the photos alone', { timeout: 240000 }, async () => {
  const directory = await scratch();
  const path = await design(directory, { picture: 'beside' });
  const upload = join(directory, 'camera.png');
  // A red 4x3 picture, drawn by a browser so the test needs no image of its own.
  const tool = await startTool({ designFile: path, port: 0, open: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(tool.url);
    await page.waitForFunction(() => document.getElementById('status-text').textContent !== 'Loading');
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1800;
      const context = canvas.getContext('2d');
      context.fillStyle = '#c00';
      context.fillRect(0, 0, 2400, 1800);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await writeFile(upload, Buffer.from(png, 'base64'));
    const ends = [page.frameLocator('#preview'), page.frameLocator('#preview-narrow')];
    const hero = (end) => end.locator('.kn-hero-media img').first();
    for (const end of ends) await hero(end).waitFor({ state: 'attached' });
    assert.match(await hero(ends[0]).getAttribute('src'), /^\/presentation\/pictures\/landscape-1\.webp$/);
    assert.ok(await page.locator('[data-remove-picture="landscape-1"]').isHidden());

    await page.locator('[data-picture="landscape-1"]').setInputFiles(upload);
    await page.waitForFunction(() => !document.querySelector('[data-remove-picture="landscape-1"]').hidden);
    for (const end of ends) await hero(end).evaluate((img) => new Promise((done) => {
      const check = () => (img.src.includes('/design-pictures/landscape-1.jpg') && img.complete && img.naturalWidth ? done() : setTimeout(check, 50));
      check();
    }));
    assert.equal(await hero(ends[0]).evaluate((img) => img.naturalWidth), 2000, 'made a sensible size on its way in');
    assert.deepEqual(await ownPictureFiles(path), { 'landscape-1': 'landscape-1.jpg' });
    assert.ok((await stat(join(picturesFolder(path), 'landscape-1.jpg'))).size < 200 * 1024);

    // A colour dragged changes the drawn people and nothing about the photos.
    const watch = (end) => end.locator('body').evaluate(() => {
      window.__photos = 0;
      new MutationObserver((list) => {
        for (const change of list) if (change.attributeName === 'src' && change.target.getAttribute('src').startsWith('/')) window.__photos += 1;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['src'] });
    });
    await watch(ends[0]);
    const colours = () => ends[0].locator('#kn-live-core').evaluate((node) => node.textContent);
    const coloursBefore = await colours();
    await page.locator('[data-colour-block="primary"] input[type="range"]').last().evaluate((node) => {
      node.value = Number(node.value) > Number(node.min) + 20 ? Number(node.min) + 10 : Number(node.max) - 10;
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    assert.notEqual(await colours(), coloursBefore, 'the colour did change');
    assert.equal(await ends[0].locator('body').evaluate(() => window.__photos), 0);

    // The toggle is a way of looking, and leaves the design and the file alone.
    const before = await readFile(path, 'utf8');
    await page.locator('[data-pictures="off"]').click();
    for (const end of ends) {
      await end.locator('html[data-kn-pictures="off"]').waitFor({ state: 'attached' });
      assert.equal(await end.locator('.kn-hero-media').first().evaluate((node) => getComputedStyle(node).display), 'none');
    }
    await page.locator('[data-pictures="on"]').click();
    for (const end of ends) await end.locator('html[data-kn-pictures="on"]').waitFor({ state: 'attached' });
    assert.equal(await readFile(path, 'utf8'), before);

    // Removed, the sample takes the place again.
    await page.evaluate(() => document.querySelector('[data-remove-picture="landscape-1"]').click());
    await page.waitForFunction(() => document.querySelector('[data-remove-picture="landscape-1"]').hidden);
    await ends[0].locator('.kn-hero-media img[src="/presentation/pictures/landscape-1.webp"]').first().waitFor({ state: 'attached' });
    assert.deepEqual(await ownPictureFiles(path), {});
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});
