import type { Assignment, AssignmentKind, StudySession } from '../types';

/**
 * What kind of deadline an item is. Most students only add homework, so exams, tests, readings and projects were never entered. Naming
 * them, with a hint, is how the app nudges people to add them. A missing kind means "assignment" (everything made before kinds existed).
 */
export const ASSIGNMENT_KINDS: AssignmentKind[] = ['assignment', 'exam', 'test', 'reading', 'project'];

/**
 * THE colour system. Every kind of class block and every kind of deadline has exactly one hue, and a hue means one thing everywhere (key,
 * week view, month dots, day list). The only shared hue is rose for "exam": a class block of type exam and a deadline of kind exam are the
 * same concept. A finished deadline is always grey (zinc) with a strike-through, never its kind's hue. Tailwind needs whole class names,
 * so each hue lists its classes literally.
 */
export type Hue = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate' | 'orange' | 'cyan' | 'fuchsia' | 'zinc';

export interface HueClasses {
  /** A filled dot or swatch. */
  dot: string;
  /** Left edge of a timetable block. */
  edge: string;
  /** Text on a tinted background, with a border (the word is always shown; colour is never the only signal). */
  badge: string;
}

export const HUE_CLASSES: Record<Hue, HueClasses> = {
  blue: { dot: 'bg-blue-500', edge: 'border-l-blue-500 dark:border-l-blue-400', badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800' },
  emerald: { dot: 'bg-emerald-500', edge: 'border-l-emerald-500 dark:border-l-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' },
  violet: { dot: 'bg-violet-500', edge: 'border-l-violet-500 dark:border-l-violet-400', badge: 'bg-violet-50 dark:bg-violet-950/50 text-violet-900 dark:text-violet-200 border-violet-300 dark:border-violet-800' },
  amber: { dot: 'bg-amber-500', edge: 'border-l-amber-500 dark:border-l-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800' },
  rose: { dot: 'bg-rose-500', edge: 'border-l-rose-500 dark:border-l-rose-400', badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800' },
  slate: { dot: 'bg-slate-600 dark:bg-slate-300', edge: 'border-l-slate-600 dark:border-l-slate-300', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-400 dark:border-slate-600' },
  orange: { dot: 'bg-orange-600 dark:bg-orange-500', edge: 'border-l-orange-600 dark:border-l-orange-500', badge: 'bg-orange-50 dark:bg-orange-950/50 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-800' },
  cyan: { dot: 'bg-cyan-600 dark:bg-cyan-500', edge: 'border-l-cyan-600 dark:border-l-cyan-500', badge: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-900 dark:text-cyan-200 border-cyan-300 dark:border-cyan-800' },
  fuchsia: { dot: 'bg-fuchsia-500', edge: 'border-l-fuchsia-500 dark:border-l-fuchsia-400', badge: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-900 dark:text-fuchsia-200 border-fuchsia-300 dark:border-fuchsia-800' },
  zinc: { dot: 'bg-zinc-300 dark:bg-zinc-600', edge: 'border-l-zinc-300 dark:border-l-zinc-600', badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600' }
};

/** The one table: which hue each concept has. `exam` is the one concept that appears as both a class block and a deadline. */
export const CONCEPT_HUE = {
  lecture: 'blue',
  lab: 'emerald',
  study: 'violet',
  review: 'amber',
  exam: 'rose',
  assignment: 'slate',
  test: 'orange',
  reading: 'cyan',
  project: 'fuchsia',
  done: 'zinc'
} as const satisfies Record<string, Hue>;

export type Concept = keyof typeof CONCEPT_HUE;

export interface KindMeta {
  label: string;
  /** Plain-words example shown when picking this kind. */
  hint: string;
  /** Badge colours (text on a tinted background; the word is always shown, colour is never the only signal). */
  badge: string;
  /** The dot used in the key and the month view. */
  dot: string;
}

export const KIND_META: Record<AssignmentKind, KindMeta> = {
  assignment: { label: 'Assignment', hint: 'Homework, a problem set, an essay.', badge: HUE_CLASSES[CONCEPT_HUE.assignment].badge, dot: HUE_CLASSES[CONCEPT_HUE.assignment].dot },
  exam: { label: 'Exam', hint: 'End-of-semester or final exam.', badge: HUE_CLASSES[CONCEPT_HUE.exam].badge, dot: HUE_CLASSES[CONCEPT_HUE.exam].dot },
  test: { label: 'Test', hint: 'A CAT, quiz or mid-semester test.', badge: HUE_CLASSES[CONCEPT_HUE.test].badge, dot: HUE_CLASSES[CONCEPT_HUE.test].dot },
  reading: { label: 'Reading', hint: 'A chapter or paper to read before class.', badge: HUE_CLASSES[CONCEPT_HUE.reading].badge, dot: HUE_CLASSES[CONCEPT_HUE.reading].dot },
  project: { label: 'Project', hint: 'A group or long-term project.', badge: HUE_CLASSES[CONCEPT_HUE.project].badge, dot: HUE_CLASSES[CONCEPT_HUE.project].dot }
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
  lecture: { label: 'Lecture', edge: HUE_CLASSES[CONCEPT_HUE.lecture].edge, swatch: HUE_CLASSES[CONCEPT_HUE.lecture].dot },
  lab: { label: 'Lab', edge: HUE_CLASSES[CONCEPT_HUE.lab].edge, swatch: HUE_CLASSES[CONCEPT_HUE.lab].dot },
  study: { label: 'Study', edge: HUE_CLASSES[CONCEPT_HUE.study].edge, swatch: HUE_CLASSES[CONCEPT_HUE.study].dot },
  review: { label: 'Review', edge: HUE_CLASSES[CONCEPT_HUE.review].edge, swatch: HUE_CLASSES[CONCEPT_HUE.review].dot },
  exam: { label: 'Exam', edge: HUE_CLASSES[CONCEPT_HUE.exam].edge, swatch: HUE_CLASSES[CONCEPT_HUE.exam].dot }
};

/** A finished deadline: always the neutral grey, never its kind's colour. */
export const DONE_DOT = HUE_CLASSES[CONCEPT_HUE.done].dot;
