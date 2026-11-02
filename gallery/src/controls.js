// Live design controls publish the same validated core to the sandboxed frame.
export function setupControls({ derive, coreCss, onChange }) {
  const bar = document.querySelector('.g-controls');
  const form = document.querySelector('#g-design-controls');
  const style = document.querySelector('#kn-live-core');
  const status = document.querySelector('.g-status');
  const toggle = document.querySelector('.g-toggle');
  const initial = JSON.parse(document.querySelector('#g-initial-inputs').textContent);
  const field = (name) => form.elements.namedItem(name);
  const deferred = new Set(['density', 'frame']);
  form.addEventListener('submit', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    bar.dataset.expanded = String(expanded);
  });
  function update() {
    try {
      const inputs = structuredClone(initial);
      inputs['brand-colors'].primary = field('primary').value;
      if (field('secondary-enabled').checked) inputs['brand-colors'].secondary = field('secondary').value;
      else {
        delete inputs['brand-colors'].secondary;
        delete inputs['brand-colors'].tertiary;
      }
      inputs.typefaces = { main: field('main-typeface').value, monospace: field('monospace-typeface').value };
      if (field('heading-typeface').value) inputs.typefaces.heading = field('heading-typeface').value;
      inputs.type.label = field('label').value;
      inputs['corner-profile'] = Number(field('corner').value);
      inputs['density-profile'] = Number(field('density').value);
      inputs.shadow.strength = Number(field('strength').value);
      inputs.shadow.hardness = Number(field('hardness').value);
      inputs.frame.width = Number(field('frame').value);
      const resolved = derive(inputs);
      const report = resolved['contrast-check'];
      if (report.status !== 'passed') throw new Error('Contrast failed. Previous design retained; try another colour.');
      const css = coreCss(resolved);
      style.textContent = css;
      document.documentElement.dataset.knMode = field('mode').value;
      for (const row of document.querySelectorAll('[data-g-surface-kind]')) row.hidden = !resolved.surfaces[row.dataset.gSurfaceKind];
      onChange?.({ css, mode: field('mode').value });
      status.textContent = `Contrast passed · ${Object.keys(report.matrix).length} Surfaces, both modes`;
      bar.dataset.status = 'passed';
      status.removeAttribute('title');
    } catch (error) {
      status.textContent = `Generation failed: ${error.message}`;
      status.title = status.textContent;
      bar.dataset.status = 'failed';
    }
  }
  form.addEventListener('input', (event) => {
    const target = event.target;
    const output = document.getElementById(`${target.id}-value`);
    if (output) output.value = target.value;
    if (!deferred.has(target.name)) update();
  });
  form.addEventListener('change', (event) => {
    // Labels in the monospace family are a deliberate choice, and the recommendation follows it.
    if (event.target.name === 'label' && event.target.value === 'monospace' && field('monospace-typeface').selectedIndex === 0) field('monospace-typeface').selectedIndex = 1;
    update();
  });
  update();
}
