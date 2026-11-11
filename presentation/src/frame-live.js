// The design tool's preview: it changes the sample page's header, footer and page as the settings change,
// without a build. The header comes from a built template with every item, and leaves out what is off; its giving-way
// script, which the template brings, measures it again when it changes. The trail goes with the page's H1, in hero-live.js.
import { layoutFooter } from '../../src/components/footer.js';
// The preview can set its footer at the edge of the screen at any time, so it carries the script that says whether
// the footer fits; it watches for that itself.
import '../../src/components/footer-fit.js';
import { footerHtml } from '../../src/components/footer-html.js';
import { footerProps, identityProps } from './frame.js';

function identity(header, settings, project) {
  const wanted = identityProps(settings, project);
  for (const link of header.querySelectorAll('.kn-header-identity')) identityIn(link, wanted);
}
function identityIn(link, wanted) {
  link.setAttribute('aria-label', wanted.label);
  link.dataset.knSloganPlace = wanted.sloganPlace;
  const brand = link.querySelector('.kn-brand');
  brand.dataset.knAxis = wanted.brandAxis;
  const logo = brand.querySelector('.kn-brand-logo');
  if (wanted.logo) {
    const [light, dark] = logo.querySelectorAll('img');
    light.src = wanted.logo.light;
    dark.src = wanted.logo.dark;
    for (const image of [light, dark]) image.alt = wanted.name ? '' : wanted.label;
  } else logo.remove();
  const name = brand.querySelector('.kn-brand-name');
  if (wanted.name) name.firstElementChild.textContent = wanted.name;
  else name.remove();
  const slogan = link.querySelector('.kn-header-slogan');
  if (wanted.slogan) slogan.firstElementChild.textContent = wanted.slogan;
  else slogan.remove();
}
// An image set again is decoded again, and blinks, so the one already showing moves over to where it is wanted.
function keepImages(from, into) {
  const showing = [...from.querySelectorAll('img')];
  for (const image of into.querySelectorAll('img')) {
    const same = showing.findIndex((old) => old.getAttribute('src') === image.getAttribute('src') && old.dataset.knLogo === image.dataset.knLogo);
    if (same < 0) continue;
    const [old] = showing.splice(same, 1);
    // Only what differs: a source set again, even to the same address, is loaded and decoded again.
    for (const { name, value } of image.attributes) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
    image.replaceWith(old);
  }
}
// Built in this document: an image moved in from the template's own document is loaded again, and Firefox shows it blink.
function buildHeader(settings, project) {
  const header = document.importNode(document.querySelector(`template[data-kn-live-header="${settings.arrangement}"]`).content.firstElementChild, true);
  const drop = (selector) => header.querySelectorAll(selector).forEach((node) => node.remove());
  const sticky = settings.attachment === 'sticky';
  header.dataset.knAttachment = settings.attachment;
  header.dataset.knStart = sticky ? settings.start : 'below';
  header.dataset.knAutohide = String(sticky && settings.autohide);
  header.dataset.knSurface = settings.surface;
  identity(header, settings, project);
  if (!settings['link-menu']) drop('.kn-header-link-menu');
  if (!settings.language) drop('.kn-header-language, [data-kn-moved="language"]');
  if (!settings.search) drop('.kn-header-search-trigger, [data-kn-panel="search"], [data-kn-moved="search"]');
  if (!settings.cta) drop('.kn-header-cta');
  if (!settings.numbered) drop('.kn-megamenu-number');
  if (!settings['menu-above']) drop('.kn-megamenu-above');
  if (!settings['menu-below']) drop('.kn-megamenu-below');
  const box = header.querySelector('.kn-header-search-box');
  if (box) {
    box.dataset.knSurface = settings['search-surface'];
    box.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6)').hidden = !settings['search-heading'];
    if (!settings['search-links']) box.querySelector('.kn-header-search-links')?.remove();
    if (!settings['search-blur']) header.querySelector('[data-kn-panel="search"]').dataset.knBlur = 'false';
  }
  // Without a button of its own, a header still has one for when items give way, unless nothing could.
  const mode = settings['menu-button'];
  if (mode !== 'off' || settings['link-menu'] || settings.search || settings.language || settings.cta) {
    for (const button of header.querySelectorAll('.kn-header-menu-button')) {
      if (mode !== 'word') button.querySelector('.kn-header-chevron')?.remove();
      if (mode === 'icon' || (mode === 'off' && !settings['link-menu'])) button.querySelector('.kn-header-menu-word')?.remove();
      button.dataset.knIcon = mode === 'word' ? 'chevron-down' : 'menu';
      if (mode === 'off') button.dataset.knAutomatic = 'true';
    }
  } else {
    drop('.kn-header-menu-button, [data-kn-panel="menu"]');
  }
  return header;
}
// The footer stays the same element, its measuring with it. Cells that have not changed stay too, so a logo
// does not blink, and a page scrolled to its end stays there as the footer's height changes. What a cell was
// written with is kept beside it, since the page marks its images as it goes.
const writtenCells = new WeakMap();
function updateFooter(page, main, props) {
  const old = page.querySelector(':scope > .kn-footer');
  const held = document.createElement('template');
  held.innerHTML = footerHtml(layoutFooter(props), props);
  // In this document, for an image moved between documents is loaded again.
  const next = document.importNode(held.content, true).firstElementChild;
  const end = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  if (!next) {
    old?.remove();
  } else if (!old) {
    main.after(next);
  } else {
    for (const cell of next.querySelectorAll('.kn-footer-cell')) {
      const live = old.querySelector(`[data-kn-band="${cell.parentElement.dataset.knBand}"] > [data-kn-cell="${cell.dataset.knCell}"]`);
      if (live && writtenCells.get(live) === cell.innerHTML) {
        for (const { name, value } of cell.attributes) live.setAttribute(name, value);
        cell.replaceWith(live);
      } else {
        writtenCells.set(cell, cell.innerHTML);
        if (live) keepImages(live, cell);
      }
    }
    old.replaceChildren(...next.childNodes);
    old.dataset.knAttachment = next.dataset.knAttachment;
    old.dataset.knRules = next.dataset.knRules;
  }
  if (atEnd) end();
}
export function setupLiveFrame() {
  if (document.body.dataset.specimen !== 'preview') return;
  const page = document.querySelector('.kn-page');
  const main = page.querySelector('.kn-page-main');
  let shown = {};
  let panel = null;
  // The panels are a native dialog or popover: the one asked for opens as a click on its control opens it, and any
  // other closes as the browser closes it.
  const showPanel = () => {
    for (const node of page.querySelectorAll(':scope > .kn-header [data-kn-panel]')) {
      if (node.dataset.knPanel === panel || !node.matches('[open], :popover-open')) continue;
      if (node.matches('dialog')) node.close();
      else node.hidePopover();
    }
    const trigger = panel && page.querySelector(`:scope > .kn-header [data-kn-trigger="${panel}"]`);
    if (trigger && !document.getElementById(trigger.getAttribute('aria-controls'))?.matches('[open], :popover-open')) trigger.click();
  };
  function apply({ header, footer, page: settings }, project) {
    const headerKey = JSON.stringify([header, project.name, project.logo, project['logo-dark'], project.slogan]);
    if (headerKey !== shown.header) {
      // The header stays the same element, as the footer does: it takes the new attributes and content, with the
      // logos already showing moved over, before a paint.
      const old = page.querySelector(':scope > .kn-header');
      const next = buildHeader(header, project);
      if (old) {
        keepImages(old, next);
        for (const { name } of [...old.attributes]) if (!next.hasAttribute(name)) old.removeAttribute(name);
        for (const { name, value } of next.attributes) old.setAttribute(name, value);
        old.replaceChildren(...next.childNodes);
      } else page.prepend(next);
      showPanel();
      // An open search box takes the focus, and the control being used should keep it.
      if (panel) parent.postMessage({ type: 'kn-frame-panel-shown' }, location.origin);
    }
    const footerKey = JSON.stringify([footer, header.identity, header['brand-axis'], project.name, project.logo, project['logo-dark']]);
    if (footerKey !== shown.footer) updateFooter(page, main, footerProps(footer, project, header));
    const pageKey = JSON.stringify(settings);
    if (pageKey !== shown.page) {
      if (settings.shadow) main.dataset.knShadow = 'true';
      else delete main.dataset.knShadow;
      if (settings['edge-line']) main.dataset.knEdgeLine = 'true';
      else delete main.dataset.knEdgeLine;
      for (const [key, property] of [['fill-light', '--kn-page-fill-light'], ['fill-dark', '--kn-page-fill-dark']]) {
        if (settings[key]) page.style.setProperty(property, settings[key]);
        else page.style.removeProperty(property);
      }
    }
    shown = { header: headerKey, footer: footerKey, page: pageKey };
  }
  window.addEventListener('message', (event) => {
    if (event.source !== parent) return;
    if (event.data?.type === 'kn-frame-panel') {
      panel = event.data.panel;
      showPanel();
      if (panel) parent.postMessage({ type: 'kn-frame-panel-shown' }, location.origin);
    } else if (event.data?.type === 'kn-design' && event.data.frame) apply(event.data.frame, event.data.project);
  });
}
