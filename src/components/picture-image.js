// A band's picture as its --kn-picture-image, the one inline style a band writes (directives.md, Rules for every
// directive). A browser reads a relative address in a custom property from the folder of the stylesheet that uses it,
// not from the page's, in Chromium, Gecko and WebKit alike, so a relative address would load nothing there. Band, the
// hero directive and an article's opening all write it here, and refuse a relative address rather than guess what it
// meant: a template's mistake stops the build, as a hero without its page's title does (the assistant's choice,
// 2026-11-25, issue #21).

// From the site's root, `//` a host's too, or whole, with its scheme, such as `https:`, `data:` or `blob:`.
const ROOTED = /^(?:\/|[a-z][a-z\d+.-]*:)/i;

/**
 * The value of a band's --kn-picture-image for its picture's address.
 * @param {string} address From the site's root, such as `/media/hero.webp`, or whole, with its scheme.
 * @throws {Error} For a relative address, naming it.
 */
export function pictureImage(address) {
  const value = String(address);
  if (!ROOTED.test(value.trim())) {
    throw new Error(`A band's picture is an address from the site's root, such as /media/hero.webp, or a whole one, with its scheme, not ${value}: a browser reads a relative address in a style from the folder of the stylesheet that uses it.`);
  }
  return `url(${JSON.stringify(value)})`;
}
