import test from 'node:test';
import assert from 'node:assert/strict';
import { frameScheduler } from '../src/components/schedule.js';

// The header and the footer run no script of their own (header.md and footer.md, How it is built); the scheduler
// stays for consent.js, which measures the banner.
// WebKit pauses frames in an iframe out of view: a layout waiting for one would wait until it is scrolled to.
test('a scheduled layout runs once, on the next frame or, where no frame comes, on a timer', async () => {
  const previous = Object.fromEntries(['requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map();
  let id = 0;
  globalThis.requestAnimationFrame = (callback) => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = (frame) => frames.delete(frame);
  try {
    let runs = 0;
    const schedule = frameScheduler(() => { runs++; }, 20);
    schedule(); schedule(); schedule();
    assert.equal(frames.size, 1, 'asked for one frame however often it is scheduled');
    [...frames.values()][0]();
    assert.equal(runs, 1);
    await new Promise((done) => setTimeout(done, 40));
    assert.equal(runs, 1, 'the timer of a frame that came does nothing');

    // A frame that never comes: the timer runs the layout, and a later resize is not lost.
    frames.clear();
    schedule();
    await new Promise((done) => setTimeout(done, 40));
    assert.equal(runs, 2);
    assert.equal(frames.size, 0, 'the frame that never came is given up');
    schedule();
    await new Promise((done) => setTimeout(done, 40));
    assert.equal(runs, 3);

    schedule();
    schedule.cancel();
    await new Promise((done) => setTimeout(done, 40));
    assert.equal(runs, 3, 'a cancelled layout never runs');
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
