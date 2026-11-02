import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPresentation, repo } from './build.js';

export const defaultPdfPath = (
  designFile,
  date = new Date().toISOString().slice(0, 10),
) =>
  join(
    dirname(resolve(designFile)),
    `${basename(designFile, extname(designFile)).replace(/\.design$/, '')}-design-system-${date}.pdf`,
  );
// Chromium quantises CSS paper dimensions to microns (810px becomes 607.92pt).
// Normalise its uncompressed MediaBox without moving a byte or changing xref offsets.
export function exactPageSize(bytes) {
  let count = 0;
  const source = bytes.toString('latin1');
  const result = source.replace(
    /\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/g,
    (match, width, height) => {
      if (
        Math.abs(Number(width) - 1080) > 1 ||
        Math.abs(Number(height) - 607.5) > 1
      )
        throw new Error('Unexpected PDF paper size.');
      count++;
      const box = '/MediaBox [0 0 1080 607.5';
      return box.padEnd(match.length - 1, ' ') + ']';
    },
  );
  if (!count) throw new Error('Chromium PDF has no readable MediaBox.');
  return Buffer.from(result, 'latin1');
}
export async function prepareDocument(page) {
  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    async function ready(document) {
      for (const image of document.images) image.loading = 'eager';
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise((done) => {
                image.onload = done;
                image.onerror = done;
              }),
        ),
      );
    }
    await ready(document);
    for (const frame of document.querySelectorAll('iframe')) {
      if (
        !frame.contentDocument?.body ||
        frame.contentDocument.readyState !== 'complete'
      ) {
        await new Promise((done) =>
          frame.addEventListener('load', done, { once: true }),
        );
      }
      await ready(frame.contentDocument);
    }
  });
  for (const frame of page.frames().slice(1)) {
    await frame.evaluate(() => {
      const id = document.body.dataset.specimen;
      if (id === 'header-a-menu')
        document.querySelector('[data-kn-trigger="menu"]')?.click();
      if (id === 'header-a-search')
        document.querySelector('[data-kn-trigger="search"]')?.click();
      if (id === 'accordion')
        document.querySelectorAll('details').forEach((detail) => {
          detail.open = true;
        });
      if (id === 'consent-banner')
        document.querySelector('.kn-consent').hidden = false;
      if (id === 'consent-settings') {
        document.querySelector('[data-kn-consent-open]')?.click();
        const dialog = document.querySelector('dialog');
        if (!dialog.open) dialog.showModal();
        // The controller may display its banner after initialisation; remove it from this specimen.
        document.querySelector('.kn-consent').remove();
        dialog.querySelectorAll('details').forEach((detail) => {
          detail.open = false;
        });
      }
      if (id === 'embed') {
        const example = document.querySelector(
          '[data-embed-example="thumbnail"]',
        );
        example.querySelector('.kn-embed-consent').hidden = true;
        example.querySelector('.kn-embed-thumbnail').hidden = false;
      }
      if (id === 'visitor-filters') {
        const search = document.querySelector('input[type="search"]');
        search.value = 'planning';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelectorAll('.kn-field[class*="is-"]').forEach((field) => {
        const state = [...field.classList].find((name) =>
          name.startsWith('is-'),
        );
        if (!state) return;
        field.classList.remove(state);
        field.querySelector('.kn-field-control,input')?.classList.add(state);
      });
      document
        .querySelectorAll('h1,h2,h3,h4,h5,h6')
        .forEach((heading) => heading.setAttribute('role', 'presentation'));
    });
  }
  // Filtering is debounced by the real component controller.
  await page.waitForTimeout(250);
  // Real panels autofocus when opened. Printed focus is reserved for forced-state examples.
  for (const frame of page.frames())
    await frame.evaluate(() => document.activeElement?.blur());
  await page.evaluate(async () => {
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    const copy = JSON.parse(
      document.getElementById('kn-document-copy').textContent,
    );
    for (const sheet of document.querySelectorAll('.sheet')) {
      sheet.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
        if (
          !heading.matches(
            '.page-heading > h2,.cover-content > h1,.chapter-content > h1',
          )
        )
          heading.setAttribute('role', 'presentation');
      });
      const area = sheet.querySelector('[data-fit-area]');
      if (!area) continue;
      const content = area.querySelector('[data-fit-content]');
      const frame = content.querySelector('[data-frame-host] > iframe');
      let zoom = 1;
      if (frame) {
        const document = frame.contentDocument;
        const root = document.querySelector('.sample-root');
        const floating =
          document.querySelector('dialog[open]') ||
          document.querySelector('.kn-consent:not([hidden])');
        let height = Math.max(
          root.scrollHeight,
          root.getBoundingClientRect().height,
        );
        if (floating) height = Math.max(height, floating.scrollHeight + 40);
        zoom = Math.min(1, area.clientHeight / height);
        frame.height = String(Math.ceil(Math.max(area.clientHeight, height)));
        frame.style.height = `${frame.height}px`;
        frame.style.transform = `scale(${zoom})`;
      } else if (sheet.id !== 'responsive') {
        const height = content.scrollHeight;
        zoom = Math.min(
          1,
          area.clientHeight / height,
          area.clientWidth / content.scrollWidth,
        );
        if (zoom < 1) {
          zoom *= 0.99;
          content.style.zoom = String(zoom);
          content.style.height = 'auto';
        }
      }
      sheet.dataset.zoom = String(zoom);
      if (zoom < 0.995) {
        sheet.querySelector('[data-zoom-note]').textContent = copy.zoom.replace(
          '{percent}',
          new Intl.NumberFormat(copy.lang, { maximumFractionDigits: 0 }).format(
            zoom * 100,
          ),
        );
      }
    }
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
}
export async function inspectDocument(page) {
  return page.evaluate(() => {
    const warnings = [];
    const pages = [];
    const visible = (n) =>
      n.getClientRects().length &&
      getComputedStyle(n).visibility !== 'hidden' &&
      getComputedStyle(n).display !== 'none';
    function clipped(doc, bounds, root = doc.body) {
      const found = [];
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        const parent = text.parentElement;
        if (
          !text.textContent.trim() ||
          !parent ||
          ['SCRIPT', 'STYLE', 'TITLE'].includes(parent.tagName) ||
          !visible(parent) ||
          parent.closest('.kn-skip-link,[hidden],template')
        )
          continue;
        const closed = parent.closest('details:not([open])');
        if (closed && !closed.querySelector('summary')?.contains(parent))
          continue;
        if (
          getComputedStyle(parent).position === 'absolute' &&
          parseFloat(getComputedStyle(parent).width) < 2
        )
          continue;
        const range = doc.createRange();
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          if (
            rect.bottom > bounds.bottom + 2 ||
            rect.right > bounds.right + 2 ||
            rect.left < bounds.left - 2 ||
            rect.top < bounds.top - 2
          ) {
            found.push(text.textContent.trim().slice(0, 80));
            break;
          }
          // Check explicit scrolling/clipping ancestors, including dialog interiors.
          for (
            let ancestor = parent;
            ancestor && ancestor !== doc.body;
            ancestor = ancestor.parentElement
          ) {
            const css = getComputedStyle(ancestor);
            if (
              !/(hidden|clip|auto|scroll)/.test(
                css.overflow + css.overflowY + css.overflowX,
              )
            )
              continue;
            const b = ancestor.getBoundingClientRect();
            if (
              rect.bottom > b.bottom + 3 ||
              rect.right > b.right + 3 ||
              rect.left < b.left - 3 ||
              rect.top < b.top - 3
            ) {
              found.push(text.textContent.trim().slice(0, 80));
              break;
            }
          }
        }
      }
      return [...new Set(found)];
    }
    for (const sheet of document.querySelectorAll('.sheet')) {
      const page = {
        number: Number(sheet.dataset.page),
        title: sheet.dataset.title,
        id: sheet.id,
        catalog: JSON.parse(sheet.dataset.catalog || '[]'),
        zoom: Number(sheet.dataset.zoom || 1),
      };
      if (sheet.id === 'responsive')
        page.viewports = [
          ...new Set(
            [...sheet.querySelectorAll('iframe')].map(
              (frame) => frame.contentWindow.innerWidth,
            ),
          ),
        ];
      pages.push(page);
      const rect = sheet.getBoundingClientRect();
      const problems = [];
      if (sheet.scrollWidth > 1441 || sheet.scrollHeight > 811)
        problems.push('Page exceeds 1440 × 810 px');
      const pageClipping = clipped(document, rect, sheet);
      if (pageClipping.length)
        problems.push(`Text exceeds page: ${pageClipping.join('; ')}`);
      const area = sheet.querySelector('[data-fit-area]');
      if (area) {
        const a = area.getBoundingClientRect();
        const content = area.querySelector('[data-fit-content]');
        if (
          sheet.id !== 'responsive' &&
          !content.querySelector('iframe') &&
          content.getBoundingClientRect().bottom > a.bottom + 2
        )
          problems.push('Specimen exceeds its area');
        if (!content.querySelector('iframe')) {
          const textClipping = clipped(document, a, content);
          if (textClipping.length)
            problems.push(`Clipped specimen text: ${textClipping.join('; ')}`);
        }
        const h = sheet.querySelector('.page-heading');
        if (h && h.scrollHeight > h.clientHeight + 2)
          problems.push('Introduction exceeds its area');
        for (const frame of sheet.querySelectorAll('iframe')) {
          if (sheet.id === 'responsive') continue;
          const doc = frame.contentDocument;
          const result = clipped(doc, {
            top: 0,
            left: 0,
            right: Number(frame.width),
            bottom: Number(frame.height),
          });
          if (result.length)
            problems.push(`Clipped specimen text: ${result.join('; ')}`);
        }
      }
      if (problems.length)
        warnings.push({ page: page.number, title: page.title, problems });
    }
    return { pages, warnings };
  });
}
export async function createPdf(designFile, output, { keepHtml = false } = {}) {
  const absolute = resolve(designFile);
  const path = resolve(output || defaultPdfPath(absolute));
  if (path === absolute)
    throw new Error('PDF output must differ from the design file.');
  const cache = join(repo, 'node_modules/.cache/konzilo-pdf');
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(join(cache, 'build-'));
  let browser;
  try {
    await buildPresentation({ designFile: absolute, output: directory });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 810 },
      deviceScaleFactor: 1,
    });
    // A presentation is offline; even a supplied logo cannot initiate remote requests.
    await page.route('**/*', (route) =>
      /^(?:file:|data:|about:)/.test(route.request().url())
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(join(directory, 'index.html')).href, {
      waitUntil: 'load',
    });
    await prepareDocument(page);
    const report = await inspectDocument(page);
    await mkdir(dirname(path), { recursive: true });
    const bytes = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
      outline: true,
    });
    await writeFile(path, exactPageSize(bytes));
    if (keepHtml)
      await writeFile(
        join(dirname(path), 'index.html'),
        await readFile(join(directory, 'index.html')),
      );
    return { path, ...report };
  } finally {
    await browser?.close();
    // Only this freshly created, known build directory is removed.
    await rm(directory, { recursive: true, force: true });
  }
}
