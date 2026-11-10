// Tabs (docs/spec/directives.md, `tabs`): the ARIA tabs pattern on markup the site writes whole. Every panel
// shows until this runs, so a page without it loses nothing; the stylesheet shows only the first meanwhile,
// so the page does not jump when it does.

// The event a Konzilo live preview sends from the block an editor selects.
export const PREVIEW_EVENT = 'konzilo-preview-show';

// Where a key moves the selection in a row of `count` tabs, from `index`: along the row, wrapping, in the
// direction the text runs, or to either end. Null for any other key.
export function tabMove(key, index, count, rtl = false) {
  if (count < 1) return null;
  const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[key];
  if (step) return (index + step + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

// The element a fragment names, or null.
function targetOf(hash) {
  if (!hash || hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

function enhance(tabs) {
  const list = tabs.querySelector(':scope > .kn-tabs-list');
  if (!list) return null;
  const pairs = [...list.querySelectorAll(':scope > [role="tab"]')]
    .map((tab) => ({ tab, panel: [...tabs.children].find((child) => child.id && child.id === tab.getAttribute('aria-controls')) }))
    .filter(({ panel }) => panel);
  if (!pairs.length) return null;
  let current = Math.max(0, pairs.findIndex(({ tab }) => tab.getAttribute('aria-selected') === 'true'));
  function select(index) {
    current = index;
    pairs.forEach(({ tab, panel }, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      if (i === index) tab.removeAttribute('tabindex');
      else tab.setAttribute('tabindex', '-1');
      panel.hidden = i !== index;
    });
  }
  const indexOf = (element) => pairs.findIndex(({ tab }) => tab === element);
  function click(event) {
    const index = indexOf(event.target.closest?.('[role="tab"]'));
    if (index >= 0) select(index);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const from = indexOf(event.target);
    if (from < 0) return;
    const to = tabMove(event.key, from, pairs.length, getComputedStyle(list).direction === 'rtl');
    if (to === null) return;
    event.preventDefault();
    select(to);
    pairs[to].tab.focus();
  }
  // A link to something in a panel that is not shown shows that panel, and then goes there.
  function reveal(target, scroll = true) {
    const index = target ? pairs.findIndex(({ panel }) => panel.contains(target)) : -1;
    if (index < 0 || index === current) return;
    select(index);
    if (scroll) target.scrollIntoView();
  }
  select(current);
  tabs.setAttribute('data-kn-enhanced', '');
  list.addEventListener('click', click);
  list.addEventListener('keydown', keydown);
  return {
    reveal,
    dispose() {
      list.removeEventListener('click', click);
      list.removeEventListener('keydown', keydown);
      tabs.removeAttribute('data-kn-enhanced');
      pairs.forEach(({ panel }) => { panel.hidden = false; });
    },
  };
}

export function setupTabs(root = document) {
  const controllers = [...root.querySelectorAll('.kn-tabs')].map(enhance).filter(Boolean);
  if (!controllers.length) return () => {};
  const follow = () => {
    const target = targetOf(location.hash);
    controllers.forEach(({ reveal }) => reveal(target));
  };
  // A live preview selects a block in the editor by a bubbling `konzilo-preview-show` from that block, and what
  // holds it opens; the preview, not this, brings it into view (docs/spec/directives.md, Live preview).
  const preview = (event) => {
    const target = event.target instanceof Node ? event.target : null;
    controllers.forEach(({ reveal }) => reveal(target, false));
  };
  window.addEventListener('hashchange', follow);
  document.addEventListener(PREVIEW_EVENT, preview);
  follow();
  return () => {
    window.removeEventListener('hashchange', follow);
    document.removeEventListener(PREVIEW_EVENT, preview);
    controllers.forEach(({ dispose }) => dispose());
  };
}
