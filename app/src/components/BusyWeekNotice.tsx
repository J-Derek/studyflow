import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Assignment } from '../types';
import { findBusyWeek } from '../utils/calendarMonth';
import { localDateISO } from '../utils/limits';

/** A quiet heads-up when 3 or more exams, tests or projects fall within 7 days. Shown on Today and the Timetable; renders nothing otherwise. */
export function BusyWeekNotice({ assignments }: { assignments: Assignment[] }) {
  const today = localDateISO();
  const week = useMemo(() => findBusyWeek(assignments, today), [assignments, today]);
  if (!week) return null;
  return (
    <div
      role="note"
      data-testid="busy-week"
      className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
    >
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{week.label}</p>
    </div>
  );
}
