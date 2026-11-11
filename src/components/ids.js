// Unique within a build and repeatable across builds, so unchanged content gives unchanged HTML.
let count = 0;
export const nextId = (prefix) => `${prefix}-${++count}`;

// The ids an element is described by, each once, or nothing.
export const describedBy = (...ids) => [...new Set(ids.filter(Boolean))].join(' ') || undefined;
