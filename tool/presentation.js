import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { buildPresentation, repo } from './build.js';
import { zipFile } from './archive.js';

export const defaultPresentationPath = (designFile, date = new Date().toISOString().slice(0, 10)) => join(
  dirname(resolve(designFile)),
  `${basename(designFile, extname(designFile)).replace(/\.design$/, '')}-presentation-${date}.zip`,
);

export function slug(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'example';
}

export async function createPresentation(designFile, output, options = {}) {
  const date = options.date || new Date().toISOString().slice(0, 10);
  const path = resolve(output || defaultPresentationPath(designFile, date));
  const cache = join(repo, 'node_modules/.cache/konzilo-presentation');
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(join(cache, 'build-'));
  try {
    const { html } = await buildPresentation({ designFile: resolve(designFile), output: directory, date });
    const source = JSON.parse(await readFile(designFile, 'utf8'));
    const data = JSON.parse(html.match(/<script id="kn-document-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
    const filename = `${slug(source.project?.name || 'Example')}-${slug(data.filename)}.html`;
    const bytes = zipFile(filename, html, new Date(`${date}T12:00:00Z`));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    return { path, filename, bytes: bytes.length, htmlBytes: Buffer.byteLength(html), ...(options.includeHtml ? { html } : {}) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
