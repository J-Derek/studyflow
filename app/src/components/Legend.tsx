import React from 'react';
import { ASSIGNMENT_KINDS, CLASS_TYPE_META, KIND_META } from '../utils/kinds';
import { KindBadge } from './KindBadge';

/**
 * A one-line colour key: what each colour stands for, with no paragraphs to read. Each item keeps its longer meaning as a tooltip.
 * Which parts show depends on the view.
 */
export const Legend: React.FC<{ show: ('kinds' | 'classTypes' | 'month')[] }> = ({ show }) => (
  <div
    data-testid="legend"
    role="group"
    aria-label="Colour key"
    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-surface-light dark:bg-surface-dark px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300"
  >
    <span className="font-semibold">Key</span>
    {show.includes('classTypes') && (
      <ul aria-label="Class colours" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(Object.keys(CLASS_TYPE_META) as (keyof typeof CLASS_TYPE_META)[]).map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${CLASS_TYPE_META[t].swatch}`} />
            {CLASS_TYPE_META[t].label}
          </li>
        ))}
      </ul>
    )}
    {show.includes('kinds') && (
      <ul aria-label="Kinds of deadline" className="flex flex-wrap items-center gap-1.5">
        {ASSIGNMENT_KINDS.map((k) => (
          <li key={k} title={KIND_META[k].hint}>
            <KindBadge kind={k} />
          </li>
        ))}
      </ul>
    )}
    {show.includes('month') && (
      <ul aria-label="Month view marks" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-400">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
          classes
        </li>
        <li className="flex items-center gap-1.5" title="Red while something is still to do, green when all are done">
          <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-rose-500" />
          deadlines
        </li>
      </ul>
    )}
  </div>
);
