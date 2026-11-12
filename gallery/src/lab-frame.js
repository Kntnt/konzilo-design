import { setupTooltips } from './tooltips.js';
import { setupConsent } from '../../src/components/consent.js';
// The lab turns a header sticky and sliding away after the page has loaded, so it carries both of the header's
// polyfills; each tests for its feature itself and does nothing where the browser has it, the scroll timelines' also
// that the browser's style queries follow them.
import '../../src/components/scroll-timeline-polyfill.js';
import '../../src/components/scroll-state-polyfill.js';
// And the scripts that measure the header's giving way and say whether a footer at the edge of the screen fits, whose
// tags the lab's templates lose in the build; each watches for the lab changing its header or footer.
import '../../src/components/header-fit.js';
import '../../src/components/footer-fit.js';

export function setupFrameLab() {
  setupConsent(); setupTooltips();
  const page = document.querySelector('.kn-page');
  const main = page.querySelector('.kn-page-main');
  const footer = page.querySelector('.kn-footer');
  let previous = '';
  function configure(config) {
    const key = JSON.stringify(config);
    if (key === previous) return;
    previous = key;
    page.querySelector('.kn-header')?.remove();
    const template = document.querySelector(`template[data-lab-header="${['A', 'B', 'C'].includes(config.arrangement) ? config.arrangement : 'A'}"]`);
    const header = template.content.firstElementChild.cloneNode(true);
    for (const [item, selector] of Object.entries({ slogan: '.kn-header-slogan', name: '.kn-brand-name', links: '.kn-header-link-menu', language: '.kn-header-language, [data-kn-moved="language"]', search: '.kn-header-search-trigger, [data-kn-panel="search"], [data-kn-moved="search"]', cta: '.kn-header-cta' })) {
      if (!config[item]) header.querySelectorAll(selector).forEach((node) => node.remove());
    }
    const sticky = config.headerAttachment === 'sticky';
    header.dataset.knAttachment = sticky ? 'sticky' : 'flow';
    header.dataset.knStart = sticky && config.start === 'under' ? 'under' : 'below';
    header.dataset.knAutohide = String(sticky && !!config.autohide);
    header.dataset.knSurface = config.surface === 'brand' ? 'brand' : 'page';
    page.prepend(header);
    main.firstElementChild.dataset.knSurface = config.firstBand === 'dark' ? 'brand' : 'tint';
    main.querySelectorAll('[data-lab-long]').forEach((node) => { node.hidden = !!config.short; });
    main.toggleAttribute('data-kn-shadow', !!config.pageShadow);
    if (config.pageShadow) main.dataset.knShadow = 'true';
    footer.dataset.knAttachment = config.footerAttachment === 'reveal' ? 'reveal' : 'flow';
    window.scrollTo({ top: 0, behavior: 'instant' });
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
