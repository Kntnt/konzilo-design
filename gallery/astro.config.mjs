import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'always' },
  cacheDir: './node_modules/.astro',
  // The page must stay one self-contained file, so every asset becomes a data URI, also fonts.
  vite: { build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER } },
});
