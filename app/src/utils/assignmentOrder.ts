import type { Assignment } from '../types';
import { selectPendingDeadlines } from './calendarMonth';

/**
 * The order of the Assignments list. Unfinished work first, in the same order Today and the Timetable use (overdue, then by date,
 * priority and time; see selectPendingDeadlines). Finished work goes to the bottom, the most recently finished first, so a slip of the
 * finger is easy to find and undo. The list it is given is not changed.
 */
export function orderAssignmentsList(assignments: Assignment[]): Assignment[] {
  const finished = assignments
    .filter((a) => a.status === 'completed')
    .sort((x, y) => (y.completedAt ?? '').localeCompare(x.completedAt ?? '') || y.dueDate.localeCompare(x.dueDate) || x.title.localeCompare(y.title));
  return [...selectPendingDeadlines(assignments), ...finished];
}
