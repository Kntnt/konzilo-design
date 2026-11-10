import test from 'node:test';
import assert from 'node:assert/strict';
import { setupHeaders } from '../src/components/header.js';
import { setupFooters } from '../src/components/footer.js';
import { frameScheduler } from '../src/components/schedule.js';

// Small measured surfaces let us exercise event/focus/observer contracts without a browser.
function environment() {
  const previous = Object.fromEntries(['document', 'window', 'getComputedStyle', 'ResizeObserver', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const observers = [], frames = new Map();
  let frameId = 0;
  const fixture = { focused: null, keyboard: false, shadow: false, observers };
  const attribute = (key) => `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  class Element extends EventTarget {
    constructor(attributes = {}) {
      super(); this.attributes = new Map(Object.entries(attributes));
      this.style = { overflow: 'auto', setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; }, getPropertyValue(key) { return this[key] ?? ''; } };
      this.dataset = new Proxy({}, {
        get: (_, key) => this.attributes.get(attribute(key)),
        set: (_, key, value) => { this.attributes.set(attribute(key), String(value)); return true; },
        deleteProperty: (_, key) => { this.attributes.delete(attribute(key)); return true; },
      });
      this.hidden = false; this.rect = { top: 0, bottom: 64, width: 200, height: 64 };
      this.children = []; this.offsetHeight = 64; this.tagName = 'DIV';
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    toggleAttribute(name, force) { if (force ?? !this.hasAttribute(name)) this.setAttribute(name, ''); else this.removeAttribute(name); }
    getBoundingClientRect() { return this.rect; }
    getClientRects() { return this.hidden ? [] : [this.rect]; }
    matches(selector) { return selector === ':focus-visible' && fixture.keyboard && fixture.focused === this; }
    focus() { fixture.focused = this; document.activeElement = this; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    fire(type, values = {}) {
      const event = new Event(type, { cancelable: true });
      for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
      this.dispatchEvent(event);
      return event;
    }
  }
  const doc = new Element(), win = new Element(), root = new Element();
  doc.documentElement = root; doc.getElementById = () => null;
  root.clientHeight = 600; root.scrollHeight = 2400;
  win.scrollY = 0; win.scrollTo = (options) => { fixture.scrolled = options; };
  const print = new Element(); print.matches = false;
  win.matchMedia = () => print;
  globalThis.document = doc; globalThis.window = win;
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = []; observers.push(this); }
    observe(node) { this.nodes.push(node); }
    disconnect() { this.disconnected = true; }
  };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.getComputedStyle = (node) => ({ fontSize: '16px', columnGap: '16px', transitionDuration: '0.16s, 0.16s, 0.28s', colorScheme: node.dataset.knSurface === 'brand' ? 'dark' : 'light', backgroundColor: node.dataset.knSurface === 'brand' ? 'brand-fill' : 'page-fill', boxShadow: node === fixture.main && fixture.shadow && (node.hasAttribute('data-kn-auto-shadow') || node.dataset.knShadow === 'true') ? 'page-shadow' : 'none' });
  fixture.flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback()); };
  fixture.restore = () => { for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return Object.assign(fixture, { Element, doc, win, root, print });
}

test('Header measures skipped steps, publishes geometry, defers appearance until hidden, and coordinates panels and focus', () => {
  const f = environment();
  let dispose;
  try {
    const { Element, doc, win, root } = f;
    const page = new Element({ 'data-kn-surface': 'page' }), main = new Element(), band = new Element({ 'data-kn-surface': 'brand' });
    const header = new Element({ 'data-kn-attachment': 'sticky', 'data-kn-start': 'under', 'data-kn-autohide': 'true', 'data-kn-opaque-surface': 'page', 'data-kn-surface': 'page' });
    const bar = new Element(), inner = new Element(), identity = new Element();
    inner.clientWidth = 500;
    const collapsed = (step) => header.dataset.knCollapsed?.split(' ').includes(step);
    identity.getBoundingClientRect = () => ({ width: collapsed('name') ? 140 : 220 });
    const start = new Element(), end = new Element();
    start.getBoundingClientRect = identity.getBoundingClientRect;
    end.getBoundingClientRect = () => ({ width: 600 - (collapsed('links') ? 200 : 0) - (collapsed('word') ? 50 : 0) - (collapsed('language') ? 56 : 0) - (collapsed('cta') ? 100 : 0) - (collapsed('search') ? 56 : 0) });
    inner.children = [start, end];
    const panels = ['menu', 'language', 'search'].map((name) => new Element({ 'data-kn-panel': name, popover: 'auto' }));
    const triggers = ['menu', 'language', 'search'].map((name) => {
      const node = new Element({ 'data-kn-trigger': name, 'aria-expanded': 'false', popovertarget: name });
      node.closest = (selector) => selector === '[data-kn-trigger]' ? node : null;
      return node;
    });
    triggers[2].tagName = 'A';
    const field = new Element();
    panels[2].querySelector = () => field;
    const trigger = (name) => triggers.find((node) => node.dataset.knTrigger === name);
    header.querySelector = (selector) => ({ '.kn-header-bar': bar, '.kn-header-inner': inner, '.kn-header-identity': identity, '[data-kn-trigger="menu"]': triggers[0], '[data-kn-panel="search"] input': field }[selector] ?? (selector === ':focus-visible' && f.keyboard ? f.focused : null));
    header.querySelectorAll = (selector) => selector === '[data-kn-panel]' ? panels : selector === '[data-kn-trigger]' ? triggers : [];
    header.closest = () => page;
    header.contains = (node) => [header, ...panels, ...triggers, field].includes(node);
    inner.querySelectorAll = () => [start, end];
    page.querySelector = () => main;
    main.querySelector = () => band;
    doc.querySelectorAll = () => [header];
    dispose = setupHeaders();
    assert.equal(header.dataset.knCollapsed, 'name links word language', 'a slogan below a wider brand frees no width, so it is no step of its own');
    assert.equal(root.style['--kn-header-height'], '4rem');
    assert.equal(root.style['--kn-header-visible-height'], '4rem');
    assert.equal(header.dataset.knSurface, 'brand');
    assert.equal(header.dataset.knLogoPolarity, 'dark');
    assert.ok(header.hasAttribute('data-kn-transparent'));
    assert.ok(panels.every((panel) => panel.hidden));
    win.scrollY = 100; win.fire('scroll');
    assert.ok(header.hasAttribute('data-kn-away'));
    assert.ok(header.hasAttribute('data-kn-transparent'), 'outgoing bar does not flicker opaque');
    assert.equal(root.style['--kn-header-visible-height'], '4rem', 'scroll padding holds until the outgoing bar is entirely hidden');
    header.fire('transitionend', { target: header, propertyName: 'translate' });
    assert.equal(root.style['--kn-header-visible-height'], '0rem');
    assert.equal(header.dataset.knSurface, 'page');
    assert.ok(!header.hasAttribute('data-kn-transparent'));
    win.scrollY = 95; win.fire('scroll');
    assert.ok(!header.hasAttribute('data-kn-away'));
    assert.ok(header.hasAttribute('data-kn-line'), 'a disabled shadow falls back to a separating hairline');
    header.fire('click', { target: trigger('menu') });
    assert.equal(trigger('menu').getAttribute('aria-expanded'), 'true');
    assert.equal(root.style.overflow, 'hidden');
    assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
    header.fire('click', { target: trigger('search') });
    assert.equal(trigger('menu').getAttribute('aria-expanded'), 'false');
    assert.equal(trigger('search').getAttribute('aria-expanded'), 'true');
    assert.equal(f.focused, field);
    assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
    win.scrollY = 200; win.fire('scroll');
    assert.ok(!header.hasAttribute('data-kn-away'), 'an open panel prevents autohide');
    doc.fire('keydown', { key: 'Escape' });
    assert.ok(panels.every((panel) => panel.hidden));
    assert.equal(f.focused, trigger('search'));
    assert.equal(root.style.overflow, 'auto');
    header.fire('click', { target: trigger('language') });
    const outside = new Element(); outside.closest = () => null;
    doc.fire('click', { target: outside });
    assert.equal(f.focused, trigger('language'));
    assert.ok(panels.every((panel) => panel.hidden));
    f.keyboard = true; f.focused = trigger('menu');
    win.scrollY = 300; win.fire('scroll');
    assert.ok(!header.hasAttribute('data-kn-away'));
    assert.ok(f.observers[0].nodes.includes(inner));
    inner.clientWidth = 1200; f.observers[0].callback(); f.flush();
    assert.equal(header.dataset.knCollapsed, '', 'resizing restores the complete bar');
    dispose(); dispose = null;
    assert.equal(f.observers[0].disconnected, true);
    assert.ok(!root.hasAttribute('data-kn-sticky-header'));
  } finally { dispose?.(); f.restore(); }
});

test('Footer rechecks height, fills short pages with the page Surface, applies the Page edge, and uncovers focus', () => {
  const f = environment();
  let dispose;
  try {
    const { Element, doc, win, root, print } = f;
    const page = new Element({ 'data-kn-surface': 'page' });
    const main = new Element(), last = new Element({ 'data-kn-surface': 'brand' });
    f.main = main;
    main.rect.bottom = 600; last.rect.bottom = 200; main.lastElementChild = last;
    const footer = new Element({ 'data-kn-attachment': 'reveal', 'data-kn-top-line': '' });
    footer.rect.height = 300;
    const background = new Element({ 'data-kn-surface': 'page' });
    footer.parentElement = page; footer.closest = () => page; footer.querySelector = () => background;
    page.querySelector = () => main; doc.querySelectorAll = () => [footer];
    dispose = setupFooters();
    assert.equal(footer.dataset.knEffectiveAttachment, 'reveal');
    assert.equal(page.dataset.knFooterAttachment, 'reveal');
    assert.equal(page.style['--kn-footer-height'], '18.75rem');
    assert.ok(main.hasAttribute('data-kn-auto-shadow'), 'blank space below the last dark band uses the page Surface');
    assert.ok(main.hasAttribute('data-kn-auto-line'), 'zero shadow strength retains a visible reveal edge');
    f.shadow = true; f.observers[0].callback(); f.flush();
    assert.ok(main.hasAttribute('data-kn-auto-shadow'));
    assert.ok(!main.hasAttribute('data-kn-auto-line'));
    const link = new Element(); f.keyboard = true; link.focus();
    footer.fire('focusin', { target: link });
    assert.deepEqual(f.scrolled, { top: 2400, behavior: 'instant' });
    footer.rect.height = 601; f.observers[0].callback(); f.flush();
    assert.equal(footer.dataset.knEffectiveAttachment, 'flow');
    assert.equal(page.dataset.knFooterAttachment, 'flow');
    assert.ok(!main.hasAttribute('data-kn-auto-shadow'));
    footer.rect.height = 600; f.observers[0].callback(); f.flush();
    assert.equal(footer.dataset.knEffectiveAttachment, 'reveal');
    print.matches = true; print.fire('change'); f.flush();
    assert.equal(footer.dataset.knEffectiveAttachment, 'flow');
    print.matches = false; print.fire('change'); f.flush();
    assert.equal(footer.dataset.knEffectiveAttachment, 'reveal');
    last.rect.bottom = main.rect.bottom;
    win.fire('resize'); f.flush();
    assert.ok(!main.hasAttribute('data-kn-auto-shadow'), 'different adjoining Surfaces need no automatic edge');
    assert.ok(!main.hasAttribute('data-kn-auto-line'));
    dispose(); dispose = null;
    assert.ok(!page.hasAttribute('data-kn-footer-attachment'));
    assert.equal(f.observers[0].disconnected, true);
  } finally { dispose?.(); f.restore(); }
});

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
