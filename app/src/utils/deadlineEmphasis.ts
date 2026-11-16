import type { Assignment } from '../types';
import { KIND_META, kindOf } from './kinds';

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
  overdue: KIND_META.exam.badge,
  today: KIND_META.test.badge,
  tomorrow: KIND_META.reading.badge,
  later: KIND_META.assignment.badge
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
