// What the design's directives may hold, beyond their attributes, which components.json declares and the core checks by
// its patterns: the module a site names under `componentChecks` in its site description (the core's ADR 0060), as
//
//   "componentChecks": "@kntnt/konzilo-design/directives/checks"
//
// The core's intake calls componentProblems(name, attributes, blocks) for each of the site's components it reads, and
// refuses the post for each reason given, in the editor's words. `blocks` is the core's body model of a container's
// blocks (its src/format/body.js): `paragraph`, `heading { level, anchor }`, `list { ordered, items }`, `image`,
// `gallery`, `directive { element, name, attributes, children | label }`, `embed`, `table`, `quote` and `code`, inline
// nodes as `text`, `strong`, `em`, `link { href }`, `image { alt, src }` and the like. A component of a site's own, which
// this package does not know, passes; a site with components of its own names a module of its own, which may ask this.
//
// Each reason says what would otherwise be dropped or drawn wrong. The renderer draws every part but a section's body
// from the core's tree, where the core has drawn no post list, form or component of a site's own; until the core can draw
// a part of a tree for a design (its issue #55), they stand only directly in a section.
import components from './components.json' with { type: 'json' };
import { seriesItems } from './items.js';
import { markerAttributes } from './markers.js';
import { sectionParts } from './section.js';

const OWN = new Set(Object.keys(components));

const textOf = (nodes = []) => nodes.map((node) => (node.type === 'text' || node.type === 'code' ? node.value : textOf(node.children))).join('');
const quoted = (text) => `“${text.replace(/\s+/g, ' ').trim()}”`;
const isDirective = (block, name) => block?.type === 'directive' && (name === undefined || block.name === name);
const isHeading = (block) => block?.type === 'heading';
const levelOf = (block) => (isHeading(block) ? block.level : null);
const kindOf = (block) => (block?.type === 'image' ? 'picture' : isDirective(block, 'eyebrow') ? 'eyebrow' : null);
// Inline nodes without the white space between them.
const visible = (nodes = []) => nodes.filter((node) => !(node.type === 'text' && node.value.trim() === ''));
const linksIn = (nodes = []) => nodes.flatMap((node) => (node.type === 'link' ? [node] : linksIn(node.children)));
// Every inline node a block holds, its list's items and the blocks of a directive within it too.
function inlineOf(block) {
  if (!block || typeof block !== 'object') return [];
  if (block.type === 'paragraph' || block.type === 'heading') return block.children ?? [];
  if (block.type === 'list') return block.items.flatMap((item) => [...(item.children ?? []), ...inlineOf(item.list)]);
  if (block.type === 'directive') return [...(block.label ?? []), ...(block.children ?? []).flatMap(inlineOf)];
  if (block.type === 'quote') return (block.children ?? []).flatMap(inlineOf);
  return [];
}

// What a part drawn from its tree cannot hold: a post list, a form and a component of a site's own, by what each is.
function foreign(blocks, part) {
  const reasons = [];
  for (const block of blocks) {
    if (!isDirective(block)) continue;
    const what = block.name === 'post-list' ? 'a post list' : block.name === 'form' ? 'a form' : OWN.has(block.name) ? null : `the component ${block.name}`;
    if (what) reasons.push(`${part} cannot hold ${what} yet, since only a section can hold one directly: put it in a section of its own.`);
  }
  return reasons;
}

function hero(blocks) {
  const reasons = foreign(blocks, 'An opening');
  if (blocks.some(isHeading)) reasons.push('An opening holds no heading of its own: it shows the post\'s title as its heading. Write the heading as the title, or the words as a paragraph.');
  if (blocks.some((block) => block.type === 'gallery')) reasons.push('An opening holds its pictures one to a paragraph: a logo before its text and its picture last. A gallery cannot stand in it.');
  const pictures = blocks.filter((block) => block.type === 'image').length;
  if (pictures > 2) reasons.push(`An opening holds at most two pictures, a logo before its text and its picture last, and this holds ${pictures}.`);
  return reasons;
}

// Columns pair a list of teasers with the words about it. Both are single roots in the core's slot, so neither needs
// drawing again from its tree, and a list that is empty or has a pager stays one column beside the quotation.
function section(attributes, blocks) {
  if (attributes.body !== 'columns') return [];
  const parts = sectionParts(blocks.map((block) => ({
    kind: kindOf(block) ?? (isHeading(block) && block.level === 2 ? 'heading'
      : block.type === 'paragraph' ? 'paragraph'
      : isDirective(block, 'list') && block.attributes?.type === 'actions' ? 'actions'
      : isDirective(block, 'form') ? 'form' : isDirective(block, 'choice') ? 'choice' : 'other'),
    text: textOf(block.children),
  })));
  const body = parts.body.map((at) => blocks[at]);
  const list = body.find((block) => isDirective(block, 'post-list'));
  return body.length === 2 && body.some((block) => block.type === 'quote') && list?.attributes?.presentation === 'cards' ? []
    : ['A section with its body in columns holds one post list with presentation="cards" and one quotation, in either order, after its head. Put other blocks in a section of their own, or leave out body="columns" to stack them.'];
}

// A list item's text, for a reason to name it.
const itemText = (item) => quoted(textOf(item.children) || '…');

function list(attributes, blocks) {
  const reasons = foreign(blocks, 'A styled list');
  const lists = blocks.filter((block) => block.type === 'list');
  if (lists.length !== 1) {
    reasons.push(lists.length === 0
      ? 'A styled list holds one Markdown list, and this holds none.'
      : `A styled list holds one Markdown list, and this holds ${lists.length}. Give each list a styled list of its own.`);
    return reasons;
  }
  const [{ items }] = lists;
  switch (attributes.type) {
    case 'actions': {
      let main = 0;
      for (const item of items) {
        const own = visible(item.children);
        const bold = own.length === 1 && own[0].type === 'strong' ? visible(own[0].children) : null;
        const link = bold ? (bold.length === 1 && bold[0].type === 'link' ? bold[0] : null) : own.length === 1 && own[0].type === 'link' ? own[0] : null;
        if (!link || item.list) reasons.push(`Each action in a styled list of actions is one link and nothing else, in bold for the main action, and ${itemText(item)} is not.`);
        if (bold) main += 1;
      }
      if (main > 1) reasons.push(`A styled list of actions has at most one main action, the one link in bold, and this has ${main}.`);
      break;
    }
    case 'values':
    case 'description': {
      const what = attributes.type === 'values' ? ['value', 'label'] : ['description', 'term'];
      for (const item of items) {
        if (!item.list?.items?.length) reasons.push(`Each ${what[1]} in a styled list of ${attributes.type === 'values' ? 'values' : 'descriptions'} has its ${what[0]} under it, as a list inside the item, and ${itemText(item)} has none.`);
      }
      break;
    }
    case 'logos': {
      for (const item of items) {
        const own = visible(item.children);
        const image = own.length === 1 && (own[0].type === 'image' || (own[0].type === 'link' && visible(own[0].children).length === 1 && visible(own[0].children)[0].type === 'image'));
        if (!image || item.list) reasons.push(`Each logo in a styled list of logos is one picture, or one picture that is a link, and ${quoted(textOf(item.children) || 'an item')} is not.`);
      }
      break;
    }
    default:
  }
  return reasons;
}

// A form's items, and the reasons for one with no heading to begin them at.
const NAMES = {
  cards: ['Cards', 'Cards begin at their headings, each card at one, and these have none.'],
  accordion: ['An accordion', 'An accordion\'s items begin at their headings, each item at one, and this has none.'],
  tabs: ['Tabs', 'Tabs begin at their headings, each tab at one, and these have none.'],
  toc: ['A table of contents', 'A table of contents lists the headings that follow its label, and this has none.'],
  choice: ['A choice', 'A choice\'s answers begin at their headings, each answer at one, and this has none.'],
};

function form(name, attributes, blocks) {
  const [part, none] = NAMES[name];
  const reasons = foreign(blocks, part);
  const { intro, items } = seriesItems(blocks, { levelOf, kindOf, leading: name === 'cards' });
  if (items.length === 0) return [...reasons, none];
  if (name === 'choice' && items.length < 2) reasons.push('A choice offers at least two answers, each at a heading, and this offers one.');
  if (name === 'toc' && (intro.length > 1 || (intro.length === 1 && intro[0].type !== 'paragraph'))) {
    reasons.push('A table of contents takes one paragraph before its first heading, its label, and nothing else there.');
  }
  if (name === 'cards') {
    const numbered = !!markerAttributes(attributes.markers, 1, true)['data-kn-numbering'];
    if (numbered && (attributes.picture || attributes.symbol)) reasons.push('Numbered cards are drawn as steps, which take no picture behind and no symbol. Leave out the numbering, or the picture and the symbol.');
    for (const item of items) {
      const heading = quoted(textOf(item.heading.children));
      const own = [...item.before, ...item.blocks];
      if (attributes.type === 'navigation') {
        const words = visible(item.heading.children);
        if (words.length !== 1 || words[0].type !== 'link') reasons.push(`Each card that leads on has a link for its whole heading, and the card ${heading} has not.`);
        else if (own.some((block) => linksIn(inlineOf(block)).length > 0)) reasons.push(`A card that leads on has its heading as its only link, and the card ${heading} has another.`);
      }
      if (attributes.symbol && !own.some((block) => block.type === 'image')) reasons.push(`Each card shows its picture as a symbol here, and the card ${heading} has no picture.`);
    }
  }
  return reasons;
}

/**
 * The reasons a site cannot publish one of this package's directives as it is written, in the editor's words.
 * @param {string} name The directive's name.
 * @param {Record<string, unknown>} attributes Its attributes, as written.
 * @param {object[]} blocks Its blocks, as the core's body model holds them; none for a leaf.
 * @returns {string[]}
 */
export function componentProblems(name, attributes = {}, blocks = []) {
  const own = Array.isArray(blocks) ? blocks : [];
  switch (name) {
    case 'hero': return hero(own);
    case 'section': return section(attributes ?? {}, own);
    case 'aside': return foreign(own, 'A fact box');
    case 'list': return list(attributes ?? {}, own);
    case 'cards':
    case 'accordion':
    case 'tabs':
    case 'toc':
    case 'choice':
      return form(name, attributes ?? {}, own);
    default:
      return [];
  }
}
