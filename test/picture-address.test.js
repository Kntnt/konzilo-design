// What address a band's picture takes (directives.md, Rules for every directive; konzilo.md, A band's picture). A
// picture behind is the band's --kn-picture-image, written in its style, and a browser reads a relative address there
// from the folder of the stylesheet that uses it, not from the page's, so every writer of it refuses one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'ultrahtml';
import { querySelector as one } from 'ultrahtml/selector';
import { render } from './helpers/render.js';
import { renderMarkdown, testDesign } from './helpers/konzilo-body.js';
import { pageContext } from '../src/directives/render/context.js';
import { articleOpening } from '../src/page-parts/parts.js';

// Addresses a browser reads the same from the page and from a stylesheet.
const KEPT = ['/media/beds.webp', '/_astro/beds.D3x9.webp?v=2', '//cdn.example.com/beds.webp', 'https://example.com/beds.webp', 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E', 'blob:http://localhost/0f3a'];
// Addresses read from the stylesheet's folder, never the page's.
const RELATIVE = ['media/beds.webp', './media/beds.webp', '../media/beds.webp', 'beds.webp', '?v=2', '#beds'];
const REFUSAL = /A band's picture is an address from the site's root, such as \/media\/hero\.webp, or a whole one, with its scheme, not (.+): a browser reads a relative address in a style from the folder of the stylesheet that uses it\./;

const band = async (picture) => one(parse(await render('Band', { picture })), 'section');
// An attribute's value as a browser reads it.
const decoded = (value) => value?.replaceAll('&quot;', '"').replaceAll('&amp;', '&');

test('a band writes a picture from the site\'s root or a whole one into its style and refuses a relative one', async () => {
  for (const address of KEPT) assert.equal(decoded((await band(address)).attributes.style), `--kn-picture-image:url(${JSON.stringify(address)})`, address);
  for (const address of RELATIVE) {
    await assert.rejects(band(address), (error) => {
      assert.match(error.message, REFUSAL, address);
      assert.equal(error.message.match(REFUSAL)[1], address);
      return true;
    });
  }
  assert.doesNotMatch((await band(undefined)).attributes.style ?? '', /--kn-picture-image/, 'a band without a picture writes none');
});

test('an opening drawn from its directive with its picture behind refuses a relative address, and beside it keeps it', () => {
  const opening = (address, picture) => renderMarkdown(`::::hero\n\nStart small.\n\n![Raised beds](${address})\n\n::::`, { design: testDesign({ hero: { picture } }) });
  for (const address of KEPT) {
    assert.ok(opening(address, 'behind').includes(`--kn-picture-image:url(${JSON.stringify(address).replaceAll('"', '&quot;')})`), address);
  }
  for (const address of RELATIVE) {
    assert.throws(() => opening(address, 'behind'), (error) => error.message.match(REFUSAL)?.[1] === address, address);
    // Beside the text it is an <img>, which a browser reads from the page.
    assert.match(opening(address, 'end'), /<div class="kn-hero-media"><img src="[^"]+"/, address);
  }
});

test('an article\'s opening with its main image behind refuses a relative address, and beside it keeps it', () => {
  const opening = (src, picture) => articleOpening(pageContext({ design: testDesign({ hero: { picture } }), title: 'Know your soil', warn: () => {} }), { picture: { src, alt: 'A spade in soil' } });
  for (const address of KEPT) assert.ok(opening(address, 'behind').includes(`--kn-picture-image:url(${JSON.stringify(address).replaceAll('"', '&quot;')})`), address);
  for (const address of RELATIVE) {
    assert.throws(() => opening(address, 'behind'), (error) => error.message.match(REFUSAL)?.[1] === address, address);
    assert.match(opening(address, 'end'), /<div class="kn-hero-media"><img src="[^"]+"/, address);
  }
});
