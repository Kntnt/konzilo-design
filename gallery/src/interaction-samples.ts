import type { ContentItem, ConsentCategory, ConsentTexts } from '../../src/components/interaction-types';
import type { ComponentProps } from 'astro/types';
import type Field from '../../src/components/Field.astro';
import { landscape } from './samples.js';
const titles = ['Notes from the garden', 'A shared sketchbook', 'Walk beside the river', 'Materials at the table', 'A café in the meadow', 'The sheltered bench', 'Listening at the old bridge', 'Patterns in fallen leaves', 'Drawing the quiet corner', 'An invitation for neighbours', 'A map of small discoveries', 'Mending the workshop tools', 'Seeds for next spring', 'An evening of paper models', 'What the path remembers'];
export const loopItems: ContentItem[] = titles.map((title, i) => ({
  title, href: '#toc-observe', group: i < 9 ? '2026' : '2025',
  picture: i === 4 ? undefined : { src: landscape, alt: '' },
  meta1: [
    { text: ['Rowan Vale', 'Ellis Reed', 'Noor Lind'][i % 3], href: '#toc-notebook', kind: 'author' },
    { text: `${28 - i} October ${i < 9 ? '2026' : '2025'}`, datetime: `${i < 9 ? '2026' : '2025'}-10-${String(28 - i).padStart(2, '0')}`, kind: 'date' },
    { text: i % 2 ? 'Workshops' : 'Field notes', href: '#visitor-filters', kind: 'category' },
  ],
  text: 'A small observation becomes a useful starting point for a shared place.',
  filters: { topic: i % 2 ? ['workshops'] : ['field-notes'], year: [i < 9 ? '2026' : '2025'] },
}));
export const topics = [{ value: 'field-notes', label: 'Field notes' }, { value: 'workshops', label: 'Workshops' }];
export const yearOptions = [{ value: '', label: 'All years' }, { value: '2026', label: '2026' }, { value: '2025', label: '2025' }];
export const documents: ContentItem[] = [{ title: 'A notebook checklist', kind: 'document', href: 'data:text/plain,Bring%20a%20notebook%20and%20a%20pencil.', meta2: [{ text: 'Studio guides' }, { text: '20 October 2026', datetime: '2026-10-20' }], fileType: 'TXT', fileSize: '30 bytes', excerpt: 'A short, invented checklist to take on your next walk.' }];
export const videos: ContentItem[] = [{ title: 'An afternoon at the garden table', kind: 'video', href: 'https://www.youtube.com/watch?v=Juniper0001', meta1: [{ text: 'Studio films' }, { text: '22 October 2026', datetime: '2026-10-22' }], picture: { src: landscape, alt: '' }, excerpt: 'A film from the invented studio notebook.' }];
export const galleryNote = 'The content would show here. This gallery cannot load it, because its host blocks frames from other sites.';
export const providers = [
  ['YouTube', 'https://youtu.be/Juniper0001', 'A walk along the river'],
  ['Vimeo', 'https://vimeo.com/123456789', 'Making a paper model'],
  ['Screen9', 'https://api.screen9.com/embed/juniper-atlas', 'Opening the garden table'],
  ['Loom', 'https://www.loom.com/share/juniperatlas', 'How we keep our notes'],
  ['Spotify', 'https://open.spotify.com/episode/JuniperAtlas01', 'Episode 4: Small observations'],
  ['Acast', 'https://shows.acast.com/juniper-atlas/field-notes', 'Episode 9: The shared table'],
  ['Apple Podcasts', 'https://podcasts.apple.com/us/podcast/juniper-atlas/id123456789?i=123456789', 'Episode 12: Listening first'],
  ['Speaker Deck', 'https://speakerdeck.com/player/juniperatlas', 'Field notes, autumn edition'],
  ['Datawrapper', 'https://datawrapper.dwcdn.net/Atlas/1/', 'Workshop places by season'],
  ['CodePen', 'https://codepen.io/juniper-atlas/pen/Atlas01', 'A sketch of the meadow path'],
  ['LinkedIn', 'https://www.linkedin.com/embed/feed/update/urn:li:activity:123456789', 'What we learned at the open table'],
];
export const allFields: ComponentProps<typeof Field>[] = [
  { name: 'full-name', label: 'Name', help: 'The name you would like us to use.', required: true, requiredLabel: 'required', autocomplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', help: 'Use an address you can receive replies at.', value: 'a missing address', error: 'Enter an email address with an @ sign.', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', help: 'Include the country code.', autocomplete: 'tel' },
  { name: 'website', label: 'Website', type: 'url', help: 'A link to something you would like to share.' },
  { name: 'places', label: 'Places', type: 'number', min: 1, max: 8, value: '2', maxInlineSize: '10rem', help: 'Choose between one and eight places.' },
  { name: 'visit-date', label: 'Visit date', type: 'date', help: 'Choose a day for the workshop.' },
  { name: 'passphrase', label: 'Passphrase', type: 'password', help: 'An example password field.', autocomplete: 'new-password', minlength: 8 },
  { name: 'message', label: 'Your question', type: 'textarea', help: 'Tell us what you have been noticing.' },
  { name: 'session', label: 'Session', type: 'select', options: [{ value: '', label: 'Choose a session' }, { value: 'walk', label: 'Shared walk' }, { value: 'table', label: 'Open table' }], help: 'Pick the session you prefer.' },
  { name: 'interests', label: 'Interests', type: 'checkbox', options: topics, help: 'Choose any that interest you.' },
  { name: 'reply', label: 'Preferred reply', type: 'radio', options: [{ value: 'email', label: 'By email' }, { value: 'phone', label: 'By phone' }], required: true, help: 'Choose one way to hear from us.' },
];
export const consentCategories: ConsentCategory[] = [
  { id: 'necessary', label: 'Necessary', description: 'Saves your cookie choices. These preferences are necessary; optional services remain off until you accept them.', required: true, services: [{ name: 'kn-consent', provider: 'Juniper Atlas', thirdParty: false, purpose: 'Remember the cookie choices you made', storage: '182 days', data: 'Category choices, choice version and time' }] },
  { id: 'external-media', label: 'External content', description: 'Allows external players and visualisations. These third parties receive your IP address and may share usage data with their partners. The gallery substitutes local notes and sends no data.', services: [{ name: 'sample-player', provider: 'Meadow Media (invented)', thirdParty: true, purpose: 'Play films and remember player preferences; share viewing data with media partners', storage: '30 days', data: 'IP address, player preferences and viewing activity' }, { name: 'sample-chart', provider: 'River Charts (invented)', thirdParty: true, purpose: 'Display interactive charts; no onward sharing', storage: 'Session', data: 'IP address and chart interactions' }] },
  { id: 'analytics', label: 'Statistics', description: 'Optional audience statistics are not necessary. No statistics service runs in this gallery.', services: [{ name: 'sample-visit', provider: 'Garden Counts (invented)', thirdParty: true, purpose: 'Count visits; no onward sharing', storage: '90 days', data: 'Pseudonymous visit id, page address and device type' }] },
];
export const consentTexts: ConsentTexts = {
  title: 'Your cookie choices', description: 'We use necessary storage to remember your choice. With your permission, external content and optional statistics can also store data. You can change or withdraw your choice at any time.',
  acceptAll: 'Accept all', rejectAll: 'Reject optional', settings: 'Customise choices', settingsTitle: 'Cookie settings',
  settingsDescription: 'Choose separately for each purpose. Open a category to see its services and the data they use.', save: 'Save choices', close: 'Close settings', required: 'Always on',
};
