// The document: the presentation's pages, with their controls in place. Every control is written
// once and stays in the page, so changing a value never rebuilds what is being dragged.
import { SYSTEM_SANS, SYSTEM_MONOSPACE } from '/src/generator/defaults.js';
import { TYPEFACES, CATEGORIES } from '/src/fonts/catalog.js';
import { scales, LINE, COMMON_WIDTHS, lineShare } from './logic.js';
import { COMPONENT_GROUPS } from '/src/design-md/components.js';
import { componentPages } from '/presentation/src/catalog.js';

export const CHAPTERS = [
  ['start', ['start']],
  ['colour', ['colour-scale', 'colour-together']],
  ['typography', ['main-typeface', 'type-scale']],
  ['space', ['space', 'corners', 'shadow']],
  ['frame', ['header', 'footer', 'page', 'breadcrumbs']],
  ['components', ['opening', 'sections', 'text', 'buttons', 'cards', 'media', 'finding', 'forms']],
];
// The menu's row is short, so a page there may go by a shorter name than its heading.
const SHORT_NAMES = { opening: 'Opening', buttons: 'Buttons', media: 'Media', finding: 'Finding', forms: 'Forms', page: 'Page' };
export const pageName = (id, copy) => SHORT_NAMES[id] || copy[`${id}.title`];
export const PAGES = CHAPTERS.flatMap(([, pages]) => pages);
export const STEP_ROWS = [
  ['display', 'Display'],
  ['heading-1', 'H1'],
  ['heading-2', 'H2'],
  ['heading-3', 'H3'],
  ['heading-4', 'H4'],
  ['heading-5', 'H5'],
  ['heading-6', 'H6'],
  ['lead', 'Lead'],
  ['small', 'Small'],
  ['label', 'Label'],
];
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

let tipCount = 0;
const tips = [];
export function tip(text) {
  const id = `tip-${++tipCount}`;
  tips.push(`<span class="g-control-tip" hidden id="${id}" role="tooltip">${escapeHtml(text)}</span>`);
  return `aria-describedby="${id}" data-g-tooltip="${id}"`;
}
export const takeTips = () => tips.splice(0).join('');

const SHADOW_COLOURS = [
  ['default', 'Text'],
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['tertiary', 'Tertiary'],
  ['gray', 'Grey'],
  ['black', 'Black'],
];

function slider(label, path, min, max, help, { step = 1, low = '', high = '', colour = '' } = {}) {
  const ends = low || high
    ? `<span class="slider-ends"><span data-low="${path}">${escapeHtml(low)}</span><span>${escapeHtml(high)}</span></span>`
    : '';
  return `<label class="slider ui" ${colour ? `data-colour="${colour}"` : ''}>
    <span class="slider-label">${escapeHtml(label)}</span>
    <output class="slider-value figures" data-output="${path}"></output>
    <span class="slider-track" data-track="${path}"></span>
    <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" aria-label="${escapeHtml(label)}" ${tip(help)}>
    ${ends}
  </label>`;
}
function textField(label, path, help, type = 'text') {
  return `<label class="field ui">${escapeHtml(label)}<input class="input" type="${type}" data-path="${path}" ${tip(help)}></label>`;
}
function choice(label, path, choices, help) {
  return `<label class="field ui">${escapeHtml(label)}<span class="choice"><select data-path="${path}" ${tip(help)}>${choices
    .map(([value, name]) => `<option value="${escapeHtml(value)}">${escapeHtml(name)}</option>`)
    .join('')}</select></span></label>`;
}
function why(key, label, copy) {
  return `<div class="why"><span class="why-head ui"><b>${escapeHtml(label)}</b><span>The client reads this here, as it stands</span></span>
    <textarea data-path="project.explanations.${key}" aria-label="${escapeHtml(label)}" placeholder="${escapeHtml(copy['motivation.label'])}" ${tip('Optional. It appears in the presentation. Blank lines make paragraphs.')}></textarea></div>`;
}
function head(id, copy, { lead = true, fixed = false } = {}) {
  return `<header class="page-head ${fixed ? 'fixed' : ''}"><h1>${escapeHtml(copy[`${id}.title`])}</h1>${
    lead && copy[`${id}.lead`] ? `<p class="page-lead">${escapeHtml(copy[`${id}.lead`])}</p>` : ''
  }</header>`;
}
function next(id, copy) {
  const following = PAGES[PAGES.indexOf(id) + 1];
  if (!following) return '';
  return `<button class="next" type="button" data-go="${following}">${escapeHtml(copy[`${following}.title`])} →</button>`;
}

const PICTURE_TILES = [
  ['hero', 'Behind the hero', 'The picture a hero lies over, darkened so its text holds.'],
  ['panorama', 'Wide', 'A wide picture with its caption.'],
  ['landscape-1', 'Picture 1', 'The hero’s own picture, and the first card.'],
  ['landscape-2', 'Picture 2', 'The second card, a text with a picture and the video’s still.'],
  ['landscape-3', 'Picture 3', 'The third card and a text with a picture.'],
  ['landscape-4', 'Picture 4', 'The fourth card and an embedded video’s still.'],
  ['person-1', 'Person 1', 'A person’s card.'],
  ['person-2', 'Person 2', 'A person’s card.'],
  ['person-3', 'Person 3', 'A person’s card.'],
  ['person-4', 'Person 4', 'A person’s card.'],
];
function start(copy) {
  const tile = (key, label, background) => `<div class="logo-tile" ${background}>
    <input type="file" hidden data-logo="${key}" accept="image/svg+xml,image/png" aria-label="${escapeHtml(label)}">
    <button class="logo-pick ui" type="button" data-choose-logo="${key}" ${tip(`${label}: click to choose an SVG or PNG. It is embedded in the design file.`)}>
      <img data-logo-image="${key}" alt="" hidden><span data-logo-word="${key}"></span>
    </button>
    <button class="logo-remove ui" type="button" data-remove-logo="${key}" hidden ${tip('Remove this logo. The client name takes its place.')}>Remove</button>
  </div>`;
  return `${head('start', copy)}
    <div class="why"><span class="why-head ui"><b>Introduction</b><span>The client reads this first</span></span>
      <textarea data-path="project.introduction" aria-label="Introduction" placeholder="${escapeHtml(copy['start.how'])}" ${tip('Optional introduction on the first page of the presentation. Blank lines make paragraphs.')}></textarea></div>
    <div class="why"><span class="why-head ui"><b>Design brief</b><span>For the designers and AI agents, not the client</span></span>
      <textarea data-path="project.brief" aria-label="Design brief" placeholder="Who the site is for and how it should feel." ${tip('Optional. It opens the file exported for AI agents, and it is what most decides what they make. It is not shown in the presentation.')}></textarea></div>
    <div class="fields">
      ${textField('Client', 'project.name', 'The client name, in the preview and on every page of the presentation.')}
      ${textField('Version', 'project.version', 'The version on the first page and at the foot of every page of the presentation.')}
      ${textField('Contact name', 'project.contact.name', 'The name beside the contact address in the presentation.')}
      ${textField('Comments go to', 'project.contact.email', 'The address the client’s comments are mailed to. Without it they can still be saved or copied.', 'email')}
    </div>
    <div class="logos">
      ${tile('logo', 'Logo', 'data-kn-mode="light" data-kn-surface="page" style="box-shadow: inset 0 0 0 1px var(--kn-border); border-radius: var(--kn-radius-control)"')}
      ${tile('logo-dark', 'Logo for dark backgrounds', 'data-kn-surface="brand" style="border-radius: var(--kn-radius-control)"')}
    </div>
    <div class="why-head ui"><b>Pictures</b><span>Sample photos until the client’s own are added</span></div>
    <div class="picture-tiles">${PICTURE_TILES.map(([slot, name, help]) => `<div class="picture-tile">
      <input type="file" hidden data-picture="${slot}" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="${escapeHtml(name)}">
      <button class="picture-pick ui" type="button" data-choose-picture="${slot}" ${tip(`${help} Click to choose the client’s own photo. It is kept in a folder beside the design file.`)}>
        <img data-picture-image="${slot}" alt=""><span class="picture-name">${escapeHtml(name)}</span>
      </button>
      <button class="logo-remove ui" type="button" data-remove-picture="${slot}" hidden ${tip('Remove this photo. The sample takes its place.')}>Remove</button>
    </div>`).join('')}</div>`;
}

function colourBlock(key, name, job, removable) {
  return `<section class="colour" data-colour-block="${key}">
    <div class="colour-name"><h2>${escapeHtml(name)}</h2><p class="colour-job ui">${escapeHtml(job)}</p></div>
    <div class="colour-body">
      <div class="colour-controls ui">
        ${slider('Hue', `lch.${key}.H`, 0, 360, 'Turns the colour around the wheel. The whole scale follows.', { colour: 'H' })}
        ${slider('Chroma', `lch.${key}.C`, 0, 0.3, 'How much colour. At zero it is grey. Tints stay calm whatever you choose here.', { step: 0.002, colour: 'C' })}
        ${slider('Lightness', `lch.${key}.L`, 0.12, 0.95, 'Where the exact colour sits on its scale. The other steps keep their contrast against white.', { step: 0.002, colour: 'L' })}
        <input class="input figures" type="text" data-hex="${key}" maxlength="7" spellcheck="false" aria-label="${escapeHtml(name)} as hex" ${tip('The exact colour, as a six-digit hex value.')}>
      </div>
      <div class="ramp figures" data-ramp="${key}"></div>
      ${removable ? `<div class="colour-actions ui"><button class="link-button" type="button" data-remove-colour="${key}" ${tip('Removes this colour and its tint. Removing the second colour also removes the third.')}>Remove this colour</button></div>` : ''}
    </div>
  </section>`;
}
function colourScale(copy) {
  return `${head('colour-scale', copy)}
    <div class="colours">
      ${colourBlock('primary', 'Primary', 'The main colour: links, buttons and strong Surfaces.', false)}
      ${colourBlock('secondary', 'Secondary', 'Accents, focus and a tint of its own.', true)}
      ${colourBlock('tertiary', 'Tertiary', 'One more tint, to group content.', true)}
      <section class="colour">
        <div class="colour-name"><h2>Grey</h2><p class="colour-job ui">Text, hairlines and neutral Surfaces.</p></div>
        <div class="colour-body">
          <div class="colour-controls ui">${slider('Temperature', 'inputs.gray-temperature', -100, 100, 'Makes neutral colours cooler or warmer, without changing the brand colours.', { colour: 'T' })}</div>
          <div class="ramp figures" data-ramp="gray"></div>
        </div>
      </section>
    </div>
    <div class="colour-actions ui"><button class="link-button" type="button" data-add-colour ${tip('Adds another brand colour with a tint of its own. It shows in the preview at once.')}>Add a colour</button></div>
    ${why('colour', 'Why these colours', copy)}${next('colour-scale', copy)}`;
}
function colourTogether(copy) {
  const tile = (surface, name) => `<div class="surface-case" data-surface-case="${surface}">
    <div class="surface-tile" data-kn-surface="${surface}">
      <h2>${escapeHtml(copy['surface.sample'])}</h2><p>${escapeHtml(copy['surface.text'])}</p>
      <a href="#${surface}" tabindex="-1">${escapeHtml(copy['surface.link'])}</a>
      <span><span class="kn-button">${escapeHtml(copy['surface.button'])}</span></span>
    </div>
    <p class="surface-fine figures" data-surface-fine="${surface}" data-name="${escapeHtml(name)}"></p>
  </div>`;
  return `${head('colour-together', copy)}<div class="surfaces">
    ${[['page', 'Page'], ['raised', 'Raised'], ['tint', 'Tint'], ['tint-secondary', 'Second tint'], ['tint-tertiary', 'Third tint'], ['brand', 'Brand'], ['inverse', 'Inverse'], ['accent', 'Accent']].map(([surface, name]) => tile(surface, name)).join('')}
  </div>${next('colour-together', copy)}`;
}

const option = (value, name) => `<option value="${escapeHtml(value)}">${escapeHtml(name)}</option>`;
export const ROLES = [
  ['main', 'Text', 'Running text and nearly everything else.'],
  ['heading', 'Headings', 'The second heading and smaller.'],
  ['heading-1', 'First heading', 'The heading at the top of a page or article. It can follow the headings or display text.'],
  ['display', 'Display', 'The largest text, larger than the first heading.'],
  ['label', 'Labels', 'Eyebrows, metadata and other labels, all together.'],
  ['monospace', 'Code', 'Code and file names.'],
];
const FOLLOWS = {
  main: [],
  heading: [['', 'Same as Text']],
  'heading-1': [['', 'Same as Headings'], ['@display', 'Same as Display']],
  display: [['', 'Same as Headings']],
  label: [['', 'Same as Text'], ['@monospace', 'Same as Code']],
  monospace: [],
};
function faceChoices(role) {
  const groups = CATEGORIES.map(([category, name]) => {
    const faces = TYPEFACES.filter((face) => face.category === category && face.roles.includes(role));
    return faces.length ? `<optgroup label="${escapeHtml(name)}">${faces.map((face) => option(face.value, face.family)).join('')}</optgroup>` : '';
  }).join('');
  const system = role === 'monospace'
    ? option(SYSTEM_MONOSPACE, 'System monospace')
    : option(SYSTEM_SANS, 'System sans-serif') + option('Georgia, serif', 'System serif');
  return `${FOLLOWS[role].map(([value, name]) => option(value, name)).join('')}${groups}<optgroup label="On this computer">${system}${option('other', 'Other…')}</optgroup>`;
}
function faceRow(role, name, help) {
  return `<div class="face-row ui" data-role-row="${role}" hidden><span>Typeface</span>
    <span class="choice"><select data-font="${role}" aria-label="Typeface for ${escapeHtml(name)}" ${tip(help)}>${faceChoices(role)}</select></span>
    <input class="input" data-other="${role}" placeholder="Installed typeface" aria-label="Installed typeface for ${escapeHtml(name)}" ${tip('The exact name of a typeface installed on this computer. It is used in the preview and the presentation.')}>
  </div>`;
}
const AXES = {
  wght: ['Weight', 'How heavy the strokes are.'],
  wdth: ['Width', 'How narrow or wide the letters are.'],
  opsz: ['Optical size', 'Which size the letters are drawn for. Left alone, it follows the text size.'],
  slnt: ['Slant', 'How far the letters lean.'],
  GRAD: ['Grade', 'Heavier or lighter strokes without the letters changing width.'],
  SOFT: ['Softness', 'How soft the corners and terminals are.'],
  WONK: ['Wonk', 'Swaps in the leaning, more playful n, m and h.'],
  ROND: ['Roundness', 'How round the stroke ends are.'],
  MONO: ['Monospace', 'From proportional letters to letters of one width.'],
  CASL: ['Casual', 'From linear to casual, brush-like letters.'],
  CRSV: ['Cursive', 'Whether the lowercase takes its cursive forms.'],
  XOPQ: ['Thick strokes', 'How thick the vertical strokes are.'],
  YOPQ: ['Thin strokes', 'How thick the horizontal strokes are.'],
  XTRA: ['Counter width', 'How wide the insides of the letters are.'],
  YTUC: ['Capital height', 'How tall the capitals are.'],
  YTLC: ['Lowercase height', 'How tall the lowercase is.'],
  YTAS: ['Ascender height', 'How far the tall lowercase letters reach.'],
  YTDE: ['Descender depth', 'How far letters like g and p reach down.'],
  YTFI: ['Figure height', 'How tall the digits are.'],
};
const AXIS_ORDER = Object.keys(AXES);
// Each description is written once, so moving between roles leaves no tooltips behind.
const once = new Map();
const tipOnce = (key, text) => {
  if (!once.has(key)) once.set(key, tip(text));
  return once.get(key);
};
function axisSlider(key, name, help, min, max, step) {
  return `<label class="slider ui">
    <span class="slider-label">${escapeHtml(name)}</span>
    <button type="button" class="slider-value figures axis-reset" data-axis-reset="${key}" ${tipOnce('reset', 'Click to go back to the default.')}></button>
    <span class="slider-track"></span>
    <input type="range" data-axis="${key}" min="${min}" max="${max}" step="${step}" aria-label="${escapeHtml(name)}" ${tipOnce(key, help)}>
  </label>`;
}
const axisStep = (tag, min, max) => (tag === 'wght' ? 10 : max - min <= 2 ? 0.01 : max - min <= 30 ? 0.5 : 1);
// The controls of a role: one slider per axis its typeface has, the spacing, and its alternate letters.
export function axesMarkup(face) {
  const axes = face?.axes ?? { wght: [100, 400, 900] };
  const tags = Object.keys(axes).sort((a, b) => AXIS_ORDER.indexOf(a) - AXIS_ORDER.indexOf(b));
  const sliders = tags.map((tag) => {
    const [min, , max] = axes[tag];
    const [name, help] = AXES[tag] ?? [tag, `The typeface's ${tag} axis.`];
    return axisSlider(tag, name, help, min, max, axisStep(tag, min, max));
  }).join('');
  const spacing = axisSlider('spacing', 'Letter spacing', 'The space between the letters, in parts of the text size.', -0.1, 0.3, 0.005);
  const sets = face?.sets?.length
    ? `<fieldset class="axis-sets ui"><legend>Alternate letters</legend>${face.sets.map(([set, name]) => `<label><input type="checkbox" data-set="${set}">${escapeHtml(name || set)}</label>`).join('')}</fieldset>`
    : '';
  return `<div class="fields two">${sliders}${spacing}</div>${sets}`;
}
function mainTypeface(copy) {
  return `${head('main-typeface', copy)}
    <div class="segments role-tabs ui" role="group" aria-label="Which text to set">${ROLES.map(([role, name, help]) => `<button type="button" data-role-tab="${role}" ${tip(help)}>${escapeHtml(name)}</button>`).join('')}</div>
    <div class="face-rows">${ROLES.map(([role, name, help]) => faceRow(role, name, help)).join('')}</div>
    <div class="axes" data-axes></div>
    <div class="fields" data-role-row="heading-1" hidden>
      ${choice('First heading colour', 'inputs.type.heading-1-color', [['text', 'Text'], ['accent', 'Accent']], 'First headings use the Surface’s text or accent role, so they follow the checked context on every background.')}
    </div>
    <div class="specimen" data-specimen>
      <p class="specimen-name" data-face-name></p>
      <div class="specimen-letters"><p>${escapeHtml(copy['type.characters'])}</p></div>
      <div class="specimen-weights"><span style="font-weight: 400">Regular</span><span style="font-weight: 600">Semibold</span><span style="font-style: italic">Italic</span></div>
    </div>
    ${why('typefaces', 'Why these typefaces', copy)}${next('main-typeface', copy)}`;
}
// One breakpoint's name and base, above its arrow on the line.
function lineStack(end, side) {
  return `<div class="line-stack" data-stack="${end}">
    <span class="line-name"><span data-line-name="${end}"></span><select data-ratio="${end}" aria-label="Type scale at the ${side} breakpoint" ${tip(`The type scale at the ${side} breakpoint. Click for the ready-made scales. It says Custom when the base is none of them.`)}>${scales.map(([value, name]) => option(String(value), `${name} (${value})`)).join('')}<option value="custom" hidden></option></select></span>
    <input class="line-base figures" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-line-base="${end}" aria-label="Base at the ${side} breakpoint" ${tip(`The base at the ${side} breakpoint, from 1 to 2: each step in the hierarchy is this many times larger than the one before. Click to type your own.`)}>
  </div>`;
}
const lineWidthField = (key, name, help) => `<label class="line-px" data-line-label="${key}"><input class="figures" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-line-px="${key}" aria-label="${name}, in pixels" ${tip(help)}><span class="figures">px</span></label>`;
const lineArrow = (key, name, help, kind) => `<span class="line-arrow" data-arrow="${key}" data-kind="${kind}" role="slider" tabindex="0" aria-label="${name}" aria-valuemin="${LINE.min}" aria-valuemax="${LINE.max}" ${tip(help)}>${kind === 'view'
    ? '<svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path d="M7 1 13 11H1Z" fill="var(--kn-background)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    : '<svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 1h12L7 11Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'}</span>`;
function scaleLine() {
  const breakpoint = (side) => `The ${side} breakpoint. Drag it anywhere on the line, as long as left is not above right. Between the two the base follows a straight line, and outside them it stays fixed. On the same width the scale changes at once. The arrow keys move it one pixel at a time.`;
  return `<div class="scale-line ui" data-scale-line>
    <span class="line-title">Window width</span>
    ${lineStack('min', 'left')}${lineStack('max', 'right')}
    <div class="line-axis">
      <span class="line-end figures">${LINE.min}</span>
      <span class="line-track" data-line-track>${COMMON_WIDTHS.slice(1, -1).map((width) => `<i style="left: ${lineShare(width) * 100}%"></i>`).join('')}</span>
      <span class="line-end figures">${LINE.max} px</span>
    </div>
    ${lineArrow('min', 'Left breakpoint', breakpoint('left'), 'breakpoint')}
    ${lineArrow('max', 'Right breakpoint', breakpoint('right'), 'breakpoint')}
    ${lineWidthField('min', 'Left breakpoint', 'Where the left breakpoint lies. Click to type a width.')}
    ${lineWidthField('max', 'Right breakpoint', 'Where the right breakpoint lies. Click to type a width.')}
    ${lineArrow('view', 'Width shown', 'The window width the scale below is shown at. Drag it anywhere on the line. It changes nothing in the design.', 'view')}
    ${lineWidthField('view', 'Width shown', 'The width the scale below is shown at. Click to type a width.')}
  </div>`;
}
function typeScale(copy) {
  const rows = STEP_ROWS.map(([key, name]) => `<div class="step">
    <span class="step-name ui">${name}</span>
    <span class="stepper ui">
      <button type="button" data-step="${key}" data-delta="-1" aria-label="${name} one step smaller" ${tip('One step smaller. Other styles keep their size, and neighbours cannot cross.')}>−</button>
      <output class="figures" data-step-value="${key}"></output>
      <button type="button" data-step="${key}" data-delta="1" aria-label="${name} one step larger" ${tip('One step larger. Other styles keep their size, and neighbours cannot cross.')}>+</button>
    </span>
    <span class="step-sample" data-kn-type="${key}" data-step-sample="${key}">${escapeHtml(copy['type.sample'])}</span>
    <output class="figures step-size" data-size="${key}"></output>
  </div>`).join('');
  return `${head('type-scale', copy, { lead: false, fixed: true })}
    <div class="fields two">
      ${slider('Body, narrow', 'inputs.type.body-size.min', 12, 26, 'Body text at the left breakpoint and in narrower windows. Every other size is reckoned from it.')}
      ${slider('Body, wide', 'inputs.type.body-size.max', 12, 28, 'Body text at the right breakpoint and in wider windows. It grows evenly in between.')}
    </div>
    ${scaleLine()}
    <div data-step-rows>${rows}</div>
    <p id="scale-warning" class="ui" role="status"></p>
    ${why('type-scale', 'Why this scale', copy)}${next('type-scale', copy)}`;
}
const realCard = (copy) => `<article class="kn-card" data-kn-variant="link" data-kn-surface="raised"><h3 class="kn-card-heading" data-kn-type="heading-5">${escapeHtml(copy['shape.card'])}</h3><p class="kn-card-text" data-kn-type="small">${escapeHtml(copy['shape.card.text'])}</p></article>`;
function space(copy) {
  return `${head('space', copy)}
    ${slider('Density', 'inputs.density-profile', 0, 100, 'One setting for all the space on the page: gaps, columns, padding and the rhythm of the bands.', { low: 'Very compact', high: 'Very loose' })}
    <section class="sample-band" data-kn-surface="tint">
      <h2 data-kn-type="heading-3">${escapeHtml(copy['space.title'])}</h2>
      <div class="sample-cards">${realCard(copy).repeat(3)}</div>
    </section>
    ${why('space-shape', 'Why this space and shape', copy)}${next('space', copy)}`;
}
function corners(copy) {
  return `${head('corners', copy)}
    <div class="fields">
      ${slider('Corners', 'inputs.corner-profile', 0, 100, 'One setting for every corner, from square through discreet to clearly rounded. Controls first, then cards.', { low: 'Square', high: 'Clearly rounded' })}
      ${slider('Frame', 'inputs.frame.width', 0, 3, 'A solid line around buttons and cards, apart from the shadow. Hairlines in tables and fields stay as they are.', { low: 'None', high: '3 px' })}
      ${choice('Frame colour', 'inputs.frame.color', SHADOW_COLOURS, 'The colour of the frame.')}
    </div>
    <div class="sample-cards">
      <div class="sample-panel"><span><span class="kn-button">${escapeHtml(copy['shape.button'])}</span></span>
        <div class="kn-field"><label class="kn-field-label" data-kn-type="small">${escapeHtml(copy['shape.field'])}</label><input class="kn-field-control" tabindex="-1" readonly></div></div>
      ${realCard(copy)}
    </div>
    ${next('corners', copy)}`;
}
function shadow(copy) {
  const object = (variable, name, text) => `<div class="sample-object" style="box-shadow: var(--kn-shadow-${variable}), inset 0 0 0 var(--kn-frame-width) var(--kn-frame-color)"><h2 data-kn-type="heading-5">${escapeHtml(name)}</h2><p>${escapeHtml(text)}</p></div>`;
  const targets = [
    ['box', 'Cards', 'Cards cast a shadow. Without it, a hairline.'],
    ['header', 'Header', 'The header casts a shadow over the page. Without it, a hairline.'],
    ['panel', 'Panel', 'An open panel casts a shadow over the page. Without it, a hairline.'],
    ['page', 'Page over footer', 'The page casts a shadow over the footer. Without it, a hairline.'],
  ];
  return `${head('shadow', copy)}
    <div class="shadow-controls ui">
      <div class="fields">
        ${slider('Strength', 'inputs.shadow.strength', 0, 100, 'How dark the shadow is. At zero there is none, and hairlines take over. It catches at 50.')}
        ${slider('Hardness', 'inputs.shadow.hardness', 0, 100, 'From very diffuse to a hard, solid offset.')}
        ${slider('Elevation', 'inputs.shadow.elevation', 0, 100, 'How far things lift from the page.')}
        <div class="dial-row"><svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="22" cy="22" r="20.5" stroke-opacity=".3"></circle><circle cx="22" cy="22" r="3" fill="currentColor" stroke="none"></circle><g data-dial><path d="M22 22v13"></path><path d="M17.5 31l4.5 5 4.5-5" stroke-linejoin="round"></path></g></svg>
          ${slider('Shadow falls', 'shadow-direction', -90, 90, 'Which way shadows fall. The arrow shows it. Straight down by default.', { low: 'Left', high: 'Right' })}</div>
        ${choice('Colour', 'inputs.shadow.color', SHADOW_COLOURS, 'The text colour by default. On dark Surfaces a default shadow stays black.')}
        <div class="field">Casts a shadow<div class="chips">${targets.map(([key, name, help]) => `<button class="chip" type="button" data-target="${key}" ${tip(help)}>${name}</button>`).join('')}</div></div>
      </div>
    </div>
    <div class="shadow-stage">
      ${object('box', copy['shape.card'], copy['shape.card.text'])}
      ${object('box-lifted', copy['surface.sample'], copy['surface.text'])}
      ${object('panel', copy['shape.panel'], copy['shape.panel.text'])}
    </div>
    ${why('shadow', 'Why this shadow', copy)}${next('shadow', copy)}`;
}
/* ---- The frame: what surrounds every page, and is chosen once. ---- */
const setting = (title, body) => `<section class="setting"><h2 class="setting-title ui">${escapeHtml(title)}</h2>${body}</section>`;
const flags = (items) => `<div class="chips ui">${items.map(([path, name, help]) => `<button class="chip" type="button" data-flag="inputs.${path}" ${tip(help)}>${escapeHtml(name)}</button>`).join('')}</div>`;
const showPanel = (panel, name, help) => `<button class="plain show-panel ui" type="button" data-show-panel="${panel}" ${tip(help)}>${escapeHtml(name)}</button>`;
const SURFACE_CHOICES = [['page', 'Page colour'], ['raised', 'Raised'], ['tint', 'Tint'], ['brand', 'Brand colour'], ['inverse', 'Dark']];
const AXIS_CHOICES = [['row', 'Side by side'], ['column', 'Stacked']];
const ALIGN_CHOICES = [['start', 'Start'], ['center', 'Centre'], ['end', 'End']];

// A small drawing of an arrangement. Items that are off stay in their place, greyed.
const MINI = { identity: 'Identity', links: 'Links', search: 'Search', language: 'Globe', menu: 'Menu', cta: 'CTA' };
const ARRANGEMENT_DRAWINGS = {
  A: [['identity'], ['search', 'language', 'links', 'menu', 'cta']],
  B: [['identity', 'links'], ['search', 'language', 'menu', 'cta']],
  C: [['identity', 'links', 'search'], ['language', 'menu', 'cta']],
};
const miniGroup = (items) => `<span class="mini-group">${items.map((item) => `<span class="mini-item" data-mini="${item}">${MINI[item]}</span>`).join('')}</span>`;
function arrangementPicks() {
  const help = { A: 'Everything but the identity stands to the right.', B: 'The link menu follows the identity, to the left.', C: 'The link menu and search both follow the identity, to the left.' };
  return `<div class="picks ui">${Object.entries(ARRANGEMENT_DRAWINGS).map(([id, [start, end]]) => `<button class="pick" type="button" data-pick="inputs.header.arrangement" data-value="${id}" ${tip(help[id])}><span class="pick-name">${id}</span><span class="mini-bar">${miniGroup(start)}${miniGroup(end)}</span></button>`).join('')}</div>`;
}
function headerPage(copy) {
  const onlySticky = 'Only for a header that stays at the top of the window.';
  return `${head('header', copy)}
    ${setting('Model', arrangementPicks())}
    ${setting('What it shows', `
      ${flags([
        ['header.link-menu', 'Link menu', 'A row of links, the first level of the main menu. When it does not fit, the menu button takes over.'],
        ['header.search', 'Magnifier', 'A magnifier that opens the search box.'],
        ['header.language', 'Language globe', 'A globe that opens a list of languages.'],
        ['header.cta', 'CTA button', 'A button with a call to action, always last.'],
      ])}
      <div class="fields">
        ${choice('Menu button', 'inputs.header.menu-button', [['word', 'Menu with an arrow'], ['icon', 'Hamburger'], ['off', 'Only when items give way']], 'The button that opens the large menu. Without one of its own the header still gets one when items no longer fit.')}
      </div>`)}
    ${setting('How it behaves', `<div class="fields">
        ${choice('Scrolling', 'inputs.header.attachment', [['sticky', 'Stays at the top'], ['flow', 'Scrolls away']], 'Stays at the top of the window, or leaves with the page and returns at the top.')}
        ${choice('Page start', 'inputs.header.start', [['below', 'Below the header'], ['under', 'Under the header']], `Under the header, the first band starts at the top of the window and the header is transparent until you scroll. ${onlySticky}`)}
        ${choice('Solid colour', 'inputs.header.surface', [['page', 'Page colour'], ['brand', 'Brand colour']], 'The colour of the bar, and after a little scrolling also of a header that starts transparent.')}
      </div>
      ${flags([['header.autohide', 'Slides away', `Slides out of the window when you scroll down, and back when you scroll up. ${onlySticky}`]])}`)}
    ${setting('Identity', `<div class="fields">
        ${choice('Brand', 'inputs.header.identity', [['logo', 'Logo'], ['name', 'Name'], ['both', 'Logo and name']], 'What the brand is. Without a logo the name is used whatever you choose.')}
        ${textField('Slogan', 'project.slogan', 'Optional words beside or under the brand. They go first when space runs out.')}
        ${choice('Logo and name', 'inputs.header.brand-axis', AXIS_CHOICES, 'How logo and name stand to each other.')}
        ${choice('Aligned', 'inputs.header.brand-align', ALIGN_CHOICES, 'Side by side: top, middle or bottom. Stacked: left, centre or right.')}
        ${choice('Brand and slogan', 'inputs.header.identity-axis', AXIS_CHOICES, 'How the brand and the slogan stand to each other.')}
        ${choice('Aligned', 'inputs.header.identity-align', ALIGN_CHOICES, 'Side by side: top, middle or bottom. Stacked: left, centre or right.')}
      </div>`)}
    ${setting('The large menu', `
      ${flags([
        ['header.numbered', 'Numbered headings', 'Each heading in the large menu begins with its number: 01 /.'],
        ['header.menu-above', 'Row above', 'A row of content above the menu, which goes on narrow screens. The sample shows a link to an article.'],
        ['header.menu-below', 'Row below', 'A row of content below the menu, which goes on narrow screens. The sample shows a contact link.'],
      ])}
      ${showPanel('menu', 'Show it in the preview', 'Open the large menu in the preview, and keep it open while you change things.')}`)}
    ${setting('The search box', `<div class="fields">
        ${choice('Colour', 'inputs.header.search-surface', SURFACE_CHOICES, 'The colour of the box. Text, field and button follow it, with their contrast checked.')}
      </div>
      ${flags([
        ['header.search-blur', 'Blurred page', 'The page behind the box is blurred. Off, it only fades.'],
        ['header.search-heading', 'Heading', 'The word Search at the top of the box.'],
        ['header.search-links', 'Starting links', 'A few links under the field, for those who do not know what to search for.'],
      ])}
      ${showPanel('search', 'Show it in the preview', 'Open the search box in the preview, and keep it open while you change things.')}`)}
    ${why('frame', 'Why this frame', copy)}${next('header', copy)}`;
}

// A small drawing of a footer model: its rows, with the left and right columns in each.
const FOOTER_DRAWINGS = [
  ['one', 'One band', 'Identity and links in a single band.', [['a', 'b']]],
  ['two', 'Two rows', 'The identity beside links and contact, in one colour.', [['tall', 'b'], ['tall', 'b']]],
  ['utility', 'With a thin band', 'Two rows, and a thin band for legal links in a second colour.', [['tall', 'b'], ['tall', 'b'], ['thin', 'thin']]],
  ['statement', 'With a statement', 'A sentence across both columns, above the rest.', [['wide'], ['a', 'b'], ['thin', 'thin']]],
  ['tall-identity', 'Tall left column', 'The identity and a text beside three rows on the right.', [['tall', 'b'], ['tall', 'b'], ['tall', 'b']]],
  ['tall-links', 'Tall right column', 'A long list of links beside three rows on the left.', [['a', 'tall'], ['a', 'tall'], ['a', 'tall']]],
];
const footerDrawing = (rows) => `<span class="mini-footer">${rows.map((row) => `<span class="mini-row">${row.map((cell) => `<i data-cell="${cell}"></i>`).join('')}</span>`).join('')}</span>`;
function footerPage(copy) {
  return `${head('footer', copy)}
    ${setting('Model', `<div class="picks picks-grid ui">${FOOTER_DRAWINGS.map(([id, name, help, rows]) => `<button class="pick" type="button" data-pick="inputs.footer.model" data-value="${id}" ${tip(help)}>${footerDrawing(rows)}<span class="pick-name">${escapeHtml(name)}</span></button>`).join('')}</div>`)}
    ${setting('Colours', `<div class="fields">
        ${choice('Main colour', 'inputs.footer.surface', SURFACE_CHOICES, 'The colour of the footer\'s main rows.')}
        ${choice('Thin band', 'inputs.footer.second-surface', SURFACE_CHOICES, 'The colour of the thin band, in the models that have one.')}
      </div>`)}
    ${setting('Lines', `
      ${flags([
        ['footer.horizontal-rules', 'Between rows', 'A line between rows of one colour, in the models with several. Never between two colours or through a merged cell.'],
        ['footer.vertical-rule', 'Between columns', 'A line between the left and the right column.'],
      ])}
      <div class="fields">
        ${choice('Lines end', 'inputs.footer.rule-extent', [['content', 'At the content'], ['full', 'At the column\'s edge']], 'Whether a line stops where the text stops, or runs the whole width of its column.')}
      </div>`)}
    ${setting('How it appears', `<div class="fields">
        ${choice('Scrolling', 'inputs.footer.attachment', [['flow', 'Last on the page'], ['reveal', 'Revealed under the page']], 'Last on the page, it scrolls in from below. Revealed, it lies still under the page, which slides off it. That holds only while the whole footer fits in the window.')}
      </div>`)}
    ${next('footer', copy)}`;
}
function pagePage(copy) {
  return `${head('page', copy, { lead: false })}
    ${setting('Widths', `<div class="fields">
        ${slider('Content width', 'inputs.layout.wide', 800, 1800, 'The widest content can be. Header, footer and bands all align to it.', { step: 20 })}
        ${slider('Reading width', 'inputs.layout.narrow', 480, 960, 'The column long text stands in. It keeps lines easy to read and leaves room beside them.', { step: 10 })}
      </div>`)}
    ${setting('Where the page meets the footer', flags([
      ['page.shadow', 'Shadow on the footer', 'The page casts a shadow on the footer. It follows the shadow settings, so at strength zero there is none.'],
      ['page.edge-line', 'Line at the edge', 'A line at the bottom edge of the page.'],
    ]))}
    ${setting('The page\'s surface', `<div class="fields">
        ${textField('Light mode', 'inputs.page.fill-light', 'A colour or gradient, as in CSS: #f8f8f6, or linear-gradient(#fff, #eee). Empty, it is the page colour.')}
        ${textField('Dark mode', 'inputs.page.fill-dark', 'A colour or gradient for dark mode, set on its own. Empty, it is the page colour.')}
      </div>`)}
    ${next('page', copy)}`;
}

const SEPARATORS = [['slash', '/'], ['chevron', '›'], ['arrow', '→'], ['dot', '·']];
function breadcrumbsPage(copy) {
  return `${head('breadcrumbs', copy)}
    ${flags([['breadcrumbs.show', 'Show a trail', 'A trail at the top of every page but the start page. Off, a page\'s place comes from the menu alone.']])}
    ${setting('Where it stands', `<div class="fields">
        ${choice('Place', 'inputs.breadcrumbs.placement', [['first-band', 'In the first band, above the heading'], ['own-band', 'In a thin band of its own']], 'In the first band it takes that band\'s colours, and the page opens higher. In a band of its own it stands the same on every page.')}
      </div>`)}
    ${setting('How it looks', `<div class="picks picks-two ui">${SEPARATORS.map(([id, mark]) => `<button class="pick" type="button" data-pick="inputs.breadcrumbs.separator" data-value="${id}" ${tip('The mark between the steps.')}><span class="pick-trail">Services <b>${mark}</b> Planning</span></button>`).join('')}</div>
      <div class="fields">
        ${choice('First step', 'inputs.breadcrumbs.home', [['word', 'The word Home'], ['name', 'The site\'s name'], ['icon', 'A house']], 'How the trail begins. With a house, the word stays for those who hear the page.')}
        ${choice('On a phone', 'inputs.breadcrumbs.narrow', [['trail', 'The whole trail, on several lines'], ['parent', 'Only the way up one level']], 'A long trail takes room from the heading on a narrow screen. Only the way up shows as ← Planning.')}
      </div>
      ${flags([['breadcrumbs.current', 'Current page', 'The trail ends with the page itself, as plain text. Off, it ends with the page above.']])}`)}
    ${next('breadcrumbs', copy)}`;
}

/* ---- The page's opening: one hero in the preview, and its choices here, from the background up to the words. ---- */
const hero = (name, value, drawing, help) => `<button class="pick" type="button" data-pick="inputs.hero.${name}" data-value="${value}" ${tip(help)}>${drawing}</button>`;
const heroDrawing = (kind, word) => `<span class="pick-screen" data-draw="${kind}" aria-hidden="true"><i></i><i></i></span><span class="pick-word">${escapeHtml(word)}</span>`;
function heroPage(copy) {
  return `${head('opening', copy)}
    ${setting('Picture', `<div class="picks picks-four ui">
      ${hero('picture', 'none', heroDrawing('none', 'None'), 'Words alone, on the colour below.')}
      ${hero('picture', 'beside', heroDrawing('beside', 'Beside'), 'The picture stands next to the text, and under it on a phone.')}
      ${hero('picture', 'behind', heroDrawing('behind', 'Behind'), 'The picture fills the hero, under an overlay that lets the text hold its contrast.')}
    </div>
    <div class="fields">
      ${choice('Colour', 'inputs.hero.surface', [['none', 'None'], ...SURFACE_CHOICES], 'The colour behind the text. With none, what lies beneath shows. A picture behind the text leaves no colour to choose.')}
      ${choice('Overlay', 'inputs.hero.overlay', [['dark', 'Dark, with light text'], ['light', 'Light, with dark text']], 'What lies between a picture behind the text and the text. It is as strong as the text needs, and no more.')}
    </div>`)}
    ${setting('Share of the screen', `<div class="picks picks-four ui">
      ${hero('height', 'third', heroDrawing('third', '1/3'), 'A third of the screen. The text fills that height, so it stays centred.')}
      ${hero('height', 'half', heroDrawing('half', '1/2'), 'Half of the screen. A longer text makes it taller.')}
      ${hero('height', 'two-thirds', heroDrawing('two-thirds', '2/3'), 'Two thirds of the screen. A longer text makes it taller.')}
      ${hero('height', 'full', heroDrawing('full', 'All'), 'All of the screen. A visitor sees nothing else before scrolling.')}
    </div>`)}
    ${setting('Text', `<div class="picks picks-four ui">
      ${hero('place', 'center', heroDrawing('center', 'Centred'), 'The text in the middle of the hero.')}
      ${hero('place', 'bottom', heroDrawing('bottom', 'At the bottom'), 'The text at the bottom. Over a picture, the overlay fades in above it, and the picture is clear at the top.')}
    </div>`)}
    ${setting('Heading', `<div class="picks picks-four ui">
      ${hero('type', 'heading-1', heroDrawing('heading-1', 'H1'), 'The first heading\'s size, as on every other page.')}
      ${hero('type', 'display', heroDrawing('display', 'Display'), 'The largest size, for an opening that speaks loudly.')}
    </div>`)}
    <p class="component-note ui">The preview shows one screen, 16:10 on a desktop and upright on a tablet and a phone. The grey bars stand for what follows the hero.</p>
    ${setting('On this page', `<dl class="component-list"><div><dt class="ui">Hero</dt><dd>${escapeHtml(DESCRIPTIONS.get('Hero') ?? '')}</dd></div></dl>`)}
    ${why('components', 'About the components', copy)}${next('opening', copy)}`;
}

/* ---- The components: they take everything from the pages before, and show in the preview. ---- */
const DESCRIPTIONS = new Map(COMPONENT_GROUPS.flatMap(([, items]) => items));
DESCRIPTIONS.set('Pagination', 'Moves through a long list, page by page.');
const componentPage = (id) => (copy) => {
  const [, names, defaults, variants] = componentPages.find(([page]) => page === id);
  return `${head(id, copy)}
    ${setting('In the preview', `<div class="chips ui">${[...defaults, ...variants].map((specimen) => `<button class="chip" type="button" data-show-specimen="${specimen}" ${tip('Scroll the preview to this.')}>${escapeHtml(copy[`specimen.${specimen}`])}</button>`).join('')}</div>`)}
    <p class="component-note ui">These are the real components, at their real widths. They take their colours, typefaces, space, corners and shadows from the pages before, so there is nothing more to set here.</p>
    ${setting('On this page', `<dl class="component-list">${names.map((name) => `<div><dt class="ui">${escapeHtml(name)}</dt><dd>${escapeHtml(DESCRIPTIONS.get(name) ?? '')}</dd></div>`).join('')}</dl>`)}
    ${next(id, copy)}`;
};

export function documentMarkup(copy) {
  const builders = { start, 'colour-scale': colourScale, 'colour-together': colourTogether, 'main-typeface': mainTypeface, 'type-scale': typeScale, space, corners, shadow, header: headerPage, footer: footerPage, page: pagePage, breadcrumbs: breadcrumbsPage };
  for (const id of CHAPTERS.at(-1)[1]) builders[id] = id === 'opening' ? heroPage : componentPage(id);
  return PAGES.map((id) => `<article class="page" data-page="${id}" hidden>${builders[id](copy)}</article>`).join('');
}
