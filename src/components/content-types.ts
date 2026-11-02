import type { Level } from './frame-types';

export interface TableColumn { label: string; align?: 'start' | 'center' | 'end'; numeric?: boolean }
export type TableCell = string | { text: string; colspan?: number; rowspan?: number; header?: boolean };
export interface FaqItem { question: string; answer: string }
export interface ContentHeading { depth: number; slug: string; text: string }
export interface ContentsEntry extends ContentHeading { children: ContentsEntry[] }
export type { Level };
