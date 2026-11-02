export const chapters = ['colour', 'typography', 'space', 'components'];

// A page can explain several small parts without losing catalogue coverage.
export const componentPages = [
  ['page', ['Page'], 'frame', 'fill'],
  ['band', ['Band'], 'frame', 'fill'],
  ['reading-area', ['Reading Area', 'Table of Contents'], 'frame', 'centre'],
  ['headers', ['Header'], 'frame', 'fill'],
  ['header-a-menu', ['Header'], 'frame', 'fill'],
  ['header-a-search', ['Header'], 'frame', 'fill'],
  ['footer', ['Footer'], 'frame', 'centre'],
  ['footer-simple', ['Footer'], 'frame', 'centre'],
  ['body-text', ['Body Text', 'Heading Group'], 'basics', 'centre'],
  ['buttons', ['Button and Link Group'], 'basics', 'centre'],
  ['links', ['Button and Link Group'], 'basics', 'centre'],
  ['icon', ['Icon'], 'basics', 'fill'],
  ['hero-picture', ['Hero'], 'bands', 'fill'],
  ['hero-plate', ['Hero'], 'bands', 'fill'],
  ['hero-typographic', ['Hero'], 'bands', 'fill'],
  ['hero-full-picture', ['Hero'], 'bands', 'fill'],
  ['text-image', ['Text and Image'], 'bands', 'fill'],
  ['text-image-start', ['Text and Image'], 'bands', 'fill'],
  ['cta-band', ['CTA Band', 'Key Figures'], 'bands', 'centre'],
  ['card', ['Card'], 'cards', 'centre'],
  ['card-unplated', ['Card'], 'cards', 'centre'],
  ['card-person', ['Card'], 'cards', 'centre'],
  ['content-card', ['Content Card and Content Row'], 'cards', 'centre'],
  ['card-grid', ['Card Grid'], 'cards', 'centre'],
  ['figure', ['Figure', 'Video Player'], 'media', 'centre'],
  ['embed', ['Embed'], 'media', 'centre'],
  ['table', ['Table'], 'content', 'centre'],
  ['accordion', ['Accordion', 'Quotation'], 'content', 'centre'],
  ['callout', ['Callout'], 'content', 'centre'],
  [
    'content-loop',
    ['Content Loop', 'Content Card and Content Row'],
    'finding',
    'centre',
  ],
  ['visitor-filters', ['Visitor Filters'], 'finding', 'top'],
  ['search', ['Visitor Filters'], 'finding', 'top'],
  ['breadcrumbs', ['Breadcrumb Navigation', 'Pagination'], 'finding', 'centre'],
  ['form', ['Form'], 'forms', 'centre'],
  ['form-brand', ['Form'], 'forms', 'centre'],
  ['form-more', ['Form'], 'forms', 'centre'],
  ['form-states', ['Form'], 'forms', 'centre'],
  ['consent-banner', ['Consent Banner'], 'forms', 'centre'],
  ['consent-settings', ['Consent Banner'], 'forms', 'centre'],
  ['consent-services', ['Consent Banner'], 'forms', 'centre'],
  ['responsive', ['Responsive layout'], 'frame', 'fill'],
];

export const ids = [
  'overview',
  'preview',
  'responsive-hero',
  'responsive-grid',
  'responsive-footer',
  ...componentPages.map(([id]) => id),
];

export function pageList(resolved) {
  const pages = [
    { id: 'cover' },
    { id: 'contents' },
    { id: 'overview', chapter: 'introduction' },
  ];
  function chapter(name, entries) {
    pages.push({ id: `chapter-${name}`, chapter: name, opener: true });
    pages.push(...entries.map((id) => ({ id, chapter: name })));
  }
  chapter('colour', [
    'brand-colours',
    'ramps',
    'surfaces-light',
    'surfaces-dark',
    'contrast-light',
    'contrast-dark',
  ]);
  chapter('typography', [
    'typefaces',
    ...[...new Set(Object.values(resolved.typefaces))].map(
      (_, index) => `typeface-${index}`,
    ),
    'type-scale',
    'type-comparison',
    'labels',
  ]);
  chapter('space', ['spacing', 'layout', 'corners', 'shadow']);
  chapter(
    'components',
    componentPages.map(([id]) => id),
  );
  pages.push({ id: 'next', chapter: 'next' });
  return pages.map((page, index) => {
    const entry = componentPages.find(([id]) => id === page.id);
    return {
      ...page,
      number: index + 1,
      catalog: entry?.[1] || [],
      group: entry?.[2],
      stage: entry?.[3] || 'fill',
    };
  });
}
