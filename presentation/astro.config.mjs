import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';
export default defineConfig({
  output: 'static',
  outDir: resolve(process.env.KN_OUTPUT || 'presentation/dist'),
  cacheDir: '../node_modules/.cache/konzilo-astro',
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER } },
});
