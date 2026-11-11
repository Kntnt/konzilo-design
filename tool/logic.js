import { sizeAt, windowShare } from '../src/generator/type.js';
import { REFERENCE } from '../src/generator/shadow.js';
import { SOCIAL_NETWORKS } from '../presentation/src/samples.js';

export { sizeAt, windowShare };

export const scales = [
  [1.067, 'Minor second'],
  [1.125, 'Major second'],
  [1.2, 'Minor third'],
  [1.25, 'Major third'],
  [1.333, 'Perfect fourth'],
  [1.414, 'Augmented fourth'],
  [1.5, 'Perfect fifth'],
  [1.6, 'Minor sixth'],
  [1.618, 'Golden ratio'],
  [1.667, 'Major sixth'],
  [1.778, 'Minor seventh'],
  [1.875, 'Major seventh'],
  [2, 'Octave'],
];
export const chain = [
  'heading-6',
  'heading-5',
  'heading-4',
  'heading-3',
  'heading-2',
  'heading-1',
  'display',
];
export function absoluteSteps(steps) {
  let n = 0;
  const result = Object.fromEntries(
    chain.map((key) => [key, (n += steps[key])]),
  );
  return {
    ...result,
    lead: steps.lead,
    small: -steps.small,
    label: -steps.label,
    body: 0,
  };
}
export function relativeSteps(absolute) {
  let n = 0;
  const result = Object.fromEntries(
    chain.map((key) => {
      const delta = absolute[key] - n;
      n = absolute[key];
      return [key, delta];
    }),
  );
  return {
    ...result,
    lead: absolute.lead,
    small: -absolute.small,
    label: -absolute.label,
  };
}
export function stepLimits(steps, key) {
  if (!chain.includes(key)) return key === 'lead' ? [0, 12] : [-12, 0];
  const a = absoluteSteps(steps);
  const i = chain.indexOf(key);
  const prev = i ? a[chain[i - 1]] : 0;
  const next = i < chain.length - 1 ? a[chain[i + 1]] : Infinity;
  return [
    Math.max(prev, next === Infinity ? 0 : next - 12),
    Math.min(prev + 12, next),
  ];
}
export function changeStep(steps, key, value) {
  const [min, max] = stepLimits(steps, key);
  const a = absoluteSteps(steps);
  a[key] = Math.max(min, Math.min(max, Math.round(value)));
  return relativeSteps(a);
}
export function contrastError(report) {
  for (const [kind, modes] of Object.entries(report.matrix))
    for (const [mode, context] of Object.entries(modes))
      for (const [role, pair] of Object.entries(context.pairs))
        if (!pair.passed)
          return `${kind}, ${mode}: ${role} ${pair.ratio.toFixed(2)}:1; needs ${pair.target}:1.`;
  return report.status === 'passed' ? '' : 'Contrast check failed.';
}

export const ratioName = (value) =>
  scales.find(([n]) => Math.abs(n - value) < 0.0005)?.[1] ?? 'Custom';
// Two decimals at least, three at most: 1.25, 1.067.
export const ratioText = (value) => value.toFixed(3).replace(/(\.\d\d)0$/, '$1');

/* ---- The number line of the type scale. ---- */
export const LINE = { min: 320, max: 1920 };
// A drag moves several px of width per px of screen, so it catches at the widths people aim for.
export const COMMON_WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440, 1920];
export const lineShare = (width) => (width - LINE.min) / (LINE.max - LINE.min);
export const lineWidth = (share) => {
  const width = Math.round(LINE.min + Math.min(1, Math.max(0, share)) * (LINE.max - LINE.min));
  return COMMON_WIDTHS.find((common) => Math.abs(common - width) <= 6) ?? width;
};
// What was typed, with a decimal comma or a unit if so; NaN if it is no number.
export const typedNumber = (text) => {
  const clean = text.trim().replace(',', '.').replace(/\s*px$/i, '');
  return clean === '' ? NaN : Number(clean);
};
export const typedRatio = (text, fallback) => {
  const value = typedNumber(text);
  return Number.isNaN(value) ? fallback : Math.round(Math.min(2, Math.max(1, value)) * 1000) / 1000;
};
export const typedWidth = (text, low, high, fallback) => {
  const value = typedNumber(text);
  return Number.isNaN(value) ? fallback : Math.round(Math.min(high, Math.max(low, value)));
};
// The left breakpoint may reach the right one and no further, and the other way around.
export const breakpointLimits = ({ min, max }, end) => (end === 'min' ? [LINE.min, max] : [min, LINE.max]);
// Each label centred on its point; apart when they would touch, and inside the line's ends.
export function spreadLabels(a, b, width, total, gap = 8) {
  let left = a - width / 2;
  let right = b - width / 2;
  const short = left + width + gap - right;
  if (short > 0) {
    left -= short / 2;
    right += short / 2;
  }
  if (right > total - width) {
    right = total - width;
    left = Math.min(left, right - width - gap);
  }
  if (left < 0) {
    left = 0;
    right = Math.max(right, width + gap);
  }
  return [left, right];
}
// With one arrow moved only its own label goes, and stops short of the other, which keeps its place:
// nothing but what is in the hand moves. Any other time the two stand as spreadLabels has it.
export function placeLabels(before, a, b, width, total, gap = 8) {
  const same = before?.width === width && before?.total === total;
  if (same && before.a === a && before.b === b) return before;
  const centred = (at) => Math.min(total - width, Math.max(0, at - width / 2));
  let left;
  let right;
  if (same && before.b === b) {
    right = before.right;
    left = Math.min(centred(a), right - width - gap);
  } else if (same && before.a === a) {
    left = before.left;
    right = Math.max(centred(b), left + width + gap);
  } else {
    [left, right] = spreadLabels(a, b, width, total, gap);
  }
  return { a, b, width, total, left, right };
}

// A request sent as a page goes away may carry 64 KiB, and one logo can weigh more than that. So a
// logo the server already holds stays behind as a mark in its place, and the server puts it back.
export const KEPT_LOGO = 'kept';
const LOGOS = ['logo', 'logo-dark'];
export const logosOf = (project) => Object.fromEntries(LOGOS.map((key) => [key, project[key]]));
export function withoutSavedLogos(model, saved) {
  const project = { ...model.project };
  for (const key of LOGOS) if (project[key] && project[key] === saved[key]) project[key] = KEPT_LOGO;
  return { ...model, project };
}
export function withKeptLogos(incoming, held) {
  if (!incoming?.project) return incoming;
  const project = { ...incoming.project };
  for (const key of LOGOS) if (project[key] === KEPT_LOGO) project[key] = held[key];
  return { ...incoming, project };
}

// A camera's photo is far more than a page shows, and a presentation carries every picture it has.
export const PICTURE_MAX_SIDE = 2000;
export const pictureSize = (width, height) => {
  const scale = Math.min(1, PICTURE_MAX_SIDE / Math.max(width, height));
  return [Math.round(width * scale), Math.round(height * scale)];
};

// The divider between the controls and the preview. The controls' words and the preview's margins are
// in rem, so what they need grows with the reader's text size: `scale` is that size over the default.
// The frames' window widths and the divider are real pixels, whatever the text size.
export const DIVIDER = 9;
export const SNAP = 18;
const MIN_CONTROLS = 490;
const COMFORTABLE_CONTROLS = 540;
const MOBILE = 390;
const MOBILE_ALONE_MARGIN = 50;
const MIN_ALONE = 431;
const MIN_BOTH = 640;
export const clampControls = (width, view, windowWidth, scale = 1) =>
  Math.round(Math.max(
    MIN_CONTROLS * scale,
    Math.min(width, windowWidth - DIVIDER - (view === 'both' ? MIN_BOTH : MIN_ALONE) * scale),
  ));
// Side by side, the desktop end needs 20rem beside the mobile end, the gap and the margins, or its width menu and
// figure no longer fit; with less, Both puts the mobile end above the desktop end, so both stay of use.
const MIN_DESKTOP_END = 320;
export const bothSideBySide = (paneWidth, scale = 1) => paneWidth >= MOBILE + (MIN_DESKTOP_END + 48) * scale;
// The controls get a comfortable measure; the preview gets the rest, up to real size.
export function optimalControls(view, windowWidth, desktopWidth, scale = 1) {
  const preview =
    view === 'phone'
      ? MOBILE + MOBILE_ALONE_MARGIN * scale
      : view === 'desktop'
        ? desktopWidth + 32 * scale
        : MOBILE + desktopWidth + 48 * scale;
  const wanted = windowWidth - DIVIDER - preview;
  return clampControls(
    view === 'phone' ? wanted : Math.max(COMFORTABLE_CONTROLS * scale, wanted),
    view,
    windowWidth,
    scale,
  );
}
export function dragControls(pointer, view, windowWidth, desktopWidth, scale = 1) {
  const optimal = optimalControls(view, windowWidth, desktopWidth, scale);
  const width = clampControls(Math.round(pointer), view, windowWidth, scale);
  const caught = Math.abs(width - optimal) <= SNAP;
  return { width: caught ? optimal : width, atOptimal: caught };
}

// Dragged up from off, Strength catches at the strength the tuned shadows are made for.
export const snapStrength = (value) => (Math.abs(value - REFERENCE.strength) <= 3 ? REFERENCE.strength : value);

// How much of what is set at one breakpoint reaches a window.
export const followShare = (end, width, scale) =>
  Math.round((end === 'narrow' ? 1 - windowShare(scale, width) : windowShare(scale, width)) * 100);
export const previewScale = (available, width, fit) =>
  fit ? Math.min(1, available / width) : 1;
// "Space and shape" does not fit the menu, and its last word says enough there.
export const shortChapter = (name) => {
  const word = name.split(/\s+(?:and|och|&)\s+/).at(-1);
  return word[0].toUpperCase() + word.slice(1);
};

/* ---- A client's own menu and footer, as the Start page takes them in words and the design file keeps them. ---- */
// What stands before a line's words: spaces and tabs, a bullet, a number, or the lines of a drawn tree, as an outline
// or a site map pasted from a document, a site or a terminal has them. All of it counts as indentation, so a bulleted
// line under a plain one is its child, as it reads.
const LEAD = /^(?:\s+|[│├└┬┼╰╭┊┆┃┣┗|`]+|[-─━]{2,}|[-*+•◦▪▫‣⁃–—·●○■□►▸o](?=\s)|\d+(?:\.\d+)*[.)](?=\s)|\d+(?:\.\d+)+(?=\s)|[a-z]\)(?=\s))+/iu;
const TAB = 4;
const lines = (text) => String(text ?? '').split(/\r\n?|\n/);
const hasWords = (words) => /[\p{L}\p{N}]/u.test(words);
function splitLine(line) {
  const lead = LEAD.exec(line)?.[0] ?? '';
  const indent = [...lead].reduce((column, character) => (character === '\t' ? column + TAB - (column % TAB) : column + 1), 0);
  return { indent, words: line.slice(lead.length).replace(/\s+/g, ' ').trim() };
}
// One item a line, a line set in further than the one above it is its child, and a dash with a space on either side
// begins an item's short description. A line set in less goes back up to the line it lines up with, or between.
export function parseMenu(text) {
  const root = {};
  const open = [{ indent: -1, item: root }];
  for (const line of lines(text)) {
    const { indent, words } = splitLine(line);
    if (!hasWords(words)) continue;
    const dash = /\s[-–—]\s/.exec(words);
    const item = { label: dash ? words.slice(0, dash.index) : words };
    if (dash && hasWords(words.slice(dash.index + 3))) item.description = words.slice(dash.index + 3);
    while (open.at(-1).indent >= indent) open.pop();
    (open.at(-1).item.items ??= []).push(item);
    open.push({ indent, item });
  }
  return root.items ?? [];
}
export const menuText = (items = [], depth = 0) => items.map((item) => [
  `${'  '.repeat(depth)}${item.label}${item.description ? ` - ${item.description}` : ''}`,
  ...(item.items?.length ? [menuText(item.items, depth + 1)] : []),
].join('\n')).join('\n');
// One link a line, as it reads. Bullets go, and a row of links pasted as one line, parted by bullets or bars, parts.
export const parseList = (text) => lines(text).flatMap((line) => splitLine(line).words.split(/\s[•·|]\s/)).map((words) => words.trim()).filter(hasWords);
export const listText = (items = []) => items.join('\n');
// Text keeps its lines, each as a line of its own, with its spaces made single and its empty lines gone.
export const parseText = (text) => lines(text).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
// A network by any of its names, in any case, or by an address that is its; any other words stay as they are.
const bare = (words) => words.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function networkOf(words) {
  const named = SOCIAL_NETWORKS.find(({ name, also = [] }) => [name, ...also].some((other) => bare(other) === bare(words)));
  if (named) return named.name;
  const host = /^(?:[a-z]+:\/\/)?(?:www\.|m\.)?([^\s/?#:@]+\.[a-z]{2,})(?:[/?#:]|$)/i.exec(words)?.[1].toLowerCase();
  const hosted = host && SOCIAL_NETWORKS.find(({ hosts = [] }) => hosts.some((own) => host === own || host.endsWith(`.${own}`)));
  if (hosted) return hosted.name;
  if (/^mailto:|^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(words)) return 'Email';
  if (/^(?:[a-z]+:\/\/)?\S+(?:\/feed|\/rss|\.rss|\.atom)\/?$/i.test(words)) return 'RSS';
  return words;
}
export const parseNetworks = (text) => [...new Set(parseList(text).map(networkOf))];
// The footer's cells a design can fill with its own words, in the order of the Footer page's miniature, with the kind
// of words each takes. The upper band's A1 is the brand, which the identity already gives.
export const OWN_FOOTER_CELLS = [
  ['upper', 'b1', 'networks'],
  ['upper', 'a2', 'text'],
  ['upper', 'b2', 'links'],
  ['lower', 'a1', 'text'],
  ['lower', 'b1', 'text'],
  ['lower', 'a2', 'links'],
  ['lower', 'b2', 'links'],
];
const READ = { menu: parseMenu, networks: parseNetworks, links: parseList, text: parseText };
const WRITE = { menu: menuText, networks: listText, links: listText, text: (value) => value ?? '' };
// What a field's words come to in the design file, and the words that stand for what the file holds.
export const parseOwn = (kind, text) => READ[kind](text);
export const ownText = (kind, value) => WRITE[kind](value);
export const ownValue = (project, path) => path.split('.').reduce((object, key) => object?.[key], project);
// Puts a design's own words in its `project`, at a path such as `menu` or `footer.lower.a1`. What is empty goes, and so
// does a group it leaves empty, so a design without any keeps none, as a file from before there were any.
export function setOwn(project, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const empty = value === undefined || value === '' || (Array.isArray(value) && !value.length);
  const chain = [project];
  for (const key of keys) {
    const here = chain.at(-1);
    if (typeof here[key] !== 'object' || here[key] === null) {
      if (empty) return;
      here[key] = {};
    }
    chain.push(here[key]);
  }
  if (!empty) {
    chain.at(-1)[last] = value;
    return;
  }
  delete chain.at(-1)[last];
  for (let index = keys.length - 1; index >= 0 && !Object.keys(chain[index + 1]).length; index--) delete chain[index][keys[index]];
}
// An outline taken from a pasted list, its items with their depth, in the words the menu's field takes.
export const outlineText = (entries) => entries.map(({ depth, words }) => `${'  '.repeat(depth)}${words}`).join('\n');
