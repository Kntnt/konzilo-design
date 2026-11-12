// The page's context, which the design's directive components and post-list presentations read: what a component is
// not handed by the Konzilo core, which gives it only its attributes, its body and Astro's globals. A site's page
// template gives it once, in its frontmatter, before its <Body> renders:
//
//   import { designPage } from '@kntnt/konzilo-design/design-props';
//   designPage(Astro, { design, title: entry.data.title, breadcrumbs: await breadcrumbs(entry, Astro.url) });
//
// It is kept on Astro.locals, which reaches every component of the page, nested ones too. Astro renders sibling
// components in parallel, so nothing here passes state from one component to the next but the page's count of ids.
// Plain JavaScript with no dependency, so that the tests make a context without Astro.

const KEY = Symbol.for('@kntnt/konzilo-design/page');

// The words a page's parts write, in British English, each the site's own to give in its language (`words`).
export const WORDS = Object.freeze({
  // The trail's name for a screen reader.
  breadcrumb: 'Breadcrumb',
  // A table of contents' name, where its directive gives no label.
  contents: 'Contents',
  // A filtered list's search row: the field's label and its button.
  search: 'Search',
  // A filtered list's button where it has no search row, which the stylesheet hides.
  show: 'Show',
  // The noun for the posts a filtered list counts, where neither the core nor `types` names their type.
  posts: 'posts',
  // The legend of a filtered list's row of pills, by the taxonomy's name; another taxonomy's is its name.
  taxonomies: Object.freeze({ category: 'Category', topics: 'Topic', authors: 'Author' }),
  // What a filtered list says it shows: `count` posts on this page of `total`, `plural` the type's plural.
  count: (count, total, plural) => {
    const noun = plural.charAt(0).toLowerCase() + plural.slice(1);
    return total > count ? `Showing ${count} of ${total} ${noun}` : `Showing ${count} ${noun}`;
  },
});

/**
 * A page's context, as designPage() keeps it.
 * @param {object} options
 * @param {object} options.design The site's design file, its `resolved` and `project` read.
 * @param {string} [options.title] The post's title, which a hero draws as the page's H1.
 * @param {{ name: string, href: string, hidden?: boolean }[]} [options.breadcrumbs] The page's levels, as the core's
 *   breadcrumbs(entry, Astro.url) gives them: the start page first and the page itself last; none on the start page.
 * @param {string} [options.search] The site's search page, where a filtered list's search row sends its form.
 * @param {Record<string, { name: string, plural: string }>} [options.types] Each post type by its collection, for a
 *   filtered list where the core does not say what type it lists: its name, which a search sends, and its plural.
 * @param {object} [options.words] The site's words, over WORDS.
 * @param {(message: string) => void} [options.warn] Where a part says what it could not draw as written; the console's
 *   warnings by default, which a build prints.
 */
export function pageContext({ design, title, breadcrumbs = [], search, types = {}, words = {}, warn } = {}) {
  if (!design?.resolved || !design?.project) throw new TypeError('designPage() needs the site\'s design file as `design`, with its resolved values and its project.');
  const counts = new Map();
  return {
    design,
    title,
    breadcrumbs,
    search,
    types,
    words: { ...WORDS, ...words, taxonomies: { ...WORDS.taxonomies, ...words.taxonomies } },
    // The Surface of the band around a part, for a part drawn from a tree within it; the page's at the top.
    ground: undefined,
    // An id unique on the page: <prefix>-<n>.
    id(prefix) {
      const next = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, next);
      return `${prefix}-${next}`;
    },
    warn: warn ?? ((message) => console.warn(`@kntnt/konzilo-design: ${message}`)),
  };
}

/**
 * Gives the page its context, for the design's components and presentations to read. Called by a site's page
 * template in its frontmatter, before it renders the body.
 * @param {object} Astro The template's Astro global.
 * @param {object} options As pageContext() takes them.
 */
export function designPage(Astro, options) {
  if (!Astro?.locals) throw new TypeError('designPage(Astro, { … }) takes the template\'s Astro global first.');
  Astro.locals[KEY] = pageContext(options);
  return Astro.locals[KEY];
}

/**
 * The page's context, for a component of the design's. Throws where the page's template gave none, since a part
 * drawn without it would lack the post's title, the trail and the site's words unseen.
 * @param {object} Astro The component's Astro global.
 */
export function contextOf(Astro) {
  const found = Astro?.locals?.[KEY];
  if (!found) {
    throw new Error('@kntnt/konzilo-design: a directive or a post list was rendered on a page whose template did not call designPage(Astro, { design, title, breadcrumbs }) before its <Body>. Call it in the frontmatter of every template that renders a body or a presentation.');
  }
  return found;
}
