import React from 'react';
import type { Assignment, StudySession } from '../types';
import { monthGrid } from '../utils/calendarMonth';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Tuesday 17 November" for the screen reader. */
export function spokenDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${LONG_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${LONG_MONTH[m - 1]}`;
}

interface MonthGridProps {
  year: number;
  /** 1 to 12 */
  month: number;
  /** Classes repeat weekly, so the count for a day only needs the weekday. */
  sessions: StudySession[];
  deadlines: Map<string, Assignment[]>;
  /** "YYYY-MM-DD" of today, so it can be marked. */
  today: string;
  onSelectDay: (date: string) => void;
}

/**
 * A month at a glance. Each day is one big button (at least 44px tall): it shows how many classes and deadlines are on it, and opens that
 * day's list. Counts are written as numbers, so colour is never the only signal.
 */
export const MonthGrid: React.FC<MonthGridProps> = ({ year, month, sessions, deadlines, today, onSelectDay }) => {
  const rows = React.useMemo(() => monthGrid(year, month), [year, month]);
  const perWeekday = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const s of sessions) counts[s.dayOfWeek % 7] = (counts[s.dayOfWeek % 7] ?? 0) + 1;
    return counts;
  }, [sessions]);

  return (
    <div data-testid="month-grid" className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5 text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {d}
          </div>
        ))}
      </div>
      <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
        {rows.map((row) => (
          <div key={row[0]!.date} className="grid grid-cols-7 divide-x divide-zinc-200/70 dark:divide-zinc-800/70">
            {row.map((cell) => {
              const classes = perWeekday[cell.dayOfWeek] ?? 0;
              const due = deadlines.get(cell.date) ?? [];
              const pending = due.filter((a) => a.status !== 'completed').length;
              const isToday = cell.date === today;
              const label =
                `${spokenDate(cell.date)}` +
                (classes ? `, ${classes} ${classes === 1 ? 'class' : 'classes'}` : '') +
                (due.length ? `, ${due.length} ${due.length === 1 ? 'deadline' : 'deadlines'}${pending < due.length ? ` (${due.length - pending} done)` : ''}` : ', nothing planned');
              return (
                <button
                  key={cell.date}
                  type="button"
                  data-date={cell.date}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => onSelectDay(cell.date)}
                  className={`min-h-[56px] md:min-h-[88px] p-1 md:p-1.5 flex flex-col items-start justify-between text-left transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 focus-visible:outline-2 focus-visible:outline-blue-500 ${
                    cell.inMonth ? '' : 'bg-zinc-50/50 dark:bg-zinc-900/30'
                  } ${isToday ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`}
                >
                  <span className="sr-only">{label}</span>
                  <span
                    className={`tabular-nums text-xs font-medium ${
                      isToday
                        ? 'inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-blue-600 text-white'
                        : cell.inMonth
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                    aria-hidden="true"
                  >
                    {cell.day}
                  </span>
                  <span className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs tabular-nums text-zinc-700 dark:text-zinc-300" aria-hidden="true">
                    {classes > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        {classes}
                      </span>
                    )}
                    {due.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className={`h-1.5 w-1.5 rounded-[2px] ${pending > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {due.length}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
