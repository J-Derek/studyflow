import type { Assignment } from '../types';
import { calculateSubtaskProgress } from './subtasks';

/**
 * How an assignment's progress is worked out.
 * - With a checklist: from the ticks ("2 of 5 done"). The student does not also move a slider, so the two can never disagree.
 *   Progress reaches 100% only when every item is ticked (see calculateSubtaskProgress).
 * - Without one: the number the student sets by hand (the slider in the edit dialog).
 * A finished assignment always shows 100%.
 */
export interface ProgressInfo {
  mode: 'checklist' | 'manual';
  /** 0 to 100, what to show. */
  progress: number;
  done: number;
  total: number;
  /** Words for the screen, for example "Based on your checklist: 2 of 5 done". Empty in manual mode. */
  note: string;
}

export function progressInfo(a: Pick<Assignment, 'subtasks' | 'progress' | 'status'>): ProgressInfo {
  const subtasks = a.subtasks ?? [];
  if (subtasks.length === 0) {
    return { mode: 'manual', progress: a.status === 'completed' ? 100 : a.progress, done: 0, total: 0, note: '' };
  }
  const calc = calculateSubtaskProgress(subtasks, a.progress);
  return {
    mode: 'checklist',
    progress: a.status === 'completed' ? 100 : calc.progress,
    done: calc.completedCount,
    total: calc.totalCount,
    note: `Based on your checklist: ${calc.completedCount} of ${calc.totalCount} done`
  };
}

/**
 * What an item becomes when the student un-marks it as done. With a checklist the progress comes back from the ticks (at most 99%,
 * since not finished); without one it returns to the halfway value it has always used.
 */
export function afterUncomplete(a: Pick<Assignment, 'subtasks'>): { progress: number; status: 'pending' | 'in_progress' } {
  if (a.subtasks && a.subtasks.length > 0) {
    const calc = calculateSubtaskProgress(a.subtasks, 0, { allowComplete: false });
    return { progress: calc.progress, status: calc.progress > 0 ? 'in_progress' : 'pending' };
  }
  return { progress: 50, status: 'in_progress' };
}
