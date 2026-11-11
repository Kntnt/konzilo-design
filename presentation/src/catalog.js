// Each page of the report: its id, the components on it, its specimens and those behind its disclosure. The design tool
// lists the same components, in the same order, and its preview shows each in a section named for it (catalogue.js).
export const componentPages = [
  ['header', ['Header'], ['header-a-menu'], []],
  ['footer', ['Footer'], ['footer'], []],
  ['page', ['Page'], ['page-layout', 'preview'], []],
  ['breadcrumbs', ['Breadcrumb Navigation'], ['breadcrumbs'], []],
  ['opening', ['Hero'], ['hero'], []],
  ['sections', ['Band', 'Text and Image', 'CTA Band', 'Key Figures'], ['band', 'text-image', 'cta-band'], ['text-image-start']],
  ['text', ['Body Text', 'Heading Group', 'Reading Area', 'Table of Contents', 'Accordion', 'Quotation', 'Callout', 'Table'], ['body-text', 'reading-area', 'accordion', 'quotation', 'callout', 'table'], ['callout-more', 'accordion-more', 'table-more']],
  ['buttons', ['Button and Link Group', 'Link', 'Icon'], ['button-default', 'icon'], ['buttons', 'links']],
  ['cards', ['Card', 'Content Card and Content Row', 'Card Grid'], ['card', 'card-person', 'content-card'], ['card-unplated', 'card-grid']],
  ['media', ['Figure', 'Video Player', 'Embed'], ['figure', 'embed'], []],
  ['finding', ['Content Loop', 'Visitor Filters', 'Pagination'], ['content-loop', 'visitor-filters', 'search', 'pagination'], []],
  ['forms', ['Form', 'Field', 'Consent Banner'], ['form', 'consent-banner'], ['form-more', 'form-states', 'form-brand']],
];

// What frames every page comes first, and then what can stand on one.
export const FRAME_PAGES = ['header', 'footer', 'page', 'breadcrumbs'];

// The Shadow page's scenes, one for each shadow a site shows, named for it: `specimens/Shadow.astro`.
export const SHADOW_SCENES = ['header', 'panel', 'page', 'box', 'box-lifted'];

export const ids = [...new Set([
  'preview',
  'article',
  'space-section',
  ...SHADOW_SCENES.map((name) => `shadow-${name}`),
  ...componentPages.flatMap(([, , defaults, variants]) => [...defaults, ...variants]),
])];

export function pageList() {
  const groups = [
    ['start', ['start']],
    ['colour', ['colour-scale', 'colour-together']],
    ['typography', ['main-typeface', 'type-scale', 'other-typefaces', 'typography-use']],
    ['space', ['space', 'corners', 'shadow']],
    ['frame', FRAME_PAGES],
    ['components', componentPages.map(([id]) => id).filter((id) => !FRAME_PAGES.includes(id))],
    ['details', ['details']],
    ['comments', ['comments']],
  ];
  return groups.flatMap(([chapter, entries]) => entries.map((id) => ({
    id,
    chapter,
    catalog: componentPages.find(([name]) => name === id)?.[1] || [],
  })));
}
