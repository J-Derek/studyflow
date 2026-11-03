import type { Subtask, AssignmentStatus } from '../types';

export interface SubtaskProgressResult {
  progress: number;
  status: AssignmentStatus;
  allDone: boolean;
  completedCount: number;
  totalCount: number;
}

/**
 * Pure state-machine logic for calculating assignment progress from subtasks.
 * INVARIANT: Progress can only reach 100% if ALL subtasks are complete (totalCount > 0).
 * If even one subtask remains incomplete, progress is strictly capped at 99%.
 */
export function calculateSubtaskProgress(
  subtasks: Subtask[] | undefined | null,
  fallbackProgress = 0
): SubtaskProgressResult {
  if (!subtasks || subtasks.length === 0) {
    const isComplete = fallbackProgress >= 100;
    return {
      progress: fallbackProgress,
      status: isComplete ? 'completed' : fallbackProgress > 0 ? 'in_progress' : 'pending',
      allDone: isComplete,
      completedCount: 0,
      totalCount: 0
    };
  }

  const totalCount = subtasks.length;
  const completedCount = subtasks.filter((s) => s.completed).length;
  const allDone = completedCount === totalCount;
  const anyDone = completedCount > 0;

  // Strict invariant: 100% only when allDone is true; otherwise capped at 99%.
  const progress = allDone
    ? 100
    : Math.min(99, Math.floor((completedCount / totalCount) * 100));

  const status: AssignmentStatus = allDone
    ? 'completed'
    : anyDone
      ? 'in_progress'
      : 'pending';

  return {
    progress,
    status,
    allDone,
    completedCount,
    totalCount
  };
}
