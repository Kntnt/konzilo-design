import test from 'node:test';
import assert from 'node:assert/strict';
import { derive, defaultInputs, validateInputs } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { layoutFooter } from '../src/components/footer.js';
import { footerBands, FOOTER_MODELS, HAS_ROWS, HAS_SECOND_SURFACE } from '../src/components/footer-models.js';
import { breadcrumbProps, footerContent, footerProps, headerProps, heroProps, identityProps, pageProps } from '../presentation/src/frame.js';
import { designMd } from '../src/design-md/index.js';

const inputs = (more = {}) => ({ 'brand-colors': { primary: '#168b83' }, ...more });
const settings = (more = {}) => withDefaults(inputs(more));

test('a design has settings for its header, footer and page, and they pass to what consumers read', () => {
  const resolved = derive(inputs({ header: { arrangement: 'B' }, footer: { model: 'one' }, page: { shadow: true }, layout: { wide: 1000, narrow: 640 } }));
  assert.equal(resolved.header.arrangement, 'B');
  assert.equal(resolved.header.attachment, 'sticky', 'what is not set keeps its default');
  assert.equal(resolved.footer.model, 'one');
  assert.equal(resolved.page.shadow, true);
  assert.equal(resolved.layout.wide, 1000);
  assert.equal(resolved.layout.narrow, 640);
  assert.equal(defaultInputs().layout.wide, 1200);
  assert.throws(() => validateInputs(inputs({ header: { arrangement: 'D' } })));
  assert.throws(() => validateInputs(inputs({ footer: { model: 'none' } })));
  assert.throws(() => validateInputs(inputs({ page: { 'fill-light': 'red; background: url(x)' } })));
  assert.throws(() => validateInputs(inputs({ layout: { wide: 100 } })));
});

test('every footer model lays out in every colour, with lines or without', () => {
  const surfaces = ['page', 'raised', 'tint', 'brand', 'inverse'];
  for (const model of FOOTER_MODELS)
    for (const surface of surfaces)
      for (const rule of [true, false]) {
        const footer = { ...settings().footer, model, surface, 'second-surface': 'brand', 'horizontal-rules': rule, 'vertical-rule': rule };
        const layout = layoutFooter(footerBands(footer, footerContent(footer, { name: 'A & B' })));
        assert.ok(layout.cells.length > 0, model);
      }
  assert.throws(() => footerBands({ ...settings().footer, model: 'other' }, {}), /Unknown footer model/);
});

test('the footer controls say what each model can have', () => {
  const content = footerContent(settings().footer, { name: 'A' });
  for (const model of FOOTER_MODELS) {
    const footer = { ...settings().footer, model, surface: 'brand', 'second-surface': 'inverse', 'horizontal-rules': true };
    const { bands } = layoutFooter(footerBands(footer, content));
    assert.equal(bands.some((band) => band.surface === 'inverse'), HAS_SECOND_SURFACE.includes(model), `${model}: second colour`);
    assert.equal(bands.some((band) => band.horizontal), HAS_ROWS.includes(model) || model === 'statement', `${model}: lines`);
  }
});

test('a line between columns and the extent of lines reach the footer', () => {
  const footer = { ...settings().footer, model: 'two', 'vertical-rule': true, 'rule-extent': 'full' };
  const props = footerProps(footer, { name: 'A' });
  assert.equal(props.rules, 'full');
  assert.ok(layoutFooter(props.bands).bands.every((band) => band.vertical));
});

test('the header props follow the settings', () => {
  const header = settings().header;
  const project = { name: 'Name', logo: 'data:light', 'logo-dark': 'data:dark', slogan: 'Words' };
  const props = headerProps(header, project);
  assert.deepEqual(props.menuButton, { word: 'Menu' });
  assert.equal(props.search.surface, 'inverse');
  assert.equal(props.languages.length, 0);
  assert.equal(props.identity.slogan, 'Words');
  assert.equal(props.identity.name, undefined, 'a logo stands alone by default');
  assert.equal(identityProps({ ...header, identity: 'both' }, project).name, 'Name');
  assert.equal(identityProps({ ...header, identity: 'name' }, project).logo, undefined);
  assert.equal(identityProps(header, { name: 'Name' }).name, 'Name', 'without a logo there is the name');
  assert.deepEqual(headerProps({ ...header, 'menu-button': 'icon' }, project).menuButton, { word: '', icon: 'menu' });
  assert.equal(headerProps({ ...header, 'menu-button': 'off' }, project).menuButton, false);
  assert.equal(headerProps({ ...header, search: false }, project).search, undefined);
  assert.equal(headerProps({ ...header, 'search-links': false }, project).search.links, undefined);
  const flow = headerProps({ ...header, attachment: 'flow', start: 'under', autohide: true }, project);
  assert.equal(flow.start, 'below', 'only a sticky header has a page under it');
  assert.equal(flow.autohide, false);
  assert.deepEqual(pageProps({ shadow: true, 'edge-line': false, 'fill-light': '#fff' }), { shadow: true, edgeLine: false, fillLight: '#fff', fillDark: undefined });
});

test('a footer on a dark colour uses the dark logo, and the name stands in for a missing one', () => {
  const project = { name: 'A & B', logo: 'data:light', 'logo-dark': 'data:dark' };
  assert.match(footerContent({ surface: 'brand' }, project).identity, /data:dark/);
  assert.match(footerContent({ surface: 'page' }, project).identity, /data:light/);
  assert.match(footerContent({ surface: 'page' }, { name: 'A & B' }).identity, /A &amp; B/);
});

test('the export tells an agent what frame this design has', async () => {
  const resolved = derive(inputs({ header: { arrangement: 'C', language: true, attachment: 'flow' }, footer: { attachment: 'reveal' } }));
  const text = designMd({ inputs: settings(), project: { name: 'Name' }, resolved }, 'name.design.json');
  assert.match(text, /### This design's frame/);
  assert.match(text, /arrangement C/);
  assert.match(text, /a language switcher/);
  assert.match(text, /scrolls away/);
  assert.match(text, /revealed under the page/);
});

test('a design says how its breadcrumbs show', () => {
  const defaults = defaultInputs().breadcrumbs;
  assert.deepEqual(defaults, { show: true, placement: 'first-band', separator: 'slash', home: 'word', current: true, narrow: 'trail' });
  assert.equal(derive(inputs({ breadcrumbs: { separator: 'chevron' } })).breadcrumbs.separator, 'chevron');
  assert.throws(() => validateInputs(inputs({ breadcrumbs: { separator: 'star' } })));
  assert.equal(breadcrumbProps(defaults, { name: 'Site' }).items[0].label, 'Home');
  assert.equal(breadcrumbProps({ ...defaults, home: 'name' }, { name: 'Site' }).items[0].label, 'Site');
  const icon = breadcrumbProps({ ...defaults, home: 'icon', current: false, narrow: 'parent' }, { name: 'Site' });
  assert.deepEqual([icon.home, icon.items[0].label, icon.current, icon.narrow], ['icon', 'Home', false, 'parent']);
  const words = (breadcrumbs) => designMd({ inputs: settings(), project: { name: 'Name' }, resolved: derive(inputs({ breadcrumbs })) }, 'name.design.json');
  assert.match(words({ placement: 'own-band', home: 'icon', narrow: 'parent' }), /thin Band of its own[^\n]*a house icon[^\n]*one level up/);
  assert.match(words({ show: false }), /Breadcrumb Navigation:\*\* none/);
});

test('a design says how its hero opens a page', () => {
  const defaults = defaultInputs().hero;
  assert.deepEqual(defaults, { picture: 'behind', surface: 'none', overlay: 'dark', height: 'two-thirds', place: 'bottom', type: 'heading-1' });
  assert.equal(derive(inputs({ hero: { height: 'half' } })).hero.height, 'half');
  assert.equal(derive(inputs({ hero: { height: 'half' } })).hero.place, 'bottom', 'what is left out keeps its default');
  assert.throws(() => validateInputs(inputs({ hero: { height: 'quarter' } })));
  const images = { hero: '/behind.webp', landscapes: ['/beside.webp'] };
  assert.deepEqual(heroProps(defaults, images), { surface: 'picture-dark', picture: '/behind.webp', alt: undefined, type: 'heading-1', height: 'two-thirds', place: 'bottom' });
  const beside = heroProps({ ...defaults, picture: 'beside', surface: 'brand' }, images);
  assert.deepEqual([beside.surface, beside.picture, beside.alt], ['brand', '/beside.webp', '']);
  const plain = heroProps({ ...defaults, picture: 'none' }, images);
  assert.deepEqual([plain.surface, plain.picture], [undefined, undefined]);
  assert.equal(heroProps({ ...defaults, height: 'third' }, images).place, 'center', 'at a third the text has nowhere to move');
  const words = (hero) => designMd({ inputs: settings(), project: { name: 'Name' }, resolved: derive(inputs({ hero })) }, 'name.design.json');
  assert.match(words({}), /\*\*Hero:\*\* by default a picture behind the text, under a dark overlay, taking two thirds of the screen, with its text at the bottom/);
  assert.match(words({ picture: 'beside', surface: 'tint', height: 'third', type: 'display' }), /a picture beside the text, on the tint Surface, taking a third of the screen, with its text centred and its heading in the display style/);
});
