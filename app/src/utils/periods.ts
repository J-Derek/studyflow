import type { Assignment, CourseGrade, Note, PeriodLabel, StudySession } from '../types';

/**
 * Starting a new semester (or term, or trimester). Nothing is deleted: everything the student does not carry over is ARCHIVED, which means it is
 * tagged with the period it belonged to and moved out of the current screens into "Past semesters", where it can still be read.
 */
export const PERIOD_LABELS: PeriodLabel[] = ['semester', 'term', 'trimester'];

export function isPeriodLabel(value: unknown): value is PeriodLabel {
  return typeof value === 'string' && (PERIOD_LABELS as string[]).includes(value);
}

/** The word to show: "semester", "term" or "trimester". Anything unknown reads as "semester". */
export function periodWord(label: PeriodLabel | undefined | null): string {
  return isPeriodLabel(label) ? label : 'semester';
}

export function periodWordCapital(label: PeriodLabel | undefined | null): string {
  const w = periodWord(label);
  return w[0]!.toUpperCase() + w.slice(1);
}

export interface Current {
  assignments: Assignment[];
  sessions: StudySession[];
  grades: CourseGrade[];
  notes: Note[];
}

export interface CarryChoice {
  /** Unfinished assignments (and exams, tests, readings) the student ticked to keep. */
  assignmentIds: Set<string>;
  noteIds: Set<string>;
  /** Keep the weekly timetable as it is (many courses repeat). */
  keepTimetable: boolean;
  /** Keep the courses (codes, credits, weights) but not their scores. */
  keepCourses: boolean;
}

export interface ArchivePlan {
  archive: Current;
  keep: Current;
  counts: { archived: number; kept: number };
}

/**
 * Splits what is current into what stays and what is archived. Finished work and anything not ticked is archived; unfinished work and notes
 * stay only when ticked. A course that stays has its scores cleared (they belonged to the old period, which keeps its own copy).
 */
export function planArchive(current: Current, choice: CarryChoice, periodId: string): ArchivePlan {
  const keepAssignments = current.assignments.filter((a) => a.status !== 'completed' && choice.assignmentIds.has(a.id));
  const keepNotes = current.notes.filter((n) => choice.noteIds.has(n.id));
  const keep: Current = {
    assignments: keepAssignments,
    notes: keepNotes,
    sessions: choice.keepTimetable ? current.sessions : [],
    grades: choice.keepCourses ? current.grades.map((g) => ({ ...g, assessments: g.assessments.map(({ score: _score, ...rest }) => rest) })) : []
  };
  const keptIds = {
    assignments: new Set(keepAssignments.map((a) => a.id)),
    notes: new Set(keepNotes.map((n) => n.id))
  };
  const archive: Current = {
    assignments: current.assignments.filter((a) => !keptIds.assignments.has(a.id)),
    notes: current.notes.filter((n) => !keptIds.notes.has(n.id)),
    sessions: choice.keepTimetable ? [] : current.sessions,
    // A kept course keeps its id; its OLD scores go to the archive under a new id so the past period still shows them.
    grades: choice.keepCourses ? current.grades.map((g) => ({ ...g, id: `${g.id}~${periodId}` })) : current.grades
  };
  const count = (c: Current) => c.assignments.length + c.sessions.length + c.grades.length + c.notes.length;
  return { archive, keep, counts: { archived: count(archive), kept: count(keep) } };
}

/** A short id for a period, readable in the cloud console: "p-2026-11-09-ab3x". */
export function newPeriodId(now: Date = new Date(), rand: () => string = () => Math.random().toString(36).slice(2, 6)): string {
  const d = now.toISOString().slice(0, 10);
  return `p-${d}-${rand()}`;
}
