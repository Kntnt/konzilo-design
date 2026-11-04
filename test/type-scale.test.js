import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { derive, defaultInputs, sizeAt, windowShare, validateInputs, fluid } from '../src/generator/index.js';
import { coreCss } from '../src/css/index.js';

const inputs = (type = {}) => ({ 'brand-colors': { primary: '#168b83' }, type });
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} against ${expected}`);

test('a size is the body size times the base to the power of its step, at every width', () => {
  const scale = { breakpoints: { min: 390, max: 1440 }, ratio: { min: 1.067, max: 1.125 }, 'body-size': { min: 17, max: 19 } };
  near(sizeAt(scale, 10, 390), 17 * 1.067 ** 10, 1e-9, 'at the left breakpoint');
  near(sizeAt(scale, 10, 915), 18 * 1.096 ** 10, 1e-9, 'halfway');
  near(sizeAt(scale, 10, 1440), 19 * 1.125 ** 10, 1e-9, 'at the right breakpoint');
  assert.equal(sizeAt(scale, 10, 320), sizeAt(scale, 10, 390), 'fixed below the left breakpoint');
  assert.equal(sizeAt(scale, 10, 1920), sizeAt(scale, 10, 1440), 'fixed above the right breakpoint');
  assert.equal(sizeAt(scale, 0, 915), 18, 'the body size is step 0');
  assert.equal(sizeAt({ ...scale, ratio: { min: 1.5, max: 1.5 } }, -20, 915), 12, 'no text below 12 px');
});

test('two breakpoints on one width change the scale at once, there', () => {
  const scale = { breakpoints: { min: 768, max: 768 }, ratio: { min: 1.067, max: 1.25 }, 'body-size': { min: 17, max: 19 } };
  assert.equal(windowShare(scale, 767), 0);
  assert.equal(windowShare(scale, 768), 1);
  near(sizeAt(scale, 3, 767), 17 * 1.067 ** 3, 1e-9, 'below');
  near(sizeAt(scale, 3, 768), 19 * 1.25 ** 3, 1e-9, 'there');
  assert.equal(fluid(10, 20, 768, 768), 'clamp(0.625rem, -478.75rem + 1000vw, 1.25rem)');
});

test('a new design has its breakpoints at 390 and 1440 px, and they stay on the line in order', () => {
  assert.deepEqual(defaultInputs().type.breakpoints, { min: 390, max: 1440 });
  assert.deepEqual(derive(inputs())['type-scale'].breakpoints, { min: 390, max: 1440 });
  assert.throws(() => derive(inputs({ breakpoints: { min: 1000, max: 900 } })), /min must not be above max/);
  assert.equal(derive(inputs({ breakpoints: { min: 900, max: 900 } }))['type-scale'].breakpoints.min, 900);
  assert.throws(() => validateInputs(inputs({ breakpoints: { min: 319 } })));
  assert.throws(() => validateInputs(inputs({ breakpoints: { max: 1921 } })));
});

test('the sizes follow the curve where a browser can, and otherwise the clamp', () => {
  const resolved = derive(inputs());
  const css = coreCss(resolved);
  assert.match(css, /@supports \(width: calc\(1rem \* pow\(tan\(atan2\(100vw, 1rem\)\), 2\)\)\) \{/);
  assert.match(css, /--kn-type-window: clamp\(0, \(tan\(atan2\(100vw, 1rem\)\) - 24\.375\) \/ 65\.625, 1\);/);
  assert.match(css, /--kn-type-display-size: calc\(var\(--kn-type-body-size\) \* pow\(var\(--kn-type-base\), 10\)\);/);
  assert.match(css, /--kn-type-label-size: max\(0\.75rem, calc\(var\(--kn-type-body-size\) \* pow\(var\(--kn-type-base\), -5\)\)\);/);
  assert.match(css, /--kn-type-display-size: clamp\(/, 'the fallback stays');
  const { 'type-scale': scale, ...older } = resolved;
  assert.doesNotMatch(coreCss(older), /@supports/, 'a file resolved before the curve keeps its clamps');
});

test('a browser renders what the tool says, by the curve and by the fallback', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    const styles = ['display', 'heading-1', 'heading-3', 'body', 'label'];
    const body = styles.map((style) => `<p data-style="${style}" style="font-size: var(--kn-type-${style}-size)">x</p>`).join('');
    const read = () => Object.fromEntries([...document.querySelectorAll('[data-style]')].map((node) => [node.dataset.style, parseFloat(getComputedStyle(node).fontSize)]));
    for (const type of [{}, { ratio: { min: 1.125, max: 1.25 }, breakpoints: { min: 690, max: 1440 } }, { ratio: { min: 1.067, max: 1.25 }, breakpoints: { min: 768, max: 768 } }]) {
      const resolved = derive(inputs(type));
      const css = coreCss(resolved);
      const fallback = css.replace(/@supports [^\n]*\{\n:root \{[\s\S]*?\n\}\n\}\n/, '');
      assert.notEqual(fallback, css);
      assert.doesNotMatch(fallback, /pow\(/);
      const { min, max } = resolved['type-scale'].breakpoints;
      for (const width of [320, 390, 767, 768, 1024, 1440, 1920]) {
        const page = await browser.newPage({ viewport: { width, height: 600 } });
        await page.setContent(`<!doctype html><style>${css}</style>${body}`);
        const curve = await page.evaluate(read);
        await page.setContent(`<!doctype html><style>${fallback}</style>${body}`);
        const clamp = await page.evaluate(read);
        await page.close();
        for (const style of styles) {
          const { step, size } = resolved.type[style];
          near(curve[style], sizeAt(resolved['type-scale'], step, width), 0.05, `curve, ${style} at ${width} in ${JSON.stringify(type)}`);
          const share = width >= max ? 1 : width <= Math.min(min, max - 1) ? 0 : (width - min) / (max - min);
          near(clamp[style], size.min + (size.max - size.min) * share, 0.05, `fallback, ${style} at ${width} in ${JSON.stringify(type)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
});
