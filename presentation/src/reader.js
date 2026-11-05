import { rem } from '../../src/generator/fluid.js';
import { sizeAt } from '../../src/generator/type.js';
import { PICTURE_URL } from './samples.js';

const config = JSON.parse(document.getElementById('kn-document-data').textContent);
const assets = JSON.parse(document.getElementById('kn-specimen-data').textContent);
const sharedCss = document.getElementById('kn-shared').textContent;
const pages = config.pages;
const pageElements = [...document.querySelectorAll('[data-page]')];
const number = new Intl.NumberFormat(config.lang, { maximumFractionDigits: 1 });
const translate = (key, values = {}) => config.copy[key].replace(/\{([\w-]+)\}/g, (_, name) => values[name] ?? `{${name}}`);
let currentPage;
let returnFocus;
let component = '';
let editId;
let storageAvailable = true;
const frameUpdaters = new Map();
const storageKey = `kn-presentation:${config.project.name}:${config.filename}:${config.project.version}`;
let state = { comments: [], name: '', drafts: {} };

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.comments)) {
      state.comments = saved.comments.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.text === 'string' && pages.some((page) => page.id === entry.page));
      state.name = typeof saved.name === 'string' ? saved.name : '';
      state.drafts = saved.drafts && typeof saved.drafts === 'object' ? saved.drafts : {};
    }
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    storageAvailable = false;
  }
}

function saveState() {
  if (storageAvailable) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      storageAvailable = false;
    }
  }
  document.getElementById('storage-status').textContent = translate(storageAvailable ? 'comment.saved' : 'comment.storage');
  updateCounts();
  updateMail();
}

function pageTitle(id) {
  return document.getElementById(id).dataset.title;
}

function componentTitle(id) {
  return document.querySelector(`[data-specimen-frame="${id}"]`)?.title || id;
}

function draftKey() {
  return `${currentPage}:${component}`;
}

function storeDraft() {
  const value = document.getElementById('comment-text').value;
  if (editId) {
    const entry = state.comments.find((entry) => entry.id === editId);
    if (entry) entry.text = value;
    renderFinalComments();
  } else {
    state.drafts[draftKey()] = value;
  }
  saveState();
}

function updateCounts() {
  const count = state.comments.filter((entry) => entry.page === currentPage).length;
  for (const badge of document.querySelectorAll('[data-page-count]')) {
    badge.textContent = number.format(count);
    badge.hidden = count === 0;
  }
  for (const badge of document.querySelectorAll('[data-total-count]')) {
    badge.textContent = number.format(state.comments.length);
  }
}

function createText(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function commentEntry(entry) {
  const element = document.createElement('article');
  element.className = 'comment-entry';
  if (entry.component) {
    element.append(createText('p', translate('comment.component', { component: componentTitle(entry.component) })));
  }
  element.append(createText('p', entry.text));
  const edit = createText('button', translate('comment.edit'));
  edit.type = 'button';
  edit.addEventListener('click', () => {
    const beginEdit = () => {
      openComments(entry.component, false);
      editId = entry.id;
      document.getElementById('comment-add').textContent = translate('comment.save-edit');
      document.getElementById('comment-text').value = entry.text;
      document.getElementById('comment-text').focus();
    };
    if (currentPage !== entry.page) {
      window.addEventListener('hashchange', beginEdit, { once: true });
      location.hash = entry.page;
    } else {
      beginEdit();
    }
  });
  const remove = createText('button', translate('comment.remove'));
  remove.type = 'button';
  remove.addEventListener('click', () => {
    state.comments = state.comments.filter((comment) => comment.id !== entry.id);
    if (editId === entry.id) {
      editId = undefined;
      document.getElementById('comment-text').value = '';
    }
    saveState();
    renderComments();
  });
  element.append(edit, remove);
  return element;
}

function renderFinalComments() {
  const host = document.getElementById('all-comments');
  host.replaceChildren();
  if (state.comments.length === 0) host.append(createText('p', translate('comment.empty')));
  for (const page of pages) {
    const comments = state.comments.filter((entry) => entry.page === page.id);
    if (!comments.length) continue;
    const heading = createText('h2', pageTitle(page.id));
    heading.dataset.knType = 'heading-3';
    host.append(heading, ...comments.map(commentEntry));
  }
}

function renderComments() {
  const host = document.getElementById('page-comments');
  const comments = state.comments.filter((entry) => entry.page === currentPage);
  host.replaceChildren(...comments.map(commentEntry));
  if (!comments.length) host.append(createText('p', translate('comment.empty')));
  renderFinalComments();
}

function openComments(id = '', rememberFocus = true) {
  if (rememberFocus) returnFocus = document.activeElement;
  component = id || '';
  editId = undefined;
  document.getElementById('comment-add').textContent = translate('comment.add');
  document.getElementById('comment-panel').hidden = false;
  document.getElementById('comment-toggle').setAttribute('aria-expanded', 'true');
  const context = pageTitle(currentPage) + (component ? ` · ${componentTitle(component)}` : '');
  document.getElementById('comment-context').textContent = context;
  document.getElementById('comment-text').value = state.drafts[draftKey()] || '';
  renderComments();
  document.getElementById('comment-text').focus();
}

function closeComments() {
  document.getElementById('comment-panel').hidden = true;
  document.getElementById('comment-toggle').setAttribute('aria-expanded', 'false');
  editId = undefined;
  if (returnFocus?.isConnected) returnFocus.focus();
}

function commentText() {
  const lines = [
    translate('comment.document', { client: config.project.name, document: config.title }),
    translate('comment.version', { version: config.project.version }),
    translate('comment.date', { date: config.date }),
    `${translate('comment.reader')}: ${state.name.trim() || translate('comment.name-missing')}`,
    '',
  ];
  for (const page of pages) {
    const comments = state.comments.filter((entry) => entry.page === page.id);
    if (!comments.length) continue;
    lines.push(translate('comment.page', { page: pageTitle(page.id) }), '');
    for (const entry of comments) {
      if (entry.component) lines.push(translate('comment.component', { component: componentTitle(entry.component) }));
      lines.push(entry.text, '');
    }
  }
  if (!state.comments.length) lines.push(translate('comment.empty'));
  for (const [key, value] of Object.entries(state.drafts)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const [page, specimen] = key.split(':');
    if (!pages.some((entry) => entry.id === page)) continue;
    lines.push(translate('comment.page', { page: pageTitle(page) }));
    if (specimen) lines.push(translate('comment.component', { component: componentTitle(specimen) }));
    lines.push(value, '');
  }
  return lines.join('\n');
}

function mailLink(body) {
  const email = config.project.contact?.email || '';
  const subject = translate('comment.subject', { client: config.project.name, document: config.title });
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function updateMail() {
  const full = mailLink(commentText());
  const tooLong = full.length > 1800;
  const link = document.getElementById('mail-comments');
  link.href = tooLong ? mailLink(translate('comment.mail-note')) : full;
  link.dataset.attach = String(tooLong);
}

function downloadComments() {
  const blob = new Blob([commentText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${config.slug}-${config.filename}-${translate('comments')}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function frameDocument(id, mode, showing) {
  const specimen = assets.specimens[id];
  // The live tool's list of pictures has no use here, and it would carry every picture again.
  const body = specimen.body.replace(/<script id="kn-built-pictures"[\s\S]*?<\/script>/, '').replace(PICTURE_URL, (url) => assets.pictures[url]);
  const styles = specimen.styles.map((index) => assets.styles[index]).join('\n');
  const scripts = specimen.scripts.map((index) => `<script>${assets.scripts[index]}<\/script>`).join('\n');
  return `<!doctype html><html lang="${config.lang}" data-kn-mode="${mode}" data-kn-pictures="${showing}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${sharedCss}\n${styles}</style><style id="kn-live-core"></style></head>${body}${scripts}</html>`;
}

function pressedValue(page, control, fallback) {
  return page.querySelector(`[${control}] [aria-pressed="true"]`)?.dataset.value ?? fallback;
}

function initFrame(specimen) {
  const frame = specimen.querySelector('iframe');
  if (frame.hasAttribute('srcdoc')) return;
  const page = specimen.closest('[data-page]');
  const stage = specimen.querySelector('.specimen-stage');
  const fixed = stage.hasAttribute('data-fixed');
  let frameObserver;
  let bodyObserver;
  let sizeScheduled = false;

  function sizeFrame() {
    if (fixed || !frame.contentDocument?.body) return;
    const body = frame.contentDocument.body;
    const height = Math.ceil(Math.max(body.scrollHeight, body.getBoundingClientRect().height));
    frame.style.height = `${height}px`;
  }

  function scheduleSize() {
    if (sizeScheduled) return;
    sizeScheduled = true;
    requestAnimationFrame(() => {
      sizeScheduled = false;
      sizeFrame();
    });
  }

  function applyToolbar() {
    const width = pressedValue(page, 'data-frame-width', 'wide');
    frame.style.width = width === 'wide' ? '100%' : `${width}px`;
    if (frame.contentDocument) {
      frame.contentDocument.documentElement.dataset.knMode = pressedValue(page, 'data-frame-mode', 'light');
      frame.contentDocument.documentElement.dataset.knPictures = pressedValue(page, 'data-frame-pictures', 'on');
    }
    scheduleSize();
  }

  frame.addEventListener('load', () => {
    frameObserver?.disconnect();
    bodyObserver?.disconnect();
    const child = frame.contentDocument;
    if (!child?.body) return;
    child.addEventListener('click', (event) => {
      if (child.querySelector('dialog[open], .kn-consent:not([hidden])')) {
        const bounds = frame.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > innerHeight) frame.scrollIntoView({ block: 'center' });
      }
      const anchor = event.target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        if (!href.startsWith('#') || !child.getElementById(href.slice(1))) event.preventDefault();
      }
    });
    child.addEventListener('submit', (event) => event.preventDefault());
    child.addEventListener('keydown', handleArrow);
    frameObserver = new ResizeObserver(scheduleSize);
    frameObserver.observe(child.body);
    bodyObserver = new MutationObserver(scheduleSize);
    bodyObserver.observe(child.body, { childList: true, subtree: true, attributes: true });
    child.fonts.ready.then(scheduleSize);
    for (const image of child.images) image.addEventListener('load', scheduleSize);
    applyToolbar();
  });
  frameUpdaters.set(specimen, applyToolbar);
  new ResizeObserver(scheduleSize).observe(stage);
  applyToolbar();
  frame.srcdoc = frameDocument(frame.dataset.specimenFrame, pressedValue(page, 'data-frame-mode', 'light'), pressedValue(page, 'data-frame-pictures', 'on'));
}

// A window size wider than the column could not show at its real width, so it is not offered.
function updateWidthOptions(page) {
  const group = page.querySelector('[data-frame-width]');
  if (!group) return;
  const available = page.querySelector('.page-content').clientWidth;
  let offered = 0;
  for (const button of group.querySelectorAll('button')) {
    const fits = button.dataset.value === 'wide' || Number(button.dataset.value) <= available;
    button.hidden = !fits;
    if (fits) offered += 1;
    if (!fits && button.getAttribute('aria-pressed') === 'true') pressToolbarButton(group.querySelector('[data-value="wide"]'));
  }
  group.hidden = offered < 2;
}

function pressToolbarButton(button) {
  for (const sibling of button.parentElement.querySelectorAll('button')) {
    sibling.setAttribute('aria-pressed', String(sibling === button));
  }
  const page = button.closest('[data-page]');
  if (page.id === 'colour-together') showColourMode(page);
  for (const specimen of page.querySelectorAll('.specimen')) frameUpdaters.get(specimen)?.();
}

function showColourMode(page) {
  const mode = pressedValue(page, 'data-frame-mode', 'light');
  page.querySelector('[data-colour-examples]').dataset.knMode = mode;
  for (const caption of page.querySelectorAll('[data-ratios]')) {
    caption.textContent = JSON.parse(caption.dataset.ratios)[mode];
  }
}

function initVisibleFrames() {
  const page = document.getElementById(currentPage);
  for (const specimen of page.querySelectorAll('.specimen')) {
    if (specimen.closest('details:not([open])')) continue;
    initFrame(specimen);
  }
}

function closeMenu(restoreFocus = false) {
  const wasOpen = document.getElementById('sidebar').classList.contains('is-open');
  document.getElementById('sidebar').classList.remove('is-open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  if (restoreFocus && wasOpen) document.getElementById('menu-toggle').focus();
}

function showPage() {
  const requested = location.hash.slice(1);
  currentPage = pages.some((page) => page.id === requested) ? requested : pages[0].id;
  for (const page of pageElements) {
    page.classList.toggle('is-current', page.id === currentPage);
  }
  for (const link of document.querySelectorAll('[data-nav-page]')) {
    if (link.dataset.navPage === currentPage) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const chapter = pages.find((page) => page.id === currentPage).chapter;
  for (const element of document.querySelectorAll('[data-nav-chapter]')) {
    element.classList.toggle('is-active', element.dataset.navChapter === chapter);
  }
  const toggle = document.getElementById('comment-toggle');
  toggle.hidden = currentPage === 'start' || currentPage === 'comments';
  if (toggle.hidden && !document.getElementById('comment-panel').hidden) closeComments();
  document.getElementById(currentPage).querySelector('h1').focus({ preventScroll: true });
  window.scrollTo(0, 0);
  closeMenu();
  updateCounts();
  updateWidthOptions(document.getElementById(currentPage));
  initVisibleFrames();
  if (!document.getElementById('comment-panel').hidden) openComments('', false);
}

function handleArrow(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
  if (event.target.closest('input, textarea, select, button, summary, [contenteditable], [role="slider"], [role="menu"]')) return;
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!delta) return;
  const next = pages[pages.findIndex((page) => page.id === currentPage) + delta];
  if (next) {
    event.preventDefault();
    location.hash = next.id;
  }
}

function updateScale() {
  const width = Number(document.getElementById('type-window').value);
  document.getElementById('type-window-value').textContent = translate('value.px', { value: number.format(width) });
  for (const line of document.querySelectorAll('[data-scale-style]')) {
    const style = line.dataset.scaleStyle;
    const current = sizeAt(config.typeScale, config.type[style].step, width);
    line.style.fontSize = rem(current);
    const features = config.type[style].features;
    line.style.fontFeatureSettings = features && width >= features['from-window'] ? features.value : 'normal';
    document.querySelector(`[data-type-size="${style}"]`).textContent = translate('value.px', { value: number.format(current) });
  }
}

document.documentElement.classList.add('js');
readState();
document.getElementById('reader-name').value = state.name;
saveState();
renderFinalComments();
window.addEventListener('hashchange', showPage);
document.addEventListener('keydown', handleArrow);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeMenu(true);
  if (!document.getElementById('comment-panel').hidden) closeComments();
});
document.addEventListener('toggle', initVisibleFrames, true);
document.getElementById('menu-toggle').addEventListener('click', () => {
  const open = document.getElementById('sidebar').classList.toggle('is-open');
  document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
});
document.getElementById('comment-toggle').addEventListener('click', () => {
  if (document.getElementById('comment-panel').hidden) openComments();
  else closeComments();
});
document.getElementById('comment-close').addEventListener('click', closeComments);
for (const button of document.querySelectorAll('[data-specimen-comment]')) {
  button.addEventListener('click', () => openComments(button.dataset.specimenComment));
}
document.getElementById('comment-text').addEventListener('input', storeDraft);
document.getElementById('comment-add').addEventListener('click', () => {
  const field = document.getElementById('comment-text');
  if (!field.value.trim()) return;
  if (!editId) {
    state.comments.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, page: currentPage, component, text: field.value.trim() });
  }
  editId = undefined;
  delete state.drafts[draftKey()];
  document.getElementById('comment-add').textContent = translate('comment.add');
  field.value = '';
  saveState();
  renderComments();
});
document.getElementById('reader-name').addEventListener('input', (event) => {
  state.name = event.target.value;
  saveState();
});
document.getElementById('save-comments').addEventListener('click', downloadComments);
document.getElementById('copy-comments').addEventListener('click', async () => {
  let copied = false;
  try {
    await navigator.clipboard.writeText(commentText());
    copied = true;
  } catch {
    const field = document.createElement('textarea');
    field.value = commentText();
    document.body.append(field);
    field.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    field.remove();
  }
  document.getElementById('comment-feedback').textContent = translate(copied ? 'comment.copied' : 'comment.copy-failed');
});
document.getElementById('mail-comments').addEventListener('click', (event) => {
  const feedback = document.getElementById('comment-feedback');
  if (!config.project.contact?.email) {
    event.preventDefault();
    feedback.textContent = translate('comment.no-email');
  } else if (event.currentTarget.dataset.attach === 'true') {
    feedback.textContent = translate('comment.attach');
  }
});
document.getElementById('clear-comments').addEventListener('click', () => {
  if (!confirm(translate('comment.clear-confirm'))) return;
  state.comments = [];
  state.drafts = {};
  editId = undefined;
  document.getElementById('comment-text').value = '';
  saveState();
  renderComments();
});
document.getElementById('type-window').addEventListener('input', updateScale);
document.addEventListener('click', (event) => {
  const button = event.target.closest('.segmented button');
  if (button) pressToolbarButton(button);
});
window.addEventListener('resize', () => updateWidthOptions(document.getElementById(currentPage)));
updateScale();
showPage();
