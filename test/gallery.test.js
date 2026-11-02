import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { setupGalleryLab } from '../gallery/src/lab.js';
import { layoutFooter } from '../src/components/footer.js';
import { footerVariants } from '../gallery/src/frame-samples.ts';
import { derive } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';
import { setupControls } from '../gallery/src/controls.js';

let html;
before(async () => {
  execFileSync('npm', ['run', 'gallery'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  html = await readFile(new URL('../gallery/dist/index.html', import.meta.url), 'utf8');
});

function controls() {
  const inputs = JSON.parse(html.match(/<script[^>]+id="g-initial-inputs"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const listeners = {};
  // A select shows its first option, as a browser would.
  const firstOption = (name) => html.match(new RegExp(`<select\\b[^>]*\\bname="${name}"[^>]*>\\s*<option\\b[^>]*\\bvalue="([^"]*)"`))?.[1].replaceAll('&quot;', '"');
  const fields = Object.fromEntries([...html.matchAll(/<(?:input|select)\b([^>]+)>/g)].map(([, attrs]) => {
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? '';
    const value = attrs.match(/\bvalue="([^"]+)"/)?.[1] ?? firstOption(name) ?? '';
    return [name, { name, id, value, checked: /\bchecked\b/.test(attrs) }];
  }));
  const outputs = {};
  const rows = ['tint-secondary', 'tint-tertiary'].map((kind) => ({ dataset: { gSurfaceKind: kind }, hidden: true }));
  const bar = { dataset: {} };
  const style = { textContent: '' };
  const status = { textContent: '', removeAttribute() {} };
  const attributes = { 'aria-expanded': 'false' };
  const toggle = { getAttribute: (name) => attributes[name], setAttribute(name, value) { attributes[name] = value; }, addEventListener(name, callback) { listeners[`toggle:${name}`] = callback; } };
  const form = { elements: { namedItem: (name) => fields[name] }, addEventListener(name, callback) { listeners[name] = callback; } };
  const elements = { '.g-controls': bar, '#g-design-controls': form, '#kn-live-core': style, '.g-status': status, '.g-toggle': toggle, '#g-initial-inputs': { textContent: JSON.stringify(inputs) } };
  const document = { documentElement: { dataset: {} }, querySelector: (selector) => elements[selector], querySelectorAll: () => rows, getElementById: (id) => ['g-frame-lab', 'g-lab-controls'].includes(id) ? null : outputs[id] ??= { value: '' } };
  return { document, fields, style, bar, status, listeners, rows, outputs, attributes };
}

test('built gallery embeds every resource and the actual bundle runs without crypto or network access', () => {
  const decoded = html.replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  for (const [tag] of decoded.matchAll(/<(?:img|script|link|iframe|video|audio|source)\b[^>]*>/gi)) {
    for (const [, , value] of tag.matchAll(/\b(src|href|poster)="([^"]+)"/gi)) assert.ok(value.startsWith('data:'), tag.slice(0, 160));
    assert.doesNotMatch(tag, /\bsrcset=/i);
  }
  const cssSources = [...decoded.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(([, css]) => css).concat([...html.matchAll(/\bstyle="([^"]*)"/gi)].map(([, css]) => css.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&'))).join('\n');
  for (const [, , url] of cssSources.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) assert.ok(url.startsWith('data:'), url);
  assert.doesNotMatch(html, /@import\b|<link[^>]*rel="(?:stylesheet|modulepreload|preconnect|dns-prefetch)"/i);
  const bundles = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(([, attrs]) => attrs.includes('type="module"')).map(([, , js]) => js);
  assert.equal(bundles.length, 9, 'gallery controls, frame entries, and the five interaction entries');
  const ui = controls();
  const noNetwork = () => { throw new Error('Unexpected network request'); };
  for (const bundle of bundles) {
    assert.doesNotMatch(bundle, /\b(?:fetch|import|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
    new Script(bundle).runInNewContext({ document: ui.document, structuredClone, fetch: noNetwork, XMLHttpRequest: noNetwork, WebSocket: noNetwork, EventSource: noNetwork }, { timeout: 2000 });
  }
  assert.equal(ui.bar.dataset.status, 'passed');
  assert.match(ui.style.textContent, /--kn-space-plate:/);
  ui.fields['secondary-enabled'].checked = true;
  ui.listeners.change({ target: ui.fields['secondary-enabled'] });
  assert.equal(ui.rows[0].hidden, false);
  assert.match(ui.style.textContent, /data-kn-surface="tint-secondary"/);
  ui.fields.mode.value = 'dark';
  ui.listeners.change({ target: ui.fields.mode });
  assert.equal(ui.document.documentElement.dataset.knMode, 'dark');
});

test('the real Page and Bands frame all examples, including the seven new component families', () => {
  assert.doesNotMatch(html, /class="g-(?:band|inner)\b/);
  assert.equal([...html.matchAll(/<main\b/g)].length, 1);
  assert.match(html, /class="kn-page"[^>]*data-kn-surface="page"/);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
  assert.doesNotMatch(main, /<section\b(?![^>]*class="[^"]*kn-band)/);
  const heroes = main.match(/<section\b[^>]*class="kn-band kn-hero"[^>]*>/g);
  assert.equal(heroes.length, 4);
  for (const variant of ['picture', 'plate', 'typographic']) assert.ok(heroes.some((tag) => tag.includes(`data-kn-variant="${variant}"`)));
  assert.match(main, /class="kn-band kn-hero"[^>]*data-kn-surface="picture-dark"[^>]*--kn-picture-image:/);
  for (const side of ['start', 'end']) assert.match(main, new RegExp(`class="kn-text-image" data-kn-image-side="${side}"`));
  for (const surface of ['brand', 'tint']) assert.match(main, new RegExp(`class="kn-band kn-cta-band"[^>]*data-kn-surface="${surface}"`));
  for (const width of ['narrow', 'wide', 'full', 'bleed-start', 'bleed-end']) assert.match(main, new RegExp(`class="kn-figure" data-kn-width="${width}"`));
  assert.equal([...main.matchAll(/class="kn-key-figures"/g)].length, 2);
  const definitions = [...main.matchAll(/<dl\b[^>]*class="kn-key-figures"[^>]*>([\s\S]*?)<\/dl>/g)];
  for (const [, content] of definitions) assert.match(content, /<dt\b[^>]*>[\s\S]*?<\/dt>\s*<dd\b[^>]*class="kn-key-figures-value"/);
  assert.doesNotMatch(main, /style="[^"]*\bundefined\b/);
  assert.match(main.slice(main.indexOf('id="band-run"')), /First[\s\S]*?<\/section>\s*<section class="kn-band" data-kn-surface="tint"[^>]*>/);
});

test('Reading Areas keep their inline notes and Aside Blocks in the requested reading order', () => {
  const areas = [...html.matchAll(/<div\b[^>]*class="kn-reading-area"([^>]*)>([\s\S]*?)(?=<\/section>)/g)];
  assert.equal(areas.length, 8);
  for (const [, attrs] of areas) assert.match(attrs, /data-kn-columns="1"/);
  const [, endAttrs, end] = areas[0];
  assert.match(endAttrs, /data-kn-side="end" data-kn-stack="before"/);
  assert.ok(end.indexOf('kn-reading-area-aside') < end.indexOf('kn-reading-area-flow'));
  assert.equal([...end.matchAll(/class="kn-sidenote"/g)].length, 4);
  assert.match(end, /<\/p>\s*<aside class="kn-sidenote"/);
  assert.match(end, /class="kn-sidenote"[\s\S]*?<img[^>]*src="data:/);
  const [, startAttrs, start] = areas[1];
  assert.match(startAttrs, /data-kn-side="start" data-kn-stack="after"/);
  assert.ok(start.indexOf('kn-reading-area-flow') < start.indexOf('kn-reading-area-aside'));
  assert.match(areas[2][1], /data-kn-side="none"/);
  assert.match(areas[3][2], /data-kn-sticky="true"/);
  assert.doesNotMatch(areas[3][2], /kn-sidenote|data-kn-width/);
  for (const [, , area] of areas) assert.match(area, /class="kn-body-text"/);
});

test('live controls defer layout changes, keep immediate feedback, and retain the last valid design on failure', () => {
  const ui = controls();
  const previousDocument = globalThis.document;
  globalThis.document = ui.document;
  try {
    setupControls({ derive, coreCss });
    const initial = ui.style.textContent;
    ui.fields.density.value = '10';
    ui.listeners.input({ target: ui.fields.density });
    assert.equal(ui.style.textContent, initial);
    assert.equal(ui.outputs['g-density-value'].value, '10');
    ui.listeners.change({ target: ui.fields.density });
    assert.notEqual(ui.style.textContent, initial);
    const dense = ui.style.textContent;
    ui.fields.frame.value = '2';
    ui.listeners.input({ target: ui.fields.frame });
    assert.equal(ui.style.textContent, dense);
    ui.listeners.change({ target: ui.fields.frame });
    assert.match(ui.style.textContent, /--kn-frame-width: 2px;/);
    ui.fields.corner.value = '100';
    ui.listeners.input({ target: ui.fields.corner });
    assert.match(ui.style.textContent, /--kn-radius-card: 1.5rem;/);
    ui.fields.strength.value = '50';
    ui.fields.hardness.value = '100';
    ui.listeners.input({ target: ui.fields.hardness });
    assert.match(ui.style.textContent, /--kn-shadow-box: [^;]+rgb\(/);
    const valid = ui.style.textContent;
    ui.fields.primary.value = 'invalid';
    ui.listeners.input({ target: ui.fields.primary });
    assert.equal(ui.style.textContent, valid);
    assert.equal(ui.bar.dataset.status, 'failed');
    assert.match(ui.status.textContent, /Generation failed:/);
    ui.fields.primary.value = '#1d4ed8';
    ui.listeners.input({ target: ui.fields.primary });
    assert.equal(ui.bar.dataset.status, 'passed');
    ui.listeners['toggle:click']();
    assert.equal(ui.attributes['aria-expanded'], 'true');
    assert.equal(ui.bar.dataset.expanded, 'true');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('every design control is described by a tooltip', () => {
  const form = html.match(/<form class="g-form"[\s\S]*?<\/form>/)[0];
  const controls = [...form.matchAll(/<(?:input|select)\b[^>]*>/g)].map(([tag]) => tag);
  assert.equal(controls.length, 13);
  for (const tag of controls) {
    const id = tag.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(id, tag);
    assert.match(form, new RegExp(`id="${id}" role="tooltip"[^>]*>[^<]{20,}<`));
  }
});

test('rendered cards have one stretched heading link or separate person contacts, and semantic headings', () => {
  let linked = 0, people = 0;
  for (const [, attrs, content] of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)) {
    if (attrs.includes('kn-content-')) continue;
    const anchors = [...content.matchAll(/<a\b([^>]*)>/g)];
    assert.match(content, /<h3\b[^>]*data-kn-type="heading-5"/);
    if (attrs.includes('data-kn-variant="person"')) {
      people++;
      assert.equal(anchors.length, 2);
      assert.doesNotMatch(content, /kn-card-link/);
      assert.match(content, /href="mailto:/);
      assert.match(content, /href="tel:/);
    } else {
      linked++;
      assert.equal(anchors.length, 1);
      assert.match(anchors[0][1], /class="kn-card-link"/);
    }
  }
  assert.ok(linked > 20 && people === 6);
  assert.match(html, /<hgroup/);
  assert.match(html, /<h1[^>]*data-kn-type="display"/);
  assert.match(html, /data-kn-columns="2"/);
  assert.match(html, /data-kn-columns="3"/);
  assert.match(html, /data-kn-columns="4"/);
});

function labDocument() {
  return JSON.parse(html.match(/<script\b[^>]*id="g-lab-document"[^>]*>([\s\S]*?)<\/script>/)[1]);
}
function textOf(node) { return node?.value ?? node?.children?.map(textOf).join('') ?? ''; }

test('the sandbox receives one complete self-contained document, with one controller and pre-rendered arrangements', () => {
  const sample = labDocument();
  const tree = parse(sample);
  const parent = parse(html);
  assert.equal(all(parent, 'iframe').length, 1);
  const frame = one(parent, '#g-frame-lab');
  assert.equal(frame.attributes.sandbox, 'allow-scripts allow-forms');
  assert.ok(!frame.attributes.sandbox.includes('allow-same-origin'));
  assert.equal(all(tree, 'main').length, 1);
  assert.equal(all(tree, 'footer').length, 1);
  assert.equal(all(tree, 'template[data-lab-header]').length, 3);
  assert.equal(all(tree, 'script[type="module"]').length, 1, 'only the frame controller boots enhancements');
  assert.equal(all(tree, 'template script').length, 0, 'cloning never boots a duplicate runtime');
  for (const node of all(tree, 'script, img, link, iframe, source, video')) {
    for (const attribute of ['src', 'href', 'poster']) if (node.attributes[attribute]) assert.ok(node.attributes[attribute].startsWith('data:'));
  }
  for (const node of all(tree, 'script[type="module"]')) {
    const js = textOf(node);
    new Script(js);
    assert.doesNotMatch(js, /\b(?:fetch|import|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  }
  assert.match(sample, /kn-reading-area/);
  assert.match(sample, /kn-page-main/);
  assert.match(sample, /kn-band kn-hero/);
  assert.ok(all(tree, '.kn-body-text p').length >= 15);
  assert.doesNotMatch(sample, /contentDocument|contentWindow\.document|parent\.document/);
  const controls = one(parent, '#g-lab-controls');
  const fields = all(controls, 'input, select');
  assert.equal(fields.length, 16);
  for (const field of fields) {
    const tip = one(parent, `#${field.attributes['aria-describedby']}`);
    assert.equal(tip.attributes.role, 'tooltip');
    assert.ok(textOf(tip).length > 20);
  }
  assert.equal(one(controls, '[name="lab-width"]').attributes.min, '320');
});

test('rendered header groups, skip link, identity, panel controls, current links and language semantics match the specification', () => {
  const tree = parse(html);
  const expected = {
    A: [['identity'], ['search', 'language', 'links', 'menu', 'cta']],
    B: [['identity', 'links'], ['search', 'language', 'menu', 'cta']],
    C: [['identity', 'links', 'search'], ['language', 'menu', 'cta']],
  };
  for (const arrangement of ['A', 'B', 'C']) {
    const header = one(tree, `#gallery-header-${arrangement}`);
    assert.equal(header.attributes['data-kn-attachment'], 'flow');
    assert.equal(header.children.find((node) => node.type === 1).attributes.class, 'kn-skip-link');
    const groups = all(header, '.kn-header-group');
    assert.deepEqual(groups.map((group) => group.children.filter((node) => node.type === 1).map((node) => {
      const cls = node.attributes.class;
      return cls.includes('identity') ? 'identity' : cls.includes('search-trigger') ? 'search' : cls.includes('language') ? 'language' : cls.includes('link-menu') ? 'links' : cls.includes('menu-button') ? 'menu' : 'cta';
    })), expected[arrangement]);
    const identity = one(header, '.kn-header-identity');
    assert.equal(identity.name, 'a');
    assert.equal(identity.attributes.href, '#home');
    assert.equal(identity.attributes['aria-label'], 'Juniper Atlas');
    assert.equal(all(identity, 'a').filter((node) => node !== identity).length, 0);
    for (const trigger of all(header, '[data-kn-trigger]')) {
      assert.equal(trigger.attributes['aria-expanded'], 'false');
      assert.ok(one(tree, `#${trigger.attributes['aria-controls']}`));
      assert.ok(trigger.attributes['aria-label']);
    }
    const search = one(header, '.kn-header-search-trigger');
    assert.equal(search.name, 'a');
    assert.match(search.attributes.href, /q=/);
    const nativeMenu = one(header, '[data-kn-trigger="menu"]');
    assert.equal(nativeMenu.attributes.popovertarget, nativeMenu.attributes['aria-controls']);
    assert.equal(one(header, '.kn-header-link-menu [aria-current="page"]').attributes.href, '#home');
    const links = all(header, '.kn-header-language-list a');
    assert.deepEqual(links.map((node) => node.attributes.lang), ['en', 'sv', 'de']);
    assert.ok(links.every((node) => node.attributes.hreflang === node.attributes.lang));
    assert.equal(links[0].attributes['aria-current'], 'true');
    assert.deepEqual(all(header, '.kn-header-moved > *').map((node) => node.attributes['data-kn-moved']), ['search', 'language', 'cta']);
    assert.ok(all(header, 'form[role="search"]').every((form) => one(form, 'input[name="q"]')));
  }
});

test('rendered footer cells follow stacking order in the DOM and use named wide-grid rows', () => {
  const tree = parse(html);
  const footers = all(tree, '.kn-footer');
  assert.equal(footers.length, footerVariants.length);
  footerVariants.forEach((variant, index) => {
    const layout = layoutFooter(variant.bands);
    const cells = all(footers[index], '.kn-footer-cell');
    assert.deepEqual(cells.map((cell) => cell.attributes['data-kn-cell']), layout.cells.map((cell) => `${cell.column}${cell.row}`));
    for (const [i, cell] of cells.entries()) {
      assert.equal(cell.attributes['data-kn-surface'], layout.cells[i].surface);
      assert.match(cell.attributes.style, /grid-row:r\d-start \/ r\d-end/);
      assert.ok(!cell.attributes.style.includes('order'));
    }
    assert.equal(all(footers[index], '.kn-footer-background').length, layout.bands.length);
    assert.equal(all(footers[index], '.kn-footer-rule').length, layout.bands.filter((band) => band.horizontal).length);
    assert.equal(all(footers[index], '.kn-footer-vertical-rule').length, layout.bands.filter((band) => band.vertical).length);
  });
});

test('lab controls send core CSS and settings through messages and resizing changes only the frame', () => {
  const previous = { document: globalThis.document, window: globalThis.window };
  const listeners = {}, formListeners = {}, sent = [];
  const slider = { name: 'lab-width', type: 'range', value: '1440', max: '1440' };
  const elements = [{ name: 'arrangement', value: 'C' }, { name: 'autohide', type: 'checkbox', checked: true }, slider];
  elements.namedItem = (name) => elements.find((field) => field.name === name);
  const form = { elements, addEventListener: (name, callback) => { formListeners[name] = callback; } };
  const frame = { style: {}, parentElement: { clientWidth: 1200 }, contentWindow: { postMessage: (...args) => sent.push(args) }, getBoundingClientRect: () => ({ width: parseFloat(frame.style.inlineSize) }) };
  const output = {};
  const nodes = { 'g-frame-lab': frame, 'g-lab-controls': form, 'g-lab-document': { textContent: JSON.stringify(labDocument()) }, 'kn-live-core': { textContent: 'core one' }, 'g-lab-width-value': output };
  try {
    globalThis.document = { getElementById: (id) => nodes[id], documentElement: { dataset: { knMode: 'light' } } };
    globalThis.window = { addEventListener: (name, callback) => { listeners[name] = callback; } };
    const update = setupGalleryLab();
    assert.ok(frame.srcdoc.startsWith('<!DOCTYPE html>') || frame.srcdoc.startsWith('<!doctype html>'));
    assert.equal(slider.max, '1200');
    listeners.message({ source: {}, data: { type: 'kn-frame-ready' } });
    assert.equal(sent.length, 0, 'unrelated windows cannot drive the lab');
    listeners.message({ source: frame.contentWindow, data: { type: 'kn-frame-ready' } });
    assert.deepEqual(sent[0], [{ type: 'kn-frame-config', css: 'core one', mode: 'light', config: { arrangement: 'C', autohide: true } }, '*']);
    update({ css: 'core two', mode: 'dark' });
    assert.equal(sent.at(-1)[0].css, 'core two');
    assert.equal(sent.at(-1)[0].mode, 'dark');
    slider.value = '320';
    formListeners.input({ target: slider });
    assert.equal(frame.style.inlineSize, '320px');
    assert.equal(output.value, '320 px');
    assert.equal(sent.length, 2, 'a width drag leaves the surrounding document and settings alone');
    formListeners.input({ target: elements[0] });
    assert.equal(sent.length, 3);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

test('the six content families render complete examples and the lab includes tables, callouts and breadcrumbs', () => {
  const tree = parse(html);
  for (const id of ['tables', 'accordions', 'quotations', 'callouts-page', 'callouts-brand', 'breadcrumbs', 'table-of-contents']) assert.ok(one(tree, `#${id}`));
  for (const id of ['table-plain', 'table-totals', 'table-striped', 'table-plated', 'table-handwritten', 'table-wide']) {
    const wrapper = one(tree, `#${id}`);
    assert.equal(wrapper.attributes.role, 'region');
    assert.equal(wrapper.attributes.tabindex, '0');
    assert.ok(one(wrapper, 'table caption'));
  }
  assert.equal(one(tree, '#table-wide').attributes['data-kn-width'], 'wide');
  const totals = one(tree, '#table-totals');
  assert.equal(one(totals, 'tfoot th').attributes.colspan, '2');
  assert.ok(one(totals, 'tbody th[rowspan="2"]'));
  for (const surface of ['tint', 'brand']) assert.ok(all(tree, `.kn-band[data-kn-surface="${surface}"]`).some((band) => one(band, '.kn-table-scroll[data-kn-striped]')));
  assert.equal(all(tree, '.kn-quotation').length, 2);
  for (const ground of ['page', 'brand']) {
    const callouts = all(one(tree, `#callouts-${ground}`), '.kn-callout');
    assert.equal(callouts.length, 8);
    for (const variant of ['info', 'success', 'warning', 'error']) {
      const matching = callouts.filter((node) => node.attributes['data-kn-variant'] === variant);
      assert.equal(matching.length, 2);
      assert.equal(matching.filter((node) => 'data-kn-surface' in node.attributes).length, 1);
      assert.ok(matching.every((node) => !('role' in node.attributes)));
    }
  }
  const names = all(one(tree, '#accordion-single'), 'details').map((node) => node.attributes.name);
  assert.ok(names[0] && names.every((name) => name === names[0]));
  assert.ok(all(one(tree, '#accordion-multiple'), 'details').every((node) => !('name' in node.attributes)));
  const faq = JSON.parse(textOf(one(tree, 'script[type="application/ld+json"]')));
  assert.equal(faq['@type'], 'FAQPage');
  assert.equal(faq.mainEntity.length, all(one(tree, '#accordion-faq'), 'details').length);
  assert.ok(all(one(tree, '#breadcrumbs-long'), 'li').length > all(one(tree, '#breadcrumbs-short'), 'li').length);
  const sample = parse(labDocument());
  for (const cls of ['kn-table-scroll', 'kn-callout', 'kn-breadcrumbs']) assert.ok(one(sample, `.${cls}`));
});

test('contents examples point to real semantic headings and the sticky Aside has no conflicting rows', () => {
  const tree = parse(html);
  const area = one(tree, '#contents-reading-area');
  const block = one(one(area, '.kn-reading-area-aside'), '.kn-aside-block');
  assert.equal(block.attributes['data-kn-sticky'], 'true');
  assert.ok(one(block, '#toc-aside'));
  assert.ok(one(area, '.kn-reading-area-flow #toc-flow'));
  assert.equal(all(area, '.kn-sidenote, [data-kn-width]').length, 0);
  assert.equal(all(one(area, '#toc-aside'), 'a').length, 3);
  assert.equal(all(one(area, '#toc-flow'), 'a').length, 5);
  for (const link of all(area, '.kn-toc a')) {
    const target = one(area, link.attributes.href);
    assert.ok(['h2', 'h3'].includes(target?.name));
  }
});

test('the build is repeatable: no random identifiers in the page', () => {
  assert.doesNotMatch(html, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
});

test('table cells retain padding without logical-column attributes, including merged cells', async () => {
  const tree = parse(html);
  const table = one(tree, '#table-totals');
  assert.ok(one(table, 'th[rowspan="2"]'));
  assert.equal(all(table, '[data-kn-column], [data-kn-column-end]').length, 0);
  const css = await readFile(new URL('../src/components/table.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /padding-inline-(?:start|end): 0/);
  assert.match(css, /padding-inline: 0.9em/);
});

test('the final six families have working compositions, all eleven local embed previews and deferred lab consent', () => {
  const tree = parse(html);
  for (const id of ['content-loop', 'visitor-filters', 'search-results', 'video-player', 'embeds', 'forms', 'forms-brand', 'consent-banner']) assert.ok(one(tree, `#${id}`));
  assert.equal(all(one(tree, '#filtered-rows'), '[data-kn-item]').length, 15);
  assert.equal(one(tree, '[data-kn-for="filtered-rows"]').attributes['data-kn-page-size'], '4');
  assert.equal(all(one(tree, '#filtered-cards'), '.kn-card').length, 6);
  assert.ok(one(tree, '#search-rows mark'));
  assert.equal(one(tree, '#loop-documents .kn-content-link').attributes.href.startsWith('data:'), true);
  assert.ok(one(tree, '#loop-videos a[data-kn-embed-overlay]'));
  assert.ok(one(tree, '#loop-video-cards a[data-kn-embed-overlay]'));
  const embeds = all(one(tree, '#embeds'), '.kn-embed'); assert.equal(embeds.length, 11);
  for (const embed of embeds) {
    assert.ok(one(embed, '.kn-embed-original[href]'));
    assert.ok(one(embed, '[data-kn-embed-load]'));
    assert.ok('hidden' in one(embed, '.kn-embed-stage').attributes);
    assert.ok(embed.attributes['data-kn-gallery-note']); assert.equal(all(embed, 'iframe').length, 0);
  }
  assert.equal(all(one(tree, '#video-player'), 'source').length, 0);
  assert.match(textOf(one(tree, '#video-player figcaption')), /Poster only/);
  for (const id of ['forms', 'forms-brand']) {
    const band = one(tree, `#${id}`);
    for (const type of ['text', 'email', 'tel', 'url', 'number', 'date', 'password', 'checkbox', 'radio']) assert.ok(one(band, `input[type="${type}"]`));
    assert.ok(one(band, 'textarea')); assert.ok(one(band, 'select')); assert.ok(one(band, '.kn-field-help')); assert.ok(one(band, '.kn-field-error svg'));
    for (const control of all(band, 'input, select, textarea, button')) assert.ok(control.attributes['aria-describedby']?.split(' ').some((id) => one(tree, `#${id}`)?.attributes.role === 'tooltip'));
  }
  assert.ok(all(tree, '.kn-consent').every((banner) => 'hidden' in banner.attributes && banner.attributes['data-kn-deferred'] === 'true'), 'the gallery window never starts with a banner');
  const lab = parse(labDocument()); const banner = one(lab, '.kn-consent');
  assert.ok('hidden' in banner.attributes); assert.equal(banner.attributes['data-kn-deferred'], 'false');
  assert.ok(one(lab, 'footer [data-kn-consent-open]')); assert.ok(one(lab, 'dialog.kn-consent-settings'));
});

test('two consecutive gallery builds produce identical self-contained output', async () => {
  execFileSync('npm', ['run', 'gallery'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(await readFile(new URL('../gallery/dist/index.html', import.meta.url), 'utf8'), html);
});

test('all gallery controls have tooltips, Accordion and Callout comparisons cover the requested Surfaces, and the configurator covers every choice', () => {
  const tree = parse(html);
  for (const control of all(tree, 'input, select, textarea, button, summary, a').filter((node) => node.name !== 'a' || 'data-kn-trigger' in node.attributes)) {
    const tips = (control.attributes['aria-describedby'] ?? '').split(' ').map((id) => one(tree, `#${id}`));
    assert.ok(tips.some((tip) => tip?.attributes.role === 'tooltip'), `${control.name}: ${control.attributes.name ?? control.attributes.class}`);
  }
  const config = one(tree, '#g-content-controls');
  assert.deepEqual(all(config, 'input, select').map((node) => node.attributes.name).sort(), ['presentation', 'images', 'ratio', 'inset', 'metadata', 'author', 'date', 'category', 'separator', 'pill', 'text', 'cta', 'cta-icon', 'plated', 'surface', 'columns'].sort());
  assert.equal(all(tree, '[data-g-configurable]').length, 4);
  for (const surface of ['page', 'tint', 'brand', 'inverse']) for (const variant of ['hairlines', 'boxes']) {
    assert.ok(all(tree, `.kn-band[data-kn-surface="${surface}"]`).some((band) => one(band, `.kn-accordion[data-kn-variant="${variant}"]`)));
  }
  for (const ground of ['page', 'brand']) for (const variant of ['info', 'success', 'warning', 'error']) for (const style of ['filled', 'outlined']) assert.ok(one(one(tree, `#callouts-${ground}`), `.kn-callout[data-kn-variant="${variant}"][data-kn-style="${style}"]`));
  assert.equal(one(tree, '[data-kn-consent-reopen="gallery-consent"]'), undefined);
  assert.ok(one(parse(labDocument()), '[data-kn-consent-reopen="lab-consent"]'));
});
