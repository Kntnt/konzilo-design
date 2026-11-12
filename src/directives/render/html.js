// Writing HTML as text, and reading and writing the tree the Konzilo core hands a directive's component as `content`:
// a hast root of the body as the core rendered it, read by Sätteri (the core's ADR 0068). Plain JavaScript with no
// dependency, so that a site's build, a test and a browser can all run it.

export const escapeText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Attributes from an object, by their HTML names: undefined, null and false are left out, true and '' are written bare.
export const attributes = (values = {}) => Object.entries(values)
  .filter(([, value]) => value !== undefined && value !== null && value !== false)
  .map(([name, value]) => (value === true || value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
  .join('');

const joined = (content) => content.flat(Infinity).filter((part) => part !== undefined && part !== null && part !== false && part !== '').join('');
export const tag = (name, values, ...content) => `<${name}${attributes(values)}>${joined(content)}</${name}>`;
export const voidTag = (name, values) => `<${name}${attributes(values)}>`;

// ---------- Reading the tree ----------

export const isElement = (node, ...names) => node?.type === 'element' && (names.length === 0 || names.includes(node.tagName));
export const isHeading = (node) => isElement(node) && /^h[1-6]$/.test(node.tagName);
export const levelOf = (node) => Number(node.tagName.slice(1));

// The blocks of a body: its elements and its text, without the white space and the comments between them.
export const blocksOf = (nodes = []) => nodes.filter((node) => node.type === 'element' || (node.type === 'text' && node.value.trim() !== ''));

// A directive's name, where the node is the core's plain rendering of one: a <div> with data-directive.
export const directiveOf = (node) => (isElement(node, 'div') && typeof node.properties?.dataDirective === 'string' ? node.properties.dataDirective : null);

// The live preview's mark on a block, `data-konzilo-block`, as an attribute to write on what is drawn for it.
export const BLOCK = 'data-konzilo-block';
export const markOf = (node) => (node?.properties?.dataKonziloBlock === undefined ? {} : { [BLOCK]: String(node.properties.dataKonziloBlock) });

// A nested directive's attributes from its plain rendering, by their names as declared: data-max-count is maxCount.
// The plain rendering writes every attribute with a value, its default too, as text.
export function attributesOf(node) {
  const found = {};
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (!key.startsWith('data') || key === 'dataDirective' || key === 'dataKonziloBlock' || key.length < 5) continue;
    found[key[4].toLowerCase() + key.slice(5)] = Array.isArray(value) ? value.join(' ') : String(value);
  }
  return found;
}

export const textOf = (node) => (node?.type === 'text' ? node.value : (node?.children ?? []).map(textOf).join(''));

// Every element in a tree, depth first, the node itself first.
export function* walk(node) {
  if (node?.type === 'element') yield node;
  for (const child of node?.children ?? []) yield* walk(child);
}

// ---------- Writing the tree ----------

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
// SVG's attributes in camelCase, which stay so; every other SVG property is written in kebab case, strokeWidth as stroke-width.
const SVG_CAMEL = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'pathLength', 'spreadMethod', 'stdDeviation', 'textLength', 'lengthAdjust', 'startOffset', 'baseFrequency', 'numOctaves', 'kernelMatrix', 'kernelUnitLength', 'tableValues', 'filterUnits', 'primitiveUnits', 'xChannelSelector', 'yChannelSelector', 'diffuseConstant', 'specularExponent', 'specularConstant', 'surfaceScale', 'attributeName', 'attributeType', 'calcMode', 'keyTimes', 'keySplines', 'keyPoints', 'repeatCount', 'repeatDur', 'limitingConeAngle', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'edgeMode', 'targetX', 'targetY', 'requiredExtensions', 'systemLanguage']);
const NAMED = { className: 'class', htmlFor: 'for', httpEquiv: 'http-equiv', acceptCharset: 'accept-charset', xlinkHref: 'xlink:href', xmlLang: 'xml:lang', xmlnsXlink: 'xmlns:xlink' };
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

// A hast property's name as HTML writes it: className is class, data and aria properties are in kebab case, an SVG
// property is in kebab case unless SVG writes it in camelCase, and every other name is in lower case, tabIndex as tabindex.
function attributeName(name, svg) {
  if (Object.hasOwn(NAMED, name)) return NAMED[name];
  if (/^(data|aria)[A-Z0-9]/.test(name)) return kebab(name);
  if (svg) return SVG_CAMEL.has(name) ? name : kebab(name);
  return name.toLowerCase();
}

function attributeValue(name, value) {
  if (Array.isArray(value)) return value.join(name === 'accept' ? ',' : ' ');
  return value;
}

function propertiesHtml(properties = {}, svg) {
  const written = {};
  for (const [name, value] of Object.entries(properties)) written[attributeName(name, svg)] = attributeValue(name, value);
  return attributes(written);
}

/**
 * A hast node as HTML: an element with its properties as attributes, a text escaped, a comment as itself. A <template>'s
 * content is written from its children, where Sätteri keeps it, and from hast's `content` where another reader keeps it.
 * @param {object} node A hast node.
 * @param {boolean} [svg] Whether the node stands inside an <svg>.
 * @returns {string}
 */
export function toHtml(node, svg = false) {
  if (!node) return '';
  switch (node.type) {
    case 'root': return (node.children ?? []).map((child) => toHtml(child, svg)).join('');
    case 'text': return escapeText(node.value);
    case 'comment': return `<!--${node.value}-->`;
    case 'raw': return node.value;
    case 'doctype': return '<!doctype html>';
    case 'element': {
      const inSvg = svg || node.tagName === 'svg';
      const open = `<${node.tagName}${propertiesHtml(node.properties, inSvg)}>`;
      if (VOID.has(node.tagName) && !inSvg) return open;
      const children = node.tagName === 'template' && node.content ? [...(node.content.children ?? []), ...(node.children ?? [])] : (node.children ?? []);
      const inner = RAW.has(node.tagName)
        ? children.map((child) => (child.type === 'text' ? child.value : toHtml(child, inSvg))).join('')
        : children.map((child) => toHtml(child, inSvg && node.tagName !== 'foreignObject')).join('');
      return `${open}${inner}</${node.tagName}>`;
    }
    default: return '';
  }
}

export const outer = (node) => toHtml(node);
export const inner = (node) => toHtml({ type: 'root', children: node?.children ?? [] });

// An element's properties as HTML attributes by their names, for drawing it again with classes of the design's own: an
// image keeps the core's srcset, sizes, width, height, loading and decoding, and every element its mark.
export function attributesFrom(node, { omit = [] } = {}) {
  const found = {};
  for (const [name, value] of Object.entries(node?.properties ?? {})) {
    if (omit.includes(name)) continue;
    found[attributeName(name, false)] = attributeValue(name, value);
  }
  return found;
}
