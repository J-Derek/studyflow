import React from 'react';
import { ASSIGNMENT_KINDS, CLASS_TYPE_META, DONE_DOT, KIND_META } from '../utils/kinds';
import { useIsPhone } from '../lib/useIsPhone';

/**
 * The colour key: one plain style (a dot and its word) in two labelled groups. Classes are round dots, deadlines are square dots, and a
 * finished deadline is grey. Each item keeps its longer meaning as a tooltip. Which groups show depends on the view.
 */
export const Legend: React.FC<{ show: ('kinds' | 'classTypes' | 'month')[] }> = ({ show }) => {
  // On a phone the key folds away (the colours also carry their words in the lists), so it does not take a screen of its own.
  const phone = useIsPhone();
  const Wrap = phone ? 'details' : 'div';
  return (
  <Wrap
    data-testid="legend"
    role="group"
    aria-label="Colour key"
    className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 space-y-1"
  >
    {phone && <summary className="font-semibold cursor-pointer min-h-[44px] flex items-center">Colour key</summary>}
    {show.includes('classTypes') && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold w-16 shrink-0">Classes</span>
        <ul aria-label="Class colours" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(Object.keys(CLASS_TYPE_META) as (keyof typeof CLASS_TYPE_META)[]).map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${CLASS_TYPE_META[t].swatch}`} />
              {CLASS_TYPE_META[t].label}
            </li>
          ))}
        </ul>
      </div>
    )}
    {show.includes('kinds') && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold w-16 shrink-0">Deadlines</span>
        <ul aria-label="Kinds of deadline" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ASSIGNMENT_KINDS.map((k) => (
            <li key={k} title={KIND_META[k].hint} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${KIND_META[k].dot}`} />
              {KIND_META[k].label}
            </li>
          ))}
          <li title="A finished deadline is grey" className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${DONE_DOT}`} />
            <span className="line-through">Done</span>
          </li>
        </ul>
      </div>
    )}
  </Wrap>
  );
};
