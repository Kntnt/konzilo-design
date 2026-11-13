// The directive components' renderer (src/directives/render/): each directive's Markdown, read as the Konzilo core reads
// it into the tree it hands a component, drawn as docs/spec/directives.md writes it, the marks of the live preview kept,
// ids unique, Surfaces by their ground, a section's body taken from its slot as the core draws it. The core itself is not
// read here (test/helpers/konzilo-body.js models it); test/konzilo-build.test.js builds with the real core where it is at hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToHast } from 'satteri';
import { bodyHtml, renderBody, renderMarkdown, testDesign, treeOf } from './helpers/konzilo-body.js';
import { render } from './helpers/render.js';
import { pageContext, designPage, contextOf } from '../src/directives/render/context.js';
import { DIRECTIVES, bodyFromSlot, groupEyebrows, renderDirective, withMark } from '../src/directives/render/render.js';
import { toHtml } from '../src/directives/render/html.js';
import { topElements } from '../src/directives/render/scan.js';
import { iconHtml } from '../src/directives/icons.js';
import components from '../src/directives/components.json' with { type: 'json' };

const md = String.raw;
// The core's levels, the page's own hidden, as a type's setting leaves it by default.
const TRAIL = [{ name: 'Home', href: '/' }, { name: 'Guides', href: '/guides/' }, { name: 'Planning a garden', href: '/guides/planning/', hidden: true }];
// HTML without the white space Astro leaves between a body's blocks.
const tight = (html) => html.replace(/>\s+</g, '><').trim();
const unmarked = (html) => html.replace(/ data-konzilo-block="[^"]*"/g, '');
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
// A body's Markdown drawn as a page draws it, with the page's context.
const page = (markdown, options = {}) => renderMarkdown(markdown, { breadcrumbs: TRAIL, ...options });
// A part of the page's HTML, from the first element of a class to its end.
function part(html, selector) {
  const element = topElementsDeep(html).find((one) => (one.attributes.class ?? '').split(/\s+/).includes(selector));
  assert.ok(element, `no .${selector} in ${html.slice(0, 200)}`);
  return html.slice(element.start, element.end);
}
function topElementsDeep(html, offset = 0) {
  return topElements(html).flatMap((element) => {
    const inner = html.slice(element.open.end, element.end - element.name.length - 3);
    return [{ ...element, start: element.start + offset, end: element.end + offset }, ...topElementsDeep(inner, offset + element.open.end)];
  });
}

test('the renderer draws the twelve directives components.json declares, and no other', () => {
  assert.deepEqual([...DIRECTIVES].sort(), Object.keys(components).sort());
  const ctx = pageContext({ design: testDesign(), title: 'A title' });
  assert.throws(() => renderDirective('post-list', {}, { type: 'root', children: [] }, ctx), /draws no directive post-list/);
});

test('the serialiser writes the core\'s tree as HTML: classes, labels, data and aria, booleans, SVG, void elements, a template\'s content and escaping', () => {
  const html = '<p class="a b" data-konzilo-block="1.2" aria-label="x &amp; y" tabindex="0">A &lt;b&gt; &amp; <b>c</b><br>d</p><label for="q">L</label><details open name="n"><summary>S</summary></details><svg viewBox="0 0 24 24" stroke-width="2" class="i"><path d="M1"></path></svg><template><iframe src="https://example.com/e" allowfullscreen title="v"></iframe></template><img src="a.webp" srcset="a.webp 1x, b.webp 2x" sizes="100vw" width="10" height="20" loading="lazy" decoding="async" alt=""><input type="checkbox" checked disabled><a href="x" rel="prev next">A</a>';
  const written = toHtml(htmlToHast(html, { fragment: true }));
  assert.equal(written, '<p class="a b" data-konzilo-block="1.2" aria-label="x &amp; y" tabindex="0">A &lt;b&gt; &amp; <b>c</b><br>d</p><label for="q">L</label><details open name="n"><summary>S</summary></details><svg viewBox="0 0 24 24" stroke-width="2" class="i"><path d="M1"></path></svg><template><iframe src="https://example.com/e" allowfullscreen title="v"></iframe></template><img src="a.webp" srcset="a.webp 1x, b.webp 2x" sizes="100vw" width="10" height="20" loading="lazy" decoding="async" alt><input type="checkbox" checked disabled><a href="x" rel="prev next">A</a>');
  // hast's own form of a template, its content apart, is written too.
  assert.equal(toHtml({ type: 'element', tagName: 'template', properties: {}, children: [], content: { type: 'root', children: [{ type: 'text', value: 'kept' }] } }), '<template>kept</template>');
});

test('a hero draws the post\'s title, its trail, logo, eyebrow, deck, actions and small print, and its picture by the design', () => {
  const markdown = md`::::hero{surface="tint"}

::breadcrumbs

![Example Gardens](/media/logo.svg)

::eyebrow[A guide]

Start small and let the beds **widen** year by year.

:::list{type="actions"}

- **[Get started](/start/)**
- [Read more](/more/)

:::

::small[Free for the first month.]

![Raised beds in the spring](/media/beds.webp)

::::`;
  const beside = page(markdown, { design: testDesign({ hero: { picture: 'end', h1: 'hero', type: 'heading-1', height: 'two-thirds', place: 'center', align: 'start' } }) });
  assert.equal(tight(unmarked(beside).replace(iconHtml('house', 'kn-breadcrumbs-house'), '<house>')), [
    '<section class="kn-band kn-hero" data-kn-surface="tint" data-kn-picture="end" data-kn-height="two-thirds"><div class="kn-band-content kn-hero-content"><div class="kn-hero-text">',
    '<nav class="kn-breadcrumbs" aria-label="Breadcrumb" data-kn-type="small" data-kn-separator="slash" data-kn-home="word" data-kn-current="true" data-kn-narrow="trail"><ol role="list"><li><a href="/"><house><span class="kn-breadcrumbs-label">Home</span></a></li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><a href="/guides/"><span class="kn-breadcrumbs-label">Guides</span></a></li><li><span class="kn-breadcrumbs-separator" aria-hidden="true"></span><span aria-current="page">Planning a garden</span></li></ol></nav>',
    '<img class="kn-hero-logo" src="/media/logo.svg" alt="Example Gardens" loading="eager">',
    '<hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">A guide</p><h1 class="kn-heading-group-heading" data-kn-type="heading-1">Planning a garden</h1><p class="kn-heading-group-deck" data-kn-type="lead">Start small and let the beds <strong>widen</strong> year by year.</p></hgroup>',
    '<ul class="kn-actions" role="list"><li><a class="kn-action" href="/start/" data-kn-main>Get started</a></li><li><a class="kn-action" href="/more/">Read more</a></li></ul>',
    '<p class="kn-fine-print" data-kn-type="small">Free for the first month.</p>',
    '</div><div class="kn-hero-media"><img src="/media/beds.webp" alt="Raised beds in the spring" loading="eager"></div></div></section>',
  ].join(''));

  // The design's picture behind: the picture's Surface for both, its picture on the band.
  const behind = page(markdown, { design: testDesign({ hero: { picture: 'behind', overlay: 'dark' } }) });
  assert.match(behind, /^<section class="kn-band kn-hero" data-kn-surface="picture-dark"[^>]* style="--kn-picture-image:url\(&quot;\/media\/beds\.webp&quot;\)">/);
  assert.doesNotMatch(behind, /kn-hero-media/);
  // Left out, the surface is the design's; the design's none is no Surface at all.
  const own = md`::::hero

Words.

::::`;
  assert.match(page(own, { design: testDesign({ hero: { surface: 'raised', picture: 'none' } }) }), /^<section class="kn-band kn-hero" data-kn-surface="raised"/);
  assert.match(page(own, { design: testDesign({ hero: { surface: 'none', picture: 'none' } }) }), /^<section class="kn-band kn-hero"(?! data-kn-surface)/);
  assert.doesNotMatch(page(md`::::hero{surface="page"}

Words.

::::`), /data-kn-surface/);
  // A design with no side for the picture puts it at Hero's default side, since chosen content is never dropped.
  assert.match(page(markdown, { design: testDesign({ hero: { picture: 'none' } }) }), /data-kn-picture="end"/);
  // The H1 under the hero: the hero's heading is a plain paragraph in a plain block.
  assert.match(page(own, { design: testDesign({ hero: { h1: 'below', type: 'display', picture: 'none' } }) }), /<div class="kn-heading-group"><p class="kn-heading-group-heading" data-kn-type="display">Planning a garden<\/p><p class="kn-heading-group-deck" data-kn-type="lead">Words\.<\/p><\/div>/);
  // A hero needs the post's title, which only the page's template knows.
  assert.throws(() => renderMarkdown(own, { title: undefined }), /designPage\(Astro, \{ title \}\)/);
});

test('a section draws its media, its head and its body by the six rules\' groups, and its own id wins over its heading\'s', () => {
  const html = page(md`:::::section{surface="tint" anchor="plans"}

![A shed with tools](/media/shed.webp)

![Award one](/media/award-1.svg)

![Award two](/media/award-2.svg)

::eyebrow[Tools]

## Plans

Everything in one shed, the tools, the seeds and the soil, delivered at once to your door in spring.

:::list{type="actions"}

- **[See the plans](/plans/)**

:::

Each shed holds what a garden of its size needs.

::::cards

### Small

For a balcony.

### Large

For an acre.

::::

:::::`);
  assert.equal(tight(html), [
    '<section class="kn-band kn-section" id="plans" data-kn-surface="tint"><div class="kn-band-content">',
    '<div class="kn-section-media"><img class="kn-section-picture" src="/media/shed.webp" alt="A shed with tools"><ul class="kn-section-badges" role="list"><li><img src="/media/award-1.svg" alt="Award one"></li><li><img src="/media/award-2.svg" alt="Award two"></li></ul></div>',
    '<header class="kn-section-head"><hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">Tools</p><h2 class="kn-heading-group-heading" data-kn-type="heading-2">Plans</h2><p class="kn-heading-group-deck" data-kn-type="lead" data-kn-deck="long">Everything in one shed, the tools, the seeds and the soil, delivered at once to your door in spring.</p></hgroup><ul class="kn-actions" role="list"><li><a class="kn-action" href="/plans/" data-kn-main>See the plans</a></li></ul></header>',
    '<div class="kn-section-body kn-body-text"><p>Each shed holds what a garden of its size needs.</p><div class="kn-card-grid kn-cards"><article class="kn-card"><h3 class="kn-card-heading" data-kn-type="heading-5" id="small">Small</h3><p class="kn-card-text" data-kn-type="small">For a balcony.</p></article><article class="kn-card"><h3 class="kn-card-heading" data-kn-type="heading-5" id="large">Large</h3><p class="kn-card-text" data-kn-type="small">For an acre.</p></article></div></div>',
    '</div></section>',
  ].join(''));
  // No head without its heading; eyebrows then are labels in the body.
  const loose = page(md`:::section

::eyebrow[Note]

Words only.

:::`);
  assert.equal(tight(loose), '<section class="kn-band kn-section"><div class="kn-band-content"><div class="kn-section-body kn-body-text"><p data-kn-type="label">Note</p><p>Words only.</p></div></div></section>');
});

test('a section takes its body from its slot after the elements the core drew for its media and head: a figure with its dialog, eyebrows, the heading, the deck and actions', () => {
  const markdown = md`:::::section

![A shed](/media/shed.webp)

::eyebrow[Plans]

## Plans

::::list{type="actions"}

Where to go

- **[See the plans](/plans/)**

Or write to us.

::::

::post-list{type="article" presentation="cards"}

::form{name="contact"}

![A bed](/media/bed.webp)

:::::`;
  const html = page(markdown);
  const body = part(html, 'kn-section-body');
  // The body holds what the core drew, the post list, the form and a picture with its lightbox, and nothing of the head.
  assert.match(body, /^<div class="kn-section-body kn-body-text"><div class="test-post-list" data-presentation="cards"><\/div>\n?<form class="konzilo-form" data-name="contact"><\/form>\n?<figure><img src="\/media\/bed\.webp" alt="A bed"><\/figure><dialog class="konzilo-modal konzilo-lightbox"/);
  assert.doesNotMatch(body, /Plans|Where to go|Or write to us|shed\.webp/);
  // The intro and outro of the head's actions stand in the head, drawn from the tree.
  assert.match(part(html, 'kn-section-head'), /<p data-kn-type="label">Where to go<\/p><ul class="kn-actions"[^>]*>.*<\/ul><p>Or write to us\.<\/p>/);
  // The same in the live preview, where the marks find the body's first block, and the same page less the marks.
  const preview = page(markdown, { preview: true });
  assert.equal(unmarked(preview), html);
  assert.match(part(preview, 'kn-section-body'), /^<div class="kn-section-body kn-body-text"><div class="test-post-list" data-konzilo-block="0\.4"/);
});

test('bodyFromSlot counts the core\'s elements where no marks are, and finds the first block\'s mark where they are', () => {
  const ctx = pageContext({ design: testDesign(), title: 'T' });
  const tree = htmlToHast('<figure><img src="a.webp" alt="A"></figure><h2 id="h">H</h2><p>Rest</p>', { fragment: true }).children;
  const slot = '<figure><button><img src="a.webp" alt="A"></button></figure><dialog></dialog>\n<h2 id="h">H</h2>\n<p>Rest</p>';
  assert.equal(bodyFromSlot(slot, tree, 2, ctx), '<p>Rest</p>');
  assert.equal(bodyFromSlot(slot, tree, 3, ctx), '');
  const marked = htmlToHast('<figure data-konzilo-block="1.0"><img src="a.webp" alt="A"></figure><h2 data-konzilo-block="1.1">H</h2><p data-konzilo-block="1.2">Rest</p>', { fragment: true }).children;
  // A site's form component of two roots in the head's place cannot shift the cut where the marks are.
  assert.equal(bodyFromSlot('<p class="extra"></p><figure data-konzilo-block="1.0"></figure><dialog></dialog><h2 data-konzilo-block="1.1">H</h2><p data-konzilo-block="1.2">Rest</p>', marked, 2, ctx), '<p data-konzilo-block="1.2">Rest</p>');
});

test('in a body the core drew, eyebrows right before a heading join it in a heading group, and a list\'s label does not', () => {
  assert.equal(groupEyebrows('<p data-kn-type="label">One</p>\n<p data-kn-type="label" data-konzilo-block="2">Two</p>\n<h3 id="x">Heading</h3><p data-kn-type="label">Intro</p><dl></dl>'),
    '<hgroup class="kn-heading-group"><p class="kn-heading-group-eyebrow" data-kn-type="label">One</p><p class="kn-heading-group-eyebrow" data-kn-type="label" data-konzilo-block="2">Two</p><h3 class="kn-heading-group-heading" id="x">Heading</h3></hgroup><p data-kn-type="label">Intro</p><dl></dl>');
  assert.equal(groupEyebrows('<p data-kn-type="label">Alone</p><p>Text</p>'), '<p data-kn-type="label">Alone</p><p>Text</p>');
});

test('an aside is a fact box on its plate, with its label, its small heading and its anchor', () => {
  const html = page(md`:::aside{anchor="in-short"}

::eyebrow[In short]

### In short

- Water early.
- Mulch.

:::`);
  assert.equal(part(html, 'kn-fact-box'), '<aside class="kn-fact-box" id="in-short" data-kn-surface="tint"><p class="kn-fact-box-label" data-kn-type="label">In short</p><h3 class="kn-fact-box-heading" data-kn-type="heading-5">In short</h3><ul>\n<li>Water early.</li>\n<li>Mulch.</li>\n</ul></aside>');
  // Within a part drawn from its tree, a plate stands on the plate around it: a fact box on a tinted plate takes the
  // raised one, and a card that is a link on a raised answer the page's. What the core draws in a section's slot finds its
  // ground by CSS (docs/spec/plates.md).
  assert.match(page(md`::::choice

### One

:::aside

Facts.

:::

### Two

:::cards

### [A page](/a/)

:::

::::`), /<div class="kn-choice-panel" data-kn-surface="raised"><aside class="kn-fact-box" data-kn-surface="tint">.*<div class="kn-choice-panel" data-kn-surface="raised"><div class="kn-card-grid kn-cards"><article class="kn-card" data-kn-surface="page">/s);
});

test('a list is drawn by its type: markers, description, values, logos and actions with a known service', () => {
  assert.match(page(md`:::list{markers="1./a)"}

1. First
   1. A sub-item

:::`), /<ol data-kn-numbering="decimal" data-kn-punctuation="period">\n<li>First\n<ol data-kn-numbering="lower-latin" data-kn-punctuation="parenthesis">/);
  assert.match(page(md`:::list{markers="v"}

- Included

:::`), /<ul data-kn-sign="check">/);
  assert.match(page(md`:::list{type="description"}

Words we use

- A term
  - What it means.
  - What else it means.

:::`), /<p data-kn-type="label">Words we use<\/p><dl class="kn-description-list"><div class="kn-description-list-item"><dt data-kn-type="heading-6">A term<\/dt><dd>What it means\.<\/dd><dd>What else it means\.<\/dd><\/div><\/dl>/);
  assert.match(page(md`:::list{type="values"}

- Opening hours
  - 8–17
- Write
  - [hello@gardens.example](mailto:hello@gardens.example)

:::`), /<dl class="kn-value-list"><div class="kn-value-list-item"><dt data-kn-type="small">Opening hours<\/dt><dd class="kn-value-list-value">8–17<\/dd><\/div><div class="kn-value-list-item"><dt data-kn-type="small">Write<\/dt><dd class="kn-value-list-value"><a href="mailto:hello@gardens\.example" data-kn-contact="email">hello@<wbr>gardens<wbr>\.example<\/a><\/dd><\/div><\/dl>/);
  const logos = page(md`:::list{type="logos"}

Trusted by

- ![A name](/media/a.svg)
- [![Another name](/media/b.svg)](https://b.example/)

:::`);
  assert.match(logos, /<div class="kn-logos"><p class="kn-logos-label" id="logos-1" data-kn-type="label">Trusted by<\/p><ul class="kn-logos-list" role="list" aria-labelledby="logos-1"><li><img src="\/media\/a\.svg" alt="A name"><\/li><li><a href="https:\/\/b\.example\/"><img src="\/media\/b\.svg" alt="Another name"><\/a><\/li><\/ul><\/div>/);
  assert.match(page(md`:::list{type="actions"}

- [LinkedIn](https://www.linkedin.com/company/example)

:::`), new RegExp(`<a class="kn-action" href="https://www\\.linkedin\\.com/company/example" data-kn-service="linkedin">${iconHtml('linkedin').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<span class="kn-action-label">LinkedIn</span></a>`));
});

test('cards: open, a link as a whole, an action card, a number and an address, steps, reasons, navigation, behind and symbols', () => {
  const html = page(md`::::cards

### [A page](/a/)

![A picture](/media/a.webp)

::eyebrow[An eyebrow]

Its text.

### An office

12 Example Street

[+44 20 7946 0000](tel:+442079460000)

### Something else?

Ask us.

:::list{type="actions"}

- **[Write](/write/)**

:::

::::`);
  // Loose at the top of a body, as here, the series stands alone; the page's template puts it in a band.
  assert.equal(tight(html), [
    '<div class="kn-card-grid kn-cards">',
    '<article class="kn-card" data-kn-surface="raised"><img class="kn-card-picture" src="/media/a.webp" alt="A picture"><p class="kn-card-eyebrow" data-kn-type="label">An eyebrow</p><h3 class="kn-card-heading" data-kn-type="heading-5" id="a-page"><a class="kn-card-link" href="/a/">A page</a></h3><p class="kn-card-text" data-kn-type="small">Its text.</p></article>',
    '<article class="kn-card"><h3 class="kn-card-heading" data-kn-type="heading-5" id="an-office">An office</h3><p class="kn-card-text" data-kn-type="small">12 Example Street</p><p class="kn-card-text" data-kn-type="small"><a href="tel:+442079460000" data-kn-contact="phone">+44 20 7946 0000</a></p></article>',
    '<article class="kn-card" data-kn-surface="tint"><h3 class="kn-card-heading" data-kn-type="heading-5" id="something-else">Something else?</h3><p class="kn-card-text" data-kn-type="small">Ask us.</p><ul class="kn-actions" role="list"><li><a class="kn-action" href="/write/" data-kn-main>Write</a></li></ul></article>',
    '</div>',
  ].join(''));
  assert.match(page(md`::::cards{markers="A."}

### We talk

Over coffee.

### We plant

::::`), /<ol class="kn-timeline" data-kn-numbering="upper-latin" data-kn-punctuation="period"><li class="kn-timeline-item"><h3 class="kn-timeline-heading" data-kn-type="heading-5" id="we-talk">We talk<\/h3><p>Over coffee\.<\/p><\/li>/);
  assert.match(page(md`::::cards{markers="x"}

### A reason

::::`), /<ul class="kn-reasons" role="list" data-kn-sign="cross"><li class="kn-reason"><h3 class="kn-reason-heading" data-kn-type="heading-5" id="a-reason">A reason<\/h3><\/li><\/ul>/);
  const navigation = page(md`::::cards{type="navigation"}

Where next

### [A page](/a/)

Its text.

::::`);
  assert.match(navigation, new RegExp(`<nav class="kn-cards-nav" aria-labelledby="navigation-1"><div class="kn-cards-label" id="navigation-1"><p data-kn-type="label">Where next</p></div><ul class="kn-card-grid kn-cards" role="list"><li><article class="kn-card" data-kn-variant="link" data-kn-surface="raised">.*${iconHtml('arrow-right', 'kn-card-arrow').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</article></li></ul></nav>`));
  assert.match(page(md`::::cards{picture="behind"}

### [A page](/a/)

![A picture](/media/a.webp)

### No picture

::::`), /<div class="kn-card-grid kn-cards" data-kn-picture="behind"><article class="kn-card" data-kn-surface="picture-dark"><img class="kn-card-picture"[^>]*>.*<article class="kn-card"><h3/);
  const symbols = page(md`::::cards{symbol="heading"}

### A heading

![A symbol](/media/s.svg)

::::`);
  assert.match(symbols, /<div class="kn-card-grid kn-cards" data-kn-symbol="heading"><article class="kn-card"><h3 class="kn-card-heading" data-kn-type="heading-5" id="a-heading"><span class="kn-card-symbol"><img src="\/media\/s\.svg" alt><\/span>A heading<\/h3><\/article>/);
  assert.match(page(md`::::cards{symbol="item" markers="v"}

### A heading

![A symbol](/media/s.svg)

::::`), /<div class="kn-card-grid kn-cards" data-kn-sign="check" data-kn-symbol="item"><article class="kn-card"><span class="kn-card-symbol"><img src="\/media\/s\.svg" alt><\/span><h3/);
});

test('a card\'s picture and eyebrow are its own written before its heading or after it', () => {
  const card = (html) => [...html.matchAll(/<article class="kn-card"[^>]*>(.*?)<\/article>/g)].map((match) => [...match[1].matchAll(/src="([^"]+)"|kn-card-eyebrow"[^>]*>([^<]+)|<h3[^>]*>(?:<a[^>]*>)?([^<]+)/g)].map((one) => one[1] ?? one[2] ?? one[3]).join(' '));
  const after = page(md`::::cards

### One

![One](/media/1.webp)

::eyebrow[First]

Text.

### Two

![Two](/media/2.webp)

::::`);
  const before = page(md`::::cards

![One](/media/1.webp)

::eyebrow[First]

### One

Text.

![Two](/media/2.webp)

### Two

::::`);
  assert.deepEqual(card(after), ['/media/1.webp First One', '/media/2.webp Two']);
  assert.deepEqual(card(before), card(after));
  // Cards with pictures before and none of text: the second picture is the second card's.
  assert.deepEqual(card(page(md`::::cards

![One](/media/1.webp)

### One

![Two](/media/2.webp)

### Two

::::`)), ['/media/1.webp One', '/media/2.webp Two']);
  // After, with a card whose picture is all it holds: the picture stays with its heading.
  assert.deepEqual(card(page(md`::::cards

### One

![One](/media/1.webp)

### Two

Text.

::::`)), ['/media/1.webp One', 'Two']);
});

test('an accordion, tabs, a choice and a table of contents, their ids unique on the page and headings raised under a tab and an answer', () => {
  const html = page(md`::::::section

:::::accordion{first="open" expand="one"}

### How long does it take?

A season.

### What does it cost?

Little.

:::::

:::::tabs

Our plans

### Small

A balcony.

#### What you get

::::accordion

#### A part

Inside.

::::

### Large

An acre.

:::::

:::::choice

Do you have a garden?

### Yes

#### Then plan it

Words.

### No

::form{name="contact"}

:::::

:::::toc

In depth

### The first part

Words.

### The second part

Words.

:::::

:::::accordion

### No question

Words.

:::::

::::::`);
  assert.match(html, /<div class="kn-accordion" data-kn-accordion-mode="single" data-kn-questions><details class="kn-accordion-item" name="accordion-1" open><summary class="kn-accordion-summary"><h3 class="kn-accordion-label" data-kn-type="heading-6" id="how-long-does-it-take">How long does it take\?<\/h3><svg class="kn-icon kn-accordion-chevron"[^>]*>.*?<\/svg><\/summary><div class="kn-body-text kn-accordion-content"><p>A season\.<\/p><\/div><\/details><details class="kn-accordion-item" name="accordion-1">/);
  assert.match(html, /<div class="kn-accordion" data-kn-accordion-mode="multiple"><details class="kn-accordion-item"><summary/);
  assert.match(html, /<div class="kn-tabs" role="group" aria-labelledby="tabs-1"><div class="kn-tabs-label" id="tabs-1"><p data-kn-type="label">Our plans<\/p><\/div><details class="kn-tabs-item" name="tabs-1" open><summary class="kn-tabs-tab">Small<\/summary><div class="kn-tabs-panel"><div class="kn-tabs-text"><p>A balcony\.<\/p><h3 id="what-you-get">What you get<\/h3><\/div><div class="kn-tabs-parts"><div class="kn-accordion" data-kn-accordion-mode="multiple"><details class="kn-accordion-item"><summary class="kn-accordion-summary"><h3 class="kn-accordion-label"/);
  assert.match(html, /<details class="kn-tabs-item" name="tabs-1"><summary class="kn-tabs-tab">Large<\/summary><div class="kn-tabs-panel"><p>An acre\.<\/p><\/div><\/details>/);
  assert.match(html, /<div class="kn-choice" role="group" aria-labelledby="choice-1"><div class="kn-choice-label" id="choice-1"><p>Do you have a garden\?<\/p><\/div><details class="kn-choice-item" name="choice-1"><summary class="kn-choice-answer" data-kn-surface="raised">Yes<\/summary><div class="kn-choice-panel" data-kn-surface="raised"><h3 id="then-plan-it">Then plan it<\/h3><p>Words\.<\/p><\/div><\/details><details class="kn-choice-item" name="choice-1"><summary class="kn-choice-answer" data-kn-surface="raised">No<\/summary><div class="kn-choice-panel"><div data-directive="form" data-name="contact"><\/div><\/div><\/details><\/div>/);
  assert.match(html, /<div class="kn-reading-area" data-kn-side="start" data-kn-stack="before"><div class="kn-reading-area-aside"><aside class="kn-aside-block" data-kn-sticky="true"><nav class="kn-toc" aria-labelledby="toc-1" data-kn-type="small" data-kn-follow><p class="kn-toc-label" id="toc-1" data-kn-type="heading-6">In depth<\/p><ol role="list"><li><a href="#the-first-part">The first part<\/a><\/li><li><a href="#the-second-part">The second part<\/a><\/li><\/ol><\/nav><\/aside><\/div><div class="kn-reading-area-flow"><h3 id="the-first-part">The first part<\/h3><p>Words\.<\/p><h3 id="the-second-part">The second part<\/h3><p>Words\.<\/p><\/div><\/div>/);
  const found = ids(html);
  assert.deepEqual(found, [...new Set(found)], 'every id once on the page');
  // A table of contents without a label is named in the site's words.
  assert.match(page(md`::::toc

### One

::::`, { words: { contents: 'Innehåll' } }), /<nav class="kn-toc" aria-label="Innehåll"/);
});

test('every block given a mark keeps it, and each part\'s own mark stands on its root where no block\'s does', () => {
  const markdown = md`::::::section{surface="raised"}

::eyebrow[A label]

## A heading

:::::cards

Cards

### [One](/one/)

![One](/media/1.webp)

Text.

:::::

::::tabs

### Tab

:::list{type="values"}

- Label
  - Value

:::

::::

:::::choice

### Yes

Words.

### No

Words.

:::::

::::::`;
  const html = page(markdown, { preview: true });
  const source = bodyHtml(markdown, { preview: true });
  const given = [...source.matchAll(/data-konzilo-block="([^"]+)"/g)].map((match) => match[1]);
  const kept = new Set([...html.matchAll(/data-konzilo-block="([^"]+)"/g)].map((match) => match[1]));
  // A list directive's own level has no element of its own but its list's, and its list's mark stands there.
  const levels = new Set(['0.3.1']);
  for (const mark of given) if (!levels.has(mark)) assert.ok(kept.has(mark), `the mark ${mark} is kept`);
  assert.match(html, /^<section data-konzilo-block="0" class="kn-band kn-section"/);
  assert.match(html, /<div data-konzilo-block="0\.2" class="kn-card-grid kn-cards">/);
  assert.match(html, /<summary class="kn-tabs-tab" data-konzilo-block="0\.3\.0">Tab<\/summary>/);
  assert.match(html, /<dl class="kn-value-list" data-konzilo-block="0\.3\.1\.0"><div class="kn-value-list-item" data-konzilo-block="0\.3\.1\.0\.0">/);
  assert.equal(unmarked(html), page(markdown));
  assert.equal(withMark('<script></script><p data-konzilo-block="1.0">A</p><ul></ul>', '1'), '<script></script><p data-konzilo-block="1.0">A</p><ul data-konzilo-block="1"></ul>');
  assert.equal(withMark('<p>A</p>', undefined), '<p>A</p>');
});

test('a part keeps what the core wrote of an image and an embed\'s player in its template', () => {
  const ctx = pageContext({ design: testDesign(), title: 'T' });
  const content = htmlToHast('<h3 id="one">One</h3><figure data-konzilo-block="2.1"><img src="/_astro/a.hash.webp" srcset="/_astro/a.400.webp 400w, /_astro/a.800.webp 800w" sizes="100vw" width="800" height="600" loading="lazy" decoding="async" alt="A bed"></figure><figure class="konzilo-embed" data-embed="youtube"><a href="https://www.youtube.com/watch?v=x">Watch</a><template><iframe src="https://www.youtube-nocookie.com/embed/x" title="A film" allowfullscreen></iframe></template></figure>', { fragment: true });
  const html = renderDirective('cards', {}, content, ctx);
  assert.match(html, /<img class="kn-card-picture" src="\/_astro\/a\.hash\.webp" srcset="\/_astro\/a\.400\.webp 400w, \/_astro\/a\.800\.webp 800w" sizes="100vw" width="800" height="600" loading="lazy" decoding="async" alt="A bed" data-konzilo-block="2\.1">/);
  assert.match(html, /<figure class="konzilo-embed" data-embed="youtube"><a href="https:\/\/www\.youtube\.com\/watch\?v=x">Watch<\/a><template><iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/x" title="A film" allowfullscreen><\/iframe><\/template><\/figure>/);
});

test('the text roles and the trail: an eyebrow alone, small print, and no trail where only the start page is left to show', () => {
  assert.match(page(md`::eyebrow[A label]

::small[A note.]`), /<p data-kn-type="label">A label<\/p>\n?<p class="kn-fine-print" data-kn-type="small">A note\.<\/p>/);
  assert.match(page('::breadcrumbs'), /<nav class="kn-breadcrumbs"/);
  // The design's `current` says whether the page's own level ends the trail, whatever the core marks hidden by its
  // setting for the page's type. Left out, a page right under the start page has no trail.
  const underStart = [{ name: 'Home', href: '/' }, { name: 'Guides', href: '/guides/', hidden: true }];
  assert.doesNotMatch(page('::breadcrumbs', { breadcrumbs: underStart, design: testDesign({ breadcrumbs: { current: false } }) }), /kn-breadcrumbs/);
  assert.doesNotMatch(page('::breadcrumbs', { breadcrumbs: underStart.map(({ hidden, ...level }) => level), design: testDesign({ breadcrumbs: { current: false } }) }), /kn-breadcrumbs/);
  // Shown, the page's own level counts: a trail of two, the core's hidden mark or not.
  assert.match(page('::breadcrumbs', { breadcrumbs: underStart, design: testDesign({ breadcrumbs: { current: true } }) }), /data-kn-current="true".*<span aria-current="page">Guides<\/span>/s);
  // The site's name as the first step, by the design, and the site's word for the trail.
  assert.match(page('::breadcrumbs', { design: testDesign({ breadcrumbs: { home: 'name' } }), words: { breadcrumb: 'Brödsmulor' } }), /aria-label="Brödsmulor".*<span class="kn-breadcrumbs-label">Example Gardens<\/span>/s);
  assert.equal(page('::breadcrumbs', { breadcrumbs: [], design: testDesign() }).includes('kn-breadcrumbs'), false, 'the start page has no trail');
  assert.equal(page('::breadcrumbs', { design: testDesign({ breadcrumbs: { show: false } }) }).includes('kn-breadcrumbs'), false, 'a design with its trail off');
});

test('the page\'s context: designPage keeps it on Astro.locals, a component without it throws naming the call, and the site\'s words override the defaults', () => {
  const Astro = { locals: {} };
  const ctx = designPage(Astro, { design: testDesign(), title: 'T', words: { search: 'Sök', taxonomies: { topics: 'Ämne' } } });
  assert.equal(contextOf(Astro), ctx);
  assert.equal(ctx.words.search, 'Sök');
  assert.equal(ctx.words.taxonomies.topics, 'Ämne');
  assert.equal(ctx.words.taxonomies.category, 'Category');
  assert.deepEqual([ctx.id('tabs'), ctx.id('tabs'), ctx.id('toc')], ['tabs-1', 'tabs-2', 'toc-1']);
  assert.throws(() => contextOf({ locals: {} }), /designPage\(Astro, \{ design, title, breadcrumbs \}\)/);
  assert.throws(() => designPage(Astro, { title: 'T' }), /design file as `design`/);
});

test('the components draw what the renderer draws, with the page\'s context from Astro.locals and the mark on their root', async () => {
  const locals = {};
  designPage({ locals }, { design: testDesign({ hero: { picture: 'end' } }), title: 'Planning a garden', breadcrumbs: TRAIL });
  const { content } = treeOf(md`:::cards

### One

:::`);
  const html = await render('directives/astro/Cards', { content, 'data-konzilo-block': '3' }, undefined, { locals });
  assert.equal(html.trim(), '<div data-konzilo-block="3" class="kn-card-grid kn-cards"><article class="kn-card"><h3 class="kn-card-heading" data-kn-type="heading-5" id="one">One</h3></article></div>');
  assert.doesNotMatch(html, /content=/);
  const section = treeOf(md`:::section

## Head

Body text.

:::`);
  const drawn = await render('directives/astro/Section', { content: section.content, surface: 'raised' }, { default: '<h2 id="head">Head</h2>\n<p>Body text.</p>' }, { locals });
  assert.equal(drawn.trim(), '<section class="kn-band kn-section" data-kn-surface="raised"><div class="kn-band-content"><header class="kn-section-head"><hgroup class="kn-heading-group"><h2 class="kn-heading-group-heading" data-kn-type="heading-2" id="head">Head</h2></hgroup></header><div class="kn-section-body kn-body-text"><p>Body text.</p></div></div></section>');
  assert.match(await render('directives/astro/Breadcrumbs', {}, undefined, { locals }), /<nav class="kn-breadcrumbs"/);
  const eyebrow = treeOf('::eyebrow[A *label*]');
  assert.equal((await render('directives/astro/Eyebrow', { content: eyebrow.content }, undefined, { locals })).trim(), '<p data-kn-type="label">A <em>label</em></p>');
  await assert.rejects(render('directives/astro/Small', { content: treeOf('::small[x]').content }, undefined, { locals: {} }), /designPage/);
});

test('a page\'s bodies keep their ids unique across the parts, however many there are', () => {
  const markdown = md`:::tabs

Label

### A

:::

:::tabs

Label

### B

:::

:::list{type="logos"}

Label

- ![L](/l.svg)

:::

:::list{type="logos"}

Label

- ![L](/l.svg)

:::`;
  const ctx = pageContext({ design: testDesign(), title: 'T' });
  const html = renderBody(bodyHtml(markdown), ctx);
  assert.deepEqual(ids(html).filter((id) => /^(tabs|logos)-/.test(id)), ['tabs-1', 'tabs-2', 'logos-1', 'logos-2']);
});
