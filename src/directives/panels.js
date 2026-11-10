// A tab's grouping (docs/spec/directives.md, `tabs`).

// `blocks` is the panel's blocks in order, each `{ component }`, true for what a directive made. Where the
// panel is a run of text followed by a run of components, both not empty, it returns their indexes as
// `{ text, parts }`, which stand in `.kn-tabs-text` and `.kn-tabs-parts`. Otherwise it returns null, and
// the panel's blocks stand directly in it, in order.
export function panelParts(blocks) {
  const list = [...(blocks ?? [])];
  const first = list.findIndex((block) => !!block?.component);
  if (first <= 0) return null;
  if (list.slice(first).some((block) => !block?.component)) return null;
  const indexes = list.map((_, index) => index);
  return { text: indexes.slice(0, first), parts: indexes.slice(first) };
}
