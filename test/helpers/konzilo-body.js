// A body as the Konzilo core renders it, for the directive components' tests, without the core: its Markdown read as the
// core reads it (Sätteri with GFM, raw HTML and directives on, smart punctuation off; each directive as the core's plain
// rendering; a heading's anchor as its id and every other heading's id from its text, as Astro gives it; an image alone
// in a paragraph as a figure, with its caption on the line after a hard break, several as a gallery), with the live
// preview's marks where asked, and its Body: the body's
// HTML split at each directive this package draws, each given its attributes typed with their defaults, its tree, and
// for a section its slot, the core's own rendering of its body again, with the lightbox's dialog after each figure.
// What the core alone draws, a post list and a form, stands in the slot as a stand-in element.
//
// The core's own reader is the core's (src/astro/reader.js, directives.js, figures.js, block-marks.js, Body.astro,
// lightbox.js). This is a model of it, held to the core's real build by test/konzilo-build.test.js where the core is at hand.
import { htmlToHast, markdownToHtml } from 'satteri';
import components from '../../src/directives/components.json' with { type: 'json' };
import { pageContext } from '../../src/directives/render/context.js';
import { renderDirective } from '../../src/directives/render/render.js';
import { endOf, nextTag } from '../../src/directives/render/scan.js';
import { outer } from '../../src/directives/render/html.js';
import { derive, defaultInputs } from '../../src/generator/index.js';

const FEATURES = Object.freeze({ gfm: true, rawHtml: true, smartPunctuation: false, directive: true });
const CORE = ['post-list', 'form'];
const property = (name) => `data${name[0].toUpperCase()}${name.slice(1)}`;

// The core's plain rendering of a directive, with its attributes' defaults written.
function plainDirective(node, ctx) {
  const declared = components[node.name]?.attributes ?? {};
  if (!components[node.name] && !CORE.includes(node.name)) {
    ctx.replaceNode(node, { type: 'paragraph', children: [{ type: 'text', value: ctx.source.slice(node.position.start.offset, node.position.end.offset) }] });
    return;
  }
  const values = { ...Object.fromEntries(Object.entries(declared).filter(([, one]) => Object.hasOwn(one, 'default')).map(([name, one]) => [name, one.default])), ...node.attributes };
  const properties = { dataDirective: node.name };
  for (const [name, value] of Object.entries(values)) properties[property(name)] = String(value);
  ctx.setProperty(node, 'data', { hName: 'div', hProperties: properties });
}
const directives = {
  name: 'test-directives',
  options: { position: true },
  textDirective(node, ctx) {
    ctx.replaceNode(node, { type: 'text', value: ctx.source.slice(node.position.start.offset, node.position.end.offset) });
  },
  leafDirective: plainDirective,
  containerDirective: plainDirective,
};

const headingAnchors = {
  name: 'test-heading-anchors',
  element: {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    visit(node, ctx) {
      const [first] = node.children;
      const anchor = first?.type === 'element' && first.tagName === 'a' && first.children.length === 0 && Object.keys(first.properties).join() === 'id';
      if (!anchor || node.properties.id !== undefined) return;
      ctx.setProperty(node, 'id', first.properties.id);
      ctx.removeChildAt(node, 0);
    },
  },
};

const isTag = (node, name) => node?.type === 'element' && node.tagName === name;
const element = (tagName, children, properties = {}) => ({ type: 'element', tagName, properties, children });
// A paragraph's lines, each { after, nodes }: `after` the break before it, `hard` (a <br>) or `soft` (a newline).
function linesOf(paragraph) {
  const lines = [{ after: null, nodes: [] }];
  let afterBreak = false;
  for (const node of paragraph.children) {
    if (isTag(node, 'br')) {
      lines.push({ after: 'hard', nodes: [] });
      afterBreak = true;
      continue;
    }
    if (node.type === 'text') {
      const value = afterBreak ? node.value.replace(/^\n/, '') : node.value;
      value.split('\n').forEach((part, i) => {
        if (i > 0) lines.push({ after: 'soft', nodes: [] });
        if (part !== '') lines.at(-1).nodes.push({ ...node, value: part });
      });
    } else lines.at(-1).nodes.push(node);
    afterBreak = false;
  }
  return lines;
}
// An image alone, its caption on the next line after a hard break, as a figure; images on lines of their own after soft
// breaks as a gallery, a last line of words its caption.
function figureOf(paragraph) {
  const items = [];
  let caption = null;
  for (const { after, nodes } of linesOf(paragraph)) {
    const [picture, ...rest] = nodes;
    const image = rest.length === 0 && isTag(picture, 'img') ? picture : null;
    if (nodes.length === 0 || caption !== null || (!image && nodes.some((node) => isTag(node, 'img')))) return null;
    if (after === 'hard') {
      const last = items.at(-1);
      if (!last || last.caption || image) return null;
      last.caption = nodes;
    } else if (image) items.push({ picture: image, caption: null });
    else if (items.length > 1) caption = nodes;
    else return null;
  }
  const figures = items.map((item) => element('figure', [item.picture, ...(item.caption ? [element('figcaption', item.caption)] : [])]));
  if (figures.length === 0) return null;
  if (figures.length === 1) return figures[0];
  return element('figure', [...figures, ...(caption ? [element('figcaption', caption)] : [])], { className: ['konzilo-gallery'] });
}
const figures = {
  name: 'test-figures',
  element: { filter: ['p'], visit(node, ctx) { const figure = figureOf(node); if (figure) ctx.replaceNode(node, figure); } },
};
// A master, which the editor writes by its address from the post's folder, `../media/<name>`, or `media/<name>` at the
// content folder's root, the core serves from `/_astro/` by Astro's images, so a component never sees the relative
// address (the core's content-format.md, Masters; test/konzilo-build.test.js sees the real one).
const masters = {
  name: 'test-masters',
  element: {
    filter: ['img'],
    visit(node, ctx) {
      const master = /^(?:\.\.\/)*media\/([^/]+)$/.exec(String(node.properties.src ?? ''));
      if (master) ctx.setProperty(node, 'src', `/_astro/${master[1]}`);
    },
  },
};

// Astro's ids for headings without one, as GitHub makes them.
function headingIds(root) {
  const seen = new Map();
  const slug = (text) => {
    const base = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
  const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));
  const visit = (node) => {
    if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
      if (node.properties.id === undefined) node.properties.id = slug(textOf(node));
      else slug(String(node.properties.id));
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
}

// The live preview's marks (the core's block-marks.js): each block of the body by its place, and within a directive's
// body and a list, by its path below it.
const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'table', 'figure', 'div', 'hr', 'dl', 'details', 'section', 'aside', 'nav', 'form', 'iframe']);
function markWithin(node, path) {
  if (isTag(node, 'ul') || isTag(node, 'ol')) {
    node.children.filter((child) => isTag(child, 'li')).forEach((item, index) => {
      item.properties.dataKonziloBlock = `${path}.${index}`;
      for (const inner of item.children.filter((child) => isTag(child, 'ul') || isTag(child, 'ol'))) markWithin(inner, `${path}.${index}`);
    });
    return;
  }
  if (node.type !== 'element' || node.properties?.dataDirective === undefined) return;
  if (node.children.some((child) => (child.type === 'text' && child.value.trim() !== '') || (child.type === 'element' && !BLOCKS.has(child.tagName)))) return;
  let index = 0;
  for (const child of node.children) {
    if (child.type === 'text' && child.value.trim() === '') continue;
    if (child.type === 'element') {
      child.properties.dataKonziloBlock = `${path}.${index}`;
      markWithin(child, `${path}.${index}`);
    }
    index += 1;
  }
}
function marks(root) {
  let at = 0;
  for (const node of root.children) {
    if (node.type === 'text' && node.value.trim() === '') continue;
    if (node.type === 'element') {
      node.properties.dataKonziloBlock = String(at);
      markWithin(node, String(at));
    }
    at += 1;
  }
}

/**
 * A body's Markdown as the HTML the core renders for it, before its Body draws the directives.
 * @param {string} markdown
 * @param {{ preview?: boolean }} [options] `preview`: with the live preview's marks.
 */
export function bodyHtml(markdown, { preview = false } = {}) {
  const { html } = markdownToHtml(String(markdown).trim(), { features: FEATURES, mdastPlugins: [directives], hastPlugins: [headingAnchors, masters, figures] });
  const root = htmlToHast(html, { fragment: true });
  headingIds(root);
  if (preview) marks(root);
  return outer(root);
}

// A body's HTML split at each directive drawn by a component, as the core's bodyParts() splits it.
function parts(html) {
  const found = [];
  let from = 0;
  for (let at = 0; ;) {
    const tag = nextTag(html, at);
    if (!tag) break;
    at = tag.end;
    const name = tag.closing ? undefined : tag.attributes['data-directive'];
    if (name === undefined || tag.void) continue;
    const close = endOf(html, tag);
    if (tag.start > from) found.push(html.slice(from, tag.start));
    const declared = components[name];
    const attributes = {};
    for (const [attribute, setting] of Object.entries(declared?.attributes ?? {})) {
      const text = tag.attributes[`data-${attribute.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`];
      if (text !== undefined) attributes[attribute] = text;
      else if (Object.hasOwn(setting, 'default')) attributes[attribute] = setting.default;
    }
    if (!declared) for (const [key, value] of Object.entries(tag.attributes)) if (key.startsWith('data-') && key !== 'data-directive' && key !== 'data-konzilo-block') attributes[key.slice(5)] = value;
    const body = declared?.body === 'none' ? null : html.slice(tag.end, close.start);
    found.push({ name, attributes, body, block: tag.attributes['data-konzilo-block'] });
    from = at = close.end;
  }
  if (from < html.length) found.push(html.slice(from));
  return found;
}

// The lightbox's dialog after each figure of an image, as the core's withLightboxes() puts it in a body's HTML.
function withLightboxes(html, page) {
  let out = '';
  let from = 0;
  for (let at = 0; ;) {
    const tag = nextTag(html, at);
    if (!tag) break;
    at = tag.end;
    if (tag.closing || tag.name !== 'figure') continue;
    const close = endOf(html, tag);
    at = close.end;
    const inside = html.slice(tag.end, close.start);
    if ((tag.attributes.class ?? '').includes('konzilo-embed') || !inside.includes('<img')) continue;
    page.dialogs += 1;
    out += `${html.slice(from, close.end)}<dialog class="konzilo-modal konzilo-lightbox" id="konzilo-modal-${page.dialogs}"><ul class="konzilo-lightbox-strip"><li><figure>${inside.replace(/<img/g, '<img loading="lazy"')}</figure></li></ul></dialog>`;
    from = close.end;
  }
  return out + html.slice(from);
}

/**
 * What the core's Body renders of a body's HTML, with this package's components for its directives: a section given its
 * slot, a post list and a form as stand-ins, `<div class="test-post-list" …>` and `<form class="konzilo-form" …>`, or a
 * post list as `page.postList(attributes)` draws it, as its presentation would.
 * @param {string} html A body's HTML, as bodyHtml() gives it.
 * @param {object} ctx The page's context.
 * @param {{ dialogs: number, postList?: (attributes: object) => string }} [page]
 */
export function renderBody(html, ctx, page = { dialogs: 0 }) {
  return parts(html).map((part) => {
    if (typeof part === 'string') return withLightboxes(part, page);
    const mark = part.block === undefined ? '' : ` data-konzilo-block="${part.block}"`;
    if (part.name === 'post-list' && page.postList) return page.postList(part.attributes);
    if (part.name === 'post-list') return `<div class="test-post-list"${mark} data-presentation="${part.attributes.presentation}"></div>`;
    if (part.name === 'form') return `<form class="konzilo-form"${mark} data-name="${part.attributes.name}"></form>`;
    if (!components[part.name]) return `<div data-directive="${part.name}"${mark}>${part.body ?? ''}</div>`;
    const content = part.body === null ? undefined : htmlToHast(part.body, { fragment: true });
    const body = part.name === 'section' ? renderBody(part.body, ctx, page) : undefined;
    return renderDirective(part.name, part.attributes, content, ctx, { body, block: part.block });
  }).join('');
}

// A design for the tests: the default one, with `hero` and `breadcrumbs` settings of the test's over it.
export function testDesign({ hero = {}, breadcrumbs = {}, project = {} } = {}) {
  const resolved = derive(defaultInputs());
  return { project: { name: 'Example Gardens', ...project }, resolved: { ...resolved, hero: { ...resolved.hero, ...hero }, breadcrumbs: { ...resolved.breadcrumbs, ...breadcrumbs } } };
}

// The Markdown of a body, rendered as a page of the core's would render it.
export function renderMarkdown(markdown, { preview = false, ...options } = {}) {
  const ctx = pageContext({ design: testDesign(), title: 'Planning a garden', warn: () => {}, ...options });
  return renderBody(bodyHtml(markdown, { preview }), ctx);
}

// The tree the core hands a component of a body's first directive, and its attributes.
export function treeOf(markdown, options) {
  const [part] = parts(bodyHtml(markdown, options)).filter((one) => typeof one !== 'string');
  return { ...part, content: part.body === null ? undefined : htmlToHast(part.body, { fragment: true }) };
}
