// The design tool's preview: it changes the sample page's header, footer and page as the settings change,
// without a build. The header comes from a built template with every item, and leaves out what is off.
import { setupHeaders } from '../../src/components/header.js';
import { setupFooters, layoutFooter } from '../../src/components/footer.js';
import { footerHtml } from '../../src/components/footer-html.js';
import { footerProps, identityProps } from './frame.js';

function identity(header, settings, project) {
  const wanted = identityProps(settings, project);
  const link = header.querySelector('.kn-header-identity');
  link.setAttribute('aria-label', wanted.label);
  link.dataset.knAxis = wanted.axis;
  link.dataset.knAlign = wanted.align;
  const brand = header.querySelector('.kn-header-brand');
  brand.dataset.knAxis = wanted.brandAxis;
  brand.dataset.knAlign = wanted.brandAlign;
  const logo = brand.querySelector('.kn-header-logo');
  if (wanted.logo) {
    const [light, dark] = logo.querySelectorAll('img');
    light.src = wanted.logo.light;
    dark.src = wanted.logo.dark;
    for (const image of [light, dark]) image.alt = wanted.name ? '' : wanted.label;
  } else logo.remove();
  const name = brand.querySelector('.kn-header-name');
  if (wanted.name) name.textContent = wanted.name;
  else name.remove();
  const slogan = header.querySelector('.kn-header-slogan');
  if (wanted.slogan) slogan.textContent = wanted.slogan;
  else slogan.remove();
}
function buildHeader(settings, project) {
  const header = document.querySelector(`template[data-kn-live-header="${settings.arrangement}"]`).content.firstElementChild.cloneNode(true);
  const drop = (selector) => header.querySelectorAll(selector).forEach((node) => node.remove());
  const sticky = settings.attachment === 'sticky';
  header.dataset.knAttachment = settings.attachment;
  header.dataset.knStart = sticky ? settings.start : 'below';
  header.dataset.knAutohide = String(sticky && settings.autohide);
  header.dataset.knOpaqueSurface = settings.surface;
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
  const button = header.querySelector('[data-kn-trigger="menu"]');
  const mode = settings['menu-button'];
  if (mode !== 'off' || settings['link-menu'] || settings.search || settings.language || settings.cta) {
    if (mode !== 'word') button.querySelector('.kn-header-chevron')?.remove();
    if (mode === 'icon' || (mode === 'off' && !settings['link-menu'])) button.querySelector('.kn-header-menu-word')?.remove();
    button.dataset.knIcon = mode === 'word' ? 'chevron-down' : 'menu';
    if (mode === 'off') button.dataset.knAutomatic = 'true';
  } else {
    button.remove();
    drop('[data-kn-panel="menu"]');
  }
  return header;
}
function placeBreadcrumbs(main, settings, project) {
  main.querySelector('.kn-breadcrumb-band')?.remove();
  main.querySelector('.kn-hero-text > .kn-breadcrumbs')?.remove();
  if (!settings.show) return;
  const trail = document.querySelector('template[data-kn-live-breadcrumbs]').content.firstElementChild.cloneNode(true);
  trail.dataset.knSeparator = settings.separator;
  trail.dataset.knHome = settings.home === 'icon' ? 'icon' : 'word';
  trail.dataset.knCurrent = String(settings.current);
  trail.dataset.knNarrow = settings.narrow;
  trail.querySelector('.kn-breadcrumbs-label').textContent = settings.home === 'name' ? project.name : 'Home';
  if (settings.placement === 'own-band') {
    const band = document.createElement('section');
    band.className = 'kn-band kn-breadcrumb-band';
    const content = document.createElement('div');
    content.className = 'kn-band-content';
    content.append(trail);
    band.append(content);
    main.prepend(band);
  } else main.querySelector('.kn-hero-text').prepend(trail);
}
export function setupLiveFrame() {
  if (document.body.dataset.specimen !== 'preview') return;
  const page = document.querySelector('.kn-page');
  const main = page.querySelector('.kn-page-main');
  let shown = {};
  let panel = null;
  // The header opens and closes its own panels, so it is asked as a click would ask it.
  const showPanel = () => {
    for (const trigger of page.querySelectorAll(':scope > .kn-header [data-kn-trigger]')) {
      const open = trigger.getAttribute('aria-expanded') === 'true';
      if (open !== (trigger.dataset.knTrigger === panel)) trigger.click();
    }
  };
  function apply({ header, footer, page: settings, breadcrumbs }, project) {
    const headerKey = JSON.stringify([header, project.name, project.logo, project['logo-dark'], project.slogan]);
    if (headerKey !== shown.header) {
      const old = page.querySelector(':scope > .kn-header');
      old?.dispatchEvent(new Event('kn:dispose'));
      old?.remove();
      page.prepend(buildHeader(header, project));
      setupHeaders(page);
      showPanel();
      // An open search box takes the focus, and the control being used should keep it.
      if (panel) parent.postMessage({ type: 'kn-frame-panel-shown' }, location.origin);
    }
    const footerKey = JSON.stringify([footer, project.name, project.logo, project['logo-dark']]);
    if (footerKey !== shown.footer) {
      const old = page.querySelector(':scope > .kn-footer');
      old.dispatchEvent(new Event('kn:dispose'));
      const { bands, ...options } = footerProps(footer, project);
      old.outerHTML = footerHtml(layoutFooter(bands), options);
      setupFooters(page);
    }
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
      page.querySelector(':scope > .kn-footer')?.dispatchEvent(new Event('kn:refresh'));
    }
    const breadcrumbKey = JSON.stringify([breadcrumbs, project.name]);
    if (breadcrumbKey !== shown.breadcrumbs) {
      placeBreadcrumbs(main, breadcrumbs, project);
      page.querySelector(':scope > .kn-header')?.dispatchEvent(new Event('kn:refresh'));
    }
    shown = { header: headerKey, footer: footerKey, page: pageKey, breadcrumbs: breadcrumbKey };
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
