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
export function pictures(ramps) {
  const primary = ramps.primary;
  const gray = ramps.gray;
  function composition(width, height, index, portrait = false) {
    const h = (height / width) * 1000;
    // Plane closures sit well outside the crop; enclosed accents have generous clearance.
    const shapes = [
      `<path d="M-300 ${h + 300}V${h * 0.65}Q400 ${-h * 0.15} 1300 ${h * 0.35}V${h + 300}Z" fill="${primary[200]}"/>
        <path d="M-300 ${h + 300}V${h * 0.95}Q500 ${h * 0.35} 1300 ${h * 0.7}V${h + 300}Z" fill="${gray[200]}"/>`,
      `<path d="M-300 ${h * 0.6}L1300 ${-h * 0.2}V${h + 300}H-300Z" fill="${gray[200]}"/>
        <path d="M-300 ${h * 1.1}L1300 ${h * 0.3}V${h + 300}H-300Z" fill="${primary[200]}"/>
        <circle cx="720" cy="${h * 0.28}" r="24" fill="${primary[500]}"/>`,
      `<path d="M-300 -300H360Q900 ${h * 0.5} 360 ${h + 300}H-300Z" fill="${primary[200]}"/>
        <path d="M1300 -300H1100Q400 ${h * 0.5} 1100 ${h + 300}H1300Z" fill="${gray[200]}"/>`,
      `<path d="M-300 ${h + 300}V${h * 0.4}Q350 ${h * 0.05} 1300 ${h * 0.6}V${h + 300}Z" fill="${gray[200]}"/>
        <path d="M-300 ${h + 300}V${h * 0.8}Q600 ${h * 0.25} 1300 ${h * 0.9}V${h + 300}Z" fill="${primary[300]}"/>`,
    ];
    const silhouette = portrait
      ? person(h, [500, 470, 530, 490][index], [0.42, 0.4, 0.44, 0.41][index])
      : shapes[index];
    return svg(width, height, primary[100], silhouette);
  }
  function person(h, x, y) {
    const shoulders = h * (y + 0.22);
    return `<circle cx="${x}" cy="${h * y}" r="${h * 0.12}" fill="${primary[200]}"/>
      <path d="M${x - 300} ${h + 60}C${x - 300} ${shoulders + h * 0.14} ${x - 170} ${shoulders} ${x} ${shoulders}S${x + 300} ${shoulders + h * 0.14} ${x + 300} ${h + 60}Z" fill="${primary[200]}"/>`;
  }
  function svg(width, height, background, shapes) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 ${(height / width) * 1000}"><rect width="1000" height="${(height / width) * 1000}" fill="${background}"/>${shapes}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  const landscapes = Array.from({ length: 4 }, (_, index) =>
    composition(1200, 720, index),
  );
  const portraits = Array.from({ length: 4 }, (_, index) =>
    composition(600, 800, index),
  );
  const people = Array.from({ length: 4 }, (_, index) =>
    composition(600, 640, index, true),
  );
  return {
    dark: svg(
      1440,
      562,
      primary[950],
      `<path d="M-300 -300H300Q850 200 300 700H-300Z" fill="${gray[900]}"/>
        <path d="M1740 -300H1000Q650 200 1000 700H1740Z" fill="${primary[900]}"/>
        <path d="M1740 -300H1450Q950 200 1450 700H1740Z" fill="${primary[800]}"/>`,
    ),
    panorama: composition(1200, 400, 2),
    landscape: landscapes[0],
    portrait: portraits[0],
    landscapes,
    portraits,
    people,
  };
}
export const menu = [
  {
    label: 'Services',
    href: '#services',
    children: [
      {
        label: 'Planning',
        href: '#planning',
        description: 'A practical route forward',
      },
      {
        label: 'Support',
        href: '#support',
        description: 'Help when you need it',
      },
    ],
  },
  {
    label: 'Resources',
    href: '#resources',
    children: [
      { label: 'Guides', href: '#guides' },
      { label: 'Reports', href: '#reports' },
    ],
  },
  {
    label: 'About',
    href: '#about',
    children: [
      { label: 'Our approach', href: '#approach' },
      { label: 'Contact', href: '#contact' },
    ],
  },
];
menu[0].children.push(
  {
    label: 'Delivery',
    href: '#delivery',
    description: 'Keep responsibilities and dates clear',
  },
  {
    label: 'Review',
    href: '#review',
    description: 'Check the work against the agreed plan',
  },
);
menu[1].children.push(
  {
    label: 'Notes',
    href: '#notes',
    description: 'Short answers to common questions',
  },
  {
    label: 'Downloads',
    href: '#downloads',
    description: 'Useful documents in one place',
  },
);
menu[2].children.push(
  {
    label: 'The team',
    href: '#team',
    description: 'The people who do the work',
  },
  {
    label: 'Questions',
    href: '#questions',
    description: 'What to expect before you begin',
  },
);
export const search = {
  action: '#search',
  label: 'Search resources',
  links: [
    { label: 'Services', href: '#services' },
    { label: 'Contact', href: '#contact' },
  ],
};
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
export const footerBands = (project, variant = 'standard') => {
  const logo = project['logo-dark'] || project.logo;
  const escaped = project.name.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
  const identity = logo
    ? `<img src="${logo.replaceAll('"', '&quot;')}" alt="${escaped}" style="max-width:14rem;max-height:3rem">`
    : `<p data-kn-type="heading-3">${escaped}</p>`;
  const first = {
    surface: 'brand',
    cells: [
      { id: 'identity', column: 'A', content: identity },
      {
        id: 'links',
        column: 'B',
        links: [
          { label: 'Services', href: '#services' },
          { label: 'Contact', href: '#contact' },
        ],
      },
    ],
  };
  if (variant === 'simple') return [first];
  first.cells[0].rows = 2;
  first.cells[1].heading = 'Explore';
  first.cells[1].links.push(
    { label: 'Resources', href: '#resources' },
    { label: 'About', href: '#about' },
  );
  return [
    first,
    {
      surface: 'brand',
      cells: [
        {
          id: 'contact',
          column: 'B',
          heading: 'Contact the team',
          text: 'Ask about planning, delivery or ongoing support.',
          links: [{ label: 'Start a conversation', href: '#contact' }],
        },
      ],
    },
    {
      surface: 'inverse',
      compact: true,
      cells: [
        {
          id: 'legal',
          column: 'A',
          text: 'Clear information. Practical next steps.',
        },
        {
          id: 'privacy',
          column: 'B',
          links: [
            { label: 'Privacy', href: '#privacy' },
            { label: 'Cookie choices', href: '#cookies', consentOpen: true },
          ],
        },
      ],
    },
  ];
};
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
