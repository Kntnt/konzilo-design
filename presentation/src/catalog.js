export const componentPages = [
  ['header', ['Header'], ['header-a-menu'], ['headers']],
  ['footer', ['Footer'], ['footer'], ['footer-simple']],
  ['page', ['Page'], ['preview'], []],
  ['opening', ['Hero'], ['hero-picture'], ['hero-plate', 'hero-typographic', 'hero-full-picture']],
  ['sections', ['Band', 'Text and Image', 'CTA Band', 'Key Figures'], ['band', 'text-image', 'cta-band'], ['text-image-start']],
  ['text', ['Body Text', 'Heading Group', 'Reading Area', 'Table of Contents', 'Quotation', 'Callout', 'Accordion', 'Table'], ['body-text', 'reading-area', 'accordion', 'callout', 'table'], ['callout-more', 'accordion-more', 'table-more']],
  ['buttons', ['Button and Link Group', 'Icon'], ['button-default', 'icon'], ['buttons', 'links']],
  ['cards', ['Card', 'Content Card and Content Row', 'Card Grid'], ['card', 'card-person', 'content-card'], ['card-unplated', 'card-grid']],
  ['media', ['Figure', 'Video Player', 'Embed'], ['figure', 'embed'], []],
  ['finding', ['Content Loop', 'Visitor Filters', 'Breadcrumb Navigation', 'Pagination'], ['content-loop', 'visitor-filters', 'search', 'breadcrumbs'], []],
  ['forms', ['Form', 'Consent Banner'], ['form', 'consent-banner'], ['form-more', 'form-states', 'form-brand']],
];

export const ids = [...new Set([
  'preview',
  'article',
  'space-section',
  ...componentPages.flatMap(([, , defaults, variants]) => [...defaults, ...variants]),
])];

export function pageList() {
  const groups = [
    ['start', ['start']],
    ['colour', ['colour-scale', 'colour-together']],
    ['typography', ['main-typeface', 'type-scale', 'other-typefaces', 'typography-use']],
    ['space', ['space', 'corners', 'shadow']],
    ['components', componentPages.map(([id]) => id)],
    ['details', ['details']],
    ['comments', ['comments']],
  ];
  return groups.flatMap(([chapter, entries]) => entries.map((id) => ({
    id,
    chapter,
    catalog: componentPages.find(([name]) => name === id)?.[1] || [],
  })));
}
