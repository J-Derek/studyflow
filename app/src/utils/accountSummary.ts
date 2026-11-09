import type { SaveState } from './saveStatus';

/**
 * Words for the "Your account" dialog. Kept apart from the component so they can be tested.
 */

/** One line about whether the student's work is safe, for the account dialog (the top-bar badge has its own shorter words). */
export function accountSyncLine(state: SaveState, errorCount: number): { label: string; tone: 'ok' | 'busy' | 'warn' | 'error' } {
  switch (state) {
    case 'saved':
      return { label: 'Saved to your account', tone: 'ok' };
    case 'saving':
      return { label: 'Saving to your account…', tone: 'busy' };
    case 'offline':
      return { label: 'Offline: changes wait on this device until you reconnect', tone: 'warn' };
    case 'device':
      return { label: 'Connecting to your account…', tone: 'busy' };
    case 'error':
      return {
        label: `${errorCount === 1 ? '1 change was' : `${errorCount} changes were`} not saved to your account (still on this device)`,
        tone: 'error'
      };
  }
}

/** "3 assignments", "1 note", "no notes". */
export function countLabel(n: number, one: string, many: string): string {
  if (n === 0) return `no ${many}`;
  return `${n} ${n === 1 ? one : many}`;
}

/** What the plan holds, without the sample rows (they are not the student's). */
export function planSummary(counts: { assignments: number; sessions: number; grades: number; notes: number }): string[] {
  return [
    countLabel(counts.assignments, 'assignment', 'assignments'),
    countLabel(counts.sessions, 'class in the timetable', 'classes in the timetable'),
    countLabel(counts.grades, 'course with grades', 'courses with grades'),
    countLabel(counts.notes, 'note', 'notes')
  ];
}
