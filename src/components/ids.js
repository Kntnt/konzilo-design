// Unique within a build and repeatable across builds, so unchanged content gives unchanged HTML.
let count = 0;
export const nextId = (prefix) => `${prefix}-${++count}`;
