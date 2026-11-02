import type { Identity, MenuItem, Language, Search, Cta, FooterBandData } from '../../src/components/frame-types';
export const identity: Identity = {
  label: 'Juniper Atlas', href: '#home', name: 'Juniper Atlas', slogan: 'Ideas for shared places',
  logo: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M20 2a18 18 0 1 1 0 36 18 18 0 0 1 0-36Zm0 7a11 11 0 1 0 0 22 11 11 0 0 0 0-22Z"/><circle cx="20" cy="20" r="4.5" fill="currentColor"/></svg>' },
};
export const menu: MenuItem[] = [
  { label: 'Studio', href: '#home', current: true, children: [{ label: 'Our approach', href: '#notes', description: 'Look closely and begin together' }, { label: 'People', href: '#notes', description: 'Meet the shared table' }] },
  { label: 'Projects', href: '#notes', children: [{ label: 'Shared gardens', href: '#notes', description: 'Spaces for everyday encounters' }, { label: 'Open tables', href: '#notes', description: 'A place to exchange ideas' }] },
  { label: 'Notebook', href: '#notes', children: [{ label: 'Field notes', href: '#notes', description: 'Observations from familiar places' }, { label: 'Guides', href: '#notes', description: 'Small, practical starting points' }] },
  { label: 'Visit', href: '#contact', children: [{ label: 'Workshops', href: '#contact', description: 'Bring a question along' }, { label: 'Contact', href: '#contact', description: 'Start a conversation' }] },
];
export const languages: Language[] = [{ label: 'English', code: 'en', href: '#home', current: true }, { label: 'Svenska', code: 'sv', href: '#home' }, { label: 'Deutsch', code: 'de', href: '#home' }];
export const search: Search = { action: '#search', links: [{ label: 'Workshops', href: '#notes' }, { label: 'Field notes', href: '#notes' }, { label: 'Contact', href: '#contact' }] };
export const cta: Cta = { label: 'Let’s talk', href: '#contact' };
const logo = '<a href="#home" data-kn-type="heading-3">Juniper Atlas</a>';
const about = 'A small invented studio exploring useful ideas for shared places.';
const quick = [{ label: 'Studio', href: '#home' }, { label: 'Projects', href: '#notes' }, { label: 'Notebook', href: '#notes' }, { label: 'Contact', href: '#contact' }];
const legal = [{ label: 'Privacy', href: '#contact' }, { label: 'Accessibility', href: '#contact' }, { label: 'Preferences', href: '#contact' }];
export const footerBands: FooterBandData[] = [
  { surface: 'brand', cells: [{ id: 'identity', column: 'A', content: logo }, { id: 'quick', column: 'B', links: quick, align: 'center' }] },
  { surface: 'brand', cells: [{ id: 'about', column: 'A', text: about }, { id: 'visit', column: 'B', heading: 'Come with a question', text: 'Open tables every Thursday, 10–16.', level: 2 }] },
  { surface: 'inverse', compact: true, cells: [{ id: 'copyright', column: 'A', text: '© 2026 Juniper Atlas' }, { id: 'legal', column: 'B', links: legal }] },
];
const pair = (surface: FooterBandData['surface']): FooterBandData => ({ surface, cells: [{ id: 'identity', column: 'A', content: logo }, { id: 'quick', column: 'B', links: quick, align: 'center' }] });
const detail = (surface: FooterBandData['surface']): FooterBandData => ({ surface, rule: true, verticalRule: true, cells: [{ id: 'about', column: 'A', text: about }, { id: 'address', column: 'B', text: '17 Meadow Lane · Greenhaven', links: legal }] });
export const footerVariants: { title: string; bands: FooterBandData[]; rules?: 'content' | 'full' }[] = [
  { title: 'One band / brand', bands: [pair('brand')] },
  { title: 'One band / page and separating hairline', bands: [pair('page')] },
  { title: 'Two bands / one run', bands: [pair('brand'), detail('brand')] },
  { title: 'Two colours / compact utility', bands: footerBands },
  { title: 'Four bands / four Surfaces', bands: [pair('tint'), detail('raised'), detail('brand'), { ...detail('inverse'), compact: true }] },
  { title: 'Two colours / three runs', bands: [pair('brand'), detail('brand'), detail('tint'), detail('brand')] },
  { title: 'Merged opening row', bands: [{ surface: 'brand', cells: [{ id: 'statement', column: 'A', columns: 2, heading: 'A little room for a new perspective', level: 3 }] }, pair('brand'), detail('brand')] },
  { title: 'Merged middle row / interrupted vertical line', bands: [{ ...pair('brand'), verticalRule: true }, { surface: 'brand', rule: true, verticalRule: true, cells: [{ id: 'statement', column: 'A', columns: 2, text: 'The notebook stays open for the next idea.' }] }, detail('brand')] },
  { title: 'Tall A cell / three rows', bands: [{ surface: 'brand', verticalRule: true, cells: [{ id: 'identity', column: 'A', rows: 3, content: logo, text: about }, { id: 'quick', column: 'B', links: quick }] }, { surface: 'brand', rule: true, verticalRule: true, cells: [{ id: 'visit', column: 'B', text: 'Visit the open table.' }] }, { surface: 'brand', rule: true, verticalRule: true, cells: [{ id: 'legal', column: 'B', links: legal }] }] },
  { title: 'Tall B cell / hairline stops at A', bands: [{ surface: 'brand', verticalRule: true, cells: [{ id: 'identity', column: 'A', content: logo }, { id: 'links', column: 'B', rows: 3, heading: 'Places to begin', level: 3, links: quick, text: 'Follow an observation into the next shared project.' }] }, { surface: 'brand', rule: true, verticalRule: true, cells: [{ id: 'about', column: 'A', text: about }] }, { surface: 'brand', rule: true, verticalRule: true, cells: [{ id: 'address', column: 'A', text: '17 Meadow Lane · Greenhaven' }] }] },
  { title: 'Missing cells / columns remain', bands: [pair('brand'), { surface: 'brand', cells: [{ id: 'visit', column: 'B', text: 'Open tables every Thursday.' }] }, { surface: 'brand', cells: [{ id: 'address', column: 'A', text: '17 Meadow Lane · Greenhaven' }] }] },
  { title: 'Empty band / one continuous run', bands: [pair('tint'), { surface: 'inverse', cells: [] }, detail('tint')] },
  { title: 'Both hairlines / content extent', bands: [{ ...pair('brand'), verticalRule: true }, detail('brand'), detail('brand')] },
  { title: 'Both hairlines / full extent', rules: 'full', bands: [{ ...pair('brand'), verticalRule: true }, detail('brand'), detail('brand')] },
  { title: 'Hairlines across colour changes', bands: [{ ...pair('tint'), verticalRule: true }, detail('raised'), detail('brand'), detail('inverse')] },
];
