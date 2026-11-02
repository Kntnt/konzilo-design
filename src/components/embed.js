import { recogniseEmbed } from './embed-providers.js';
import { hasConsent } from './consent.js';
import { isPrimaryClick } from './visitor-filters.js';
export { recogniseEmbed } from './embed-providers.js';
// The site's own words replace this through props; every text here is only a default.
export const embedNotice = (provider) => `Showing this content shares your information, such as your IP address, with ${provider}. Is that OK with you?`;
export function localPreview(address) {
  if (typeof address !== 'string' || !address || address !== address.trim() || address.includes('\\')) return false;
  if (/^data:image\/(?:svg\+xml|png|jpeg|webp|gif|avif)(?:;[^,]*)?,/i.test(address)) return true;
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(address);
}
// What the visitor sees (owner, 2026-11-02). Without consent to the category: a warning and a
// conscious choice. With it: the content itself, or a thumbnail that starts a heavy player.
export function embedState({ granted = false, requested = false, played = false, start = 'direct' }) {
  if (!granted && !requested) return 'warning';
  return requested || played || start !== 'click' ? 'player' : 'thumbnail';
}
export function framePlan({ url, title, galleryNote, started = false }) {
  const embed = recogniseEmbed(url);
  if (galleryNote) return { kind: 'note', text: galleryNote, format: embed.format };
  const src = new URL(embed.playerUrl);
  // A click is the visitor's request to play, so they need not press play a second time.
  if (started && embed.autoplay) src.searchParams.set('autoplay', '1');
  return { kind: 'iframe', format: embed.format, attributes: {
    src: src.href, title: title || embed.title, referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy', allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture', allowfullscreen: '',
  } };
}

// The same mount is used in a Figure and in the native overlay. No iframe exists until the
// category is granted or the visitor has chosen this one view. `intent` means the visitor has
// already asked to play, as a click on a row that opens the overlay does.
export function mountEmbed(element, { intent = false } = {}) {
  if (element.hasAttribute('data-kn-embed-mounted')) return () => {};
  element.setAttribute('data-kn-embed-mounted', '');
  const embed = recogniseEmbed(element.dataset.knUrl);
  const stage = element.querySelector('.kn-embed-stage');
  const warning = element.querySelector('.kn-embed-consent');
  const thumbnail = element.querySelector('.kn-embed-thumbnail');
  const frame = element.querySelector('.kn-embed-frame');
  const original = element.querySelector('.kn-embed-original');
  const abort = new AbortController();
  let requested = false, played = intent, loaded = false;
  stage.hidden = false;
  // Without a consent dialog on the page there is nothing for this button to open.
  const settings = warning.querySelector('[data-kn-consent-open]');
  if (settings && !document.querySelector('.kn-consent-settings')) settings.hidden = true;
  function paint() {
    const state = embedState({ granted: hasConsent(embed.category), requested, played, start: embed.start });
    warning.hidden = state !== 'warning'; frame.hidden = state !== 'player';
    if (thumbnail) thumbnail.hidden = state !== 'thumbnail';
    // Once the content or its thumbnail shows, a link beside it only adds noise.
    if (original) original.hidden = state !== 'warning';
    if (state !== 'player') { frame.replaceChildren(); loaded = false; return; }
    if (loaded) return;
    const started = requested || played;
    const plan = framePlan({ url: element.dataset.knUrl, title: element.dataset.knEmbedTitle, galleryNote: element.dataset.knGalleryNote, started });
    const player = document.createElement(plan.kind === 'note' ? 'p' : 'iframe');
    if (plan.kind === 'note') { player.className = 'kn-embed-gallery-note'; player.textContent = plan.text; player.setAttribute('role', 'status'); }
    else Object.entries(plan.attributes).forEach(([name, value]) => player.setAttribute(name, value));
    frame.append(player); loaded = true;
    // The control that was clicked has just gone: keep the keyboard with the content.
    if (started && plan.kind !== 'note') player.focus({ preventScroll: true });
  }
  warning.querySelector('[data-kn-embed-load]').addEventListener('click', () => { requested = true; paint(); }, { signal: abort.signal });
  // A lasting choice can remove the button that opened the settings: keep the keyboard here.
  let awaitingSettings = false;
  settings?.addEventListener('click', () => { awaitingSettings = true; }, { signal: abort.signal });
  document.querySelector('.kn-consent-settings')?.addEventListener('close', () => {
    if (awaitingSettings && warning.hidden) (thumbnail && !thumbnail.hidden ? thumbnail : frame.children[0])?.focus({ preventScroll: true });
    awaitingSettings = false;
  }, { signal: abort.signal });
  thumbnail?.addEventListener('click', () => { played = true; paint(); }, { signal: abort.signal });
  window.addEventListener('kn:consentchange', () => {
    if (!hasConsent(embed.category)) { requested = false; played = intent; }
    paint();
  }, { signal: abort.signal });
  paint();
  return () => { abort.abort(); frame.replaceChildren(); warning.hidden = false; frame.hidden = true; stage.hidden = true; if (thumbnail) thumbnail.hidden = true; if (original) original.hidden = false; element.removeAttribute('data-kn-embed-mounted'); };
}
const initialized = new WeakMap();
export function setupEmbeds(root = document) {
  if (typeof window === 'undefined' || initialized.has(root) || document.documentElement.hasAttribute('data-kn-embeds-ready')) return () => {};
  document.documentElement.setAttribute('data-kn-embeds-ready', '');
  const abort = new AbortController();
  const mounts = [...root.querySelectorAll('.kn-embed[data-kn-url]')].map(mountEmbed);
  let active;
  root.addEventListener('click', (event) => {
    const link = event.target.closest('a[href][data-kn-embed-overlay]');
    if (!link || !isPrimaryClick(event)) return;
    let embed;
    try { embed = recogniseEmbed(link.href); } catch { return; }
    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    if (active?.open) active.close();
    dialog.className = 'kn-embed-dialog'; dialog.dataset.knSurface = 'page';
    dialog.setAttribute('aria-label', link.dataset.knEmbedTitle || embed.title);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'kn-button'; close.dataset.knVariant = 'outline';
    close.textContent = link.dataset.knEmbedClose || 'Close content';
    const heading = document.createElement(`h${link.dataset.knEmbedLevel || '2'}`); heading.dataset.knType = 'heading-5';
    heading.textContent = link.dataset.knEmbedTitle || embed.title;
    const element = document.createElement('div'); element.className = 'kn-embed';
    element.dataset.knUrl = link.href; element.dataset.knEmbedTitle = heading.textContent;
    if (link.dataset.knGalleryNote) element.dataset.knGalleryNote = link.dataset.knGalleryNote;
    const stage = document.createElement('div'); stage.className = 'kn-embed-stage'; stage.dataset.knFormat = embed.format;
    const warning = document.createElement('div'); warning.className = 'kn-embed-consent'; warning.dataset.knSurface = 'raised';
    const notice = document.createElement('p'); notice.className = 'kn-embed-notice'; notice.dataset.knType = 'small';
    notice.textContent = link.dataset.knEmbedNotice || embedNotice(embed.provider);
    const actions = document.createElement('div'); actions.className = 'kn-link-group'; actions.dataset.knDirection = 'row';
    const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'kn-button'; accept.dataset.knVariant = 'outline'; accept.dataset.knEmbedLoad = '';
    accept.textContent = link.dataset.knEmbedLoadLabel || 'Show this time';
    const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'kn-button'; settings.dataset.knVariant = 'outline'; settings.dataset.knConsentOpen = '';
    settings.textContent = link.dataset.knEmbedSettingsLabel || 'Open consent settings';
    actions.append(accept, settings);
    const original = document.createElement('a'); original.className = 'kn-embed-original'; original.href = link.href; original.textContent = link.dataset.knEmbedOriginalLabel || heading.textContent;
    const frame = document.createElement('div'); frame.className = 'kn-embed-frame'; frame.hidden = true;
    warning.append(notice, actions); stage.append(warning, frame); element.append(stage, original); dialog.append(heading, close, element);
    document.body.append(dialog);
    const dispose = mountEmbed(element, { intent: true });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (click) => { if (click.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dispose(); dialog.remove(); if (active === dialog) active = undefined; link.focus({ preventScroll: true }); }, { once: true });
    active = dialog; dialog.showModal();
  }, { signal: abort.signal });
  const dispose = () => { abort.abort(); active?.close(); mounts.forEach((unmount) => unmount()); initialized.delete(root); document.documentElement.removeAttribute('data-kn-embeds-ready'); };
  initialized.set(root, dispose);
  return dispose;
}
