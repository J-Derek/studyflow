import React, { useEffect, useState } from 'react';
import { useStudyFlowStore } from '../store/studyFlowStore';
import { useSyncErrors } from '../lib/syncErrors';
import { getSaveCopy, getSaveState, type SaveState } from '../utils/saveStatus';

const STYLE: Record<SaveState, { box: string; dot: string }> = {
  error: { box: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300', dot: 'bg-red-500' },
  offline: { box: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-400', dot: 'bg-amber-500' },
  device: { box: 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/70 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300', dot: 'bg-zinc-400' },
  saving: { box: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-400', dot: 'bg-blue-500' },
  saved: { box: 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/70 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300', dot: 'bg-emerald-500' }
};

/**
 * The "is my work safe?" light in the top bar. It watches every collection (not just assignments), turns red when
 * the cloud has refused a save, and is a dot on phones with the same words for screen readers.
 */
export const SaveBadge: React.FC = () => {
  const { isSyncing, userId, isAnonymous } = useStudyFlowStore();
  const errors = useSyncErrors();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const isSignedIn = !isAnonymous;
  const state = getSaveState({ isOnline, isSyncing, errorCount: errors.length, hasAccount: userId !== null, isSignedIn });
  const copy = getSaveCopy(state, { isSignedIn, errorCount: errors.length });
  const style = STYLE[state];

  return (
    <div
      aria-live="polite"
      data-testid="save-badge"
      data-state={state}
      title={copy.detail}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs tabular-nums transition-colors ${style.box}`}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {state === 'saving' && <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`} />
      </span>
      {/* On a phone only the dot shows; the words are still read out */}
      <span className="sr-only sm:not-sr-only">{copy.label}</span>
      <span className="sr-only">. {copy.detail}</span>
    </div>
  );
};
