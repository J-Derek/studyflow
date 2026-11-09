import React from 'react';
import { ASSIGNMENT_KINDS, CLASS_TYPE_META, KIND_META } from '../utils/kinds';
import { KindBadge } from './KindBadge';

/**
 * A key for anything on the screen that is not obvious. Closed by default so it does not crowd the page; the summary is a full-size
 * tap target. Which sections show depends on the page.
 */
export const Legend: React.FC<{ show: ('kinds' | 'classTypes' | 'priority' | 'progress' | 'month')[] }> = ({ show }) => (
  <details data-testid="legend" className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark text-xs">
    <summary className="flex items-center min-h-[44px] px-3 cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">What do the labels mean?</summary>
    <div className="px-3 pb-3 space-y-3 text-zinc-700 dark:text-zinc-300">
      {show.includes('kinds') && (
        <div>
          <p className="font-semibold mb-1">Kinds of deadline</p>
          <ul className="space-y-1">
            {ASSIGNMENT_KINDS.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <KindBadge kind={k} />
                <span className="text-zinc-600 dark:text-zinc-400">{KIND_META[k].hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {show.includes('classTypes') && (
        <div>
          <p className="font-semibold mb-1">Class colours</p>
          <ul className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {(Object.keys(CLASS_TYPE_META) as (keyof typeof CLASS_TYPE_META)[]).map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${CLASS_TYPE_META[t].swatch}`} />
                {CLASS_TYPE_META[t].label}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">An amber outline and a clash warning on a block mean two classes overlap in time.</p>
        </div>
      )}
      {show.includes('month') && (
        <div>
          <p className="font-semibold mb-1">Month view</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            A blue dot and a number: classes that day. A square and a number: deadlines due that day (red while something is still to do, green when all are done). Tap a day to see it.
          </p>
        </div>
      )}
      {show.includes('priority') && (
        <div>
          <p className="font-semibold mb-1">Priority</p>
          <p className="text-zinc-600 dark:text-zinc-400">High, medium or low is shown as a word. It is a label you can filter by; it does not change the order or the reminders.</p>
        </div>
      )}
      {show.includes('progress') && (
        <div>
          <p className="font-semibold mb-1">Progress</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            With a checklist, progress is worked out from the items you tick and reaches 100% only when all are ticked. Without one, you set it yourself when you edit.
          </p>
        </div>
      )}
    </div>
  </details>
);
