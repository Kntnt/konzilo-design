// Generic business examples. Identity is supplied by the design file at build time.
export const sample = {
  eyebrow: 'A clear direction',
  heading: 'Make the next step clear',
  deck: 'Practical support, useful information and a straightforward way to get started.',
  paragraph:
    'Good decisions begin with clear information. We explain the options, agree on a practical plan and keep you informed as the work moves forward.',
  action: 'Get started',
  secondary: 'Explore services',
  link: 'Read the guide',
};
// The places a sample page has a picture. A design's own photo can take any of them.
export const PICTURE_SLOTS = [
  'hero',
  'panorama',
  'landscape-1',
  'landscape-2',
  'landscape-3',
  'landscape-4',
  'person-1',
  'person-2',
  'person-3',
  'person-4',
];
// What a build leaves in its pages; the report swaps it for the one embedded copy of the picture.
export const PICTURE_URL = /\/(?:presentation\/pictures|design-pictures)\/[a-z0-9-]+\.[a-z0-9]+/g;
// Photos where a picture shows best. People stay drawn until a design has its own photos of them,
// because a stock licence clears no one's face.
export function pictures(ramps, own = {}) {
  const photo = (slot) => own[slot] ?? `/presentation/pictures/${slot}.webp`;
  const fill = ramps.primary[200];
  function person(index) {
    const h = (640 / 600) * 1000;
    const x = [500, 470, 530, 490][index];
    const y = [0.42, 0.4, 0.44, 0.41][index];
    const shoulders = h * (y + 0.22);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="640" viewBox="0 0 1000 ${h}"><rect width="1000" height="${h}" fill="${ramps.primary[100]}"/><circle cx="${x}" cy="${h * y}" r="${h * 0.12}" fill="${fill}"/>
      <path d="M${x - 300} ${h + 60}C${x - 300} ${shoulders + h * 0.14} ${x - 170} ${shoulders} ${x} ${shoulders}S${x + 300} ${shoulders + h * 0.14} ${x + 300} ${h + 60}Z" fill="${fill}"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  return {
    hero: photo('hero'),
    panorama: photo('panorama'),
    landscapes: [1, 2, 3, 4].map((number) => photo(`landscape-${number}`)),
    people: [0, 1, 2, 3].map((index) => own[`person-${index + 1}`] ?? person(index)),
  };
}
// A site's menu at a typical size. The link menu shows the first three, and the menu button all of them.
const page = (label, description) => ({ label, href: `#${label.toLowerCase().replaceAll(' ', '-')}`, ...(description && { description }) });
export const menu = [
  { ...page('Products'), children: [page('Compact series', 'For where space is short'), page('Modular series', 'Built to grow with the need'), page('Accessories', 'What completes the set'), page('Spare parts', 'Kept in stock and sent at once')] },
  { ...page('Services'), children: [page('Planning', 'A practical route forward'), page('Delivery', 'Keep responsibilities and dates clear'), page('Review', 'Check the work against the agreed plan'), page('Support', 'Help when you need it')] },
  { ...page('Markets'), children: [page('Healthcare', 'Where reliability comes first'), page('Education', 'For schools and universities'), page('Transport', 'From depots to the open road'), page('Public sector', 'Under public procurement rules')] },
  { ...page('Technology'), linkMenu: false, children: [page('Design'), page('Benefits'), page('Specifications'), page('Patents')] },
  { ...page('Knowledge'), linkMenu: false },
  { ...page('About'), linkMenu: false, children: [page('About us'), page('Career'), page('History'), page('Board of directors'), page('Management team'), page('Contact us')] },
];
export const search = {
  action: '#search',
  label: 'Search resources',
  // The word an empty field shows, where the design shows one.
  word: 'Search',
  links: [
    { label: 'Services', href: '#services' },
    { label: 'Contact', href: '#contact' },
  ],
};
export const languages = [
  { label: 'English', code: 'en', href: '#home', current: true },
  { label: 'Svenska', code: 'sv', href: '#home' },
  { label: 'Deutsch', code: 'de', href: '#home' },
];
export const cta = { label: 'Contact', href: '#contact' };
export const columns = [
  { label: 'Service' },
  { label: 'Delivery' },
  { label: 'Hours', numeric: true },
];
export const rows = [
  ['Planning', 'Initial review', '12'],
  ['Implementation', 'Agreed milestones', '48'],
  ['Support', 'Monthly review', '8'],
];
export const questions = [
  {
    question: 'How do we begin?',
    answer:
      '<p>Send a short description of what you need. We will agree on a useful first step.</p>',
  },
  {
    question: 'What happens after the review?',
    answer: '<p>You receive a clear plan with responsibilities and dates.</p>',
  },
];
export const headings = [
  { depth: 2, slug: 'planning', text: 'Plan the work' },
  { depth: 3, slug: 'review', text: 'Review the options' },
  { depth: 2, slug: 'delivery', text: 'Agree on delivery' },
];
export const fields = [
  {
    name: 'name',
    label: 'Full name',
    help: 'The name we should use.',
    required: true,
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email address',
    value: 'incomplete',
    error: 'Enter a complete email address.',
    required: true,
  },
  {
    name: 'service',
    type: 'select',
    label: 'Service',
    options: [
      { value: '', label: 'Choose a service' },
      { value: 'planning', label: 'Planning' },
    ],
  },
  { name: 'message', type: 'textarea', rows: 3, label: 'How can we help?' },
  {
    name: 'reply',
    type: 'radio',
    label: 'Preferred reply',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
    ],
  },
  {
    name: 'updates',
    type: 'checkbox',
    label: 'Updates',
    options: [{ value: 'yes', label: 'Send occasional updates' }],
  },
];
export const consentTexts = {
  title: 'Your cookie choices',
  description:
    'Necessary storage remembers your choice. Optional external content stays off until you accept it. You can change or withdraw your choice at any time.',
  acceptAll: 'Accept all',
  rejectAll: 'Reject optional',
  settings: 'Customise choices',
  settingsTitle: 'Cookie settings',
  settingsDescription: 'Choose which optional services may run.',
  save: 'Save choices',
  close: 'Close settings',
  required: 'Always on',
};
export const categories = [
  {
    id: 'necessary',
    label: 'Necessary',
    required: true,
    description: 'Remembers your cookie choice.',
    services: [
      {
        name: 'kn-consent',
        provider: 'This website',
        thirdParty: false,
        purpose: 'Remember your choice; no sharing',
        storage: '182 days',
        data: 'Choice and date',
      },
    ],
  },
  {
    id: 'external-media',
    label: 'External content',
    description:
      'Allows external media. Your IP address is sent to the media provider. This offline specimen loads no external service.',
    services: [
      {
        name: 'Media player',
        provider: 'External media service',
        thirdParty: true,
        purpose: 'Play requested media; connection data sent to the provider',
        storage: 'This visit',
        data: 'IP address and player choices',
      },
      {
        name: 'Media preferences',
        provider: 'External media service',
        thirdParty: true,
        purpose: 'Remember playback choices; shared with the media provider',
        storage: '30 days',
        data: 'Volume and playback preferences',
      },
    ],
  },
];
export const items = (landscapes) =>
  [
    'A practical starting point',
    'A plan you can follow',
    'Support for the next stage',
  ].map((title, index) => ({
    title,
    href: '#resources',
    picture: {
      src: Array.isArray(landscapes)
        ? landscapes[index % landscapes.length]
        : landscapes,
      alt: '',
    },
    text: 'Clear advice to help you make a confident decision.',
    meta1: [{ text: 'Guides', pill: true }],
    meta2: [{ text: 'Service team' }],
    filters: { topic: 'guides' },
  }));
// Every sample picture in one list, in the order of PICTURE_SLOTS, so one design's can replace another's.
export const flatPictures = (set) => Object.values(set).flat();
