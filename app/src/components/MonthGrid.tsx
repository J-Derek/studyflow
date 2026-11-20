import React from 'react';
import type { Assignment, StudySession } from '../types';
import { needsAttention } from '../utils/deadlineEmphasis';
import { classesOn, monthGrid, type Term } from '../utils/calendarMonth';
import { ASSIGNMENT_KINDS, CLASS_TYPE_META, DONE_DOT, KIND_META, kindOf } from '../utils/kinds';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Tuesday 17 November" for the screen reader. */
export function spokenDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${LONG_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${LONG_MONTH[m - 1]}`;
}

/** Exams, tests and projects come first on a day; ordinary work after them. */
const CHIP_ORDER: Record<string, number> = { exam: 0, test: 1, project: 2, assignment: 3, reading: 4 };

interface MonthGridProps {
  year: number;
  /** 1 to 12 */
  month: number;
  /** Weekly classes count on their weekday inside the semester; an exam or review only on its own date. */
  sessions: StudySession[];
  term?: Term;
  deadlines: Map<string, Assignment[]>;
  /** "YYYY-MM-DD" of today, so it can be marked. */
  today: string;
  onSelectDay: (date: string) => void;
}

/**
 * A month at a glance. Each day is one big button (at least 44px tall): it shows how many classes and deadlines are on it, and opens that
 * day's list. Counts are written as numbers, so colour is never the only signal.
 */
export const MonthGrid: React.FC<MonthGridProps> = ({ year, month, sessions, term, deadlines, today, onSelectDay }) => {
  const rows = React.useMemo(() => monthGrid(year, month), [year, month]);
  const perDate = React.useMemo(() => {
    const byDate = new Map<string, StudySession[]>();
    for (const row of rows) for (const cell of row) byDate.set(cell.date, classesOn(sessions, cell.date, term));
    return byDate;
  }, [rows, sessions, term]);

  return (
    <div data-testid="month-grid" className="animate-fade-in motion-reduce:animate-none rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark overflow-hidden">
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
              const classList = perDate.get(cell.date) ?? [];
              const classes = classList.length;
              // One mark per kind, in that kind's colour, with its count: round for classes, square for deadlines; finished deadlines are grey.
              const classMarks = (Object.keys(CLASS_TYPE_META) as (keyof typeof CLASS_TYPE_META)[])
                .map((t) => ({ key: `c-${t}`, dot: CLASS_TYPE_META[t].swatch, n: classList.filter((c) => c.type === t).length, round: true, label: CLASS_TYPE_META[t].label }))
                .filter((m) => m.n > 0);
              const due = deadlines.get(cell.date) ?? [];
              const pending = due.filter((a) => a.status !== 'completed').length;
              const deadlineMarks = [
                ...ASSIGNMENT_KINDS.map((k) => ({ key: `d-${k}`, dot: KIND_META[k].dot, n: due.filter((a) => a.status !== 'completed' && kindOf(a) === k).length, round: false, label: KIND_META[k].label })),
                { key: 'd-done', dot: DONE_DOT, n: due.length - pending, round: false, label: 'Done' }
              ].filter((m) => m.n > 0);
              const isToday = cell.date === today;
              // A busier day is shaded warmer, and an unfinished exam, test or project shows by name on bigger screens.
              const heat = !cell.inMonth ? '' : pending >= 3 ? 'bg-rose-50 dark:bg-rose-950/30' : pending === 2 ? 'bg-amber-50 dark:bg-amber-950/30' : pending === 1 ? 'bg-amber-50/50 dark:bg-amber-950/15' : cell.dayOfWeek === 0 || cell.dayOfWeek === 6 ? 'bg-zinc-50/60 dark:bg-zinc-900/25' : '';
              const chips = due.filter((a) => a.status !== 'completed').sort((x, y) => (CHIP_ORDER[kindOf(x)] ?? 9) - (CHIP_ORDER[kindOf(y)] ?? 9)).slice(0, 2);
              const more = pending - chips.length;
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
                  data-attention={needsAttention(due) ? 'true' : undefined}
                  style={{ position: 'relative' }}
                  onClick={() => onSelectDay(cell.date)}
                  className={`min-h-[56px] md:min-h-[104px] p-1 md:p-1.5 min-w-0 flex flex-col items-start justify-between gap-1 text-left transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none cursor-pointer hover:shadow-[inset_0_0_0_1px_rgb(113_113_122/0.5)] focus-visible:outline-2 focus-visible:outline-blue-500 ${
                    cell.inMonth ? heat : 'bg-zinc-50/50 dark:bg-zinc-900/30'
                  } ${isToday ? 'bg-blue-50 dark:bg-blue-950/40 shadow-[inset_0_0_0_2px_rgb(37_99_235/0.55)]' : ''}`}
                >
                  <span className="sr-only">{label}</span>
                  {/* An unfinished exam, test, project or high-priority deadline: a ring (a shape, not only a colour) and the same in words. */}
                  {needsAttention(due) && (
                    <span data-testid="attention-ring" className="sf-ring pointer-events-none absolute inset-0.5 rounded-md ring-2 ring-rose-500 dark:ring-rose-400">
                      <span className="sr-only">, needs attention</span>
                    </span>
                  )}
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
                  {chips.length > 0 && (
                    <span className="hidden md:flex flex-col gap-0.5 w-full min-w-0" aria-hidden="true">
                      {chips.map((a) => (
                        <span key={a.id} className={`block truncate rounded border px-1 py-px text-xs leading-tight ${KIND_META[kindOf(a)].badge}`}>
                          {a.title}
                        </span>
                      ))}
                      {more > 0 && <span className="text-xs text-zinc-700 dark:text-zinc-300 tabular-nums">+{more} more</span>}
                    </span>
                  )}
                  <span className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs tabular-nums text-zinc-700 dark:text-zinc-300" aria-hidden="true">
                    {[...classMarks, ...deadlineMarks].map((m) => (
                      <span key={m.key} title={`${m.n} ${m.label}`} className={`inline-flex items-center gap-0.5 ${m.key === 'd-done' ? 'text-zinc-500 dark:text-zinc-400' : ''}`}>
                        <span className={`h-1.5 w-1.5 ${m.round ? 'rounded-full' : 'rounded-[2px]'} ${m.dot}`} />
                        {m.n}
                      </span>
                    ))}
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
