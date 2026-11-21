import React, { useEffect, useId, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { TimerMode } from '../types';
import { useDialog } from '../lib/useDialog';
import { defaultMinutes, limitFor, MODE_NAME, resolveLength, stepLength } from '../lib/timerLength';

interface Props {
  mode: TimerMode;
  /** The saved length for this mode, in minutes. */
  saved: number;
  /** A paused block restarts at the new length when this is saved; an idle one just shows it. */
  paused: boolean;
  signedIn: boolean;
  onSave: (minutes: number) => void;
  onClose: () => void;
}

const btn =
  'inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-sm font-medium cursor-pointer disabled:cursor-not-allowed';

/**
 * Tap the time on the timer to change the length of the mode it is in (focus, short break or long break), like setting a clock.
 * What is saved is the same saved length the timer already uses, so it is there on the next visit (and on the student's other devices when signed in).
 */
export const TimerLengthDialog: React.FC<Props> = ({ mode, saved, paused, signedIn, onSave, onClose }) => {
  const titleId = useId();
  const inputId = useId();
  const ref = useDialog(true, onClose);
  // Focus the box after the dialog has noted what had focus before (so Escape can give it back); autoFocus would take focus too early.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const [typed, setTyped] = useState(String(saved));
  const limit = limitFor(mode);
  const { minutes, note } = resolveLength(typed, mode, saved);
  const name = MODE_NAME[mode];
  const dflt = defaultMinutes(mode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-xl bg-surface-light dark:bg-surface-dark border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
          <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Change the {name} length
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 -mr-2 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <form
          noValidate
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(minutes);
          }}
        >
          <label htmlFor={inputId} className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Minutes
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="One minute less"
              onClick={() => setTyped(stepLength(typed, mode, saved, -1))}
              className={`${btn} min-w-[44px] px-0 border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200`}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={limit}
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.currentTarget.value)}
              className="flex-1 min-w-0 min-h-[44px] px-3 text-center text-lg tabular-nums rounded-lg border border-zinc-300 dark:border-zinc-600 bg-surface-light dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              aria-label="One minute more"
              onClick={() => setTyped(stepLength(typed, mode, saved, 1))}
              className={`${btn} min-w-[44px] px-0 border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {note && (
            <p role="status" className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {note}
            </p>
          )}
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {paused ? 'Saving starts this block again at the new length. ' : ''}
            {signedIn ? 'Saved to your account.' : 'Saved on this device.'}
          </p>
          <button
            type="button"
            onClick={() => setTyped(String(dflt))}
            className="min-h-[44px] -ml-2 px-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
          >
            Reset to default
          </button>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={onClose} className={`${btn} text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
              Cancel
            </button>
            <button type="submit" className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
