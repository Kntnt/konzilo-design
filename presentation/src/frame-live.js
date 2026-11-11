// The design tool's preview: it changes the sample page's header, footer and page as the settings change,
// without a build. The header comes from a built template with every item, takes the design's own menu in place of the
// sample's, and leaves out what is off; its giving-way
// script, which the template brings, measures it again when it changes. The trail goes with the page's H1, in hero-live.js.
import { layoutFooter } from '../../src/components/footer.js';
// The preview can set its footer at the edge of the screen at any time, so it carries the script that says whether
// the footer fits; it watches for that itself.
import '../../src/components/footer-fit.js';
import { footerHtml } from '../../src/components/footer-html.js';
import { footerProps, identityProps, menuOf } from './frame.js';
import { search } from './samples.js';

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
// The link menu and the large menu with the menu shown, each entry made from the template's own first one, so they stay
// the component's markup: its first column has links with descriptions under its heading.
function menuIn(header, menu) {
  const linked = (element, { label, href, current }) => {
    element.setAttribute('href', href);
    if (current) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  };
  for (const list of header.querySelectorAll('.kn-header-link-menu ul')) {
    const pattern = list.firstElementChild;
    list.replaceChildren(...menu.filter((item) => item.linkMenu !== false).map((item) => {
      const entry = pattern.cloneNode(true);
      const link = entry.querySelector('a');
      linked(link, item);
      link.textContent = item.label;
      return entry;
    }));
  }
  for (const columns of header.querySelectorAll('.kn-megamenu-columns')) {
    const pattern = columns.firstElementChild;
    columns.style.setProperty('--kn-header-menu-columns', String(Math.min(6, menu.length)));
    columns.replaceChildren(...menu.map((item, index) => {
      const column = pattern.cloneNode(true);
      const link = column.querySelector('.kn-megamenu-heading a');
      const number = link.querySelector('.kn-megamenu-number');
      linked(link, item);
      if (number) number.textContent = `${String(index + 1).padStart(2, '0')} /`;
      link.replaceChildren(...(number ? [number] : []), item.label);
      const list = column.querySelector('ul');
      const child = list.firstElementChild;
      if (!item.children?.length) list.remove();
      else list.replaceChildren(...item.children.map((wanted) => {
        const entry = child.cloneNode(true);
        const [words, description] = entry.querySelectorAll('a > span');
        linked(entry.querySelector('a'), wanted);
        words.textContent = wanted.label;
        if (wanted.description) description.textContent = wanted.description;
        else description?.remove();
        return entry;
      }));
      return column;
    }));
  }
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
  // The template holds the sample menu, which a design's own takes the place of.
  if (project.menu?.length) menuIn(header, menuOf(project));
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
    if (settings['search-close'] === false) box.querySelector('.kn-header-search-close')?.remove();
  }
  // The template's fields show the magnifier: a design that shows the word, or nothing, has that instead.
  const shows = settings['search-placeholder'] ?? 'word';
  for (const field of header.querySelectorAll('.kn-search-field')) {
    field.dataset.knPlaceholder = shows;
    const input = field.querySelector('input');
    if (shows === 'word') input.placeholder = search.word ?? search.label;
    else if (shows === 'none') input.removeAttribute('placeholder');
    if (shows !== 'icon') field.querySelector('.kn-icon')?.remove();
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
// The attributes of one element onto another; a held dialog keeps being open.
function copyAttributes(into, from, keep = []) {
  for (const { name } of [...into.attributes]) if (!from.hasAttribute(name) && !keep.includes(name)) into.removeAttribute(name);
  for (const { name, value } of from.attributes) if (into.getAttribute(name) !== value) into.setAttribute(name, value);
}
// The new header's content in place of the old, but the dialog held open stays the same element, and so does each element
// that holds it, since a dialog taken out of the page closes, and opening it again would take the focus from the tool.
// Where the new header has no such dialog, or holds it elsewhere, it says so and changes nothing.
function replaceKeeping(old, next, kept) {
  const fresh = next.querySelector(`dialog[data-kn-panel="${kept.dataset.knPanel}"]`);
  if (!fresh) return false;
  const chain = [];
  for (let here = kept, there = fresh; here !== old; here = here.parentElement, there = there.parentElement) {
    if (there === next || here.localName !== there.localName) return false;
    chain.unshift([here, there]);
  }
  if (chain[0][1].parentNode !== next) return false;
  let parentOld = old;
  for (const [here, there] of chain) {
    const nodes = [...there.parentNode.childNodes];
    const index = nodes.indexOf(there);
    for (const node of [...parentOld.childNodes]) if (node !== here) node.remove();
    here.before(...nodes.slice(0, index));
    here.after(...nodes.slice(index + 1));
    if (here === kept) {
      copyAttributes(here, there, ['open']);
      here.setAttribute('closedby', 'none');
      here.replaceChildren(...there.childNodes);
    } else copyAttributes(here, there);
    parentOld = here;
  }
  return true;
}
export function setupLiveFrame() {
  if (document.body.dataset.specimen !== 'preview') return;
  const page = document.querySelector('.kn-page');
  const main = page.querySelector('.kn-page-main');
  let shown = {};
  // The tool's Header page shows the large menu and the search box open, each in a frame of its own: this page with
  // ?panel=menu or ?panel=search. The panel is a modal dialog, opened by the dialog itself rather than its button, so it
  // opens whether its button is in the bar or has given way, and in a browser without invoker commands too.
  const held = new URLSearchParams(location.search).get('panel');
  const heldPanel = () => page.querySelector(`:scope > .kn-header dialog[data-kn-panel="${held}"]`);
  const showPanel = () => {
    const wanted = held && heldPanel();
    if (!wanted || wanted.open) return;
    // Esc and a click beside it do not close it here, and what else would is undone at once.
    wanted.setAttribute('closedby', 'none');
    // Opening it would focus its first link or field, or else the dialog itself, which takes the focus from the tool,
    // keys being typed there included. Inert for that moment, neither it nor anything in it can take the focus.
    wanted.inert = true;
    wanted.showModal();
    wanted.inert = false;
    // Opening it took the focus, which the control being used in the tool takes back.
    document.activeElement?.blur();
    parent.postMessage({ type: 'kn-frame-panel-shown' }, location.origin);
  };
  if (held) {
    document.addEventListener('cancel', (event) => { if (event.target === heldPanel()) event.preventDefault(); }, true);
    document.addEventListener('close', (event) => { if (event.target === heldPanel()) showPanel(); }, true);
  }
  function apply({ header, footer, page: settings }, project) {
    const headerKey = JSON.stringify([header, project.name, project.logo, project['logo-dark'], project.slogan, project.menu]);
    if (headerKey !== shown.header) {
      // The header stays the same element, as the footer does: it takes the new attributes and content, with the
      // logos already showing moved over, before a paint.
      const old = page.querySelector(':scope > .kn-header');
      const next = buildHeader(header, project);
      if (old) {
        keepImages(old, next);
        copyAttributes(old, next);
        const kept = held && heldPanel();
        if (!(kept?.open && replaceKeeping(old, next, kept))) old.replaceChildren(...next.childNodes);
      } else page.prepend(next);
      showPanel();
    }
    // The footer's links for navigation follow the menu shown where the design has none of its own.
    const footerKey = JSON.stringify([footer, header.identity, header['brand-axis'], project.name, project.logo, project['logo-dark'], project.footer, project.menu]);
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
    if (event.source === parent && event.data?.type === 'kn-design' && event.data.frame) apply(event.data.frame, event.data.project);
  });
}
