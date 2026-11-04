// Shared data contracts for the page frame. Content comes from the consuming site.
export type Surface = 'page' | 'raised' | 'tint' | 'tint-secondary' | 'tint-tertiary' | 'brand' | 'inverse' | 'accent' | 'picture-light' | 'picture-dark' | 'status-info' | 'status-success' | 'status-warning' | 'status-error';
export type Level = 1 | 2 | 3 | 4 | 5 | 6;
export interface FrameLink { label: string; href: string; current?: boolean; description?: string; consentOpen?: boolean }
export interface MenuItem extends FrameLink { children?: FrameLink[] }
export interface Language extends FrameLink { code: string }
export interface Identity {
  label: string; href: string; name?: string; slogan?: string;
  logo?: { src?: string; svg?: string; light?: string; dark?: string };
  brandAxis?: 'row' | 'column'; brandAlign?: 'start' | 'center' | 'end';
  axis?: 'row' | 'column'; align?: 'start' | 'center' | 'end';
}
export interface MenuButton { word?: string; icon?: 'chevron-down' | 'menu' | false; label?: string }
export interface Search { action: string; label?: string; links?: FrameLink[]; surface?: Surface; blur?: boolean; heading?: boolean }
export interface Cta { label: string; href?: string; dialog?: string }
export interface FooterCellData {
  id: string; column: 'A' | 'B'; rows?: number; columns?: 1 | 2;
  align?: 'start' | 'center' | 'stretch'; heading?: string; level?: Level;
  text?: string; links?: FrameLink[]; content?: string; slot?: string;
}
export interface FooterBandData {
  surface: Surface; cells: FooterCellData[]; compact?: boolean; rule?: boolean; verticalRule?: boolean;
}
