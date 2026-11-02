// One set of controls moves the existing rendered parts in all three examples.
export function setupContentControls(root = document) {
  const form = root.getElementById('g-content-controls');
  if (!form) return;
  const loops = [...root.querySelectorAll('[data-g-configurable]')];
  const records = loops.flatMap((loop) => [...loop.querySelectorAll('.kn-content-item')].map((item) => {
    const article = item.querySelector('article');
    const body = article.querySelector('.kn-content-body');
    const metas = [1, 2].map((place) => {
      let part = body.querySelector(`[data-kn-meta="${place}"]`);
      if (!part) { part = document.createElement('p'); part.className = 'kn-content-meta'; part.dataset.knType = 'small'; part.dataset.knMeta = String(place); body.insertBefore(part, place === 1 ? body.firstChild : body.querySelector('.kn-content-heading').nextSibling); }
      return part;
    });
    let picture = article.querySelector('.kn-content-picture');
    if (!picture) { picture = document.createElement('div'); picture.className = 'kn-content-picture'; picture.setAttribute('data-kn-placeholder', ''); picture.setAttribute('aria-hidden', 'true'); article.insertBefore(picture, body); }
    return { article, metas, metadata: metas.flatMap((part) => [...part.children]), picture, text: article.querySelector('.kn-content-text'), cta: article.querySelector('.kn-content-cta') };
  }));
  const field = (name) => form.elements.namedItem(name);
  function update() {
    const rows = field('presentation').value === 'rows';
    const ratio = field('ratio');
    for (const option of ratio.options) option.disabled = rows ? option.value === '2:1' : option.value === '1:1';
    if ((rows && ratio.value === '2:1') || (!rows && ratio.value === '1:1')) ratio.value = '3:2';
    for (const loop of loops) {
      loop.dataset.knPresentation = rows ? 'rows' : 'cards';
      const list = loop.querySelector('.kn-content-items');
      list.classList.toggle('kn-card-grid', !rows); list.classList.toggle('kn-content-rows', rows);
      list.dataset.knColumns = field('columns').value;
    }
    for (const record of records) {
      const { article, metas, metadata, picture, text, cta } = record;
      article.classList.toggle('kn-card', !rows); article.classList.toggle('kn-content-card', !rows); article.classList.toggle('kn-content-row', rows);
      article.dataset.knImageRatio = ratio.value; article.dataset.knImageInset = String(field('inset').checked);
      if (field('plated').checked && !rows) article.dataset.knSurface = field('surface').value; else article.removeAttribute('data-kn-surface');
      if (picture) picture.hidden = !field('images').checked || (!rows && picture.hasAttribute('data-kn-placeholder'));
      metas.forEach((part) => { part.replaceChildren(); part.dataset.knSeparator = field('separator').value; });
      const place = field('metadata').value;
      metadata.forEach((part) => {
        const kind = part.dataset.knMetaKind;
        if (!field(kind)?.checked) return;
        const pill = kind === 'category' && field('pill').checked;
        part.classList.toggle('kn-pill', pill); part.toggleAttribute('data-kn-pill', pill);
        metas[place === '2' || (place === 'both' && kind !== 'category') ? 1 : 0].append(part);
      });
      metas.forEach((part) => { part.hidden = part.children.length === 0; });
      if (text) text.hidden = !field('text').checked;
      if (cta) {
        cta.hidden = field('cta').value === 'none';
        const link = cta.querySelector('a'); const button = field('cta').value === 'button';
        link.classList.toggle('kn-button', button);
        if (button) link.dataset.knVariant = 'outline'; else link.removeAttribute('data-kn-variant');
        const icon = link.querySelector('.kn-content-cta-icon');
        if (icon) { icon.textContent = field('cta-icon').value; icon.hidden = !field('cta-icon').value; }
      }
    }
    window.dispatchEvent(new Event('kn:contentconfigured'));
  }
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('change', update);
  update();
}
