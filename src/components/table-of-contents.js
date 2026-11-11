// Missing semantic levels are compressed into the next list level, without
// empty links or placeholder list items. Input order and actual anchors survive.
// A pure build-time helper: Table of Contents runs no client code (docs/spec/directives.md, `toc`).
export function contentsTree(headings, depth = 2) {
  const roots = [], stack = [];
  for (const heading of headings.filter(({ depth: level }) => level >= 2 && level <= depth)) {
    while (stack.length && stack.at(-1).depth >= heading.depth) stack.pop();
    const entry = { ...heading, children: [] };
    (stack.at(-1)?.children ?? roots).push(entry);
    stack.push(entry);
  }
  return roots;
}
