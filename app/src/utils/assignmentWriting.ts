import type { Assignment, Draft } from '../types';

/** The code part of an assignment's course ("LAW 101 — Contract law" gives "LAW 101"), which is what notes are filed under. */
export const courseCode = (course: string): string => course.split('—')[0]?.trim() ?? '';

export interface AssignmentWriting {
  assignment: Assignment;
  draft: Draft;
}

/**
 * The writing done in the writing space for each assignment, as the Notes page lists it next to the notes: only writing with some text,
 * only for assignments that still exist, matched by the same search box and course filter as the notes, newest first.
 */
export function assignmentWritings(drafts: Draft[], assignments: Assignment[], filter: { query: string; course: string }): AssignmentWriting[] {
  const byId = new Map(assignments.map((a) => [a.id, a]));
  const q = filter.query.trim().toLowerCase();
  return drafts
    .filter((d) => d.body.trim() !== '')
    .flatMap((draft) => {
      const assignment = byId.get(draft.id);
      return assignment ? [{ assignment, draft }] : [];
    })
    .filter(({ assignment }) => {
      if (filter.course === 'all') return true;
      if (filter.course === 'none') return !courseCode(assignment.course);
      return courseCode(assignment.course) === filter.course || assignment.course === filter.course;
    })
    .filter(({ assignment, draft }) => !q || [assignment.title, assignment.course, draft.body].some((t) => t.toLowerCase().includes(q)))
    .sort((x, y) => y.draft.editedAt.localeCompare(x.draft.editedAt));
}
