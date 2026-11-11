// The two ends of the preview: real pages at their real width, scaled only when they do not fit.
import { previewScale, sizeAt, followShare } from './logic.js';
import { pictures, flatPictures } from '/presentation/src/samples.js';

// Which part of the sample page each page of the document decides.
const FOLLOW = {
  start: 0,
  'colour-scale': '[data-preview-section="surfaces"]',
  'colour-together': '[data-preview-section="surfaces"]',
  'main-typeface': 0,
  'type-scale': 0,
  space: '[data-preview-section="services"]',
  corners: '[data-preview-section="services"]',
  shadow: '[data-preview-section="services"]',
  header: 0,
  footer: 'end',
  page: 0,
  breadcrumbs: 0,
};
// The components have a page of their own, with all of them on it.
const COMPONENT_PAGES = ['opening', 'sections', 'text', 'buttons', 'cards', 'media', 'finding', 'forms'];
const pageSource = (page) => (COMPONENT_PAGES.includes(page) ? '/catalogue.html' : '/preview.html');
const SECTIONS = '.kn-hero, .kn-band, .kn-footer, [data-component]';
const frames = {
  narrow: { frame: document.getElementById('preview-narrow'), view: document.getElementById('view-narrow'), end: document.querySelector('[data-end="narrow"]') },
  wide: { frame: document.getElementById('preview'), view: document.getElementById('view-wide'), end: document.querySelector('[data-end="wide"]') },
};
const pane = document.getElementById('preview-pane');
const fitButton = document.getElementById('fit');
let design = null;
let shownPanel = null;
let quietUntil = 0;
let ignore = null;
let ignoreUntil = 0;

const shown = (name) => {
  const view = pane.dataset.view;
  return view === 'both' || (name === 'narrow' ? view === 'phone' : view === 'desktop');
};
function marks(end) {
  const doc = end.frame.contentDocument;
  if (!doc) return [];
  const headerHeight = doc.querySelector('.kn-header')?.getBoundingClientRect().height || 0;
  const scroll = end.frame.contentWindow.scrollY;
  return [...doc.querySelectorAll(SECTIONS)]
    .filter((section) => !section.parentElement.closest(SECTIONS))
    .map((section) => {
      const box = section.getBoundingClientRect();
      // A footer at the edge of the screen sticks under the page, so where it shows is not where it scrolls to.
      return { top: box.top + scroll - headerHeight, height: box.height, footer: section.matches('.kn-footer'), fixed: section.matches('.kn-footer') && getComputedStyle(section).position === 'sticky' };
    });
}
function syncFrom(source, target) {
  const now = performance.now();
  if (now < quietUntil || !shown(target === frames.wide ? 'wide' : 'narrow')) return;
  if (ignore === source && now < ignoreUntil) return;
  // The end of one is the end of the other, so a footer that shows at one end shows at both.
  const here = source.frame.contentWindow;
  if (here.scrollY > 0 && here.scrollY + here.innerHeight >= source.frame.contentDocument.documentElement.scrollHeight - 1) {
    ignore = target;
    ignoreUntil = now + 80;
    target.frame.contentWindow.scrollTo({ top: target.frame.contentDocument.documentElement.scrollHeight, behavior: 'instant' });
    return;
  }
  let from = marks(source);
  let to = marks(target);
  // A footer revealed under the page has no place of its own to scroll to, so neither end counts its footer.
  if ([...from, ...to].some((mark) => mark.fixed)) {
    from = from.filter((mark) => !mark.footer);
    to = to.filter((mark) => !mark.footer);
  }
  if (!from.length || from.length !== to.length) return;
  const scroll = source.frame.contentWindow.scrollY;
  let index = 0;
  from.forEach((mark, i) => { if (mark.top <= scroll + 1) index = i; });
  const share = from[index].height ? Math.min(1, Math.max(0, (scroll - from[index].top) / from[index].height)) : 0;
  ignore = target;
  ignoreUntil = now + 80;
  target.frame.contentWindow.scrollTo({ top: Math.max(0, to[index].top + share * to[index].height), behavior: 'instant' });
}
function scrollEnd(end, selector, smooth) {
  const doc = end.frame.contentDocument;
  if (!doc?.body) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = smooth && !still ? 'smooth' : 'instant';
  if (selector === 'end') {
    end.frame.contentWindow.scrollTo({ top: doc.documentElement.scrollHeight, behavior });
    return;
  }
  const section = selector ? doc.querySelector(selector) : null;
  const headerHeight = doc.querySelector('.kn-header')?.getBoundingClientRect().height || 0;
  const top = section ? section.getBoundingClientRect().top + end.frame.contentWindow.scrollY - headerHeight : 0;
  end.frame.contentWindow.scrollTo({ top: Math.max(0, top), behavior });
}
export function followPage(page, smooth) {
  quietUntil = performance.now() + 750;
  const selector = COMPONENT_PAGES.includes(page) ? `[data-component-page="${page}"]` : FOLLOW[page];
  for (const end of Object.values(frames)) {
    const source = pageSource(page);
    if (end.source !== source) {
      // The other page comes first, and the scroll follows when it has loaded.
      end.source = source;
      end.afterLoad = selector;
      end.frame.src = source;
    } else scrollEnd(end, selector, smooth);
  }
}
export function showPanelInPreview(panel) {
  shownPanel = panel;
  for (const { frame } of Object.values(frames)) frame.contentWindow?.postMessage({ type: 'kn-frame-panel', panel }, location.origin);
}
export function measure(ui) {
  const { view, frame } = frames.wide;
  const available = view.clientWidth;
  if (!available) return;
  const scale = previewScale(available, ui.width, ui.fit);
  const height = view.clientHeight;
  frame.style.width = `${ui.width}px`;
  frame.style.height = `${height / scale}px`;
  frame.style.transform = scale === 1 ? '' : `scale(${scale})`;
  view.querySelector('.frame-host').style.width = ui.fit ? '100%' : `${ui.width}px`;
  view.toggleAttribute('data-real-size', !ui.fit);
  frames.wide.end.parentElement.style.setProperty('--desktop-width', `${ui.width}px`);
  fitButton.textContent = `${Math.round(scale * 100)} %`;
  const help = document.getElementById(fitButton.dataset.gTooltip);
  if (help) help.textContent = ui.fit ? 'Scaled so the whole page fits. Click for real size, then scroll sideways to see the rest.' : 'Real size. Click to scale the page so all of it fits.';
}
// A drag can step faster than the screen draws, so both ends take the newest design once a frame.
let painting = false;
let postedLooks = null;
function postDesign() {
  painting = false;
  const { resolved, css, project, ui } = design;
  // The frames hold the section in view themselves, and that must not move the other end.
  // A look can also bring its component into view, and each end goes there on its own.
  const looks = JSON.stringify(ui.looks);
  quietUntil = Math.max(quietUntil, performance.now() + (looks === postedLooks ? 200 : 750));
  postedLooks = looks;
  const images = pictures(resolved.ramps, ui.own);
  const message = { type: 'kn-design', looks: ui.looks, pictures: flatPictures(images), hero: { settings: resolved.hero, images: { hero: images.hero, landscapes: images.landscapes } }, showPictures: ui.pictures !== 'off', css, mode: ui.mode, project, surfaces: Object.keys(resolved.surfaces), frame: { header: resolved.header, footer: resolved.footer, page: resolved.page, breadcrumbs: resolved.breadcrumbs } };
  for (const { frame } of Object.values(frames)) frame.contentWindow?.postMessage(message, location.origin);
  const widths = { narrow: 390, wide: ui.width };
  for (const [name, end] of Object.entries(frames)) {
    const read = (key) => Math.round(sizeAt(resolved['type-scale'], resolved.type[key].step, widths[name]));
    end.end.querySelector('[data-end-sizes]').value = `Display ${read('display')} · Body ${read('body')}`;
    const share = ui.touched ? followShare(ui.touched, widths[name], resolved['type-scale']) : null;
    end.end.querySelector('.end-follows').textContent = share === null ? '' : `Follows ${share} %`;
    end.end.querySelector('.end-dot').dataset.on = String(share !== null && share >= 50);
  }
}
export function paint(resolved, css, project, ui) {
  design = { resolved, css, project, ui };
  if (painting) return;
  painting = true;
  requestAnimationFrame(postDesign);
}
// Opening a panel moves the focus into the frame; the control in use takes it back.
let lastControl = null;
document.addEventListener('focusin', (event) => {
  if (event.target.closest('#form')) lastControl = event.target;
});
window.addEventListener('message', (event) => {
  if (event.origin === location.origin && event.data?.type === 'kn-frame-panel-shown') lastControl?.focus({ preventScroll: true });
});
export function setupPreview(onReady) {
  for (const [name, end] of Object.entries(frames)) {
    const other = name === 'narrow' ? frames.wide : frames.narrow;
    const prepare = () => {
      const page = end.frame.contentDocument;
      const style = page.createElement('style');
      style.textContent = 'html { scrollbar-width: none; } body::-webkit-scrollbar { display: none; }';
      page.head.append(style);
      // Any shipped typeface can be chosen here; a browser fetches only those in use.
      const fonts = page.createElement('link');
      fonts.rel = 'stylesheet';
      fonts.href = '/src/fonts/fonts.css';
      page.head.append(fonts);
      end.frame.contentWindow.addEventListener('scroll', () => syncFrom(end, other), { passive: true });
      if (design) paint(design.resolved, design.css, design.project, design.ui);
      if (end.afterLoad !== undefined) {
        scrollEnd(end, end.afterLoad, false);
        delete end.afterLoad;
      }
      end.frame.contentWindow.postMessage({ type: 'kn-frame-panel', panel: shownPanel }, location.origin);
      onReady();
    };
    end.source = '/preview.html';
    end.frame.addEventListener('load', prepare);
    // The frame may have finished loading before this module got here.
    const page = end.frame.contentDocument;
    if (page?.readyState === 'complete' && page.querySelector('.kn-page, .sample-root')) prepare();
  }
}
