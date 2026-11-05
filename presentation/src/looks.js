// What the design tool's preview shows of each component page: every component once, in the page's order.
//
// A look is a way of looking at a component, chosen per use by whoever builds a page. It is no design setting:
// like Pictures and None it stays out of the design file and the history, and it lasts while the window is open.
// A look is [key, label, choices] and a choice is [value, word, tooltip]; the first choice is what shows at first.
// `name` stands over the component in the preview, and `title` over its choices when they concern only part of that.
//
// `specimens` names what the report already has, each with the look it is as a whole, if any. A specimen that holds
// several variations side by side marks each of them itself with `data-look="key:value"`, and whatever only the
// report needs with `data-report-only`. The report's own pages ignore both.
const COLOURS = {
  page: 'Page colour',
  tint: 'Tint',
  brand: 'Brand colour',
  inverse: 'Dark',
};
const colour = (surface, help) => [surface, COLOURS[surface], help];
const STATE_HELP = {
  default: 'At rest.',
  hover: 'With the pointer over it.',
  focus: 'With the keyboard on it.',
  active: 'While it is pressed.',
  disabled: 'When it cannot be used.',
};
// Only the states with a look of their own are offered: a choice that changes nothing would say something false.
const states = (...names) => names.map((name) => [name, name[0].toUpperCase() + name.slice(1), STATE_HELP[name]]);

export const TOOL_PAGES = {
  opening: [{ id: 'hero', name: 'Hero', specimens: { hero: '' } }],
  sections: [
    {
      id: 'band',
      name: 'Band',
      specimens: { band: '' },
      looks: [['band-colour', 'Colour', [
        colour('tint', 'A band in the tint, the quiet way to set a section apart.'),
        colour('brand', 'A band in the brand colour, with text and links that keep their contrast on it.'),
        colour('inverse', 'A dark band, for a clear ending or a strong break.'),
      ]]],
    },
    {
      id: 'text-image',
      name: 'Text and Image',
      specimens: { 'text-image': 'text-image-side:end', 'text-image-start': 'text-image-side:start' },
      looks: [['text-image-side', 'Picture', [
        ['end', 'Right', 'The picture stands to the right of the text.'],
        ['start', 'Left', 'The picture stands to the left of the text.'],
      ]]],
    },
    { id: 'cta-band', name: 'CTA Band and Key Figures', specimens: { 'cta-band': '' } },
  ],
  text: [
    { id: 'body-text', name: 'Body Text and Heading Group', specimens: { 'body-text': '' } },
    { id: 'reading-area', name: 'Reading Area and Table of Contents', specimens: { 'reading-area': '' } },
    {
      id: 'accordion',
      name: 'Accordion and Quotation',
      title: 'Accordion',
      specimens: { accordion: 'accordion-style:hairlines', 'accordion-more': 'accordion-style:boxes' },
      looks: [['accordion-style', 'Style', [
        ['hairlines', 'Hairlines', 'A thin line between the questions.'],
        ['boxes', 'Boxes', 'Each question in a box of its own.'],
      ]]],
    },
    {
      id: 'callout',
      name: 'Callout',
      specimens: { 'callout-more': '' },
      looks: [
        ['callout-status', 'Status', [
          ['info', 'Info', 'Something worth knowing before going on.'],
          ['success', 'Success', 'Something went as it should.'],
          ['warning', 'Warning', 'Something to check before it goes wrong.'],
          ['error', 'Error', 'Something went wrong and needs putting right.'],
        ]],
        ['callout-style', 'Style', [
          ['filled', 'Filled', 'The whole box takes the colour of its status.'],
          ['outlined', 'Outlined', 'Only the box\'s outline takes the colour of its status.'],
        ]],
      ],
    },
    {
      id: 'table',
      name: 'Table',
      specimens: { table: 'table-colour:page', 'table-more': 'table-colour:brand' },
      looks: [['table-colour', 'Colour', [
        colour('page', 'On the page colour, with plain rows.'),
        colour('brand', 'On the brand colour, with alternating rows.'),
      ]]],
    },
  ],
  buttons: [
    {
      id: 'buttons',
      name: 'Button',
      specimens: { buttons: '' },
      looks: [
        ['button-kind', 'Kind', [
          ['filled', 'Filled', 'The main action, in a solid colour.'],
          ['outline', 'Outline', 'An action beside the main one, with only an outline.'],
          ['arrow', 'Arrow', 'A link that leads on, with an arrow and no box.'],
        ]],
        ['button-state', 'State', states('default', 'hover', 'focus', 'active')],
        ['button-colour', 'Colour', [
          colour('page', 'On the page colour.'),
          colour('brand', 'On the brand colour.'),
        ]],
      ],
    },
    {
      id: 'button-default',
      name: 'Link Group',
      specimens: { 'button-default': '' },
      looks: [['group-colour', 'Colour', [
        colour('page', 'Related actions in a row, on the page colour.'),
        colour('brand', 'Related actions in a row, on the brand colour.'),
      ]]],
    },
    {
      id: 'links',
      name: 'Link',
      specimens: { links: '' },
      looks: [
        ['link-state', 'State', states('default', 'hover', 'focus')],
        ['link-colour', 'Colour', [
          colour('page', 'On the page colour.'),
          colour('tint', 'On the tint.'),
          colour('brand', 'On the brand colour.'),
          colour('inverse', 'On a dark background.'),
        ]],
      ],
    },
    { id: 'icon', name: 'Icon', specimens: { icon: '' } },
  ],
  cards: [
    {
      id: 'card',
      name: 'Card',
      specimens: { card: 'card-kind:link card-plate:plate', 'card-unplated': 'card-kind:link card-plate:none', 'card-person': 'card-kind:person' },
      looks: [
        ['card-kind', 'Kind', [
          ['link', 'Link', 'A linked summary: a picture, a heading and a short text.'],
          ['person', 'Person', 'A person: a portrait, a name and a role.'],
        ]],
        ['card-plate', 'Plate', [
          ['plate', 'On a plate', 'A padded plate of its own: raised for a link, tinted for a person.'],
          ['none', 'None', 'No plate: the card stands directly on what lies beneath it.'],
        ]],
      ],
    },
    { id: 'content-card', name: 'Content Card', specimens: { 'content-card': '' } },
    {
      id: 'card-grid',
      name: 'Card Grid',
      specimens: { 'card-grid': '' },
      looks: [['grid-columns', 'Columns', [
        ['2', '2', 'At most two columns. They step down when the grid\'s own width runs short.'],
        ['3', '3', 'At most three columns. They step down when the grid\'s own width runs short.'],
        ['4', '4', 'At most four columns. They step down when the grid\'s own width runs short.'],
      ]]],
    },
  ],
  media: [
    { id: 'figure', name: 'Figure and Video Player', specimens: { figure: '' } },
    {
      id: 'embed',
      name: 'Embed',
      specimens: { embed: '' },
      looks: [['embed-state', 'State', [
        ['consent', 'Before permission', 'Before a visitor allows the service: an explanation, and nothing is fetched from it.'],
        ['thumbnail', 'With a local picture', 'A picture of the site\'s own and a play button, which fetch nothing until pressed.'],
      ]]],
    },
  ],
  finding: [
    {
      id: 'content-loop',
      name: 'Content Loop and Content Row',
      title: 'Content Loop',
      specimens: { 'content-loop': '' },
      looks: [['loop-layout', 'Layout', [
        ['cards', 'Cards', 'The list as a grid of cards.'],
        ['rows', 'Rows', 'The list as rows, where a document has its file type and size.'],
      ]]],
    },
    {
      id: 'visitor-filters',
      name: 'Visitor Filters',
      specimens: { 'visitor-filters': 'filters-kind:filters', search: 'filters-kind:search' },
      looks: [['filters-kind', 'Kind', [
        ['filters', 'Filters', 'A search field, filter buttons and a select above the list they narrow down.'],
        ['search', 'Search results', 'The search results page: the query, how many it found, the list and the way through it.'],
      ]]],
    },
    { id: 'pagination', name: 'Pagination', specimens: { pagination: '' } },
  ],
  forms: [
    {
      id: 'form',
      name: 'Form',
      specimens: { form: 'form-sample:contact', 'form-brand': 'form-sample:brand', 'form-more': 'form-sample:more' },
      looks: [['form-sample', 'Sample', [
        ['contact', 'Contact', 'A short contact form on the page colour, with one field showing its error.'],
        ['brand', 'On brand colour', 'The same form on the brand colour, where text, fields and errors keep their contrast.'],
        ['more', 'More fields', 'The other kinds of field: phone, date, number, address, text area and choices.'],
      ]]],
    },
    {
      id: 'form-states',
      name: 'Field',
      specimens: { 'form-states': '' },
      looks: [['field-state', 'State', states('default', 'focus', 'disabled')]],
    },
    { id: 'consent-banner', name: 'Consent Banner', specimens: { 'consent-banner': '' } },
  ],
};

export const lookDefaults = () => Object.fromEntries(
  Object.values(TOOL_PAGES).flat().flatMap(({ looks = [] }) => looks).map(([key, , [[first]]]) => [key, first]),
);
// A variation shows when every look it is marked with has that value chosen.
export const lookShows = (mark, chosen) => mark.split(' ').every((pair) => {
  const [key, value] = pair.split(':');
  return chosen[key] === value;
});
