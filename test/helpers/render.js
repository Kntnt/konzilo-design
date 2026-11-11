import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { transform } from '@astrojs/compiler-rs';
import { experimental_AstroContainer } from 'astro/container';
const compiled = new Map();
export async function render(name, props = {}, slots) {
  if (!compiled.has(name)) {
    const entry = new URL(`../../src/components/${name}.astro`, import.meta.url);
    const bundle = await rolldown({ input: 'virtual:component', logLevel: 'silent', treeshake: { manualPureFunctions: ['$$createMetadata'] }, plugins: [{
      name: 'interaction-components',
      resolveId(id, importer) {
        if (id === 'virtual:component') return id;
        // An asset's address, as Vite gives it to a component: here only its name.
        if (/\?url\b/.test(id)) return `virtual:url:${id.split('?')[0].split('/').pop()}`;
        // A file's text, as Vite gives it to a component that writes it inline.
        if (id.endsWith('?raw')) return `virtual:raw:${fileURLToPath(new URL(id.slice(0, -4), pathToFileURL(importer)))}`;
        if (id.endsWith('.astro')) return fileURLToPath(id.startsWith('file:') ? id : new URL(id, pathToFileURL(importer)));
        return { id: id.startsWith('.') ? new URL(id, pathToFileURL(importer)).href : import.meta.resolve(id), external: true };
      },
      async load(id) {
        if (id.startsWith('virtual:raw:')) return `export default ${JSON.stringify(await readFile(id.slice(12), 'utf8'))};`;
        if (id.startsWith('virtual:url:')) return `export default ${JSON.stringify(`/_astro/${id.slice(12)}`)};`;
        return id === 'virtual:component' ? `export { default } from ${JSON.stringify(entry.href)};` : id.endsWith('.astro') ? transform(await readFile(id, 'utf8'), { filename: id, internalURL: 'astro/compiler-runtime', resultScopedSlot: true }).code : null;
      },
    }] });
    let code;
    try { code = (await bundle.generate({ format: 'esm' })).output[0].code; } finally { await bundle.close(); }
    compiled.set(name, (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default);
  }
  const container = await experimental_AstroContainer.create();
  return container.renderToString(compiled.get(name), { props, slots });
}
export const textOf = (node) => node?.value ?? node?.children?.map(textOf).join('') ?? '';

