// The design's renderers of Konzilo's directives (docs/spec/directives.md): each takes a directive's attributes and its
// body as the tree the Konzilo core hands its component, `content`, and writes the HTML directives.md specifies, with
// this package's own helpers for every fact and grouping. The package's CSS draws it.
//
// A component of the design's draws what it holds from the tree, the package's own directives within it too, each with
// the Surface of the band or plate around it (`ground`). A section alone takes its body from its slot, as the core has
// drawn it there, post lists, forms, a site's own components and pictures with their lightbox among it: its pictures
// and its head it draws from the tree, and its body is what the slot holds after them (bodyFromSlot()).
//
// What the core wrote is kept: every element drawn for a block of the tree keeps the block's mark from the live
// preview, an image keeps its srcset, sizes, width, height, loading and decoding, and a heading keeps its id.
import { allQuestions } from '../accordion.js';
import { serviceOf } from '../actions.js';
import { contactOf } from '../cards.js';
import { iconHtml } from '../icons.js';
import { seriesItems } from '../items.js';
import { markerAttributes } from '../markers.js';
import { panelParts } from '../panels.js';
import { sectionParts } from '../section.js';
import { surfaceOf } from '../surfaces.js';
import { breadcrumbProps } from '../../components/design-props.js';
import { heroAttributes } from '../../components/hero-attributes.js';
import {
  BLOCK, attributesFrom, attributesOf, blocksOf, directiveOf, escapeAttribute, escapeText, inner, isElement, isHeading,
  levelOf, markOf, outer, tag, textOf, voidTag, walk,
} from './html.js';
import { topElements } from './scan.js';

// The twelve directives this package draws, by their names.
export const DIRECTIVES = Object.freeze(['hero', 'section', 'aside', 'list', 'cards', 'accordion', 'tabs', 'toc', 'choice', 'eyebrow', 'small', 'breadcrumbs']);

const within = (ctx, ground) => ({ ...ctx, ground });

// ---------- Reading blocks ----------

// The <img> a block shows alone: a figure of one image, with or without its caption, a paragraph of one image, or an
// image. A gallery and an embed show none alone.
export function pictureOf(node) {
  if (isElement(node, 'img')) return node;
  if (isElement(node, 'p')) {
    const parts = blocksOf(node.children);
    return parts.length === 1 && isElement(parts[0], 'img') ? parts[0] : null;
  }
  if (!isElement(node, 'figure')) return null;
  const classes = [].concat(node.properties?.className ?? []);
  if (classes.includes('konzilo-gallery') || classes.includes('konzilo-embed')) return null;
  const parts = blocksOf(node.children);
  const image = parts.find((part) => isElement(part, 'img'));
  return image && parts.every((part) => isElement(part, 'img', 'figcaption')) ? image : null;
}

// A block's picture as an <img> of the design's: the core's attributes, a class of the design's first, and the block's
// mark, which a figure holds and its image does not.
function picture(block, values = {}) {
  const image = pictureOf(block);
  const { class: own, src, ...rest } = attributesFrom(image);
  const classes = [values.class, own].filter(Boolean).join(' ') || undefined;
  const { class: _, ...extra } = values;
  return voidTag('img', { class: classes, src, ...rest, alt: rest.alt ?? '', ...extra, ...markOf(block) });
}

const isActions = (node) => directiveOf(node) === 'list' && attributesOf(node).type === 'actions';
const isEyebrow = (node) => directiveOf(node) === 'eyebrow';

// What sectionParts() needs to know of a block.
function kindOf(node) {
  if (pictureOf(node)) return 'picture';
  const name = directiveOf(node);
  if (name === 'eyebrow') return 'eyebrow';
  if (isActions(node)) return 'actions';
  if (name === 'form') return 'form';
  if (name === 'choice') return 'choice';
  if (isElement(node, 'h2')) return 'heading';
  if (isElement(node, 'p')) return 'paragraph';
  return 'other';
}

// A form's items, as items.js parts them: at its headings, and for cards with each card's picture and eyebrows written
// before its heading or after it.
const levelOfHeading = (node) => (isHeading(node) ? levelOf(node) : null);
export const itemsOf = (blocks) => seriesItems(blocks, { levelOf: levelOfHeading });
const cardItems = (blocks) => seriesItems(blocks, {
  levelOf: levelOfHeading,
  kindOf: (node) => (pictureOf(node) ? 'picture' : isEyebrow(node) ? 'eyebrow' : null),
  leading: true,
});

// Under a tab or an answer, whose own heading is drawn as a button, the headings go up one level, never above h2, those of
// the directives within too.
function raise(blocks) {
  for (const block of blocks) for (const node of walk(block)) if (/^h[3-6]$/.test(node.tagName)) node.tagName = `h${levelOf(node) - 1}`;
}

// What a directive made, for panelParts(): anything but a text role.
const isComponent = (node) => {
  const name = directiveOf(node);
  return !!name && !['eyebrow', 'small', 'breadcrumbs'].includes(name);
};

// An attribute of markerAttributes() as a hast property: data-kn-sign is dataKnSign.
const hastName = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// An address's words with a place to break after each @ and before each full stop, for a long address in a narrow card.
const breakable = (text) => escapeText(text).replace(/@/g, '@<wbr>').replace(/\./g, '<wbr>.');

// A link as written, with the contact fact where its words are a number or an address, and an address that may break.
function contactLink(link) {
  const words = textOf(link);
  const contact = contactOf(link.properties?.href, words);
  if (!contact) return outer(link);
  return tag('a', { ...attributesFrom(link), 'data-kn-contact': contact }, contact === 'email' ? breakable(words.trim()) : inner(link));
}

// A paragraph whose only content is one link, as a card's number or address stands.
const loneLink = (node) => {
  const parts = blocksOf(node.children);
  return parts.length === 1 && isElement(parts[0], 'a') ? parts[0] : null;
};

// ---------- Marks ----------

const UNSHOWN = new Set(['script', 'style', 'link', 'meta', 'template', 'noscript']);

/**
 * What a part drew, with its block's mark on each element at its top that holds no mark of its own, as the core's
 * live preview asks (its docs/site-design.md, The live preview): a part with a level of its own and no element, such as a
 * series' intro beside its grid, leaves the marked blocks as they are.
 * @param {string} html
 * @param {string | undefined} block The mark, or undefined on the public site.
 */
export function withMark(html, block) {
  if (block === undefined || block === null) return html;
  let marked = html;
  for (const element of topElements(html).toReversed()) {
    if (UNSHOWN.has(element.name) || Object.hasOwn(element.attributes, BLOCK)) continue;
    const at = element.start + 1 + element.name.length;
    marked = `${marked.slice(0, at)} ${BLOCK}="${escapeAttribute(block)}"${marked.slice(at)}`;
  }
  return marked;
}

// ---------- Blocks within a part ----------

// A heading's attributes as the core wrote them, its id and its mark, under a class of the design's.
const headingAttributes = (node) => attributesFrom(node, { omit: ['className'] });

// A run of eyebrows and the heading after it, in a heading group (directives.md, ::eyebrow).
function headingGroup(eyebrows, heading) {
  return tag('hgroup', { class: 'kn-heading-group' },
    eyebrows.map((eyebrow) => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label', ...markOf(eyebrow) }, inner(eyebrow))),
    tag(heading.tagName, { class: 'kn-heading-group-heading', ...headingAttributes(heading) }, inner(heading)));
}

// Blocks inside a part, in order: an eyebrow before a heading stands with it in a heading group, and one with no heading
// after it is a plain label; a directive is drawn by its renderer, and everything else as the core wrote it.
export function renderBlocks(blocks, ctx) {
  const out = [];
  for (let at = 0; at < blocks.length; at += 1) {
    const node = blocks[at];
    if (isEyebrow(node)) {
      const run = [node];
      while (isEyebrow(blocks[at + 1])) run.push(blocks[(at += 1)]);
      if (isHeading(blocks[at + 1])) out.push(headingGroup(run, blocks[(at += 1)]));
      else out.push(...run.map((eyebrow) => tag('p', { 'data-kn-type': 'label', ...markOf(eyebrow) }, inner(eyebrow))));
      continue;
    }
    out.push(directiveOf(node) ? renderNested(node, ctx) : outer(node));
  }
  return out.join('');
}

// A directive within a part's tree: the package's own drawn by its renderer, with its mark; any other, a post list, a
// form or a site's own component, as the core's plain rendering, which the checks refuse in an item (checks.js).
function renderNested(node, ctx) {
  const name = directiveOf(node);
  const renderer = RENDERERS[name];
  if (!renderer) {
    ctx.warn(`the directive ${name} stands in a part this package draws from its tree, where only the core could draw it; it is left as the core's plain rendering`);
    return outer(node);
  }
  const children = name === 'eyebrow' || name === 'small' ? (node.children ?? []) : blocksOf(node.children);
  return withMark(renderer(attributesOf(node), children, ctx, {}), markOf(node)[BLOCK]);
}

// ---------- hero ----------

function hero(attrs, blocks, ctx) {
  const settings = ctx.design.resolved.hero ?? {};
  if (typeof ctx.title !== 'string' || ctx.title === '') throw new Error('A hero draws the post\'s title as its heading: give it to designPage(Astro, { title }).');
  const trail = blocks.find((node) => directiveOf(node) === 'breadcrumbs') ?? null;
  const firstText = blocks.findIndex((node) => !pictureOf(node) && directiveOf(node) !== 'breadcrumbs');
  const pictures = blocks.filter((node) => pictureOf(node));
  // A picture before the text is a logo; the last picture is the hero's.
  const logo = pictures.find((node) => firstText >= 0 && blocks.indexOf(node) < firstText) ?? null;
  const main = [...pictures].reverse().find((node) => node !== logo) ?? null;
  const eyebrows = blocks.filter(isEyebrow);
  const deck = blocks.find((node) => isElement(node, 'p') && !pictureOf(node)) ?? null;
  const rest = blocks.filter((node) => node !== trail && node !== logo && node !== main && !eyebrows.includes(node) && node !== deck && directiveOf(node) !== 'breadcrumbs');
  const behind = settings.picture === 'behind' && !!main;
  const chosen = attrs.surface ?? (settings.surface === 'none' ? undefined : settings.surface);
  const surface = behind ? `picture-${settings.overlay ?? 'dark'}` : chosen;
  const side = main && !behind ? (['start', 'end', 'start-bleed', 'end-bleed'].includes(settings.picture) ? settings.picture : 'end') : undefined;
  const below = settings.h1 === 'below';
  const group = tag(below ? 'div' : 'hgroup', { class: 'kn-heading-group' },
    eyebrows.map((eyebrow) => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label', ...markOf(eyebrow) }, inner(eyebrow))),
    tag(below ? 'p' : 'h1', { class: 'kn-heading-group-heading', 'data-kn-type': settings.type ?? 'heading-1' }, escapeText(ctx.title)),
    deck ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', ...markOf(deck) }, inner(deck)) : '');
  const band = within(ctx, surface === 'page' ? undefined : surface);
  const source = behind ? pictureOf(main).properties.src : undefined;
  return tag('section', {
    class: 'kn-band kn-hero',
    'data-kn-surface': surface === 'page' ? undefined : surface,
    ...heroAttributes({ side, height: settings.height, place: settings.place, align: settings.align }),
    // A picture behind is the band's, as Band writes it: the one inline style of a directive (directives.md).
    style: behind ? `--kn-picture-image:url(${JSON.stringify(String(source))})` : undefined,
  }, tag('div', { class: 'kn-band-content kn-hero-content' },
    tag('div', { class: 'kn-hero-text' },
      // Where the H1 stands under the hero, the trail stands before it there, which PageBody writes.
      trail && !below ? withMark(breadcrumbsHtml(ctx), markOf(trail)[BLOCK]) : '',
      logo ? picture(logo, { class: 'kn-hero-logo', loading: 'eager' }) : '',
      group,
      renderBlocks(rest, band)),
    main && !behind ? tag('div', { class: 'kn-hero-media' }, picture(main, { loading: 'eager' })) : ''));
}

// ---------- section ----------

// How many elements the core draws at the top of a body for a block of a section's head or media: a figure and the
// lightbox's dialog after it, a directive as its component draws it, and one element for anything else.
function drawnFor(node, ctx) {
  if (isElement(node, 'figure') && pictureOf(node)) return 2;
  if (directiveOf(node)) return topElements(renderNested(node, { ...ctx, id: (prefix) => `${prefix}-0`, warn: () => {} })).length;
  return 1;
}

// A section's body, as its slot holds it: what the core drew there after the section's media and head, which the section
// drew itself. In the live preview each block is marked, so the body begins at the first element marked as its first
// block or a block within it; on the public site the elements drawn for the media and head are counted.
export function bodyFromSlot(slot, blocks, drawn, ctx) {
  const html = String(slot ?? '');
  const elements = topElements(html);
  const first = blocks[drawn];
  if (!first) return '';
  const mark = markOf(first)[BLOCK];
  if (mark !== undefined) {
    // The first element of the block, or of a block within it, as a part's intro is, standing beside its own element.
    const found = elements.find((element) => element.attributes[BLOCK] === mark || element.attributes[BLOCK]?.startsWith(`${mark}.`));
    if (found) return html.slice(found.start);
  }
  let count = 0;
  for (const node of blocks.slice(0, drawn)) count += drawnFor(node, ctx);
  return count < elements.length ? html.slice(elements[count].start) : '';
}

// In a body the core drew, eyebrows right before a heading join it in a heading group, as they do in a part drawn from
// its tree. An eyebrow is the only label of this package's that a heading follows at the top of a body: a list's intro
// label stands before its list.
export function groupEyebrows(html) {
  const elements = topElements(html);
  const isLabel = (element) => element?.name === 'p' && element.attributes['data-kn-type'] === 'label' && element.attributes.class === undefined;
  const isBare = (element) => /^h[2-6]$/.test(element?.name ?? '') && element.attributes.class === undefined;
  const adjoining = (one, other) => html.slice(one.end, other.start).trim() === '';
  let out = '';
  let from = 0;
  for (let at = 0; at < elements.length; at += 1) {
    if (!isLabel(elements[at])) continue;
    let next = at;
    while (isLabel(elements[next + 1]) && adjoining(elements[next], elements[next + 1])) next += 1;
    const heading = elements[next + 1];
    if (!isBare(heading) || !adjoining(elements[next], heading)) {
      at = next;
      continue;
    }
    const classed = (element, name) => {
      const where = element.start + 1 + element.name.length;
      return `${html.slice(element.start, where)} class="${name}"${html.slice(where, element.end)}`;
    };
    out += html.slice(from, elements[at].start);
    out += `<hgroup class="kn-heading-group">${elements.slice(at, next + 1).map((label) => classed(label, 'kn-heading-group-eyebrow')).join('')}${classed(heading, 'kn-heading-group-heading')}</hgroup>`;
    from = heading.end;
    at = next + 1;
  }
  return out + html.slice(from);
}

function section(attrs, blocks, ctx, { body } = {}) {
  const surface = attrs.surface && attrs.surface !== 'page' ? attrs.surface : undefined;
  const band = within(ctx, surface);
  const parts = sectionParts(blocks.map((node) => ({ kind: kindOf(node), text: isElement(node, 'p') ? textOf(node) : undefined })));
  const out = [];
  if (parts.media.length) {
    const [first, ...badges] = parts.media.map((at) => blocks[at]);
    out.push(tag('div', { class: 'kn-section-media' },
      picture(first, { class: 'kn-section-picture' }),
      badges.length ? tag('ul', { class: 'kn-section-badges', role: 'list' }, badges.map((badge) => tag('li', {}, picture(badge)))) : ''));
  }
  if (parts.head.length) {
    const head = parts.head.map((at) => blocks[at]);
    const heading = head.find((node) => isElement(node, 'h2'));
    // The section's own id wins over its heading's of the same name.
    const { id, ...own } = headingAttributes(heading);
    out.push(tag('header', { class: 'kn-section-head' },
      tag('hgroup', { class: 'kn-heading-group' },
        head.filter(isEyebrow).map((eyebrow) => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label', ...markOf(eyebrow) }, inner(eyebrow))),
        tag('h2', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2', id: id === attrs.anchor ? undefined : id, ...own }, inner(heading)),
        parts.deck !== null ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', 'data-kn-deck': parts.deckLong ? 'long' : undefined, ...markOf(blocks[parts.deck]) }, inner(blocks[parts.deck])) : ''),
      head.filter(isActions).map((node) => renderNested(node, band))));
  }
  const drawn = parts.media.length + parts.head.length;
  const rest = body === undefined ? renderBlocks(blocks.slice(drawn), band) : groupEyebrows(bodyFromSlot(body, blocks, drawn, band)).trim();
  if (rest !== '') out.push(tag('div', { class: 'kn-section-body kn-body-text' }, rest));
  return tag('section', { class: 'kn-band kn-section', id: attrs.anchor || undefined, 'data-kn-surface': surface, 'data-kn-body': attrs.body === 'columns' ? 'columns' : undefined }, tag('div', { class: 'kn-band-content' }, out));
}

// ---------- aside ----------

function aside(attrs, blocks, ctx) {
  const heading = blocks.find(isHeading);
  const plate = surfaceOf('fact-box', ctx.ground);
  const inside = within(ctx, plate);
  return tag('aside', { class: 'kn-fact-box', id: attrs.anchor || undefined, 'data-kn-surface': plate },
    blocks.map((node) => {
      if (isEyebrow(node)) return tag('p', { class: 'kn-fact-box-label', 'data-kn-type': 'label', ...markOf(node) }, inner(node));
      if (node === heading) {
        const { id, ...own } = headingAttributes(node);
        return tag(node.tagName, { class: 'kn-fact-box-heading', 'data-kn-type': 'heading-5', id: id === attrs.anchor ? undefined : id, ...own }, inner(node));
      }
      return renderBlocks([node], inside);
    }));
}

// ---------- list ----------

// An item of a Markdown list: its own content, without a loose list's paragraph, and the items of the list it holds.
function itemParts(item) {
  const nested = item.children.filter((child) => isElement(child, 'ul', 'ol'));
  const own = item.children.filter((child) => !isElement(child, 'ul', 'ol')).flatMap((child) => (isElement(child, 'p') ? child.children : [child]));
  return { own, subs: nested.flatMap((list) => list.children.filter((child) => isElement(child, 'li'))) };
}
const ownHtml = (nodes) => inner({ children: nodes }).trim();
const itemsOfList = (list) => list.children.filter((child) => isElement(child, 'li'));
const labels = (intro, ctx) => intro.map((node) => (isElement(node, 'p') ? tag('p', { 'data-kn-type': 'label', ...markOf(node) }, inner(node)) : renderBlocks([node], ctx))).join('');

// A value as written, an address that may break where it is a mailto: link alone.
function valueHtml(nodes) {
  const parts = blocksOf(nodes);
  if (parts.length === 1 && isElement(parts[0], 'a')) return contactLink(parts[0]);
  return ownHtml(nodes);
}

function markList(list, markers, level = 1) {
  for (const [name, value] of Object.entries(markerAttributes(markers, level, list.tagName === 'ol'))) list.properties[hastName(name)] = value;
  for (const item of itemsOfList(list)) for (const child of item.children) if (isElement(child, 'ul', 'ol')) markList(child, markers, level + 1);
}

function actions(list) {
  return tag('ul', { class: 'kn-actions', role: 'list', ...markOf(list) }, itemsOfList(list).map((item) => {
    const link = [...walk(item)].find((node) => node.tagName === 'a');
    if (!link) return tag('li', markOf(item), inner(item));
    const main = [...walk(item)].some((node) => node.tagName === 'strong');
    const { class: _, href, ...own } = attributesFrom(link);
    const label = escapeText(textOf(link).trim());
    const known = serviceOf(href);
    const values = { class: 'kn-action', href, ...own, 'data-kn-main': main ? '' : undefined };
    return tag('li', markOf(item), known
      ? tag('a', { ...values, 'data-kn-service': known.service }, iconHtml(known.icon), tag('span', { class: 'kn-action-label' }, label))
      : tag('a', values, label));
  }));
}

function list(attrs, blocks, ctx) {
  const at = blocks.findIndex((node) => isElement(node, 'ul', 'ol'));
  if (at < 0) {
    ctx.warn('a :::list holds no Markdown list');
    return renderBlocks(blocks, ctx);
  }
  const [intro, body, outro] = [blocks.slice(0, at), blocks[at], blocks.slice(at + 1)];
  const after = renderBlocks(outro, ctx);
  switch (attrs.type) {
    case 'description':
      return labels(intro, ctx) + tag('dl', { class: 'kn-description-list', ...markOf(body) }, itemsOfList(body).map((item) => {
        const { own, subs } = itemParts(item);
        return tag('div', { class: 'kn-description-list-item', ...markOf(item) }, tag('dt', { 'data-kn-type': 'heading-6' }, ownHtml(own)),
          subs.map((sub) => tag('dd', markOf(sub), ownHtml(itemParts(sub).own))));
      })) + after;
    case 'values':
      return labels(intro, ctx) + tag('dl', { class: 'kn-value-list', ...markOf(body) }, itemsOfList(body).map((item) => {
        const { own, subs } = itemParts(item);
        return tag('div', { class: 'kn-value-list-item', ...markOf(item) }, tag('dt', { 'data-kn-type': 'small' }, ownHtml(own)),
          subs.map((sub) => tag('dd', { class: 'kn-value-list-value', ...markOf(sub) }, valueHtml(itemParts(sub).own))));
      })) + after;
    case 'logos': {
      const id = intro.length ? ctx.id('logos') : undefined;
      return tag('div', { class: 'kn-logos' },
        intro.length ? tag('p', { class: 'kn-logos-label', id, 'data-kn-type': 'label', ...markOf(intro[0]) }, intro.map((node) => inner(node)).join(' ')) : '',
        tag('ul', { class: 'kn-logos-list', role: 'list', 'aria-labelledby': id, ...markOf(body) }, itemsOfList(body).map((item) => {
          const link = [...walk(item)].find((node) => node.tagName === 'a');
          const image = [...walk(item)].find((node) => node.tagName === 'img');
          if (!image) return tag('li', markOf(item), inner(item));
          const drawn = voidTag('img', { ...attributesFrom(image), alt: image.properties.alt ?? '' });
          return tag('li', markOf(item), link ? tag('a', attributesFrom(link), drawn) : drawn);
        }))) + after;
    }
    case 'actions':
      return labels(intro, ctx) + actions(body) + after;
    default:
      if (attrs.type) ctx.warn(`a :::list of the type ${attrs.type}, which this package does not draw, stands as a plain list`);
      if (attrs.markers) markList(body, attrs.markers);
      return renderBlocks(intro, ctx) + outer(body) + after;
  }
}

// ---------- cards: series, steps, reasons ----------

function cards(attrs, blocks, ctx) {
  const { intro, items } = cardItems(blocks);
  const numbering = markerAttributes(attrs.markers, 1, true);
  const sign = markerAttributes(attrs.markers, 1, false);
  const navigation = attrs.type === 'navigation';
  const pictured = items.some((item) => [...item.before, ...item.blocks].some((node) => pictureOf(node)));
  const headingOf = (item, name) => tag(item.heading.tagName, { class: name, 'data-kn-type': 'heading-5', ...headingAttributes(item.heading) }, inner(item.heading));
  if (numbering['data-kn-numbering'] && !navigation) {
    return renderBlocks(intro, ctx) + tag('ol', { class: 'kn-timeline', ...numbering }, items.map((item) => tag('li', { class: 'kn-timeline-item' },
      headingOf(item, 'kn-timeline-heading'), renderBlocks([...item.before, ...item.blocks], ctx))));
  }
  if (sign['data-kn-sign'] && !pictured && !attrs.picture && !attrs.symbol && !navigation) {
    return renderBlocks(intro, ctx) + tag('ul', { class: 'kn-reasons', role: 'list', ...sign }, items.map((item) => tag('li', { class: 'kn-reason' },
      headingOf(item, 'kn-reason-heading'), renderBlocks([...item.before, ...item.blocks], ctx))));
  }
  const withActions = items.map((item) => item.blocks.some(isActions));
  const options = {
    behind: attrs.picture === 'behind',
    symbol: attrs.symbol === 'item' || attrs.symbol === 'heading' ? attrs.symbol : undefined,
    navigation,
    actionCards: withActions.includes(true) && withActions.includes(false),
  };
  const series = {
    'data-kn-picture': options.behind ? 'behind' : undefined,
    'data-kn-symbol': options.symbol,
  };
  if (navigation) {
    const id = intro.length ? ctx.id('navigation') : undefined;
    return tag('nav', { class: 'kn-cards-nav', 'aria-labelledby': id },
      intro.length ? tag('div', { class: 'kn-cards-label', id }, intro.map((node) => tag('p', { 'data-kn-type': 'label', ...markOf(node) }, inner(node)))) : '',
      tag('ul', { class: 'kn-card-grid kn-cards', role: 'list', ...series }, items.map((item) => tag('li', {}, card(item, options, ctx)))));
  }
  return renderBlocks(intro, ctx) + tag('div', { class: 'kn-card-grid kn-cards', ...(pictured ? sign : {}), ...series }, items.map((item) => card(item, options, ctx)));
}

// One item of a series.
function card(item, { behind, symbol, navigation, actionCards }, ctx) {
  const blocks = [...item.before, ...item.blocks];
  const pictureBlock = blocks.find((node) => pictureOf(node));
  const eyebrows = blocks.filter(isEyebrow);
  const rest = blocks.filter((node) => node !== pictureBlock && !eyebrows.includes(node));
  const link = [...walk(item.heading)].find((node) => node.tagName === 'a');
  const otherLink = rest.some((node) => [...walk(node)].some((element) => element.tagName === 'a'));
  const whole = !!link && !otherLink;
  const hasActions = rest.some(isActions);
  const surface = behind && pictureBlock ? surfaceOf('behind-card', ctx.ground)
    : whole ? surfaceOf('link-card', ctx.ground)
      : hasActions && actionCards ? surfaceOf('action-card', ctx.ground) : undefined;
  if (whole) link.properties = { className: ['kn-card-link'], ...link.properties };
  // A symbol is decorative beside the heading that names the card, so its alternative text is empty.
  const mark = symbol && pictureBlock ? tag('span', { class: 'kn-card-symbol' }, picture(pictureBlock, { alt: '' })) : '';
  const inside = within(ctx, surface ?? ctx.ground);
  const heading = headingAttributes(item.heading);
  return tag('article', { class: 'kn-card', 'data-kn-variant': navigation ? 'link' : undefined, 'data-kn-surface': surface ?? undefined },
    pictureBlock && !symbol ? picture(pictureBlock, { class: 'kn-card-picture' }) : '',
    symbol === 'item' ? mark : '',
    eyebrows.map((eyebrow) => tag('p', { class: 'kn-card-eyebrow', 'data-kn-type': 'label', ...markOf(eyebrow) }, inner(eyebrow))),
    tag(item.heading.tagName, { class: 'kn-card-heading', 'data-kn-type': 'heading-5', ...heading }, symbol === 'heading' ? mark : '', inner(item.heading)),
    rest.map((node) => {
      if (isElement(node, 'p') && !pictureOf(node)) {
        const lone = loneLink(node);
        return tag('p', { class: 'kn-card-text', 'data-kn-type': 'small', ...markOf(node) }, lone ? contactLink(lone) : inner(node));
      }
      return renderBlocks([node], inside);
    }),
    navigation ? iconHtml('arrow-right', 'kn-card-arrow') : '');
}

// ---------- accordion, tabs, toc, choice ----------

function accordion(attrs, blocks, ctx) {
  const { intro, items } = itemsOf(blocks);
  const single = attrs.expand === 'one';
  const name = single ? ctx.id('accordion') : undefined;
  return renderBlocks(intro, ctx) + tag('div', {
    class: 'kn-accordion', 'data-kn-accordion-mode': single ? 'single' : 'multiple',
    'data-kn-questions': allQuestions(items.map((item) => textOf(item.heading))) ? '' : undefined,
  }, items.map((item, index) => tag('details', { class: 'kn-accordion-item', name, open: attrs.first === 'open' && index === 0 },
    tag('summary', { class: 'kn-accordion-summary' },
      tag(item.heading.tagName, { class: 'kn-accordion-label', 'data-kn-type': 'heading-6', ...headingAttributes(item.heading) }, inner(item.heading)),
      iconHtml('chevron-down', 'kn-accordion-chevron')),
    tag('div', { class: 'kn-body-text kn-accordion-content' }, renderBlocks(item.blocks, ctx)))));
}

function tabs(attrs, blocks, ctx) {
  const { intro, items } = itemsOf(blocks);
  const name = ctx.id('tabs');
  const labelled = intro.length > 0;
  return tag('div', { class: 'kn-tabs', role: labelled ? 'group' : undefined, 'aria-labelledby': labelled ? name : undefined },
    labelled ? tag('div', { class: 'kn-tabs-label', id: name }, intro.map((node) => tag('p', { 'data-kn-type': 'label', ...markOf(node) }, inner(node)))) : '',
    items.map((item, index) => {
      raise(item.blocks);
      const parts = panelParts(item.blocks.map((node) => ({ component: isComponent(node) })));
      const panel = parts
        ? tag('div', { class: 'kn-tabs-text' }, renderBlocks(parts.text.map((at) => item.blocks[at]), ctx)) + tag('div', { class: 'kn-tabs-parts' }, renderBlocks(parts.parts.map((at) => item.blocks[at]), ctx))
        : renderBlocks(item.blocks, ctx);
      // A tab has no element of its own for its heading's mark but its summary.
      return tag('details', { class: 'kn-tabs-item', name, open: index === 0 },
        tag('summary', { class: 'kn-tabs-tab', ...markOf(item.heading) }, inner(item.heading)), tag('div', { class: 'kn-tabs-panel' }, panel));
    }));
}

function toc(attrs, blocks, ctx) {
  const { intro, items } = itemsOf(blocks);
  const id = ctx.id('toc');
  const label = intro.length ? intro[0] : null;
  if (intro.length > 1) ctx.warn('a :::toc whose intro is more than its label; the rest is left out');
  return tag('div', { class: 'kn-reading-area', 'data-kn-side': 'start', 'data-kn-stack': 'before' },
    tag('div', { class: 'kn-reading-area-aside' }, tag('aside', { class: 'kn-aside-block', 'data-kn-sticky': 'true' },
      tag('nav', { class: 'kn-toc', 'aria-labelledby': label ? id : undefined, 'aria-label': label ? undefined : ctx.words.contents, 'data-kn-type': 'small', 'data-kn-follow': '' },
        label ? tag('p', { class: 'kn-toc-label', id, 'data-kn-type': 'heading-6', ...markOf(label) }, isElement(label, 'p') ? inner(label) : escapeText(textOf(label))) : '',
        tag('ol', { role: 'list' }, items.filter((item) => item.heading.properties?.id !== undefined)
          .map((item) => tag('li', {}, tag('a', { href: `#${item.heading.properties.id}` }, escapeText(textOf(item.heading).trim())))))))),
    tag('div', { class: 'kn-reading-area-flow' }, items.map((item) => outer(item.heading) + renderBlocks(item.blocks, ctx))));
}

function choice(attrs, blocks, ctx) {
  const { intro, items } = itemsOf(blocks);
  const name = ctx.id('choice');
  const labelled = intro.length > 0;
  return tag('div', { class: 'kn-choice', role: labelled ? 'group' : undefined, 'aria-labelledby': labelled ? name : undefined },
    labelled ? tag('div', { class: 'kn-choice-label', id: name }, renderBlocks(intro, ctx)) : '',
    items.map((item) => {
      raise(item.blocks);
      const onlyForm = item.blocks.length === 1 && directiveOf(item.blocks[0]) === 'form';
      const plate = onlyForm ? undefined : surfaceOf('choice-panel', ctx.ground);
      return tag('details', { class: 'kn-choice-item', name },
        tag('summary', { class: 'kn-choice-answer', 'data-kn-surface': surfaceOf('choice-answer', ctx.ground), ...markOf(item.heading) }, inner(item.heading)),
        tag('div', { class: 'kn-choice-panel', 'data-kn-surface': plate }, renderBlocks(item.blocks, within(ctx, plate ?? ctx.ground))));
    }));
}

// ---------- the text roles and the trail ----------

/**
 * The page's trail, as Breadcrumbs writes it with the design's settings, from the core's levels in the page's context,
 * the page's own level shown or hidden as the design's `current` says: nothing where no step but the start page is
 * left to show.
 * @param {object} ctx The page's context.
 */
export function breadcrumbsHtml(ctx) {
  const [home, ...rest] = ctx.breadcrumbs ?? [];
  if (!home) return '';
  const trail = rest.map((level, at) => (at === rest.length - 1 ? { label: level.name } : { label: level.name, href: level.href }));
  const props = breadcrumbProps(ctx.design.resolved.breadcrumbs ?? {}, ctx.design.project, { trail, home: home.href, homeWord: home.name });
  // The design's `current` says whether the page itself ends the trail, whatever the core's setting for its type, which
  // marks the level `hidden` for the core's own Breadcrumbs (directives.md, ::breadcrumbs).
  const current = props.current !== false;
  const shown = props.items.length - (current ? 0 : 1);
  if (shown < 2) return '';
  return tag('nav', {
    class: 'kn-breadcrumbs', 'aria-label': ctx.words.breadcrumb, 'data-kn-type': 'small', 'data-kn-separator': props.separator ?? 'slash',
    'data-kn-home': props.home ?? 'word', 'data-kn-current': String(current), 'data-kn-narrow': props.narrow ?? 'trail',
  }, tag('ol', { role: 'list' }, props.items.map((item, index) => tag('li', {},
    index > 0 ? '<span class="kn-breadcrumbs-separator" aria-hidden="true"></span>' : '',
    index === props.items.length - 1 ? tag('span', { 'aria-current': 'page' }, escapeText(item.label))
      : item.href ? tag('a', { href: item.href }, index === 0 ? iconHtml('house', 'kn-breadcrumbs-house') : '', tag('span', { class: 'kn-breadcrumbs-label' }, escapeText(item.label)))
        : tag('span', {}, escapeText(item.label))))));
}

const RENDERERS = {
  hero, section, aside, list, cards, accordion, tabs, toc, choice,
  eyebrow: (attrs, children) => tag('p', { 'data-kn-type': 'label' }, inner({ children })),
  small: (attrs, children) => tag('p', { class: 'kn-fine-print', 'data-kn-type': 'small' }, inner({ children })),
  breadcrumbs: (attrs, children, ctx) => breadcrumbsHtml(ctx),
};

/**
 * A directive as this package draws it.
 * @param {string} name The directive's name, one of DIRECTIVES.
 * @param {object} attributes Its attributes, as the core hands its component them: typed, with their defaults.
 * @param {object | undefined} content Its body as the core's tree, a hast root; none for `breadcrumbs`.
 * @param {object} ctx The page's context (context.js).
 * @param {{ body?: string, block?: string }} [options] `body`: a section's slot, as the core drew it; `block`: the
 *   directive's mark in the live preview, which its root takes.
 * @returns {string} Its HTML.
 */
export function renderDirective(name, attributes, content, ctx, { body, block } = {}) {
  if (!Object.hasOwn(RENDERERS, name)) throw new Error(`@kntnt/konzilo-design draws no directive ${name}; it draws ${DIRECTIVES.join(', ')}.`);
  const nodes = content?.children ?? [];
  const children = name === 'eyebrow' || name === 'small' ? nodes : blocksOf(nodes);
  return withMark(RENDERERS[name](attributes ?? {}, children, ctx, { body }), block);
}
