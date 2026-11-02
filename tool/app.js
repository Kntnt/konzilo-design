import { derive } from '/src/generator/index.js';
import { coreCss } from '/src/css/index.js';
import { SYSTEM_SANS, SYSTEM_MONOSPACE } from '/src/generator/defaults.js';
import {
  absoluteSteps,
  changeStep,
  stepLimits,
  ratioOptions,
  preset,
  contrastError,
} from './logic.js';
import { pictures } from '/presentation/src/samples.js';
import { setupTooltips } from '/gallery/src/tooltips.js';
const data = await fetch('/api/state').then((r) => r.json());
let model = { inputs: data.inputs, project: data.project };
const form = document.getElementById('controls');
const status = document.getElementById('status');
const result = document.getElementById('result');
const preview = document.getElementById('preview');
const presentation = document.getElementById('presentation');
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const getValue = (path) => path.split('.').reduce((o, k) => o?.[k], model);
const setValue = (path, value) => {
  const parts = path.split('.');
  const key = parts.pop();
  let obj = model;
  for (const p of parts) obj = obj[p] ??= {};
  if (value === '') delete obj[key];
  else obj[key] = value;
};
let tipIndex = 0;
const tips = [];
function tip(text) {
  const id = `tip-${++tipIndex}`;
  tips.push(
    `<span class="g-control-tip" hidden id="${id}" role="tooltip">${escapeHtml(text)}</span>`,
  );
  return `title="${escapeHtml(text)}" aria-describedby="${id}" data-g-tooltip="${id}"`;
}
function optionsMarkup(choices) {
  return choices
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
    )
    .join('');
}

function field(label, path, type = 'text', options = {}) {
  const id = path.replaceAll('.', '-');
  const help =
    options.tip ||
    `${label} changes the corresponding design setting and every component that uses it.`;
  const attributes = `id="${id}" data-path="${path}" ${tip(help)}`;
  if (type === 'checkbox') {
    return `<label class="check-field" for="${id}">
      <span>${escapeHtml(label)}</span>
      <input ${attributes} type="checkbox">
    </label>`;
  }
  const limits =
    options.min === undefined
      ? ''
      : `min="${options.min}" max="${options.max}" step="${options.step || 1}"`;
  let control =
    type === 'textarea'
      ? `<textarea ${attributes} rows="4"></textarea>`
      : type === 'select'
      ? `<select ${attributes}>${optionsMarkup(options.choices)}</select>`
      : `<input ${attributes} type="${type}" ${limits}>`;
  if (type === 'color') {
    control = `<span class="colour-controls">
      ${control}
      <input type="text" data-hex="${path}" aria-label="${escapeHtml(label)} hex value"
        maxlength="7" pattern="#[0-9a-fA-F]{6}" spellcheck="false"
        ${tip('Enter the exact six-digit hex value, including #.')} />
    </span>`;
  }
  const output =
    type === 'range' ? `<output data-output="${path}"></output>` : '';
  const ends = options.words
    ? `<span class="range-words">
    <span>${options.words[0]}</span><span>${options.words[1]}</span>
  </span>`
    : '';
  return `<label class="field ${options.words ? 'profile-field' : ''}" for="${id}">
    <span>${escapeHtml(label)}${output}</span>
    ${control}
    ${ends}
  </label>`;
}

function font(label, role, follow) {
  const id = `inputs-typefaces-${role}`;
  const choices =
    role === 'monospace'
      ? [
          [SYSTEM_MONOSPACE, 'System monospace'],
          ['Red Hat Mono', 'Red Hat Mono'],
          ['other', 'Other…'],
        ]
      : [
          ...(follow ? [['', follow]] : []),
          ['Mona Sans', 'Mona Sans'],
          [SYSTEM_SANS, 'System sans-serif'],
          ['Georgia, serif', 'System serif'],
          ['other', 'Other…'],
        ];
  const help = `${label} selects the typeface for this role. ${follow || 'The main family is used for running text.'} Other uses an installed typeface; missing fonts use the system fallback.`;
  return `<label class="field font-field" for="${id}">
    <span>${label}</span>
    <span class="font-controls">
      <select id="${id}" data-font="${role}" ${tip(help)}>${optionsMarkup(choices)}</select>
      <input aria-label="Installed typeface for ${label}" data-other="${role}"
        placeholder="Installed typeface name"
        ${tip('Enter the exact name of a typeface installed on this computer. It is used in the preview and presentation.')} />
    </span>
  </label>`;
}

function bodySizeFields() {
  return `<div class="body-sizes">
    <span>Body size</span>
    <div>${[
      ['min', 'Narrow', 320],
      ['max', 'Wide', 1440],
    ]
      .map(
        ([end, label, width]) => `<label>
      ${label}<input type="number" min="12" max="48" data-path="inputs.type.body-size.${end}"
        ${tip(`Body size in pixels at a ${width} px window.`)} />
    </label>`,
      )
      .join('')}</div>
  </div>`;
}

function typeStepper(key) {
  const label =
    key === 'display'
      ? 'Display'
      : key.startsWith('heading-')
        ? 'H' + key.slice(-1)
        : key[0].toUpperCase() + key.slice(1);
  return `<div class="step-row">
    <span>${label}</span>
    <button type="button" aria-label="Decrease ${key} step" data-step="${key}" data-delta="-1"
      ${tip('Move this style one step down. Other styles keep their absolute step; adjacent levels cannot cross.')}>−</button>
    <output data-step-value="${key}"></output>
    <button type="button" aria-label="Increase ${key} step" data-step="${key}" data-delta="1"
      ${tip('Move this style one step up. Other styles keep their absolute step; schema limits still apply.')}>+</button>
    <output class="size" data-size="${key}"></output>
  </div>`;
}

function explanation(key) {
  return field('Why this choice (shown to the client)', `project.explanations.${key}`, 'textarea', {
    tip: 'Optional. This explanation appears in the presentation. Blank lines make paragraphs.',
  });
}

const logoNames = {};
function logo(key, label) {
  return `<div class="logo-field"><span>${label}</span><div class="logo-controls">
    <input type="file" hidden id="file-${key}" data-logo="${key}" accept="image/svg+xml,image/png" aria-label="${label}">
    <button type="button" data-choose-logo="${key}" ${tip('Choose an SVG or PNG to embed in the design file.')}>Choose logo</button>
    <span data-logo-name="${key}" class="logo-name">No logo</span>
    <button type="button" data-remove="${key}" ${tip('Remove this logo and use the client name.')}>Remove</button>
    <span class="logo-status" data-logo-status="${key}" aria-live="polite"></span>
  </div></div>`;
}
const colors = [
  ['default', 'Text'],
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['tertiary', 'Tertiary'],
  ['gray', 'Grey'],
  ['black', 'Black'],
];
const section = (name, html) =>
  `<fieldset><legend>${name}</legend>${html}</fieldset>`;
const range = (label, path, min, max, extra = {}) =>
  field(label, path, 'range', { min, max, ...extra });
const typeNames = [
  'display',
  'heading-1',
  'heading-2',
  'heading-3',
  'heading-4',
  'heading-5',
  'heading-6',
  'lead',
  'small',
  'label',
];
form.innerHTML =
  section(
    'Client',
    field('Name', 'project.name', 'text', {
      tip: 'The client name appears in the preview identity and on every page of the approval document.',
    }) +
      field('Document version', 'project.version', 'text', {
        tip: 'The version shown on the cover and in the foot of every approval page.',
      }) +
      field('Introduction', 'project.introduction', 'textarea', { tip: 'Optional introduction on the presentation’s Start page. Blank lines make paragraphs.' }) +
      field('Contact name', 'project.contact.name') +
      field('Contact email', 'project.contact.email', 'email') +
      logo('logo', 'Logo') +
      logo('logo-dark', 'Logo for dark backgrounds'),
  ) +
  section(
    'Colours',
    field('Primary', 'inputs.brand-colors.primary', 'color', {
      tip: 'The main brand colour generates the primary ramp, links, buttons and brand Surfaces.',
    }) +
      field('Secondary on', 'secondary-enabled', 'checkbox', {
        tip: 'Add a second colour for accents, focus and its own tint. Switching it off also removes the third colour.',
      }) +
      field('Secondary', 'inputs.brand-colors.secondary', 'color') +
      field('Tertiary on', 'tertiary-enabled', 'checkbox', {
        tip: 'Add a third brand tint. A secondary colour must be enabled first.',
      }) +
      field('Tertiary', 'inputs.brand-colors.tertiary', 'color') +
      range('Grey temperature', 'inputs.gray-temperature', -100, 100, {
        tip: 'Makes neutral colours cooler or warmer, without changing the brand colours.',
      }) + explanation('colour'),
  ) +
  section(
    'Typefaces',
    field('Start from', 'preset', 'select', {
      choices: [
        ['', 'Choose an arrangement…'],
        ['one', 'One typeface throughout'],
        ['mono', 'One typeface; monospace labels'],
        ['serif', 'Serif text; sans-serif headings'],
        ['display', 'A display face for large text'],
      ],
      tip: 'Apply a starting arrangement to the typeface rows below. You can then change any role separately.',
    }) +
      font('Text', 'main') +
      font('Headings', 'heading', 'Same as Text') +
      font('First heading', 'heading-1', 'Same as Headings') +
      field('First heading colour', 'inputs.type.heading-1-color', 'select', {
        choices: [
          ['text', 'Text'],
          ['accent', 'Accent'],
        ],
        tip: 'First-heading text uses the Surface’s text or accent role, so it follows the checked context on every background.',
      }) +
      font('Display', 'display', 'Same as Headings') +
      field('Labels', 'inputs.type.label', 'select', {
        choices: [
          ['main', 'Main typeface'],
          ['monospace', 'Monospace'],
        ],
        tip: 'Changes eyebrows, metadata and other labels together. Choosing monospace recommends Red Hat Mono when the system stack is still selected.',
      }) +
      font('Monospace', 'monospace') + explanation('typefaces'),
  ) +
  section(
    'Type scale',
    bodySizeFields() +
      field('Narrow window', 'inputs.type.ratio.min', 'select', {
        choices: ratioOptions(model.inputs.type.ratio.min).map(([n, name]) => [
          n,
          name.startsWith('Custom') ? name : `${n} ${name}`,
        ]),
        tip: 'The ratio between type steps at the narrowest window. Custom file values are preserved.',
      }) +
      field('Wide window', 'inputs.type.ratio.max', 'select', {
        choices: ratioOptions(model.inputs.type.ratio.max).map(([n, name]) => [
          n,
          name.startsWith('Custom') ? name : `${n} ${name}`,
        ]),
        tip: 'The ratio between type steps at the widest window. Higher ratios usually need fewer steps.',
      }) +
      typeNames.map(typeStepper).join('') +
      '<p class="warning" id="scale-warning" role="status"></p>' + explanation('type-scale'),
  ) +
  section(
    'Shadow',
    field('Shadows on', 'shadow-enabled', 'checkbox', {
      tip: 'Zero strength turns shadows off. Switching on restores the previous strength or starts at the reference strength.',
    }) +
      range('Strength', 'inputs.shadow.strength', 0, 100, {
        tip: 'Scales shadow opacity. Zero means off; a fully hard shadow uses the solid chosen colour.',
      }) +
      range('Hardness', 'inputs.shadow.hardness', 0, 100, {
        tip: 'Moves from soft blurred edges to a solid offset. All six elevations change together.',
      }) +
      range('Angle', 'inputs.shadow.angle', -90, 90, {
        tip: 'Turns the light direction, changing the offset of every shadow.',
      }) +
      range('Elevation', 'inputs.shadow.elevation', 0, 100, {
        tip: 'Scales shadow distance, blur and spread across all elevations.',
      }) +
      field('Colour', 'inputs.shadow.color', 'select', { choices: colors }) +
      Object.entries({
        box: 'Cards',
        header: 'Header',
        panel: 'Panel',
        page: 'Page over footer',
      })
        .map(([key, label]) =>
          field(label, `inputs.shadow.targets.${key}`, 'checkbox', {
            tip: `Apply shadow to ${label.toLowerCase()}. Without it the component uses its hairline fallback.`,
          }),
        )
        .join('') + explanation('shadow'),
  ) +
  section(
    'Frame',
    range('Thickness', 'inputs.frame.width', 0, 3, {
      tip: 'Adds a solid 0–3 px frame to buttons and plated cards. Table and field hairlines stay independent.',
    }) + field('Colour', 'inputs.frame.color', 'select', { choices: colors }),
  ) +
  section(
    'Corners',
    range('Corners', 'inputs.corner-profile', 0, 100, {
      words: ['Square', 'Clearly rounded'],
      tip: 'Sets related corner radii for controls and cards, from square through discreet to clearly rounded.',
    }),
  ) +
  section(
    'Density',
    range('Density', 'inputs.density-profile', 0, 100, {
      words: ['Very compact', 'Very loose'],
      tip: 'Changes the whole spacing scale together: component gaps, columns, padding and band rhythm.',
    }) + explanation('space-shape'),
  ) + section('Components', explanation('components'));
for (const id of ['save', 'presentation', 'viewport', 'mode']) {
  const control = document.getElementById(id);
  const holder = document.createElement('span');
  holder.innerHTML = '<span ' + tip(control.title) + '></span>';
  for (const attribute of holder.firstChild.attributes)
    control.setAttribute(attribute.name, attribute.value);
}
document.body.insertAdjacentHTML('beforeend', tips.join(''));
setupTooltips();
let secondary = model.inputs['brand-colors'].secondary || '#b66c32',
  tertiary = model.inputs['brand-colors'].tertiary || '#596db4',
  strength = model.inputs.shadow.strength || 50,
  valid = false,
  generating = false;
function displayedColour(path) {
  return getValue(path) || (path.endsWith('.secondary') ? secondary : tertiary);
}

function writeValues() {
  for (const control of form.querySelectorAll('[data-path]')) {
    const path = control.dataset.path;
    let value = getValue(path);
    if (path === 'secondary-enabled')
      value = Boolean(model.inputs['brand-colors'].secondary);
    if (path === 'tertiary-enabled')
      value = Boolean(model.inputs['brand-colors'].tertiary);
    if (path === 'shadow-enabled')
      value = Boolean(model.inputs.shadow.strength);
    if (path === 'preset') {
      control.value = '';
      continue;
    }
    if (path === 'inputs.type.heading-1-color') value ||= 'text';
    if (path === 'inputs.brand-colors.secondary') value ||= secondary;
    if (path === 'inputs.brand-colors.tertiary') value ||= tertiary;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else {
      if (
        control.tagName === 'SELECT' &&
        value &&
        !Array.from(control.options).some(
          (option) => option.value === String(value),
        )
      ) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `Custom (${value})`;
        control.append(option);
      }
      control.value = value ?? '';
    }
  }
  for (const select of form.querySelectorAll('[data-font]')) {
    const value = model.inputs.typefaces[select.dataset.font] || '';
    const known = [...select.options].some((o) => o.value === value);
    select.value = known ? value : 'other';
    const other = form.querySelector(`[data-other="${select.dataset.font}"]`);
    other.value = known ? '' : value;
    other.disabled = known;
    other.hidden = known;
  }
  for (const input of form.querySelectorAll('[data-logo-status]')) {
    const key = input.dataset.logoStatus;
    input.textContent = model.project[key]
      ? 'Logo embedded'
      : 'Using client name';
    const name = form.querySelector(`[data-logo-name="${key}"]`);
    name.textContent = model.project[key]
      ? logoNames[key] || 'Embedded logo'
      : 'No logo';
    name.title = name.textContent;
  }
  for (const control of form.querySelectorAll('[data-hex]'))
    control.value = displayedColour(control.dataset.hex);
}
function sync() {
  try {
    const resolved = derive(model.inputs);
    const error = contrastError(resolved['contrast-check']);
    if (error) throw new Error(error);
    valid = true;
    presentation.disabled = generating;
    status.removeAttribute('title');
    status.textContent = `Contrast passed · ${Object.keys(resolved.surfaces).length} Surfaces, both modes`;
    preview.contentWindow?.postMessage(
      {
        type: 'kn-design',
        picture: pictures(resolved.ramps).landscape,
        css: coreCss(resolved),
        mode: document.getElementById('mode').value,
        project: model.project,
      },
      location.origin,
    );
    if (model.inputs.shadow.strength > 0)
      strength = model.inputs.shadow.strength;
    const absolute = absoluteSteps(model.inputs.type.steps);
    for (const key of typeNames) {
      form.querySelector(`[data-step-value="${key}"]`).value = String(
        absolute[key],
      );
      const size = resolved.type[key].size;
      form.querySelector(`[data-size="${key}"]`).value =
        size.min === size.max ? `${size.min} px` : `${size.min}–${size.max} px`;
      const [min, max] = stepLimits(model.inputs.type.steps, key);
      for (const button of form.querySelectorAll(`[data-step="${key}"]`))
        button.disabled =
          Number(button.dataset.delta) < 0
            ? absolute[key] <= min
            : absolute[key] >= max;
    }
    document.getElementById('scale-warning').textContent =
      Math.max(resolved.type.display.size.min, resolved.type.display.size.max) >
      100
        ? 'The largest heading exceeds 100 px. A higher ratio usually needs fewer steps.'
        : '';
  } catch (error) {
    valid = false;
    presentation.disabled = true;
    status.textContent = error.message;
    status.title = error.message;
  }
  for (const output of form.querySelectorAll('[data-output]')) {
    const value = getValue(output.dataset.output);
    output.value =
      output.dataset.output === 'inputs.gray-temperature'
        ? `${value} · ${value < 0 ? 'Cool' : value > 0 ? 'Warm' : 'Neutral'}`
        : output.dataset.output === 'inputs.corner-profile'
          ? `${value} · ${value === 0 ? 'Square' : value < 60 ? 'Discreet' : 'Rounded'}`
          : String(value);
  }
  const enabled = Boolean(model.inputs['brand-colors'].secondary);
  form.querySelector('[data-path="tertiary-enabled"]').disabled = !enabled;
  form.querySelector('[data-path="inputs.brand-colors.secondary"]').disabled =
    !enabled;
  form.querySelector('[data-path="inputs.brand-colors.tertiary"]').disabled =
    !model.inputs['brand-colors'].tertiary;
  for (const control of form.querySelectorAll('[data-hex]')) {
    control.value = displayedColour(control.dataset.hex);
    control.disabled = form.querySelector(
      `[data-path="${control.dataset.hex}"]`,
    ).disabled;
  }
  form.querySelector('[data-path="shadow-enabled"]').checked = Boolean(
    model.inputs.shadow.strength,
  );
  for (const path of ['inputs.shadow.color', 'inputs.frame.color']) {
    const control = form.querySelector(`[data-path="${path}"]`);
    for (const option of control.options)
      if (['secondary', 'tertiary'].includes(option.value))
        option.disabled = !model.inputs['brand-colors'][option.value];
  }
}
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', (event) => {
  const c = event.target,
    path = c.dataset.path;
  if (c.dataset.hex) {
    if (!/^#[0-9a-f]{6}$/i.test(c.value)) return;
    setValue(c.dataset.hex, c.value);
    if (c.dataset.hex.endsWith('.secondary')) secondary = c.value;
    if (c.dataset.hex.endsWith('.tertiary')) tertiary = c.value;
    form.querySelector(`[data-path="${c.dataset.hex}"]`).value = c.value;
  } else if (c.dataset.font) {
    setValue(
      `inputs.typefaces.${c.dataset.font}`,
      c.value === 'other'
        ? form.querySelector(`[data-other="${c.dataset.font}"]`).value ||
            'Local Typeface'
        : c.value,
    );
    writeValues();
  } else if (c.dataset.other)
    setValue(
      `inputs.typefaces.${c.dataset.other}`,
      c.value || 'Local Typeface',
    );
  else if (path === 'preset') {
    if (c.value) model.inputs = preset(c.value, model.inputs);
    writeValues();
  } else if (path === 'secondary-enabled') {
    if (c.checked) model.inputs['brand-colors'].secondary = secondary;
    else {
      delete model.inputs['brand-colors'].secondary;
      delete model.inputs['brand-colors'].tertiary;
      for (const group of ['shadow', 'frame'])
        if (['secondary', 'tertiary'].includes(model.inputs[group].color))
          model.inputs[group].color = 'default';
    }
    writeValues();
  } else if (path === 'tertiary-enabled') {
    if (c.checked) model.inputs['brand-colors'].tertiary = tertiary;
    else {
      delete model.inputs['brand-colors'].tertiary;
      for (const group of ['shadow', 'frame'])
        if (model.inputs[group].color === 'tertiary')
          model.inputs[group].color = 'default';
    }
    writeValues();
  } else if (path === 'shadow-enabled') {
    if (!c.checked) {
      strength = model.inputs.shadow.strength || 50;
      model.inputs.shadow.strength = 0;
    } else model.inputs.shadow.strength = strength;
    writeValues();
  } else if (path) {
    setValue(
      path,
      c.type === 'checkbox'
        ? c.checked
        : c.type === 'range' || c.type === 'number' || path.includes('.ratio.')
          ? Number(c.value)
          : c.value,
    );
    if (path.endsWith('.secondary')) secondary = c.value;
    if (path.endsWith('.tertiary')) tertiary = c.value;
    if (
      path === 'inputs.type.label' &&
      c.value === 'monospace' &&
      model.inputs.typefaces.monospace === SYSTEM_MONOSPACE
    ) {
      model.inputs.typefaces.monospace = 'Red Hat Mono';
      writeValues();
    }
  }
  sync();
});
form.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.chooseLogo)
    form.querySelector(`[data-logo="${button.dataset.chooseLogo}"]`).click();
  if (button.dataset.step) {
    const key = button.dataset.step;
    model.inputs.type.steps = changeStep(
      model.inputs.type.steps,
      key,
      absoluteSteps(model.inputs.type.steps)[key] +
        Number(button.dataset.delta),
    );
    sync();
  }
  if (button.dataset.remove) {
    model.project[button.dataset.remove] = null;
    form.querySelector(`[data-logo="${button.dataset.remove}"]`).value = '';
    writeValues();
    sync();
  }
});
form.addEventListener('change', async (event) => {
  if (!event.target.dataset.logo) return;
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/svg+xml', 'image/png'].includes(file.type)) {
    status.textContent = 'Choose an SVG or PNG logo.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    status.textContent = 'Choose a logo smaller than 5 MB.';
    return;
  }
  const uri = await new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result);
    reader.onerror = fail;
    reader.readAsDataURL(file);
  });
  if (event.target.files[0] !== file) return;
  logoNames[event.target.dataset.logo] = file.name;
  model.project[event.target.dataset.logo] = uri;
  writeValues();
  sync();
});
async function request(endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Konzilo-Token': data.token,
    },
    body: JSON.stringify(model),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
document.getElementById('save').addEventListener('click', async () => {
  try {
    result.textContent = 'Saving…';
    const saved = await request('/api/save');
    result.textContent = `Saved ${saved.path}`;
  } catch (error) {
    result.textContent = error.message;
  }
});
presentation.addEventListener('click', async () => {
  if (!valid || generating) return;
  generating = true;
  presentation.disabled = true;
  result.textContent = 'Saving and creating presentation…';
  try {
    const saved = await request('/api/presentation');
    result.replaceChildren();
    const link = document.createElement('a');
    link.href = '/api/presentation-file';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `Presentation ready · ${saved.path}`;
    link.title = saved.path;
    result.append(link);
    result.title = saved.path;
  } catch (error) {
    result.textContent = error.message;
  } finally {
    generating = false;
    presentation.disabled = !valid;
  }
});
function resize() {
  const width = Number(document.getElementById('viewport').value);
  const stage = document.getElementById('preview-stage'),
    host = document.getElementById('preview-window');
  const scale = Math.min(1, (stage.clientWidth - 48) / width);
  preview.style.width = `${width}px`;
  preview.style.height = `${Math.max(810, (stage.clientHeight - 48) / scale)}px`;
  host.style.width = `${width * scale}px`;
  host.style.height = `${parseFloat(preview.style.height) * scale}px`;
  preview.style.transform = `scale(${scale})`;
  document.getElementById('preview-size').textContent = `${width} px`;
}
preview.addEventListener('load', sync);
document.getElementById('mode').addEventListener('change', sync);
document.getElementById('viewport').addEventListener('change', resize);
new ResizeObserver(resize).observe(document.getElementById('preview-stage'));
writeValues();
sync();
resize();

new MutationObserver(() => {
  if (!result.querySelector('a')) result.title = result.textContent;
  status.title = status.textContent;
}).observe(document.querySelector('.toolbar'), {
  childList: true,
  subtree: true,
  characterData: true,
});
