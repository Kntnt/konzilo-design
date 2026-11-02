import example from '../../examples/example.design.json';

const systemMonospace = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const systemSerif = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
const monaSans = '"Mona Sans", system-ui, sans-serif';
const redHatMono = `"Red Hat Mono", ${systemMonospace}`;

// The gallery opens as the tool will: Mona Sans throughout, and the system's monospace until
// someone deliberately chooses one. The library's own default stays the system stacks.
export const typefaceChoices = {
  main: [
    { label: 'Mona Sans', value: monaSans },
    { label: 'System sans-serif', value: 'system-ui, sans-serif' },
    { label: 'System serif', value: systemSerif },
  ],
  heading: [
    { label: 'As main typeface', value: '' },
    { label: 'Mona Sans', value: monaSans },
    { label: 'System sans-serif', value: 'system-ui, sans-serif' },
    { label: 'System serif', value: systemSerif },
  ],
  monospace: [
    { label: 'System mono', value: systemMonospace },
    { label: 'Red Hat Mono', value: redHatMono },
  ],
};
export const galleryInputs = {
  ...example.inputs,
  typefaces: { main: monaSans, monospace: systemMonospace },
};

// Each example sets its whole chain, because a role follows another only where it is declared.
const chain = ({ main = monaSans, heading = main, headingOne = heading, display = heading, label = main, colour }) => [
  `--kn-typeface-main: ${main}`, `--kn-typeface-heading: ${heading}`, `--kn-typeface-heading-1: ${headingOne}`,
  `--kn-typeface-display: ${display}`, `--kn-typeface-label: ${label}`, `--kn-typeface-monospace: ${redHatMono}`,
  ...(label === main ? [] : ['--kn-type-label-weight: 500', '--kn-type-label-letter-spacing: 0.04em']),
  ...(colour ? [`--kn-text-heading-1: ${colour}`] : []),
].join('; ');
export const typefaceCases = [
  { name: 'One typeface throughout', how: 'typefaces.main', style: chain({}), note: 'The norm.' },
  { name: 'Serif text, sans-serif headings', how: 'typefaces.main + typefaces.heading', style: chain({ main: systemSerif, heading: monaSans }), note: 'For some clients.' },
  { name: 'A display face for large text', how: 'typefaces.display', style: chain({ display: systemSerif }), note: 'Only the display style changes.' },
  { name: 'Labels in a chosen monospace', how: 'typefaces.monospace + type.label', style: chain({ label: redHatMono }), note: 'A deliberate choice, as is a site with much code.' },
  { name: 'First heading in another typeface', how: '--kn-typeface-heading-1 in CSS', style: chain({ headingOne: systemSerif }), note: 'A rare exception, so CSS only.' },
  { name: 'First heading in another colour', how: '--kn-text-heading-1 in CSS', style: chain({ colour: 'var(--kn-accent)' }), note: 'A rare exception, so CSS only.' },
];
