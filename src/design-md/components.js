// What the design system has, for the file an AI agent reads. An agent builds pages from these and
// from nothing else, so each line says what the component is for.
export const COMPONENT_GROUPS = [
  ['The frame', [
    ['Page', 'The whole page, with the header above and the footer below. Its main content is a vertical sequence of Bands, nothing else.'],
    ['Header', 'The site header: identity, navigation, a menu button with a responsive megamenu, and a search icon that opens a search panel. Arrangements A, B and C; sticky or static; its items give way as the window narrows.'],
    ['Footer', 'One to several bands of cells: links, text, contact and legal lines. It can sit in the flow or be revealed under the page as it scrolls.'],
    ['Band', 'One section of a page. It runs edge to edge, owns its vertical space, may have a Surface of its own, and keeps its content inside the content area.'],
    ['Reading Area', 'Long text in the Narrow measure, optionally with an Aside for a table of contents, sidenotes and the like.'],
  ]],
  ['Basics', [
    ['Body Text', 'Headings, paragraphs, lists and links, wherever they stand.'],
    ['Heading Group', 'An eyebrow, a heading and a deck, at any heading level.'],
    ['Button and Link Group', 'A filled button, an unfilled button and an arrow link, alone or several in a row.'],
    ['Icon', 'A one-colour icon that follows the text colour.'],
  ]],
  ['Bands', [
    ['Hero', 'The page\'s opening. Three kinds: with a picture, on a coloured Surface, or typographic only. Only the typographic kind uses the display style; the others use the first heading style.'],
    ['Text and Image', 'Text on one side and an image on the other, either way round.'],
    ['CTA Band', 'A heading, a short text and a button, often last on the page.'],
    ['Key Figures', 'A few large numbers with explanations.'],
  ]],
  ['Cards', [
    ['Card', 'A picture or icon, heading, text and link. Variants: link and person. It can sit on any Surface.'],
    ['Content Card and Content Row', 'Article teasers with picture, metadata, heading, text and an optional separate call to action, as cards or rows.'],
    ['Card Grid', 'Lays out cards in two to four columns that break on narrow screens.'],
  ]],
  ['Media', [
    ['Figure', 'An image with or without a caption, at every width from Narrow to edge to edge.'],
    ['Video Player', 'A video file of the site\'s own, with controls, a poster and captions.'],
    ['Embed', 'Content from YouTube, Vimeo, Screen9, Loom, Spotify, Acast, Apple Podcasts, Speaker Deck, Datawrapper, CodePen and LinkedIn, behind consent.'],
  ]],
  ['Content', [
    ['Table', 'A header row, a caption, column alignment and alternating rows, with aligned digits.'],
    ['Accordion', 'Headings that fold out. A FAQ is this component with questions and answers.'],
    ['Quotation', 'A prominent quotation with name and title.'],
    ['Callout', 'A marked box in the text: information, warning, success or error.'],
  ]],
  ['Finding content', [
    ['Content Loop', 'Articles, child pages or documents as cards or rows. A document row has file type and size.'],
    ['Visitor Filters', 'A search field, filter buttons, a select and pagination above a list, and the search results page.'],
    ['Breadcrumb Navigation', 'The page\'s place in the site.'],
    ['Table of Contents', 'Links to the page\'s headings, in the Aside or in the text.'],
  ]],
  ['Forms and consent', [
    ['Form', 'Fields, text areas, selects, checkboxes, radio buttons and error messages: enough for contact and subscription.'],
    ['Consent Banner', 'The consent box and its settings.'],
  ]],
];

// Deliberately left out of the design system, so an agent should not invent them.
export const NOT_COMPONENTS = ['a gallery with a lightbox', 'a map', 'an audio player for own files', 'tabs', 'a slider or carousel', 'a marquee', 'a timeline', 'a bento grid'];
