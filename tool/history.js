// The design's history: a snapshot per step, each sharing with the one before it all that has not
// changed, so a large logo is held once however many steps pass. Nothing here knows of the page.
export const LIMIT = 200;
// A burst of typing is one step, and this long a pause ends it.
export const TYPING_PAUSE = 1000;

const isObject = (value) => value !== null && typeof value === 'object';
// A field emptied leaves its empty group behind, which is the same design as never having had it.
const isBlank = (value) => value === undefined || (isObject(value) && !Array.isArray(value) && Object.values(value).every(isBlank));
// The tool writes a colour in lower case, and a file may hold it in upper: the same colour, so no step.
const isHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const same = (a, b) => a === b || (isBlank(a) && isBlank(b)) || (isHex(a) && isHex(b) && a.toLowerCase() === b.toLowerCase());

// A frozen copy of `value`, in which whatever equals its place in `previous` is that very part of
// `previous`. Nothing changed gives `previous` itself, in whatever order the keys now stand.
export function capture(value, previous) {
  if (!isObject(value)) return value;
  const base = isObject(previous) ? previous : {};
  const copy = Array.isArray(value) ? [] : {};
  let unchanged = isObject(previous) && Array.isArray(value) === Array.isArray(previous);
  for (const key of Object.keys(value)) {
    copy[key] = capture(value[key], base[key]);
    if (!same(copy[key], base[key])) unchanged = false;
  }
  if (unchanged && Object.keys(base).some((key) => !Object.hasOwn(value, key) && !isBlank(base[key]))) unchanged = false;
  return unchanged ? previous : Object.freeze(copy);
}

// A copy to go on changing. Its strings are the snapshot's own, so a logo is not copied either.
export const thaw = (value) => {
  if (!isObject(value)) return value;
  if (Array.isArray(value)) return value.map(thaw);
  return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, thaw(part)]));
};

// A step remembers where it was made, and going either way through it returns there.
export function createHistory(state, { limit = LIMIT } = {}) {
  const past = [];
  const future = [];
  let present = state;
  const move = (from, to) => {
    const step = from.pop();
    if (!step) return null;
    to.push({ state: present, place: step.place });
    present = step.state;
    return step;
  };
  return {
    get present() { return present; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    // Takes what `capture` gave against `present`, so the same value comes here as `present` itself.
    record(next, place) {
      if (next === present) return false;
      past.push({ state: present, place });
      if (past.length > limit) past.shift();
      future.length = 0;
      present = next;
      return true;
    },
    undo: () => move(past, future),
    redo: () => move(future, past),
  };
}

// Cmd or Ctrl with Z, with Shift to go forward, and Ctrl+Y as well.
export function historyAction({ key, metaKey, ctrlKey, shiftKey, altKey }) {
  if (altKey || !(metaKey || ctrlKey)) return null;
  const letter = key?.toLowerCase();
  if (letter === 'z') return shiftKey ? 'redo' : 'undo';
  return letter === 'y' && ctrlKey && !metaKey && !shiftKey ? 'redo' : null;
}

// Where the browser's own text undo works. A read-only sample has none, so the keys stay the design's there.
const TEXT_FIELD = 'textarea:not([readonly]), [contenteditable]:not([contenteditable="false"]), input:not([readonly], [type="range"], [type="checkbox"], [type="radio"], [type="file"], [type="button"], [type="submit"], [type="reset"], [type="color"])';
export const isTextField = (element) => Boolean(element?.matches?.(TEXT_FIELD));
// An arrow key held on one of these is one step, until the key comes up.
export const isSlider = (element) => Boolean(element?.matches?.('input[type="range"], [role="slider"]'));
