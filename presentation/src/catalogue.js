// What the design tool's preview shows on each component page, in a document of its own per page. Each section holds
// one or two of the page's components, as `componentPages` in catalog.js lists them and in that order, and is named
// for them, so the panel's list and the preview's sections say the same. In it stands every variant a site chooses per
// use, side by side and named, for nothing here is a design setting: the panel holds only what the design file saves.
//
// A specimen is [id, caption]. The caption names the variant the whole specimen is. A specimen that holds several
// variants names each of them itself, where the catalogue renders it (`catalogue` in src/specimens/).
export const CATALOGUE = {
  opening: [{ components: ['Hero'], specimens: [['hero']] }],
  sections: [
    { components: ['Band'], specimens: [['band']] },
    { components: ['Text and Image'], specimens: [['text-image', 'Picture right'], ['text-image-start', 'Picture left']] },
    { components: ['CTA Band', 'Key Figures'], specimens: [['cta-band']] },
  ],
  text: [
    { components: ['Body Text', 'Heading Group'], specimens: [['body-text']] },
    { components: ['Reading Area', 'Table of Contents'], specimens: [['reading-area']] },
    { components: ['Accordion'], specimens: [['accordion', 'Hairlines'], ['accordion-more', 'Boxes']] },
    { components: ['Quotation'], specimens: [['quotation']] },
    { components: ['Callout'], specimens: [['callout-more']] },
    { components: ['Table'], specimens: [['table', 'Plain rows · On the page colour'], ['table-more', 'Alternating rows · On the brand colour']] },
  ],
  buttons: [
    { components: ['Button and Link Group'], specimens: [['buttons'], ['button-default']] },
    { components: ['Link'], specimens: [['links']] },
    { components: ['Icon'], specimens: [['icon']] },
  ],
  cards: [
    { components: ['Card'], specimens: [['card']] },
    { components: ['Content Card and Content Row'], specimens: [['content-card', 'Content Card'], ['content-row', 'Content Row']] },
    { components: ['Card Grid'], specimens: [['card-grid']] },
  ],
  media: [
    { components: ['Figure', 'Video Player'], specimens: [['figure']] },
    { components: ['Embed'], specimens: [['embed']] },
  ],
  finding: [
    { components: ['Content Loop'], specimens: [['content-loop']] },
    { components: ['Visitor Filters'], specimens: [['visitor-filters', 'Filters'], ['search', 'Search results']] },
    { components: ['Pagination'], specimens: [['pagination']] },
  ],
  forms: [
    { components: ['Form'], specimens: [['form', 'Contact · On the page colour'], ['form-brand', 'Contact · On the brand colour'], ['form-more', 'More fields']] },
    { components: ['Field'], specimens: [['form-states']] },
    { components: ['Consent Banner'], specimens: [['consent-banner']] },
  ],
};

export const sectionName = ({ components }) => components.join(' and ');
export const sectionId = (section) => sectionName(section).toLowerCase().replaceAll(' ', '-');
// Where the tool finds a page's own document.
export const cataloguePath = (page) => `/catalogue/${page}.html`;
