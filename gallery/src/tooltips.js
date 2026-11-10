// Build-time descriptions are also available without script. The live tooltip is
// fixed over the page and never affects layout or catches pointer events.
// A field that says what is wrong with it keeps its message in view: no tooltip covers it.
const invalid = (control) => !!(control.closest('[aria-invalid="true"]') || control.querySelector?.('[aria-invalid="true"]'));
export function setupTooltips(root = document) {
  let current;
  const hide = () => { if (current) current.hidden = true; current = undefined; };
  const show = (event) => {
    const control = event.target.closest?.('[data-g-tooltip]');
    if (!control || control.matches(':active')) return;
    if (invalid(control)) { hide(); return; }
    const tip = root.getElementById(control.dataset.gTooltip);
    if (!tip) return;
    hide(); current = tip;
    (control.closest('dialog[open]') ?? document.body).append(tip);
    tip.hidden = false;
    const rect = control.getBoundingClientRect();
    const bounds = tip.getBoundingClientRect();
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const x = Math.max(unit / 2, Math.min(rect.left, window.innerWidth - bounds.width - unit / 2));
    const y = rect.bottom + unit / 2 + bounds.height <= window.innerHeight ? rect.bottom + unit / 2 : Math.max(unit / 2, rect.top - bounds.height - unit / 2);
    tip.style.insetInlineStart = `${(document.documentElement.dir === 'rtl' ? window.innerWidth - x - bounds.width : x) / unit}rem`;
    tip.style.insetBlockStart = `${y / unit}rem`;
  };
  root.addEventListener('pointerover', show); root.addEventListener('focusin', show);
  for (const name of ['pointerout', 'focusout', 'pointerdown', 'input']) root.addEventListener(name, hide);
  root.addEventListener('close', hide, true);
  // A form sent may come back with messages under its fields, or the browser's own for a field that fails its check.
  root.addEventListener('submit', hide, true);
  root.addEventListener('invalid', hide, true);
  window.addEventListener('scroll', hide, { passive: true });
}
