import type { Identity, MenuItem, Language, Search, Cta, FooterBandData } from '../../src/components/frame-types';
import { icons } from '../../src/components/icons.js';
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
const statement = 'A small invented studio exploring useful ideas for shared places.';
const quick = [{ label: 'Studio', href: '#home' }, { label: 'Projects', href: '#notes' }, { label: 'Notebook', href: '#notes' }, { label: 'Contact', href: '#contact' }];
const social = `<ul class="kn-footer-social">${[['LinkedIn', 'linkedin'], ['Facebook', 'facebook'], ['YouTube', 'youtube'], ['Spotify', 'spotify'], ['Email', 'mail'], ['RSS', 'rss']].map(([label, icon]) => `<li><a href="#${icon}" aria-label="${label}"><svg class="kn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">${icons[icon as keyof typeof icons]}</svg></a></li>`).join('')}</ul>`;
const upperCells = { a1: { content: logo }, b1: { content: social }, a2: { text: statement }, b2: { links: quick } };
const lowerCells = {
  a1: { text: '17 Meadow Lane, Greenhaven' },
  b1: { text: 'Registration no. 000000-0000. Registered office: Greenhaven.' },
  a2: { links: [{ label: 'Cookie policy', href: '#cookie-policy' }, { label: 'Privacy policy', href: '#contact' }] },
  b2: { links: [{ label: 'Change privacy settings', href: '#cookie-policy', consentOpen: true }, { label: 'Revoke consents', href: '#cookie-policy' }] },
};
// The upper band with only the named cells; the lower band stays out of it.
const only = (...cells: (keyof typeof upperCells)[]): FooterBandData => ({ surface: 'brand', cells: Object.fromEntries(cells.map((cell) => [cell, upperCells[cell]])) });
const upper: FooterBandData = { surface: 'brand', cells: upperCells };
const lower: FooterBandData = { surface: 'inverse', cells: lowerCells };
export const footerProps: FooterProps = { upper, lower };
export interface FooterProps { upper?: FooterBandData; lower?: FooterBandData; fill?: 'column' | 'row'; rules?: 'content' | 'full'; horizontalRules?: boolean; verticalRule?: boolean }
export const footerVariants: { title: string; props: FooterProps }[] = [
  { title: 'All eight cells', props: footerProps },
  { title: 'Upper band alone', props: { upper } },
  { title: 'Lower band alone', props: { lower } },
  { title: 'One cell in column A / the box stays at the start edge', props: { upper: only('a2') } },
  { title: 'One cell in column B / the box stays at the end edge', props: { upper: only('b2') } },
  { title: 'Two in column A / each takes its row', props: { upper: only('a1', 'a2') } },
  { title: 'Two in column B / each takes its row', props: { upper: only('b1', 'b2') } },
  { title: 'Two in row 2 / row 1 has no height', props: { upper: only('a2', 'b2') } },
  { title: 'Two diagonally / fill by column', props: { upper: only('a1', 'b2') } },
  { title: 'Two diagonally / fill by row', props: { upper: only('a1', 'b2'), fill: 'row' } },
  { title: 'Three cells / fill by column', props: { upper: only('a2', 'b1', 'b2') } },
  { title: 'Three cells / fill by row', props: { upper: only('a2', 'b1', 'b2'), fill: 'row' } },
  { title: 'One colour / the bands close up', props: { upper, lower: { surface: 'brand', cells: lowerCells } } },
  { title: 'Both hairlines / content extent', props: { upper, lower: { surface: 'brand', cells: lowerCells }, horizontalRules: true, verticalRule: true } },
  { title: 'Both hairlines / full extent, through a tall cell and between two colours', props: { upper: only('a2', 'b1', 'b2'), lower, rules: 'full', horizontalRules: true, verticalRule: true } },
];
