import type { Assignment, AssignmentStatus } from '../types';
import { calculateSubtaskProgress } from './subtasks';

/**
 * How an assignment's progress is worked out.
 * - With a checklist: from the ticks ("2 of 5 done"). The student does not also move a slider, so the two can never disagree.
 *   Progress reaches 100% only when every item is ticked (see calculateSubtaskProgress).
 * - Without one: a simple status, not started, in progress or done (the circle on the list). There is no hand-set percentage any more;
 *   the stored number follows the status (see statusProgress), and an old hand-set number is not shown.
 * A finished assignment always shows 100%.
 */
export interface ProgressInfo {
  mode: 'checklist' | 'status';
  /** 0 to 100, what to show. */
  progress: number;
  done: number;
  total: number;
  /** Words for the screen: "Based on your checklist: 2 of 5 done", or the status ("Not started", "In progress", "Done"). */
  note: string;
}

const STATUS_WORDS: Record<AssignmentStatus, string> = { pending: 'Not started', in_progress: 'In progress', completed: 'Done' };

/** The progress stored with an item that has no checklist: it follows the status (in progress is the halfway value un-marking has always used). */
export function statusProgress(status: AssignmentStatus): number {
  return status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0;
}

export function progressInfo(a: Pick<Assignment, 'subtasks' | 'progress' | 'status'>): ProgressInfo {
  const subtasks = a.subtasks ?? [];
  if (subtasks.length === 0) {
    return { mode: 'status', progress: statusProgress(a.status), done: 0, total: 0, note: STATUS_WORDS[a.status] ?? STATUS_WORDS.pending };
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
  return { progress: statusProgress('in_progress'), status: 'in_progress' };
}
