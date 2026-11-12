// A page of every part surfaceOf knows, nested three deep on every Surface, each tree written twice: without its
// ground, every part with the Surface surfaceOf gives it alone, and for its ground, with the Surface surfaceOf gives it on
// the ground it stands on. A browser then compares the two (docs/spec/plates.md, A plate finds its ground). Shared by
// test/plate-ground.test.js and a check of a released browser, which loads the same page.
import { surfaceOf } from '../../src/directives/surfaces.js';

const picture = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#556b2f"/></svg>')}`;

// Each part as directives.md writes it. `surface` gives a part its Surface; `inner` is what stands in a part that
// holds more, and the ground of what stands there is the Surface of the plate that holds it.
const PARTS = {
  'link-card': (surface, inner) => `<div class="kn-card-grid kn-cards"><article class="kn-card" data-kn-surface="${surface('link-card')}"><h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="#a">A link as a whole</a></h3><p class="kn-card-text" data-kn-type="small">Its text.</p>${inner}</article></div>`,
  'action-card': (surface, inner) => `<div class="kn-card-grid kn-cards"><article class="kn-card" data-kn-surface="${surface('action-card')}"><h3 class="kn-card-heading" data-kn-type="heading-5">Something else?</h3><p class="kn-card-text" data-kn-type="small">Ask us.</p><ul class="kn-actions" role="list"><li><a class="kn-button kn-action" href="#b">Ask</a></li></ul>${inner}</article></div>`,
  'fact-box': (surface, inner) => `<aside class="kn-fact-box" data-kn-surface="${surface('fact-box')}"><p class="kn-fact-box-label" data-kn-type="label">In short</p><h2 class="kn-fact-box-heading" data-kn-type="heading-5">Three things</h2><p>A fact.</p>${inner}</aside>`,
  // A choice puts its answer and its panel on the ground it stands on; what the panel holds stands on the panel.
  choice: (surface, inner, name) => `<div class="kn-choice"><details class="kn-choice-item" name="${name}" open><summary class="kn-choice-answer" data-kn-surface="${surface('choice-answer')}">Yes</summary><div class="kn-choice-panel" data-kn-surface="${surface('choice-panel')}"><p>More.</p>${inner}</div></details></div>`,
  'behind-card': (surface) => `<div class="kn-card-grid kn-cards" data-kn-picture="behind"><article class="kn-card" data-kn-surface="${surface('behind-card')}"><img class="kn-card-picture" src="${picture}" alt=""><h3 class="kn-card-heading" data-kn-type="heading-5"><a class="kn-card-link" href="#c">On its picture</a></h3></article></div>`,
};
const HOLDERS = ['link-card', 'action-card', 'fact-box', 'choice'];
const holds = { 'link-card': 'link-card', 'action-card': 'action-card', 'fact-box': 'fact-box', choice: 'choice-panel' };

// Every run of parts, each holding the next, up to three deep: 5 + 4 × 5 + 4 × 4 × 5.
export function runs(depth = 3) {
  let found = Object.keys(PARTS).map((part) => [part]);
  let last = found;
  for (let level = 2; level <= depth; level++) {
    last = last.filter((run) => HOLDERS.includes(run.at(-1))).flatMap((run) => Object.keys(PARTS).map((part) => [...run, part]));
    found = [...found, ...last];
  }
  return found;
}

let names = 0;
// One tree, outermost part first, on `ground`, a Surface kind or undefined for a band with none. Known, each part takes
// the Surface surfaceOf gives it on the ground it stands on; not known, the Surface surfaceOf gives it alone.
function tree(run, ground, known) {
  const [part, ...rest] = run;
  const surface = (name) => known ? surfaceOf(name, ground) : surfaceOf(name);
  const inner = rest.length ? tree(rest, known ? surfaceOf(holds[part], ground) : undefined, known) : '';
  return PARTS[part](surface, inner, `choice-${++names}`);
}

// Each ground: every Surface kind, a band with no Surface, and the two kinds that have pairs with the other mode set on
// the band itself, as a light card in a dark region sets it.
export function grounds(kinds) {
  return [...kinds.map((kind) => ({ kind })), { kind: undefined }, ...['raised', 'tint'].map((kind) => ({ kind, local: true }))];
}

const band = ({ kind, local }, mode, body, version) => `<section class="kn-band kn-section" data-version="${version}"${kind ? ` data-kn-surface="${kind}"` : ''}${local ? ` data-kn-mode="${mode === 'light' ? 'dark' : 'light'}"` : ''}><div class="kn-band-content"><div class="kn-section-body kn-body-text">${body}</div></div></section>`;

// The whole page in one mode: each case a pair of bands of the same ground, the tree without its ground and then with.
export function plateGroundPage(css, kinds, mode, depth = 3) {
  const cases = grounds(kinds).flatMap((ground) => runs(depth).map((run) => `<div data-case="${ground.kind ?? 'none'}${ground.local ? ' in the other mode' : ''}: ${run.join(' > ')}">${band(ground, mode, tree(run, undefined, false), 'without')}${band(ground, mode, tree(run, ground.kind, true), 'with')}</div>`));
  return `<!doctype html><html lang="en" data-kn-mode="${mode}"><head><meta charset="utf-8"><title>Plates and their ground</title><style>${css}</style></head><body data-kn-surface="page"><main>${cases.join('\n')}</main></body></html>`;
}

// Run in the page: every plate of a tree written without its ground against the same plate written for it, property by
// property, every property the browser computes and the core's custom properties; and the plates written for their
// ground keep the kind they name. `names` are the custom properties to compare too.
export function comparePlates(names) {
  const problems = [];
  let plates = 0, turned = 0;
  for (const pair of document.querySelectorAll('[data-case]')) {
    const [without, known] = ['without', 'with'].map((version) => [...pair.querySelector(`[data-version="${version}"]`).querySelectorAll('[data-kn-surface]')]);
    if (without.length !== known.length) { problems.push(`${pair.dataset.case}: ${without.length} plates against ${known.length}`); continue; }
    known.forEach((plate, i) => {
      const a = getComputedStyle(without[i]), b = getComputedStyle(plate);
      const kind = b.getPropertyValue('--kn-surface-kind').trim();
      if (kind !== plate.dataset.knSurface) problems.push(`${pair.dataset.case}, plate ${i + 1}: written for its ground as ${plate.dataset.knSurface}, it is ${kind}`);
      const differ = [...new Set([...a, ...names])].filter((property) => a.getPropertyValue(property) !== b.getPropertyValue(property));
      if (differ.length) problems.push(`${pair.dataset.case}, plate ${i + 1}: ${differ.slice(0, 4).map((property) => `${property} ${a.getPropertyValue(property).trim()} against ${b.getPropertyValue(property).trim()}`).join('; ')}`);
      plates++;
      if (without[i].dataset.knSurface !== plate.dataset.knSurface) turned++;
    });
  }
  return { problems, plates, turned };
}
