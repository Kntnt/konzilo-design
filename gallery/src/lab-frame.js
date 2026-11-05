import { setupTooltips } from './tooltips.js';
import { setupConsent } from '../../src/components/consent.js';
import { setupHeaders } from '../../src/components/header.js';
import { setupFooters } from '../../src/components/footer.js';
import { setupReadingAreas } from '../../src/components/reading-area.js';

export function setupFrameLab() {
  setupConsent(); setupTooltips();
  const page = document.querySelector('.kn-page');
  const main = page.querySelector('.kn-page-main');
  const footer = page.querySelector('.kn-footer');
  let disposeHeader = () => {}, disposeReading = () => {}, disposeFooter = () => {};
  let previous = '';
  function configure(config) {
    const key = JSON.stringify(config);
    if (key === previous) {
      page.querySelector('.kn-header')?.dispatchEvent(new Event('kn:refresh'));
      footer.dispatchEvent(new Event('kn:refresh'));
      return;
    }
    previous = key;
    disposeHeader(); disposeFooter(); disposeReading();
    page.querySelector('.kn-header')?.remove();
    const template = document.querySelector(`template[data-lab-header="${['A', 'B', 'C'].includes(config.arrangement) ? config.arrangement : 'A'}"]`);
    const header = template.content.firstElementChild.cloneNode(true);
    for (const [item, selector] of Object.entries({ slogan: '.kn-header-slogan', name: '.kn-brand-name', links: '.kn-header-link-menu', language: '.kn-header-language, [data-kn-moved="language"]', search: '.kn-header-search-trigger, [data-kn-panel="search"], [data-kn-moved="search"]', cta: '.kn-header-cta' })) {
      if (!config[item]) header.querySelectorAll(selector).forEach((node) => node.remove());
    }
    header.dataset.knAttachment = config.headerAttachment === 'sticky' ? 'sticky' : 'flow';
    header.dataset.knStart = config.start === 'under' ? 'under' : 'below';
    header.dataset.knAutohide = String(!!config.autohide);
    header.dataset.knOpaqueSurface = config.surface === 'brand' ? 'brand' : 'page';
    header.dataset.knSurface = header.dataset.knOpaqueSurface;
    page.prepend(header);
    main.firstElementChild.dataset.knSurface = config.firstBand === 'dark' ? 'brand' : 'tint';
    main.querySelectorAll('[data-lab-long]').forEach((node) => { node.hidden = !!config.short; });
    main.toggleAttribute('data-kn-shadow', !!config.pageShadow);
    if (config.pageShadow) main.dataset.knShadow = 'true';
    footer.dataset.knAttachment = config.footerAttachment === 'reveal' ? 'reveal' : 'flow';
    window.scrollTo({ top: 0, behavior: 'instant' });
    disposeHeader = setupHeaders(page);
    disposeFooter = setupFooters(page);
    disposeReading = setupReadingAreas(page);
  }
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'kn-frame-consent') { document.getElementById('lab-consent')?.dispatchEvent(new Event('kn:consentbanneropen')); return; }
    if (event.data?.type !== 'kn-frame-config') return;
    const { css, mode, config } = event.data;
    if (typeof css !== 'string' || !config) return;
    document.getElementById('kn-live-core').textContent = css;
    document.documentElement.dataset.knMode = mode === 'dark' ? 'dark' : 'light';
    configure(config);
  });
  document.addEventListener('submit', (event) => {
    if (event.target.method === 'dialog') return;
    event.preventDefault();
    const status = document.querySelector('.lab-search-result');
    status.textContent = `Sample search: ${new FormData(event.target).get('q') || 'all field notes'}`;
    status.hidden = false;
  });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-kn-dialog]');
    if (trigger) document.getElementById(trigger.dataset.knDialog)?.showModal();
  });
  window.parent.postMessage({ type: 'kn-frame-ready' }, '*');
}
