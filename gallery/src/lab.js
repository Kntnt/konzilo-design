// The sandbox has an opaque origin. All communication crosses postMessage.
export function setupGalleryLab() {
  const frame = document.getElementById('g-frame-lab');
  const form = document.getElementById('g-lab-controls');
  if (!frame || !form) return () => {};
  let design = { css: document.getElementById('kn-live-core').textContent, mode: document.documentElement.dataset.knMode };
  const config = () => Object.fromEntries([...form.elements].filter((field) => field.name && field.name !== 'lab-width').map((field) => [field.name, field.type === 'checkbox' ? field.checked : field.value]));
  const slider = form.elements.namedItem('lab-width');
  function resize() {
    const full = Number(slider.value) >= Number(slider.max);
    slider.max = String(Math.max(320, frame.parentElement.clientWidth));
    if (full) { slider.value = slider.max; frame.style.inlineSize = '100%'; }
  }
  resize();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(frame.parentElement);
  function send() { frame.contentWindow?.postMessage({ type: 'kn-frame-config', ...design, config: config() }, '*'); }
  window.addEventListener('message', (event) => { if (event.source === frame.contentWindow && event.data?.type === 'kn-frame-ready') send(); });
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', (event) => {
    if (event.target.name === 'lab-width') {
      const value = Number(event.target.value);
      frame.style.inlineSize = value >= Number(event.target.max) ? '100%' : `${value}px`;
      document.getElementById('g-lab-width-value').value = `${Math.round(frame.getBoundingClientRect().width)} px`;
    } else send();
  });
  const sample = JSON.parse(document.getElementById('g-lab-document').textContent);
  if (typeof sample === 'string') frame.srcdoc = sample;
  return (next) => { design = next; send(); };
}
