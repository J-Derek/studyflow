import type { Assignment, AssignmentKind, StudySession } from '../types';

/**
 * What kind of deadline an item is. Most students only add homework, so exams, tests, readings and projects were never entered. Naming
 * them, with a hint, is how the app nudges people to add them. A missing kind means "assignment" (everything made before kinds existed).
 */
export const ASSIGNMENT_KINDS: AssignmentKind[] = ['assignment', 'exam', 'test', 'reading', 'project'];

export interface KindMeta {
  label: string;
  /** Plain-words example shown when picking this kind. */
  hint: string;
  /** Badge colours (text on a tinted background; the word is always shown, colour is never the only signal). */
  badge: string;
}

export const KIND_META: Record<AssignmentKind, KindMeta> = {
  assignment: { label: 'Assignment', hint: 'Homework, a problem set, an essay.', badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600' },
  exam: { label: 'Exam', hint: 'End-of-semester or final exam.', badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800' },
  test: { label: 'Test', hint: 'A CAT, quiz or mid-semester test.', badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800' },
  reading: { label: 'Reading', hint: 'A chapter or paper to read before class.', badge: 'bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800' },
  project: { label: 'Project', hint: 'A group or long-term project.', badge: 'bg-violet-50 dark:bg-violet-950/50 text-violet-900 dark:text-violet-200 border-violet-300 dark:border-violet-800' }
};

export function isAssignmentKind(value: unknown): value is AssignmentKind {
  return typeof value === 'string' && (ASSIGNMENT_KINDS as string[]).includes(value);
}

/** The kind of an item; anything missing or unknown is an ordinary assignment. */
export function kindOf(a: Pick<Assignment, 'kind'>): AssignmentKind {
  return isAssignmentKind(a.kind) ? a.kind : 'assignment';
}

export interface ClassTypeMeta {
  label: string;
  /** Left-edge colour of a block in the timetable. */
  edge: string;
  /** Small swatch used in the key. */
  swatch: string;
}

/** The timetable's class types and the colour each one has (the Help tour says blocks are coloured by type). */
export const CLASS_TYPE_META: Record<StudySession['type'], ClassTypeMeta> = {
  lecture: { label: 'Lecture', edge: 'border-l-blue-500 dark:border-l-blue-400', swatch: 'bg-blue-500' },
  lab: { label: 'Lab', edge: 'border-l-emerald-500 dark:border-l-emerald-400', swatch: 'bg-emerald-500' },
  study: { label: 'Study', edge: 'border-l-violet-500 dark:border-l-violet-400', swatch: 'bg-violet-500' },
  review: { label: 'Review', edge: 'border-l-amber-500 dark:border-l-amber-400', swatch: 'bg-amber-500' },
  exam: { label: 'Exam', edge: 'border-l-rose-500 dark:border-l-rose-400', swatch: 'bg-rose-500' }
};
