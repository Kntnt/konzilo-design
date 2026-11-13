// The page parts a Konzilo site's templates place around a body (docs/spec/directives.md, The body of a page and An
// article; docs/spec/konzilo.md, The templates): what the core does not draw and no directive gives, made from what a
// template has in hand from the core. Plain JavaScript with no dependency, which the parts' components call, as the
// directives' components call their renderer.
//
// - titleBand(): the title and trail of a page without a hero, and a term's opening, as a section's head.
// - section(), valueList(), actionsList(), smallPrint(): a section a template writes itself, and what it holds that
//   otherwise only a directive draws, with the markup a :::section in a body gets.
// - pageBody(): a body as bands: a run of loose blocks at its top in a section of its own, the title band first where
//   the body opens with no hero, and the H1 under the hero where the design puts it there.
// - articleOpening(): an article's opening, a Hero of its main image, headline in three parts, standfirst and meta line.
// - articleBody(): an article's body in a Reading Area, its following menu beside it and its interview's questions marked.
// - readMore(): a section of teasers under a heading, and a lone main action to the rest.
import { DECK_LINE, sectionParts } from '../directives/section.js';
import { heroAttributes } from '../components/hero-attributes.js';
import { contactOf } from '../directives/cards.js';
import { serviceOf } from '../directives/actions.js';
import { iconHtml } from '../directives/icons.js';
import { escapeAttribute, escapeText, tag, voidTag } from '../directives/render/html.js';
import { breadcrumbsHtml, groupEyebrows } from '../directives/render/render.js';
import { allElements, innerHtml, retagged, textOfHtml, topElements } from '../directives/render/scan.js';
import { teaserCard } from '../presentations/teasers.js';

const classesOf = (element) => String(element?.attributes?.class ?? '').split(/\s+/).filter(Boolean);
const hasClass = (element, name) => classesOf(element).includes(name);
const innerOf = innerHtml;
const long = (text) => [...String(text ?? '').replace(/\s+/g, ' ').trim()].length > DECK_LINE;

// ---------- The title band ----------

/**
 * A section's head of its own, for the page's H1: the trail, an eyebrow, the title and a deck.
 * @param {object} ctx The page's context.
 * @param {{ title?: string, eyebrow?: string, deck?: string, surface?: string, trail?: boolean }} [options] `title` the
 *   context's by default; `trail` false leaves the trail out; `surface` the band's, the page's by default.
 */
export function titleBand(ctx, { title = ctx.title, eyebrow, deck, surface, trail = true, body = '' } = {}) {
  if (typeof title !== 'string' || title === '') throw new Error('A title band shows the page\'s title: give it to designPage(Astro, { title }), or as `title`.');
  const rest = groupEyebrows(String(body ?? '')).trim();
  return tag('section', { class: 'kn-band kn-section', 'data-kn-surface': surface && surface !== 'page' ? surface : undefined },
    tag('div', { class: 'kn-band-content' },
      tag('header', { class: 'kn-section-head' },
        trail ? breadcrumbsHtml(ctx) : '',
        tag('hgroup', { class: 'kn-heading-group' },
          eyebrow ? tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, escapeText(eyebrow)) : '',
          tag('h1', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-1' }, escapeText(title)),
          deck ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', 'data-kn-deck': long(deck) ? 'long' : undefined }, escapeText(deck)) : '')),
      rest !== '' ? tag('div', { class: 'kn-section-body kn-body-text' }, rest) : ''));
}

// The collections of the core's built-in taxonomies, by their names.
const TAXONOMIES = Object.freeze({ categories: 'category', topics: 'topics', authors: 'authors' });

/**
 * A term's opening, as a term's page shows it: the trail, the taxonomy's word as its eyebrow, the term's name as the
 * page's H1 and its description as the deck.
 * @param {object} ctx The page's context.
 * @param {{ term: { collection: string, data: { name: string, description?: string } }, taxonomy?: string, eyebrow?: string, surface?: string }} options
 */
export function termOpening(ctx, { term, taxonomy, eyebrow, surface }) {
  const name = taxonomy ?? TAXONOMIES[term?.collection] ?? term?.collection;
  return titleBand(ctx, {
    title: term?.data?.name,
    eyebrow: eyebrow ?? ctx.words.taxonomies[name] ?? (name ? name.charAt(0).toUpperCase() + name.slice(1) : undefined),
    deck: term?.data?.description,
    surface,
  });
}

// ---------- A page's body ----------

// What sectionParts() needs to know of a block the core drew at the top of a body: a figure of one image, with or without
// its caption, is a picture, whose lightbox's dialog after it is its own.
function kindOf(html, element) {
  const { name } = element;
  if (name === 'figure' && !hasClass(element, 'konzilo-gallery') && !hasClass(element, 'konzilo-embed')) {
    const inside = innerOf(html, element);
    if ((inside.match(/<img\b/g) ?? []).length === 1) return 'picture';
  }
  if (name === 'p' && element.attributes['data-kn-type'] === 'label' && !element.attributes.class) return 'eyebrow';
  if (name === 'ul' && hasClass(element, 'kn-actions')) return 'actions';
  if (name === 'form' && hasClass(element, 'konzilo-form')) return 'form';
  if (name === 'div' && hasClass(element, 'kn-choice')) return 'choice';
  if (name === 'h2') return 'heading';
  if (name === 'p' && !element.attributes.class && element.attributes['data-kn-type'] === undefined) return 'paragraph';
  return 'other';
}
const isDialog = (element) => element.name === 'dialog' && hasClass(element, 'konzilo-modal');

// A figure's image as a section's picture: its start tag again, with a class of the design's and the figure's mark.
function pictureFrom(html, element, className) {
  const inside = innerOf(html, element);
  const image = allElements(inside).find((one) => one.name === 'img');
  const mark = element.attributes['data-konzilo-block'];
  return retagged(inside, image, { set: { class: className, ...(mark === undefined ? {} : { 'data-konzilo-block': mark }) } });
}

// A section from its blocks in order, by the section's rules (directives.md, `section`): each block { kind, text, plain,
// head, picture }, its kind and text as sectionParts() reads them, `plain` its HTML in a section's body, `head({ long })`
// its HTML in the head, and `picture(className)` a picture's image as the media's.
function sectionFrom(blocks, { surface, anchor } = {}) {
  const parts = sectionParts(blocks);
  const out = [];
  if (parts.media.length) {
    const [first, ...badges] = parts.media.map((at) => blocks[at]);
    out.push(tag('div', { class: 'kn-section-media' }, first.picture('kn-section-picture'),
      badges.length ? tag('ul', { class: 'kn-section-badges', role: 'list' }, badges.map((badge) => tag('li', {}, badge.picture()))) : ''));
  }
  if (parts.head.length) {
    const head = parts.head.map((at) => blocks[at]);
    out.push(tag('header', { class: 'kn-section-head' },
      tag('hgroup', { class: 'kn-heading-group' }, head.filter((block) => block.kind !== 'actions').map((block) => block.head({ long: parts.deckLong }))),
      head.filter((block) => block.kind === 'actions').map((block) => block.plain)));
  }
  const drawn = parts.media.length + parts.head.length;
  const rest = groupEyebrows(blocks.slice(drawn).map((block) => block.plain).join('')).trim();
  if (rest !== '') out.push(tag('div', { class: 'kn-section-body kn-body-text' }, rest));
  return tag('section', { class: 'kn-band kn-section', id: anchor || undefined, 'data-kn-surface': surface && surface !== 'page' ? surface : undefined },
    tag('div', { class: 'kn-band-content' }, out));
}

// The blocks of HTML the core drew, as sectionFrom() takes them: each element at its top, a figure's lightbox's dialog
// and the white space after it its own.
function blocksOfHtml(html) {
  const elements = topElements(html).filter((element) => !isDialog(element));
  return elements.map((element, at) => {
    const kind = kindOf(html, element);
    return {
      kind,
      text: element.name === 'p' ? textOfHtml(innerOf(html, element)) : undefined,
      plain: html.slice(element.start, elements[at + 1]?.start ?? html.length),
      head: ({ long } = {}) => {
        if (kind === 'heading') return retagged(html, element, { set: { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2' } });
        if (kind === 'paragraph') return retagged(html, element, { set: { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', 'data-kn-deck': long ? 'long' : undefined } });
        return retagged(html, element, { set: { class: 'kn-heading-group-eyebrow' } });
      },
      picture: (className) => pictureFrom(html, element, className),
    };
  });
}

/**
 * A run of blocks the core drew at the top of a body, as a section without a Surface, as if the editor had put
 * :::section around them (directives.md, The body of a page): its pictures first as its media, its eyebrows, heading,
 * deck and actions as its head, and the rest as its body.
 * @param {string} html The run, as the core drew it.
 */
export const looseSection = (html) => sectionFrom(blocksOfHtml(String(html ?? '')));

// A heading's id, as Astro gives a body's heading one from its words: in lower case, its punctuation left out, its
// spaces hyphens.
export const headingIdOf = (text) => String(text ?? '').toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

/**
 * A section a template writes itself, with the markup a :::section in a body gets (directives.md, `section`): its
 * eyebrows, heading, deck and actions, and its body, read together by the section's rules, so that a deck before a
 * form stands in the body, and actions right after the heading or the deck in the head.
 * @param {object} options
 * @param {string} [options.surface] @param {string} [options.anchor] The section's id.
 * @param {string | string[]} [options.eyebrow] @param {string} [options.heading]
 * @param {number} [options.level] The heading's level, 2 by default; its look is a section's heading's.
 * @param {string} [options.headingId] The heading's id, made from its words by default, as a body's heading's is.
 * @param {string} [options.deck] The deck's HTML, its words, which a template has written safe.
 * @param {{ label: string, href: string, main?: boolean }[]} [options.actions]
 * @param {string} [options.body] The body's HTML, as Astro drew the template's slot.
 */
export function section({ surface, anchor, eyebrow, heading, level = 2, headingId, deck, actions = [], body = '' } = {}) {
  const blocks = [];
  for (const words of [].concat(eyebrow ?? []).filter(Boolean)) {
    blocks.push({ kind: 'eyebrow', plain: tag('p', { 'data-kn-type': 'label' }, escapeText(words)), head: () => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, escapeText(words)) });
  }
  if (heading) {
    const own = headingId ?? headingIdOf(heading);
    const id = own && own !== anchor ? own : undefined;
    const name = `h${Math.min(6, Math.max(1, Number(level) || 2))}`;
    blocks.push({ kind: 'heading', plain: tag(name, { id }, escapeText(heading)), head: () => tag(name, { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2', id }, escapeText(heading)) });
  }
  if (deck) {
    blocks.push({ kind: 'paragraph', text: textOfHtml(deck), plain: tag('p', {}, deck), head: ({ long }) => tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', 'data-kn-deck': long ? 'long' : undefined }, deck) });
  }
  const links = actionsList(actions);
  if (links) blocks.push({ kind: 'actions', plain: links });
  blocks.push(...blocksOfHtml(String(body ?? '')));
  return sectionFrom(blocks, { surface, anchor });
}

/**
 * Actions from links, as `:::list{type="actions"}` draws them (directives.md, `type="actions"`): each a link, the main
 * one a filled button and a link to a service the design knows its icon; nothing for no link. The first link is the
 * main action unless a link says `main` itself; one without its words or its address is left out.
 * @param {{ label: string, href: string, main?: boolean }[]} links
 * @param {{ label?: string }} [options] The list's label, written before it.
 */
export function actionsList(links = [], { label } = {}) {
  const given = links.filter((link) => link?.label && link?.href);
  if (given.length === 0) return '';
  const flagged = given.some((link) => typeof link.main === 'boolean');
  return (label ? tag('p', { 'data-kn-type': 'label' }, escapeText(label)) : '') + tag('ul', { class: 'kn-actions', role: 'list' }, given.map((link, at) => {
    const main = flagged ? link.main === true : at === 0;
    const known = serviceOf(link.href);
    const values = { class: 'kn-action', href: link.href, 'data-kn-main': main ? '' : undefined };
    return tag('li', {}, known
      ? tag('a', { ...values, 'data-kn-service': known.service }, iconHtml(known.icon), tag('span', { class: 'kn-action-label' }, escapeText(link.label)))
      : tag('a', values, escapeText(link.label)));
  }));
}

// A value as written, with the contact fact on a link alone whose words are a number or an address, an address that
// may break after its @ and before each full stop, as in a list of values a body holds.
function valueOf(html) {
  const value = String(html ?? '').trim();
  const [link, ...more] = topElements(value);
  if (!link || more.length || link.name !== 'a' || link.start !== 0 || link.end !== value.length) return value;
  const inner = innerOf(value, link);
  if (/</.test(inner)) return value;
  const words = textOfHtml(inner);
  const contact = contactOf(link.attributes.href, words);
  if (!contact) return value;
  const shown = contact === 'email' ? escapeText(words).replace(/@/g, '@<wbr>').replace(/\./g, '<wbr>.') : inner;
  const written = retagged(value, link, { set: { 'data-kn-contact': contact } });
  return `${written.slice(0, written.length - inner.length - '</a>'.length)}${shown}</a>`;
}

/**
 * Values under their labels, as `:::list{type="values"}` draws them (directives.md, `type="values"`); nothing for no
 * value. A value is HTML a template has written safe, such as a link or a <time>; one that is empty is left out.
 * @param {{ label: string, value: string }[]} items
 * @param {{ label?: string }} [options] The list's label, written before it.
 */
export function valueList(items = [], { label } = {}) {
  const given = items.filter((item) => item?.label && item.value !== undefined && item.value !== null && String(item.value).trim() !== '');
  if (given.length === 0) return '';
  return (label ? tag('p', { 'data-kn-type': 'label' }, escapeText(label)) : '') + tag('dl', { class: 'kn-value-list' }, given.map((item) => tag('div', { class: 'kn-value-list-item' },
    tag('dt', { 'data-kn-type': 'small' }, escapeText(item.label)),
    tag('dd', { class: 'kn-value-list-value' }, valueOf(item.value)))));
}

// Small print, as ::small draws it: its words, HTML a template has written safe.
export const smallPrint = (html) => (String(html ?? '').trim() ? tag('p', { class: 'kn-fine-print', 'data-kn-type': 'small' }, String(html).trim()) : '');

const isBand = (element) => hasClass(element, 'kn-band');
const isHero = (element) => isBand(element) && hasClass(element, 'kn-hero');

// Where the design puts the page's H1 under the hero (components.md, The H1, the trail and the hero's heading): the band
// after the hero takes the trail first in its head, and its heading is the H1, with the H1's look. Where that band has
// no heading, a title band of the page's title stands between them.
function headingBelow(html, ctx) {
  const elements = topElements(html);
  const at = elements.findIndex(isHero);
  if (at < 0) return html;
  const next = elements.slice(at + 1).find(isBand);
  const inner = next ? innerOf(html, next) : '';
  const heading = next ? allElements(inner).find((one) => one.name === 'h2' && classesOf(one).includes('kn-heading-group-heading')) : null;
  if (!next || !heading || hasClass(next, 'kn-hero')) {
    const after = elements[at].end;
    return `${html.slice(0, after)}\n${titleBand(ctx)}${html.slice(after)}`;
  }
  const head = allElements(inner).find((one) => one.name === 'header' && classesOf(one).includes('kn-section-head'));
  // The heading and the trail, in the band's own HTML, from the end so that the places before stay.
  let band = inner;
  const h1 = retagged(inner, heading, { name: 'h1', set: { 'data-kn-type': 'heading-1' } });
  band = `${band.slice(0, heading.start)}${h1}${band.slice(heading.end)}`;
  if (head) {
    const where = head.open.end;
    band = `${band.slice(0, where)}${breadcrumbsHtml(ctx)}${band.slice(where)}`;
  }
  const start = next.open.end;
  return `${html.slice(0, start)}${band}${html.slice(start + inner.length)}`;
}

/**
 * A body as the design's bands, from what the core drew of it: each hero and section as it is, every run of other
 * blocks at its top in a section of its own; the title band first where the body opens with no hero; and the page's H1
 * under the hero where the design puts it there.
 * @param {string} html The body, as `<Body>` drew it.
 * @param {object} ctx The page's context.
 * @param {{ title?: boolean }} [options] `title` false leaves the title band out, for a template that writes its own.
 */
export function pageBody(html, ctx, { title = true } = {}) {
  const source = String(html ?? '');
  const elements = topElements(source);
  const out = [];
  let run = null;
  const flush = (end) => {
    if (run === null) return;
    const piece = source.slice(run, end);
    if (piece.trim() !== '') out.push(looseSection(piece));
    run = null;
  };
  for (const element of elements) {
    if (isBand(element)) {
      flush(element.start);
      out.push(source.slice(element.start, element.end));
    } else if (run === null) run = element.start;
  }
  flush(source.length);
  const first = topElements(out[0] ?? '')[0];
  if (title && !(first && isHero(first))) out.unshift(titleBand(ctx));
  const bands = out.join('\n');
  return ctx.design.resolved.hero?.h1 === 'below' ? headingBelow(bands, ctx) : bands;
}

// ---------- An article ----------

/**
 * An article's meta line (directives.md, An article, The opening): the core's line, its metaLine() pieces in order, the
 * authors in a byline, a date as a <time>, the category as a link where it has a page; then the article's topics as
 * pills, each a link to its page where it has one. Nothing where it has neither.
 * @param {{ text: string, variable: string | null, url: string | null, datetime: string | null }[]} pieces
 * @param {{ name: string, url?: string | null }[]} topics
 */
export function metaLineHtml(pieces = [], topics = []) {
  const line = [];
  for (let at = 0; at < pieces.length; at += 1) {
    const piece = pieces[at];
    if (piece.variable === 'authors') {
      const byline = [];
      while (pieces[at]?.variable === 'authors') {
        const one = pieces[at];
        byline.push(one.url ? tag('a', { href: one.url }, escapeText(one.text)) : escapeText(one.text));
        at += 1;
      }
      at -= 1;
      line.push(tag('span', { class: 'kn-article-byline' }, byline));
    } else if (piece.datetime) {
      line.push(tag('time', { class: piece.variable === 'date' ? 'kn-article-date' : undefined, datetime: piece.datetime }, escapeText(piece.text)));
    } else if (piece.variable === 'category') {
      line.push(tag(piece.url ? 'a' : 'span', { class: 'kn-article-category', href: piece.url ?? undefined }, escapeText(piece.text)));
    } else line.push(escapeText(piece.text));
  }
  const written = line.join('');
  if (written.trim() === '' && topics.length === 0) return '';
  return tag('p', { class: 'kn-article-meta', 'data-kn-type': 'small' },
    written.trim() !== '' ? tag('span', { class: 'kn-article-line' }, written) : '',
    topics.length ? tag('span', { class: 'kn-article-topics' }, topics.map((topic) => tag(topic.url ? 'a' : 'span', { class: 'kn-pill', href: topic.url ?? undefined }, escapeText(topic.name)))) : '');
}

/**
 * An article's opening (directives.md, An article, The opening): a Hero, its picture the article's main image, behind
 * the text or beside it as the design has it; the trail, the headline in up to three parts, the standfirst as its deck,
 * the meta line, and what a type adds after it.
 * @param {object} ctx The page's context.
 * @param {object} options
 * @param {object} options.data The article's data: `headline` or `title`, `eyebrow`, `subheadline`, `standfirst`.
 * @param {string} [options.eyebrow] The label over the headline where the article has no eyebrow of its own: its
 *   category's name, or a type's own, such as a case study's customer.
 * @param {{ src: string, srcset?: string, sizes?: string, width?: number, height?: number, alt: string } | null} [options.picture]
 * @param {Array} [options.metaLine] The core's metaLine() pieces. @param {Array} [options.topics] `{ name, url }` each.
 * @param {string} [options.after] HTML after the meta line, such as a type's facts or actions.
 * @param {string} [options.surface] The hero's Surface where no picture stands behind it, the design's by default.
 */
export function articleOpening(ctx, { data = {}, eyebrow, picture, metaLine = [], topics = [], after = '', surface } = {}) {
  const settings = ctx.design.resolved.hero ?? {};
  const behind = settings.picture === 'behind' && !!picture;
  const chosen = surface ?? (settings.surface === 'none' ? undefined : settings.surface);
  const ground = behind ? `picture-${settings.overlay ?? 'dark'}` : chosen;
  const side = picture && !behind ? (['start', 'end', 'start-bleed', 'end-bleed'].includes(settings.picture) ? settings.picture : 'end') : undefined;
  const label = typeof data.eyebrow === 'string' && data.eyebrow.trim() ? data.eyebrow : eyebrow;
  const headline = data.headline ?? data.title ?? ctx.title ?? '';
  return tag('section', {
    class: 'kn-band kn-hero kn-article-opening',
    'data-kn-surface': ground && ground !== 'page' ? ground : undefined,
    ...heroAttributes({ side, height: settings.height, place: settings.place, align: settings.align }),
    style: behind ? `--kn-picture-image:url(${JSON.stringify(String(picture.src))})` : undefined,
  }, tag('div', { class: 'kn-band-content kn-hero-content' },
    tag('div', { class: 'kn-hero-text' },
      breadcrumbsHtml(ctx),
      tag('hgroup', { class: 'kn-heading-group' },
        label ? tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, escapeText(label)) : '',
        tag('h1', { class: 'kn-heading-group-heading', 'data-kn-type': settings.type ?? 'heading-1' }, escapeText(headline)),
        data.subheadline ? tag('p', { class: 'kn-heading-group-subheadline' }, escapeText(data.subheadline)) : '',
        data.standfirst ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead' }, escapeText(data.standfirst)) : ''),
      metaLineHtml(metaLine, topics),
      after),
    picture && !behind ? tag('div', { class: 'kn-hero-media' }, voidTag('img', { ...picture, alt: picture.alt ?? '', loading: 'eager' })) : ''));
}

/**
 * An article's body (directives.md, An article, The body and its following menu): a band of a Reading Area, its flow
 * the body as the core drew it, a paragraph of one <strong> alone marked as the interview's question, and its Aside the
 * following menu, whose stops are the body's crossheads and its fact boxes with an anchor, or the Aside a type gives.
 * @param {string} html The body, as `<Body>` drew it.
 * @param {object} ctx The page's context.
 * @param {{ label?: string, menu?: boolean, aside?: string }} [options] `label` the menu's, the context's word
 *   `articleMenu` by default; `menu` false leaves it out; `aside` the Aside's own HTML in its place.
 */
export function articleBody(html, ctx, { label = ctx.words.articleMenu, menu = true, aside } = {}) {
  const source = String(html ?? '');
  const elements = topElements(source);
  const stops = [];
  let flow = '';
  let from = 0;
  for (const element of elements) {
    if (element.name === 'p' && !element.attributes.class) {
      const inner = innerOf(source, element).trim();
      const only = topElements(inner);
      if (only.length === 1 && only[0].name === 'strong' && only[0].start === 0 && only[0].end === inner.length) {
        flow += source.slice(from, element.start) + retagged(source, element, { set: { class: 'kn-question' } });
        from = element.end;
      }
    }
    if (element.name === 'h2' && element.attributes.id) stops.push({ id: element.attributes.id, label: innerOf(source, element).replace(/<[^>]*>/g, '').trim() });
    if (element.name === 'aside' && hasClass(element, 'kn-fact-box') && element.attributes.id) {
      const heading = topElements(innerOf(source, element)).find((one) => /^h[2-6]$/.test(one.name));
      stops.push({ id: element.attributes.id, label: heading ? innerOf(innerOf(source, element), heading).replace(/<[^>]*>/g, '').trim() : escapeText(element.attributes.id) });
    }
  }
  flow += source.slice(from);
  const id = ctx.id('article-menu');
  const following = menu && stops.length >= 2
    ? tag('aside', { class: 'kn-aside-block', 'data-kn-sticky': 'true' },
      tag('nav', { class: 'kn-toc', 'aria-labelledby': id, 'data-kn-type': 'small', 'data-kn-follow': '' },
        tag('p', { class: 'kn-toc-label', id, 'data-kn-type': 'heading-6' }, escapeText(label)),
        tag('ol', { role: 'list' }, stops.map((stop) => tag('li', {}, `<a href="#${escapeAttribute(stop.id)}">${stop.label}</a>`)))))
    : '';
  const side = aside ?? following;
  return tag('section', { class: 'kn-band kn-article-body' }, tag('div', { class: 'kn-band-content' },
    tag('div', { class: 'kn-reading-area', 'data-kn-side': 'start', 'data-kn-stack': 'before' },
      side ? tag('div', { class: 'kn-reading-area-aside' }, side) : '',
      tag('div', { class: 'kn-reading-area-flow kn-body-text' }, flow.trim()))));
}

/**
 * "Read more" (directives.md, An article, "Read more"): a section of teaser cards under a heading, and a lone main
 * action to the rest; nothing where there are no teasers.
 * @param {object} ctx The page's context.
 * @param {{ teasers: object[], heading?: string, more?: { label: string, href: string }, surface?: string }} options
 */
export function readMore(ctx, { teasers = [], heading = ctx.words.readMore, more, surface } = {}) {
  if (teasers.length === 0) return '';
  const ground = surface && surface !== 'page' ? surface : undefined;
  return tag('section', { class: 'kn-band kn-section', 'data-kn-surface': ground },
    tag('div', { class: 'kn-band-content' },
      tag('header', { class: 'kn-section-head' }, tag('hgroup', { class: 'kn-heading-group' }, tag('h2', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2' }, escapeText(heading)))),
      tag('div', { class: 'kn-section-body kn-body-text' },
        tag('div', { class: 'kn-card-grid kn-cards' }, teasers.map((teaser) => teaserCard(teaser, { ground }))),
        more ? tag('ul', { class: 'kn-actions', role: 'list' }, tag('li', {}, tag('a', { class: 'kn-action', href: more.href, 'data-kn-main': '' }, escapeText(more.label)))) : '')));
}

export const PARTS = Object.freeze(['TitleBand', 'TermOpening', 'PageBody', 'ArticleOpening', 'ArticleBody', 'ReadMore', 'Section', 'ValueList', 'Actions', 'SmallPrint']);
