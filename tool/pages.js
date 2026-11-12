// The document: the presentation's pages, with their controls in place. Every control is written
// once and stays in the page, so changing a value never rebuilds what is being dragged.
import { SYSTEM_SANS, SYSTEM_MONOSPACE } from '/src/generator/defaults.js';
import { TYPEFACES, CATEGORIES } from '/src/fonts/catalog.js';
import { scales, LINE, COMMON_WIDTHS, lineShare, menuText, ownText } from './logic.js';
import { menu as sampleMenu, footer as sampleFooter } from '/presentation/src/samples.js';
import { COMPONENT_GROUPS } from '/src/design-md/components.js';
import { CATALOGUE, sectionName } from '/presentation/src/catalogue.js';

export const CHAPTERS = [
  ['start', ['start']],
  ['colour', ['colour-scale']],
  ['typography', ['main-typeface', 'type-scale']],
  ['space', ['space', 'corners', 'shadow']],
  ['frame', ['header', 'footer', 'page', 'breadcrumbs']],
  ['components', ['opening', 'sections', 'text', 'buttons', 'cards', 'media', 'finding', 'forms']],
];
// The menu's row is short, so a page there may go by a shorter name than its heading.
const SHORT_NAMES = { opening: 'Opening', buttons: 'Buttons', media: 'Media', finding: 'Finding', forms: 'Forms', page: 'Page' };
export const pageName = (id, copy) => SHORT_NAMES[id] || copy[`${id}.title`];
export const PAGES = CHAPTERS.flatMap(([, pages]) => pages);
// A page that has gone, and the page that took what it showed, so a window that remembers it opens there.
export const MOVED_PAGES = { 'colour-together': 'colour-scale' };
// Each row of the type scale has a height of its own, in rem, and keeps it: tall enough for the size the style
// reaches at a scale the tool does not warn about, and a larger sample is clipped rather than push the rows below.
export const STEP_ROWS = [
  ['display', 'Display', 7],
  ['heading-1', 'H1', 5.5],
  ['heading-2', 'H2', 4.25],
  ['heading-3', 'H3', 3.75],
  ['heading-4', 'H4', 3.25],
  ['heading-5', 'H5', 2.875],
  ['heading-6', 'H6', 2.625],
  ['lead', 'Lead', 2.625],
  ['small', 'Small', 2.25],
  ['label', 'Label', 2.25],
];
// The table also shows body text, the base every step is reckoned from, between the lead above it and small text
// below. Its size comes from the two sliders, so its row has no steppers.
export const SCALE_ROWS = STEP_ROWS.flatMap((row) => (row[0] === 'lead' ? [row, ['body', 'Body', 2.5]] : [row]));
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
// The frame can also take each plate's own border colour, the quiet edge (owner, 2026-11-11).
const FRAME_COLOURS = [SHADOW_COLOURS[0], ['border', 'Quiet edge'], ...SHADOW_COLOURS.slice(1)];

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
function head(id, copy, { lead = true, fixed = false, text = copy[`${id}.lead`] } = {}) {
  return `<header class="page-head ${fixed ? 'fixed' : ''}"><h1>${escapeHtml(copy[`${id}.title`])}</h1>${
    lead && text ? `<p class="page-lead">${escapeHtml(text)}</p>` : ''
  }</header>`;
}
function next(id, copy) {
  const following = PAGES[PAGES.indexOf(id) + 1];
  if (!following) return '';
  const title = copy[`${following}.title`];
  return `<button class="next ui" type="button" data-go="${following}" ${tip(`Go on to the next page: ${title}.`)}>${escapeHtml(title)} →</button>`;
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
// The client's own menu and footer, which the preview and the presentation show in place of the samples. Each field
// takes words, which the design file keeps as what they come to (logic.js), and its grey text is what shows while it is
// empty: the sample, which also shows how to write it.
const sampleTree = (items) => items.map(({ label, description, children }) => ({ label, ...(description && { description }), ...(children && { items: sampleTree(children) }) }));
const MENU_HELP = 'The client’s menu, one item a line. A line set in under another, by spaces or a tab, is its child: the top level is the link menu and the large menu’s headings, and the next level the links under each. A dash with a space on each side begins an item’s short description, as in Compact series - For where space is short. Bullets and numbers count as setting in, so an outline or a site map pasted from a document or a site keeps its levels. Left empty, the sample menu shows, as in grey here.';
const OWN_CELLS = {
  upper: {
    b1: ['Social media', 'networks', 'One network a line: LinkedIn, Facebook, Instagram, YouTube, X, Spotify, Email or RSS, each shown as its icon. An address from the client’s site, such as linkedin.com/company/…, finds its icon too, and any other name shows as a word.'],
    a2: ['Statement', 'text', 'A short text presenting the brand, such as a position statement. Each line stands as a line of its own.'],
    b2: ['Links', 'links', 'Links for navigation, one a line, as they read: a selection from the menu, all of it, or links that do not fit there. Left empty, the menu’s top level shows, the client’s once there is one, as in grey here.'],
  },
  lower: {
    a1: ['Address', 'text', 'The address. Each line stands as a line of its own.'],
    b1: ['Registration', 'text', 'The registration number and registered office. Each line stands as a line of its own.'],
    a2: ['Policies', 'links', 'Links to policies, one a line, such as the cookie policy and the privacy policy.'],
    b2: ['Consent', 'links', 'Links to change the privacy settings and to revoke consents, one a line. In the presentation each opens the cookie settings.'],
  },
};
// The cells as the Footer page's miniature has them, A1 and B1 above A2 and B2. The upper band's A1 is the brand, which
// the identity gives, so it has nothing to write.
function ownCell(band, bandName, cell) {
  if (!OWN_CELLS[band][cell]) return `<div class="own-cell ui"><span class="own-head"><span><b>${cell.toUpperCase()}</b> Brand</span></span>
    <p class="own-note">As the header shows it, from the logos and the client name above and the Header page’s Identity.</p></div>`;
  const [name, kind, help] = OWN_CELLS[band][cell];
  const path = `footer.${band}.${cell}`;
  const empty = path === 'footer.upper.b2' ? '' : ' Left empty, the sample shows, as in grey here.';
  return `<label class="own-cell ui"><span class="own-head"><span><b>${cell.toUpperCase()}</b> ${escapeHtml(name)}</span><span class="own-state" data-own-state="${path}"></span></span>
    <textarea class="own-field" data-own="${path}" data-own-kind="${kind}" aria-label="${escapeHtml(`${bandName}, ${cell.toUpperCase()}: ${name}`)}" placeholder="${escapeHtml(ownText(kind, sampleFooter[band][cell]))}" ${tip(`${help}${empty}`)}></textarea></label>`;
}
const ownContent = () => `<section class="setting"><h2 class="why-head ui"><b>Menu</b><span data-own-state="menu"></span></h2>
      <textarea class="own-field own-menu" data-own="menu" data-own-kind="menu" aria-label="Menu" placeholder="${escapeHtml(menuText(sampleTree(sampleMenu)))}" ${tip(MENU_HELP)}></textarea></section>
    <section class="setting"><h2 class="why-head ui"><b>Footer</b><span>The client’s words, cell by cell, as on the Footer page</span></h2>
      ${FOOTER_BANDS.map(([band, bandName]) => `<div class="own-band"><h3 class="own-band-name ui">${bandName}</h3>
        <div class="own-cells">${['a1', 'b1', 'a2', 'b2'].map((cell) => ownCell(band, bandName, cell)).join('')}</div></div>`).join('')}</section>`;
function start(copy) {
  const tile = (key, label, background) => `<div class="logo-tile" ${background}>
    <input type="file" hidden data-logo="${key}" accept="image/svg+xml,image/png" aria-label="${escapeHtml(label)}">
    <button class="logo-pick ui" type="button" data-choose-logo="${key}" ${tip(`${label}: click to choose an SVG or PNG. A symbol, as the name has its own setting on the Header page. It is embedded in the design file.`)}>
      <img data-logo-image="${key}" alt="" hidden><span data-logo-word="${key}"></span>
    </button>
    <button class="logo-remove ui" type="button" data-remove-logo="${key}" hidden ${tip('Remove this logo. The client name takes its place.')}>Remove</button>
  </div>`;
  return `${head('start', copy)}
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
    <section class="setting"><h2 class="why-head ui"><b>Pictures</b><span>Sample photos until the client’s own are added</span></h2>
    <div class="picture-tiles">${PICTURE_TILES.map(([slot, name, help]) => `<div class="picture-tile">
      <input type="file" hidden data-picture="${slot}" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="${escapeHtml(name)}">
      <button class="picture-pick ui" type="button" data-choose-picture="${slot}" ${tip(`${help} Click to choose the client’s own photo. It is kept in a folder beside the design file, where Undo does not reach.`)}>
        <img data-picture-image="${slot}" alt=""><span class="picture-name">${escapeHtml(name)}</span>
      </button>
      <button class="logo-remove ui" type="button" data-remove-picture="${slot}" hidden ${tip('Remove this photo. The sample takes its place, and Undo does not bring it back.')}>Remove</button>
    </div>`).join('')}</div></section>
    ${ownContent()}
    <div class="why"><span class="why-head ui"><b>Introduction</b><span>The client reads this first</span></span>
      <textarea data-path="project.introduction" aria-label="Introduction" placeholder="${escapeHtml(copy['start.how'])}" ${tip('Optional introduction on the first page of the presentation. Blank lines make paragraphs.')}></textarea></div>
    <div class="why"><span class="why-head ui"><b>Design brief</b><span>For the designers and AI agents, not the client</span></span>
      <textarea data-path="project.brief" aria-label="Design brief" placeholder="Who the site is for and how it should feel." ${tip('Optional. It opens the file exported for AI agents, and it is what most decides what they make. It is not shown in the presentation.')}></textarea></div>
    ${next('start', copy)}`;
}

function colourBlock(key, name, job, removable) {
  return `<section class="colour" data-colour-block="${key}">
    <div class="colour-name"><h2 class="setting-title ui">${escapeHtml(name)}</h2><p class="colour-job ui">${escapeHtml(job)}</p></div>
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
// Text, links and buttons on every Surface, with their contrast, on the page where the colours are set, so a
// change shows at once (the owner, 2026-11-11): below the colours, or beside them where the document is wide.
// The report keeps them on a page of their own.
const SURFACE_CASES = [['page', 'Page'], ['raised', 'Raised'], ['tint', 'Tint'], ['tint-secondary', 'Second tint'], ['tint-tertiary', 'Third tint'], ['brand', 'Brand'], ['inverse', 'Inverse'], ['accent', 'Accent']];
function surfaceCases(copy) {
  // Each figure has a fixed width, so a ratio with another number of digits never wraps the line differently.
  const ratio = (role, word) => `<span>${word} <span data-ratio="${role}"></span></span>`;
  const tile = ([surface, name]) => `<div class="surface-case" data-surface-case="${surface}">
    <div class="surface-tile" data-kn-surface="${surface}">
      <h3>${escapeHtml(copy['surface.sample'])}</h3><p>${escapeHtml(copy['surface.text'])}</p>
      <a href="#${surface}" tabindex="-1">${escapeHtml(copy['surface.link'])}</a>
      <span><span class="kn-button">${escapeHtml(copy['surface.button'])}</span></span>
    </div>
    <p class="surface-fine figures" data-surface-fine="${surface}"><b>${escapeHtml(name)}</b>${ratio('text', 'text')}${ratio('text-muted', 'muted')}${ratio('link', 'link')}</p>
  </div>`;
  return `<section class="colour-together">
      <div><h2 class="setting-title ui">${escapeHtml(copy['colour-together.title'])}</h2><p class="colour-job ui">${escapeHtml(copy['colour-together.lead'])}</p></div>
      <div class="surfaces">${SURFACE_CASES.map(tile).join('')}</div>
    </section>`;
}
function colourScale(copy) {
  return `${head('colour-scale', copy)}
    <div class="colour-sets">
      <div class="colour-work">
        <div class="colours">
          ${colourBlock('primary', 'Primary', 'The main colour: links, buttons and strong Surfaces.', false)}
          ${colourBlock('secondary', 'Secondary', 'Accents, focus and a tint of its own.', true)}
          ${colourBlock('tertiary', 'Tertiary', 'One more tint, to group content.', true)}
          <section class="colour">
            <div class="colour-name"><h2 class="setting-title ui">Grey</h2><p class="colour-job ui">Text, hairlines and neutral Surfaces.</p></div>
            <div class="colour-body">
              <div class="colour-controls ui">${slider('Temperature', 'inputs.gray-temperature', -100, 100, 'Makes neutral colours cooler or warmer, without changing the brand colours.', { colour: 'T' })}</div>
              <div class="ramp figures" data-ramp="gray"></div>
            </div>
          </section>
        </div>
        <div class="colour-actions ui"><button class="link-button" type="button" data-add-colour ${tip('Adds another brand colour with a tint of its own. It shows in the preview at once.')}>Add a colour</button></div>
      </div>
      ${surfaceCases(copy)}
    </div>
    ${why('colour', 'Why these colours', copy)}${next('colour-scale', copy)}`;
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
// Each description is written once, so moving between roles or chapters leaves no tooltips behind.
const once = new Map();
export const tipOnce = (key, text) => {
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
    ? `<fieldset class="axis-sets ui"><legend>Alternate letters</legend>${face.sets.map(([set, name]) => {
        const help = tipOnce('alternate', 'Swaps these letters for the typeface’s own alternate forms. Off, it keeps its usual ones.');
        return `<label ${help}><input type="checkbox" data-set="${set}" ${help}>${escapeHtml(name || set)}</label>`;
      }).join('')}</fieldset>`
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
    ? '<svg width="0.875rem" height="0.75rem" viewBox="0 0 14 12" aria-hidden="true"><path d="M7 1 13 11H1Z" fill="var(--kn-background)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    : '<svg width="0.875rem" height="0.75rem" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 1h12L7 11Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'}</span>`;
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
  const rows = SCALE_ROWS.map(([key, name, height]) => `<div class="step" style="height: ${height}rem">
    <span class="step-name ui">${name}</span>
    ${key === 'body' ? `<span class="stepper ui">
      <output class="figures step-base" data-step-value="body" ${tip('Body text is the base of the scale, step 0. Its size is set with the two sliders above, and every other style is a number of steps from it.')}>0</output>
    </span>` : `<span class="stepper ui">
      <button type="button" data-step="${key}" data-delta="-1" aria-label="${name} one step smaller" ${tip('One step smaller. Other styles keep their size, and neighbours cannot cross.')}>−</button>
      <output class="figures" data-step-value="${key}"></output>
      <button type="button" data-step="${key}" data-delta="1" aria-label="${name} one step larger" ${tip('One step larger. Other styles keep their size, and neighbours cannot cross.')}>+</button>
    </span>`}
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
    <div class="sample-stage"><section class="sample-band" data-kn-surface="tint">
      <h2 data-kn-type="heading-3">${escapeHtml(copy['space.title'])}</h2>
      <div class="sample-cards">${realCard(copy).repeat(3)}</div>
    </section></div>
    ${why('space-shape', 'Why this space and shape', copy)}${next('space', copy)}`;
}
function corners(copy) {
  return `${head('corners', copy)}
    <div class="fields">
      ${slider('Corners', 'inputs.corner-profile', 0, 100, 'One setting for every corner, from square through discreet to clearly rounded. Controls first, then cards.', { low: 'Square', high: 'Clearly rounded' })}
      ${slider('Frame', 'inputs.frame.width', 0, 3, 'A solid line around buttons and cards, apart from the shadow. Hairlines in tables and fields stay as they are.', { low: 'None', high: '3 px' })}
      ${choice('Frame colour', 'inputs.frame.color', FRAME_COLOURS, 'The colour of the frame. Text draws it at full strength. Quiet edge gives each card its own border colour, a quiet line that follows the band it stands on and light or dark mode, and a filled button a ring in its own hover colour.')}
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
        <div class="dial-row"><svg width="2.75rem" height="2.75rem" viewBox="0 0 44 44" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="22" cy="22" r="20.5" stroke-opacity=".3"></circle><circle cx="22" cy="22" r="3" fill="currentColor" stroke="none"></circle><g data-dial><path d="M22 22v13"></path><path d="M17.5 31l4.5 5 4.5-5" stroke-linejoin="round"></path></g></svg>
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
const SURFACE_CHOICES = [['page', 'Page colour'], ['raised', 'Raised'], ['tint', 'Tint'], ['brand', 'Brand colour'], ['inverse', 'Dark']];
const AXIS_CHOICES = [['row', 'Side by side'], ['column', 'Stacked']];

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
      ${flags([
        ['header.autohide', 'Slides away', `Slides out of the window when you scroll down, and back when you scroll up. ${onlySticky}`],
        ['header.translucent', 'Translucent', 'The bar and the large menu let a hint of the page under them show through, blurred, as far as their text keeps its contrast over any page. A header that starts transparent stays clear at the top.'],
      ])}`)}
    ${setting('Identity', `<div class="fields">
        ${choice('Brand', 'inputs.header.identity', [['logo', 'Logo'], ['name', 'Name'], ['both', 'Logo and name']], 'What the brand is, in the header and the footer alike. Without a logo the name is used whatever you choose.')}
        ${textField('Slogan', 'project.slogan', 'Optional words beside or under the brand, in the header only. They go first when space runs out.')}
        ${choice('Logo and name', 'inputs.header.brand-axis', AXIS_CHOICES, 'How logo and name stand to each other, in the header and the footer alike: centred on each other, or stacked from the same edge. Only when both show.')}
        ${choice('Slogan\'s place', 'inputs.header.slogan-place', [['beside', 'Beside'], ['below', 'Below']], 'Beside the brand, centred on it after a thin line. Or below the name and starting where it starts, and below the logo when there is no name. Only with a slogan.')}
      </div>`)}
    ${setting('The large menu', `
      ${flags([
        ['header.numbered', 'Numbered headings', 'Each heading in the large menu begins with its number: 01 /.'],
        ['header.menu-above', 'Row above', 'A row of content above the menu, which the site fills, such as a link to an article. It goes where the menu falls to two columns or one, as on a tablet or a phone.'],
        ['header.menu-below', 'Row below', 'A row of content below the menu, which the site fills, such as a contact link. It goes where the menu falls to two columns or one, as on a tablet or a phone.'],
      ])}`)}
    ${setting('The search box', `<div class="fields">
        ${choice('Colour', 'inputs.header.search-surface', SURFACE_CHOICES, 'The colour of the box. Text, field and button follow it, with their contrast checked.')}
        ${choice('In the field', 'inputs.header.search-placeholder', [['none', 'Nothing'], ['word', 'The word Search'], ['icon', 'A magnifier']], 'What the empty field shows. The word is the site\'s own, such as Sök on a Swedish site. The word and the magnifier both go as soon as the visitor types.')}
      </div>
      ${flags([
        ['header.search-blur', 'Blurred page', 'Everything behind the box is blurred, the header and the footer too. Off, it only fades.'],
        ['header.search-heading', 'Heading', 'The word Search at the top of the box.'],
        ['header.search-links', 'Starting links', 'A few links under the field, for those who do not know what to search for.'],
        ['header.search-close', 'Close button', 'A cross in the corner of the box. Esc closes the box whether it is there or not, and so does a click outside the box.'],
      ])}`)}
    <p class="component-note ui">The preview shows the page, and under it the large menu and the search box open, each in a frame of its own.</p>
    ${why('frame', 'Why this frame', copy)}${next('header', copy)}`;
}

// The footer's miniature: its two bands, the upper taller, each with four cells at the real 1/3 and 2/3.
// Each cell is a button that turns it on or off, says which it is, and tells in its tooltip what the sample shows there.
const FOOTER_BANDS = [
  ['upper', 'Upper band', { a1: 'the brand, as the header shows it', b1: 'social media icons', a2: 'a short statement of what the brand stands for', b2: 'links for navigation' }],
  ['lower', 'Lower band', { a1: 'the address', b1: 'the registration number and registered office', a2: 'links to the cookie and privacy policies', b2: 'links to change privacy settings and revoke consents' }],
];
const footerMiniature = () => `<div class="footer-mini ui">${FOOTER_BANDS.map(([band, name, samples]) => `<div class="footer-mini-band" data-mini-band="${band}">${Object.entries(samples).map(([cell, sample]) => {
  const label = `${name}, ${cell.toUpperCase()}`;
  return `<button class="footer-mini-cell" type="button" data-flag="inputs.footer.${band}.cells.${cell}" aria-label="${label}" ${tip(`${label}: the preview shows ${sample} here. Click to turn the cell on or off.`)}></button>`;
}).join('')}</div>`).join('')}</div>`;
function footerPage(copy) {
  return `${head('footer', copy)}
    ${setting('Cells', footerMiniature())}
    ${setting('Colours', `<div class="fields">
        ${choice('Upper band', 'inputs.footer.upper.surface', SURFACE_CHOICES, 'The colour of the upper band. It behaves like any other band on the page.')}
        ${choice('Lower band', 'inputs.footer.lower.surface', SURFACE_CHOICES, 'The colour of the lower band, which is always thin.')}
      </div>`)}
    ${setting('Empty cells', `<div class="fields">
        ${choice('An empty cell gives way to', 'inputs.footer.fill', [['column', 'The cell above or below'], ['row', 'The cell beside it']], 'Which neighbour takes the room where a cell could fill either way. An empty row or column always goes, and the content stays at its own edge, at the top.')}
      </div>`)}
    ${setting('Attachment', `<div class="fields">
        ${choice('The footer is fixed to', 'inputs.footer.attachment', [['flow', 'The end of the page'], ['reveal', 'The bottom of the window']], 'Fixed to the end of the page, the footer is the page\'s last part and scrolls in with it. Fixed to the bottom of the window, it lies still there under the page, which slides off it as you reach the end. That holds only while the whole footer fits in the window; a taller one stays at the end of the page.')}
      </div>`)}
    ${setting('Where the page meets the footer', flags([
      ['page.shadow', 'Shadow on the footer', 'The page casts a shadow on the footer, wherever the footer is fixed. It follows the shadow settings, so at strength zero there is none.'],
      ['page.edge-line', 'Line at the edge', 'A line at the bottom edge of the page, where it meets the footer.'],
    ]))}
    ${setting('Lines', `
      ${flags([
        ['footer.horizontal-rules', 'Between rows', 'A line between rows of one colour. Never between two colours or through a merged cell.'],
        ['footer.vertical-rule', 'Between columns', 'A line between the left and the right column. Never through a merged cell.'],
      ])}
      <div class="fields">
        ${choice('Lines end', 'inputs.footer.rule-extent', [['content', 'At the content'], ['full', 'At the window\'s edge']], 'Whether a line stops where the text stops, or runs on to the edge of the window.')}
      </div>`)}
    ${next('footer', copy)}`;
}
function pagePage(copy) {
  return `${head('page', copy, { lead: false })}
    ${setting('Widths', `<div class="fields">
        ${slider('Content width', 'inputs.layout.wide', 800, 1800, 'The widest content can be. Header, footer and bands all align to it.', { step: 20 })}
        ${slider('Reading width', 'inputs.layout.narrow', 480, 960, 'The column long text stands in. It keeps lines easy to read and leaves room beside them.', { step: 10 })}
      </div>`)}
    ${setting('The page\'s surface', `<div class="fields">
        ${textField('Light mode', 'inputs.page.fill-light', 'A colour or gradient, as in CSS: #f8f8f6, or linear-gradient(#fff, #eee). Empty, it is the page colour.')}
        ${textField('Dark mode', 'inputs.page.fill-dark', 'A colour or gradient for dark mode, set on its own. Empty, it is the page colour.')}
      </div>`)}
    <div class="page-sketch ui" data-page-sketch></div>
    ${next('page', copy)}`;
}

const SEPARATORS = [['slash', '/'], ['chevron', '›'], ['arrow', '→'], ['dot', '·']];
function breadcrumbsPage(copy) {
  return `${head('breadcrumbs', copy)}
    ${flags([['breadcrumbs.show', 'Show a trail', 'A trail directly above the page\'s H1, on every page but the start page. Off, a page\'s place comes from the menu alone.']])}
    ${setting('How it looks', `<div class="picks picks-two ui">${SEPARATORS.map(([id, mark]) => `<button class="pick" type="button" data-pick="inputs.breadcrumbs.separator" data-value="${id}" ${tip('The mark between the steps.')}><span class="pick-trail">Services <b>${mark}</b> Planning</span></button>`).join('')}</div>
      <div class="fields">
        ${choice('First step', 'inputs.breadcrumbs.home', [['word', 'The word Home'], ['name', 'The site\'s name'], ['icon', 'A house']], 'How the trail begins. With a house, the word stays for those who hear the page.')}
        ${choice('On a phone', 'inputs.breadcrumbs.narrow', [['trail', 'The whole trail, on several lines'], ['parent', 'Only the way up one level'], ['fit', 'As much as fits, from the end']], 'A long trail takes room from the heading on a narrow screen. Only the way up shows as ← Planning. As much as fits keeps one line: the steps nearest the page, and … at the start where earlier steps are hidden, as … / Services / Planning.')}
      </div>
      ${flags([['breadcrumbs.current', 'Current page', 'The trail ends with the page itself, as plain text. Off, it ends with the page above.']])}`)}
    <p class="component-note ui">${escapeHtml(copy['breadcrumbs.place'])} Where the H1 is, you choose under Opening a page.</p>
    ${next('breadcrumbs', copy)}`;
}

/* ---- The page's opening: one hero in the preview, and its choices here, in the owner's order: size, picture, text, colour, heading. ---- */
const hero = (name, value, drawing, help) => `<button class="pick" type="button" data-pick="inputs.hero.${name}" data-value="${value}" ${tip(help)}>${drawing}</button>`;
const heroDrawing = (kind, word) => `<span class="pick-screen" data-draw="${kind}" aria-hidden="true"><i></i><i></i></span><span class="pick-word">${escapeHtml(word)}</span>`;
// Each choice is its value, its word, what it does, and its drawing where that goes by another name than the value.
const heroPick = (name, [value, word, help, kind = value]) => hero(name, value, heroDrawing(kind, word), help);
const HERO_SIZES = [
  ['third', '1/3', 'A third of the screen. A longer text makes it taller, and so does a picture above the text on a phone.'],
  ['half', '1/2', 'Half of the screen. A longer text makes it taller, and so does a picture above the text on a phone.'],
  ['two-thirds', '2/3', 'Two thirds of the screen. A longer text makes it taller, and so does a picture above the text on a phone.'],
  ['full', '1/1', 'All of the screen. A visitor sees nothing else before scrolling.'],
];
const HERO_PICTURES = [
  ['none', 'None', 'No picture: the words alone, on the colour below.'],
  ['behind', 'Behind', 'The picture fills the hero, under an overlay that lets the text hold its contrast.'],
  ['start-bleed', 'Left bleed', 'The picture runs to the window\'s left edge and to the hero\'s top and bottom, with the text on the right. On a phone it stands above the text.'],
  ['end-bleed', 'Right bleed', 'The picture runs to the window\'s right edge and to the hero\'s top and bottom, with the text on the left. On a phone it stands above the text.'],
  ['start', 'Left', 'The picture stands on the left, inside the content width, with the hero\'s space above and below it and the text on the right. On a phone it stands above the text.'],
  ['end', 'Right', 'The picture stands on the right, inside the content width, with the hero\'s space above and below it and the text on the left. On a phone it stands above the text.'],
];
const HERO_PLACES = [
  ['top', 'Top', 'The text at the top. Over a picture behind it, the overlay is strongest at the top and fades away below the text.'],
  ['center', 'Middle', 'The text in the middle. Over a picture behind it, the overlay covers all of the picture.', 'middle'],
  ['bottom', 'Bottom', 'The text at the bottom. Over a picture behind it, the overlay fades in above the text and is at full strength where the text begins.'],
];
const HERO_ALIGNS = [
  ['start', 'Left', 'The text at the left of the content width. A picture at the side already gives the text its half.', 'align-start'],
  ['center', 'Centre', 'The text block in the middle of the content width, with its lines still left-aligned. A picture at the side already gives the text its half.', 'align-center'],
  ['end', 'Right', 'The text block at the right of the content width, with its lines still left-aligned. A picture at the side already gives the text its half.', 'align-end'],
];
// Two settings of their own, in all four combinations: where the page's H1 is, and how the hero's heading looks.
const HERO_H1 = [
  ['hero', 'In the hero', 'The hero\'s heading is the page\'s H1, with the trail first in the hero\'s text. The next section\'s heading is an H2.', 'h1-hero'],
  ['below', 'Under it', 'The next section\'s heading is the page\'s H1, with the trail directly above it. The hero\'s text keeps its look and is no heading in the code, since a lower heading before the H1 reads as the wrong order to screen readers and search engines.', 'h1-below'],
];
const HERO_LOOKS = [
  ['heading-1', 'H1', 'The look of the first heading, as on every other page. With the H1 under the hero, two headings of the same size stand close, so Display often reads better.'],
  ['display', 'Display', 'The largest look, for an opening that speaks loudly. With the H1 under the hero, it also keeps the hero\'s text apart from the heading below it.'],
];
const heroChoice = (label, name, choices) => `<div class="picks-labelled ui" role="group" aria-label="${escapeHtml(label)}">
    <span class="pick-name-above">${escapeHtml(label)}</span>
    <div class="picks picks-two">${choices.map((item) => heroPick(name, item)).join('')}</div>
  </div>`;
function heroPage(copy) {
  return `${head('opening', copy)}
    <p class="component-note ui">These settings are the opening every page gets, unless the page itself chooses otherwise.</p>
    ${setting('Size', `<div class="picks picks-four ui">${HERO_SIZES.map((item) => heroPick('height', item)).join('')}</div>`)}
    ${setting('Picture', `<div class="picks picks-six ui">${HERO_PICTURES.map((item) => heroPick('picture', item)).join('')}</div>`)}
    ${setting('Text', `<div class="picks picks-three ui">${HERO_PLACES.map((item) => heroPick('place', item)).join('')}</div>
    <div class="picks picks-three ui">${HERO_ALIGNS.map((item) => heroPick('align', item)).join('')}</div>`)}
    ${setting('Behind the text', `<div class="fields">
      ${choice('Colour', 'inputs.hero.surface', [['none', 'None'], ...SURFACE_CHOICES, ['accent', 'Accent']], 'The colour behind the text. With none, what lies beneath shows. Accent is the fill of the filled button, which then turns to the Surface’s own button colours.')}
      ${choice('Overlay', 'inputs.hero.overlay', [['dark', 'Dark, with light text'], ['light', 'Light, with dark text']], 'What lies between the picture and the text. It is as strong as the text needs, and no more.')}
    </div>`)}
    ${setting('Heading', `<div class="picks-beside">
      ${heroChoice('The page\'s H1', 'h1', HERO_H1)}
      ${heroChoice('The hero\'s heading looks like', 'type', HERO_LOOKS)}
    </div>`)}
    <p class="component-note ui">The preview shows one screen, 16:10 on a desktop and upright on a tablet and a phone. The heading under the hero is real, and the grey bars stand for what follows it.</p>
    ${setting('On this page', sectionList('opening'))}
    ${why('components', 'About the components', copy)}${next('opening', copy)}`;
}

/* ---- The components: they take everything from the pages before, and show in the preview. ---- */
// The panel holds only what the design file saves. A component's variants are chosen per use by whoever builds a page,
// so the preview shows them all, and the page lists the preview's sections, named as the preview names them.
const DESCRIPTIONS = new Map(COMPONENT_GROUPS.flatMap(([, items]) => items));
DESCRIPTIONS.set('Pagination', 'Moves through a long list, page by page.');
DESCRIPTIONS.set('Link', 'A link in running text, with a look of its own for the pointer over it and the keyboard on it.');
DESCRIPTIONS.set('Field', 'One field of a form, with its label, help and error, in each state it has a look for.');
const sectionList = (page) => `<dl class="component-list">${CATALOGUE[page].map((section) => `<div><dt class="ui">${escapeHtml(sectionName(section))}</dt><dd>${section.components.map((name) => escapeHtml(DESCRIPTIONS.get(name) ?? '')).join(' ')}</dd></div>`).join('')}</dl>`;
const componentPage = (id) => (copy) => `${head(id, copy, id === 'buttons' ? { text: copy['buttons.tool-lead'] } : {})}
    <p class="component-note ui">The preview shows the real components, each with its variants side by side and named. A site chooses among the variants each time it uses a component, so none of them is set here.</p>
    ${setting('On this page', sectionList(id))}
    ${next(id, copy)}`;

export function documentMarkup(copy) {
  const builders = { start, 'colour-scale': colourScale, 'main-typeface': mainTypeface, 'type-scale': typeScale, space, corners, shadow, header: headerPage, footer: footerPage, page: pagePage, breadcrumbs: breadcrumbsPage };
  for (const id of CHAPTERS.at(-1)[1]) builders[id] = id === 'opening' ? heroPage : componentPage(id);
  return PAGES.map((id) => `<article class="page" data-page="${id}" hidden>${builders[id](copy)}</article>`).join('');
}
