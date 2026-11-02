import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangementGroups, givingWay, GIVING_WAY_ORDER, autohideDecision, appearanceDecision } from '../src/components/header.js';

test('arrangements fix group and document order, omitting absent items', () => {
  const all = Object.fromEntries(['links', 'menu', 'search', 'language', 'cta'].map((key) => [key, true]));
  assert.deepEqual(arrangementGroups('A', all), [['identity'], ['search', 'language', 'links', 'menu', 'cta']]);
  assert.deepEqual(arrangementGroups('B', all), [['identity', 'links'], ['search', 'language', 'menu', 'cta']]);
  assert.deepEqual(arrangementGroups('C', all), [['identity', 'links', 'search'], ['language', 'menu', 'cta']]);
  assert.deepEqual(arrangementGroups('C'), [['identity'], []]);
  assert.throws(() => arrangementGroups('D'));
});

test('giving way uses the required order even with unordered measured candidates', () => {
  const steps = GIVING_WAY_ORDER.map((name, i) => ({ name, width: 900 - i * 100 }));
  assert.deepEqual(givingWay({ available: 1000, width: 1000, steps }), { collapsed: [], scale: 1 });
  for (let i = 0; i < 7; i++) assert.deepEqual(givingWay({ available: 900 - i * 100, width: 1000, steps: [...steps].reverse() }).collapsed, GIVING_WAY_ORDER.slice(0, i + 1));
});

test('giving way skips absent steps and steps that save no width, and never removes a name without a logo', () => {
  const measured = [{ name: 'slogan', width: 1000 }, { name: 'links', width: 700 }, { name: 'word', width: 650 }, { name: 'language', width: 650 }, { name: 'cta', width: 500 }, { name: 'search', width: 450 }];
  assert.deepEqual(givingWay({ available: 550, width: 1000, steps: measured }), { collapsed: ['links', 'word', 'cta'], scale: 1 });
  assert.deepEqual(givingWay({ available: 320, width: 1000, steps: measured, identityWidth: 250 }), { collapsed: ['links', 'word', 'cta', 'search'], scale: 0.48 });
  assert.equal(givingWay({ available: 320, width: 600, identityWidth: 500 }).scale, 0.44);
});

test('autohide ignores jitter, accumulates small changes, and shows on the first meaningful upward movement', () => {
  let state = { away: false, anchor: 100 };
  state = autohideDecision({ y: 103, height: 64, ...state });
  assert.deepEqual(state, { away: false, anchor: 100 });
  state = autohideDecision({ y: 105, height: 64, ...state });
  assert.deepEqual(state, { away: true, anchor: 105 });
  assert.deepEqual(autohideDecision({ y: 103, height: 64, ...state }), state);
  assert.deepEqual(autohideDecision({ y: 101, height: 64, ...state }), { away: false, anchor: 101 });
});

test('the top, open panels and keyboard keep the header visible; mouse focus is not an input', () => {
  const base = { y: 200, height: 64, anchor: 100, away: true };
  for (const change of [{ y: 0 }, { panelOpen: true }, { keyboard: true }, { sticky: false }, { autohide: false }]) assert.equal(autohideDecision({ ...base, ...change }).away, false);
  assert.equal(autohideDecision({ y: 63, height: 64, anchor: 0 }).away, false);
  assert.equal(autohideDecision(base).away, true);
});

test('an under header changes at T unless it is going to slide away; the change waits until hidden', () => {
  const base = { under: true, y: 24, autohide: true, clear: true };
  assert.deepEqual(appearanceDecision(base), { transparent: true, clear: true });
  assert.deepEqual(appearanceDecision({ ...base, hidden: true }), { transparent: false, clear: false });
  assert.deepEqual(appearanceDecision({ ...base, blocked: true }), { transparent: false, clear: false });
  assert.deepEqual(appearanceDecision({ ...base, autohide: false }), { transparent: false, clear: false });
  assert.deepEqual(appearanceDecision({ ...base, y: 23, clear: false }), { transparent: true, clear: true });
  assert.deepEqual(appearanceDecision({ ...base, y: 200, clear: false }), { transparent: false, clear: false });
  assert.equal(appearanceDecision({ ...base, under: false }).transparent, false);
});
