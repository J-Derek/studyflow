import { useId } from 'react';
import type { Repeat } from '../types';
import { DATE_MAX, DATE_MIN } from '../utils/limits';

interface RepeatToggleProps {
  value: Repeat | undefined;
  onChange: (next: Repeat | undefined) => void;
}

/** "Repeats weekly" with an optional last date. The next one is made when this one is done or its date passes (see utils/repeat). */
export function RepeatToggle({ value, onChange }: RepeatToggleProps) {
  const id = useId();
  const on = !!value;
  return (
    <div data-testid="repeat-toggle">
      <label htmlFor={`${id}-on`} className="inline-flex items-center gap-2 min-h-[44px] text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
        <input
          id={`${id}-on`}
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? { every: 'week' } : undefined)}
          className="h-4 w-4 accent-blue-600"
        />
        Repeats weekly
      </label>
      {on && (
        <div className="space-y-1 pl-6">
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor={`${id}-until`} className="text-xs text-zinc-700 dark:text-zinc-300">Stop after (optional)</label>
            <input
              id={`${id}-until`}
              type="date"
              min={DATE_MIN}
              max={DATE_MAX}
              value={value?.until ?? ''}
              onChange={(e) => onChange({ every: 'week', ...(e.target.value ? { until: e.target.value } : {}) })}
              className="px-2.5 py-1.5 min-h-[44px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-surface-light dark:bg-zinc-900/60 text-xs tabular-nums text-zinc-800 dark:text-zinc-200 focus:outline-none"
            />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">The next one appears a week later when you finish this one, or when its date passes.</p>
        </div>
      )}
    </div>
  );
}
