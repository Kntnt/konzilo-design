// Choice (docs/spec/directives.md, `choice`): answers that each show their own panel, none chosen beforehand.
// Every panel shows until this runs, so a page without it loses nothing; the stylesheet shows none meanwhile,
// as none shows after it either, so the page does not jump when it does.

// The event a Konzilo live preview sends from the block an editor selects.
export const PREVIEW_EVENT = 'konzilo-preview-show';

function targetOf(hash) {
  if (!hash || hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

function enhance(choice) {
  const group = choice.querySelector(':scope > .kn-choice-answers');
  if (!group) return null;
  const pairs = [...group.querySelectorAll(':scope > .kn-choice-answer')]
    .map((answer) => ({ answer, panel: [...choice.children].find((child) => child.id && child.id === answer.getAttribute('aria-controls')) }))
    .filter(({ panel }) => panel);
  if (!pairs.length) return null;
  let chosen = pairs.findIndex(({ answer }) => answer.getAttribute('aria-expanded') === 'true');
  function choose(index) {
    chosen = index;
    pairs.forEach(({ answer, panel }, i) => {
      answer.setAttribute('aria-expanded', String(i === index));
      panel.hidden = i !== index;
    });
  }
  function click(event) {
    const index = pairs.findIndex(({ answer }) => answer === event.target.closest?.('.kn-choice-answer'));
    // A click on the chosen answer keeps it chosen.
    if (index < 0 || index === chosen) return;
    choose(index);
    // On a phone the answers stand above one another, and the panel may open below the window's edge.
    const { panel } = pairs[index];
    if (panel.getBoundingClientRect().top > innerHeight * 0.8) {
      panel.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
  // A link to something in a panel, such as a form, chooses that panel's answer, and then goes there.
  function reveal(target, scroll = true) {
    const index = target ? pairs.findIndex(({ panel }) => panel.contains(target)) : -1;
    if (index < 0 || index === chosen) return;
    choose(index);
    if (scroll) target.scrollIntoView();
  }
  choose(chosen);
  choice.setAttribute('data-kn-enhanced', '');
  group.addEventListener('click', click);
  return {
    reveal,
    dispose() {
      group.removeEventListener('click', click);
      choice.removeAttribute('data-kn-enhanced');
      pairs.forEach(({ panel }) => { panel.hidden = false; });
    },
  };
}

export function setupChoices(root = document) {
  const controllers = [...root.querySelectorAll('.kn-choice')].map(enhance).filter(Boolean);
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
