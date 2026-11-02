import type { TableColumn, TableCell, FaqItem, ContentHeading } from '../../src/components/content-types';

export const workshopColumns: TableColumn[] = [{ label: 'Workshop' }, { label: 'Day' }, { label: 'Place' }];
export const workshopRows: TableCell[][] = [
  ['Field notebook', 'Tuesday', 'Meadow room'],
  ['Shared sketches', 'Thursday', 'Garden table'],
  ['Material stories', 'Saturday', 'Workshop bench'],
  ['Open questions', 'Sunday', 'Meadow room'],
];
export const totalsColumns: TableColumn[] = [{ label: 'Season' }, { label: 'Activity' }, { label: 'Sessions', numeric: true }, { label: 'Places', numeric: true }];
export const totalsRows: TableCell[][] = [
  [{ text: 'Spring', rowspan: 2, header: true }, 'Walks', '6', '72'],
  ['Sketches', '4', '32'],
  [{ text: 'Summer', rowspan: 2, header: true }, 'Walks', '8', '96'],
  ['Sketches', '6', '48'],
];
export const totalsFooter: TableCell[][] = [[{ text: 'Total across both seasons', colspan: 2, header: true }, '24', '248']];
export const wideColumns: TableColumn[] = [{ label: 'Workshop and gathering point' }, { label: 'Tuesday morning' }, { label: 'Wednesday afternoon' }, { label: 'Thursday morning' }, { label: 'Friday afternoon' }, { label: 'Saturday morning' }, { label: 'Sunday afternoon' }];
export const wideRows: TableCell[][] = [
  ['Notes from the meadow', 'Look along the river', 'Draw a small detail', 'Exchange observations', 'Choose a shared question', 'Visit the garden', 'Gather at the table'],
  ['Stories from the workbench', 'Bring a familiar object', 'Trace its materials', 'Imagine another purpose', 'Make a paper model', 'Try it with a neighbour', 'Share what changed'],
];
export const questions: FaqItem[] = [
  { question: 'What should I bring?', answer: 'Bring a notebook and one question about a place you know.' },
  { question: 'Can I join without drawing experience?', answer: '<p>Yes. We begin by <strong>looking and listening</strong>. Every perspective is welcome.</p>' },
  { question: 'Where do we meet?', answer: '<p>At the Juniper Atlas garden table. <a href="#toc-visit">Read the visiting notes</a> before you arrive.</p>' },
];
export const contentsHeadings: ContentHeading[] = [
  { depth: 2, slug: 'toc-observe', text: 'Observe the familiar' },
  { depth: 3, slug: 'toc-notebook', text: 'Keep a shared notebook' },
  { depth: 2, slug: 'toc-try', text: 'Try a small idea' },
  { depth: 3, slug: 'toc-materials', text: 'Choose materials with care' },
  { depth: 2, slug: 'toc-visit', text: 'Visit the open table' },
];
