import React, { useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { canRetry, dismissSyncError, retrySyncError, useSyncErrors } from '../lib/syncErrors';

/**
 * Tells the student when a change reached their screen but not their account, and why. Sits above the phone's
 * bottom bar. The change is still safe on this device, so the wording says so.
 */
export const SyncErrorToast: React.FC = () => {
  const errors = useSyncErrors();
  const [retrying, setRetrying] = useState(false);
  const latest = errors[0];
  if (!latest) return null;

  const more = errors.length - 1;
  const retry = async () => {
    setRetrying(true);
    await retrySyncError(latest.id);
    setRetrying(false);
  };

  return (
    <div
      role="alert"
      data-testid="sync-error-toast"
      className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-[60] w-[min(32rem,calc(100vw-2rem))] flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 shadow-lg"
    >
      <TriangleAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Couldn’t save {latest.what} to your account</p>
        <p className="mt-0.5">
          {latest.reason} It’s still on this device.
          {more > 0 ? ` (${more} more ${more === 1 ? 'change' : 'changes'} also not saved.)` : ''}
        </p>
        {canRetry(latest.id) && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="mt-2 min-h-[44px] px-3 rounded-lg bg-amber-900 dark:bg-amber-100 text-white dark:text-amber-950 text-sm font-medium disabled:opacity-60 cursor-pointer"
          >
            {retrying ? 'Trying again…' : 'Try again'}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissSyncError(latest.id)}
        aria-label="Dismiss this message"
        className="min-h-[44px] min-w-[44px] -my-2 -mr-2 flex items-center justify-center rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
