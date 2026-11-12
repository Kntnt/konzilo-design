import test from 'node:test';
import assert from 'node:assert/strict';
import { derive, defaultInputs, validateInputs } from '../src/generator/index.js';
import { withDefaults } from '../src/generator/defaults.js';
import { footerFromDesign, layoutFooter } from '../src/components/footer.js';
import { breadcrumbProps, footerContent, footerProps, headerProps, heroProps, identityProps, pageProps } from '../presentation/src/frame.js';
import { designMd } from '../src/design-md/index.js';
import { coreCss } from '../src/css/index.js';

const inputs = (more = {}) => ({ 'brand-colors': { primary: '#168b83' }, ...more });
const settings = (more = {}) => withDefaults(inputs(more));

test('a design has settings for its header, footer and page, and they pass to what consumers read', () => {
  const resolved = derive(inputs({ header: { arrangement: 'B' }, footer: { fill: 'row', upper: { cells: { a1: false } } }, page: { shadow: true }, layout: { wide: 1000, narrow: 640 } }));
  assert.equal(resolved.header.arrangement, 'B');
  assert.equal(resolved.header.attachment, 'sticky', 'what is not set keeps its default');
  assert.equal(resolved.footer.fill, 'row');
  assert.equal(resolved.footer.upper.cells.a1, false);
  assert.equal(resolved.footer.upper.cells.b1, true, 'what is not set keeps its default');
  assert.equal(resolved.page.shadow, true);
  assert.equal(resolved.layout.wide, 1000);
  assert.equal(resolved.layout.narrow, 640);
  assert.equal(defaultInputs().layout.wide, 1200);
  assert.throws(() => validateInputs(inputs({ header: { arrangement: 'D' } })));
  assert.throws(() => validateInputs(inputs({ footer: { model: 'utility' } })), /unknown property model/);
  assert.throws(() => validateInputs(inputs({ footer: { fill: 'both' } })));
  assert.throws(() => validateInputs(inputs({ footer: { upper: { surface: 'accent' } } })));
  assert.throws(() => validateInputs(inputs({ footer: { lower: { cells: { c1: true } } } })));
  assert.throws(() => validateInputs(inputs({ footer: { lower: { cells: { a1: 'yes' } } } })));
  assert.throws(() => validateInputs(inputs({ page: { 'fill-light': 'red; background: url(x)' } })));
  assert.throws(() => validateInputs(inputs({ layout: { wide: 100 } })));
});

test('a new design has all eight cells on, the upper band in the brand colour and the lower nearly black, at the end of the page', () => {
  const { footer } = settings();
  assert.deepEqual(footer, {
    attachment: 'flow',
    fill: 'column',
    upper: { surface: 'brand', cells: { a1: true, b1: true, a2: true, b2: true } },
    lower: { surface: 'inverse', cells: { a1: true, b1: true, a2: true, b2: true } },
    'horizontal-rules': false,
    'vertical-rule': false,
    'rule-extent': 'content',
  });
});

test('the sample shows exactly the owner\'s list, and each cell can be turned off', () => {
  const footer = settings().footer;
  const { upper, lower } = footerProps(footer, { name: 'A & B', logo: 'data:logo' });
  assert.match(upper.cells.a1.content, /<img src="data:logo" alt="A &amp; B"/);
  assert.match(upper.cells.b1.content, /kn-footer-social/);
  assert.deepEqual([...upper.cells.b1.content.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]), ['LinkedIn', 'Facebook', 'YouTube', 'Spotify', 'Email', 'RSS']);
  assert.equal([...upper.cells.b1.content.matchAll(/class="kn-icon"/g)].length, 6);
  assert.ok(upper.cells.a2.text);
  assert.deepEqual(upper.cells.b2.links.map((link) => link.label), ['Products', 'Services', 'Markets', 'Technology', 'Knowledge', 'About']);
  assert.match(lower.cells.a1.text, /Example Street/);
  assert.match(lower.cells.b1.text, /Registration no\..*Registered office/);
  assert.deepEqual(lower.cells.a2.links.map((link) => link.label), ['Cookie policy', 'Privacy policy']);
  assert.deepEqual(lower.cells.b2.links.map((link) => [link.label, link.consentOpen]), [['Change privacy settings', true], ['Revoke consents', true]]);
  const off = footerProps({ ...footer, lower: { ...footer.lower, cells: { ...footer.lower.cells, a1: false } } }, { name: 'A' });
  assert.equal(off.lower.cells.a1, false);
  assert.deepEqual(layoutFooter(off).bands[1].cells.map((cell) => cell.name), ['b1', 'a2', 'b2'], 'the lower band row by row');
});

test('every combination of cells lays out in every colour, with lines or without', () => {
  const surfaces = ['page', 'raised', 'tint', 'brand', 'inverse'];
  const footer = settings().footer;
  const content = footerContent(footer, { name: 'A & B' });
  for (let bits = 0; bits < 16; bits++)
    for (const surface of surfaces)
      for (const rule of [true, false]) {
        const cells = { a1: !!(bits & 1), b1: !!(bits & 2), a2: !!(bits & 4), b2: !!(bits & 8) };
        const props = footerFromDesign({ ...footer, upper: { surface, cells }, lower: { surface: 'brand', cells }, 'horizontal-rules': rule, 'vertical-rule': rule }, content);
        assert.equal(layoutFooter(props).bands.length, bits ? 2 : 0);
      }
});

test('the lines, their extent, the fill and the attachment reach the footer', () => {
  const footer = { ...settings().footer, attachment: 'reveal', fill: 'row', 'horizontal-rules': true, 'vertical-rule': true, 'rule-extent': 'full' };
  const props = footerProps(footer, { name: 'A' });
  assert.deepEqual([props.attachment, props.fill, props.rules, props.horizontalRules, props.verticalRule], ['reveal', 'row', 'full', true, true]);
  assert.ok(layoutFooter(props).bands.every((band) => band.vertical === 'all' && band.horizontal === 'both'));
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
  assert.deepEqual([props.menuAbove, props.menuBelow], [false, false]);
  assert.deepEqual(['menuAbove', 'menuBelow'].map((key) => headerProps({ ...header, 'menu-above': true, 'menu-below': true }, project)[key]), [true, true]);
  const flow = headerProps({ ...header, attachment: 'flow', start: 'under', autohide: true }, project);
  assert.equal(flow.start, 'below', 'only a sticky header has a page under it');
  assert.equal(flow.autohide, false);
  // A hint of the page through the header (the owner, 2026-11-12): off unless the design says so.
  assert.deepEqual([props.translucent, headerProps({ ...header, translucent: true }, project).translucent], [false, true]);
  assert.deepEqual(pageProps({ shadow: true, 'edge-line': false, 'fill-light': '#fff' }), { shadow: true, edgeLine: false, fillLight: '#fff', fillDark: undefined });
});

test('the search box\'s close button and what its empty field shows reach the header, and a design without them keeps today\'s look', async () => {
  const header = settings().header;
  const project = { name: 'Name' };
  assert.deepEqual([header['search-close'], header['search-placeholder']], [true, 'word'], 'the defaults');
  const props = (more) => headerProps({ ...header, ...more }, project).search;
  assert.deepEqual([props({}).close, props({}).placeholder, props({}).word], [true, 'word', 'Search'], 'the sample gives its own word');
  assert.equal(props({ 'search-close': false }).close, false);
  assert.equal(props({ 'search-placeholder': 'icon' }).placeholder, 'icon');
  assert.equal(props({ 'search-placeholder': 'none' }).placeholder, 'none');
  // A design file written before these settings has none of them in its resolved header: the box keeps its close
  // button and the word, as before.
  const older = { ...header };
  delete older['search-close'];
  delete older['search-placeholder'];
  assert.deepEqual([props(older).close, props(older).placeholder], [true, 'word']);
  assert.deepEqual([derive(inputs()).header['search-close'], derive(inputs()).header['search-placeholder']], [true, 'word'], 'and resolves with them');
  assert.throws(() => validateInputs(inputs({ header: { 'search-placeholder': 'text' } })));
  assert.throws(() => validateInputs(inputs({ header: { 'search-close': 'no' } })));
  const said = (more) => designMd({ inputs: settings(), project: { name: 'Name' }, resolved: derive(inputs({ header: more })) }, 'name.design.json');
  assert.match(said({}), /with its close button; its empty field shows the site's word for Search as its placeholder\./);
  assert.match(said({ 'search-close': false, 'search-placeholder': 'icon' }), /with no close button, so Esc or a click beside the box closes it; its empty field shows a magnifier where the words begin, which goes as the visitor types\./);
  assert.match(said({ 'search-placeholder': 'none' }), /its empty field shows nothing\./);
  assert.match(said({}), /The whole window, the header and the footer included, is covered/);
});

test('a footer on a dark colour uses the dark logo, and the name stands in for a missing one', () => {
  const project = { name: 'A & B', logo: 'data:light', 'logo-dark': 'data:dark' };
  const logo = (surface, of = project) => footerContent({ upper: { surface } }, of).upper.a1.content;
  assert.match(logo('brand'), /data:dark/);
  assert.match(logo('page'), /data:light/);
  assert.match(logo('page', { name: 'A & B' }), /A &amp; B/);
});

test('the export tells an agent what frame this design has', async () => {
  const resolved = derive(inputs({ header: { arrangement: 'C', language: true, attachment: 'flow' }, footer: { attachment: 'reveal' } }));
  const text = designMd({ inputs: settings(), project: { name: 'Name' }, resolved }, 'name.design.json');
  assert.match(text, /### This design's frame/);
  assert.match(text, /arrangement C/);
  assert.match(text, /a language switcher/);
  assert.match(text, /scrolls away/);
  assert.match(text, /revealed under the page/);
  assert.match(text, /an upper band on the brand Surface, with cells A1, B1, A2, B2 and a thin lower band on the inverse Surface/);
  assert.match(text, /gives way to the cell above or below it/);
  assert.match(text, /the upper band column by column \(A1, A2, B1, B2\) and the lower band row by row \(A1, B1, A2, B2\)/, 'how the footer stacks on a phone');
  const lowerAlone = derive(inputs({ footer: { fill: 'row', upper: { cells: { a1: false, b1: false, a2: false, b2: false } }, lower: { cells: { b1: false } } } }));
  const fewer = designMd({ inputs: settings(), project: { name: 'Name' }, resolved: lowerAlone }, 'name.design.json');
  assert.match(fewer, /\*\*Footer:\*\* a thin lower band on the inverse Surface, with cells A1, A2, B2\. It sits at the end of the page/);
  assert.match(fewer, /gives way to the cell beside it/);
});

test('a design says how its breadcrumbs show', () => {
  const defaults = defaultInputs().breadcrumbs;
  assert.deepEqual(defaults, { show: true, separator: 'slash', home: 'word', current: true, narrow: 'trail' });
  assert.equal(derive(inputs({ breadcrumbs: { separator: 'chevron' } })).breadcrumbs.separator, 'chevron');
  assert.throws(() => validateInputs(inputs({ breadcrumbs: { separator: 'star' } })));
  assert.equal(breadcrumbProps(defaults, { name: 'Site' }).items[0].label, 'Home');
  assert.equal(breadcrumbProps({ ...defaults, home: 'name' }, { name: 'Site' }).items[0].label, 'Site');
  const icon = breadcrumbProps({ ...defaults, home: 'icon', current: false, narrow: 'parent' }, { name: 'Site' });
  assert.deepEqual([icon.home, icon.items[0].label, icon.current, icon.narrow], ['icon', 'Home', false, 'parent']);
  const words = (breadcrumbs) => designMd({ inputs: settings(), project: { name: 'Name' }, resolved: derive(inputs({ breadcrumbs })) }, 'name.design.json');
  assert.match(words({ home: 'icon', narrow: 'parent' }), /directly above the page's H1[^\n]*a house icon[^\n]*one level up/);
  // As much as fits, from the end: a third choice that leaves the default and the two others as they were.
  for (const narrow of ['trail', 'parent', 'fit']) validateInputs(inputs({ breadcrumbs: { narrow } }));
  assert.throws(() => validateInputs(inputs({ breadcrumbs: { narrow: 'end' } })));
  assert.equal(breadcrumbProps({ ...defaults, narrow: 'fit' }, { name: 'Site' }).narrow, 'fit');
  assert.match(words({ narrow: 'fit' }), /On a phone \(a window of 40rem or less\) it keeps to one line and to its end[^\n]*an ellipsis \(…\) at the start edge[^\n]*with no script[^\n]*keyboard focus, the whole trail shows/);
  assert.match(words({}), /On a phone the whole trail wraps\./);
  assert.match(words({ show: false }), /Breadcrumb Navigation:\*\* none/);
});

// Where the line across the tabs stands (the owner, 2026-11-12): the design's, and written by the core, since a site
// writes the tabs' HTML itself.
test('a design says where the line across its tabs stands, and the core CSS carries it', () => {
  assert.deepEqual(defaultInputs().tabs, { 'rule-place': 'below' });
  assert.deepEqual(derive(inputs()).tabs, { 'rule-place': 'below' }, 'below unless told otherwise, as before');
  const above = derive(inputs({ tabs: { 'rule-place': 'above' } }));
  assert.deepEqual(above.tabs, { 'rule-place': 'above' });
  assert.throws(() => validateInputs(inputs({ tabs: { 'rule-place': 'middle' } })), /unsupported value/);
  assert.throws(() => validateInputs(inputs({ tabs: { rule: 'above' } })), /unknown property rule/);
  assert.match(coreCss(above), /^  --kn-tabs-rule-place: above;$/m);
  assert.match(coreCss(derive(inputs())), /^  --kn-tabs-rule-place: below;$/m);
  // A file resolved before the choice existed has no tabs, and its tabs keep the line below.
  const { tabs, ...before } = above;
  assert.match(coreCss(before), /^  --kn-tabs-rule-place: below;$/m);
});

test('a design says how its hero opens a page', () => {
  const defaults = defaultInputs().hero;
  assert.deepEqual(defaults, { picture: 'behind', surface: 'none', overlay: 'dark', height: 'two-thirds', place: 'bottom', align: 'start', type: 'heading-1', h1: 'hero' });
  assert.equal(derive(inputs({ hero: { height: 'half' } })).hero.height, 'half');
  assert.equal(derive(inputs({ hero: { height: 'half' } })).hero.place, 'bottom', 'what is left out keeps its default');
  assert.throws(() => validateInputs(inputs({ hero: { height: 'quarter' } })));
  for (const picture of ['none', 'behind', 'start', 'end', 'start-bleed', 'end-bleed']) validateInputs(inputs({ hero: { picture } }));
  for (const place of ['top', 'center', 'bottom']) validateInputs(inputs({ hero: { place } }));
  for (const align of ['start', 'center', 'end']) validateInputs(inputs({ hero: { align } }));
  assert.throws(() => validateInputs(inputs({ hero: { picture: 'beside' } })), 'the old value is gone, with no way round it');
  assert.throws(() => validateInputs(inputs({ hero: { place: 'left' } })));
  assert.throws(() => validateInputs(inputs({ hero: { align: 'left' } })));
  assert.equal(defaults.h1, 'hero', 'the page\'s H1 stands in the hero unless told otherwise');
  validateInputs(inputs({ hero: { h1: 'below' } }));
  assert.equal(derive(inputs({ hero: { h1: 'below' } })).hero.h1, 'below');
  assert.throws(() => validateInputs(inputs({ hero: { h1: 'above' } })), /unsupported value/);
  const images = { hero: '/behind.webp', landscapes: ['/beside.webp'] };
  assert.deepEqual(heroProps(defaults, images), { level: 1, surface: 'picture-dark', picture: '/behind.webp', side: undefined, alt: undefined, type: 'heading-1', height: 'two-thirds', place: 'bottom', align: 'start' });
  for (const side of ['start', 'end', 'start-bleed', 'end-bleed']) {
    const beside = heroProps({ ...defaults, picture: side, surface: 'brand' }, images);
    assert.deepEqual([beside.surface, beside.picture, beside.side, beside.alt], ['brand', '/beside.webp', side, '']);
  }
  const plain = heroProps({ ...defaults, picture: 'none' }, images);
  assert.deepEqual([plain.surface, plain.picture, plain.side], [undefined, undefined, undefined]);
  assert.equal(heroProps({ ...defaults, height: 'third' }, images).place, 'bottom', 'at a third the place is honoured like everywhere else');
  const words = (hero) => designMd({ inputs: settings(), project: { name: 'Name' }, resolved: derive(inputs({ hero })) }, 'name.design.json');
  assert.match(words({}), /\*\*Hero:\*\* by default a picture behind the text, under a dark overlay, taking two thirds of the screen, with its text at the bottom/);
  assert.match(words({ picture: 'end', surface: 'tint', height: 'third', place: 'top', type: 'display' }), /a picture at the inline end, inside the content width, with the text opposite, on the tint Surface, taking a third of the screen, with its text at the top and its heading in the display style/);
  assert.match(words({ picture: 'start-bleed' }), /a picture at the inline start, bleeding to the window's edge and the hero's top and bottom, with the text opposite, on no background of its own/);
  assert.match(words({ picture: 'none', place: 'center', align: 'center' }), /no background of its own, taking two thirds of the screen, with its text in the middle, in the centre of the content width/);
  assert.match(words({}), /The page's H1 is the hero's heading, with the trail first in its text, above the eyebrow, and the next section's heading is an H2\./);
  assert.match(words({ h1: 'below', type: 'display' }), /its heading in the display style\. The page's H1 stands under the hero: first in the next section, with the trail directly above it, in the first heading style\. The hero's text keeps its look as a plain paragraph/);
});
