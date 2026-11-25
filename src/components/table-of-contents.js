// Missing semantic levels are compressed into the next list level, without
// empty links or placeholder list items. Input order and actual anchors survive.
// Build-time helpers: Table of Contents runs no client code of its own (docs/spec/directives.md, `toc`).
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

/**
 * The loader a following menu ends with (directives.md, `toc`): where the browser lacks CSS scroll markers, it fetches
 * the polyfill that marks the link of the section being read, and elsewhere it does nothing. It is written as Astro
 * writes the header's loaders, `define:vars` and all, so its text is the same on every page of a build, as the Konzilo
 * core's content security policy needs, and the offline copies find the polyfill's address in it.
 * @param {string} src The polyfill's address, as scroll-markers-loader.js imports `scroll-markers-polyfill.js?url&no-inline`.
 */
export function followingMenuLoader(src) {
  return `<script data-kn-polyfill="scroll-markers">(function(){const src = ${JSON.stringify(src)};\nif (!CSS.supports('scroll-target-group: auto')) import(src);})();</script>`;
}
