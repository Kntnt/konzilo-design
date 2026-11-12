// Shared data contracts for the page frame. Content comes from the consuming site.
export type Surface = 'page' | 'raised' | 'tint' | 'tint-secondary' | 'tint-tertiary' | 'brand' | 'inverse' | 'accent' | 'picture-light' | 'picture-dark' | 'status-info' | 'status-success' | 'status-warning' | 'status-error';
export type Level = 1 | 2 | 3 | 4 | 5 | 6;
export interface FrameLink { label: string; href: string; current?: boolean; description?: string; consentOpen?: boolean }
export interface MenuItem extends FrameLink { children?: FrameLink[]; linkMenu?: boolean }
export interface Language extends FrameLink { code: string }
export interface Identity {
  label: string; href: string; name?: string; slogan?: string;
  logo?: { src?: string; svg?: string; light?: string; dark?: string };
  brandAxis?: 'row' | 'column'; sloganPlace?: 'beside' | 'below';
}
export interface MenuButton { word?: string; icon?: 'chevron-down' | 'menu' | false; label?: string }
// `label` names the field; `placeholder` says what the empty field shows: `word`, the default, is `word`, the site's own
// word such as "Search" or "Sök", or the label where it gives none; `icon` is a magnifier that goes as the visitor types.
// Without the close button (`close: false`), Esc or a click beside the box closes it.
export interface Search { action: string; label?: string; word?: string; placeholder?: 'none' | 'word' | 'icon'; links?: FrameLink[]; surface?: Surface; blur?: boolean; heading?: boolean; close?: boolean }
// The header's own words in the site's language, each left out the English of HEADER_WORDS in header.js.
export interface HeaderWords { skip?: string; menu?: string; mainMenu?: string; linkMenu?: string; openSearch?: string; search?: string; searchHeading?: string; closeSearch?: string; languages?: string; language?: string }
export interface Cta { label: string; href?: string; dialog?: string }
export type FooterCellName = 'a1' | 'b1' | 'a2' | 'b2';
export interface FooterCellData { heading?: string; level?: Level; text?: string; links?: FrameLink[]; content?: string }
// A cell holds data, or `true` for one filled by its slot, or `false` to stay empty whatever it is given.
export interface FooterBandData { surface?: Surface; cells?: Partial<Record<FooterCellName, FooterCellData | boolean>> }
