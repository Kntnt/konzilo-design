import { derive, hexToOklch, oklchToHex, contrast, fitRolesToFaces } from '/src/generator/index.js';
import { rem } from '/src/generator/fluid.js';
import { coreCss } from '/src/css/index.js';
import { faceOf } from '/src/fonts/catalog.js';
import {
  absoluteSteps,
  changeStep,
  stepLimits,
  contrastError,
  dragControls,
  optimalControls,
  clampControls,
  bothSideBySide,
  sizeAt,
  snapStrength,
  shortChapter,
  ratioName,
  ratioText,
  typedRatio,
  typedWidth,
  pictureSize,
  breakpointLimits,
  lineShare,
  lineWidth,
  placeLabels,
  logosOf,
  withoutSavedLogos,
  parseOwn,
  ownText,
  ownValue,
  setOwn,
  outlineText,
  LINE,
  DIVIDER,
} from './logic.js';
import { capture, thaw, createHistory, historyAction, isSlider, isTextField, TYPING_PAUSE } from './history.js';
import { CHAPTERS, PAGES, MOVED_PAGES, ROLES, STEP_ROWS, SCALE_ROWS, axesMarkup, documentMarkup, pageName, tip, tipOnce, takeTips, escapeHtml } from './pages.js';
import { setupPreview, paint, measure, followPage } from './preview.js';
import { setupTooltips } from '/gallery/src/tooltips.js';
import { pictures, flatPictures, PICTURE_SLOTS, menu as sampleMenu } from '/presentation/src/samples.js';
// The Page page's drawing of the widths is not a control: it is fetched apart from the rest, and the tool runs without it.
const { pageSketch } = await import('/presentation/src/page-sketch.js').catch(() => ({}));

const params = new URLSearchParams(location.search);
const inPreviewWindow = params.get('window') === 'preview';
// Which window this is, kept over a reload. Its saves and its live line carry it, and its own preview window
// finds it by it, since a second window on the same design is on the same address.
const windowId = (() => {
  try {
    const id = sessionStorage.getItem('konzilo-tool-window') || crypto.randomUUID();
    sessionStorage.setItem('konzilo-tool-window', id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
})();
const tool = document.getElementById('tool');
const form = document.getElementById('form');
const doc = document.getElementById('document');
const statusBox = document.getElementById('status');
const statusText = document.getElementById('status-text');
const notice = document.getElementById('notice');
const presentation = document.getElementById('presentation');
const divider = document.getElementById('divider');
const optimalLine = document.getElementById('optimal-line');
const widthReadout = document.getElementById('divider-width');
const previewPane = document.getElementById('preview-pane');
const exportAi = document.getElementById('design-md');
if (inPreviewWindow) {
  document.documentElement.dataset.window = 'preview';
  tool.toggleAttribute('data-preview-window', true);
}

const data = await fetch('/api/state').then((response) => response.json());
const copy = data.copy;
// The design file as this window last read or wrote it, which each save says it builds on.
let revision = data.revision;
let model = { inputs: data.inputs, project: data.project };
const STORE = 'konzilo-tool-ui';
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
})();
const ui = {
  page: PAGES.includes(saved.page) ? saved.page : MOVED_PAGES[saved.page] ?? 'start',
  role: ROLES.some(([role]) => role === saved.role) ? saved.role : 'main',
  mode: saved.mode === 'dark' ? 'dark' : 'light',
  pictures: saved.pictures === 'off' ? 'off' : 'on',
  own: data.pictures,
  view: ['both', 'phone', 'desktop'].includes(saved.view) ? saved.view : 'both',
  width: [1440, 1024, 768].includes(saved.width) ? saved.width : 1440,
  fit: saved.fit !== false,
  where: 'pane',
  controls: Number(saved.controls) || 540,
  atOptimal: saved.atOptimal !== false,
  windowWidth: 1440,
  touched: null,
  // On the Start page, the part the field in use writes, `menu` or `footer`, which the preview follows.
  part: null,
};
// What the preview follows: the page, or on the Start page the part being written.
const followed = (state = ui) => (state.page === 'start' && state.part ? `start-${state.part}` : state.page);
const remember = () => {
  try {
    const { page, role, mode, pictures: showing, view, width, fit, controls, atOptimal } = ui;
    localStorage.setItem(STORE, JSON.stringify({ page, role, mode, pictures: showing, view, width, fit, controls, atOptimal }));
  } catch {
    // A browser without storage simply starts from the defaults next time.
  }
};

const getValue = (path) => path.split('.').reduce((object, key) => object?.[key], model);
const setValue = (path, value) => {
  const parts = path.split('.');
  const key = parts.pop();
  let object = model;
  for (const part of parts) object = object[part] ??= {};
  if (value === '') delete object[key];
  else object[key] = value;
};
// Once per text, so a message that comes back leaves no tooltips behind.
const tipOn = (element, text) => {
  const holder = document.createElement('span');
  holder.innerHTML = `<span ${tipOnce(text, text)}></span>`;
  for (const attribute of holder.firstChild.attributes) element.setAttribute(attribute.name, attribute.value);
};

/* ---- The controls that exist once, in the menu and over the preview. ---- */
function renderMenu() {
  document.getElementById('chapters').innerHTML = CHAPTERS.map(([id, pages]) => {
    const name = copy[`chapter.${id}`];
    return `<button class="chapter" type="button" data-go="${pages[0]}" data-chapter="${id}" ${tip(name)}>${escapeHtml(shortChapter(name))}</button>`;
  }).join('');
  document.getElementById('views').innerHTML = [
    ['both', 'Both', 'Mobile and desktop side by side. Where the preview is too narrow for a useful desktop end beside the mobile one, as beside the controls in a 1024 px window, mobile stands above desktop.'],
    ['phone', 'Mobile', 'Only mobile, at real size'],
    ['desktop', 'Desktop', 'Only desktop, as large as the pane allows'],
  ].map(([value, name, help]) => `<button type="button" data-view="${value}" ${tip(help)}>${name}</button>`).join('');
  document.getElementById('picture-control').innerHTML = [
    ['on', 'Pictures', 'Show the pages with pictures.'],
    ['off', 'None', 'Show the pages as they stand without pictures. Only the view changes, not the design.'],
  ].map(([value, name, help]) => `<button type="button" data-pictures="${value}" ${tip(help)}>${name}</button>`).join('');
  for (const holder of document.querySelectorAll('[data-theme-control]'))
    holder.innerHTML = [['light', 'Light'], ['dark', 'Dark']]
      .map(([value, name]) => `<button type="button" data-mode="${value}" ${tip(`${name}: the whole tool and the previews.`)}>${name}</button>`)
      .join('');
}
function renderPageRow() {
  const chapter = CHAPTERS.find(([, pages]) => pages.includes(ui.page));
  const row = document.getElementById('pages');
  // Written when the chapter changes and not at each page, so a link clicked keeps the focus.
  if (row.dataset.chapter !== chapter[0]) {
    row.dataset.chapter = chapter[0];
    row.innerHTML = chapter[1]
      .map((id) => {
        const name = escapeHtml(pageName(id, copy));
        // The name is there twice: once to read, and once in the current page's weight to hold the link's width.
        return `<button class="page-link" type="button" data-go="${id}" data-name="${name}" ${tipOnce(`page-${id}`, `Go to the page: ${copy[`${id}.title`]}.`)}>${name}</button>`;
      })
      .join('');
    document.body.insertAdjacentHTML('beforeend', takeTips());
  }
  for (const link of row.children) link.setAttribute('aria-current', String(link.dataset.go === ui.page));
  for (const button of document.querySelectorAll('.chapter')) button.setAttribute('aria-current', String(button.dataset.chapter === chapter[0]));
  for (const page of form.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== ui.page;
}
// The document scrolls in its own box, or with the whole window when the panes stand one above the other.
const scroller = () => (getComputedStyle(doc).overflowY === 'visible' ? document.scrollingElement : doc);
function goTo(page) {
  if (page === ui.page) return;
  ui.page = page;
  ui.part = null;
  renderPageRow();
  scroller().scrollTop = 0;
  followPage(page, true);
  remember();
  share();
}
function writeChrome() {
  document.documentElement.dataset.knMode = ui.mode;
  tool.dataset.where = ui.where;
  previewPane.dataset.view = ui.view;
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === ui.mode));
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === ui.view));
  for (const button of document.querySelectorAll('[data-pictures]')) button.setAttribute('aria-pressed', String(button.dataset.pictures === ui.pictures));
  document.getElementById('desktop-width').value = String(ui.width);
  document.getElementById('bring-back').hidden = ui.where !== 'window';
  const own = document.getElementById('own-window');
  own.textContent = inPreviewWindow ? 'Bring back' : 'Own window';
  const full = document.getElementById('full-window');
  full.textContent = ui.where === 'full' ? 'Back to controls' : 'Full window';
}
// The reader's text size over the default, which the room the controls and the preview need follows.
const rootSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const textScale = () => rootSize() / 16;
function layout() {
  const width = tool.clientWidth;
  if (!width) return;
  ui.windowWidth = width;
  ui.controls = ui.atOptimal ? optimalControls(ui.view, width, ui.width, textScale()) : clampControls(ui.controls, ui.view, width, textScale());
  tool.style.setProperty('--controls-width', `${ui.controls}px`);
  divider.dataset.optimal = String(ui.atOptimal);
  previewPane.toggleAttribute('data-stacked', ui.view === 'both' && !bothSideBySide(previewPane.clientWidth, textScale()));
  measure(ui);
}

/* ---- Colour: the sliders keep their own values, so a colour outside the gamut cannot move them. ---- */
const COLOURS = ['primary', 'secondary', 'tertiary'];
const lch = {};
const remembered = { secondary: model.inputs['brand-colors'].secondary || '#b66c32', tertiary: model.inputs['brand-colors'].tertiary || '#596db4' };
for (const key of COLOURS) {
  const { L, C, H } = hexToOklch(model.inputs['brand-colors'][key] || remembered[key]);
  lch[key] = { L, C, H };
}
const hexOf = (key) => oklchToHex(lch[key].L, lch[key].C, lch[key].H);
function setColourFromHex(key, hex) {
  model.inputs['brand-colors'][key] = hex.toLowerCase();
  if (key !== 'primary') remembered[key] = hex.toLowerCase();
  const { L, C, H } = hexToOklch(hex);
  lch[key] = { L, C, H };
}
function removeColour(key) {
  delete model.inputs['brand-colors'].tertiary;
  if (key === 'secondary') delete model.inputs['brand-colors'].secondary;
  for (const group of ['shadow', 'frame'])
    if (['secondary', 'tertiary'].includes(model.inputs[group].color) && !model.inputs['brand-colors'][model.inputs[group].color])
      model.inputs[group].color = 'default';
}
function colourTracks() {
  for (const key of COLOURS) {
    const { L, C, H } = lch[key];
    const hue = [0, 60, 120, 180, 240, 300, 360].map((h) => `oklch(${L.toFixed(3)} ${Math.max(C, 0.08).toFixed(3)} ${h})`).join(', ');
    const set = (axis, value) => { form.querySelector(`[data-track="lch.${key}.${axis}"]`).style.background = value; };
    set('H', `linear-gradient(90deg, ${hue})`);
    set('C', `linear-gradient(90deg, oklch(${L.toFixed(3)} 0 ${H.toFixed(1)}), oklch(${L.toFixed(3)} 0.3 ${H.toFixed(1)}))`);
    set('L', `linear-gradient(90deg, oklch(0.15 ${C.toFixed(3)} ${H.toFixed(1)}), oklch(0.5 ${C.toFixed(3)} ${H.toFixed(1)}), oklch(0.95 ${C.toFixed(3)} ${H.toFixed(1)}))`);
  }
  form.querySelector('[data-track="inputs.gray-temperature"]').style.background = 'linear-gradient(90deg, #7d93d6, #9c9c9c, #d6ae7d)';
}
function writeRamp(key, ramp) {
  const holder = form.querySelector(`[data-ramp="${key}"]`);
  const steps = Object.keys(ramp);
  if (holder.children.length !== steps.length)
    holder.innerHTML = steps.map((step) => `<div class="ramp-step" data-step-cell="${step}"><span>${step}</span><span></span></div>`).join('');
  const exact = model.inputs['brand-colors'][key]?.toLowerCase();
  for (const cell of holder.children) {
    const step = cell.dataset.stepCell;
    const hex = ramp[step];
    cell.style.background = hex;
    cell.style.color = contrast(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#111214';
    cell.lastElementChild.textContent = hex;
    cell.title = `${step}: ${hex}`;
    cell.dataset.exact = String(hex.toLowerCase() === exact);
  }
}

/* ---- Values and readouts. ---- */
let windowWidth = 1440;
let lineDrag = null;
const valueOf = (path) => {
  if (path === 'shadow-direction') return -model.inputs.shadow.angle;
  if (path.startsWith('lch.')) {
    const [, key, axis] = path.split('.');
    return lch[key][axis];
  }
  return getValue(path);
};
function readout(path, value, resolved) {
  if (path === 'inputs.shadow.strength') return value === 0 ? 'Off' : String(value);
  if (path === 'inputs.gray-temperature') return value === 0 ? 'Neutral' : `${value < 0 ? 'Cool' : 'Warm'} ${Math.abs(value)}`;
  if (path.includes('body-size') || path === 'inputs.frame.width' || path.startsWith('inputs.layout.')) return `${value} px`;
  if (path === 'inputs.corner-profile') return `${Math.round(resolved.radius.control * 10) / 10} / ${Math.round(resolved.radius.card * 10) / 10} px`;
  if (path === 'inputs.density-profile') return `${Math.round((0.5 + value / 100) * 100)} %`;
  if (path === 'shadow-direction') return value === 0 ? 'Down' : `${Math.abs(value)}° ${value < 0 ? 'left' : 'right'}`;
  if (path.endsWith('.H')) return `${Math.round(value)}°`;
  if (path.endsWith('.C')) return value.toFixed(3);
  if (path.endsWith('.L')) return `${Math.round(value * 100)} %`;
  return String(value);
}
function writeForm() {
  for (const control of form.querySelectorAll('[data-path]')) {
    const path = control.dataset.path;
    if (control.type === 'range') {
      continue;
    }
    let value = getValue(path);
    if (path === 'inputs.type.heading-1-color') value ||= 'text';
    // Set only when it differs, so a field keeps its caret and its own text undo.
    if (control.value !== String(value ?? '')) control.value = value ?? '';
  }
  for (const select of form.querySelectorAll('[data-font]')) {
    const value = chosenFace(select.dataset.font);
    const known = [...select.options].some((option) => option.value === value);
    select.value = known ? value : 'other';
    const other = form.querySelector(`[data-other="${select.dataset.font}"]`);
    if (other.value !== (known ? '' : value)) other.value = known ? '' : value;
    // Its place stays reserved, so choosing Other moves nothing.
    other.style.visibility = known ? 'hidden' : '';
  }
  for (const key of ['logo', 'logo-dark']) {
    const source = model.project[key];
    const image = form.querySelector(`[data-logo-image="${key}"]`);
    image.hidden = !source;
    // An image set again is decoded again.
    if (!source) image.removeAttribute('src');
    else if (image.getAttribute('src') !== source) image.src = source;
    form.querySelector(`[data-logo-word="${key}"]`).textContent = source ? '' : 'Click to add a logo';
    form.querySelector(`[data-remove-logo="${key}"]`).hidden = !source;
  }
  writeOwn();
}
// The client's own menu and footer: each field shows what the design file holds, in its words, but stays as typed
// while it comes to the same, so its caret, the browser's own text undo and the way it was written stay.
function writeOwn() {
  for (const field of form.querySelectorAll('[data-own]')) {
    const { own: path, ownKind: kind } = field.dataset;
    const words = ownText(kind, ownValue(model.project, path));
    if (JSON.stringify(parseOwn(kind, field.value)) !== JSON.stringify(parseOwn(kind, words))) field.value = words;
  }
  writeOwnStates();
}
// Each part says whether the client's words or the sample's show. The links for navigation, left empty, are the top
// level of the menu shown, so their grey text follows the menu.
function writeOwnStates() {
  const menu = model.project.menu?.length ? model.project.menu : sampleMenu;
  for (const state of form.querySelectorAll('[data-own-state]')) {
    const path = state.dataset.ownState;
    const own = ownValue(model.project, path);
    const filled = Array.isArray(own) ? own.length > 0 : Boolean(own);
    state.textContent = path === 'menu'
      ? (filled ? 'The client’s own, in the header and the large menu' : 'The sample menu until the client’s own is written')
      : filled ? 'Client’s' : path === 'footer.upper.b2' && menu !== sampleMenu ? 'From the menu' : 'Sample';
  }
  const links = form.querySelector('[data-own="footer.upper.b2"]');
  const wanted = menu.map((item) => item.label).join('\n');
  if (links.placeholder !== wanted) links.placeholder = wanted;
}
function writeSliders(resolved) {
  for (const control of form.querySelectorAll('input[type="range"][data-path]')) {
    const path = control.dataset.path;
    const value = valueOf(path);
    // A slider in the user's hand already shows its value, and setting it again would snag.
    if (document.activeElement !== control || !control.matches(':active')) control.value = String(value);
    form.querySelector(`[data-output="${path}"]`).value = readout(path, value, resolved);
  }
}
// Toggles and drawings have no value of their own to show, so they are written here, and what cannot apply is off.
function writeFrameControls() {
  const { header, footer } = model.inputs;
  for (const button of form.querySelectorAll('[data-flag]')) button.setAttribute('aria-pressed', String(Boolean(getValue(button.dataset.flag))));
  for (const button of form.querySelectorAll('[data-pick]')) button.setAttribute('aria-pressed', String(getValue(button.dataset.pick) === button.dataset.value));
  const items = { identity: true, links: header['link-menu'], search: header.search, language: header.language, menu: header['menu-button'] !== 'off', cta: header.cta };
  for (const item of form.querySelectorAll('[data-mini]')) item.toggleAttribute('data-off', !items[item.dataset.mini]);
  const sticky = header.attachment === 'sticky';
  form.querySelector('[data-path="inputs.header.start"]').disabled = !sticky;
  form.querySelector('[data-flag="inputs.header.autohide"]').disabled = !sticky;
  // Behind the hero's text lies either a picture, with its overlay, or a colour, so one control stands in the place of both.
  const pictureBehind = model.inputs.hero.picture === 'behind';
  form.querySelector('[data-path="inputs.hero.surface"]').closest('label').hidden = pictureBehind;
  form.querySelector('[data-path="inputs.hero.overlay"]').closest('label').hidden = !pictureBehind;
  // In the footer's miniature a cell that is on wears its band's colour, and one that is off stands empty on the page.
  for (const cell of form.querySelectorAll('.footer-mini-cell')) {
    if (cell.getAttribute('aria-pressed') === 'true') cell.dataset.knSurface = footer[cell.parentElement.dataset.miniBand].surface;
    else delete cell.dataset.knSurface;
  }
  // Without a trail nothing else about it can apply.
  for (const control of form.querySelectorAll('[data-page="breadcrumbs"] :is(select, .pick, .chip)'))
    if (control.dataset.flag !== 'inputs.breadcrumbs.show') control.disabled = !model.inputs.breadcrumbs.show;
}
// The number line: a menu names the scale a base is on, or says it is on none.
function writeScaleLine() {
  const { breakpoints, ratio } = model.inputs.type;
  for (const end of ['min', 'max']) {
    const select = form.querySelector(`[data-ratio="${end}"]`);
    const custom = select.querySelector('option[value="custom"]');
    const named = [...select.options].some((option) => option.value !== 'custom' && Number(option.value) === ratio[end]);
    custom.hidden = named;
    if (!named) custom.textContent = `Custom (${ratioText(ratio[end])})`;
    select.value = named ? String(ratio[end]) : 'custom';
    form.querySelector(`[data-line-name="${end}"]`).textContent = ratioName(ratio[end]);
    const base = form.querySelector(`[data-line-base="${end}"]`);
    if (document.activeElement !== base) base.value = ratioText(ratio[end]);
    const [low, high] = breakpointLimits(breakpoints, end);
    const arrow = form.querySelector(`[data-arrow="${end}"]`);
    arrow.setAttribute('aria-valuemin', low);
    arrow.setAttribute('aria-valuemax', high);
  }
  placeScaleLine();
}
// Arrows stand exactly on their widths; the labels keep clear of one another and of the line's ends.
const labelPlaces = {};
function placeScaleLine() {
  const line = form.querySelector('[data-scale-line]');
  const track = line.querySelector('[data-line-track]');
  const total = line.clientWidth;
  if (!total) return;
  const { breakpoints } = model.inputs.type;
  const widths = { min: breakpoints.min, max: breakpoints.max, view: windowWidth };
  const at = Object.fromEntries(Object.entries(widths).map(([key, width]) => [key, track.offsetLeft + lineShare(width) * track.offsetWidth]));
  for (const [key, width] of Object.entries(widths)) {
    const arrow = line.querySelector(`[data-arrow="${key}"]`);
    arrow.style.left = `${at[key]}px`;
    arrow.setAttribute('aria-valuenow', width);
    arrow.setAttribute('aria-valuetext', `${width} px`);
    const field = line.querySelector(`[data-line-px="${key}"]`);
    if (document.activeElement !== field) field.value = String(width);
  }
  for (const attribute of ['data-stack', 'data-line-label']) {
    const [left, right] = ['min', 'max'].map((end) => line.querySelector(`[${attribute}="${end}"]`));
    const placed = (labelPlaces[attribute] = placeLabels(labelPlaces[attribute], at.min, at.max, left.offsetWidth, total));
    left.style.left = `${placed.left}px`;
    right.style.left = `${placed.right}px`;
  }
  const view = line.querySelector('[data-line-label="view"]');
  view.style.left = `${Math.min(total - view.offsetWidth, Math.max(0, at.view - view.offsetWidth / 2))}px`;
}
// The Page page's drawing, in the presentation's words and the tool's figures. Its heights are fixed, so a width dragged
// changes what it shows and moves nothing; it is written anew only when that has changed.
const sketchWords = {
  t: (key, values = {}) => (copy[key] ?? '').replace(/\{([\w-]+)\}/g, (_, name) => values[name] ?? `{${name}}`),
  num: (value) => String(Math.round(value)),
};
let sketched = '';
function writePageSketch(resolved) {
  const host = form.querySelector('[data-page-sketch]');
  if (!pageSketch || !host) return;
  const markup = pageSketch(resolved, sketchWords);
  if (markup !== sketched) host.innerHTML = sketched = markup;
}
function writeResolved(resolved) {
  for (const [key, ramp] of Object.entries(resolved.ramps)) if (form.querySelector(`[data-ramp="${key}"]`)) writeRamp(key, ramp);
  for (const key of COLOURS) {
    const on = Boolean(model.inputs['brand-colors'][key]);
    if (key !== 'primary') form.querySelector(`[data-colour-block="${key}"]`).hidden = !on;
    if (!on) continue;
    const field = form.querySelector(`[data-hex="${key}"]`);
    if (document.activeElement !== field) field.value = model.inputs['brand-colors'][key];
  }
  const adding = !model.inputs['brand-colors'].secondary ? 'secondary' : !model.inputs['brand-colors'].tertiary ? 'tertiary' : null;
  const add = form.querySelector('[data-add-colour]');
  add.hidden = !adding;
  add.textContent = adding === 'secondary' ? 'Add a second colour' : 'Add a third colour';
  for (const select of form.querySelectorAll('[data-path="inputs.shadow.color"], [data-path="inputs.frame.color"]'))
    for (const option of select.options)
      if (['secondary', 'tertiary'].includes(option.value)) option.disabled = !model.inputs['brand-colors'][option.value];
  for (const box of form.querySelectorAll('[data-surface-case]')) {
    const surface = box.dataset.surfaceCase;
    box.hidden = !resolved.surfaces[surface];
    if (box.hidden) continue;
    const pairs = resolved['contrast-check'].matrix[surface][ui.mode].pairs;
    for (const figure of box.querySelectorAll('[data-ratio]')) figure.textContent = pairs[figure.dataset.ratio].ratio.toFixed(1);
  }
  const absolute = absoluteSteps(model.inputs.type.steps);
  for (const [key] of SCALE_ROWS) {
    const size = sizeAt(resolved['type-scale'], resolved.type[key].step, windowWidth);
    form.querySelector(`[data-size="${key}"]`).value = `${Math.round(size)} px`;
    form.querySelector(`[data-step-sample="${key}"]`).style.fontSize = rem(Number(size.toFixed(1)));
  }
  for (const [key] of STEP_ROWS) {
    form.querySelector(`[data-step-value="${key}"]`).value = String(absolute[key]);
    const [min, max] = stepLimits(model.inputs.type.steps, key);
    for (const button of form.querySelectorAll(`[data-step="${key}"]`))
      button.disabled = Number(button.dataset.delta) < 0 ? absolute[key] <= min : absolute[key] >= max;
  }
  document.getElementById('scale-warning').textContent = Math.max(resolved.type.display.size.min, resolved.type.display.size.max) > 100 ? 'The largest heading exceeds 100 px. A higher ratio usually needs fewer steps.' : '';
  writeAxes(resolved);
  writeScaleLine();
  writeFrameControls();
  writePageSketch(resolved);
  for (const button of form.querySelectorAll('[data-target]')) button.setAttribute('aria-pressed', String(Boolean(model.inputs.shadow.targets[button.dataset.target])));
  form.querySelector('[data-dial]').setAttribute('transform', `rotate(${model.inputs.shadow.angle} 22 22)`);
  colourTracks();
}

/* ---- One change: check it, show it everywhere, save it. ---- */
let valid = false;
let generating = false;
// The design as last reckoned, passing or not: the controls show this one.
let current = null;
// The last that passed: the preview keeps this one until another passes.
let good = null;
function setStatus(state, text) {
  statusBox.dataset.state = state;
  statusText.textContent = text;
}
// A link opens what the message is about, and each action is a button with its words, its tooltip and what it does.
function showNotice(text, link, actions = []) {
  delete notice.dataset.kind;
  // The menu is as tall as its lines need, and the notice stands just under it.
  notice.style.top = `${document.querySelector('.menu').offsetHeight / rootSize() + 0.5}rem`;
  notice.replaceChildren();
  const words = document.createElement('span');
  words.textContent = text;
  notice.append(words);
  if (link) {
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.textContent = 'Open';
    notice.append(anchor);
  }
  for (const [words, help, act] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'notice-action';
    button.textContent = words;
    tipOn(button, help);
    button.addEventListener('click', () => {
      notice.hidden = true;
      act();
    });
    notice.append(button);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close this message');
  close.addEventListener('click', () => { notice.hidden = true; });
  tipOn(close, 'Close this message.');
  document.body.insertAdjacentHTML('beforeend', takeTips());
  notice.append(close);
  notice.hidden = false;
}
// Only what changed is set again: colours change the drawn people, and must not touch the photos.
function writePictures(resolved) {
  const sources = flatPictures(pictures(resolved.ramps, ui.own));
  PICTURE_SLOTS.forEach((slot, index) => {
    const image = form.querySelector(`[data-picture-image="${slot}"]`);
    if (image.getAttribute('src') !== sources[index]) image.src = sources[index];
    form.querySelector(`[data-remove-picture="${slot}"]`).hidden = !ui.own[slot];
  });
}
function sync() {
  let failure = '';
  try {
    current = derive(model.inputs);
    failure = contrastError(current['contrast-check']);
  } catch (error) {
    failure = error.message;
  }
  valid = !failure;
  exportAi.disabled = !valid;
  if (valid) {
    if (notice.dataset.kind === 'contrast') {
      notice.hidden = true;
      delete notice.dataset.kind;
    }
    presentation.disabled = generating;
    good = { resolved: current, css: coreCss(current) };
    document.getElementById('kn-live-core').textContent = good.css;
  } else {
    presentation.disabled = true;
    setStatus('error', 'Not saved');
    showNotice(`This setting fails the contrast check, so the preview keeps the last good design. ${failure}`);
    notice.dataset.kind = 'contrast';
  }
  // What only changes how the preview is looked at still reaches it.
  if (good) paint(good.resolved, good.css, model.project, ui);
  // Whichever design the preview keeps, each control shows what the model holds.
  if (!inPreviewWindow && current) {
    writeResolved(current);
    writeSliders(current);
    writePictures(current);
  }
  return valid;
}
let saveTimer = null;
// A change not yet on its way to the server, whether it waits for the pause or for the save before it.
let unsent = false;
let saving = Promise.resolve();
let savedLogos = logosOf(data.project);
// A request the tool never got, since it is not running. What it carried is still to be sent.
const offline = () => Object.assign(new Error('The design tool is not running.'), { offline: true });
async function request(endpoint, method, type, body, options) {
  const send = () => fetch(endpoint, {
    method,
    headers: { 'Content-Type': type, 'X-Konzilo-Token': data.token, 'X-Konzilo-Base': revision, 'X-Konzilo-Window': windowId },
    body,
    ...options,
  }).catch(() => { throw offline(); });
  let response = await send();
  // A restarted tool has a new session. With the same file open the work here goes on; with another, saving would overwrite that design.
  if (response.status === 403) {
    const state = await fetch('/api/state').then((answer) => answer.json()).catch(() => { throw offline(); });
    if (state.path !== data.path) throw new Error('The tool now has another design open, so this window can no longer save. Close it, and open this design again with design-tool.');
    data.token = state.token;
    response = await send();
  }
  if (response.status === 503) throw offline();
  const answer = await response.json();
  // Someone else changed the file since this window read it: another window, a restore, a script.
  if (response.status === 409 && answer.conflict) throw Object.assign(new Error(answer.error), { conflict: answer.conflict });
  if (!response.ok) throw new Error(answer.error);
  if (answer.revision) revision = answer.revision;
  return answer;
}
// The logos as they were sent, which the server holds once it has answered.
async function post(endpoint) {
  unsent = false;
  const logos = logosOf(model.project);
  try {
    const answer = await request(endpoint, 'POST', 'application/json', JSON.stringify(model));
    savedLogos = logos;
    return answer;
  } catch (error) {
    // Still to be saved, when the tool is back or the clash is settled.
    if (error.offline || error.conflict) unsent = true;
    throw error;
  }
}
// A camera's photo is made a JPEG of a sensible size here, so the folder holds what a presentation carries.
async function pictureFile(file) {
  const bitmap = await createImageBitmap(file);
  const [width, height] = pictureSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The photo could not be made a JPEG.'))), 'image/jpeg', 0.82));
}
async function changePicture(slot, method, type, body) {
  try {
    const { pictures: own } = await request(`/api/picture?slot=${slot}`, method, type, body);
    setUi({ own });
  } catch (error) {
    showNotice(`The picture could not be saved. ${error.message}`);
  }
}
function saveAnswered(answer) {
  // A setting since then that fails the contrast check still says it is not saved.
  if (!unsent && valid) setStatus('saved', 'Saved');
  tipStatus(answer.path);
}
// What a refusal says: a clash asks which design to keep, a tool not running says how to start it, and the rest say why.
function explain(error) {
  if (error.conflict) showConflict(error.conflict);
  else if (error.offline) whyLost();
  else showNotice(error.message);
}
function saveRefused(error) {
  setStatus('error', 'Not saved');
  explain(error);
}
function scheduleSave() {
  clearTimeout(saveTimer);
  unsent = true;
  setStatus('busy', 'Saving');
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saving = saving.then(async () => {
      // A setting that fails the contrast check is held back, and the next that passes goes in its place.
      if (!unsent || !valid) return;
      try {
        saveAnswered(await post('/api/save'));
      } catch (error) {
        saveRefused(error);
      }
    });
  }, 450);
}
// The page is going away, and the pause with it. The same token and the same checks as any save: with a
// restarted tool the token is old, so the server refuses this before it could reach another design.
function flushSave() {
  if (!unsent || !valid) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  unsent = false;
  request('/api/save', 'POST', 'application/json', JSON.stringify(withoutSavedLogos(model, savedLogos)), { keepalive: true }).then(saveAnswered, saveRefused);
}
/* ---- The roles: each sets its own typeface and its own axes. ---- */
const STYLE_OF_ROLE = { main: 'body', heading: 'heading-3', 'heading-1': 'heading-1', display: 'display', label: 'label', monospace: 'mono' };
const stackOfRole = (role, resolved) => (role === 'heading-1' ? resolved.typefaces['heading-1'] || resolved.typefaces.heading : resolved.typefaces[role]);
// What a role's list shows: its own typeface, or which role it follows.
function chosenFace(role) {
  const { typefaces, type } = model.inputs;
  if (role === 'heading-1') return typefaces['heading-1'] || (type['heading-1-role'] === 'display' ? '@display' : '');
  if (role === 'label') return typefaces.label || (type.label === 'monospace' ? '@monospace' : '');
  return typefaces[role] || '';
}
function setFace(role, value) {
  const { typefaces, type } = model.inputs;
  const own = value.startsWith('@') ? '' : value;
  if (own) typefaces[role] = own;
  else delete typefaces[role];
  if (role === 'heading-1') {
    if (value === '@display') type['heading-1-role'] = 'display';
    else delete type['heading-1-role'];
  }
  if (role === 'label') type.label = value === '@monospace' ? 'monospace' : 'main';
  // A new typeface keeps only the settings it has axes and sets for, inside their ranges, as `resolve` does. Followers
  // change with it.
  fitRolesToFaces(model.inputs);
}
function tidyRoles() {
  const roles = model.inputs.type.roles;
  if (!roles) return;
  for (const [role, settings] of Object.entries(roles)) if (!Object.keys(settings).length) delete roles[role];
  if (!Object.keys(roles).length) delete model.inputs.type.roles;
}
function setRole(key, value) {
  const roles = (model.inputs.type.roles ??= {});
  (roles[ui.role] ??= {})[key] = value;
}
function setAxis(tag, value) {
  if (tag === 'wght') return setRole('weight', value);
  if (tag === 'spacing') return setRole('letter-spacing', value);
  const roles = (model.inputs.type.roles ??= {});
  ((roles[ui.role] ??= {}).axes ??= {})[tag] = value;
}
function resetAxis(tag) {
  const settings = model.inputs.type.roles?.[ui.role];
  if (!settings) return;
  if (tag === 'wght') delete settings.weight;
  else if (tag === 'spacing') delete settings['letter-spacing'];
  else if (settings.axes) {
    delete settings.axes[tag];
    if (!Object.keys(settings.axes).length) delete settings.axes;
  }
  tidyRoles();
}
const isSet = (tag) => {
  const settings = model.inputs.type.roles?.[ui.role];
  if (tag === 'wght') return settings?.weight !== undefined;
  if (tag === 'spacing') return settings?.['letter-spacing'] !== undefined;
  return settings?.axes?.[tag] !== undefined;
};
function showRole() {
  for (const tab of form.querySelectorAll('[data-role-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.roleTab === ui.role));
  for (const row of form.querySelectorAll('[data-role-row]')) row.hidden = row.dataset.roleRow !== ui.role;
  renderAxes();
  if (current) writeAxes(current);
}
// Written only when the role or its typeface changes, so a slider in the hand stays where it is.
let axesFace;
function renderAxes() {
  const host = form.querySelector('[data-axes]');
  if (!host || !current) return;
  const face = faceOf(stackOfRole(ui.role, current));
  const key = `${ui.role}:${face?.family}`;
  if (axesFace === key) return;
  axesFace = key;
  host.innerHTML = axesMarkup(face);
  document.body.insertAdjacentHTML('beforeend', takeTips());
}
function writeAxes(resolved) {
  const host = form.querySelector('[data-axes]');
  if (!host) return;
  renderAxes();
  const stack = stackOfRole(ui.role, resolved);
  const face = faceOf(stack);
  const recipe = resolved.type[STYLE_OF_ROLE[ui.role]];
  const valueOfAxis = (tag) => {
    if (tag === 'wght') return recipe.weight;
    if (tag === 'spacing') return recipe['letter-spacing'];
    if (tag === 'wdth') return recipe.stretch ?? face.axes.wdth[1];
    return recipe.variation?.[tag] ?? (tag === 'opsz' ? recipe.size.max : face.axes[tag][1]);
  };
  for (const control of host.querySelectorAll('[data-axis]')) {
    const tag = control.dataset.axis;
    const value = valueOfAxis(tag);
    if (!control.matches(':active')) control.value = String(value);
    const shown = host.querySelector(`[data-axis-reset="${tag}"]`);
    shown.textContent = tag === 'opsz' && recipe.variation?.opsz === undefined ? 'Auto' : tag === 'spacing' ? Number(value).toFixed(3) : String(Math.round(value * 100) / 100);
    shown.toggleAttribute('data-changed', isSet(tag));
  }
  const features = recipe.features?.value ?? '';
  for (const box of host.querySelectorAll('[data-set]')) box.checked = features.includes(`"${box.dataset.set}"`);
  const specimen = form.querySelector('[data-specimen]');
  specimen.style.fontFamily = stack;
  specimen.style.fontStretch = recipe.stretch ? `${recipe.stretch}%` : '';
  specimen.style.fontVariationSettings = recipe.variation ? Object.entries(recipe.variation).map(([axis, value]) => `"${axis}" ${value}`).join(', ') : '';
  specimen.style.fontFeatureSettings = recipe.features ? recipe.features.value : '';
  specimen.style.setProperty('--specimen-weight', recipe.weight);
  specimen.style.setProperty('--specimen-spacing', `${recipe['letter-spacing']}em`);
  form.querySelector('[data-face-name]').textContent = stack.split(',')[0].replaceAll('"', '').replace('system-ui', 'System sans-serif').replace('ui-monospace', 'System monospace');
}
const tipStatus = (path) => { statusBox.title = `Every change is saved to ${path}`; };
let tuning = null;
function show() {
  document.documentElement.toggleAttribute('data-tuning', true);
  clearTimeout(tuning);
  tuning = setTimeout(() => document.documentElement.removeAttribute('data-tuning'), 250);
  if (sync()) scheduleSave();
  share();
}
function changed() {
  noteChange();
  show();
}

/* ---- History: one step a gesture. A change only marks a step open, and the model is read when it closes, so a drag costs nothing. ---- */
const designHistory = createHistory(capture(model));
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');
// The colour sliders' own values, so a colour outside the gamut comes back where its sliders stood.
const sliderState = new WeakMap();
let pointerHeld = false;
let keyHeld = false;
let openStep = null;
let stepTimer = null;
function writeHistoryButtons() {
  const focused = document.activeElement;
  const byKeyboard = focused?.matches(':focus-visible');
  undoButton.disabled = !designHistory.canUndo && !openStep;
  redoButton.disabled = !designHistory.canRedo || Boolean(openStep);
  // A button disabled under the focus would swallow the keys that follow.
  if ((focused === undoButton || focused === redoButton) && focused.disabled) {
    focused.blur();
    if (byKeyboard) (focused === undoButton ? redoButton : undoButton).focus({ preventScroll: true });
  }
}
function closeStep() {
  clearTimeout(stepTimer);
  if (!openStep) return;
  const place = openStep;
  openStep = null;
  if (designHistory.record(capture(model, designHistory.present), place)) sliderState.set(designHistory.present, structuredClone(lch));
  writeHistoryButtons();
}
// What is in the hand closes when it is let go, what is being typed when it pauses, and the rest at once.
function closeWhenDone() {
  clearTimeout(stepTimer);
  if (openStep && !pointerHeld && !keyHeld) stepTimer = setTimeout(closeStep, isTextField(document.activeElement) ? TYPING_PAUSE : 0);
}
function noteChange() {
  if (!openStep) {
    openStep = { page: ui.page, role: ui.role, scroll: scroller().scrollTop };
    writeHistoryButtons();
  }
  closeWhenDone();
}
function restoreColours(state) {
  const slid = sliderState.get(state);
  for (const key of COLOURS) {
    const hex = model.inputs['brand-colors'][key]?.toLowerCase();
    if (!hex) continue;
    if (key !== 'primary') remembered[key] = hex;
    const { L, C, H } = slid && oklchToHex(slid[key].L, slid[key].C, slid[key].H) === hex ? slid[key] : hexToOklch(hex);
    lch[key] = { L, C, H };
  }
}
// The same way out as an ordinary change, and to the page of the change, since a change out of sight confuses.
function moveThroughHistory(action) {
  if (pointerHeld) return;
  closeStep();
  const step = action === 'undo' ? designHistory.undo() : designHistory.redo();
  if (!step) return;
  model = thaw(step.state);
  restoreColours(step.state);
  // So that choosing the same file again counts as a change.
  for (const input of form.querySelectorAll('[data-logo]')) input.value = '';
  ui.touched = null;
  writeForm();
  show();
  goTo(step.place.page);
  if (step.place.page === 'main-typeface' && step.place.role !== ui.role) {
    ui.role = step.place.role;
    showRole();
    remember();
  }
  // Last, since the page and the role decide how far it can scroll.
  scroller().scrollTop = step.place.scroll;
  writeHistoryButtons();
}
function historyKey(event) {
  const action = historyAction(event);
  if (!action || isTextField(event.target)) return;
  event.preventDefault();
  if (inPreviewWindow) channel.postMessage({ type: 'history', action });
  else moveThroughHistory(action);
}
function letGo() {
  pointerHeld = false;
  closeWhenDone();
}
window.addEventListener('pointerdown', (event) => {
  // A list's menu keeps the pointer's way back up to itself.
  pointerHeld = !event.target.closest?.('select');
  keyHeld = false;
}, true);
window.addEventListener('pointerup', letGo, true);
window.addEventListener('pointercancel', letGo, true);
window.addEventListener('pointermove', (event) => {
  if (pointerHeld && !event.buttons) letGo();
}, true);
window.addEventListener('keydown', (event) => {
  // With Cmd down a Mac sends no keyup, so that is not a key held.
  if (isSlider(event.target) && !event.metaKey && !event.ctrlKey) keyHeld = true;
  historyKey(event);
}, true);
window.addEventListener('keyup', () => {
  if (!keyHeld) return;
  keyHeld = false;
  closeWhenDone();
}, true);
document.addEventListener('focusout', (event) => {
  if (isTextField(event.target)) closeStep();
});
window.addEventListener('blur', () => {
  keyHeld = false;
  if (!pointerHeld) closeStep();
});
undoButton.addEventListener('click', () => moveThroughHistory('undo'));
redoButton.addEventListener('click', () => moveThroughHistory('redo'));

/* ---- The form. ---- */
const END_OF = { 'inputs.type.ratio.min': 'narrow', 'inputs.type.body-size.min': 'narrow', 'inputs.type.ratio.max': 'wide', 'inputs.type.body-size.max': 'wide' };

/* ---- The number line: arrows to drag, figures to type, a menu for the named scales. ---- */
const lineDragging = (on) => form.querySelector('[data-scale-line]').toggleAttribute('data-dragging', on);
const widthOf = (key) => (key === 'view' ? windowWidth : model.inputs.type.breakpoints[key]);
function setScaleBase(end, value) {
  const path = `inputs.type.ratio.${end}`;
  setValue(path, value);
  ui.touched = END_OF[path];
  changed();
}
function setLineWidth(key, width) {
  if (key === 'view') {
    if (width === windowWidth) return;
    windowWidth = width;
    if (current) writeResolved(current);
    return;
  }
  const { breakpoints } = model.inputs.type;
  const [low, high] = breakpointLimits(breakpoints, key);
  const placed = Math.min(high, Math.max(low, width));
  if (placed === breakpoints[key]) return;
  setValue(`inputs.type.breakpoints.${key}`, placed);
  ui.touched = null;
  changed();
}
form.addEventListener('pointerdown', (event) => {
  const arrow = event.target.closest('[data-arrow]');
  if (!arrow) return;
  event.preventDefault();
  arrow.focus({ preventScroll: true, focusVisible: false });
  arrow.setPointerCapture(event.pointerId);
  lineDrag = { key: arrow.dataset.arrow, startX: event.clientX, decided: arrow.dataset.arrow === 'view' };
  lineDragging(true);
});
form.addEventListener('pointermove', (event) => {
  if (!lineDrag) return;
  const { breakpoints } = model.inputs.type;
  // Two arrows on one width lie on top of each other, so the way the pointer goes says which one it took.
  if (!lineDrag.decided) {
    if (event.clientX === lineDrag.startX) return;
    if (breakpoints.min === breakpoints.max) lineDrag.key = event.clientX < lineDrag.startX ? 'min' : 'max';
    lineDrag.decided = true;
    form.querySelector(`[data-arrow="${lineDrag.key}"]`).focus({ preventScroll: true, focusVisible: false });
  }
  const { left, width } = form.querySelector('[data-line-track]').getBoundingClientRect();
  setLineWidth(lineDrag.key, lineWidth((event.clientX - left) / width));
});
function endLineDrag() {
  if (!lineDrag) return;
  lineDrag = null;
  lineDragging(false);
}
form.addEventListener('pointerup', endLineDrag);
form.addEventListener('pointercancel', endLineDrag);
form.addEventListener('keydown', (event) => {
  const arrow = event.target.closest('[data-arrow]');
  if (arrow) {
    const key = arrow.dataset.arrow;
    const now = widthOf(key);
    const step = event.shiftKey ? 10 : 1;
    const next = { ArrowLeft: now - step, ArrowDown: now - step, ArrowRight: now + step, ArrowUp: now + step, Home: LINE.min, End: LINE.max }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setLineWidth(key, Math.min(LINE.max, Math.max(LINE.min, next)));
    return;
  }
  const field = event.target.closest('[data-line-base], [data-line-px]');
  if (!field) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    field.blur();
  } else if (event.key === 'Escape') {
    field.value = field.dataset.lineBase ? ratioText(model.inputs.type.ratio[field.dataset.lineBase]) : String(widthOf(field.dataset.linePx));
    field.blur();
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    const delta = event.key === 'ArrowUp' ? 1 : -1;
    if (field.dataset.lineBase) {
      field.value = ratioText(typedRatio(field.value, model.inputs.type.ratio[field.dataset.lineBase]) + delta * 0.001);
    } else {
      field.value = String(typedWidth(field.value, LINE.min, LINE.max, widthOf(field.dataset.linePx)) + delta * (event.shiftKey ? 10 : 1));
    }
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
// A click on a figure selects it, ready to be typed over.
form.addEventListener('focusin', (event) => {
  if (event.target.matches('[data-line-base], [data-line-px]')) event.target.select();
});
function commitLineField(field) {
  if (field.dataset.lineBase) {
    const end = field.dataset.lineBase;
    const value = typedRatio(field.value, model.inputs.type.ratio[end]);
    if (value !== model.inputs.type.ratio[end]) setScaleBase(end, value);
    field.value = ratioText(value);
    return;
  }
  const key = field.dataset.linePx;
  const [low, high] = key === 'view' ? [LINE.min, LINE.max] : breakpointLimits(model.inputs.type.breakpoints, key);
  const width = typedWidth(field.value, low, high, widthOf(key));
  setLineWidth(key, width);
  field.value = String(width);
}
form.addEventListener('submit', (event) => event.preventDefault());
// A field of the client's own, once left, shows what it came to, so what is kept is what is seen: bullets gone, two
// spaces a level, a network by its name. Not while the window is away, where the caret must stay where it was.
form.addEventListener('focusout', (event) => {
  const field = event.target.closest?.('[data-own]');
  if (!field) return;
  setTimeout(() => {
    if (document.activeElement === field) return;
    const words = ownText(field.dataset.ownKind, ownValue(model.project, field.dataset.own));
    if (field.value !== words) field.value = words;
  });
});
// On the Start page the preview follows the field in use: the menu's takes the page to its top, where the header is,
// and a footer cell's to its end. The large menu stands open under the page there all the time.
form.addEventListener('focusin', (event) => {
  const field = event.target.closest?.('[data-own]');
  if (!field || ui.page !== 'start') return;
  const part = field.dataset.own === 'menu' ? 'menu' : 'footer';
  if (ui.part === part) return;
  ui.part = part;
  followPage(followed(), true);
  share();
});
// An outline copied from a document or a site holds its levels for certain as a list in its HTML, while its plain text
// may have lost them: so a pasted list comes into the menu's field in its words, set in two spaces a level.
function outlineFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // A node's own words, without the lists in it or Word's bullets, with a space wherever two elements meet.
  const wordsOf = (node) => {
    const copy = node.cloneNode(true);
    for (const inner of copy.querySelectorAll('ul, ol, [style*="mso-list:ignore" i]')) inner.remove();
    const walker = doc.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
    return parts.join(' ').replace(/\s+/g, ' ').replace(/ ([,.;:!?])/g, '$1').trim();
  };
  const entries = [];
  let headed = false;
  let listed = false;
  for (const node of doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, li, p[style*="mso-list" i]')) {
    const words = wordsOf(node);
    if (!words) continue;
    // A heading over a list, as a site's large menu or a site map has them, is the level above the list.
    if (/^h\d$/.test(node.localName)) {
      headed = true;
      entries.push({ depth: 0, words });
      continue;
    }
    listed = true;
    let depth = -1;
    if (node.localName === 'p') depth = Number(/level(\d+)/i.exec(node.getAttribute('style'))?.[1] ?? 1) - 1;
    // A Google Docs list says each item's level; otherwise it is how many lists hold it.
    else if (Number(node.getAttribute('aria-level')) >= 1) depth = Number(node.getAttribute('aria-level')) - 1;
    else for (let up = node.parentElement; up; up = up.parentElement) if (up.localName === 'ul' || up.localName === 'ol') depth += 1;
    entries.push({ depth: Math.max(0, depth) + (headed ? 1 : 0), words });
  }
  return listed ? outlineText(entries) : null;
}
form.addEventListener('paste', (event) => {
  const field = event.target.closest?.('[data-own-kind="menu"]');
  const html = field && event.clipboardData?.getData('text/html');
  const outline = html && outlineFromHtml(html);
  if (!outline) return;
  event.preventDefault();
  // As typed, so the field's own undo takes it back; where a browser cannot, as typed all the same.
  if (!document.execCommand('insertText', false, outline)) {
    field.setRangeText(outline, field.selectionStart, field.selectionEnd, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
form.addEventListener('input', (event) => {
  const control = event.target;
  const path = control.dataset.path;
  // A typed figure counts when it is done, not at each key.
  if (control.dataset.lineBase || control.dataset.linePx) return;
  if (control.dataset.own) {
    setOwn(model.project, control.dataset.own, parseOwn(control.dataset.ownKind, control.value));
    writeOwnStates();
    ui.touched = null;
    return changed();
  }
  if (control.dataset.hex) {
    if (!/^#[0-9a-f]{6}$/i.test(control.value)) return;
    setColourFromHex(control.dataset.hex, control.value);
  } else if (control.dataset.font) {
    setFace(control.dataset.font, control.value === 'other' ? form.querySelector(`[data-other="${control.dataset.font}"]`).value || 'Local Typeface' : control.value);
    writeForm();
    changed();
    renderAxes();
    if (current) writeAxes(current);
    return;
  } else if (control.dataset.other) {
    setFace(control.dataset.other, control.value || 'Local Typeface');
  } else if (control.dataset.ratio) {
    return setScaleBase(control.dataset.ratio, Number(control.value));
  } else if (control.dataset.axis) {
    setAxis(control.dataset.axis, Number(control.value));
  } else if (control.dataset.set) {
    setRole('features', [...form.querySelectorAll('[data-set]')].filter((box) => box.checked).map((box) => box.dataset.set));
  } else if (path === 'shadow-direction') {
    model.inputs.shadow.angle = -Number(control.value);
  } else if (path?.startsWith('lch.')) {
    const [, key, axis] = path.split('.');
    lch[key][axis] = Number(control.value);
    model.inputs['brand-colors'][key] = hexOf(key);
    if (key !== 'primary') remembered[key] = model.inputs['brand-colors'][key];
  } else if (path?.startsWith('inputs.page.fill-') && control.value && !/^[-#(),.%/ a-zA-Z0-9]+$/.test(control.value)) {
    // Half a gradient is still being typed; only what could be a colour goes on to the design.
    return;
  } else if (path) {
    const number = control.type === 'range';
    let value = number ? Number(control.value) : control.value;
    if (path === 'inputs.shadow.strength') control.value = String((value = snapStrength(value)));
    setValue(path, value);
  }
  ui.touched = END_OF[path] || null;
  changed();
});
form.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.go) return goTo(button.dataset.go);
  if (button.dataset.roleTab) {
    ui.role = button.dataset.roleTab;
    showRole();
    remember();
    return;
  }
  if (button.dataset.axisReset) {
    event.preventDefault();
    resetAxis(button.dataset.axisReset);
    return changed();
  }
  if (button.dataset.chooseLogo) return form.querySelector(`[data-logo="${button.dataset.chooseLogo}"]`).click();
  if (button.dataset.choosePicture) return form.querySelector(`[data-picture="${button.dataset.choosePicture}"]`).click();
  if (button.dataset.removePicture) {
    form.querySelector(`[data-picture="${button.dataset.removePicture}"]`).value = '';
    return changePicture(button.dataset.removePicture, 'DELETE', 'application/json');
  }
  if (button.dataset.removeLogo) {
    model.project[button.dataset.removeLogo] = null;
    form.querySelector(`[data-logo="${button.dataset.removeLogo}"]`).value = '';
    writeForm();
  } else if (button.dataset.step) {
    const key = button.dataset.step;
    model.inputs.type.steps = changeStep(model.inputs.type.steps, key, absoluteSteps(model.inputs.type.steps)[key] + Number(button.dataset.delta));
    ui.touched = null;
  } else if (button.hasAttribute('data-add-colour')) {
    const key = !model.inputs['brand-colors'].secondary ? 'secondary' : 'tertiary';
    model.inputs['brand-colors'][key] = remembered[key];
  } else if (button.dataset.removeColour) {
    removeColour(button.dataset.removeColour);
  } else if (button.dataset.flag) {
    setValue(button.dataset.flag, !getValue(button.dataset.flag));
  } else if (button.dataset.pick) {
    setValue(button.dataset.pick, button.dataset.value);
  } else if (button.dataset.target) {
    const targets = model.inputs.shadow.targets;
    targets[button.dataset.target] = !targets[button.dataset.target];
  } else return;
  changed();
});
form.addEventListener('change', async (event) => {
  if (event.target.dataset.lineBase || event.target.dataset.linePx) return commitLineField(event.target);
  if (event.target.dataset.picture) {
    const file = event.target.files[0];
    if (!file) return undefined;
    let jpeg;
    try {
      jpeg = await pictureFile(file);
    } catch {
      return showNotice('This browser cannot read that file. Choose a JPEG, PNG or WebP.');
    }
    return changePicture(event.target.dataset.picture, 'POST', 'image/jpeg', jpeg);
  }
  if (!event.target.dataset.logo) return;
  const key = event.target.dataset.logo;
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/svg+xml', 'image/png'].includes(file.type)) return showNotice('Choose an SVG or PNG logo.');
  if (file.size > 5 * 1024 * 1024) return showNotice('Choose a logo smaller than 5 MB.');
  const uri = await new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result);
    reader.onerror = fail;
    reader.readAsDataURL(file);
  });
  model.project[key] = uri;
  writeForm();
  changed();
});

/* ---- The menu, the preview's own controls and the divider. ---- */
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || form.contains(button)) return;
  if (button.dataset.go) goTo(button.dataset.go);
  else if (button.dataset.mode) setUi({ mode: button.dataset.mode });
  else if (button.dataset.view) setUi({ view: button.dataset.view });
  else if (button.dataset.pictures) setUi({ pictures: button.dataset.pictures });
});
document.getElementById('desktop-width').addEventListener('change', (event) => setUi({ width: Number(event.target.value) }));
document.getElementById('fit').addEventListener('click', () => setUi({ fit: !ui.fit }));
document.getElementById('full-window').addEventListener('click', () => {
  ui.where = ui.where === 'full' ? 'pane' : 'full';
  writeChrome();
  layout();
});
function setUi(patch) {
  if (inPreviewWindow) {
    channel.postMessage({ type: 'ui', patch });
    return;
  }
  const followAfter = patch.view && patch.view !== ui.view;
  Object.assign(ui, patch);
  writeChrome();
  layout();
  sync();
  if (followAfter) followPage(followed(), false);
  remember();
  share();
}
divider.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const box = tool.getBoundingClientRect();
  tool.toggleAttribute('data-dragging', true);
  optimalLine.hidden = false;
  optimalLine.style.insetInlineStart = `${optimalControls(ui.view, box.width, ui.width, textScale())}px`;
  const move = (moved) => {
    const { width, atOptimal } = dragControls(moved.clientX - box.left - DIVIDER / 2, ui.view, box.width, ui.width, textScale());
    ui.controls = width;
    ui.atOptimal = atOptimal;
    layout();
    widthReadout.hidden = false;
    widthReadout.style.insetInlineStart = `${width}px`;
    widthReadout.textContent = atOptimal ? `${width} px · Optimal` : `${width} px`;
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    tool.removeAttribute('data-dragging');
    optimalLine.hidden = true;
    widthReadout.hidden = true;
    remember();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});
divider.addEventListener('dblclick', () => {
  ui.atOptimal = true;
  layout();
  remember();
});
divider.addEventListener('keydown', (event) => {
  if (event.key === 'Home') {
    event.preventDefault();
    ui.atOptimal = true;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const { width, atOptimal } = dragControls(ui.controls + (event.key === 'ArrowLeft' ? -24 : 24), ui.view, ui.windowWidth, ui.width, textScale());
    ui.controls = width;
    ui.atOptimal = atOptimal;
  } else return;
  layout();
  remember();
});
exportAi.addEventListener('click', async () => {
  if (!valid) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const answer = await post('/api/design-md');
    setStatus('saved', 'Saved');
    showNotice(`Exported for AI agents: ${answer.path}`);
  } catch (error) {
    explain(error);
  }
});
presentation.addEventListener('click', async () => {
  if (!valid || generating) return;
  generating = true;
  presentation.disabled = true;
  showNotice('Saving and creating the presentation…');
  try {
    clearTimeout(saveTimer);
    saveTimer = null;
    const answer = await post('/api/presentation');
    setStatus('saved', 'Saved');
    showNotice(`Presentation ready: ${answer.path}`, '/api/presentation-file');
  } catch (error) {
    explain(error);
  } finally {
    generating = false;
    presentation.disabled = !valid;
  }
});

/* ---- A second window, on another screen if there is one. ---- */
const channel = new BroadcastChannel(`konzilo-tool-${inPreviewWindow ? params.get('main') : windowId}`);
let previewWindow = null;
let watcher = null;
const share = () => {
  if (!inPreviewWindow && ui.where === 'window') channel.postMessage({ type: 'state', model, ui });
};
function watchWindow() {
  clearInterval(watcher);
  watcher = setInterval(() => {
    if (previewWindow?.closed) backToPane();
  }, 700);
}
function backToPane() {
  clearInterval(watcher);
  previewWindow = null;
  ui.where = 'pane';
  writeChrome();
  layout();
  sync();
  followPage(followed(), false);
}
function openOwnWindow() {
  const opened = window.open(`/?window=preview&main=${windowId}`, `konzilo-preview-${windowId}`, 'popup,width=1500,height=950');
  if (!opened) return showNotice('The browser blocked the window. Allow pop-ups for this address and try again.');
  previewWindow = opened;
  ui.where = 'window';
  writeChrome();
  layout();
  watchWindow();
  return undefined;
}
document.getElementById('own-window').addEventListener('click', () => {
  if (inPreviewWindow) channel.postMessage({ type: 'bring-back' });
  else openOwnWindow();
});
document.getElementById('bring-back').addEventListener('click', () => {
  previewWindow?.close();
  backToPane();
});
let previewFollowed = null;
channel.addEventListener('message', ({ data: message }) => {
  if (inPreviewWindow) {
    if (message.type === 'state') {
      model = message.model;
      const page = followed(message.ui);
      Object.assign(ui, message.ui, { where: 'pane', controls: ui.controls, atOptimal: ui.atOptimal });
      writeChrome();
      layout();
      sync();
      if (page !== previewFollowed) {
        followPage(page, previewFollowed !== null);
        previewFollowed = page;
      }
      document.title = `Preview · ${model.project.name || 'Konzilo'}`;
    } else if (message.type === 'main-gone') {
      window.close();
    } else if (message.type === 'who') {
      channel.postMessage({ type: 'hello' });
    }
    return;
  }
  if (message.type === 'hello') {
    if (ui.where !== 'window') {
      previewWindow = window.open('', `konzilo-preview-${windowId}`);
      ui.where = 'window';
      writeChrome();
      layout();
      watchWindow();
    }
    share();
  } else if (message.type === 'ui') {
    setUi(message.patch);
  } else if (message.type === 'history') {
    moveThroughHistory(message.action);
  } else if (message.type === 'bring-back') {
    previewWindow?.close();
    backToPane();
  }
});
window.addEventListener('pagehide', () => {
  flushSave();
  if (!inPreviewWindow && ui.where === 'window') channel.postMessage({ type: 'main-gone' });
});

/* ---- The live line: the tool's news, and how it knows that this window is open. ---- */
// The open line, if there is one, and the attempt under way; there is only ever one of either.
let line = null;
let attempt = null;
let retry = null;
let tries = 0;
let restarting = false;
const quoted = (path) => (/^[\w@%+=:,./-]+$/.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`);
// Another window saved, or the file changed while the tool was away: this window takes the design as the file
// has it. Its own steps were made on a design that is no longer there, so its history starts again here.
function adopt(state, words) {
  // A file that cannot be read now, such as one half written by another program, is not taken.
  if (!state?.inputs) {
    showNotice(`The design file could not be read. ${state?.error ?? ''}`);
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = null;
  unsent = false;
  closeStep();
  model = { inputs: state.inputs, project: state.project };
  revision = state.revision;
  data.token = state.token;
  savedLogos = logosOf(state.project);
  restoreColours(undefined);
  for (const input of form.querySelectorAll('[data-logo]')) input.value = '';
  ui.touched = null;
  writeForm();
  designHistory.reset(capture(model));
  writeHistoryButtons();
  setUi({ own: state.pictures });
  if (valid) setStatus('saved', 'Saved');
  if (words) showNotice(words);
}
const readState = () => fetch('/api/state').then((answer) => answer.json());
// A change being made here is not taken over: its save meets the other change, and asks.
const busyHere = () => unsent || saveTimer || openStep || pointerHeld || keyHeld;
async function follow(words) {
  if (busyHere()) return;
  const state = await readState().catch(() => null);
  if (!state?.inputs || state.path !== data.path || state.revision === revision || busyHere()) return;
  adopt(state, words);
}
function showConflict(fileRevision) {
  showNotice('The design file has changed in another window or outside the tool since this window read it, so this change was not saved.', null, [
    ['Use the file', 'Show the design as the file has it now, and drop the change not saved here.', async () => adopt(await readState())],
    ['Keep this window\'s', 'Save the design as this window shows it, over the change made elsewhere.', () => {
      revision = fileRevision;
      scheduleSave();
    }],
  ]);
  notice.dataset.kind = 'conflict';
}
// Why the line is down: the tool has stopped, or this address now has another design open.
async function whyLost() {
  const answer = await fetch('/api/hello').then((response) => (response.ok ? response.json() : null), () => null);
  if (line || restarting) return;
  setStatus('error', 'Not saved');
  if (answer?.app === 'konzilo-design-tool' && answer.path !== data.path)
    showNotice('The tool on this address now has another design open, so this window can no longer save. Close it, and open this design again with design-tool.');
  else showNotice(`The design tool has stopped, so changes here are not saved. Start it again with: design-tool ${quoted(data.path)}`);
  notice.dataset.kind = 'lost';
}
// Back on the line, after the tool was away: the same file goes on, and what was not saved is saved now.
async function back() {
  const state = await readState().catch(() => null);
  if (!state?.inputs || state.path !== data.path) return;
  data.token = state.token;
  if (notice.dataset.kind === 'lost') {
    notice.hidden = true;
    delete notice.dataset.kind;
  }
  if (state.revision !== revision && !busyHere()) adopt(state, 'The design file changed while the tool was away. This window shows it as it is now, and Undo starts again from here.');
  else if (unsent) scheduleSave();
  else if (valid) setStatus('saved', 'Saved');
}
function connect() {
  clearTimeout(retry);
  if (line || attempt) return;
  const socket = new WebSocket(`ws://${location.host}/api/live?window=${encodeURIComponent(windowId)}&path=${encodeURIComponent(data.path)}`);
  attempt = socket;
  socket.addEventListener('open', () => {
    attempt = null;
    line = socket;
    const wasAway = tries > 0;
    tries = 0;
    restarting = false;
    if (wasAway) back();
  });
  socket.addEventListener('message', ({ data: text }) => {
    const news = JSON.parse(text);
    if (news.type === 'saved' && news.by !== windowId && news.revision !== revision) follow('Changed in another window. This window shows the design as saved there, and Undo starts again from here.');
    else if (news.type === 'changed' && news.revision !== revision) follow('The design file was changed outside the tool. This window shows it as it is now, and Undo starts again from here.');
    else if (news.type === 'pictures' && news.by !== windowId) readState().then((state) => setUi({ own: state.pictures }), () => {});
    else if (news.type === 'restarting') restarting = true;
  });
  socket.addEventListener('close', () => {
    if (line === socket) line = null;
    if (attempt === socket) attempt = null;
    tries += 1;
    // A tool started again with changed code is back within seconds; until it is, nothing needs saying.
    if (restarting && tries > 60) restarting = false;
    if (!restarting && (tries === 2 || (tries > 2 && notice.dataset.kind !== 'lost'))) whyLost();
    retry = setTimeout(connect, restarting || tries < 2 ? 300 : tries < 30 ? 2000 : 5000);
  });
}
// A page brought back from the browser's history has lost its line, and takes it up again at once.
window.addEventListener('pageshow', (event) => {
  if (event.persisted && !inPreviewWindow) connect();
});

/* ---- Start. ---- */
renderMenu();
tipOn(divider, 'Drag to share the width. It catches at the best position. Double-click to go back to it.');
tipOn(presentation, 'Save the design and create the browsable presentation in a ZIP archive.');
tipOn(exportAi, 'Save the design and write it beside the design file as a ZIP for an AI agent that is to build a site from it: DESIGN.md with the logos, fonts and icons it names.');
tipOn(document.getElementById('own-window'), 'Open the preview in a window of its own, to put on your other screen.');
tipOn(document.getElementById('full-window'), 'Let the preview fill the whole window, or put it back.');
tipOn(document.getElementById('bring-back'), 'Close the preview window and put the preview back beside the controls.');
tipOn(document.getElementById('desktop-width'), 'The width of the desktop window. The page responds as it does at that width.');
tipOn(document.getElementById('fit'), 'Scaled so the whole page fits. Click for real size, then scroll sideways to see the rest.');
const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl';
tipOn(undoButton, `Undo the last change, on the page it was made on. ${modifier}+Z.`);
tipOn(redoButton, `Redo the change just undone. ${modifier}+Shift+Z or Ctrl+Y.`);
if (!inPreviewWindow) {
  form.innerHTML = documentMarkup(copy);
  document.body.insertAdjacentHTML('beforeend', takeTips());
  document.title = `${model.project.name || 'Konzilo'} · Konzilo Design Tool`;
  renderPageRow();
  writeForm();
  for (const row of form.querySelectorAll('[data-role-row]')) row.hidden = row.dataset.roleRow !== ui.role;
  for (const tab of form.querySelectorAll('[data-role-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.roleTab === ui.role));
  setStatus('saved', 'Saved');
  tipStatus('the design file');
} else {
  document.body.insertAdjacentHTML('beforeend', takeTips());
}
setupTooltips();
writeChrome();
layout();
setupPreview((frame, panel) => {
  // The keys go where the focus is, and after a click in the preview that is inside a frame.
  frame.contentWindow?.addEventListener('keydown', historyKey);
  if (panel) return;
  sync();
  followPage(followed(), false);
});
new ResizeObserver(layout).observe(tool);
// The line's page may be hidden when the design is written, and the divider changes its width.
if (!inPreviewWindow) new ResizeObserver(placeScaleLine).observe(form.querySelector('[data-scale-line]'));
sync();
if (inPreviewWindow) channel.postMessage({ type: 'hello' });
else {
  channel.postMessage({ type: 'who' });
  connect();
}
await document.fonts.ready;
layout();
