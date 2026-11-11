import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { render, textOf } from './helpers/render.js';
import { resolve, validateDesignFile, checkContrast, STATUS_KINDS, STATUS_SEEDS, kindsFor, defaultInputs, contrast } from '../src/generator/index.js';
import { emitCss } from '../src/css/index.js';
import { parseStored, mergeChoice } from '../src/components/consent.js';
import { consentCategories, consentTexts } from '../gallery/src/interaction-samples.ts';
const css = (name) => readFile(new URL(`../src/components/${name}.css`, import.meta.url), 'utf8');

test('hover and information roles, status kinds and all their pairs pass varied seeds, temperatures and ranks', async () => {
  assert.equal(STATUS_SEEDS.info, '#1d6fd1');
  assert.deepEqual(STATUS_KINDS, ['status-info', 'status-success', 'status-warning', 'status-error']);
  for (const primary of ['#0f766e', '#facc15', '#1d4ed8', '#dc2626', '#111111', '#fff066', '#ffffff', '#ff00ff', '#00ff00', '#808080']) for (const temperature of [-100, 0, 100]) {
    const inputs = { 'brand-colors': { primary, ...(temperature ? { secondary: '#c76532', tertiary: '#8646b0' } : {}) }, 'gray-temperature': temperature };
    const resolved = await resolve(inputs);
    validateDesignFile({ format: 1, inputs, project: {}, resolved }); checkContrast(resolved);
    assert.deepEqual(Object.keys(resolved.surfaces), kindsFor(inputs['brand-colors']));
    for (const [kind, modes] of Object.entries(resolved.surfaces)) for (const [mode, surface] of Object.entries(modes)) {
      for (const role of ['text-hover', 'link-hover', 'info']) {
        const pair = resolved['contrast-check'].matrix[kind][mode].pairs[role];
        assert.equal(pair.target, 4.5); assert.ok(pair.passed, `${primary}/${temperature}/${kind}/${mode}/${role}`);
        assert.equal(pair.foreground, surface.roles[role === 'info' ? 'info' : role.slice(0, -6)]);
        if (role !== 'info') { assert.equal(pair.ratio, contrast(pair.foreground, surface.roles['background-hover'])); assert.deepEqual(pair.samples, {}); }
      }
      if (kind.startsWith('status-')) {
        const family = kind.slice(7), dark = mode === 'dark';
        assert.equal(surface.polarity, mode);
        assert.equal(surface.recipes.background, `${family}-${dark ? 900 : 100}`);
        assert.equal(surface.recipes.accent, `${family}-${dark ? 300 : 600}`);
      }
    }
  }
});

test('exports refuse missing hover/info roles and stale hover reports', async () => {
  for (const tamper of [
    (r) => { delete r.surfaces.page.light.roles['background-hover']; },
    (r) => { delete r.surfaces.page.light.roles.info; },
    (r) => { r.surfaces.brand.dark.roles['background-hover'] = r.surfaces.brand.dark.roles.link; },
    (r) => { r['contrast-check'].matrix.page.light.pairs['link-hover'].ratio += 0.1; },
    (r) => { delete r['contrast-check'].matrix['status-info'].dark.pairs['text-hover']; },
  ]) { const inputs = defaultInputs(); const resolved = await resolve(inputs); tamper(resolved); await assert.rejects(emitCss({ format: 1, inputs, resolved, project: {} })); }
});

test('every plain and striped table has whole-row feedback and keeps both edge paddings', async () => {
  const source = await css('table');
  assert.match(source, /\.kn-body-text table\) > tbody > tr:hover \{ background: var\(--kn-background-alt\)/);
  assert.match(source, /data-kn-striped[^\n]+tr:hover \{ background: var\(--kn-background-hover\)/);
  assert.match(source, /transition: background-color var\(--kn-duration-feedback\)/);
  assert.match(source, /padding-inline: 0.9em/); assert.doesNotMatch(source, /data-kn-column|padding-inline-(?:start|end): 0/);
});

test('Accordion variants keep FAQ invisible and open at once in every engine, including named single groups', async () => {
  for (const variant of ['hairlines', 'boxes']) for (const mode of ['single', 'multiple']) {
    const tree = parse(await render('Accordion', { variant, mode, items: [{ question: 'Before the walk', answer: 'Bring a pencil.' }, { question: 'After the walk', answer: 'Compare your notes.' }] }));
    assert.equal(one(tree, '.kn-accordion').attributes['data-kn-variant'], variant);
    const details = all(tree, 'details'); assert.equal(details.length, 2);
    assert.equal(details[0].attributes.name, details[1].attributes.name);
    assert.equal(!!details[0].attributes.name, mode === 'single');
    assert.equal(all(tree, 'script').length, 0);
  }
  const source = await css('accordion');
  // Only Chromium could animate the opening (interpolate-size), so nothing does (the owner, 2026-11-11).
  assert.doesNotMatch(source, /interpolate-size:|allow-discrete|@supports/);
  assert.match(source, /padding-inline: 0.75em/); assert.doesNotMatch(source, /text-decoration: underline/);
  assert.match(source, /data-kn-variant="boxes"[^\n]+border: 1px solid var\(--kn-border-strong\)/);
});

test('Callout filled style owns its status Surface while outlined inherits its surroundings', async () => {
  for (const variant of ['info', 'success', 'warning', 'error']) for (const style of ['filled', 'outlined']) {
    const tree = parse(await render('Callout', { variant, style, title: 'A clear next step' }, { default: '<p>Open the notebook.</p>' }));
    const callout = one(tree, '.kn-callout');
    assert.equal(callout.attributes['data-kn-style'], style);
    assert.equal(callout.attributes['data-kn-surface'], style === 'filled' ? `status-${variant}` : undefined);
    assert.ok(one(tree, 'svg[aria-label]')); assert.ok(one(tree, '.kn-callout-title'));
  }
  const source = await css('callout'); assert.match(source, /border-inline-start: 0.3rem/); assert.match(source, /border-radius: var\(--kn-radius-control\)/);
  for (const status of ['info', 'success', 'warning', 'error']) assert.ok(source.includes(`var(--kn-${status})`));
});

const item = { title: 'An orchard notebook', href: '/orchard/', picture: { src: '/orchard.svg', alt: 'Orchard' }, meta1: [{ text: 'Rowan Vale', href: '/rowan/' }, { text: '2 November 2026', datetime: '2026-11-02' }], meta2: [{ text: 'Field notes', href: '/notes/', pill: true }], text: 'Look closely at the familiar.', cta: { label: 'Read more', style: 'link', icon: '→' } };
test('Content Card and Row share ordered optional parts and keep metadata links and both content tab stops independent', async () => {
  for (const component of ['ContentCard', 'ContentRow']) for (const style of ['link', 'button']) {
    const tree = parse(await render(component, { ...item, cta: { ...item.cta, style }, imageRatio: component === 'ContentCard' ? '2:1' : '1:1', imageInset: true, surface: 'raised' }));
    const picture = one(tree, '.kn-content-picture'); assert.equal(picture.attributes['aria-hidden'], 'true'); assert.equal(picture.attributes.tabindex, '-1'); assert.equal(one(picture, 'img').attributes.alt, '');
    const body = one(tree, '.kn-content-body');
    assert.deepEqual(body.children.filter((node) => node.type === 1).map((node) => node.attributes.class), ['kn-content-meta', 'kn-content-heading', 'kn-content-meta', 'kn-content-text', 'kn-content-cta']);
    assert.equal(one(body, '.kn-content-heading').name, 'h3'); assert.equal(one(body, '.kn-content-heading').attributes['data-kn-type'], 'heading-5');
    assert.equal(one(body, 'time').attributes.datetime, '2026-11-02');
    assert.equal(one(body, '.kn-pill a').attributes.href, '/notes/');
    const cta = one(body, '.kn-content-cta a'); assert.equal(cta.attributes.href, item.href); assert.equal(cta.attributes['aria-label'], `Read more: ${item.title}`);
    assert.equal(one(cta, '.kn-content-cta-icon').attributes['aria-hidden'], 'true'); assert.equal(cta.attributes['data-kn-variant'], style === 'button' ? 'outline' : undefined);
    const minimal = parse(await render(component, { title: 'The quiet clearing', href: '/clearing/', images: false, level: 4, type: 'heading-6' }));
    assert.equal(all(minimal, '.kn-content-picture, .kn-content-meta, .kn-content-text, .kn-content-cta').length, 0);
    assert.ok(one(minimal, 'h4[data-kn-type="heading-6"] a'));
  }
  const card = await css('card'), source = await css('content-loop');
  assert.doesNotMatch(source, /\.kn-content-link::after|position: absolute/);
  assert.match(source, /--kn-shadow-box-lifted/); assert.match(source, /data-kn-image-inset="false"/);
  assert.match(source, /kn-content-cta-icon:dir\(rtl\)/);
  assert.doesNotMatch(await readFile(new URL('../src/components/Card.astro', import.meta.url), 'utf8'), /variant.*article/);
  assert.match(card, /\.kn-card-link::after/);
});

test('metadata separators are decorative CSS content and never sit beside a pill', async () => {
  for (const separator of ['comma', 'bar', 'dot', 'none']) {
    const tree = parse(await render('ContentCard', { ...item, metaSeparator: separator }));
    assert.ok(all(tree, '.kn-content-meta').every((node) => node.attributes['data-kn-separator'] === separator));
  }
  const source = await css('content-loop');
  for (const mark of [',', '|', '·']) assert.ok(source.includes(`content: "${mark}" / ""`));
  assert.match(source, /:not\(\[data-kn-pill\]\):has\(\+ \.kn-content-meta-item:not\(\[data-kn-pill\]\)\)::after/);
  assert.doesNotMatch(source, /data-kn-separator="none"[^\n]+content:/);
});

test('row loops reserve missing picture columns, omit all pictures together and render year labels', async () => {
  const items = [{ ...item, group: '2026' }, { title: 'A pencil study', href: '/pencil/', group: '2025' }];
  const tree = parse(await render('ContentLoop', { presentation: 'rows', items }));
  assert.equal(all(tree, '.kn-content-picture').length, 2); assert.equal(all(tree, '[data-kn-placeholder]').length, 1);
  assert.deepEqual(all(tree, '[data-kn-content-group]').map(textOf), ['2026', '2025']);
  const none = parse(await render('ContentLoop', { presentation: 'rows', items, images: false })); assert.equal(all(none, '.kn-content-picture').length, 0);
});

test('search variant uses the shared inverse box, field, submit and suggestions without a close control', async () => {
  const tree = parse(await render('VisitorFilters', { for: 'results', variant: 'search', heading: 'Search the garden', search: { label: 'Find a note' }, suggestions: [{ label: 'Walks', href: '/walks/' }] }));
  const box = one(tree, '.kn-search-box'); assert.equal(box.attributes['data-kn-surface'], 'inverse'); assert.equal(textOf(one(box, 'h2')), 'Search the garden');
  assert.equal(one(box, 'input').attributes['aria-label'], 'Find a note'); assert.ok(one(box, 'button[type="submit"]'));
  assert.equal(one(box, '.kn-search-links a').attributes.href, '/walks/'); assert.equal(one(box, '[data-kn-close]'), undefined);
  const header = parse(await render('SearchPanel', { id: 'search-panel', search: { action: '/search/' } })); assert.ok(one(header, '.kn-search-box [data-kn-close]'));
  assert.match(await css('visitor-filters'), /:has\(\[data-kn-match\]\):not\(:has\(input\[type="search"\]\)\) \.kn-visitor-filter-submit \{ display: none/, 'pills that filter at once need no button');
  assert.match(await css('visitor-filters'), /kn-visitor-filter-panel \{ display: grid/, 'each filter has a row of its own');
  assert.match(await css('form'), /kn-field-select > \.kn-icon \{[^}]*inset-inline-end: 1em/, 'a select\'s arrow keeps its distance from the edge');
});

test('consent offers accept and reject together with identical classes, and no optional switch is preselected', async () => {
  const tree = parse(await render('ConsentBanner', { id: 'review-consent', categories: consentCategories, texts: consentTexts, policyHref: '/cookies/' }));
  for (const view of [one(tree, '.kn-consent'), one(tree, '.kn-consent-settings')]) {
    const accept = one(view, '[data-kn-consent-accept]'), reject = one(view, '[data-kn-consent-reject]');
    assert.equal(accept.attributes.class, reject.attributes.class); assert.equal(accept.attributes['data-kn-variant'], 'filled'); assert.equal(reject.attributes['data-kn-variant'], 'filled');
  }
  const checks = all(tree, 'input[role="switch"]'); assert.equal(checks.length, consentCategories.length);
  assert.ok('checked' in checks[0].attributes && 'disabled' in checks[0].attributes);
  for (const check of checks.slice(1)) assert.ok(!('checked' in check.attributes));
  assert.equal(all(tree, 'details.kn-consent-category').length, consentCategories.length);
  assert.ok(one(tree, 'table th')); assert.match(textOf(one(tree, '.kn-consent-settings')), /Storage time.*Data collected/);
  assert.equal(one(tree, '.kn-consent a').attributes.href, '/cookies/');
  assert.equal(one(tree, '.kn-consent-reopen').attributes['aria-label'], 'Cookie settings');
  assert.equal(one(parse(await render('ConsentBanner', { categories: consentCategories, texts: consentTexts, reopenButton: false })), '.kn-consent-reopen'), undefined);
});

test('consent timestamps expire at the configured boundary and reject future, untimed or changed-version choices', () => {
  const now = Date.UTC(2026, 10, 2), day = 86400000;
  const value = { version: '1', timestamp: now - day, choices: mergeChoice(consentCategories, { analytics: true }) };
  assert.deepEqual(parseStored(value, '1', consentCategories, 2, now), value);
  for (const changed of [{ timestamp: now - 2 * day }, { timestamp: undefined }, { timestamp: now + 1 }, { version: '2' }]) assert.equal(parseStored({ ...value, ...changed }, '1', consentCategories, 2, now), null);
  assert.deepEqual(mergeChoice(consentCategories, { necessary: false, 'external-media': false, analytics: false }), { necessary: true, 'external-media': false, analytics: false });
});

test('a hover fill shows: it differs visibly from the background and the alternate fill on every Surface', async () => {
  const { derive, contrast } = await import('../src/generator/index.js');
  for (const primary of ['#168b83', '#1d4ed8', '#0b2a6b', '#c026d3', '#dc2626', '#facc15', '#111111']) {
    const { surfaces } = derive({ 'brand-colors': { primary, secondary: '#b66c32' } });
    for (const [kind, modes] of Object.entries(surfaces)) for (const [mode, surface] of Object.entries(modes)) {
      const { background, 'background-alt': alternate, 'background-hover': hover } = surface.roles;
      if (kind.startsWith('picture-')) continue;
      assert.ok(contrast(background, hover) >= 1.12, `${primary} ${kind} ${mode}: hover ${hover} on ${background}`);
      assert.ok(contrast(alternate, hover) >= 1.12, `${primary} ${kind} ${mode}: hover ${hover} on alternate ${alternate}`);
    }
  }
});

