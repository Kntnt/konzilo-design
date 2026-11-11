import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { transform } from '@astrojs/compiler-rs';
import { experimental_AstroContainer } from 'astro/container';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { normaliseText, matchItem, filterItems, paginate, parseState, serialiseState, paginationStops, pageAddress } from '../src/components/visitor-filters.js';
import { recogniseEmbed, embedProviders } from '../src/components/embed-providers.js';
import { framePlan, embedState, localPreview, isPrimaryClick } from '../src/components/embed.js';
import { parseStored, mergeChoice } from '../src/components/consent.js';
import { describedBy } from '../src/components/ids.js';
import { excerptHtml } from '../src/components/content-loop.js';
import { consentCategories, consentTexts } from '../gallery/src/interaction-samples.ts';

const compiled = new Map();
async function render(name, props = {}, slots) {
  if (!compiled.has(name)) {
    const entry = new URL(`../src/components/${name}.astro`, import.meta.url);
    const bundle = await rolldown({ input: 'virtual:component', logLevel: 'silent', treeshake: { manualPureFunctions: ['$$createMetadata'] }, plugins: [{
      name: 'interaction-components',
      resolveId(id, importer) {
        if (id === 'virtual:component') return id;
        if (id.endsWith('.astro')) return fileURLToPath(id.startsWith('file:') ? id : new URL(id, pathToFileURL(importer)));
        return { id: id.startsWith('.') ? new URL(id, pathToFileURL(importer)).href : import.meta.resolve(id), external: true };
      },
      async load(id) {
        return id === 'virtual:component' ? `export { default } from ${JSON.stringify(entry.href)};` : id.endsWith('.astro') ? transform(await readFile(id, 'utf8'), { filename: id, internalURL: 'astro/compiler-runtime', resultScopedSlot: true }).code : null;
      },
    }] });
    let code;
    try { code = (await bundle.generate({ format: 'esm' })).output[0].code; } finally { await bundle.close(); }
    compiled.set(name, (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default);
  }
  const container = await experimental_AstroContainer.create();
  return container.renderToString(compiled.get(name), { props, slots });
}
const textOf = (node) => node?.value ?? node?.children?.map(textOf).join('') ?? '';

test('filter matching folds case and diacritics, ANDs words and groups, ORs values and leaves input order intact', () => {
  assert.equal(normaliseText('  CAFÉ Ångström  '), 'cafe angstrom');
  const items = [
    { text: 'Café by the RIVER', filters: { topic: ['notes', 'walks'], year: '2026' } },
    { text: 'River walk', filters: { topic: ['walks'], year: '2025' } },
    { text: 'Garden café', filters: { topic: ['notes'], year: '2026' } },
  ];
  const state = { q: 'RIVER cafe', filters: { topic: ['other', 'notes'], year: ['2026'] } };
  assert.equal(matchItem(items[0], state), true);
  assert.deepEqual(filterItems(items, state), [items[0]]);
  assert.equal(matchItem(items[1], { filters: { topic: ['notes'] } }), false);
  assert.equal(matchItem(items[0], { filters: { missing: ['yes'] } }), false);
  assert.equal(filterItems(items, { q: '', filters: { topic: [] } }).length, 3);
  assert.deepEqual(items.map(({ text }) => text), ['Café by the RIVER', 'River walk', 'Garden café']);
});

test('URL state uses repeated allowlisted values, canonical ordering, safe pages and independent-panel preservation', () => {
  const allowed = { topic: ['notes', 'walks'], year: ['2026'], 'card-topic': ['notes'] };
  const state = parseState('?q=%20café%20&topic=walks&topic=notes&topic=walks&topic=bad&year=2026&page=3&unknown=x', allowed);
  assert.deepEqual(state, { q: 'café', filters: { topic: ['notes', 'walks'], year: ['2026'] }, page: 3 });
  assert.equal(serialiseState(state), 'q=caf%C3%A9&topic=notes&topic=walks&year=2026&page=3');
  assert.deepEqual(parseState(serialiseState(state), allowed), state);
  assert.equal(serialiseState({ q: '', filters: { topic: ['walks'] }, page: 1 }, 'card-topic=notes&topic=notes&page=6', ['topic']), 'card-topic=notes&topic=walks');
  for (const page of ['0', '-2', '2.5', 'Infinity', '9007199254740992', 'two', '02']) assert.equal(parseState(`page=${page}`).page, 1);
  assert.deepEqual(parseState('?topic=&topic=bad&constructor=oops', allowed).filters, {});
  assert.equal(pageAddress('/notes/?year=2026#results', { q: 'river', filters: { topic: ['notes'] } }, 2), '/notes/?year=2026&q=river&topic=notes&page=2#results');
  assert.equal(pageAddress('/notes/#results', { filters: {} }, 1), '/notes/#results');
});

test('pagination clamps a shrinking client result, retains complete sequences and shortens long page windows', () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  assert.deepEqual(paginate(items, 3, 10), { items: [20, 21, 22], page: 3, pages: 3, total: 23 });
  assert.deepEqual([1, 2, 3].flatMap((page) => paginate(items, page, 10).items), items);
  assert.equal(paginate(items.slice(0, 2), 99, 10).page, 1);
  assert.deepEqual(paginate([], 1, 4), { items: [], page: 1, pages: 1, total: 0 });
  for (const size of [0, -1, 1.2, NaN]) assert.throws(() => paginate(items, 1, size), RangeError);
  assert.deepEqual(paginationStops(8, 20), [1, null, 6, 7, 8, 9, 10, null, 20]);
  assert.deepEqual(paginationStops(1, 4), [1, 2, 3, 4]);
});

const forms = [
  ['YouTube', ['https://www.youtube.com/watch?v=Juniper0001', 'https://youtu.be/Juniper0001?t=4', 'https://youtube.com/shorts/Juniper0001', 'https://www.youtube-nocookie.com/embed/Juniper0001'], 'https://www.youtube-nocookie.com/embed/Juniper0001'],
  ['Vimeo', ['https://vimeo.com/12345', 'https://player.vimeo.com/video/12345?autoplay=1'], 'https://player.vimeo.com/video/12345?dnt=1'],
  ['Screen9', ['https://api.screen9.com/embed/juniper-atlas'], 'https://api.screen9.com/embed/juniper-atlas'],
  ['Loom', ['https://www.loom.com/share/atlas01', 'https://www.loom.com/embed/atlas01'], 'https://www.loom.com/embed/atlas01'],
  ['Spotify', ['https://open.spotify.com/episode/Atlas01', 'https://open.spotify.com/embed/episode/Atlas01'], 'https://open.spotify.com/embed/episode/Atlas01'],
  ['Acast', ['https://shows.acast.com/atlas/walks', 'https://acast.com/atlas/walks', 'https://embed.acast.com/atlas/walks'], 'https://embed.acast.com/atlas/walks'],
  ['Apple Podcasts', ['https://podcasts.apple.com/us/podcast/atlas/id123?i=456', 'https://embed.podcasts.apple.com/us/podcast/atlas/id123?i=456'], 'https://embed.podcasts.apple.com/us/podcast/atlas/id123?i=456'],
  ['Speaker Deck', ['https://speakerdeck.com/player/atlas01'], 'https://speakerdeck.com/player/atlas01'],
  ['Datawrapper', ['https://datawrapper.dwcdn.net/Atlas/1/', 'https://www.datawrapper.de/_/Atlas/'], 'https://datawrapper.dwcdn.net/Atlas/1/'],
  ['CodePen', ['https://codepen.io/atlas/pen/Note01', 'https://codepen.io/atlas/embed/Note01'], 'https://codepen.io/atlas/embed/Note01?default-tab=result'],
  ['LinkedIn', ['https://www.linkedin.com/embed/feed/update/urn:li:activity:12345', 'https://www.linkedin.com/feed/update/urn:li:activity:12345/', 'https://www.linkedin.com/posts/atlas_a-note-activity-12345-demo'], 'https://www.linkedin.com/embed/feed/update/urn:li:activity:12345'],
];
for (const [provider, addresses, playerUrl] of forms) test(`${provider} recognises its registered share/player forms and creates the canonical player`, () => {
  for (const url of addresses) {
    const embed = recogniseEmbed(url);
    assert.equal(embed.provider, provider); assert.equal(embed.playerUrl, playerUrl);
    assert.equal(embed.category, 'external-media'); assert.equal(embed.title, `Content from ${provider}`);
    assert.ok(['16 / 9', '4 / 3', 'audio', 'square'].includes(embed.format));
    assert.equal(framePlan({ url }).attributes.src, playerUrl);
  }
});

test('provider recognisers refuse unknown hosts, malformed ids, unsafe schemes, credentials, ports and arbitrary paths', () => {
  assert.equal(embedProviders.length, 11);
  for (const address of [
    'https://example.invalid/embed/atlas', 'http://youtu.be/Juniper0001', 'javascript:alert(1)', '//youtu.be/Juniper0001',
    'https://youtu.be.evil.invalid/Juniper0001', 'https://evil.invalid/?url=https://youtu.be/Juniper0001', 'https://user:pass@youtu.be/Juniper0001', 'https://youtu.be:444/Juniper0001',
    'https://youtube.com/watch?v=short', 'https://youtube.com/channel/Juniper0001', 'https://vimeo.com/settings', 'https://api.screen9.com/other/atlas',
    'https://loom.com/profile/atlas', 'https://open.spotify.com/user/atlas', 'https://acast.com/atlas', 'https://podcasts.apple.com/us/podcast/atlas/id123?i=bad',
    'https://speakerdeck.com/atlas/a-deck', 'https://datawrapper.dwcdn.net/Atlas/no-version/', 'https://codepen.io/atlas/full/Note01', 'https://linkedin.com/in/atlas',
    'https://api.screen9.com/embed/atlas%2fother', 'https://speakerdeck.com/player/%3Cscript%3E',
  ]) assert.throws(() => recogniseEmbed(address), TypeError, address);
  for (const kind of ['track', 'album', 'playlist', 'episode', 'show', 'artist']) assert.match(recogniseEmbed(`https://open.spotify.com/${kind}/Atlas01`).playerUrl, new RegExp(`/embed/${kind}/`));
});

test('frame plans contain the real iframe privacy attributes; a gallery note requests no player', () => {
  const url = forms[0][1][0];
  const plan = framePlan({ url, title: 'A film' });
  assert.deepEqual(plan.attributes, { src: forms[0][2], title: 'A film', referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy', allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture', allowfullscreen: '' });
  assert.equal(new URL(framePlan({ url, started: true }).attributes.src).searchParams.get('autoplay'), '1');
  assert.equal(new URL(framePlan({ url: 'https://datawrapper.dwcdn.net/Atlas/1/', started: true }).attributes.src).searchParams.get('autoplay'), null);
  assert.deepEqual(framePlan({ url, galleryNote: 'Players disabled here.' }), { kind: 'note', text: 'Players disabled here.', format: '16 / 9' });
  for (const [state, expected] of [
    [{}, 'warning'], [{ start: 'click' }, 'warning'], [{ played: true, start: 'click' }, 'warning'],
    [{ requested: true, start: 'click' }, 'player'], [{ requested: true }, 'player'],
    [{ granted: true, start: 'click' }, 'thumbnail'], [{ granted: true, played: true, start: 'click' }, 'player'], [{ granted: true }, 'player'],
  ]) assert.equal(embedState(state), expected, JSON.stringify(state));
  assert.deepEqual(embedProviders.filter(({ start }) => start === 'click').map(({ provider }) => provider), ['YouTube', 'Vimeo', 'Screen9', 'Loom']);
  for (const address of ['/poster.svg', './poster.webp', '../poster.png', 'poster.jpg', 'data:image/svg+xml,%3Csvg%3E']) assert.equal(localPreview(address), true, address);
  for (const address of ['https://example.invalid/image', '//example.invalid/image', 'javascript:evil()', 'data:text/html,evil', '\\host\\image']) assert.equal(localPreview(address), false, address);
  assert.equal(isPrimaryClick({ button: 0 }), true);
  for (const change of [{ button: 1 }, { button: 2 }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }]) assert.equal(isPrimaryClick({ button: 0, ...change }), false);
});

test('consent rejects stale versions and malformed choices, keeps required categories and never widens a one-category choice', () => {
  const categories = consentCategories;
  assert.deepEqual(mergeChoice(categories), { necessary: true, 'external-media': false, analytics: false });
  assert.deepEqual(mergeChoice(categories, { necessary: false, 'external-media': true, unknown: true }), { necessary: true, 'external-media': true, analytics: false });
  assert.deepEqual(mergeChoice(categories, { 'external-media': false }, { analytics: true, 'external-media': true }), { necessary: true, 'external-media': false, analytics: true });
  const stored = { version: '2', timestamp: Date.now(), choices: mergeChoice(categories, { analytics: true }) };
  assert.deepEqual(parseStored(JSON.stringify(stored), '2', categories), stored);
  assert.equal(parseStored(JSON.stringify(stored), '3', categories), null);
  for (const raw of [null, '', '{bad', '[]', '{}', '{"version":"2","choices":[]}', '{"version":"2","choices":{"analytics":"yes"}}']) assert.equal(parseStored(raw, '2', categories), null);
});

test('description ids are joined once, and excerpts admit only marks', () => {
  assert.equal(describedBy('help', undefined, 'error', 'help'), 'help error');
  assert.equal(describedBy(undefined, ''), undefined);
  assert.equal(excerptHtml('<mark>café</mark> <img src=x onerror=evil()>'), '<mark>café</mark> &lt;img src=x onerror=evil()&gt;');
});

test('Content Loop renders linked semantic rows, document metadata, video triggers, safe marks and the empty state', async () => {
  const tree = parse(await render('ContentLoop', { presentation: 'rows', level: 4, items: [
    { title: 'A field note', href: '/note/', meta1: [{text: 'Notes'}, {text: '20 October 2026', datetime: '2026-10-20'}], excerpt: '<mark>Garden</mark> <img src=x>', filters: { topic: ['notes'] }, picture: { src: '/local.svg', alt: '' } },
    { title: 'Checklist', href: '/checklist.txt', kind: 'document', fileType: 'TXT', fileSize: '2 kB' },
    { title: 'A studio film', href: forms[0][1][0], kind: 'video' },
  ] }));
  assert.equal(all(tree, 'ul > li.kn-content-item').length, 3);
  assert.equal(all(tree, 'h4[data-kn-type="heading-5"] a').length, 3);
  assert.equal(one(tree, 'time').attributes.datetime, '2026-10-20');
  assert.match(textOf(one(tree, '.kn-content-file')), /TXT2 kB/);
  assert.equal(all(tree, '[data-kn-embed-overlay]').length, 1);
  assert.equal(one(tree, '[data-kn-embed-overlay]').name, 'a');
  assert.equal(one(tree, 'mark').children[0].value, 'Garden');
  assert.equal(all(tree, 'img').length, 1);
  assert.equal(one(tree, '[data-kn-item]').attributes['data-kn-filter'], undefined, 'no script reads an item\'s values; filteredBy gives its keys (visitor-filters.test.js)');
  assert.ok('hidden' in one(tree, '.kn-content-loop-empty').attributes);
  assert.equal(textOf(one(parse(await render('ContentLoop', { items: [], empty: 'Nothing here yet.' })), '.kn-content-loop-empty')), 'Nothing here yet.');
  const cards = parse(await render('ContentLoop', { items: [{ title: 'A card', href: '/note/' }], columns: 2, surface: 'brand', type: 'heading-4' }));
  assert.equal(one(cards, '.kn-card-grid').attributes['data-kn-columns'], '2');
  assert.equal(one(cards, '.kn-card').attributes['data-kn-surface'], 'brand');
  assert.equal(one(cards, '.kn-content-heading').attributes['data-kn-type'], 'heading-4');
  await assert.rejects(render('ContentLoop', { items: [{ title: 'Bad', kind: 'video', href: 'https://example.invalid/player' }] }), /Unrecognised/);
});

test('Visitor Filters are labelled GET controls with a shared select, checkbox pills, a plain count and honest pager links', async () => {
  const tree = parse(await render('VisitorFilters', { for: 'notes', search: { label: 'Find notes' }, toggles: [{ name: 'topic', label: 'Topic', values: ['walks'], options: [{ value: 'walks', label: 'Walks' }] }], select: { name: 'year', label: 'Year', options: [{ value: '', label: 'All years' }] }, total: 10 }));
  const form = one(tree, 'form'); assert.equal(form.attributes.role, 'search'); assert.equal(form.attributes.method, 'get');
  const search = one(form, 'input[type="search"]'); assert.equal(one(form, `label[for="${search.attributes.id}"]`).children[0].value, 'Find notes');
  assert.ok('checked' in one(form, '.kn-pill input[type="checkbox"]').attributes);
  assert.equal(one(form, 'select').attributes.class, 'kn-field-control');
  assert.equal(one(form, `label[for="${one(form, 'select').attributes.id}"]`).children[0].value, 'Year');
  assert.equal(one(form, '.kn-visitor-filter-count').attributes['aria-live'], undefined);
  assert.equal((await render('Pagination', { page: 1, pages: 1 })).trim(), '');
  await assert.rejects(render('VisitorFilters', { for: 'notes', toggles: [{ name: 'constructor', label: 'Bad', options: [] }] }), /stable keys/);
  const pager = parse(await render('Pagination', { page: 8, pages: 20, base: '/notes/', filters: { year: ['2026'] } }));
  assert.equal(one(pager, '[aria-current="page"]').attributes.href.replaceAll('&amp;', '&'), '/notes/?year=2026&page=8');
  assert.ok(all(pager, 'a').every((link) => 'href' in link.attributes));
  assert.equal(all(pager, '[aria-hidden="true"]').length, 2);
  assert.match(textOf(one(pager, 'nav')), /Previous.*Next/);
});

test('Video Player reuses Figure and native video with no autoplay, accessible title, captions and source fallback', async () => {
  const tree = parse(await render('VideoPlayer', { title: 'Garden walk', width: 'full', caption: 'At the garden.', poster: '/poster.svg', sources: [{ src: '/walk.webm', type: 'video/webm' }], tracks: [{ src: '/en.vtt', language: 'en', label: 'English', default: true }] }));
  assert.match(one(tree, 'figure').attributes.class, /kn-figure kn-video/);
  assert.equal(one(tree, 'figure').attributes['data-kn-width'], 'full');
  const video = one(tree, 'video'); assert.ok('controls' in video.attributes); assert.ok(!('autoplay' in video.attributes)); assert.equal(video.attributes.preload, 'metadata'); assert.equal(video.attributes['aria-label'], 'Garden walk');
  assert.equal(one(tree, 'track').attributes.kind, 'captions'); assert.equal(one(tree, 'track').attributes.srclang, 'en'); assert.equal(one(tree, 'track').attributes.label, 'English');
  assert.equal(one(video, 'a').attributes.href, '/walk.webm'); assert.equal(textOf(one(tree, 'figcaption')), 'At the garden.'); assert.equal(all(tree, 'script').length, 0);
  await assert.rejects(render('VideoPlayer', { title: '' }), /title/);
});

test('Embed starts with one ordinary link and an inert local preview, and refuses unsupported addresses at build time', async () => {
  const tree = parse(await render('Embed', { url: forms[0][1][0], title: 'A studio film', poster: '/poster.svg', width: 'wide', caption: 'From the notebook.' }));
  assert.equal(all(tree, 'iframe').length, 0); assert.ok('hidden' in one(tree, '.kn-embed-stage').attributes);
  assert.equal(one(tree, '.kn-embed-original').attributes.href, forms[0][1][0]);
  assert.match(textOf(one(tree, '.kn-embed-notice')), /YouTube/); assert.equal(textOf(one(tree, '[data-kn-embed-load]')).trim(), 'Show this time');
  assert.equal(textOf(one(tree, '.kn-embed-consent [data-kn-consent-open]')).trim(), 'Open consent settings');
  assert.equal(one(tree, '.kn-embed-thumbnail').attributes['aria-label'], 'Play: A studio film'); assert.ok('hidden' in one(tree, '.kn-embed-thumbnail').attributes);
  assert.equal(all(parse(await render('Embed', { url: 'https://datawrapper.dwcdn.net/Atlas/1/', title: 'A chart' })), '.kn-embed-thumbnail').length, 0, 'only heavy players wait behind a thumbnail');
  assert.equal(one(tree, 'figure').attributes['data-kn-width'], 'wide'); assert.equal(textOf(one(tree, 'figcaption')), 'From the notebook.');
  await assert.rejects(render('Embed', { url: 'https://example.invalid/embed' }), /Unrecognised/);
  await assert.rejects(render('Embed', { url: forms[0][1][0], poster: 'https://example.invalid/poster' }), /local image/);
});

test('Form fields expose visible labels, native constraints, joined descriptions, non-colour errors and semantic choice groups', async () => {
  for (const type of ['text', 'email', 'tel', 'url', 'number', 'date', 'password', 'textarea', 'select']) {
    const tree = parse(await render('Field', { type, name: 'example', label: 'Your answer', help: 'A helpful note', error: 'Please check this', required: true, requiredLabel: 'needed', maxInlineSize: '12rem', options: [{ value: 'a', label: 'A' }] }));
    const control = one(tree, 'input, select, textarea');
    const label = one(tree, 'label'); assert.equal(label.attributes.for, control.attributes.id); assert.match(textOf(label), /Your answer.*needed/);
    assert.ok('required' in control.attributes); assert.equal(control.attributes['aria-invalid'], 'true');
    const ids = control.attributes['aria-describedby'].split(' '); assert.equal(ids.length, 2); ids.forEach((id) => assert.ok(one(tree, `#${id}`)));
    assert.ok(one(tree, '.kn-field-error svg')); assert.equal(textOf(one(tree, '[data-kn-error-text]')), 'Please check this');
  }
  for (const type of ['checkbox', 'radio']) {
    const tree = parse(await render('Field', { type, name: 'choice', label: 'Choose', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: ['b'] }));
    assert.equal(textOf(one(tree, 'fieldset legend')), 'Choose'); assert.equal(all(tree, 'label input').length, 2); assert.ok('checked' in all(tree, 'input')[1].attributes);
  }
  const form = parse(await render('Form', { action: '/contact/', honeypot: { name: 'website', label: 'Leave empty' }, columns: 2 }, { default: await render('Field', { name: 'email', label: 'Email', type: 'email' }), actions: await render('Button', { type: 'submit' }, { default: 'Send' }) }));
  assert.equal(one(form, 'form').attributes.method, 'post'); assert.equal(one(form, 'form').attributes['data-kn-columns'], '2');
  assert.ok(one(form, '.kn-link-group button[type="submit"]')); assert.equal(one(form, '[data-kn-honeypot] input').attributes.tabindex, '-1');
});

test('Consent Banner is hidden without script, non-modal, page by default, and supplies equal filled actions and modal settings', async () => {
  const tree = parse(await render('ConsentBanner', { categories: consentCategories, texts: consentTexts, version: '2', level: 3 }));
  const banner = one(tree, '.kn-consent'); assert.ok('hidden' in banner.attributes); assert.equal(banner.attributes.role, 'dialog'); assert.equal(banner.attributes['aria-modal'], 'false'); assert.equal(banner.attributes['data-kn-surface'], 'page');
  assert.ok(one(banner, 'h3')); for (const name of ['accept', 'reject']) assert.equal(one(banner, `[data-kn-consent-${name}]`).attributes['data-kn-variant'], 'filled');
  const dialog = one(tree, 'dialog'); assert.equal(dialog.attributes.id, banner.attributes['data-kn-settings']); assert.ok(one(dialog, 'input[disabled][checked]')); assert.ok(one(dialog, 'button[type="submit"]'));
});
