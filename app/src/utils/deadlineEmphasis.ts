import type { Assignment } from '../types';
import { kindOf } from './kinds';

export type DueTone = 'overdue' | 'today' | 'tomorrow' | 'later';

export interface DueSoonTone {
  tone: DueTone;
  /** Always shown as words, so the colour is never the only signal. */
  label: string;
  /** Badge colours, borrowed from the kind badges (already checked for contrast in light and dark). */
  badge: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

const BADGE: Record<DueTone, string> = {
  overdue: 'bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
  today: 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  tomorrow: 'bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800',
  later: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600'
};

/** How close a "YYYY-MM-DD" due date is to today, as a tone, words and badge colours. */
export function dueSoonTone(dueDate: string, today: string): DueSoonTone {
  const days = dayNumber(dueDate) - dayNumber(today);
  const tone: DueTone = days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'later';
  const [, m, d] = dueDate.split('-').map(Number);
  const label =
    tone === 'overdue' ? 'Overdue' : tone === 'today' ? 'Today' : tone === 'tomorrow' ? 'Tomorrow' : days <= 6 ? `In ${days} days` : `${d} ${MONTHS[m - 1]}`;
  return { tone, label, badge: BADGE[tone] };
}

const WEIGHTY = new Set(['exam', 'test', 'project']);

/** True when a day holds an unfinished exam, test or project, or any unfinished high-priority deadline. */
export function needsAttention(due: Assignment[]): boolean {
  return due.some((a) => a.status !== 'completed' && (WEIGHTY.has(kindOf(a)) || a.priority === 'high'));
}
