// The two ends of the preview: real pages at their real width, scaled only when they do not fit.
import { previewScale, sizeAt, followShare } from './logic.js';
import { pictures, flatPictures } from '/presentation/src/samples.js';
import { cataloguePath } from '/presentation/src/catalogue.js';

// Which part of the sample page each page of the document decides.
const FOLLOW = {
  start: 0,
  // The Start page while the client's own menu or footer is being written.
  'start-menu': 0,
  'start-footer': 'end',
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
// Each component page has a preview of its own, with its own components and nothing else.
const COMPONENT_PAGES = ['opening', 'sections', 'text', 'buttons', 'cards', 'media', 'finding', 'forms'];
const pageSource = (page) => (COMPONENT_PAGES.includes(page) ? cataloguePath(page) : '/preview.html');
// The Header page shows the large menu and the search box open too, each in a frame of its own at each end, and the
// Start page, where the client's own menu is written, the large menu.
const PANELS = ['menu', 'search'];
const PANELS_SHOWN = { header: PANELS, start: ['menu'], 'start-menu': ['menu'], 'start-footer': ['menu'] };
const SECTIONS = '.kn-hero, .kn-band, .kn-footer, [data-component]';
const endOf = (name, frame) => {
  const view = document.getElementById(`view-${name}`);
  return {
    frame,
    view,
    end: document.querySelector(`[data-end="${name}"]`),
    panels: Object.fromEntries(PANELS.map((panel) => [panel, view.querySelector(`[data-panel-frame="${panel}"]`)])),
  };
};
const frames = {
  narrow: endOf('narrow', document.getElementById('preview-narrow')),
  wide: endOf('wide', document.getElementById('preview')),
};
const pane = document.getElementById('preview-pane');
const fitButton = document.getElementById('fit');
let design = null;
let measured = null;
let quietUntil = 0;
let ignore = null;
let ignoreUntil = 0;
let ready = () => {};

const shown = (name) => {
  const view = pane.dataset.view;
  return view === 'both' || (name === 'narrow' ? view === 'phone' : view === 'desktop');
};
// The frames that hold a page now: the ends' own, and on the Header page the panels' too.
const loaded = () => Object.values(frames).flatMap((end) => [end.frame, ...Object.values(end.panels).filter((frame) => frame.dataset.source)]);
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
// The panels' frames hold a page only where they are shown, so the other pages pay nothing for them.
function showPanels(shown) {
  for (const end of Object.values(frames)) {
    if (shown.length) end.view.dataset.panels = shown.join(' ');
    else delete end.view.dataset.panels;
    for (const [panel, frame] of Object.entries(end.panels)) {
      const on = shown.includes(panel);
      const source = on ? `/preview.html?panel=${panel}` : '';
      if (frame.dataset.source === source || (!on && !frame.dataset.source)) continue;
      if (on) frame.dataset.source = source;
      else delete frame.dataset.source;
      frame.src = on ? source : 'about:blank';
    }
  }
  if (measured) measure(measured);
}
export function followPage(page, smooth) {
  quietUntil = performance.now() + 750;
  const selector = FOLLOW[page] ?? 0;
  for (const end of Object.values(frames)) {
    const source = pageSource(page);
    if (end.source !== source) {
      // The other page comes first, and the scroll follows when it has loaded.
      end.source = source;
      end.afterLoad = selector;
      end.frame.src = source;
    } else scrollEnd(end, selector, smooth);
  }
  showPanels(PANELS_SHOWN[page] ?? []);
}
export function measure(ui) {
  measured = ui;
  const { view } = frames.wide;
  const available = view.clientWidth;
  if (!available) return;
  const scale = previewScale(available, ui.width, ui.fit);
  for (const host of view.querySelectorAll('.frame-host')) {
    const frame = host.querySelector('iframe');
    frame.style.width = `${ui.width}px`;
    frame.style.height = `${host.clientHeight / scale}px`;
    frame.style.transform = scale === 1 ? '' : `scale(${scale})`;
    host.style.width = ui.fit ? '100%' : `${ui.width}px`;
  }
  view.toggleAttribute('data-real-size', !ui.fit);
  frames.wide.end.parentElement.style.setProperty('--desktop-width', `${ui.width}px`);
  fitButton.textContent = `${Math.round(scale * 100)} %`;
  const help = document.getElementById(fitButton.dataset.gTooltip);
  if (help) help.textContent = ui.fit ? 'Scaled so the whole page fits. Click for real size, then scroll sideways to see the rest.' : 'Real size. Click to scale the page so all of it fits.';
}
// A drag can step faster than the screen draws, so every frame takes the newest design once a frame.
let painting = false;
function postDesign() {
  painting = false;
  const { resolved, css, project, ui } = design;
  // The frames hold the section in view themselves, and that must not move the other end.
  quietUntil = Math.max(quietUntil, performance.now() + 200);
  const images = pictures(resolved.ramps, ui.own);
  const message = { type: 'kn-design', pictures: flatPictures(images), hero: { settings: resolved.hero, images: { hero: images.hero, landscapes: images.landscapes } }, showPictures: ui.pictures !== 'off', css, mode: ui.mode, project, surfaces: Object.keys(resolved.surfaces), frame: { header: resolved.header, footer: resolved.footer, page: resolved.page, breadcrumbs: resolved.breadcrumbs } };
  for (const frame of loaded()) frame.contentWindow?.postMessage(message, location.origin);
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
// A frame that opens a panel takes the focus with it, though the panels' frames are inert: Chromium and WebKit move it
// into the frame all the same, and Firefox drops it, a moment later. What had it in the tool takes it back.
// WebKit focuses no button on a click, so the control last pressed counts as well as the one last focused.
let lastFocus = null;
document.addEventListener('focusin', (event) => {
  if (!event.target.matches('iframe')) lastFocus = event.target;
});
document.addEventListener('pointerdown', (event) => {
  const control = event.target.closest?.('button, input, select, textarea');
  if (control) lastFocus = control;
}, true);
const reclaim = () => {
  const here = document.activeElement;
  if (here && here !== document.body && !here.matches('iframe')) return;
  if (lastFocus?.isConnected) {
    lastFocus.focus({ preventScroll: true });
    // The focus given back is no visit, so the control's tooltip stays hidden.
    lastFocus.dispatchEvent(new Event('pointerout', { bubbles: true }));
  }
  if (document.activeElement?.matches('iframe')) document.activeElement.blur();
};
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'kn-frame-panel-shown') return;
  reclaim();
  for (const delay of [50, 250]) setTimeout(reclaim, delay);
});
// A frame's page has loaded: it takes the shipped typefaces and the design as it is now.
function prepare(frame) {
  const page = frame.contentDocument;
  if (!page?.head || frame.contentWindow.location.href === 'about:blank') return false;
  const style = page.createElement('style');
  style.textContent = 'html { scrollbar-width: none; } body::-webkit-scrollbar { display: none; }';
  page.head.append(style);
  // Any shipped typeface can be chosen here; a browser fetches only those in use.
  const fonts = page.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = '/src/fonts/fonts.css';
  page.head.append(fonts);
  if (design) paint(design.resolved, design.css, design.project, design.ui);
  return true;
}
// `onReady(frame, panel)` is called each time a frame has loaded a page, with the panel it holds open, if any.
export function setupPreview(onReady) {
  ready = onReady;
  for (const [name, end] of Object.entries(frames)) {
    const other = name === 'narrow' ? frames.wide : frames.narrow;
    const loadEnd = () => {
      if (!prepare(end.frame)) return;
      end.frame.contentWindow.addEventListener('scroll', () => syncFrom(end, other), { passive: true });
      if (end.afterLoad !== undefined) {
        scrollEnd(end, end.afterLoad, false);
        delete end.afterLoad;
      }
      ready(end.frame, null);
    };
    end.source = '/preview.html';
    end.frame.addEventListener('load', loadEnd);
    // The frame may have finished loading before this module got here.
    const page = end.frame.contentDocument;
    if (page?.readyState === 'complete' && page.querySelector('.kn-page, .sample-root')) loadEnd();
    for (const [panel, frame] of Object.entries(end.panels)) {
      frame.addEventListener('load', () => {
        if (frame.dataset.source && prepare(frame)) ready(frame, panel);
      });
    }
  }
}
