import React from 'react';
import { Download } from 'lucide-react';
import type { MonthSummary } from '../utils/calendarMonth';

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu 19 Nov" */
function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${SHORT_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${SHORT_MONTH[m - 1]}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One line about the month, with the way to take it to a calendar app. */
export const MonthSummaryBar: React.FC<{ summary: MonthSummary; monthName: string; onDownload: () => void }> = ({ summary, monthName, onDownload }) => {
  const parts: string[] = [];
  if (summary.exams) parts.push(plural(summary.exams, 'exam'));
  if (summary.tests) parts.push(plural(summary.tests, 'test'));
  if (summary.projects) parts.push(plural(summary.projects, 'project'));
  const text =
    summary.total === 0
      ? `Nothing due in ${monthName}.`
      : `${summary.pending === 0 ? 'All' : summary.pending} of ${plural(summary.total, 'deadline')} ${summary.pending === 0 ? 'done' : 'still to do'}` +
        (parts.length ? `: ${parts.join(', ')}` : '') +
        (summary.busiest ? `. Busiest day: ${shortDate(summary.busiest.date)} (${summary.busiest.count} due).` : '.');
  return (
    <div data-testid="month-summary" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-3 py-2">
      <p className="text-xs text-zinc-700 dark:text-zinc-300 tabular-nums">{text}</p>
      <button
        type="button"
        onClick={onDownload}
        title="Download this month's classes and deadlines as an .ics file for Google, Apple or Outlook Calendar"
        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium text-xs transition cursor-pointer shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span>Download this month</span>
      </button>
    </div>
  );
};
