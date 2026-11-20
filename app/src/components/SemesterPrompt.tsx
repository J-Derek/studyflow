import React, { useState } from 'react';
import { CalendarRange, X } from 'lucide-react';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
};

const DISMISS_KEY = 'studyflow_semester_prompt_dismissed_week';

/** The Monday of the week a "YYYY-MM-DD" date falls in, as "YYYY-MM-DD" (local calendar arithmetic, no time zones involved). */
export function weekStartOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const back = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - back);
  return t.toISOString().slice(0, 10);
}

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

interface Props {
  start?: string;
  end?: string;
  /** "YYYY-MM-DD" of today. */
  today: string;
  onOpen: () => void;
}

/**
 * Semester dates are what makes weekly classes stop when the term ends, so until both are set the Timetable asks for them with a clear card
 * and one primary button. The card can be put away for the rest of the week (then a quiet line remains). Once both dates are set there is
 * only a quiet "Semester: dates, Change" line.
 */
export const SemesterPrompt: React.FC<Props> = ({ start, end, today, onOpen }) => {
  const week = weekStartOf(today);
  const [dismissedWeek, setDismissedWeek] = useState<string | null>(readDismissed);

  if (start && end) {
    return (
      <p data-testid="semester-line" className="text-xs text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-x-2">
        <span>
          Semester: {shortDate(start)} to {shortDate(end)}
        </span>
        <button type="button" onClick={onOpen} aria-label="Change semester dates" className="inline-flex items-center min-h-[44px] md:min-h-0 px-1 font-medium text-zinc-800 dark:text-zinc-200 underline underline-offset-2 cursor-pointer">
          Change
        </button>
      </p>
    );
  }

  if (dismissedWeek === week) {
    return (
      <p data-testid="semester-line" className="text-xs text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-x-2">
        <span>Semester dates are not set.</span>
        <button type="button" onClick={onOpen} aria-label="Set semester dates" className="inline-flex items-center min-h-[44px] md:min-h-0 px-1 font-medium text-zinc-800 dark:text-zinc-200 underline underline-offset-2 cursor-pointer">
          Set dates
        </button>
      </p>
    );
  }

  const putAway = () => {
    try {
      localStorage.setItem(DISMISS_KEY, week);
    } catch {
      // the card simply comes back next time
    }
    setDismissedWeek(week);
  };

  return (
    <section
      data-testid="semester-card"
      aria-label="Semester dates"
      className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-3.5"
    >
      <CalendarRange className="h-5 w-5 mt-0.5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Set your semester dates</h2>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">Weekly classes then stop on the last day instead of repeating forever.</p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-2.5 inline-flex items-center justify-center min-h-[44px] md:min-h-0 px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-2xs cursor-pointer"
        >
          Set semester dates
        </button>
      </div>
      <button
        type="button"
        onClick={putAway}
        aria-label="Hide for this week"
        title="Hide for this week"
        className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -m-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
};
