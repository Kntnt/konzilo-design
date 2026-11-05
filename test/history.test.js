import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { capture, thaw, createHistory, historyAction, LIMIT } from '../tool/history.js';
import { startTool } from '../tool/server.js';
import { failContrastOn, failingColour } from './helpers/failing-contrast.js';

const design = () => ({
  inputs: { type: { steps: { lead: 1 }, roles: { label: { features: ['ss02'] } } }, shadow: { angle: 0 } },
  project: { name: 'Example', logo: `data:image/png;base64,${'A'.repeat(1000)}` },
});

test('a snapshot shares what has not changed with the one before it', () => {
  const model = design();
  const first = capture(model);
  model.inputs.shadow.angle = 30;
  const second = capture(model, first);
  assert.notEqual(second, first);
  assert.equal(second.project, first.project, 'the part holding the logo is one and the same');
  assert.equal(second.inputs.type, first.inputs.type);
  assert.notEqual(second.inputs.shadow, first.inputs.shadow);
  assert.equal(second.inputs.shadow.angle, 30);
  assert.equal(first.inputs.shadow.angle, 0, 'the earlier one is untouched');
  assert.ok(Object.isFrozen(second) && Object.isFrozen(second.inputs.shadow));
});

test('the same value is the same snapshot, whatever the order of its keys or what an emptied field left behind', () => {
  const first = capture(design());
  assert.equal(capture(thaw(first), first), first);
  const reordered = thaw(first);
  reordered.project = { logo: reordered.project.logo, name: reordered.project.name };
  assert.equal(capture(reordered, first), first);
  const emptied = thaw(first);
  emptied.project.contact = {};
  emptied.project.explanations = { colour: undefined };
  assert.equal(capture(emptied, first), first);
  const list = thaw(first);
  list.inputs.type.roles.label.features = ['ss02', 'ss07'];
  assert.notEqual(capture(list, first), first);
  const fewer = thaw(first);
  delete fewer.project.name;
  assert.notEqual(capture(fewer, first), first, 'a value gone is a change');
  const zeroed = thaw(first);
  zeroed.inputs.shadow.angle = -0;
  assert.equal(capture(zeroed, first), first, 'the file cannot tell -0 from 0');
  const colour = capture({ primary: '#6366F1', name: 'Mixed' });
  assert.equal(capture({ primary: '#6366f1', name: 'Mixed' }, colour), colour, 'a colour in the other case is the same colour');
  assert.notEqual(capture({ primary: '#6366f2', name: 'Mixed' }, colour), colour);
  assert.notEqual(capture({ primary: '#6366F1', name: 'mixed' }, colour), colour, 'other words are not');
});

test('a snapshot thawed can be changed, and the snapshot stays as it was', () => {
  const first = capture(design());
  const model = thaw(first);
  assert.deepEqual(model, first);
  assert.ok(!Object.isFrozen(model.inputs.type.roles.label.features));
  model.inputs.type.roles.label.features.push('ss07');
  model.project.name = 'Other';
  assert.deepEqual(first.inputs.type.roles.label.features, ['ss02']);
  assert.equal(first.project.name, 'Example');
});

test('undo and redo walk the steps, and each step remembers its place both ways', () => {
  const states = [0, 1, 2].map((angle) => capture({ angle }));
  const history = createHistory(states[0]);
  assert.deepEqual([history.canUndo, history.canRedo], [false, false]);
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), null);
  assert.equal(history.record(states[1], 'colour'), true);
  assert.equal(history.record(states[2], 'shadow'), true);
  assert.equal(history.present, states[2]);

  assert.deepEqual(history.undo(), { state: states[1], place: 'shadow' });
  assert.deepEqual(history.undo(), { state: states[0], place: 'colour' });
  assert.deepEqual([history.canUndo, history.canRedo], [false, true]);
  assert.equal(history.undo(), null);
  assert.equal(history.present, states[0]);
  assert.deepEqual(history.redo(), { state: states[1], place: 'colour' });
  assert.deepEqual(history.redo(), { state: states[2], place: 'shadow' });
  assert.deepEqual([history.canUndo, history.canRedo], [true, false]);
});

test('a new step clears what could be redone, and the same value neither adds a step nor clears it', () => {
  const [a, b, c] = [0, 1, 2].map((angle) => capture({ angle }));
  const history = createHistory(a);
  history.record(b, 'page');
  history.undo();
  assert.equal(history.record(history.present, 'page'), false);
  assert.equal(history.record(capture({ angle: 0 }, history.present), 'page'), false);
  assert.deepEqual([history.canUndo, history.canRedo], [false, true]);
  history.record(c, 'page');
  assert.deepEqual([history.canUndo, history.canRedo], [true, false]);
  assert.equal(history.redo(), null);
});

test('the history keeps its last two hundred steps', () => {
  assert.equal(LIMIT, 200);
  const history = createHistory(capture({ n: 0 }));
  for (let n = 1; n <= LIMIT + 50; n += 1) history.record(capture({ n }, history.present), `page-${n}`);
  let last;
  let undone = 0;
  for (let step = history.undo(); step; step = history.undo()) {
    last = step;
    undone += 1;
  }
  assert.equal(undone, LIMIT);
  assert.equal(last.state.n, 50);
  assert.equal(last.place, 'page-51');
});

test('two hundred steps hold one logo, and a step costs next to nothing to record', () => {
  const model = { inputs: { n: 0, groups: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`g${i}`, { value: i }])) }, project: { logo: `data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}` } };
  const history = createHistory(capture(model));
  const { project } = history.present;
  const started = performance.now();
  for (let n = 1; n <= LIMIT; n += 1) {
    model.inputs.n = n;
    history.record(capture(model, history.present), 'page');
  }
  assert.ok(performance.now() - started < 1000, 'well within a gesture each');
  assert.equal(history.present.project, project);
  assert.equal(history.undo().state.inputs.groups, history.present.inputs.groups);
});

test('the shortcuts are Cmd or Ctrl with Z, with Shift to go forward, and Ctrl+Y', () => {
  const key = (name, keys = {}) => historyAction({ key: name, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...keys });
  assert.equal(key('z', { metaKey: true }), 'undo');
  assert.equal(key('z', { ctrlKey: true }), 'undo');
  assert.equal(key('Z', { metaKey: true, shiftKey: true }), 'redo');
  assert.equal(key('Z', { ctrlKey: true, shiftKey: true }), 'redo');
  assert.equal(key('y', { ctrlKey: true }), 'redo');
  assert.equal(key('y', { metaKey: true }), null, 'Cmd+Y is the browser\'s');
  assert.equal(key('z'), null);
  assert.equal(key('z', { altKey: true, metaKey: true }), null);
  assert.equal(key('x', { metaKey: true }), null);
  assert.equal(historyAction({ metaKey: true }), null, 'a browser\'s autofill sends a key event without a key');
});

test('in the tool one gesture is one step, the file on disk follows, and what is only a way of looking stays out', { timeout: 240000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kn-history-'));
  const path = join(directory, 'history.design.json');
  const tool = await startTool({ designFile: path, port: 0, open: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await failContrastOn(page);
    await page.goto(tool.url);
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');

    const undo = page.locator('#undo');
    const redo = page.locator('#redo');
    const onDisk = async () => JSON.parse(await readFile(path, 'utf8'));
    const saved = async () => {
      await page.waitForFunction(() => document.getElementById('status').dataset.state === 'saved');
      await page.waitForTimeout(50);
      return onDisk();
    };
    const can = async () => [await undo.isEnabled(), await redo.isEnabled()];
    const canSoon = (undoable, redoable) => page.waitForFunction(([u, r]) => document.getElementById('undo').disabled === !u && document.getElementById('redo').disabled === !r, [undoable, redoable]);
    const open = async (chapter, id) => {
      await page.locator(`.chapter[data-chapter="${chapter}"]`).click();
      if (id) await page.locator(`.page-link[data-go="${id}"]`).click();
    };
    const shownPage = () => page.evaluate(() => document.querySelector('#form > [data-page]:not([hidden])').dataset.page);
    // A real drag through many values, with the pointer's own events.
    const drag = async (locator, from, to, { steps = 12 } = {}) => {
      const box = await locator.boundingBox();
      const at = (share) => [box.x + box.width * share, box.y + box.height / 2];
      await page.mouse.move(...at(from));
      await page.mouse.down();
      for (let step = 1; step <= steps; step += 1) await page.mouse.move(...at(from + ((to - from) * step) / steps));
    };
    const letGo = () => page.mouse.up();

    // Nothing yet, and both say which keys they answer to.
    assert.deepEqual(await can(), [false, false]);
    for (const [button, keys] of [[undo, /(Cmd|Ctrl)\+Z/], [redo, /(Cmd|Ctrl)\+Shift\+Z or Ctrl\+Y/]]) {
      const id = await button.getAttribute('data-g-tooltip');
      assert.match(await page.locator(`#${id}`).textContent(), keys);
    }

    // The buttons take no room from anything: the chapters stay on one line, at the narrowest too.
    const menuFits = () => page.evaluate(() => {
      const [row] = document.querySelectorAll('.menu-row');
      const tops = new Set([...row.querySelectorAll('.chapter')].map((chapter) => chapter.getBoundingClientRect().top));
      return { oneLine: tops.size === 1, rowHeight: row.getBoundingClientRect().height, inside: row.querySelector('.menu-end').getBoundingClientRect().right <= document.querySelector('.controls').getBoundingClientRect().right };
    });
    for (const width of [1440, 1040]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction((wanted) => document.querySelector('.controls').offsetWidth === wanted, width === 1440 ? 540 : 490);
      assert.deepEqual(await menuFits(), { oneLine: true, rowHeight: 44, inside: true }, `at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // Ways of looking add no step, and write nothing.
    const untouched = await readFile(path, 'utf8');
    await page.locator('[data-mode="dark"]').first().click();
    await page.locator('[data-view="phone"]').click();
    await page.locator('[data-view="both"]').click();
    await page.locator('[data-pictures="off"]').click();
    await page.locator('[data-pictures="on"]').click();
    await page.locator('[data-mode="light"]').first().click();
    await open('colour');
    await page.locator('#divider').press('ArrowLeft');
    await page.locator('#divider').press('Home');
    await open('start');
    await page.waitForTimeout(100);
    assert.deepEqual(await can(), [false, false]);
    assert.equal(await readFile(path, 'utf8'), untouched);

    // A drag is one step, however many values it passes.
    await open('space', 'corners');
    const corners = page.locator('[data-path="inputs.corner-profile"]');
    const start = (await onDisk()).inputs['corner-profile'];
    await drag(corners, 0.1, 0.7);
    assert.deepEqual(await can(), [true, false], 'Undo answers while the control is still in the hand');
    await letGo();
    const dragged = (await saved()).inputs['corner-profile'];
    assert.notEqual(dragged, start);
    await undo.click();
    assert.equal((await saved()).inputs['corner-profile'], start, 'undone, the file follows');
    assert.equal(await readFile(path, 'utf8'), untouched, 'to the letter');
    assert.equal(Number(await corners.inputValue()), start);
    assert.deepEqual(await can(), [false, true], 'it was one step');
    await redo.click();
    assert.equal((await saved()).inputs['corner-profile'], dragged, 'redone, the file follows');
    assert.equal(Number(await corners.inputValue()), dragged);
    assert.deepEqual(await can(), [true, false]);

    // A drag let go far from where it began, over the preview, is one step too, and Undo is ignored in mid-drag.
    await drag(corners, 0.5, 0.9);
    const inHand = await corners.inputValue();
    await page.keyboard.press('Control+z');
    assert.equal(await corners.inputValue(), inHand, 'the control stays in the hand');
    assert.deepEqual(await can(), [true, false], 'and nothing was undone');
    await page.mouse.move(1000, 400);
    await letGo();
    await saved();
    await undo.click();
    assert.equal((await saved()).inputs['corner-profile'], dragged);
    await redo.click();
    await saved();
    await undo.click();
    await saved();

    // A drag that ends where it began is no step, and leaves Redo as it was.
    const box = await corners.boundingBox();
    const y = box.y + box.height / 2;
    const thumb = box.x + 7 + (box.width - 14) * (dragged / 100);
    await page.mouse.move(thumb, y);
    await page.mouse.down();
    await page.mouse.move(thumb + 60, y, { steps: 4 });
    await page.mouse.move(thumb, y, { steps: 4 });
    await letGo();
    assert.equal((await saved()).inputs['corner-profile'], dragged);
    await canSoon(true, true);

    // A new change clears what could be redone.
    await page.locator('[data-path="inputs.frame.color"]').selectOption('black');
    await canSoon(true, false);
    await saved();
    await undo.click();
    await saved();
    assert.equal(await page.locator('[data-path="inputs.frame.color"]').inputValue(), (await onDisk()).inputs.frame.color);

    // The keyboard, on a focused slider: an arrow key held is one step.
    await corners.focus();
    const before = Number(await corners.inputValue());
    for (let n = 0; n < 5; n += 1) await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    const held = (await saved()).inputs['corner-profile'];
    assert.ok(held >= before + 5);
    await page.keyboard.press('Control+z');
    assert.equal((await saved()).inputs['corner-profile'], before);
    await page.keyboard.press('Control+Shift+z');
    assert.equal((await saved()).inputs['corner-profile'], held);
    await page.keyboard.press('Meta+z');
    assert.equal((await saved()).inputs['corner-profile'], before);
    await page.keyboard.press('Meta+Shift+z');
    assert.equal((await saved()).inputs['corner-profile'], held);
    await page.keyboard.press('Control+z');
    await saved();
    await page.keyboard.press('Control+y');
    assert.equal((await saved()).inputs['corner-profile'], held);

    // A read-only sample has no text to undo, so there the keys stay the design's.
    await page.locator('[data-page="corners"] .kn-field-control').focus();
    await page.keyboard.press('Control+z');
    assert.equal((await saved()).inputs['corner-profile'], before);
    await page.keyboard.press('Control+y');
    assert.equal((await saved()).inputs['corner-profile'], held);

    // The shadow dial: one step, and the dial, the readout and the stored angle all go back.
    await open('space', 'shadow');
    const dial = page.locator('[data-path="shadow-direction"]');
    await drag(dial, 0.5, 0.8);
    await letGo();
    const angle = (await saved()).inputs.shadow.angle;
    assert.ok(angle < 0, 'the file stores the light\'s angle');
    assert.match(await page.locator('[data-dial]').getAttribute('transform'), new RegExp(`rotate\\(${angle} `));
    await undo.click();
    assert.equal((await saved()).inputs.shadow.angle, 0);
    assert.match(await page.locator('[data-dial]').getAttribute('transform'), /rotate\(-?0 /);
    assert.equal(await page.locator('[data-output="shadow-direction"]').textContent(), 'Down');

    // An arrow on the number line: one step, and arrows, widths and rows follow.
    await open('typography', 'type-scale');
    const left = page.locator('[data-arrow="min"]');
    const breakpoints = async () => (await onDisk()).inputs.type.breakpoints;
    const lineBefore = await breakpoints();
    // The line is laid out once its page shows.
    await page.waitForFunction(() => document.querySelector('[data-arrow="min"]').style.left);
    const leftAt = await left.evaluate((node) => node.style.left);
    const arrow = await left.boundingBox();
    await page.mouse.move(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2);
    await page.mouse.down();
    await page.mouse.move(arrow.x + 60, arrow.y + arrow.height / 2, { steps: 8 });
    await page.mouse.move(arrow.x + 120, arrow.y + arrow.height / 2, { steps: 8 });
    await letGo();
    await saved();
    assert.notDeepEqual(await breakpoints(), lineBefore);
    await undo.click();
    await saved();
    assert.deepEqual(await breakpoints(), lineBefore);
    assert.equal(await left.evaluate((node) => node.style.left), leftAt);
    assert.equal(await page.locator('[data-line-px="min"]').inputValue(), String(lineBefore.min));
    await redo.click();
    await saved();
    await undo.click();
    await saved();

    // A figure typed over on the line takes one step, and Enter ends it.
    const base = page.locator('[data-line-base="max"]');
    const baseBefore = await base.inputValue();
    const nameBefore = await page.locator('[data-line-name="max"]').textContent();
    await base.fill('1.3');
    await page.keyboard.press('Enter');
    assert.equal((await saved()).inputs.type.ratio.max, 1.3);
    await undo.click();
    await saved();
    assert.equal(await base.inputValue(), baseBefore);
    assert.equal(await page.locator('[data-line-name="max"]').textContent(), nameBefore);

    // Typing is one step per burst: it closes on a pause and on leaving the field.
    await open('start');
    const intro = page.locator('[data-path="project.introduction"]');
    const brief = page.locator('[data-path="project.brief"]');
    await intro.click();
    await page.keyboard.type('One burst');
    assert.equal(await undo.isEnabled(), true, 'Undo answers while the burst is open');
    await page.waitForTimeout(1200);
    await page.keyboard.type(' and another');
    await brief.click();
    await page.keyboard.type('Brief');
    await page.locator('[data-page="start"] h1').click();
    assert.equal((await saved()).project.brief, 'Brief');
    await undo.click();
    assert.equal((await saved()).project.brief, undefined);
    assert.equal((await onDisk()).project.introduction, 'One burst and another');
    await undo.click();
    assert.equal((await saved()).project.introduction, 'One burst');
    assert.equal(await intro.inputValue(), 'One burst');
    await undo.click();
    assert.equal((await saved()).project.introduction, undefined);
    assert.equal(await intro.inputValue(), '');

    // Text typed and taken away again in one burst is no step.
    await redo.click();
    await redo.click();
    await redo.click();
    await saved();
    await canSoon(true, false);
    const contact = page.locator('[data-path="project.contact.name"]');
    await contact.click();
    await page.keyboard.type('Temporary');
    for (let n = 0; n < 'Temporary'.length; n += 1) await page.keyboard.press('Backspace');
    await page.locator('[data-page="start"] h1').click();
    await saved();
    assert.equal((await onDisk()).project.brief, 'Brief');
    await undo.click();
    assert.equal((await saved()).project.brief, undefined, 'the last step is still the brief');
    await redo.click();
    await saved();

    // In a text field the keys are the browser's own: the history does not act, and the field keeps its text undo.
    await intro.click();
    const prevented = () => page.evaluate(() => window.__prevented);
    await page.evaluate(() => {
      window.__prevented = [];
      window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'z') window.__prevented.push(event.defaultPrevented); });
    });
    const typed = await intro.inputValue();
    await page.keyboard.type('x');
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await intro.inputValue(), typed, 'the field took back its own letter');
    // The other modifier does nothing natively here, and must not reach the history either.
    await page.keyboard.press(process.platform === 'darwin' ? 'Control+z' : 'Meta+z');
    assert.deepEqual(await prevented(), [false, false]);
    assert.equal((await saved()).project.brief, 'Brief', 'the design\'s history did not move');
    await page.locator('[data-page="start"] h1').click();
    await page.keyboard.press('Control+z');
    assert.equal((await saved()).project.brief, undefined, 'outside the field the same key moves it');
    assert.equal((await prevented()).at(-1), true);
    await page.keyboard.press('Control+y');
    await saved();

    // Undo goes to the page of the change, and Redo too.
    await open('frame');
    assert.equal(await shownPage(), 'header');
    const pageStart = page.locator('[data-path="inputs.header.start"]');
    assert.equal(await pageStart.isDisabled(), false);
    await page.locator('[data-path="inputs.header.attachment"]').selectOption('flow');
    await saved();
    assert.equal(await pageStart.isDisabled(), true, 'a setting that cannot apply is off');
    await open('colour');
    await open('components');
    await undo.click();
    assert.equal(await shownPage(), 'header');
    assert.equal(await page.locator('.page-link[aria-current="true"]').textContent(), await page.locator('[data-page="header"] h1').textContent());
    assert.equal((await saved()).inputs.header.attachment, 'sticky');
    assert.equal(await pageStart.isDisabled(), false, 'and it comes on again');
    await open('start');
    await redo.click();
    assert.equal(await shownPage(), 'header');
    assert.equal((await saved()).inputs.header.attachment, 'flow');
    assert.equal(await pageStart.isDisabled(), true);
    await undo.click();
    await saved();

    // After a click in the preview the keys are inside a frame, and still reach the history.
    await page.locator('[data-path="inputs.header.attachment"]').selectOption('flow');
    await saved();
    await page.evaluate(() => document.getElementById('preview').contentWindow.focus());
    await page.waitForFunction(() => document.activeElement?.id === 'preview');
    await page.keyboard.press('Control+z');
    assert.equal((await saved()).inputs.header.attachment, 'sticky');
    await page.locator('h1:visible').first().click();

    // Far down a long page, a change comes back where it can be seen.
    const far = page.locator('[data-path="inputs.header.search-surface"]');
    await far.scrollIntoViewIfNeeded();
    const scrolled = await page.locator('#document').evaluate((node) => node.scrollTop);
    assert.ok(scrolled > 0);
    await far.selectOption('tint');
    await saved();
    await open('start');
    await undo.click();
    await saved();
    assert.equal(await shownPage(), 'header');
    assert.equal(await page.locator('#document').evaluate((node) => node.scrollTop), scrolled);
    await page.locator('#document').evaluate((node) => { node.scrollTop = 0; });

    // Toggles and drawings: each click is a step, however quick.
    const flag = page.locator('[data-flag="inputs.header.search"]');
    const flagBefore = (await onDisk()).inputs.header.search;
    await flag.click();
    await flag.click();
    await page.locator('[data-pick="inputs.header.arrangement"][data-value="C"]').click();
    assert.equal((await saved()).inputs.header.arrangement, 'C');
    await undo.click();
    assert.equal(await flag.getAttribute('aria-pressed'), String(flagBefore));
    await undo.click();
    assert.equal(await flag.getAttribute('aria-pressed'), String(!flagBefore));
    await undo.click();
    assert.equal((await saved()).inputs.header.search, flagBefore);

    // The colour block: added, gone, and back at its place, sliders and all.
    await open('colour');
    assert.equal((await onDisk()).inputs['brand-colors'].secondary, undefined);
    const block = page.locator('[data-colour-block="secondary"]');
    assert.equal(await block.isHidden(), true);
    await page.locator('[data-add-colour]').click();
    await block.waitFor({ state: 'visible' });
    const added = (await saved()).inputs['brand-colors'].secondary;
    assert.ok(added);
    const hue = page.locator('[data-path="lch.secondary.H"]');
    const chroma = page.locator('[data-path="lch.secondary.C"]');
    const hex = page.locator('[data-hex="secondary"]');
    const sliders = async () => [await hue.inputValue(), await chroma.inputValue(), await page.locator('[data-path="lch.secondary.L"]').inputValue(), await hex.inputValue()];
    // High chroma at a far hue lies outside the gamut, so these positions could not be reckoned back from the colour.
    await drag(chroma, 0.5, 1);
    await letGo();
    await saved();
    const vivid = await sliders();
    await drag(hue, 0.1, 0.6);
    await letGo();
    await saved();
    const turned = await sliders();
    assert.notDeepEqual(turned, vivid);
    await undo.click();
    await saved();
    assert.deepEqual(await sliders(), vivid, 'each slider stands where it stood');
    await redo.click();
    await saved();
    assert.deepEqual(await sliders(), turned);
    await undo.click();
    await undo.click();
    await undo.click();
    await saved();
    assert.equal(await block.isHidden(), true);
    assert.equal((await onDisk()).inputs['brand-colors'].secondary, undefined);
    await redo.click();
    await block.waitFor({ state: 'visible' });
    assert.equal((await saved()).inputs['brand-colors'].secondary, added);
    await undo.click();
    await saved();

    // A setting that fails the contrast check is a step too: it is not saved, and Undo leaves it behind.
    const primary = page.locator('[data-hex="primary"]');
    const good = (await onDisk()).inputs['brand-colors'].primary;
    await primary.fill(failingColour);
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
    assert.match(await page.locator('#notice').textContent(), /contrast check/);
    assert.equal(await page.locator('#presentation').isDisabled(), true);
    await undo.click();
    assert.equal((await saved()).inputs['brand-colors'].primary, good);
    assert.equal(await page.locator('#notice').isHidden(), true);
    assert.equal(await page.locator('#presentation').isDisabled(), false);
    assert.equal(await primary.inputValue(), good);
    await redo.click();
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
    assert.equal((await onDisk()).inputs['brand-colors'].primary, good, 'never written');
    await undo.click();
    await saved();

    // The typeface and its axis sliders: a new typeface writes new sliders, and Undo the old ones.
    await open('typography', 'main-typeface');
    await page.locator('[data-role-tab="display"]').click();
    const axes = () => page.locator('[data-axes] [data-axis]').evaluateAll((nodes) => nodes.map((node) => node.dataset.axis));
    const weight = page.locator('[data-axes] [data-axis="wght"]');
    const weightBefore = await weight.inputValue();
    const axesBefore = await axes();
    await drag(weight, 0.2, 0.8);
    await letGo();
    assert.notEqual((await saved()).inputs.type.roles.display.weight, Number(weightBefore));
    // The change was on Display, and on another tab it could not be seen.
    await page.locator('[data-role-tab="main"]').click();
    await undo.click();
    assert.equal(await page.locator('[data-role-tab="display"]').getAttribute('aria-pressed'), 'true', 'back to the role of the change');
    assert.equal((await saved()).inputs.type.roles.display.weight, Number(weightBefore));
    assert.equal(await weight.inputValue(), weightBefore);
    await page.locator('[data-font="display"]').selectOption('Georgia, serif');
    await saved();
    assert.notDeepEqual(await axes(), axesBefore, 'a typeface has the sliders it has axes for');
    const typefaceStep = (await onDisk()).inputs.type.roles.display;
    assert.equal(typefaceStep.axes, undefined, 'and keeps only those settings');
    await undo.click();
    await saved();
    assert.deepEqual(await axes(), axesBefore);
    assert.deepEqual((await onDisk()).inputs.type.roles.display.axes, { wdth: 112, opsz: 100 }, 'what the typeface took away comes back');
    assert.equal(await page.locator('[data-font="display"]').inputValue(), '');

    // A logo: removed and brought back whole, and the same file can be chosen again.
    await open('start');
    const logo = page.locator('[data-logo-image="logo"]');
    const original = (await onDisk()).project.logo;
    const remove = page.locator('[data-remove-logo="logo"]');
    await remove.click();
    assert.equal((await saved()).project.logo, null);
    assert.equal(await logo.isHidden(), true);
    await undo.click();
    assert.equal((await saved()).project.logo, original);
    assert.equal(await logo.getAttribute('src'), original);
    const svg = join(directory, 'made-up.svg');
    await writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>');
    await page.locator('[data-logo="logo"]').setInputFiles(svg);
    await page.waitForFunction((was) => document.querySelector('[data-logo-image="logo"]').getAttribute('src') !== was, original);
    assert.match((await saved()).project.logo, /^data:image\/svg\+xml/);
    await undo.click();
    assert.equal((await saved()).project.logo, original);
    assert.equal(await page.locator('[data-logo="logo"]').inputValue(), '', 'so the same file can be chosen again');

    // An unchanged logo is not set again, so it is not decoded again.
    await page.evaluate(() => {
      window.__logoSet = 0;
      new MutationObserver(() => { window.__logoSet += 1; }).observe(document.querySelector('[data-logo-image="logo"]'), { attributes: true, attributeFilter: ['src'] });
    });
    await open('space', 'corners');
    await drag(corners, 0.2, 0.3);
    await letGo();
    await saved();
    await undo.click();
    await saved();
    assert.equal(await page.evaluate(() => window.__logoSet), 0);

    // A window reloaded starts with no history.
    assert.deepEqual(errors, []);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('status-text').textContent === 'Saved');
    assert.deepEqual(await can(), [false, false]);
  } finally {
    await browser.close();
    await tool.close();
    await rm(directory, { recursive: true, force: true });
  }
});
