import type { HTMLAttributes } from 'astro/types';
import type { Level, Surface } from './frame-types';
export type Width = 'narrow' | 'wide' | 'full' | 'bleed-start' | 'bleed-end';
export type MetaSeparator = 'comma' | 'bar' | 'dot' | 'none';
export interface ContentMeta { text: string; datetime?: string; href?: string; pill?: boolean; kind?: 'author' | 'date' | 'category' }
export interface ContentCta { label: string; style: 'link' | 'button'; icon?: '›' | '»' | '→' | '➔' }
export interface ContentParts {
  title: string; href: string; level?: Level;
  type?: 'display' | 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4' | 'heading-5' | 'heading-6';
  picture?: { src: string; alt?: string; loading?: 'lazy' | 'eager' };
  meta1?: ContentMeta[]; meta2?: ContentMeta[]; metaSeparator?: MetaSeparator;
  text?: string; excerpt?: string; cta?: ContentCta; linkAttributes?: HTMLAttributes<'a'>;
  kind?: 'article' | 'document' | 'video'; fileType?: string; fileSize?: string;
}
export interface ContentItem extends ContentParts {
  surface?: Surface; group?: string; filters?: Record<string, string | string[]>; searchText?: string;
}
export interface FieldOption { value: string; label: string; disabled?: boolean }
export interface ConsentService { name: string; provider: string; thirdParty: boolean; purpose: string; storage: string; data: string }
export interface ConsentCategory { id: string; label: string; description: string; required?: boolean; services?: ConsentService[] }
export interface ConsentTexts {
  title: string; description: string; acceptAll: string; rejectAll: string; settings: string;
  settingsTitle: string; settingsDescription: string; save: string; close: string; required: string;
  saved?: string; service?: string; services?: string; yes?: string; no?: string; columns?: string[];
}
