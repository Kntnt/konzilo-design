// The checks a site names under `componentChecks` (src/directives/checks.js): componentProblems() on the Konzilo core's
// body model of a directive's blocks, each refusal in the editor's words and each pass. The model's shapes are the core's
// (its src/format/body.js), written out here; test/konzilo-build.test.js runs them through the core where it is at hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { componentProblems } from '../src/directives/checks.js';

const text = (value) => ({ type: 'text', value });
const inline = (parts) => parts.map((part) => (typeof part === 'string' ? text(part) : part));
const p = (...parts) => ({ type: 'paragraph', children: inline(parts) });
const h = (level, ...parts) => ({ type: 'heading', level, anchor: null, children: inline(parts) });
const a = (href, ...parts) => ({ type: 'link', href, target: null, rel: null, children: inline(parts) });
const strong = (...parts) => ({ type: 'strong', children: inline(parts) });
const image = (alt) => ({ type: 'image', alt, src: '../media/example.webp', caption: null });
const item = (parts, sub) => ({ checked: null, children: inline([].concat(parts)), list: sub ?? null });
const list = (...items) => ({ type: 'list', ordered: false, items });
const directive = (name, attributes = {}, children = []) => ({ type: 'directive', element: name === 'list' ? 'list-directive' : name, name, attributes, children });
const none = (name, attributes, blocks) => assert.deepEqual(componentProblems(name, attributes, blocks), [], `${name} passes`);
const refused = (name, attributes, blocks, words) => {
  const reasons = componentProblems(name, attributes, blocks);
  assert.ok(reasons.some((reason) => words.test(reason)), `${name}: ${JSON.stringify(reasons)} names ${words}`);
};

test('a component of a site\'s own, a leaf and a section with a post list and a form in it pass', () => {
  none('a-site-own', {}, [directive('form', { name: 'contact' })]);
  for (const name of ['eyebrow', 'small', 'breadcrumbs']) none(name, {}, []);
  none('section', { surface: 'tint' }, [h(2, 'Latest'), directive('post-list', { type: 'article', presentation: 'cards' }), directive('form', { name: 'contact' }), directive('a-site-own')]);
});

test('an opening holds no heading, no gallery and at most two pictures', () => {
  none('hero', {}, [directive('breadcrumbs'), image('A logo'), directive('eyebrow'), p('A deck.'), directive('list', { type: 'actions' }, [list(item(strong(a('/go/', 'Go'))))]), directive('small'), image('A picture')]);
  refused('hero', {}, [h(2, 'A heading'), p('Words.')], /holds no heading of its own: it shows the post's title/);
  refused('hero', {}, [image('One'), p('Words.'), image('Two'), image('Three')], /at most two pictures, a logo before its text and its picture last, and this holds 3/);
  refused('hero', {}, [{ type: 'gallery', images: [image('One'), image('Two')], caption: null }], /A gallery cannot stand in it/);
});

test('a section in columns pairs one cards post list with a plain quotation, after its head', () => {
  const quote = { type: 'quote', children: [p('We stop to see what has grown.')] };
  const posts = directive('post-list', { type: 'article', number: 1, presentation: 'cards' });
  const head = [directive('eyebrow'), h(2, 'A shared garden'), p('How it grew.'), directive('list', { type: 'actions' }, [list(item(a('/garden/', 'Visit')))])];
  none('section', { body: 'columns' }, [...head, posts, quote]);
  none('section', { body: 'columns' }, [...head, quote, posts]);
  none('section', { body: 'columns' }, [posts, quote]);
  none('section', { body: 'columns' }, [image('The garden'), ...head, posts, quote]);
  for (const body of [[], [posts], [quote], [quote, quote], [posts, posts], [posts, quote, p('An extra block.')], [directive('post-list', { presentation: 'featured' }), quote], [directive('post-list'), quote], [directive('cards', {}, [h(3, 'One')]), quote], [directive('form'), quote]]) {
    refused('section', { body: 'columns' }, [...head, ...body], /one post list with presentation="cards" and one quotation, in either order, after its head/);
  }
  // With no arrangement chosen the body keeps taking any blocks the core can draw.
  none('section', {}, [...head, posts, quote, p('An extra block.')]);
});

test('an item cannot hold a post list, a form or a site\'s own component until the core can draw them there, but a picture and the package\'s own parts', () => {
  for (const [name, part] of [['cards', 'Cards'], ['accordion', 'An accordion'], ['tabs', 'Tabs'], ['toc', 'A table of contents'], ['choice', 'A choice'], ['aside', 'A fact box'], ['hero', 'An opening']]) {
    const blocks = [h(3, 'One'), directive('form', { name: 'contact' }), h(3, 'Two'), directive('post-list', { type: 'article' }), directive('timeline-of-our-own')];
    const reasons = componentProblems(name, {}, blocks);
    assert.ok(reasons.includes(`${part} cannot hold a form yet, since only a section can hold one directly: put it in a section of its own.`), name);
    assert.ok(reasons.includes(`${part} cannot hold a post list yet, since only a section can hold one directly: put it in a section of its own.`), name);
    assert.ok(reasons.includes(`${part} cannot hold the component timeline-of-our-own yet, since only a section can hold one directly: put it in a section of its own.`), name);
  }
  none('tabs', {}, [h(3, 'One'), image('A picture'), directive('accordion', {}, [h(4, 'Q'), p('A')]), h(3, 'Two'), directive('list', { type: 'values' }, [list(item('A label', list(item('A value'))))])]);
});

test('a styled list holds one Markdown list, of the form its type asks', () => {
  refused('list', {}, [p('Only words.')], /holds one Markdown list, and this holds none/);
  refused('list', {}, [list(item('One')), list(item('Two'))], /holds one Markdown list, and this holds 2/);
  none('list', { markers: 'v' }, [p('An intro.'), list(item('One')), p('An outro.')]);
  // Actions: each a link alone, the main one in bold, at most one.
  none('list', { type: 'actions' }, [list(item(strong(a('/one/', 'One'))), item(a('/two/', 'Two')))]);
  refused('list', { type: 'actions' }, [list(item(['See ', a('/one/', 'one')]))], /is one link and nothing else, in bold for the main action, and “See one” is not/);
  refused('list', { type: 'actions' }, [list(item(strong(a('/one/', 'One'))), item(strong(a('/two/', 'Two'))))], /at most one main action, the one link in bold, and this has 2/);
  refused('list', { type: 'actions' }, [list(item(a('/one/', 'One'), list(item('Below'))))], /is one link and nothing else/);
  // Values and descriptions: each with its value or description under it.
  none('list', { type: 'values' }, [list(item('Opening hours', list(item('8–17'))))]);
  refused('list', { type: 'values' }, [list(item('Opening hours'))], /Each label in a styled list of values has its value under it, as a list inside the item, and “Opening hours” has none/);
  refused('list', { type: 'description' }, [list(item('A term'))], /Each term in a styled list of descriptions has its description under it/);
  // Logos: a picture, or a picture that is a link.
  none('list', { type: 'logos' }, [p('Trusted by'), list(item(image('A name')), item(a('https://example.com/', image('Another'))))]);
  refused('list', { type: 'logos' }, [list(item('A name'))], /Each logo in a styled list of logos is one picture, or one picture that is a link, and “A name” is not/);
});

test('a form begins its items at headings: cards, an accordion, tabs, a table of contents and a choice', () => {
  refused('cards', {}, [p('Only words.')], /Cards begin at their headings, each card at one, and these have none/);
  refused('accordion', {}, [p('Only words.')], /An accordion's items begin at their headings/);
  refused('tabs', {}, [], /Tabs begin at their headings/);
  refused('toc', {}, [p('A label')], /A table of contents lists the headings that follow its label, and this has none/);
  refused('choice', {}, [p('A question?')], /A choice's answers begin at their headings/);
  refused('choice', {}, [p('A question?'), h(3, 'Yes'), p('Then.')], /A choice offers at least two answers, each at a heading, and this offers one/);
  none('choice', {}, [p('A question?'), h(3, 'Yes'), h(4, 'Then'), p('Words.'), h(3, 'No')]);
  // A table of contents takes its label alone before its first heading.
  none('toc', {}, [p('In depth'), h(3, 'One'), h(3, 'Two')]);
  refused('toc', {}, [p('In depth'), p('More words'), h(3, 'One')], /takes one paragraph before its first heading, its label, and nothing else there/);
  refused('toc', {}, [list(item('One')), h(3, 'One')], /takes one paragraph before its first heading/);
});

test('cards: those that lead on are links as a whole, symbols need pictures, and steps take no picture or symbol', () => {
  none('cards', { type: 'navigation' }, [p('Where next'), h(3, a('/a/', 'A page')), p('Its text.'), h(3, a('/b/', 'Another'))]);
  refused('cards', { type: 'navigation' }, [h(3, 'A page'), p('Its text.')], /has a link for its whole heading, and the card “A page” has not/);
  refused('cards', { type: 'navigation' }, [h(3, a('/a/', 'A'), ' and more'), p('Its text.')], /has a link for its whole heading, and the card “A and more” has not/);
  refused('cards', { type: 'navigation' }, [h(3, a('/a/', 'A page')), p('See ', a('/b/', 'also'))], /has its heading as its only link, and the card “A page” has another/);
  // A symbol for every card, written before its heading or after it.
  none('cards', { symbol: 'item' }, [h(3, 'One'), image('One'), h(3, 'Two'), image('Two')]);
  none('cards', { symbol: 'heading' }, [image('One'), h(3, 'One'), p('Text.'), image('Two'), h(3, 'Two')]);
  refused('cards', { symbol: 'item' }, [h(3, 'One'), image('One'), h(3, 'Two'), p('Text.')], /shows its picture as a symbol here, and the card “Two” has no picture/);
  refused('cards', { markers: '1', picture: 'behind' }, [h(3, 'One')], /Numbered cards are drawn as steps, which take no picture behind and no symbol/);
  refused('cards', { markers: 'a)', symbol: 'item' }, [h(3, 'One'), image('One')], /Numbered cards are drawn as steps/);
  none('cards', { markers: 'v', symbol: 'item' }, [h(3, 'One'), image('One')]);
});

test('the checks take what the core gives them and nothing more', () => {
  assert.deepEqual(componentProblems('cards'), ['Cards begin at their headings, each card at one, and these have none.']);
  assert.deepEqual(componentProblems('list', undefined, undefined), ['A styled list holds one Markdown list, and this holds none.']);
});
