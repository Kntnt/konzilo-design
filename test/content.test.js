import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { transform } from '@astrojs/compiler-rs';
import { experimental_AstroContainer } from 'astro/container';
import { parse } from 'ultrahtml';
import { querySelector as one, querySelectorAll as all } from 'ultrahtml/selector';
import { tableRows } from '../src/components/table.js';
import { contentsTree } from '../src/components/table-of-contents.js';
import { derive, resolve, contrast, validateDesignFile, checkContrast } from '../src/generator/index.js';
import { emitCss, coreCss } from '../src/css/index.js';

// Compile the real Astro wrappers entirely in memory; no server or fixture files.
// Build metadata is unused by the Container API and can be tree-shaken away.
const compiled = new Map();
async function component(name) {
  if (compiled.has(name)) return compiled.get(name);
  const entry = new URL(`../src/components/${name}.astro`, import.meta.url);
  const bundle = await rolldown({
    input: 'virtual:component', logLevel: 'silent',
    treeshake: { manualPureFunctions: ['$$createMetadata'] },
    plugins: [{
      name: 'astro-component-test',
      resolveId(id, importer) {
        if (id === 'virtual:component') return id;
        if (id.endsWith('.astro')) return fileURLToPath(id.startsWith('file:') ? id : new URL(id, pathToFileURL(importer)));
        return { id: id.startsWith('.') ? new URL(id, pathToFileURL(importer)).href : import.meta.resolve(id), external: true };
      },
      async load(id) {
        if (id === 'virtual:component') return `export { default } from ${JSON.stringify(entry.href)};`;
        if (id.endsWith('.astro')) return transform(await readFile(id, 'utf8'), { filename: id, internalURL: 'astro/compiler-runtime', resultScopedSlot: true }).code;
      },
    }],
  });
  let code;
  try { code = (await bundle.generate({ format: 'esm' })).output[0].code; }
  finally { await bundle.close(); }
  const factory = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
  compiled.set(name, factory);
  return factory;
}
async function render(name, props = {}, slot) {
  const container = await experimental_AstroContainer.create();
  return container.renderToString(await component(name), { props, ...(slot === undefined ? {} : { slots: { default: slot } }) });
}
const textOf = (node) => node?.value ?? node?.children?.map(textOf).join('') ?? '';

test('Table renders a caption-named scroll region, column and row headers, spans and a numeric footer', async () => {
  const columns = [{ label: 'Season' }, { label: 'Sessions', numeric: true }, { label: 'Places', align: 'center' }];
  const tree = parse(await render('Table', { caption: 'Open workshops', columns, rows: [[{ text: 'Spring', rowspan: 2, header: true }, '6', '24'], ['4', '16']], footer: [[{ text: 'Total', header: true }, '10', '40']], striped: true, surface: 'raised', 'data-kn-width': 'wide' }));
  const region = one(tree, '.kn-table-scroll');
  assert.equal(region.attributes.role, 'region');
  assert.equal(region.attributes.tabindex, '0');
  assert.equal(region.attributes['data-kn-width'], 'wide');
  const caption = one(tree, 'caption');
  assert.equal(caption.attributes.id, region.attributes['aria-labelledby']);
  assert.equal(textOf(caption), 'Open workshops');
  assert.deepEqual(all(tree, 'thead th').map((node) => node.attributes.scope), ['col', 'col', 'col']);
  assert.equal(one(tree, 'tbody th').attributes.scope, 'rowgroup');
  assert.equal(one(tree, 'tbody th').attributes.rowspan, '2');
  const secondRow = all(tree, 'tbody tr')[1];
  assert.equal(one(secondRow, 'td').attributes['data-kn-align'], 'end');
  assert.ok('data-kn-numeric' in one(secondRow, 'td').attributes);
  assert.equal(all(tree, 'tfoot tr').length, 1);
  assert.equal(one(tree, 'tfoot th').attributes.scope, 'row');
  const noFooter = parse(await render('Table', { caption: 'Small table', columns: [{ label: 'Note' }], rows: [['Ready']] }));
  assert.equal(one(noFooter, 'tfoot'), undefined);
  const hand = parse(await render('Table', { caption: 'Hand-written' }, '<table><caption>Hand-written</caption><tbody><tr><td>A note</td></tr></tbody></table>'));
  assert.equal(all(hand, 'table').length, 1);
  assert.equal(one(hand, '.kn-table-scroll').attributes['aria-label'], 'Hand-written');
});

test('table spans resolve column alignment and reject overlaps, gaps, invalid rectangles and row-group crossings', () => {
  const columns = [{ label: 'A' }, { label: 'B', numeric: true }, { label: 'C' }];
  assert.equal(tableRows([[{ text: 'A', rowspan: 2 }, '1', 'C'], ['2', 'D']], columns)[1][0].numeric, true);
  assert.equal(tableRows([[{ text: 'Merged', colspan: 2 }, 'C']], columns)[0][1].column, 2);
  for (const rows of [[['A']], [[{ text: 'A', colspan: 0 }, 'B', 'C']], [[{ text: 'A', colspan: 4 }]], [[{ text: 'A', rowspan: 2 }, 'B', 'C']], [['A', { text: 'B', rowspan: 2 }, 'C'], [{ text: 'Overlap', colspan: 2 }, 'D']]]) assert.throws(() => tableRows(rows, columns), RangeError);
});

test('Accordion groups slotted details per instance, multiple omits names, and items have semantic headings and Body Text', async () => {
  const first = await render('AccordionItem', { label: 'First question', level: 4, open: true }, '<p>First answer.</p>');
  const second = await render('AccordionItem', { label: 'Second question' }, '<p>Second answer.</p>');
  const a = parse(await render('Accordion', {}, first + second));
  const b = parse(await render('Accordion', {}, first + second));
  const names = all(a, 'details').map((node) => node.attributes.name);
  assert.equal(names.length, 2);
  assert.ok(names[0]);
  assert.equal(names[0], names[1]);
  assert.notEqual(names[0], one(b, 'details').attributes.name);
  assert.equal(textOf(one(a, 'summary h4')), 'First question');
  assert.ok('open' in one(a, 'details').attributes);
  assert.equal(all(a, '.kn-accordion-content.kn-body-text').length, 2);
  assert.equal(all(a, 'script').length, 0);
  const multiple = parse(await render('Accordion', { mode: 'multiple' }, first + second));
  for (const item of all(multiple, 'details')) assert.ok(!('name' in item.attributes));
  assert.equal(one(multiple, 'summary svg').attributes['aria-hidden'], 'true');
});

test('FAQ emits matching structured data only when requested with items and escapes script boundaries', async () => {
  const items = [{ question: 'What is ready?', answer: '<p>The <strong>notebook</strong>.</p>' }, { question: 'Is this literal?', answer: '</script><script>unexpected()</script>' }];
  const html = await render('Accordion', { faq: true, items });
  const tree = parse(html);
  // The answer HTML is trusted build-time input; test JSON-LD separately from it.
  const script = one(tree, 'script[type="application/ld+json"]');
  const data = JSON.parse(textOf(script));
  assert.equal(data['@type'], 'FAQPage');
  assert.deepEqual(data.mainEntity.map((entry) => [entry.name, entry.acceptedAnswer.text]), items.map((entry) => [entry.question, entry.answer]));
  assert.doesNotMatch(textOf(script), /<\/script>/i);
  assert.equal(all(tree, 'details').length, items.length);
  assert.equal(one(tree, 'details strong')?.name, 'strong');
  for (const props of [{ items }, { faq: true }, { faq: true, items: [] }]) assert.equal(one(parse(await render('Accordion', props)), 'script[type="application/ld+json"]'), undefined);
});

test('Quotation uses figure, blockquote, optional attribution and source without inventing an empty caption', async () => {
  const tree = parse(await render('Quotation', { name: 'Rowan Vale', context: 'Juniper Atlas', sourceUrl: '/notebook', surface: 'tint' }, '<p>Keep a question nearby.</p>'));
  assert.equal(one(tree, 'figure').attributes['data-kn-surface'], 'tint');
  assert.equal(one(tree, 'blockquote').attributes.cite, '/notebook');
  assert.equal(one(tree, 'blockquote').attributes['data-kn-type'], 'heading-4');
  assert.match(textOf(one(tree, 'figcaption')), /Rowan Vale, Juniper Atlas/);
  assert.equal(one(tree, 'figcaption a').attributes.href, '/notebook');
  assert.equal(one(parse(await render('Quotation', {}, '<p>Only the thought.</p>')), 'figcaption'), undefined);
});

test('Callout has an accessible icon for every meaning and creates a live region only on request', async () => {
  for (const variant of ['info', 'success', 'warning', 'error']) {
    const tree = parse(await render('Callout', { variant, title: 'A useful note', level: 4 }, '<p>Bring a notebook.</p>'));
    const callout = one(tree, '.kn-callout');
    assert.equal(callout.attributes['data-kn-variant'], variant);
    assert.ok(!('role' in callout.attributes));
    assert.ok(one(callout, 'svg[aria-label]'));
    assert.equal(one(callout, 'svg').attributes.role, 'img');
    assert.equal(textOf(one(callout, 'h4')), 'A useful note');
    assert.ok(one(callout, '.kn-body-text p'));
  }
  const noTitle = parse(await render('Callout', { role: 'status', surface: 'raised' }, '<p>Ready.</p>'));
  assert.equal(one(noTitle, '.kn-callout').attributes.role, 'status');
  assert.equal(one(noTitle, '.kn-callout').attributes['data-kn-variant'], 'info');
  assert.equal(one(noTitle, '.kn-callout-title'), undefined);
  assert.ok(one(noTitle, 'svg[aria-label]'));
});

test('Breadcrumb Navigation omits short trails and renders the last item as current-page text', async () => {
  for (const items of [[], [{ label: 'Home', href: '/' }]]) assert.equal((await render('Breadcrumbs', { items })).trim(), '');
  const tree = parse(await render('Breadcrumbs', { label: 'Site path', items: [{ label: 'Home', href: '/' }, { label: 'Notebook' }, { label: 'Current', href: '/current' }] }));
  assert.equal(one(tree, 'nav').attributes['aria-label'], 'Site path');
  assert.equal(all(tree, 'ol > li').length, 3);
  assert.equal(all(tree, 'a').length, 1);
  assert.equal(one(tree, '[aria-current="page"]').name, 'span');
  assert.equal(textOf(one(tree, '[aria-current="page"]')), 'Current');
  assert.equal(all(tree, '.kn-breadcrumbs-separator[aria-hidden="true"]').length, 2);
  assert.equal(one(parse(await render('Breadcrumbs', { items: [{ label: 'Home' }, { label: 'Current' }] })), 'nav').attributes['aria-label'], 'Breadcrumb');
});

test('Table of Contents filters semantic depth, omits fewer than two, and nests skipped input levels without placeholders', async () => {
  const headings = [{ depth: 1, slug: 'title', text: 'Title' }, { depth: 2, slug: 'begin', text: 'Begin' }, { depth: 5, slug: 'detail', text: 'Detail' }, { depth: 6, slug: 'tiny', text: 'Tiny' }, { depth: 3, slug: 'nearby', text: 'Nearby' }, { depth: 2, slug: 'finish', text: 'Finish' }];
  const shallow = parse(await render('TableOfContents', { headings }));
  assert.deepEqual(all(shallow, 'a').map((node) => node.attributes.href), ['#begin', '#finish']);
  const nav = one(shallow, 'nav');
  assert.equal(one(shallow, '.kn-toc-label').name, 'p');
  assert.equal(nav.attributes['aria-labelledby'], one(shallow, '.kn-toc-label').attributes.id);
  const deep = parse(await render('TableOfContents', { headings, depth: 6, level: 4, label: 'On this page', surface: 'raised' }));
  assert.equal(one(deep, '.kn-toc-label').name, 'h4');
  assert.equal(textOf(one(deep, 'h4')), 'On this page');
  assert.deepEqual(all(deep, 'a').map((node) => node.attributes.href), ['#begin', '#detail', '#tiny', '#nearby', '#finish']);
  assert.equal(all(deep, 'ol').length, 3);
  assert.equal(all(deep, 'li').length, 5);
  for (const list of all(deep, 'ol')) assert.ok(list.children.filter((node) => node.type === 1).every((node) => node.name === 'li'));
  assert.equal(one(all(deep, 'ol')[2], 'a').attributes.href, '#tiny');
  assert.equal(contentsTree(headings, 6)[0].children[1].slug, 'nearby');
  for (const list of [[], [headings[0]], [headings[1]], headings.slice(0, 3)]) assert.equal((await render('TableOfContents', { headings: list })).trim(), '');
  assert.equal(one(parse(await render('TableOfContents', { headings: [headings[2], headings[3]], depth: 6 })), 'a').attributes.href, '#detail');
});

test('background-alt has fixed recipes and all three checked text pairs across seeds, modes and ranks', async () => {
  for (const primary of ['#0f766e', '#facc15', '#1d4ed8', '#dc2626', '#111111']) for (const ranked of [false, true]) {
    const inputs = { 'brand-colors': { primary, ...(ranked ? { secondary: '#c76532', tertiary: '#8646b0' } : {}) } };
    const r = await resolve(inputs);
    validateDesignFile({ format: 1, inputs, project: {}, resolved: r });
    assert.equal(checkContrast(r), true);
    assert.match(coreCss(r), /--kn-background-alt:/);
    for (const [kind, modes] of Object.entries(r.surfaces)) for (const [mode, surface] of Object.entries(modes)) {
      const dark = mode === 'dark';
      const expected = kind.startsWith('picture-') ? surface.recipes.background : kind === 'brand' ? 'primary-900' : kind === 'accent' ? 'primary-800' : kind === 'inverse' ? 'gray-900' : (kind.startsWith('tint') || kind.startsWith('status-')) ? dark ? `${kind === 'tint' ? 'primary' : kind.startsWith('status-') ? kind.slice(7) : kind.slice(5)}-950` : 'white' : kind === 'raised' ? dark ? 'gray-950' : 'white' : dark ? 'gray-900' : 'gray-100';
      assert.equal(surface.recipes['background-alt'], expected, `${primary}/${kind}/${mode}`);
      const fill = kind.startsWith('status-') ? surface.roles['background-alt'] : expected === 'white' ? '#ffffff' : expected === 'black' ? '#000000' : r.ramps[expected.split('-')[0]][expected.split('-')[1]];
      assert.equal(surface.roles['background-alt'], fill);
      assert.equal(surface.adjustments['background-alt'], undefined);
      for (const role of ['text', 'text-muted', 'link']) {
        const pair = r['contrast-check'].matrix[kind][mode].pairs[`${role}-alt`];
        assert.equal(pair.foreground, surface.roles[role]);
        assert.equal(pair.background, fill);
        assert.equal(pair.target, 4.5);
        assert.equal(pair.ratio, contrast(pair.foreground, pair.background));
        assert.deepEqual(pair.samples, {});
        assert.ok(pair.passed && pair.ratio >= 4.5, `${primary}/${kind}/${mode}/${role}-alt`);
      }
    }
  }
});

test('exports reject missing alternate roles, failed alternate pairs and stale alternate reports', async () => {
  for (const tamper of [
    (r) => { delete r.surfaces.page.light.roles['background-alt']; },
    (r) => { r.surfaces.page.light.roles['background-alt'] = r.surfaces.page.light.roles.text; },
    (r) => { r['contrast-check'].matrix.page.light.pairs['text-alt'].ratio += 0.01; },
    (r) => { r['contrast-check'].matrix.page.light.pairs['link-alt'].passed = false; },
    (r) => { delete r['contrast-check'].matrix.brand.dark.pairs['text-muted-alt']; },
  ]) {
    const inputs = { 'brand-colors': { primary: '#0f766e' } };
    const file = { format: 1, inputs, project: {}, resolved: await resolve(inputs) };
    tamper(file.resolved);
    await assert.rejects(emitCss(file), /contrast check failed|missing background-alt|missing text-muted-alt/);
  }
  assert.equal(derive({ 'brand-colors': { primary: '#0f766e' } })['contrast-check'].status, 'passed');
});
