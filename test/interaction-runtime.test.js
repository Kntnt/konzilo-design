import test from 'node:test';
import assert from 'node:assert/strict';
import { querySelectorAll, matches } from 'ultrahtml/selector';
import { setupConsent, hasConsent, setConsent, openConsentSettings } from '../src/components/consent.js';
import { mountEmbed, setupEmbeds } from '../src/components/embed.js';
import { setupContentControls } from '../gallery/src/content-controls.js';

// Measured DOM surfaces exercise the browser controllers without a server,
// browser installation, network, profile, or files outside the repository.
function environment() {
  const globals = ['document', 'window', 'ResizeObserver', 'getComputedStyle'];
  const previous = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let doc;
  class Element extends EventTarget {
    constructor(tag, attributes = {}) {
      super(); this.tagName = tag.toUpperCase(); this.attributes = { ...attributes }; this.children = []; this.parentElement = null; this._text = '';
      this.rect = { top: 500, bottom: 600, height: 100, width: 800 };
      this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
      const attribute = (key) => `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      this.dataset = new Proxy({}, { get: (_, key) => this.getAttribute(attribute(key)) ?? undefined, set: (_, key, value) => { this.setAttribute(attribute(key), value); return true; } });
      this.willValidate = true; this.validity = { valid: true }; this.validationMessage = '';
    }
    get id() { return this.getAttribute('id'); }
    get firstChild() { return this.children[0] ?? null; }
    get nextSibling() { const nodes = this.parentElement?.children ?? []; return nodes[nodes.indexOf(this) + 1] ?? null; }
    get classList() { return { toggle: (name, force) => { const names = new Set(this.className.split(/\s+/).filter(Boolean)); if (force ?? !names.has(name)) names.add(name); else names.delete(name); this.className = [...names].join(' '); } }; }
    insertBefore(node, before) { node.remove(); const index = this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, node); node.parentElement = this; }
    get hidden() { return this.hasAttribute('hidden'); } set hidden(value) { this.toggleAttribute('hidden', value); }
    get open() { return this.hasAttribute('open'); }
    get checked() { return this.hasAttribute('checked'); } set checked(value) { this.toggleAttribute('checked', value); }
    get disabled() { return this.hasAttribute('disabled'); } set disabled(value) { this.toggleAttribute('disabled', value); }
    get name() { return this.getAttribute('name') ?? ''; }
    get className() { return this.getAttribute('class') ?? ''; } set className(value) { this.setAttribute('class', value); }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); } set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get value() { return this._value ?? this.getAttribute('value') ?? (this.tagName === 'SELECT' ? this.options[0]?.value ?? '' : ''); } set value(value) { this._value = String(value); }
    get href() { return this.getAttribute('href'); } set href(value) { this.setAttribute('href', value); }
    get options() { return this.children.filter((child) => child.tagName === 'OPTION'); }
    get elements() { const nodes = this.querySelectorAll('input, select, textarea, button'); nodes.namedItem = (name) => nodes.find((node) => node.name === name); return nodes; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
    toggleAttribute(key, value = !this.hasAttribute(key)) { if (value) this.setAttribute(key, ''); else this.removeAttribute(key); }
    append(...nodes) { nodes.forEach((node) => { node.remove(); this.children.push(node); node.parentElement = this; }); }
    replaceChildren(...nodes) { this.children.forEach((node) => { node.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this); this.parentElement = null; }
    tree() { const map = (element, parent) => { const node = { type: 1, name: element.tagName.toLowerCase(), attributes: element.attributes, children: [], parent, element }; node.children = element.children.map((child) => map(child, node)); return node; }; return map(this); }
    querySelectorAll(selector) { return querySelectorAll(this.tree(), selector).map((node) => node.element).filter((element) => element !== this); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    matches(selector) { return matches(this.tree(), selector); }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    focus() { doc.activeElement = this; }
    after(node) { node.remove(); const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this) + 1, 0, node); node.parentElement = this.parentElement; }
    scrollIntoView() { doc.scrolledTo = this; }
    getBoundingClientRect() { return this.rect; }
    showModal() { this.setAttribute('open', ''); }
    close() { this.removeAttribute('open'); this.fire('close'); }
    fire(type, values = {}) {
      const event = new Event(type, { cancelable: true });
      Object.entries(values).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
      this.dispatchEvent(event); return event;
    }
  }
  doc = new Element('document'); doc.documentElement = new Element('html'); doc.body = new Element('body'); doc.append(doc.documentElement); doc.documentElement.append(doc.body); doc.activeElement = doc.body;
  doc.createElement = (tag) => new Element(tag); doc.getElementById = (id) => doc.querySelector(`#${id}`);
  const win = new Element('window'); win.location = { pathname: '/notes/', search: '', hash: '#results' };
  win.history = { replaceState(_, __, value) { const url = new URL(value, 'https://example.invalid'); Object.assign(win.location, { pathname: url.pathname, search: url.search, hash: url.hash }); } };
  const storage = new Map(); win.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  win.scrollBy = (value) => { win.scrolled = value; };
  globalThis.document = doc; globalThis.window = win; globalThis.getComputedStyle = () => ({ fontSize: '16px' });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const element = (tag, attrs, parent = doc.body) => { const node = new Element(tag, attrs); parent?.append(node); return node; };
  return { doc, win, storage, element, restore() { globals.forEach((key) => { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; }); } };
}
function consentFixture(f, deferred = false) {
  const categories = [{ id: 'necessary', required: true }, { id: 'external-media' }, { id: 'analytics' }];
  const banner = f.element('aside', { id: 'test-consent', class: 'kn-consent', hidden: '', 'data-kn-categories': JSON.stringify(categories), 'data-kn-consent-version': '2', 'data-kn-storage-key': 'kn-test-consent', 'data-kn-settings': 'settings', 'data-kn-deferred': String(deferred) });
  const accept = f.element('button', { 'data-kn-consent-accept': '' }, banner), reject = f.element('button', { 'data-kn-consent-reject': '' }, banner);
  const dialog = f.element('dialog', { id: 'settings' });
  const checks = categories.map(({ id, required }) => f.element('input', { value: id, 'data-kn-category': '', ...(required ? { disabled: '' } : {}) }, dialog));
  const reopen = f.element('button', { 'data-kn-consent-reopen': 'test-consent', 'data-kn-consent-open': '', hidden: '' });
  const dialogAccept = f.element('button', { 'data-kn-consent-accept': '' }, dialog), dialogReject = f.element('button', { 'data-kn-consent-reject': '' }, dialog);
  return { banner, accept, reject, dialog, checks, reopen, dialogAccept, dialogReject };
}
function embedFixture(f, parent = f.doc.body, note, url = 'https://youtu.be/Juniper0001') {
  const embed = f.element('figure', { class: 'kn-embed', 'data-kn-url': url, 'data-kn-embed-title': 'A studio film', ...(note ? { 'data-kn-gallery-note': note } : {}) }, parent);
  const stage = f.element('div', { class: 'kn-embed-stage', hidden: '' }, embed);
  const warning = f.element('div', { class: 'kn-embed-consent' }, stage);
  const button = f.element('button', { 'data-kn-embed-load': '' }, warning);
  const thumbnail = url.includes('youtu') ? f.element('button', { class: 'kn-embed-thumbnail', hidden: '' }, stage) : null;
  const frame = f.element('div', { class: 'kn-embed-frame', hidden: '' }, stage);
  return { embed, stage, warning, button, thumbnail, frame };
}

test('consent persists versioned choices, guards unavailable storage, opens from anywhere and republishes banner height', () => {
  const f = environment(); let dispose;
  try {
    const { banner, accept, reject, dialog, checks } = consentFixture(f);
    let changes = 0; f.win.addEventListener('kn:consentchange', () => changes++);
    dispose = setupConsent(); assert.equal(banner.hidden, false); assert.equal(f.doc.documentElement.style['--kn-consent-height'], '6.25rem');
    assert.equal(hasConsent('necessary'), true); assert.equal(hasConsent('external-media'), false);
    banner.fire('click', { target: accept }); assert.equal(banner.hidden, true); assert.equal(hasConsent('external-media'), true); assert.equal(hasConsent('analytics'), true);
    assert.equal(JSON.parse(f.storage.get('kn-test-consent')).version, '2'); assert.equal(f.doc.documentElement.style['--kn-consent-height'], '0rem');
    const footer = f.element('a', { href: '/preferences/', 'data-kn-consent-open': '' }); footer.focus();
    assert.equal(f.doc.fire('click', { target: footer, button: 0 }).defaultPrevented, true); assert.equal(dialog.open, true); assert.equal(checks[1].checked, true);
    checks[1].checked = false; checks[2].checked = false; dialog.fire('submit'); assert.equal(dialog.open, false); assert.equal(hasConsent('external-media'), false); assert.equal(f.doc.activeElement, footer);
    banner.fire('kn:consentbanneropen'); assert.equal(banner.hidden, false);
    banner.fire('click', { target: reject }); assert.equal(hasConsent('necessary'), true); assert.equal(hasConsent('analytics'), false);
    f.win.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.doesNotThrow(() => setConsent({ 'external-media': true })); assert.equal(hasConsent('external-media'), true);
    openConsentSettings(footer); assert.equal(dialog.open, true); dialog.close(); assert.equal(f.doc.activeElement, footer);
    f.win.fire('storage', { key: 'kn-test-consent' }); assert.equal(banner.hidden, false); assert.equal(hasConsent('external-media'), false);
    const focused = f.element('a'); focused.rect.bottom = 650; f.doc.fire('focusin', { target: focused }); assert.deepEqual(f.win.scrolled, { top: 158, behavior: 'instant' });
    assert.ok(changes >= 5);
  } finally { dispose?.(); f.restore(); }
});

test('a changed consent version asks again; deferred gallery banners remain hidden until explicitly opened', () => {
  const f = environment(); let dispose;
  try {
    const { banner } = consentFixture(f, true);
    f.storage.set('kn-test-consent', JSON.stringify({ version: '1', choices: { necessary: true, 'external-media': true, analytics: true } }));
    dispose = setupConsent(); assert.equal(hasConsent('external-media'), false); assert.equal(banner.hidden, true);
    banner.fire('kn:consentbanneropen'); assert.equal(banner.hidden, false);
  } finally { dispose?.(); f.restore(); }
});

test('without consent a visitor chooses consciously; with it content shows, and a heavy player waits behind a thumbnail', () => {
  const f = environment(); let disposeConsent, disposeEmbed;
  const youtube = 'https://www.youtube-nocookie.com/embed/Juniper0001?autoplay=1';
  try {
    consentFixture(f); disposeConsent = setupConsent();
    const e = embedFixture(f); disposeEmbed = mountEmbed(e.embed);
    assert.equal(e.stage.hidden, false); assert.equal(e.warning.hidden, false); assert.equal(e.thumbnail.hidden, true); assert.equal(e.frame.children.length, 0);
    e.button.fire('click'); const player = e.frame.children[0];
    assert.equal(player.tagName, 'IFRAME'); assert.equal(player.getAttribute('src'), youtube);
    assert.equal(player.getAttribute('title'), 'A studio film'); assert.equal(player.getAttribute('loading'), 'lazy'); assert.equal(player.getAttribute('referrerpolicy'), 'strict-origin-when-cross-origin');
    assert.equal(hasConsent('external-media'), false, 'this one time grants nothing lasting'); assert.equal(f.storage.size, 0);
    setConsent({ 'external-media': false }); assert.equal(e.frame.children.length, 0); assert.equal(e.warning.hidden, false);
    setConsent({ 'external-media': true }); assert.equal(e.warning.hidden, true); assert.equal(e.thumbnail.hidden, false); assert.equal(e.frame.children.length, 0, 'a heavy player does not load by itself');
    e.thumbnail.fire('click'); assert.equal(e.thumbnail.hidden, true); assert.equal(e.frame.children[0].getAttribute('src'), youtube);
    disposeEmbed(); disposeEmbed = null; assert.equal(e.frame.children.length, 0);
    const chart = embedFixture(f, f.doc.body, undefined, 'https://datawrapper.dwcdn.net/Atlas/1/'); const unmount = mountEmbed(chart.embed);
    assert.equal(chart.frame.children.length, 1, 'other services simply show their content'); assert.equal(chart.frame.children[0].getAttribute('src'), 'https://datawrapper.dwcdn.net/Atlas/1/'); unmount();
    const gallery = embedFixture(f, f.doc.body, 'Frames disabled in this gallery.'); const stop = mountEmbed(gallery.embed); gallery.thumbnail.fire('click'); assert.equal(gallery.frame.children[0].tagName, 'P'); assert.equal(gallery.frame.querySelector('iframe'), null); stop();
  } finally { disposeEmbed?.(); disposeConsent?.(); f.restore(); }
});

test('delegated overlay clicks preserve modified navigation, use a modal, remove hidden players and restore focus after list replacement', () => {
  const f = environment(); let dispose, disposeConsent;
  try {
    consentFixture(f); disposeConsent = setupConsent(); dispose = setupEmbeds();
    const link = f.element('a', { href: 'https://youtu.be/Juniper0001', 'data-kn-embed-overlay': '', 'data-kn-embed-title': 'A new row' });
    for (const flags of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      assert.equal(f.doc.fire('click', { target: link, button: 0, ...flags }).defaultPrevented, false);
      assert.equal(f.doc.querySelector('.kn-embed-dialog'), null);
    }
    assert.equal(f.doc.fire('click', { target: link, button: 0 }).defaultPrevented, true);
    const dialog = f.doc.querySelector('.kn-embed-dialog'); assert.equal(dialog.open, true); assert.equal(dialog.querySelector('iframe'), null);
    dialog.querySelector('[data-kn-embed-load]').fire('click'); const frame = dialog.querySelector('.kn-embed-frame'); assert.equal(frame.children[0].tagName, 'IFRAME');
    dialog.close(); assert.equal(frame.children.length, 0); assert.equal(f.doc.activeElement, link); assert.equal(f.doc.querySelector('.kn-embed-dialog'), null);
    link.remove(); const replacement = f.element('a', { ...link.attributes });
    f.doc.fire('click', { target: replacement, button: 0 }); assert.ok(f.doc.querySelector('.kn-embed-dialog').open, 'newly rendered rows use the document listener');
    setConsent({ 'external-media': true }); assert.equal(f.doc.querySelector('.kn-embed-dialog iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/Juniper0001?autoplay=1', 'the click on the row was the request to play');
  } finally { dispose?.(); disposeConsent?.(); f.restore(); }
});

test('refusing stores only necessary consent; reopen works after choices and expiry asks again', () => {
  const f = environment(); let dispose;
  try {
    const { banner, reject, dialog, checks, reopen, dialogAccept, dialogReject } = consentFixture(f);
    dispose = setupConsent(); assert.equal(reopen.hidden, true);
    banner.fire('click', { target: reject });
    let stored = JSON.parse(f.storage.get('kn-test-consent'));
    assert.deepEqual(stored.choices, { necessary: true, 'external-media': false, analytics: false });
    assert.ok(Number.isFinite(stored.timestamp)); assert.equal(reopen.hidden, false);
    f.doc.fire('click', { target: reopen, button: 0 }); assert.equal(dialog.open, true);
    assert.equal(checks[1].checked, false); assert.equal(checks[2].checked, false);
    dialog.fire('click', { target: dialogAccept }); assert.equal(dialog.open, false); assert.equal(hasConsent('analytics'), true);
    openConsentSettings(reopen); dialog.fire('click', { target: dialogReject });
    stored = JSON.parse(f.storage.get('kn-test-consent')); assert.equal(stored.choices.analytics, false);
    stored.timestamp -= 183 * 86400000; f.storage.set('kn-test-consent', JSON.stringify(stored));
    f.win.fire('storage', { key: 'kn-test-consent' }); assert.equal(banner.hidden, false); assert.equal(reopen.hidden, true);
    assert.equal(hasConsent('external-media'), false); assert.equal(hasConsent('necessary'), true);
  } finally { dispose?.(); f.restore(); }
});

test('one gallery configurator moves actual metadata, styles CTA and pictures, and switches all three loops without replacing links', () => {
  const f = environment();
  try {
    const form = f.element('form', { id: 'g-content-controls' });
    const fields = {};
    for (const [name, value] of Object.entries({ presentation: 'cards', ratio: '3:2', metadata: '1', separator: 'dot', cta: 'link', 'cta-icon': '→', surface: 'raised', columns: '3' })) fields[name] = f.element(name === 'ratio' ? 'select' : 'input', { name, value }, form);
    for (const value of ['3:2', '2:1', '1:1']) f.element('option', { value }, fields.ratio);
    for (const name of ['images', 'inset', 'author', 'date', 'category', 'pill', 'text', 'plated']) fields[name] = f.element('input', { name, type: 'checkbox', ...(!['inset', 'pill'].includes(name) ? { checked: '' } : {}) }, form);
    const records = Array.from({ length: 3 }, () => {
      const loop = f.element('div', { 'data-g-configurable': '' });
      const list = f.element('ul', { class: 'kn-content-items kn-content-rows' }, loop);
      const item = f.element('li', { class: 'kn-content-item' }, list);
      const article = f.element('article', { class: 'kn-content-row' }, item);
      const picture = f.element('a', { class: 'kn-content-picture' }, article);
      const body = f.element('div', { class: 'kn-content-body' }, article);
      const meta = f.element('p', { class: 'kn-content-meta', 'data-kn-meta': '1' }, body);
      const metadata = ['author', 'date', 'category'].map((kind) => f.element('span', { 'data-kn-meta-kind': kind }, meta));
      const heading = f.element('h3', { class: 'kn-content-heading' }, body), link = f.element('a', { href: '/note/' }, heading);
      const text = f.element('p', { class: 'kn-content-text' }, body);
      const cta = f.element('div', { class: 'kn-content-cta' }, body), ctaLink = f.element('a', { href: '/note/' }, cta), icon = f.element('span', { class: 'kn-content-cta-icon' }, ctaLink);
      return { loop, list, article, picture, body, metadata, link, text, cta, ctaLink, icon };
    });
    setupContentControls();
    assert.ok(records.every(({ loop, article }) => loop.dataset.knPresentation === 'cards' && article.matches('.kn-card.kn-content-card')));
    fields.presentation.value = 'rows'; fields.ratio.value = '1:1'; fields.metadata.value = 'both'; fields.pill.checked = true; fields.cta.value = 'button'; fields['cta-icon'].value = '»'; fields.plated.checked = false;
    form.fire('change');
    for (const { loop, article, metadata, ctaLink, icon } of records) {
      assert.equal(loop.dataset.knPresentation, 'rows'); assert.equal(article.dataset.knImageRatio, '1:1'); assert.ok(!article.hasAttribute('data-kn-surface'));
      assert.equal(metadata[0].parentElement.dataset.knMeta, '2'); assert.equal(metadata[2].parentElement.dataset.knMeta, '1'); assert.ok(metadata[2].matches('.kn-pill'));
      assert.ok(ctaLink.matches('.kn-button')); assert.equal(ctaLink.dataset.knVariant, 'outline'); assert.equal(icon.textContent, '»');
    }
    fields.presentation.value = 'cards'; fields.author.checked = false; fields.images.checked = false; fields.text.checked = false; fields.cta.value = 'none'; fields.columns.value = '4'; form.fire('change');
    for (const { article, list, picture, text, cta, metadata, link } of records) {
      assert.equal(article.dataset.knImageRatio, '3:2'); assert.equal(list.dataset.knColumns, '4'); assert.ok(picture.hidden && text.hidden && cta.hidden);
      assert.equal(metadata[0].parentElement, null); assert.equal(article.querySelector('.kn-content-heading a'), link);
    }
  } finally { f.restore(); }
});
