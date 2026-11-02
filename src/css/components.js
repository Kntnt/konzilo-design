import { readFile } from 'node:fs/promises';

// Flatten the same entry point sites import, preserving each file's layer.
export async function componentsCss() {
  const entry = new URL('../components/index.css', import.meta.url);
  const css = await readFile(entry, 'utf8');
  const imports = [...css.matchAll(/@import "(\.\/[a-z-]+\.css)";/g)];
  const files = await Promise.all(imports.map(([, path]) => readFile(new URL(path, entry), 'utf8')));
  let index = 0;
  return css.replace(/@import "\.\/[a-z-]+\.css";/g, () => files[index++].trimEnd());
}
