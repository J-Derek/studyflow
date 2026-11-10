import React, { useId } from 'react';
import { CalendarPlus, Clock, Plus, X } from 'lucide-react';
import type { Assignment, StudySession } from '../types';
import { useDialog } from '../lib/useDialog';
import { CLASS_TYPE_META, kindOf } from '../utils/kinds';
import { spokenDate } from './MonthGrid';
import { KindBadge } from './KindBadge';

interface DaySheetProps {
  /** "YYYY-MM-DD", or null when closed. */
  date: string | null;
  classes: StudySession[];
  deadlines: Assignment[];
  onClose: () => void;
  onAddDeadline: (date: string) => void;
  onAddClass: (dayOfWeek: number) => void;
  onEditDeadline: (a: Assignment) => void;
  onEditClass: (s: StudySession) => void;
}

/** What one tapped day holds, with a quick way to add a deadline or a class to it. */
export const DaySheet: React.FC<DaySheetProps> = ({ date, classes, deadlines, onClose, onAddDeadline, onAddClass, onEditDeadline, onEditClass }) => {
  const titleId = useId();
  const dialogRef = useDialog(date !== null, onClose);
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const row = 'w-full min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer';

  return (
    <div className="sf-fade motion-reduce:animate-none fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="day-sheet"
        onClick={(e) => e.stopPropagation()}
        className="sf-sheet w-full sm:max-w-md max-h-[85dvh] overflow-y-auto bg-surface-light dark:bg-surface-dark border border-zinc-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-xl shadow-2xl p-4 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{spokenDate(date)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section aria-label="Deadlines" className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Deadlines</h3>
          {deadlines.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing due. Exams, tests and readings go here too.</p>
          ) : (
            <ul className="space-y-1.5">
              {deadlines.map((a) => (
                <li key={a.id}>
                  <button type="button" className={row} onClick={() => onEditDeadline(a)}>
                    <span className={`flex-1 min-w-0 [overflow-wrap:anywhere] ${a.status === 'completed' ? 'line-through text-zinc-600 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {a.title}
                      <span className="block text-xs text-zinc-600 dark:text-zinc-400 no-underline">{a.course.split('—')[0]!.trim()}{a.dueTime ? ` · ${a.dueTime}` : ''}{a.status === 'completed' ? ' · done' : ''}</span>
                    </span>
                    {kindOf(a) !== 'assignment' && <KindBadge kind={kindOf(a)} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => onAddDeadline(date)} className={`${row} justify-center font-medium text-zinc-800 dark:text-zinc-100`}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add a deadline for this day
          </button>
        </section>

        <section aria-label="Classes" className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Classes</h3>
          {classes.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No classes on this weekday.</p>
          ) : (
            <ul className="space-y-1.5">
              {classes.map((c) => (
                <li key={c.id}>
                  <button type="button" className={row} onClick={() => onEditClass(c)}>
                    <span className="flex-1 min-w-0 text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">
                      {c.title}
                      <span className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {c.startTime} - {c.endTime} · {CLASS_TYPE_META[c.type]?.label ?? c.type}
                      </span>
                    </span>
                    <span aria-hidden="true" className={`h-3 w-3 rounded-sm shrink-0 ${CLASS_TYPE_META[c.type]?.swatch ?? 'bg-zinc-400'}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => onAddClass(weekday)} className={`${row} justify-center font-medium text-zinc-800 dark:text-zinc-100`}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a class on this weekday
          </button>
        </section>
      </div>
    </div>
  );
};
