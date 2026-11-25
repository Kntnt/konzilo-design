import { defineConfig } from 'astro/config';
// `tool/build.js` builds with the root in a folder of its own outside the checkout, which links the checkout's
// entries. The pages are reached through the links, kept as written, and both caches stay in the folder, never in
// the packages its `node_modules` leads to; all go when the folder does.
export default defineConfig({
  output: 'static',
  srcDir: './presentation/src',
  outDir: process.env.KN_OUTPUT,
  cacheDir: './cache/astro',
  build: { inlineStylesheets: 'always' },
  vite: {
    cacheDir: './cache/vite',
    resolve: { preserveSymlinks: true },
    build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER },
  },
});
